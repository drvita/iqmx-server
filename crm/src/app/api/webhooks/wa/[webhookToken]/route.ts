import { after } from "next/server";
import {
  type WebhookPayload,
} from "@/server/inbox/webhook";
import { processEchoesValue, processMessagesValue } from "@/server/inbox/ingest";
import { processTemplateStatusValue } from "@/server/whatsapp/template-events";

/**
 * Webhook público de WhatsApp (contrato webhook.md).
 * Capa 1: el segmento [webhookToken] debe coincidir (si no → 404 sin efectos).
 * Capa 2: firma x-hub-signature-256 solo si META_APP_SECRET está configurado.
 * El POST siempre responde 200 tras validar; el procesamiento va en after().
 */
import {
  getOrGenerateWebhookToken,
  getOrganizationByWebhookToken,
  isWebhookTokenValid,
} from "@/server/whatsapp/webhook-token";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ webhookToken: string }> };

export async function GET(req: Request, { params }: Params) {
  const { webhookToken } = await params;
  const tokenMatches = await isWebhookTokenValid(webhookToken);
  if (!tokenMatches) {
    return new Response(null, { status: 404 });
  }

  const url = new URL(req.url);
  const challenge = url.searchParams.get("hub.challenge");

  if (challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  return Response.json({
    ok: true,
    status: "ready",
    message: "Webhook de WhatsApp activo y listo para recibir eventos",
  });
}

export async function POST(req: Request, { params }: Params) {
  const { webhookToken } = await params;
  const org = await getOrganizationByWebhookToken(webhookToken);

  if (!org) {
    console.warn(
      "[WEBHOOK] Rechazado 404: el token de la URL no coincide con ningún token registrado"
    );
    return new Response(null, { status: 404 });
  }

  // Si la organización está suspendida o cancelada, responder 200 OK a Meta pero no procesar ni gastar IA
  if (org.status === "suspended" || org.status === "cancelled") {
    console.warn(
      `[WEBHOOK] Organización ${org.id} se encuentra ${org.status}. Evento ignorado sin procesar.`
    );
    return Response.json({ received: true, status: "ignored_suspended" });
  }

  const rawBody = await req.text();
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return Response.json({ received: true });
  }

  after(async () => {
    try {
      await processPayload(payload);
    } catch (err) {
      console.error("[webhook] error procesando payload:", err);
    }
  });

  return Response.json({ received: true });
}

async function processPayload(payload: WebhookPayload): Promise<void> {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (!change.value) continue;
      if (change.field === "messages") {
        await processMessagesValue(change.value);
      } else if (change.field === "smb_message_echoes") {
        // 008: mensajes enviados a mano desde la app del teléfono (coexistence)
        await processEchoesValue(change.value);
      } else if (change.field === "message_template_status_update") {
        await processTemplateStatusValue(entry.id ?? null, change.value);
      }
      // otros fields: ignorar sin error
    }
  }
}
