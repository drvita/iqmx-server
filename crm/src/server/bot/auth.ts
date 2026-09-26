import { timingSafeEqual } from "node:crypto";
import { eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { apiError } from "@/lib/api";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { markBotSeen } from "@/server/bot/status";

/**
 * Autenticación de la API de servicio `/api/bot/*`.
 *
 * ### Modelo Multi-Tenant (SaaS)
 * Cada organización tiene su propia `botApiKey` guardada en
 * `organizationSettings.bot_api_key`. El header `X-API-Key` se coteja contra
 * TODAS las filas con key configurada; la primera coincidencia (timing-safe)
 * determina la `organizationId` que opera la petición. Con esto, una key de
 * ICEFrut JAMÁS puede acceder a datos de Omadero, aunque ambas convivan en
 * el mismo CRM.
 *
 * ### Fallback Self-Hosted (compatibilidad)
 * Si ninguna org coincide por BD, se intenta la variable de entorno global
 * `BOT_API_KEY` y se resuelve la org con `resolveInstanceOrg()` (LIMIT 1).
 * Esto evita romper instalaciones mono-tenant existentes al actualizar.
 *
 * ### Rate Limiting
 * - Fallos de autenticación: 30/min por IP.
 * - Peticiones autenticadas: 1 200/min por `organizationId`.
 */

const MIN_KEY_LENGTH = 16;

/** Presupuesto del bot AUTENTICADO: 1 200/min (20/s sostenidos). */
export const BOT_API_BUDGET = { windowMs: 60_000, max: 1200 };

/** Autenticaciones FALLIDAS por IP: 30/min. */
export const BOT_AUTH_FAILURES = { windowMs: 60_000, max: 30 };

/* ──────────────────────────────────────────────────────────────────────────
 * Resultado tipado de la autenticación
 * ────────────────────────────────────────────────────────────────────────── */

export type BotAuthSuccess = { ok: true; organizationId: string };
export type BotAuthFailure = { ok: false; error: Response };
export type BotAuthResult = BotAuthSuccess | BotAuthFailure;

/* ──────────────────────────────────────────────────────────────────────────
 * Función principal: autentica Y resuelve la organización
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Autentica la petición y devuelve el `organizationId` de la organización
 * cuya `botApiKey` coincide con el header `X-API-Key`.
 *
 * - Fallo de auth → `{ ok: false, error: Response(401|429) }`
 * - Org suspendida → `{ ok: false, error: Response(403) }`
 * - Éxito → `{ ok: true, organizationId }`
 */
export async function requireBotKeyAndResolveOrg(
  req: Request
): Promise<BotAuthResult> {
  const provided = req.headers.get("x-api-key");
  const ip = clientIp(req.headers);

  if (!provided || provided.length < MIN_KEY_LENGTH) {
    return authFailure(ip);
  }

  // 1. Buscar por BD (multi-tenant estricto): cotejar contra las orgs con key.
  const orgId = await resolveOrgByKey(provided);

  // Si no pertenece a ninguna organización, rechazar inmediatamente (sin fallbacks cruzados).
  if (!orgId) {
    return authFailure(ip);
  }

  // 2. Verificar que la organización esté activa.
  const db = getDb();
  const orgs = await db
    .select({ status: schema.organization.status })
    .from(schema.organization)
    .where(eq(schema.organization.id, orgId))
    .limit(1);

  const status = orgs[0]?.status;
  if (!status || status === "suspended" || status === "cancelled") {
    return {
      ok: false,
      error: apiError(403, "org_inactive", "Organización inactiva o suspendida"),
    };
  }

  return authenticated(orgId);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers internos
 * ────────────────────────────────────────────────────────────────────────── */

async function resolveOrgByKey(provided: string): Promise<string | null> {
  const db = getDb();
  // Traer todas las orgs con key configurada (en producción serán pocas decenas).
  const rows = await db
    .select({
      organizationId: schema.organizationSettings.organizationId,
      botApiKey: schema.organizationSettings.botApiKey,
    })
    .from(schema.organizationSettings)
    .where(isNotNull(schema.organizationSettings.botApiKey));

  for (const row of rows) {
    if (row.botApiKey && safeEqual(provided, row.botApiKey)) {
      return row.organizationId;
    }
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function authFailure(ip: string): BotAuthFailure {
  const fails = checkRateLimit(`bot-api-fail:${ip}`, BOT_AUTH_FAILURES);
  return {
    ok: false,
    error: fails.allowed
      ? apiError(401, "unauthorized", "No autorizado")
      : apiError(429, "rate_limited", "Demasiados intentos fallidos"),
  };
}

function authenticated(organizationId: string): BotAuthSuccess {
  markBotSeen();
  checkRateLimit(`bot-api:${organizationId}`, BOT_API_BUDGET);
  return { ok: true, organizationId };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Compatibilidad hacia atrás (self-hosted / tests legacy)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * @deprecated Usar `requireBotKeyAndResolveOrg()`.
 * Mantenido para tests legacy que aún mockean `requireBotKey` directamente.
 */
export function requireBotKey(req: Request): Response | null {
  const provided = req.headers.get("x-api-key");
  const expected = process.env.BOT_API_KEY;
  if (!expected || expected.length < MIN_KEY_LENGTH || !provided) {
    return apiError(401, "unauthorized", "No autorizado");
  }
  if (!safeEqual(provided, expected)) {
    const ip = clientIp(req.headers);
    const fails = checkRateLimit(`bot-api-fail:${ip}`, BOT_AUTH_FAILURES);
    return fails.allowed
      ? apiError(401, "unauthorized", "No autorizado")
      : apiError(429, "rate_limited", "Demasiados intentos fallidos");
  }
  markBotSeen();
  checkRateLimit("bot-api", BOT_API_BUDGET);
  return null;
}

/**
 * La superficie está abierta para al menos una organización.
 * Considera tanto la BD (multi-tenant) como el env (self-hosted).
 */
export async function isBotKeyConfiguredForOrg(organizationId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ botApiKey: schema.organizationSettings.botApiKey })
    .from(schema.organizationSettings)
    .where(eq(schema.organizationSettings.organizationId, organizationId))
    .limit(1);
  return Boolean(rows[0]?.botApiKey);
}

/**
 * @deprecated Solo para compatibilidad en `brain-status` de instancias sin sesión.
 * Prefer `isBotKeyConfiguredForOrg(organizationId)`.
 */
export function isBotKeyConfigured(): boolean {
  const key = process.env.BOT_API_KEY;
  return typeof key === "string" && key.length >= MIN_KEY_LENGTH;
}

/**
 * Organización única de la instancia (self-hosted, un negocio). Cacheada en
 * memoria: la instancia jamás cambia de organización en runtime.
 * @deprecated En multi-tenant, usar el `organizationId` resuelto desde la key.
 */
let cachedOrgId: string | null = null;

export async function resolveInstanceOrg(): Promise<string | null> {
  if (cachedOrgId) return cachedOrgId;
  const db = getDb();
  const rows = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .limit(1);
  cachedOrgId = rows[0]?.id ?? null;
  return cachedOrgId;
}

/** Solo para tests. */
export function resetInstanceOrgCache(): void {
  cachedOrgId = null;
}
