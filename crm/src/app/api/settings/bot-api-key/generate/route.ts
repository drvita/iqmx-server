import crypto from "node:crypto";
import { getSessionOrNull } from "@/lib/auth/session";
import { updateTenantAiConfig } from "@/server/settings/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/bot-api-key/generate
 * Genera una nueva API Key de integración externa para la organización en sesión.
 * Formato: crm_live_<32 bytes hex> (64 caracteres + prefijo)
 * Devuelve el token generado una sola vez.
 */
export async function POST() {
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

  const tokenBytes = crypto.randomBytes(24).toString("hex");
  const newApiKey = `crm_live_${tokenBytes}`;

  try {
    await updateTenantAiConfig(session.organizationId, {
      botApiKey: newApiKey,
    });

    return Response.json({
      ok: true,
      apiKey: newApiKey,
      message: "API Key generada exitosamente. Guárdala en un lugar seguro.",
    });
  } catch (err: unknown) {
    console.error("[settings/bot-api-key/generate] Error:", err);
    return Response.json(
      { ok: false, error: "Error interno al generar la API Key." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/bot-api-key/generate
 * Revoca la API Key de integración externa de la organización.
 */
export async function DELETE() {
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

  try {
    await updateTenantAiConfig(session.organizationId, {
      botApiKey: null,
    });

    return Response.json({
      ok: true,
      message: "API Key revocada exitosamente.",
    });
  } catch (err: unknown) {
    console.error("[settings/bot-api-key/revoke] Error:", err);
    return Response.json(
      { ok: false, error: "Error interno al revocar la API Key." },
      { status: 500 }
    );
  }
}
