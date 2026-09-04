import { z } from "zod";
import { authenticateProvisionRequest } from "@/server/provision/auth";
import { setTenantStatus } from "@/server/provision/tenant";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  status: z.enum(["active", "trial", "suspended", "cancelled"]),
  reason: z.string().trim().max(200).optional(),
});

/**
 * PATCH /api/provision/tenant/:id/status
 * Actualiza el estado de la organización (active, trial, suspended, cancelled).
 * Controla el acceso al panel y el procesamiento de webhooks de WhatsApp.
 */
export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  if (!id) {
    return Response.json(
      { ok: false, error: "ID de organización requerido." },
      { status: 400 }
    );
  }

  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return Response.json(
      { ok: false, error: "Cuerpo de solicitud inválido." },
      { status: 400 }
    );
  }

  // 1. Autenticación de seguridad (HMAC / Bearer / Rate limit / Timing-safe)
  const auth = await authenticateProvisionRequest(req, rawBody);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  // 2. Validación de esquema Zod
  let bodyJson: unknown;
  try {
    bodyJson = JSON.parse(rawBody || "{}");
  } catch {
    return Response.json(
      { ok: false, error: "JSON malformado." },
      { status: 400 }
    );
  }

  const parsed = inputSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Datos de entrada inválidos.",
        details: parsed.error.flatten(),
      },
      { status: 422 }
    );
  }

  try {
    const result = await setTenantStatus(id, parsed.data.status, parsed.data.reason);
    if (!result) {
      return Response.json(
        { ok: false, error: "Organización no encontrada." },
        { status: 404 }
      );
    }

    return Response.json(result);
  } catch (err) {
    console.error(
      `[provision/status] Error al actualizar estado de la organización ${id}:`,
      err
    );
    return Response.json(
      { ok: false, error: "Error interno al actualizar estado." },
      { status: 500 }
    );
  }
}
