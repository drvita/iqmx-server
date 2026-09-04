import { z } from "zod";
import { getSessionOrNull } from "@/lib/auth/session";
import {
  getOrganizationSettings,
  updateTenantAiConfig,
} from "@/server/settings/service";

export const dynamic = "force-dynamic";

/**
 * Esquema estricto: Solo permite modificar credenciales operativas de IA.
 * Cualquier intento de inyectar agendaEnabled, maxWhatsappAccounts u otras
 * propiedades de membresía es ignorado/descartado por Zod.
 */
const tenantAiSchema = z.object({
  aiApiKey: z.string().trim().nullable().optional(),
  aiModel: z.string().trim().max(100).nullable().optional(),
  aiJudgeModel: z.string().trim().max(100).nullable().optional(),
  aiBaseUrl: z.string().trim().url().nullable().optional(),
  agentCoalesceMs: z.number().int().min(500).max(30000).optional(),
  botApiKey: z.string().trim().max(128).nullable().optional(),
});

/**
 * GET /api/settings/ai
 * Obtiene la configuración de IA para la organización del usuario en sesión.
 * Nunca expone la clave privada descifrada, solo si tiene una configurada.
 */
export async function GET() {
  const session = await getSessionOrNull();
  if (!session) {
    return Response.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const settings = await getOrganizationSettings(session.organizationId);

  return Response.json({
    ok: true,
    settings: {
      hasCustomApiKey: Boolean(settings.aiApiKeyEncrypted),
      aiModel: settings.aiModel,
      aiJudgeModel: settings.aiJudgeModel,
      aiBaseUrl: settings.aiBaseUrl,
      agentCoalesceMs: settings.agentCoalesceMs,
      botApiKey: settings.botApiKey,
      aiEnabled: settings.aiEnabled,
      labEnabled: settings.labEnabled,
    },
  });
}

/**
 * POST /api/settings/ai
 * Guarda la clave de IA (cifrada con AES-256), modelo y tiempos del agente.
 * Solo accesible para administradores o dueños de la organización.
 */
export async function POST(req: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return Response.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  if (session.role !== "owner" && session.role !== "admin") {
    return Response.json(
      { ok: false, error: "Permiso denegado. Se requiere rol de administrador." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "Cuerpo de solicitud inválido." },
      { status: 400 }
    );
  }

  const parsed = tenantAiSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Datos de configuración inválidos.",
        details: parsed.error.flatten(),
      },
      { status: 422 }
    );
  }

  try {
    const updated = await updateTenantAiConfig(session.organizationId, parsed.data);
    return Response.json({
      ok: true,
      message: "Configuración de IA actualizada exitosamente.",
      settings: {
        hasCustomApiKey: Boolean(updated.aiApiKeyEncrypted),
        aiModel: updated.aiModel,
        aiJudgeModel: updated.aiJudgeModel,
        aiBaseUrl: updated.aiBaseUrl,
        agentCoalesceMs: updated.agentCoalesceMs,
        botApiKey: updated.botApiKey,
      },
    });
  } catch (err: any) {
    console.error("[settings/ai] Error al actualizar configuración de IA:", err);
    return Response.json(
      { ok: false, error: "Error interno al guardar la configuración de IA." },
      { status: 500 }
    );
  }
}
