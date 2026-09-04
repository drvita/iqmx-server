import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { randomBytes } from "node:crypto";
import { safeEqual } from "@/server/inbox/webhook";

function parseMetadata(metadata: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Genera y/o recupera el Webhook Token único y seguro de la organización.
 * Cada empresa tiene su propio token independiente almacenado en organization.metadata,
 * garantizando el aislamiento estricto multi-tenant y evitando que los mensajes se crucen.
 */
export async function getOrGenerateWebhookToken(
  organizationId?: string | null
): Promise<string> {
  const db = getDb();
  const query = db
    .select({ id: schema.organization.id, metadata: schema.organization.metadata })
    .from(schema.organization);

  const rows = organizationId
    ? await query.where(eq(schema.organization.id, organizationId)).limit(1)
    : await query.limit(1);

  if (!rows[0]) {
    return "wa_tok_" + randomBytes(24).toString("hex");
  }

  const meta = parseMetadata(rows[0].metadata);
  if (typeof meta.webhookToken === "string" && meta.webhookToken.length > 0) {
    return meta.webhookToken;
  }

  // Generar un token criptográfico único por organización
  const tokenToSave = "wa_tok_" + randomBytes(24).toString("hex");

  meta.webhookToken = tokenToSave;
  await db
    .update(schema.organization)
    .set({ metadata: JSON.stringify(meta) })
    .where(eq(schema.organization.id, rows[0].id));

  return tokenToSave;
}

/**
 * Valida si el token recibido en la URL del webhook coincide con el token de alguna organización registrada.
 */
export async function isWebhookTokenValid(token: string): Promise<boolean> {
  if (!token || token.trim().length === 0) return false;

  const db = getDb();
  const orgs = await db
    .select({ id: schema.organization.id, metadata: schema.organization.metadata })
    .from(schema.organization);

  for (const org of orgs) {
    const meta = parseMetadata(org.metadata);
    if (
      typeof meta.webhookToken === "string" &&
      meta.webhookToken.length > 0 &&
      safeEqual(token, meta.webhookToken)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Resuelve la organización asociada exclusivamente al token del webhook recibido.
 * Retorna null si no coincide con ninguna organización existente.
 */
export async function getOrganizationByWebhookToken(
  token: string
): Promise<{ id: string; status: string } | null> {
  if (!token || token.trim().length === 0) return null;
  const db = getDb();
  const orgs = await db
    .select({
      id: schema.organization.id,
      status: schema.organization.status,
      metadata: schema.organization.metadata,
    })
    .from(schema.organization);

  for (const org of orgs) {
    const meta = parseMetadata(org.metadata);
    if (
      typeof meta.webhookToken === "string" &&
      meta.webhookToken.length > 0 &&
      safeEqual(token, meta.webhookToken)
    ) {
      return { id: org.id, status: org.status };
    }
  }

  return null;
}
