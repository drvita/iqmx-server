import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { isLabEnabledForOrg } from "@/server/settings/limits";

export const dynamic = "force-dynamic";

const UpdateScenarioSchema = z.object({
  label: z.string().min(2).optional(),
  description: z.string().optional(),
  contactName: z.string().min(2).optional(),
  script: z.array(z.string().min(1)).min(1).optional(),
});

type Params = { params: Promise<{ id: string }> };

export const PUT = withAuth(async (session, req: Request, ctx: Params) => {
  if (!(await isLabEnabledForOrg(session.organizationId))) {
    return apiError(403, "feature_disabled", "El módulo de Laboratorio no está habilitado en tu membresía");
  }

  const { id } = await ctx.params;
  const raw = await req.json().catch(() => null);
  const parsed = UpdateScenarioSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(400, "invalid_body", "Datos de actualización inválidos");
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(schema.labScenario)
    .where(
      scoped(
        schema.labScenario.organizationId,
        session.organizationId,
        eq(schema.labScenario.id, id)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return apiError(404, "not_found", "Escenario no encontrado");
  }

  const updated = await db
    .update(schema.labScenario)
    .set({
      ...(parsed.data.label ? { label: parsed.data.label } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.contactName ? { contactName: parsed.data.contactName } : {}),
      ...(parsed.data.script ? { script: parsed.data.script } : {}),
      isCustom: true,
      updatedAt: new Date(),
    })
    .where(eq(schema.labScenario.id, id))
    .returning();

  return Response.json({ scenario: updated[0] });
});

export const DELETE = withAuth(async (session, _req: Request, ctx: Params) => {
  if (!(await isLabEnabledForOrg(session.organizationId))) {
    return apiError(403, "feature_disabled", "El módulo de Laboratorio no está habilitado en tu membresía");
  }

  const { id } = await ctx.params;
  const db = getDb();

  const deleted = await db
    .delete(schema.labScenario)
    .where(
      scoped(
        schema.labScenario.organizationId,
        session.organizationId,
        eq(schema.labScenario.id, id)
      )
    )
    .returning();

  if (!deleted[0]) {
    return apiError(404, "not_found", "Escenario no encontrado");
  }

  return Response.json({ ok: true, deletedId: id });
});
