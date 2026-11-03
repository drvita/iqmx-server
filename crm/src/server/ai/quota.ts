import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";

export type QuotaStatus = {
  exceeded: boolean;
  usedTokensIn: number;
  usedTokensOut: number;
  maxTokensIn: number;
  maxTokensOut: number;
  hasCustomKey: boolean;
  month: string;
};

/** Formato YYYY-MM para cuota mensual. */
export function getCurrentMonthStr(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Consulta el estado de cuota de IA para la organización.
 * Si el inquilino configuró su propia llave de IA (aiApiKeyEncrypted), nunca se considera excedido.
 */
export async function checkAiQuota(
  organizationId: string,
  now = new Date()
): Promise<QuotaStatus> {
  const db = getDb();
  const month = getCurrentMonthStr(now);

  const [settings] = await db
    .select({
      maxTokensIn: schema.organizationSettings.maxTokensIn,
      maxTokensOut: schema.organizationSettings.maxTokensOut,
      aiApiKeyEncrypted: schema.organizationSettings.aiApiKeyEncrypted,
    })
    .from(schema.organizationSettings)
    .where(scoped(schema.organizationSettings.organizationId, organizationId))
    .limit(1);

  const maxTokensIn = settings?.maxTokensIn ?? 50000;
  const maxTokensOut = settings?.maxTokensOut ?? 20000;
  const hasCustomKey = Boolean(settings?.aiApiKeyEncrypted && settings.aiApiKeyEncrypted.trim().length > 0);

  // Si tiene llave propia del inquilino, el consumo va a su cuenta externa
  if (hasCustomKey) {
    return {
      exceeded: false,
      usedTokensIn: 0,
      usedTokensOut: 0,
      maxTokensIn,
      maxTokensOut,
      hasCustomKey: true,
      month,
    };
  }

  const [usage] = await db
    .select({
      tokensIn: schema.aiUsageMonthly.tokensIn,
      tokensOut: schema.aiUsageMonthly.tokensOut,
    })
    .from(schema.aiUsageMonthly)
    .where(
      and(
        scoped(schema.aiUsageMonthly.organizationId, organizationId),
        eq(schema.aiUsageMonthly.month, month)
      )
    )
    .limit(1);

  const usedTokensIn = usage?.tokensIn ?? 0;
  const usedTokensOut = usage?.tokensOut ?? 0;

  const exceeded = usedTokensIn >= maxTokensIn || usedTokensOut >= maxTokensOut;

  return {
    exceeded,
    usedTokensIn,
    usedTokensOut,
    maxTokensIn,
    maxTokensOut,
    hasCustomKey: false,
    month,
  };
}

/**
 * Registra los tokens consumidos en el mes corriente.
 */
export async function recordAiTokens(
  organizationId: string,
  tokensIn: number,
  tokensOut: number,
  now = new Date()
): Promise<void> {
  if (tokensIn <= 0 && tokensOut <= 0) return;
  const db = getDb();
  const month = getCurrentMonthStr(now);

  await db
    .insert(schema.aiUsageMonthly)
    .values({
      id: newId("aiUsage"),
      organizationId,
      month,
      tokensIn,
      tokensOut,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.aiUsageMonthly.organizationId, schema.aiUsageMonthly.month],
      set: {
        tokensIn: sql`${schema.aiUsageMonthly.tokensIn} + ${tokensIn}`,
        tokensOut: sql`${schema.aiUsageMonthly.tokensOut} + ${tokensOut}`,
        updatedAt: now,
      },
    });
}
