import { and, desc, eq, or, sql } from "drizzle-orm";
import { apiError, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { isAiConfigured } from "@/lib/env";
import { getOrganizationSettings } from "@/server/settings/service";
import {
  AgendaDisabledForOrgError,
  AssistantHasNoLinesError,
  getQueuePosition,
  InsufficientConversationsError,
  NoAuditableConversationsError,
  NoConfiguredScenariosError,
  RunConflictError,
  startRun,
} from "@/server/lab/runner";

export const dynamic = "force-dynamic";

/** Historial de corridas con delta de score vs la anterior (FR-033). */
export const GET = withAuth(async (session, req: Request) => {
  const { isLabEnabledForOrg } = await import("@/server/settings/limits");
  if (!(await isLabEnabledForOrg(session.organizationId))) {
    return apiError(403, "feature_disabled", "El módulo de Laboratorio no está habilitado en tu membresía");
  }

  const orgSettings = await getOrganizationSettings(session.organizationId);
  const aiConfigured = Boolean(orgSettings.aiApiKeyEncrypted) || isAiConfigured();

  const url = new URL(req.url);
  const requestedAssistantId = url.searchParams.get("assistantId");

  const db = getDb();
  const runs = await db
    .select()
    .from(schema.agentTestRun)
    .where(
      and(
        scoped(schema.agentTestRun.organizationId, session.organizationId),
        requestedAssistantId
          ? eq(schema.agentTestRun.assistantId, requestedAssistantId)
          : sql`true`
      )
    )
    .orderBy(desc(schema.agentTestRun.startedAt))
    .limit(50);

  // Consultar si hay alguna corrida activa o en cola en la organización completa (para control de concurrencia multi-asistente)
  const activeOrgRuns = await db
    .select({
      id: schema.agentTestRun.id,
      testType: schema.agentTestRun.testType,
      suiteName: schema.agentTestRun.suiteName,
      assistantId: schema.agentTestRun.assistantId,
      status: schema.agentTestRun.status,
    })
    .from(schema.agentTestRun)
    .where(
      and(
        scoped(schema.agentTestRun.organizationId, session.organizationId),
        or(
          eq(schema.agentTestRun.status, "running"),
          eq(schema.agentTestRun.status, "queued")
        )
      )
    )
    .limit(1);

  let activeOrgRun: {
    id: string;
    testType: string;
    suiteName: string | null;
    assistantId: string | null;
    status: string;
    queuePosition?: number;
  } | null = null;

  if (activeOrgRuns[0]) {
    const r = activeOrgRuns[0];
    let queuePosition = undefined;
    if (r.status === "queued") {
      queuePosition = await getQueuePosition(r.id);
    }
    activeOrgRun = { ...r, queuePosition };
  }

  const withDelta = runs.map((run, i) => {
    const prev = runs
      .slice(i + 1)
      .find((r) => r.status === "done" && r.score !== null && r.testType === run.testType);
    return {
      id: run.id,
      status: run.status,
      testType: run.testType ?? "sandbox",
      suiteName: run.suiteName ?? null,
      assistantId: run.assistantId ?? null,
      score: run.score,
      error: run.error,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      delta:
        run.status === "done" && run.score !== null && prev?.score != null
          ? run.score - prev.score
          : null,
    };
  });

  return Response.json({
    runs: withDelta,
    aiConfigured,
    activeOrgRun: activeOrgRuns[0] ?? null,
  });
});

export const POST = withAuth(async (session, req: Request) => {
  const { isLabEnabledForOrg } = await import("@/server/settings/limits");
  if (!(await isLabEnabledForOrg(session.organizationId))) {
    return apiError(403, "feature_disabled", "El módulo de Laboratorio no está habilitado en tu membresía");
  }

  const orgSettings = await getOrganizationSettings(session.organizationId);
  const aiConfigured = Boolean(orgSettings.aiApiKeyEncrypted) || isAiConfigured();

  if (!aiConfigured) {
    return apiError(
      409,
      "ai_not_configured",
      "Configura tu proveedor de IA para correr el Laboratorio"
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    testType?: "sandbox" | "live_audit" | "agenda_flow" | "guardrails";
    sampleSize?: number;
    assistantId?: string;
  };

  try {
    const result = await startRun(session.organizationId, {
      testType: body.testType,
      sampleSize: body.sampleSize,
      assistantId: body.assistantId,
    });
    return Response.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof RunConflictError) {
      return apiError(
        409,
        "run_in_progress",
        "Ya hay una corrida en curso; espera a que termine"
      );
    }
    if (err instanceof NoConfiguredScenariosError) {
      return apiError(
        400,
        "no_scenarios_configured",
        "No hay preguntas configuradas para esta prueba. Primero abre 'Editar preguntas de prueba' y genera o personaliza las preguntas de tu negocio."
      );
    }
    if (err instanceof AssistantHasNoLinesError) {
      return apiError(
        400,
        "assistant_has_no_lines",
        err.message || "Este asistente no tiene líneas de WhatsApp asignadas ni mensajes aún."
      );
    }
    if (err instanceof InsufficientConversationsError) {
      return apiError(
        400,
        "insufficient_conversations",
        err.message || "No hay suficientes datos para elaborar una prueba de calidad (se requieren al menos 10 conversaciones reales)."
      );
    }
    if (err instanceof NoAuditableConversationsError) {
      return apiError(
        400,
        "no_conversations_to_audit",
        err.message || "No se encontraron conversaciones reales en las cuentas asociadas a este asistente."
      );
    }
    if (err instanceof AgendaDisabledForOrgError) {
      return apiError(
        403,
        "agenda_disabled",
        "El módulo de agenda no está habilitado para esta organización"
      );
    }
    throw err;
  }
});
