import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { encryptSecret, decryptSecret, type EncryptedValue } from "@/lib/crypto";

export type PlanLimits = {
  agendaEnabled?: boolean;
  attributionEnabled?: boolean;
  channels?: string;
  maxWhatsappAccounts?: number;
  maxTeamMembers?: number;
  maxContacts?: number;
  maxTokensIn?: number;
  maxTokensOut?: number;
  aiEnabled?: boolean;
  labEnabled?: boolean;
  tasksEnabled?: boolean;
  aiApiKey?: string | null;
  aiModel?: string | null;
  aiJudgeModel?: string | null;
  aiBaseUrl?: string | null;
  agentCoalesceMs?: number;
  extra?: Record<string, unknown>;
};

export type TenantAiInput = {
  aiApiKey?: string | null;
  aiModel?: string | null;
  aiJudgeModel?: string | null;
  aiBaseUrl?: string | null;
  agentCoalesceMs?: number;
  botApiKey?: string | null;
};

/**
 * Obtiene la configuración de una organización.
 * Si no existe (ej. organización preexistente), la crea automáticamente
 * confiando en los valores por defecto nativos definidos en la tabla.
 */
export async function getOrganizationSettings(
  organizationId: string
): Promise<typeof schema.organizationSettings.$inferSelect> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.organizationSettings)
    .where(eq(schema.organizationSettings.organizationId, organizationId))
    .limit(1);

  if (rows[0]) return rows[0];

  const id = newId("settings");
  const [created] = await db
    .insert(schema.organizationSettings)
    .values({
      id,
      organizationId,
    })
    .returning();

  if (!created) {
    throw new Error(`No se pudo inicializar organizationSettings para org ${organizationId}`);
  }

  return created;
}

/**
 * Actualiza los límites y características de membresía de una organización.
 * EXCLUSIVO para llamadas administrativas autenticadas M2M del Servidor Central.
 */
export async function updateOrganizationPlanLimits(
  organizationId: string,
  limits: PlanLimits
): Promise<typeof schema.organizationSettings.$inferSelect> {
  await getOrganizationSettings(organizationId);
  const db = getDb();

  const updateData: Partial<typeof schema.organizationSettings.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (limits.agendaEnabled !== undefined) updateData.agendaEnabled = limits.agendaEnabled;
  if (limits.attributionEnabled !== undefined) updateData.attributionEnabled = limits.attributionEnabled;
  if (limits.channels !== undefined) updateData.channels = limits.channels;
  if (limits.maxWhatsappAccounts !== undefined) updateData.maxWhatsappAccounts = limits.maxWhatsappAccounts;
  if (limits.maxTeamMembers !== undefined) updateData.maxTeamMembers = limits.maxTeamMembers;
  if (limits.maxContacts !== undefined) updateData.maxContacts = limits.maxContacts;
  if (limits.maxTokensIn !== undefined) updateData.maxTokensIn = limits.maxTokensIn;
  if (limits.maxTokensOut !== undefined) updateData.maxTokensOut = limits.maxTokensOut;
  if (limits.aiEnabled !== undefined) updateData.aiEnabled = limits.aiEnabled;
  if (limits.labEnabled !== undefined) updateData.labEnabled = limits.labEnabled;
  if (limits.tasksEnabled !== undefined) updateData.tasksEnabled = limits.tasksEnabled;
  if (limits.extra !== undefined) updateData.extra = limits.extra;

  if (limits.aiApiKey !== undefined) {
    if (limits.aiApiKey && limits.aiApiKey.trim().length > 0) {
      const encrypted = encryptSecret(limits.aiApiKey.trim());
      updateData.aiApiKeyEncrypted = JSON.stringify(encrypted);
    } else {
      updateData.aiApiKeyEncrypted = null;
    }
  }
  if (limits.aiModel !== undefined) updateData.aiModel = limits.aiModel?.trim() || null;
  if (limits.aiJudgeModel !== undefined) updateData.aiJudgeModel = limits.aiJudgeModel?.trim() || null;
  if (limits.aiBaseUrl !== undefined) updateData.aiBaseUrl = limits.aiBaseUrl?.trim() || "https://openrouter.ai/api";
  if (limits.agentCoalesceMs !== undefined) updateData.agentCoalesceMs = limits.agentCoalesceMs;

  const [updated] = await db
    .update(schema.organizationSettings)
    .set(updateData)
    .where(eq(schema.organizationSettings.organizationId, organizationId))
    .returning();

  if (!updated) {
    throw new Error(`No se pudo actualizar organizationSettings para org ${organizationId}`);
  }

  return updated;
}

/**
 * Actualiza la configuración operativa del inquilino (IA, tiempos, llaves propias).
 * Usado por el usuario con sesión activa en la aplicación.
 * Las llaves de API se cifran con AES-256-GCM en reposo.
 */
export async function updateTenantAiConfig(
  organizationId: string,
  input: TenantAiInput
): Promise<typeof schema.organizationSettings.$inferSelect> {
  await getOrganizationSettings(organizationId);
  const db = getDb();

  const updateData: Partial<typeof schema.organizationSettings.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.aiApiKey !== undefined) {
    if (input.aiApiKey && input.aiApiKey.trim().length > 0) {
      const encrypted = encryptSecret(input.aiApiKey.trim());
      updateData.aiApiKeyEncrypted = JSON.stringify(encrypted);
    } else {
      updateData.aiApiKeyEncrypted = null;
    }
  }

  if (input.aiModel !== undefined) updateData.aiModel = input.aiModel?.trim() || null;
  if (input.aiJudgeModel !== undefined) updateData.aiJudgeModel = input.aiJudgeModel?.trim() || null;
  if (input.aiBaseUrl !== undefined) updateData.aiBaseUrl = input.aiBaseUrl?.trim() || "https://openrouter.ai/api";
  if (input.agentCoalesceMs !== undefined) updateData.agentCoalesceMs = input.agentCoalesceMs;
  if (input.botApiKey !== undefined) updateData.botApiKey = input.botApiKey?.trim() || null;

  const [updated] = await db
    .update(schema.organizationSettings)
    .set(updateData)
    .where(eq(schema.organizationSettings.organizationId, organizationId))
    .returning();

  if (!updated) {
    throw new Error(`No se pudo actualizar organizationSettings para org ${organizationId}`);
  }

  return updated;
}

/**
 * Descifra la clave de IA configurada por la organización, o retorna null si no tiene propia.
 */
export function getDecryptedAiApiKey(
  settings: typeof schema.organizationSettings.$inferSelect
): string | null {
  if (!settings.aiApiKeyEncrypted) return null;
  try {
    const parsed = JSON.parse(settings.aiApiKeyEncrypted) as EncryptedValue;
    return decryptSecret(parsed);
  } catch (err) {
    console.error("[settings] Error al descifrar aiApiKeyEncrypted:", err);
    return null;
  }
}
