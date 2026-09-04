import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { isWindowOpen, windowRemainingMs } from "@/server/inbox/window";
import type { ConversationDto } from "@/lib/types";

export async function listConversations(
  organizationId: string,
  since?: Date,
  options?: { allowedLineIds?: string[] }
): Promise<ConversationDto[]> {
  const db = getDb();
  const previewSql = sql<string | null>`(
    select coalesce(m.text, m.type)
    from message m
    where m.conversation_id = ${schema.conversation.id}
    order by m.created_at desc
    limit 1
  )`;
  const stageSql = sql<string | null>`(
    select s.name from lead l
    join pipeline_stage s on s.id = l.stage_id
    where l.contact_id = ${schema.contact.id}
    limit 1
  )`;

  const linePhoneSql = sql<string | null>`(
    select coalesce(mc.display_phone_number, mc.phone_number_id)
    from meta_credentials mc
    where mc.phone_number_id = ${schema.conversation.phoneNumberId}
    limit 1
  )`;
  const lineNameSql = sql<string | null>`(
    select coalesce(mc.label, mc.verified_name)
    from meta_credentials mc
    where mc.phone_number_id = ${schema.conversation.phoneNumberId}
    limit 1
  )`;

  const lineFilter = options?.allowedLineIds
    ? options.allowedLineIds.length > 0
      ? or(
          isNull(schema.conversation.phoneNumberId),
          inArray(schema.conversation.phoneNumberId, options.allowedLineIds)
        )
      : isNull(schema.conversation.phoneNumberId) // Si el agente no tiene líneas asignadas, no ve conversaciones con phoneNumberId
    : undefined;

  const rows = await db
    .select({
      conversation: schema.conversation,
      contact: schema.contact,
      preview: previewSql,
      stageName: stageSql,
      linePhone: linePhoneSql,
      lineName: lineNameSql,
    })
    .from(schema.conversation)
    .innerJoin(
      schema.contact,
      eq(schema.conversation.contactId, schema.contact.id)
    )
    .where(
      scoped(
        schema.conversation.organizationId,
        organizationId,
        eq(schema.conversation.isTest, false),
        since ? gt(schema.conversation.updatedAt, since) : undefined,
        lineFilter
      )
    )
    .orderBy(desc(sql`coalesce(${schema.conversation.lastMessageAt}, ${schema.conversation.createdAt})`));

  return rows.map((r) =>
    serializeConversation(
      r.conversation,
      r.contact,
      r.preview,
      r.stageName,
      r.linePhone,
      r.lineName
    )
  );
}

export async function getConversation(
  organizationId: string,
  conversationId: string
) {
  const db = getDb();
  const linePhoneSql = sql<string | null>`(
    select coalesce(mc.display_phone_number, mc.phone_number_id)
    from meta_credentials mc
    where mc.phone_number_id = ${schema.conversation.phoneNumberId}
    limit 1
  )`;
  const lineNameSql = sql<string | null>`(
    select coalesce(mc.label, mc.verified_name)
    from meta_credentials mc
    where mc.phone_number_id = ${schema.conversation.phoneNumberId}
    limit 1
  )`;
  const rows = await db
    .select({
      conversation: schema.conversation,
      contact: schema.contact,
      linePhone: linePhoneSql,
      lineName: lineNameSql,
    })
    .from(schema.conversation)
    .innerJoin(
      schema.contact,
      eq(schema.conversation.contactId, schema.contact.id)
    )
    .where(
      scoped(
        schema.conversation.organizationId,
        organizationId,
        eq(schema.conversation.id, conversationId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listMessages(
  organizationId: string,
  conversationId: string,
  since?: Date
) {
  const db = getDb();
  return db
    .select({ message: schema.message, media: schema.mediaAsset })
    .from(schema.message)
    .leftJoin(
      schema.mediaAsset,
      eq(schema.message.mediaAssetId, schema.mediaAsset.id)
    )
    .where(
      scoped(
        schema.message.organizationId,
        organizationId,
        eq(schema.message.conversationId, conversationId),
        since ? gt(schema.message.createdAt, since) : undefined
      )
    )
    .orderBy(schema.message.createdAt);
}

export function serializeConversation(
  c: typeof schema.conversation.$inferSelect,
  contact: typeof schema.contact.$inferSelect,
  preview: string | null = null,
  stageName: string | null = null,
  linePhone: string | null = null,
  lineName: string | null = null
): ConversationDto {
  return {
    id: c.id,
    channel: c.channel,
    phoneNumberId: c.phoneNumberId ?? null,
    linePhone: linePhone ?? (c.phoneNumberId ? c.phoneNumberId : null),
    lineName: lineName ?? null,
    contact: { id: contact.id, name: contact.name, phone: contact.phone },
    stageName,
    aiEnabled: c.aiEnabled,
    handoffAt: c.handoffAt?.toISOString() ?? null,
    handoffReason: c.handoffReason,
    lastInboundAt: c.lastInboundAt?.toISOString() ?? null,
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    unreadCount: c.unreadCount,
    windowOpen: isWindowOpen(c.lastInboundAt),
    windowRemainingMs: windowRemainingMs(c.lastInboundAt),
    preview,
  };
}

export async function updateConversation(
  organizationId: string,
  conversationId: string,
  patch: { aiEnabled?: boolean; reactivate?: boolean; markRead?: boolean }
) {
  const db = getDb();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.aiEnabled !== undefined) set.aiEnabled = patch.aiEnabled;
  if (patch.reactivate) {
    set.handoffAt = null;
    set.handoffReason = null;
    set.aiEnabled = patch.aiEnabled ?? true;
  }
  if (patch.markRead) set.unreadCount = 0;

  const updated = await db
    .update(schema.conversation)
    .set(set)
    .where(
      and(
        eq(schema.conversation.organizationId, organizationId),
        eq(schema.conversation.id, conversationId)
      )
    )
    .returning();
  return updated[0] ?? null;
}
