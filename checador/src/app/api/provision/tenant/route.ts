import { z } from "zod";
import { authenticateProvisionRequest } from "@/services/provision/auth";
import { provisionTenant } from "@/services/provision/tenant";

export const dynamic = "force-dynamic";

function snakeToCamelObject(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    const camel = k.replace(/_([a-z0-9])/g, (_, l: string) => l.toUpperCase());
    out[camel] =
      typeof v === "object" && v !== null && !Array.isArray(v)
        ? snakeToCamelObject(v)
        : v;
  }
  return out;
}

const inputSchema = z.object({
  externalCustomerId: z.string().trim().min(1).max(100),
  companyName: z.string().trim().min(2).max(150),
  razonSocial: z.string().trim().max(200).optional(),
  rfc: z.string().trim().max(13).optional(),
  zonaHoraria: z.string().trim().max(60).optional(),
  ownerEmail: z.string().trim().email(),
  ownerName: z.string().trim().min(2).max(120),
  password: z.string().min(8).optional(),
  status: z
    .enum(["active", "trial", "activo", "prueba", "suspended", "cancelled"])
    .optional(),
  features: z
    .object({
      planCodigo: z.string().trim().max(40).optional(),
      maxEmpleados: z.number().int().min(1).optional(),
      maxDispositivos: z.number().int().min(1).optional(),
      maxSucursales: z.number().int().min(1).optional(),
      cloudEvidencesEnabled: z.boolean().optional(),
      extraRolesEnabled: z.boolean().optional(),
      horasSemanalesMax: z.number().min(20).max(72).optional(),
    })
    .optional(),
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
    bodyJson = snakeToCamelObject(JSON.parse(rawBody || "{}"));
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
    const result = await provisionTenant(parsed.data);
    return Response.json(
      { ok: true, ...result },
      { status: result.action === "created" ? 201 : 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("CONFLICT_USER_ALREADY_EXISTS")) {
      return Response.json({ ok: false, error: msg }, { status: 409 });
    }
    console.error("[checador/provision/tenant]", err);
    return Response.json(
      { ok: false, error: "Error interno al aprovisionar organización." },
      { status: 500 }
    );
  }
}
