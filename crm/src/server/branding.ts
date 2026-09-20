import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import {
  DEFAULT_BRANDING,
  normalizeBranding,
  type Branding,
} from "@/lib/branding";

/** Marca guardada en organization.metadata (JSON de Better Auth). */

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
 * Marca + a qué organización pertenece.
 *
 * El icono se guarda como archivo en `MEDIA_DIR/{organizationId}/favicon`, así
 * que servirlo necesita el id — y la ruta que lo sirve es pública (el login
 * también tiene pestaña), donde no hay sesión de la que sacarlo.
 */
export async function getBrandingContext(
  organizationId?: string | null
): Promise<{ organizationId: string | null; branding: Branding }> {
  if (!organizationId) {
    return { organizationId: null, branding: DEFAULT_BRANDING };
  }

  const db = getDb();
  const rows = await db
    .select({ id: schema.organization.id, metadata: schema.organization.metadata })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);

  if (!rows[0]) return { organizationId: null, branding: DEFAULT_BRANDING };
  const meta = parseMetadata(rows[0].metadata);
  return {
    organizationId: rows[0].id,
    branding: normalizeBranding(
      (meta.branding as Partial<Branding> | undefined) ?? null
    ),
  };
}

export async function getBranding(
  organizationId?: string | null
): Promise<Branding> {
  return (await getBrandingContext(organizationId)).branding;
}

export async function saveBranding(
  organizationId: string,
  branding: Branding
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ metadata: schema.organization.metadata })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);
  const meta = parseMetadata(rows[0]?.metadata ?? null);
  const normalized = normalizeBranding(branding);
  meta.branding = normalized;

  const cleanName = normalized.name.trim();

  // 1. Actualizar la organización en el CRM (tanto el nombre directo como los metadatos)
  await db
    .update(schema.organization)
    .set({
      name: cleanName,
      metadata: JSON.stringify(meta),
    })
    .where(eq(schema.organization.id, organizationId));

  // 2. Sincronizar el nombre en la tabla central public.customers para el panel de administración y portal
  try {
    await db.execute(sql`
      UPDATE public.customers
      SET company_name = ${cleanName}, updated_at = NOW()
      WHERE id IN (
        SELECT NULLIF(external_customer_id, '')::integer
        FROM crm.organization
        WHERE id = ${organizationId} AND external_customer_id ~ '^[0-9]+$'
        UNION
        SELECT customer_id
        FROM public.customer_subscriptions
        WHERE external_tenant_id = ${organizationId}
      )
    `);
  } catch (err) {
    // Si la tabla public.customers no está disponible en este entorno, salvaguardar
    console.warn("No se pudo sincronizar el nombre con public.customers:", err);
  }
}
