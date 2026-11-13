import { z } from "zod";
import { authenticateProvisionRequest } from "@/services/provision/auth";
import { resetOwnerPassword } from "@/services/provision/tenant";

export const dynamic = "force-dynamic";

const inputSchema = z
  .object({
    externalCustomerId: z.string().trim().optional(),
    ownerEmail: z.string().trim().email().optional(),
    password: z.string().min(8),
  })
  .refine((d) => Boolean(d.externalCustomerId || d.ownerEmail), {
    message: "Se requiere externalCustomerId o ownerEmail.",
  });

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

  const auth = await authenticateProvisionRequest(req, rawBody);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  let bodyJson: unknown;
  try {
    const raw = JSON.parse(rawBody || "{}") as Record<string, unknown>;
    bodyJson = {
      externalCustomerId:
        raw.externalCustomerId ?? raw.external_customer_id ?? undefined,
      ownerEmail: raw.ownerEmail ?? raw.owner_email ?? undefined,
      password: raw.password,
    };
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
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No se encontró")) {
      return Response.json({ ok: false, error: msg }, { status: 404 });
    }
    return Response.json(
      { ok: false, error: "Error interno al restablecer contraseña." },
      { status: 500 }
    );
  }
}
