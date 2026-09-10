import { asc, eq } from "drizzle-orm";
import { apiError, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { PERSONA_LABELS } from "@/server/lab/personas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth(async (session, _req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  const db = getDb();
  const runs = await db
    .select()
    .from(schema.agentTestRun)
    .where(
      scoped(
        schema.agentTestRun.organizationId,
        session.organizationId,
        eq(schema.agentTestRun.id, id)
      )
    )
    .limit(1);
  const run = runs[0];
  if (!run) return apiError(404, "not_found", "Corrida no encontrada");

  const cases = await db
    .select()
    .from(schema.agentTestCase)
    .where(eq(schema.agentTestCase.runId, id))
    .orderBy(asc(schema.agentTestCase.createdAt));

  // Obtener labels personalizados de labScenario para esta organización
  const customScenarios = await db
    .select({
      key: schema.labScenario.key,
      label: schema.labScenario.label,
    })
    .from(schema.labScenario)
    .where(eq(schema.labScenario.organizationId, session.organizationId));

  const customLabelMap = new Map<string, string>();
  for (const s of customScenarios) {
    customLabelMap.set(s.key, s.label);
    if (s.key.includes(":")) {
      customLabelMap.set(s.key.split(":")[1]!, s.label);
    }
  }

  function formatPersonaLabel(rawPersona: string): string {
    if (customLabelMap.has(rawPersona)) return customLabelMap.get(rawPersona)!;
    const shortKey = rawPersona.includes(":") ? rawPersona.split(":").pop()! : rawPersona;
    if (customLabelMap.has(shortKey)) return customLabelMap.get(shortKey)!;

    if (PERSONA_LABELS[rawPersona]) return PERSONA_LABELS[rawPersona]!;
    if (PERSONA_LABELS[shortKey]) return PERSONA_LABELS[shortKey]!;

    // Formatear eliminando guiones bajos y capitalizando palabras
    return shortKey
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  return Response.json({
    run: {
      id: run.id,
      status: run.status,
      score: run.score,
      error: run.error,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    },
    cases: cases.map((c) => ({
      id: c.id,
      persona: c.persona,
      personaLabel: formatPersonaLabel(c.persona),
      status: c.status,
      veredicto: c.veredicto,
      hallazgos: c.hallazgos ?? [],
      transcript: c.transcript ?? [],
    })),
  });
});
