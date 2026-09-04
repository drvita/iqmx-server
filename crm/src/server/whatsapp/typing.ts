import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import {
  getCredentialsByOrg,
  getCredentialsByPhoneNumberId,
} from "@/server/whatsapp/credentials";
import { graphRequest } from "@/lib/meta/client";

/**
 * Envía el indicador "escribiendo…" a WhatsApp y marca como leído el último mensaje entrante.
 * Best-effort: si falla Meta, jamás tumba el turno de la IA ni interrumpe la ejecución.
 */
export async function sendTypingIndicator(
  conversationId: string
): Promise<{ ok: boolean; reason?: string }> {
  const db = getDb();
  const convs = await db
    .select()
    .from(schema.conversation)
    .where(eq(schema.conversation.id, conversationId))
    .limit(1);

  const conv = convs[0];
  if (!conv) return { ok: false, reason: "not_found" };
  if (conv.isTest) return { ok: false, reason: "sandbox" };
  if (!conv.aiEnabled || conv.handoffAt) return { ok: false, reason: "ai_paused" };

  const msgs = await db
    .select({ waMessageId: schema.message.waMessageId })
    .from(schema.message)
    .where(
      and(
        eq(schema.message.conversationId, conv.id),
        eq(schema.message.direction, "in"),
        isNotNull(schema.message.waMessageId)
      )
    )
    .orderBy(desc(schema.message.createdAt))
    .limit(1);

  const wamid = msgs[0]?.waMessageId;
  if (!wamid) return { ok: false, reason: "no_inbound" };

  const creds = conv.phoneNumberId
    ? await getCredentialsByPhoneNumberId(conv.phoneNumberId)
    : await getCredentialsByOrg(conv.organizationId);

  if (!creds) return { ok: false, reason: "no_connection" };

  try {
    await graphRequest(`${creds.phoneNumberId}/messages`, {
      method: "POST",
      token: creds.token,
      body: {
        messaging_product: "whatsapp",
        status: "read",
        message_id: wamid,
        typing_indicator: { type: "text" },
      },
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "meta_error" };
  }
}
