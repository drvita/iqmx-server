import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import {
  deleteCredentials,
  getCredentialsByPhoneNumberId,
  listCredentialsByOrg,
  saveCredentials,
  tokenLast4,
  updateLineAssistant,
} from "@/server/whatsapp/credentials";
import { subscribeAppToWaba, testConnection } from "@/server/whatsapp/connect";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => {
  const [credsList, assistants] = await Promise.all([
    listCredentialsByOrg(session.organizationId),
    getDb()
      .select({
        id: schema.agentProfile.id,
        name: schema.agentProfile.name,
        isDefault: schema.agentProfile.isDefault,
      })
      .from(schema.agentProfile)
      .where(
        and(
          scoped(schema.agentProfile.organizationId, session.organizationId),
          eq(schema.agentProfile.type, "conversational") // Solo asistentes conversacionales para las líneas
        )
      )
      .orderBy(desc(schema.agentProfile.isDefault), desc(schema.agentProfile.createdAt)),
  ]);

  const connections = credsList.map((creds) => ({
    id: creds.id,
    wabaId: creds.wabaId,
    phoneNumberId: creds.phoneNumberId,
    displayPhoneNumber: creds.displayPhoneNumber,
    verifiedName: creds.verifiedName,
    label: creds.label,
    isDefault: creds.isDefault,
    aiEnabled: creds.aiEnabled,
    assistantId: creds.assistantId,
    signupMethod: creds.signupMethod,
    status: creds.status,
    tokenLast4: tokenLast4(creds.token),
  }));

  const { getOrganizationSettings } = await import("@/server/settings/service");
  const settings = await getOrganizationSettings(session.organizationId);

  return Response.json({
    connections,
    // Compatibilidad con código anterior que buscaba un único connection
    connection: connections[0] ?? null,
    assistants,
    maxWhatsappAccounts: settings.maxWhatsappAccounts,
    canAddAccount: connections.length < settings.maxWhatsappAccounts,
    metaConfig: {
      appId: process.env.NEXT_PUBLIC_META_APP_ID || process.env.META_APP_ID || "",
      configId: process.env.NEXT_PUBLIC_META_CONFIG_ID || process.env.META_CONFIG_ID || "",
    },
  });
});

const putSchema = z.object({
  wabaId: z.string().trim().min(1),
  phoneNumberId: z.string().trim().min(1),
  token: z.string().trim().min(1),
  label: z.string().trim().optional(),
  assistantId: z.string().nullable().optional(),
  aiEnabled: z.boolean().optional().default(true),
  isDefault: z.boolean().optional(),
});

/** Guarda una conexión manual: valida contra Meta, cifra y suscribe. */
export const PUT = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, putSchema);
  if (!body.ok) return body.response;

  // Si es una línea nueva, validar el límite máximo de líneas permitidas por la membresía
  const existing = await getCredentialsByPhoneNumberId(body.data.phoneNumberId);
  if (!existing) {
    const { assertCanAddWhatsappAccount } = await import("@/server/settings/limits");
    try {
      await assertCanAddWhatsappAccount(session.organizationId);
    } catch (err: any) {
      return apiError(403, "quota_exceeded", err.message);
    }
  }

  const check = await testConnection(body.data.phoneNumberId, body.data.token);
  if (!check.ok) {
    const status = check.code === "meta_unavailable" ? 503 : 422;
    return apiError(status, check.code, check.message);
  }

  // Si no se especificó un assistantId, asociar al conversacional por defecto
  let assistantId = body.data.assistantId;
  if (!assistantId) {
    const db = getDb();
    const defaultAssistant = await db
      .select({ id: schema.agentProfile.id })
      .from(schema.agentProfile)
      .where(
        and(
          scoped(schema.agentProfile.organizationId, session.organizationId),
          eq(schema.agentProfile.type, "conversational")
        )
      )
      .orderBy(desc(schema.agentProfile.isDefault), desc(schema.agentProfile.createdAt))
      .limit(1);
    assistantId = defaultAssistant[0]?.id ?? null;
  }

  await saveCredentials({
    organizationId: session.organizationId,
    wabaId: body.data.wabaId,
    phoneNumberId: body.data.phoneNumberId,
    token: body.data.token,
    displayPhoneNumber: check.displayPhoneNumber,
    verifiedName: check.verifiedName,
    label: body.data.label ?? check.verifiedName ?? check.displayPhoneNumber,
    assistantId,
    aiEnabled: body.data.aiEnabled,
    isDefault: body.data.isDefault,
    signupMethod: "manual",
  });

  // Best-effort suscripción
  await subscribeAppToWaba(body.data.wabaId, body.data.token);

  return Response.json({
    ok: true,
    displayPhoneNumber: check.displayPhoneNumber,
  });
});

const patchSchema = z.object({
  phoneNumberId: z.string().trim().min(1),
  assistantId: z.string().nullable().optional(),
  aiEnabled: z.boolean().optional(),
  label: z.string().trim().optional(),
});

/** Actualiza la configuración de una línea (Asistente asignado, estado de IA, label). */
export const PATCH = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;

  await updateLineAssistant(session.organizationId, body.data.phoneNumberId, {
    assistantId: body.data.assistantId,
    aiEnabled: body.data.aiEnabled,
    label: body.data.label,
  });

  return Response.json({ ok: true });
});

/** Elimina una conexión telefónica. */
export const DELETE = withAuth(async (session, req: Request) => {
  const url = new URL(req.url);
  const phoneNumberId = url.searchParams.get("phoneNumberId");
  if (!phoneNumberId) {
    return apiError(400, "missing_phone", "Se requiere phoneNumberId");
  }

  await deleteCredentials(session.organizationId, phoneNumberId);
  return Response.json({ ok: true });
});
