import { z } from "zod";
import { authenticateProvisionRequest } from "@/services/provision/auth";
import {
  getTenantFeatures,
  updateTenantFeatures,
} from "@/services/provision/tenant";

export const dynamic = "force-dynamic";

const featuresPatchSchema = z.object({
  planCodigo: z.string().trim().max(40).optional(),
  maxEmpleados: z.number().int().min(1).optional(),
  maxDispositivos: z.number().int().min(1).optional(),
  maxSucursales: z.number().int().min(1).optional(),
  cloudEvidencesEnabled: z.boolean().optional(),
  extraRolesEnabled: z.boolean().optional(),
  horasSemanalesMax: z.number().min(20).max(72).optional(),
});

function toCamel(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    const camel = k.replace(/_([a-z0-9])/g, (_, l: string) => l.toUpperCase());
    out[camel] = v;
  }
  return out;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateProvisionRequest(req, "");
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  const features = await getTenantFeatures(id);
  if (!features) {
    return Response.json(
      { ok: false, error: "Organización no encontrada." },
      { status: 404 }
    );
  }

  return Response.json({ ok: true, organizationId: features.id, features });
}

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

  let bodyJson: Record<string, unknown>;
  try {
    bodyJson = toCamel(JSON.parse(rawBody || "{}"));
  } catch {
    return Response.json(
      { ok: false, error: "JSON malformado." },
      { status: 400 }
    );
  }

  const parsed = featuresPatchSchema.safeParse(bodyJson);
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

  const updated = await updateTenantFeatures(id, parsed.data);
  if (!updated) {
    return Response.json(
      { ok: false, error: "Organización no encontrada." },
      { status: 404 }
    );
  }

  return Response.json({
    ok: true,
    organizationId: updated.id,
    features: {
      planCodigo: updated.planCodigo,
      maxEmpleados: updated.maxEmpleados,
      maxDispositivos: updated.maxDispositivos,
      maxSucursales: updated.maxSucursales,
      cloudEvidencesEnabled: updated.cloudEvidencesEnabled,
      extraRolesEnabled: updated.extraRolesEnabled,
      horasSemanalesMax: updated.horasSemanalesMax,
    },
  });
}
