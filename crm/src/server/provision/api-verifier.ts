import crypto from "node:crypto";

/**
 * Caché en memoria para tokens validados recientemente (TTL 30 segundos)
 * Evita ráfagas de llamadas repetitivas hacia la API central.
 */
const cache = new Map<string, { valid: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 1000;

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getLocalSecretFallback(): string | null {
  const secret =
    process.env.PROVISION_SECRET_KEY ||
    process.env.CRM_PROVISION_SECRET ||
    process.env.INTERNAL_API_KEY;
  return secret && secret.trim().length > 0 ? secret.trim() : null;
}

/**
 * Helper centralizado para validar si un token M2M proviene legítimamente
 * de la API Central (Single Source of Truth).
 * 
 * Consulta al endpoint de introspección:
 * POST /api/internal/products/verify-secret
 * 
 * Si la API valida el token, retorna `true`.
 * Si la API rechaza el token, retorna `false`.
 * En caso de fallo de red temporal, aplica fallback local timing-safe si existe clave configurada.
 */
export async function verifyApiSecretWithCentral(
  token: string,
  productSlug: string = "crm"
): Promise<boolean> {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return false;
  }

  const trimmedToken = token.trim();
  const cacheKey = `${productSlug}:${trimmedToken}`;
  const now = Date.now();

  // 1. Revisar caché en memoria
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.valid;
  }

  // 2. Resolver URL interna de la API Central
  const apiBaseUrl = (
    process.env.API_INTERNAL_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://api:8000"
  ).replace(/\/+$/, "");

  const endpoint = `${apiBaseUrl}/api/internal/products/verify-secret`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        product_slug: productSlug,
        secret: trimmedToken,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as { valid?: boolean };
      const isValid = Boolean(data?.valid);

      // Guardar en caché
      cache.set(cacheKey, {
        valid: isValid,
        expiresAt: now + CACHE_TTL_MS,
      });

      return isValid;
    }

    console.warn(
      `[api-verifier] API central respondió código ${res.status} al verificar secreto.`
    );
  } catch (err: unknown) {
    console.warn(
      `[api-verifier] No fue posible contactar a la API central en ${endpoint}:`,
      err instanceof Error ? err.message : err
    );
  }

  // 3. Fallback secundario de contingencia: validar contra clave local si existe
  const localSecret = getLocalSecretFallback();
  if (localSecret && safeCompare(trimmedToken, localSecret)) {
    console.info(
      `[api-verifier] Token validado exitosamente mediante fallback local.`
    );
    return true;
  }

  return false;
}
