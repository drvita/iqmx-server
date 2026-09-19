import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { describeSendError } from "@/lib/meta/send-errors";
import { publish } from "@/server/events/bus";
import type { WebhookStatus } from "@/server/inbox/webhook";

/** Orden monotónico de estados: nunca degradar (un delivered tardío no pisa read). */
const STATUS_RANK: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export function isUpgrade(current: string, next: string): boolean {
  if (next === "failed") return current !== "failed";
  const c = STATUS_RANK[current];
  const n = STATUS_RANK[next];
  if (c === undefined || n === undefined) return false;
  return n > c;
}

export async function applyStatusUpdate(
  organizationId: string,
  status: WebhookStatus
): Promise<void> {
  const next = status.status;
  if (!(next in STATUS_RANK) && next !== "failed") return; // estado desconocido

  const db = getDb();
  const rows = await db
    .select({
      id: schema.message.id,
      conversationId: schema.message.conversationId,
      status: schema.message.status,
    })
    .from(schema.message)
    .where(
      and(
        eq(schema.message.organizationId, organizationId),
        eq(schema.message.waMessageId, status.id)
      )
    )
    .limit(1);
  const msg = rows[0];
  if (!msg) return;
  if (!isUpgrade(msg.status, next)) return;

  const failure = status.errors?.[0];
  const error =
    next === "failed"
      ? describeSendError(failure?.code, failure?.message ?? failure?.title)
      : null;

  await db
    .update(schema.message)
    .set({ status: next as MessageStatus, error })
    .where(eq(schema.message.id, msg.id));

  publish(organizationId, {
    type: "message.status",
    data: {
      conversationId: msg.conversationId,
      messageId: msg.id,
      status: next,
      // Sin esto el operador ve el triángulo de fallo pero nunca el motivo.
      error,
    },
  });
}

/**
 * 017 — Actualiza a "read" los mensajes salientes entregados hasta cierta fecha/watermark.
 * Utilizado por Facebook Messenger, donde Meta envía watermark en milisegundos en vez de un mid específico.
 */
export async function applyWatermarkReadUpdate(
  organizationId: string,
  input: {
    channel: "messenger";
    recipientPsid: string;
    watermarkMs: number;
  }
): Promise<void> {
  const db = getDb();
  const cutoff = new Date(input.watermarkMs);

  // Busca el contacto asociado al PSID de Messenger
  const contacts = await db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(
      and(
        eq(schema.contact.organizationId, organizationId),
        eq(schema.contact.channel, "messenger"),
        eq(schema.contact.waIdentity, `fb:${input.recipientPsid}`)
      )
    )
    .limit(1);

  const contact = contacts[0];
  if (!contact) return;

  const convs = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.organizationId, organizationId),
        eq(schema.conversation.contactId, contact.id),
        eq(schema.conversation.channel, "messenger")
      )
    )
    .limit(1);

  const conv = convs[0];
  if (!conv) return;

  // Busca los mensajes salientes de esa conversación creados hasta el watermark que aún no estén en 'read'
  const msgs = await db
    .select({
      id: schema.message.id,
      status: schema.message.status,
    })
    .from(schema.message)
    .where(
      and(
        eq(schema.message.organizationId, organizationId),
        eq(schema.message.conversationId, conv.id),
        eq(schema.message.direction, "out")
      )
    );

  for (const m of msgs) {
    if (isUpgrade(m.status, "read")) {
      await db
        .update(schema.message)
        .set({ status: "read" })
        .where(eq(schema.message.id, m.id));

      publish(organizationId, {
        type: "message.status",
        data: {
          conversationId: conv.id,
          messageId: m.id,
          status: "read",
          error: null,
        },
      });
    }
  }
}

