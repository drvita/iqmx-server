import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
import { scoped } from "@/lib/db/tenant";
import {
  saveCredentials,
  deleteCredentials,
  getCredentialsByPhoneNumberId,
} from "@/server/whatsapp/credentials";
import { testConnection } from "@/server/whatsapp/connect";
import { isWebhookTokenValid } from "@/server/whatsapp/webhook-token";

import { assertCanAddWhatsappAccount } from "@/server/settings/limits";
import { getOrganizationByWebhookToken } from "@/server/whatsapp/webhook-token";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  wabaId: z.string().trim().min(1, "wabaId es requerido"),
  phoneNumberId: z.string().trim().min(1, "phoneNumberId es requerido"),
  token: z.string().trim().min(1, "token es requerido"),
  displayPhoneNumber: z.string().trim().optional().nullable(),
  verifiedName: z.string().trim().optional().nullable(),
  label: z.string().trim().optional().nullable(),
  aiEnabled: z.boolean().optional(),
  signupMethod: z.enum(["manual", "embedded_signup"]).optional(),
  organizationId: z.string().trim().optional(),
  externalCustomerId: z.string().trim().optional(),
});

const deleteSchema = z.object({
  phoneNumberId: z.string().trim().min(1, "phoneNumberId es requerido"),
  organizationId: z.string().trim().optional(),
  externalCustomerId: z.string().trim().optional(),
});

async function resolveAuthorizedOrg(req: Request): Promise<{ ok: boolean; organizationId?: string }> {
  const authHeader = req.headers.get("authorization");
  const apiKeyHeader =
    req.headers.get("x-provision-key") || req.headers.get("x-api-key");

  let providedToken = "";
  if (authHeader?.startsWith("Bearer ")) {
    providedToken = authHeader.slice("Bearer ".length).trim();
  } else if (apiKeyHeader) {
    providedToken = apiKeyHeader.trim();
  }

  if (!providedToken) return { ok: false };

  // 1. Probar si es el token de webhook de una organización específica
  const org = await getOrganizationByWebhookToken(providedToken);
  if (org) {
    return { ok: true, organizationId: org.id };
  }

  // 2. Probar si coincide con la clave maestra de aprovisionamiento
  const masterSecret =
    process.env.PROVISION_SECRET_KEY ||
    process.env.CRM_PROVISION_SECRET ||
    process.env.INTERNAL_API_KEY;

  if (masterSecret && providedToken === masterSecret) {
    return { ok: true };
  }

  return { ok: false };
}

/**
 * POST /api/settings/whatsapp/provision
 * Endpoint resiliente e idempotente para registrar o actualizar líneas de WhatsApp.
 * Valida cuotas del plan antes de registrar una línea nueva.
 */
