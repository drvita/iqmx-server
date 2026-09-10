import { apiError, withAuth } from "@/lib/api";
import { isAiConfigured } from "@/lib/env";
import { getOrganizationSettings } from "@/server/settings/service";
import { isLabEnabledForOrg } from "@/server/settings/limits";
import { generateScenariosForOrg } from "@/server/lab/generator";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (session, req: Request) => {
  if (!(await isLabEnabledForOrg(session.organizationId))) {
    return apiError(403, "feature_disabled", "El módulo de Laboratorio no está habilitado en tu membresía");
  }

  const orgSettings = await getOrganizationSettings(session.organizationId);
  const aiConfigured = Boolean(orgSettings.aiApiKeyEncrypted) || isAiConfigured();

  if (!aiConfigured) {
    return apiError(
      409,
      "ai_not_configured",
      "Configura tu proveedor de IA para generar escenarios personalizados"
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    forceAll?: boolean;
    assistantId?: string;
    testType?: "sandbox" | "agenda_flow" | "guardrails";
  };

  if (body.testType === "agenda_flow") {
    const { isAgendaEnabled } = await import("@/server/agenda/flag");
    if (!(await isAgendaEnabled(session.organizationId))) {
      return apiError(403, "agenda_disabled", "El módulo de agenda no está habilitado para esta organización");
    }
  }

  try {
    const result = await generateScenariosForOrg(session.organizationId, {
      forceAll: Boolean(body.forceAll),
      assistantId: body.assistantId,
      testType: body.testType,
    });
    return Response.json(result, { status: 200 });
  } catch (err) {
    console.error("[lab/scenarios/generate] error:", err);
    return apiError(
      500,
      "generation_failed",
      err instanceof Error ? err.message : "Error al generar escenarios con IA"
    );
  }
});
