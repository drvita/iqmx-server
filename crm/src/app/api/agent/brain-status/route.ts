import { withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { getEnv, isAiConfigured } from "@/lib/env";
import { isBotKeyConfiguredForOrg } from "@/server/bot/auth";
import {
  botLastSeenAt,
  computeBrainStatus,
  getBrainHealth,
} from "@/server/bot/status";

export const dynamic = "force-dynamic";

/**
 * «Quién responde a tus clientes»: el agente incluido, el cerebro externo y
 * el aviso de doble respuesta. Ver `server/bot/status.ts`.
 */
export const GET = withAuth(async (session) => {
  const db = getDb();
  const { getOrganizationSettings } = await import("@/server/settings/service");
  const [rows, health, botKeyConfigured, orgSettings] = await Promise.all([
    db
      .select({ enabled: schema.agentProfile.enabled })
      .from(schema.agentProfile)
      .where(scoped(schema.agentProfile.organizationId, session.organizationId))
      .limit(1),
    getBrainHealth(getEnv().BRAIN_HEALTH_URL),
    isBotKeyConfiguredForOrg(session.organizationId),
    getOrganizationSettings(session.organizationId),
  ]);
  const aiConfigured = Boolean(orgSettings.aiApiKeyEncrypted) || isAiConfigured(orgSettings);
  const status = computeBrainStatus({
    aiConfigured,
    agentEnabled: rows[0]?.enabled ?? false,
    botKeyConfigured,
    lastSeenAt: botLastSeenAt(),
    health,
    now: new Date(),
  });
  return Response.json(status, { headers: { "cache-control": "no-store" } });
});