export async function POST(req: Request) {
  const auth = await resolveAuthorizedOrg(req);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: "No autorizado. Clave de aprovisionamiento inválida o no enviada." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "Cuerpo de la petición inválido (JSON malformado)." },
      { status: 400 }
    );
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Datos de aprovisionamiento incompletos o inválidos",
        details: parsed.error.format(),
      },
      { status: 422 }
    );
  }

  const {
    wabaId,
    phoneNumberId,
    token,
    displayPhoneNumber: inputDisplay,
    verifiedName: inputName,
    label,
    aiEnabled,
    signupMethod,
    organizationId: inputOrgId,
    externalCustomerId: inputExternalId,
  } = parsed.data;

  // 1. Resolver la organización destino
  const db = getDb();
  let organizationId = auth.organizationId || inputOrgId;

  if (!organizationId && inputExternalId) {
    const orgByExternal = await db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.externalCustomerId, inputExternalId))
      .limit(1);
    if (orgByExternal[0]?.id) organizationId = orgByExternal[0].id;
  }

  if (!organizationId) {
    const orgRows = await db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .limit(1);
    if (orgRows[0]?.id) organizationId = orgRows[0].id;
  }

  if (!organizationId) {
    return Response.json(
      { ok: false, error: "No se encontró una organización registrada en esta instancia de CRM." },
      { status: 500 }
    );
  }

  // 2. Comprobar si la línea ya existe previamente (Resiliencia: actualizar en vez de duplicar)
  const existing = await getCredentialsByPhoneNumberId(phoneNumberId);
  const isUpdate = Boolean(existing);

  // Si es un alta nueva, validar el límite máximo de cuentas de WhatsApp permitido por la membresía
  if (!isUpdate) {
    try {
      await assertCanAddWhatsappAccount(organizationId);
    } catch (err: any) {
      return Response.json(
        {
          ok: false,
          error: err.message || "Has alcanzado el límite máximo de líneas permitidas por tu membresía.",
          code: "QUOTA_EXCEEDED",
        },
        { status: 403 }
      );
    }
  }

  // 3. Resolver displayPhoneNumber y verifiedName (reusar existentes o consultar Meta si faltan)
  let displayPhoneNumber = inputDisplay ?? existing?.displayPhoneNumber ?? null;
  let verifiedName = inputName ?? existing?.verifiedName ?? null;

  if (!displayPhoneNumber) {
    const check = await testConnection(phoneNumberId, token);
    if (!check.ok) {
      return Response.json(
        { ok: false, error: `Error validando token con Meta: ${check.message}` },
        { status: 400 }
      );
    }
    displayPhoneNumber = check.displayPhoneNumber;
    verifiedName = check.verifiedName ?? null;
  }

  // 4. Asignación de Asistente e IA:
  // Si la línea ya existía, preservar el asistente y configuración de IA asignados previamente
  let assistantId = existing?.assistantId ?? null;
  if (!assistantId) {
    const assistantRows = await db
      .select({ id: schema.agentProfile.id })
      .from(schema.agentProfile)
      .where(
        and(
          scoped(schema.agentProfile.organizationId, organizationId),
          eq(schema.agentProfile.type, "conversational")
        )
      )
      .orderBy(desc(schema.agentProfile.isDefault), desc(schema.agentProfile.createdAt))
      .limit(1);
    assistantId = assistantRows[0]?.id ?? null;
  }

  const finalAiEnabled = aiEnabled !== undefined ? aiEnabled : (existing?.aiEnabled ?? true);
  const finalLabel = label ?? existing?.label ?? verifiedName ?? displayPhoneNumber;

  // 5. Guardar la credencial cifrada con AES-256-GCM (onConflictDoUpdate en la BD)
  await saveCredentials({
    organizationId,
    wabaId,
    phoneNumberId,
    token,
    displayPhoneNumber,
    verifiedName,
    label: finalLabel,
    assistantId,
    aiEnabled: finalAiEnabled,
    signupMethod: signupMethod ?? existing?.signupMethod ?? "embedded_signup",
  });

  return Response.json({
    ok: true,
    action: isUpdate ? "updated" : "created",
    message: isUpdate
      ? `Línea ${phoneNumberId} actualizada exitosamente en el CRM`
      : "Línea de WhatsApp aprovisionada exitosamente en el CRM",
    line: {
      phoneNumberId,
      wabaId,
      displayPhoneNumber,
      verifiedName,
      status: "connected",
    },
  });
}

/**
 * DELETE /api/settings/whatsapp/provision
 * Endpoint resiliente para desvincular una línea en este CRM.
 * Si la línea no existe, responde 200 OK inmediatamente y termina sin error.
 */
export async function DELETE(req: Request) {
  const auth = await resolveAuthorizedOrg(req);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: "No autorizado. Clave de aprovisionamiento inválida o no enviada." },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const queryPhone = url.searchParams.get("phoneNumberId");

  let phoneNumberId = queryPhone;
  if (!phoneNumberId) {
    try {
      const body = await req.json();
      const parsed = deleteSchema.safeParse(body);
      if (parsed.success) {
        phoneNumberId = parsed.data.phoneNumberId;
      }
    } catch {
      // no body
    }
  }

  if (!phoneNumberId) {
    return Response.json(
      { ok: false, error: "phoneNumberId es requerido en la URL o cuerpo JSON" },
      { status: 400 }
    );
  }

  const db = getDb();
  const orgRows = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .limit(1);

  if (!orgRows[0]?.id) {
    return Response.json(
      { ok: false, error: "No se encontró una organización registrada." },
      { status: 500 }
    );
  }

  // Resiliencia: si la cuenta no existe, contestar con 200 OK y terminar la ejecución
  const existing = await getCredentialsByPhoneNumberId(phoneNumberId);
  if (!existing) {
    return Response.json({
      ok: true,
      action: "noop",
      message: `La línea ${phoneNumberId} no existe en este CRM. Ninguna acción requerida.`,
    });
  }

  await deleteCredentials(orgRows[0].id, phoneNumberId);

  return Response.json({
    ok: true,
    action: "deleted",
    message: `Línea ${phoneNumberId} desvinculada exitosamente del CRM`,
  });
}
