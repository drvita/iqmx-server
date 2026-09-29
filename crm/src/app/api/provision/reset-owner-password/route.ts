import { z } from "zod";
import { authenticateProvisionRequest } from "@/server/provision/auth";
import { resetOwnerPassword } from "@/server/provision/reset-password";

export const dynamic = "force-dynamic";

const inputSchema = z
  .object({
    externalCustomerId: z.string().trim().optional(),
    ownerEmail: z.string().trim().email("ownerEmail no es un correo válido").optional(),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  })
  .refine((data) => Boolean(data.externalCustomerId || data.ownerEmail), {
    message: "Se requiere externalCustomerId o ownerEmail.",
  });

/**
 * POST /api/provision/reset-owner-password
 * Restablece la contraseña del usuario propietario de una organización existente.
 * Actualiza mustChangePassword: true en el metadata de la organización.
 * Protegido mediante autenticación M2M (Bearer token / HMAC).
 */
export async function POST(req: Request) {
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch {
    return Response.json(
      { ok: false, error: "Cuerpo de solicitud inválido." },
      { status: 400 }
    );
  }

  // 1. Autenticación de seguridad M2M
  const auth = await authenticateProvisionRequest(req, rawBody);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  // 2. Validación de esquema
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
    const result = await resetOwnerPassword(parsed.data);
    return Response.json(result, { status: 200 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes("No se encontró ninguna organización")) {
      return Response.json(
        { ok: false, error: errorMsg },
        { status: 404 }
      );
    }
    console.error("[CRM RESET PASSWORD ERROR]:", err);
    return Response.json(
      { ok: false, error: errorMsg || "Error interno al restablecer la contraseña." },
      { status: 500 }
    );
  }
}
