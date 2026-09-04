import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { isAiConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/profile
 * Devuelve todos los asistentes de la organización (conversacionales y tools)
 * y si se pasa ?id=... devuelve ese perfil en detalle.
 */
export const GET = withAuth(async (session, req: Request) => {
  const db = getDb();
  const url = new URL(req.url);
  const requestedId = url.searchParams.get("id");
  const requestedType = url.searchParams.get("type"); // "conversational" | "tool"

  let rows = await db
    .select()
    .from(schema.agentProfile)
    .where(
      and(
        scoped(schema.agentProfile.organizationId, session.organizationId),
        requestedType ? eq(schema.agentProfile.type, requestedType as "conversational" | "tool") : undefined
      )
    )
    .orderBy(desc(schema.agentProfile.isDefault), desc(schema.agentProfile.createdAt));

  // Auto-siembra si por alguna razón la organización no tiene asistente
  if (rows.length === 0 && !requestedType) {
    const defaultId = newId("agentProfile");
    await db.insert(schema.agentProfile).values({
      id: defaultId,
      organizationId: session.organizationId,
      name: "Asistente Principal",
      type: "conversational",
      isDefault: true,
      description: "Asistente principal de atención y ventas",
    });
    rows = await db
      .select()
      .from(schema.agentProfile)
      .where(scoped(schema.agentProfile.organizationId, session.organizationId))
      .limit(1);
  }

  const selected = requestedId
    ? rows.find((r) => r.id === requestedId) ?? rows[0]
    : rows[0];

  const { getOrganizationSettings } = await import("@/server/settings/service");
  const orgSettings = await getOrganizationSettings(session.organizationId);
  const aiConfigured = Boolean(orgSettings.aiApiKeyEncrypted) || isAiConfigured();

  return Response.json({
    assistants: rows.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      isDefault: p.isDefault,
      enabled: p.enabled,
      description: p.description,
      tone: p.tone,
      instructions: p.instructions,
      escalationRules: p.escalationRules,
      greeting: p.greeting,
    })),
    // Compatibilidad con la vista actual que lee `profile`
    profile: selected
      ? {
          id: selected.id,
          name: selected.name,
          type: selected.type,
          isDefault: selected.isDefault,
          enabled: selected.enabled,
          description: selected.description,
          tone: selected.tone,
          instructions: selected.instructions,
          escalationRules: selected.escalationRules,
          greeting: selected.greeting,
        }
      : null,
    aiConfigured,
  });
});

const postSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(["conversational", "tool"]).default("conversational"),
  description: z.string().max(300).nullable().optional(),
  enabled: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
  tone: z.string().max(500).nullable().optional(),
  instructions: z.string().max(8000).nullable().optional(),
  escalationRules: z.string().max(4000).nullable().optional(),
  greeting: z.string().max(1000).nullable().optional(),
});

/**
 * POST /api/agent/profile
 * Crea un nuevo Asistente IA (conversacional o tool).
 */
export const POST = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, postSchema);
  if (!body.ok) return body.response;

  const db = getDb();
  const id = newId("agentProfile");
  const assistantType: "conversational" | "tool" =
    body.data.type === "tool" ? "tool" : "conversational";

  // Si se marca como default, desmarcar los demás del mismo tipo
  if (body.data.isDefault) {
    await db
      .update(schema.agentProfile)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          scoped(schema.agentProfile.organizationId, session.organizationId),
          eq(schema.agentProfile.type, assistantType)
        )
      );
  }

  const inserted = await db
    .insert(schema.agentProfile)
    .values({
      id,
      organizationId: session.organizationId,
      name: body.data.name,
      type: assistantType,
      description: body.data.description ?? null,
      enabled: body.data.enabled ?? true,
      isDefault: body.data.isDefault ?? false,
      tone: body.data.tone ?? null,
      instructions: body.data.instructions ?? null,
      escalationRules: body.data.escalationRules ?? null,
      greeting: body.data.greeting ?? null,
    })
    .returning();

  return Response.json({ ok: true, assistant: inserted[0] });
});

const putSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  type: z.enum(["conversational", "tool"]).optional(),
  description: z.string().max(300).nullable().optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  tone: z.string().max(500).nullable().optional(),
  instructions: z.string().max(8000).nullable().optional(),
  escalationRules: z.string().max(4000).nullable().optional(),
  greeting: z.string().max(1000).nullable().optional(),
});

/**
 * PUT /api/agent/profile
 * Actualiza un Asistente IA existente.
 */
export const PUT = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, putSchema);
  if (!body.ok) return body.response;

  const db = getDb();
  const targetId = body.data.id;

  let whereClause = scoped(schema.agentProfile.organizationId, session.organizationId);
  if (targetId) {
    whereClause = and(whereClause, eq(schema.agentProfile.id, targetId))!;
  }

  // Si se actualiza a default = true, desmarcar los demás
  if (body.data.isDefault && targetId) {
    const existing = await db
      .select({ type: schema.agentProfile.type })
      .from(schema.agentProfile)
      .where(whereClause)
      .limit(1);
    const existingType = body.data.type ?? existing[0]?.type ?? "conversational";
    await db
      .update(schema.agentProfile)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          scoped(schema.agentProfile.organizationId, session.organizationId),
          eq(schema.agentProfile.type, existingType)
        )
      );
  }

  const { id: _, ...updateFields } = body.data;

  const updated = await db
    .update(schema.agentProfile)
    .set({ ...updateFields, updatedAt: new Date() })
    .where(whereClause)
    .returning();

  if (!updated[0]) return apiError(404, "not_found", "Asistente no encontrado");
  return Response.json({ ok: true, assistant: updated[0] });
});

/**
 * DELETE /api/agent/profile?id=agp_...
 * Elimina un Asistente IA (desvinculándolo de las líneas telefónicas asociadas).
 */
export const DELETE = withAuth(async (session, req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return apiError(400, "missing_id", "Se requiere el ID del asistente");

  const db = getDb();

  // Verificar que no sea el único asistente de la organización
  const count = await db
    .select({ id: schema.agentProfile.id })
    .from(schema.agentProfile)
    .where(scoped(schema.agentProfile.organizationId, session.organizationId));

  if (count.length <= 1) {
    return apiError(400, "cannot_delete_last", "No puedes eliminar el único Asistente IA de la organización");
  }

  // Desvincular de líneas telefónicas asociadas
  await db
    .update(schema.metaCredentials)
    .set({ assistantId: null, updatedAt: new Date() })
    .where(
      and(
        scoped(schema.metaCredentials.organizationId, session.organizationId),
        eq(schema.metaCredentials.assistantId, id)
      )
    );

  // Eliminar asistente
  await db
    .delete(schema.agentProfile)
    .where(
      and(
        scoped(schema.agentProfile.organizationId, session.organizationId),
        eq(schema.agentProfile.id, id)
      )
    );

  return Response.json({ ok: true });
});
