import { and, asc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { apiError, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { isLabEnabledForOrg } from "@/server/settings/limits";

export const dynamic = "force-dynamic";

const CreateScenarioSchema = z.object({
  key: z.string().min(2),
  label: z.string().min(2),
  description: z.string().optional(),
  contactName: z.string().min(2),
  script: z.array(z.string().min(1)).min(1),
  testType: z.string().default("sandbox"),
  assistantId: z.string().optional(),
});

export const GET = withAuth(async (session, req: Request) => {
  if (!(await isLabEnabledForOrg(session.organizationId))) {
    return apiError(403, "feature_disabled", "El módulo de Laboratorio no está habilitado en tu membresía");
  }

  const url = new URL(req.url);
  const assistantId = url.searchParams.get("assistantId");
  const testType = url.searchParams.get("testType") ?? "sandbox";

  if (testType === "agenda_flow") {
    const { isAgendaEnabled } = await import("@/server/agenda/flag");
    if (!(await isAgendaEnabled(session.organizationId))) {
      return apiError(403, "agenda_disabled", "El módulo de agenda no está habilitado para esta organización");
    }
  }

  const db = getDb();
  const conditions = [
    scoped(schema.labScenario.organizationId, session.organizationId),
    eq(schema.labScenario.testType, testType),
  ];
  if (assistantId) {
    conditions.push(
      or(
        eq(schema.labScenario.assistantId, assistantId),
        isNull(schema.labScenario.assistantId)
      )!
    );
  }

  const rows = await db
    .select()
    .from(schema.labScenario)
    .where(and(...conditions))
    .orderBy(asc(schema.labScenario.createdAt));

  // Si no hay filas persistidas, la suite no tiene preguntas configuradas aún
  if (rows.length === 0) {
    return Response.json({ scenarios: [], hasCustomConfig: false });
  }

  return Response.json({
    scenarios: rows.map((r) => ({
      id: r.id,
      key: r.key.includes(":") ? r.key.split(":")[1] : r.key,
      label: r.label,
      description: r.description,
      contactName: r.contactName,
      syntheticPhone: r.syntheticPhone,
      script: r.script,
      isCustom: r.isCustom,
      testType: r.testType,
      assistantId: r.assistantId ?? null,
      updatedAt: r.updatedAt.toISOString(),
    })),
    hasCustomConfig: true,
  });
});

export const POST = withAuth(async (session, req: Request) => {
  if (!(await isLabEnabledForOrg(session.organizationId))) {
    return apiError(403, "feature_disabled", "El módulo de Laboratorio no está habilitado en tu membresía");
  }

  const raw = await req.json().catch(() => null);
  const parsed = CreateScenarioSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(400, "invalid_body", "Datos de escenario inválidos");
  }

  if (parsed.data.testType === "agenda_flow") {
    const { isAgendaEnabled } = await import("@/server/agenda/flag");
    if (!(await isAgendaEnabled(session.organizationId))) {
      return apiError(403, "agenda_disabled", "El módulo de agenda no está habilitado para esta organización");
    }
  }

  const db = getDb();
  const id = newId("labScenario");
  const fallbackPhone = `52100000000${Math.floor(1000 + Math.random() * 9000)}`;
  const scenarioKey = parsed.data.assistantId
    ? `${parsed.data.assistantId}:${parsed.data.key}`
    : parsed.data.key;

  const inserted = await db
    .insert(schema.labScenario)
    .values({
      id,
      organizationId: session.organizationId,
      assistantId: parsed.data.assistantId ?? null,
      testType: parsed.data.testType,
      key: scenarioKey,
      label: parsed.data.label,
      description: parsed.data.description ?? null,
      contactName: parsed.data.contactName,
      syntheticPhone: fallbackPhone,
      script: parsed.data.script,
      isCustom: true,
    })
    .returning();

  return Response.json({ scenario: inserted[0] }, { status: 201 });
});
