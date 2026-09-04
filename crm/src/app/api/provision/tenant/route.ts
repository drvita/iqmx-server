import { z } from "zod";
import { authenticateProvisionRequest } from "@/server/provision/auth";
import { provisionTenant } from "@/server/provision/tenant";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  externalCustomerId: z
    .string()
    .trim()
    .min(1, "externalCustomerId es requerido")
    .max(100),
  companyName: z
    .string()
    .trim()
    .min(2, "companyName debe tener al menos 2 caracteres")
    .max(120),
  ownerEmail: z.string().trim().email("ownerEmail no es un correo válido"),
  ownerName: z
    .string()
    .trim()
    .min(2, "ownerName debe tener al menos 2 caracteres")
    .max(100),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .optional(),
  status: z.enum(["active", "trial"]).optional(),
  features: z
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
      extra: z.record(z.unknown()).optional(),
    })
    .optional(),
});

/**
 * POST /api/provision/tenant
 * Aprovisiona automáticamente una nueva organización (empresa) y usuario propietario.
 * Protegido mediante autenticación HMAC-SHA256 y API Secret.
 * Idempotente por externalCustomerId.
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
    // 3. Ejecutar aprovisionamiento idempotente
    const result = await provisionTenant(parsed.data);
    const statusCode = result.action === "created" ? 201 : 200;

    return Response.json(
      {
        ok: true,
        ...result,
      },
      { status: statusCode }
    );
  } catch (err) {
    console.error("[provision/tenant] Error al aprovisionar organización:", err);
    return Response.json(
      { ok: false, error: "Error interno al aprovisionar la organización." },
      { status: 500 }
    );
  }
}
