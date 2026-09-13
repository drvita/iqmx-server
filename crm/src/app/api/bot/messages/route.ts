import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { apiError, parseBody } from "@/lib/api";
import { requireBotKey, resolveInstanceOrg } from "@/server/bot/auth";
import { SendError, sendText } from "@/server/inbox/send";
import {
  resolveApprovedTemplate,
  sendTemplate,
  TemplateError,
  templateErrorStatus,
} from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  conversationId: z.string().min(1),
  /** Texto del mensaje libre (requiere ventana de 24 h abierta). */
  text: z.string().min(1).max(4096).optional(),

  /** ID interno de plantilla (opcional, alternativa a text). */
  templateId: z.string().trim().optional(),
  /** Nombre oficial de plantilla en Meta (opcional, alternativa a text). */
  templateName: z.string().trim().optional(),
  /** Código de idioma (ej. es_MX). */
  language: z.string().trim().optional(),
  /** Línea telefónica de WhatsApp específica. */
  phoneNumberId: z.string().trim().optional(),
  /** Variables {{1}}..{{n}} de la plantilla. */
  variables: z.array(z.string().trim().max(500)).max(10).optional(),
  variable: z.string().trim().max(500).optional(),
  /** Si es true, envía la plantilla incluso si un humano tomó el control. */
  force: z.boolean().optional().default(false),
});

/**
 * Envío del cerebro externo A TRAVÉS del CRM (`/api/bot/messages`):
 * - Si recibe `text`: envía mensaje de texto libre (requiere ventana de 24 h).
 * - Si recibe `templateId` o `templateName`: envía plantilla aprobada (abre o reabre ventana).
 */
export async function POST(req: Request) {
  const denied = requireBotKey(req);
  if (denied) return denied;

  const organizationId = await resolveInstanceOrg();
  if (!organizationId) {
    return apiError(409, "no_org", "La instancia aún no tiene organización");
  }

  const body = await parseBody(req, bodySchema);
  if (!body.ok) return body.response;

  const isTemplate = Boolean(body.data.templateId || body.data.templateName);
  if (!isTemplate && !body.data.text) {
    return apiError(
      422,
      "invalid",
      "Debes especificar 'text' para mensaje libre o 'templateId' / 'templateName' para plantilla"
    );
  }

  // Gate de handoff: el bot JAMÁS habla sobre una conversación pausada salvo force: true en plantillas
  const db = getDb();
  const convs = await db
    .select({
      aiEnabled: schema.conversation.aiEnabled,
      handoffAt: schema.conversation.handoffAt,
    })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.organizationId, organizationId),
        eq(schema.conversation.id, body.data.conversationId)
      )
    )
    .limit(1);
  const conv = convs[0];
  if (!conv) return apiError(404, "not_found", "Conversación no encontrada");

  const shouldBlockByHandoff = !conv.aiEnabled || conv.handoffAt !== null;
  if (shouldBlockByHandoff && (!isTemplate || !body.data.force)) {
    return apiError(409, "ai_paused", "La IA está en pausa en esta conversación");
  }

  // Flujo 1: Envío de plantilla
  if (isTemplate) {
    let template: typeof schema.template.$inferSelect;
    try {
      template = await resolveApprovedTemplate(organizationId, {
        templateId: body.data.templateId,
        templateName: body.data.templateName,
        language: body.data.language,
        phoneNumberId: body.data.phoneNumberId,
      });
    } catch (err) {
      if (err instanceof TemplateError) {
        return apiError(templateErrorStatus(err), err.code, err.message);
      }
      throw err;
    }

    const finalVars =
      body.data.variables ??
      (body.data.variable !== undefined ? [body.data.variable] : undefined);

    try {
      const result = await sendTemplate({
        organizationId,
        conversationId: body.data.conversationId,
        templateId: template.id,
        variables: finalVars,
      });

      return Response.json({
        ok: true,
        messageId: result.messageId,
        conversationId: body.data.conversationId,
        templateId: template.id,
        phoneNumberId: template.phoneNumberId,
      });
    } catch (err) {
      if (err instanceof TemplateError) {
        return apiError(templateErrorStatus(err), err.code, err.message);
      }
      if (err instanceof SendError) {
        return apiError(403, err.code, err.message);
      }
      throw err;
    }
  }

  // Flujo 2: Envío de texto libre
  try {
    const result = await sendText({
      conversationId: body.data.conversationId,
      organizationId,
      text: body.data.text!,
      aiGenerated: true,
    });
    return Response.json({ messageId: result.messageId });
  } catch (err) {
    if (err instanceof SendError) {
      if (err.code === "window_closed") {
        return apiError(409, "window_closed", err.message);
      }
      if (err.code === "sandbox_violation") {
        return apiError(409, "sandbox_violation", err.message);
      }
      return apiError(502, err.code, err.message);
    }
    throw err;
  }
}
