import { z } from "zod";
import { authenticateProvisionRequest } from "@/server/provision/auth";
import {
  getOrganizationSettings,
  updateOrganizationPlanLimits,
} from "@/server/settings/service";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const featuresPatchSchema = z
  .object({
    agendaEnabled: z.boolean().optional(),
    attributionEnabled: z.boolean().optional(),
    channels: z.string().trim().optional(),
    maxWhatsappAccounts: z.number().int().min(1).optional(),
    maxTeamMembers: z.number().int().min(1).optional(),
    maxContacts: z.number().int().min(1).optional(),
    maxTokensIn: z.number().int().min(0).optional(),
    maxTokensOut: z.number().int().min(0).optional(),
    aiEnabled: z.boolean().optional(),
    labEnabled: z.boolean().optional(),
    tasksEnabled: z.boolean().optional(),
    aiApiKey: z.string().trim().nullable().optional(),
    aiModel: z.string().trim().nullable().optional(),
    aiJudgeModel: z.string().trim().nullable().optional(),
    aiBaseUrl: z.string().trim().url().nullable().optional(),
    agentCoalesceMs: z.number().int().min(500).max(30000).optional(),
    extra: z.record(z.unknown()).optional(),
  })
  .passthrough();

async function resolveTenantId(paramId: string): Promise<string | null> {
  const db = getDb();
  // Puede ser el ID interno de la organización o el externalCustomerId
  const byId = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.id, paramId))
    .limit(1);

  if (byId[0]?.id) return byId[0].id;

  const byExternal = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.externalCustomerId, paramId))
    .limit(1);

  return byExternal[0]?.id ?? null;
}

/**
 * GET /api/provision/tenant/[id]/features
 * Consulta las características y límites del plan de la organización.
 * Protegido con autenticación M2M (HMAC / Bearer).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateProvisionRequest(req, "");
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const organizationId = await resolveTenantId(id);
  if (!organizationId) {
    return Response.json(
      { ok: false, error: "Organización no encontrada." },
      { status: 404 }
    );
  }

  try {
    const settings = await getOrganizationSettings(organizationId);
    return Response.json({
      ok: true,
      organizationId,
      features: {
        agendaEnabled: settings.agendaEnabled,
        attributionEnabled: settings.attributionEnabled,
        channels: settings.channels,
        maxWhatsappAccounts: settings.maxWhatsappAccounts,
        maxTeamMembers: settings.maxTeamMembers,
        maxContacts: settings.maxContacts,
        maxTokensIn: settings.maxTokensIn,
        maxTokensOut: settings.maxTokensOut,
        aiEnabled: settings.aiEnabled,
        labEnabled: settings.labEnabled,
        tasksEnabled: settings.tasksEnabled,
        hasAiApiKey: Boolean(settings.aiApiKeyEncrypted),
        aiModel: settings.aiModel,
        aiJudgeModel: settings.aiJudgeModel,
        aiBaseUrl: settings.aiBaseUrl,
        agentCoalesceMs: settings.agentCoalesceMs,
        extra: settings.extra,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (err: any) {
    console.error("[provision/features] Error al obtener límites:", err);
    return Response.json(
      { ok: false, error: "Error al consultar configuración del inquilino." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/provision/tenant/[id]/features
 * Actualiza los límites y características del plan desde el Servidor Central.
 * Protegido con autenticación M2M (HMAC / Bearer).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return Response.json(
      { ok: false, error: "Cuerpo de solicitud inválido." },
      { status: 400 }
    );
  }

  const auth = await authenticateProvisionRequest(req, rawBody);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const organizationId = await resolveTenantId(id);
  if (!organizationId) {
    return Response.json(
      { ok: false, error: "Organización no encontrada." },
      { status: 404 }
    );
  }

  let bodyJson: Record<string, unknown> = {};
  try {
    const raw = JSON.parse(rawBody || "{}");
    if (typeof raw === "object" && raw !== null) {
      for (const [k, v] of Object.entries(raw)) {
        const camel = k.replace(/_([a-z0-9])/g, (_, l) => l.toUpperCase());
        bodyJson[camel] = v;
      }
    }
  } catch {
    return Response.json({ ok: false, error: "JSON malformado." }, { status: 400 });
  }

  const parsed = featuresPatchSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Datos de actualización inválidos.",
        details: parsed.error.flatten(),
      },
      { status: 422 }
    );
  }

  // Agrupar campos desconocidos en 'extra'
  const knownKeys = new Set([
    "agendaEnabled",
    "attributionEnabled",
    "channels",
    "maxWhatsappAccounts",
    "maxTeamMembers",
    "maxContacts",
    "maxTokensIn",
    "maxTokensOut",
    "aiEnabled",
    "labEnabled",
    "tasksEnabled",
    "aiApiKey",
    "aiModel",
    "aiJudgeModel",
    "aiBaseUrl",
    "agentCoalesceMs",
    "extra",
  ]);
  const extraFields: Record<string, unknown> = {
    ...((parsed.data.extra as Record<string, unknown>) || {}),
  };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (!knownKeys.has(k)) {
      extraFields[k] = v;
      delete (parsed.data as any)[k];
    }
  }
  if (Object.keys(extraFields).length > 0) {
    parsed.data.extra = extraFields;
  }

  try {
    const updated = await updateOrganizationPlanLimits(organizationId, parsed.data);
    return Response.json({
      ok: true,
      message: "Límites del plan actualizados exitosamente.",
      organizationId,
      features: {
        agendaEnabled: updated.agendaEnabled,
        attributionEnabled: updated.attributionEnabled,
        channels: updated.channels,
        maxWhatsappAccounts: updated.maxWhatsappAccounts,
        maxTeamMembers: updated.maxTeamMembers,
        maxContacts: updated.maxContacts,
        maxTokensIn: updated.maxTokensIn,
        maxTokensOut: updated.maxTokensOut,
        aiEnabled: updated.aiEnabled,
        labEnabled: updated.labEnabled,
        tasksEnabled: updated.tasksEnabled,
        hasAiApiKey: Boolean(updated.aiApiKeyEncrypted),
        aiModel: updated.aiModel,
        aiJudgeModel: updated.aiJudgeModel,
        aiBaseUrl: updated.aiBaseUrl,
        agentCoalesceMs: updated.agentCoalesceMs,
        extra: updated.extra,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err: any) {
    console.error("[provision/features] Error al actualizar límites:", err);
    return Response.json(
      { ok: false, error: "Error interno al actualizar los límites de la organización." },
      { status: 500 }
    );
  }
}
