import { z } from "zod";
import { authenticateProvisionRequest } from "@/services/provision/auth";
import { setTenantStatus } from "@/services/provision/tenant";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  status: z.enum([
    "active",
    "trial",
    "suspended",
    "cancelled",
    "activo",
    "prueba",
    "suspendido",
    "cancelado",
  ]),
  reason: z.string().trim().max(200).optional(),
});

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
    return Response.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

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

  const result = await setTenantStatus(
    id,
    parsed.data.status,
    parsed.data.reason
  );
  if (!result) {
    return Response.json(
      { ok: false, error: "Organización no encontrada." },
      { status: 404 }
    );
  }

  return Response.json({ ok: true, ...result });
}
