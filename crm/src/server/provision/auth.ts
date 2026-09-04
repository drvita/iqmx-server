import crypto from "node:crypto";
import { checkRateLimit } from "@/lib/rate-limit";

export const PROVISION_RATE_LIMIT = { windowMs: 5 * 60 * 1000, max: 20 };

export type ProvisionAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip") || "unknown";
}

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function getProvisionSecret(): string | null {
  const secret =
    process.env.PROVISION_SECRET_KEY ||
    process.env.CRM_PROVISION_SECRET ||
    process.env.INTERNAL_API_KEY;
  return secret && secret.trim().length > 0 ? secret.trim() : null;
}

/**
 * Valida la autenticación de la petición de aprovisionamiento.
 * Admite:
 * 1) Firma HMAC-SHA256 con timestamp (Anti-Replay y Anti-Tampering)
 * 2) Token Bearer o cabecera x-api-key en tiempo constante (timing-safe)
 */
export async function authenticateProvisionRequest(
  req: Request,
  rawBody: string = ""
): Promise<ProvisionAuthResult> {
  const ip = getClientIp(req);

  // 1. Rate limiting in-memory por IP
  const rl = checkRateLimit(`provision:${ip}`, PROVISION_RATE_LIMIT);
  if (!rl.allowed) {
    return {
      ok: false,
      status: 429,
      error: "Demasiadas peticiones. Intenta más tarde.",
    };
  }

  // 2. Allowlist de IP opcional
  const allowedIpsEnv = process.env.PROVISION_ALLOWED_IPS;
  if (allowedIpsEnv) {
    const allowedIps = allowedIpsEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      allowedIps.length > 0 &&
      !allowedIps.includes(ip) &&
      ip !== "127.0.0.1" &&
      ip !== "::1"
    ) {
      return { ok: false, status: 403, error: "IP no autorizada." };
    }
  }

  // 3. Secret configurado
  const secret = getProvisionSecret();
  if (!secret) {
    console.error(
      "[provision] PROVISION_SECRET_KEY no está configurada en las variables de entorno"
    );
    return {
      ok: false,
      status: 500,
      error:
        "El servicio de aprovisionamiento no está configurado en este servidor.",
    };
  }

  // 4. Verificación de Firma HMAC (si se proporcionan cabeceras de firma)
  const timestampHeader =
    req.headers.get("x-provision-timestamp") ||
    req.headers.get("x-signature-timestamp");
  const signatureHeader =
    req.headers.get("x-provision-signature") ||
    req.headers.get("x-signature");

  if (timestampHeader && signatureHeader) {
    const timestampSec = parseInt(timestampHeader, 10);
    if (isNaN(timestampSec)) {
      return {
        ok: false,
        status: 401,
        error: "Cabecera de timestamp inválida.",
      };
    }
    const nowSec = Math.floor(Date.now() / 1000);
    // Ventana de 5 minutos (300 segundos) para prevenir replay attacks
    if (Math.abs(nowSec - timestampSec) > 300) {
      return {
        ok: false,
        status: 401,
        error: "Firma expirada o timestamp desfasado.",
      };
    }

    const payloadToSign = `${timestampHeader}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payloadToSign)
      .digest("hex");

    if (!safeCompare(signatureHeader.trim(), expectedSignature)) {
      return { ok: false, status: 401, error: "Firma inválida." };
    }

    return { ok: true };
  }

  // 5. Fallback a Token Bearer o x-api-key (validado en tiempo constante)
  const authHeader = req.headers.get("authorization");
  const apiKeyHeader =
    req.headers.get("x-provision-key") || req.headers.get("x-api-key");

  let providedToken = "";
  if (authHeader?.startsWith("Bearer ")) {
    providedToken = authHeader.slice("Bearer ".length).trim();
  } else if (apiKeyHeader) {
    providedToken = apiKeyHeader.trim();
  }

  if (providedToken && safeCompare(providedToken, secret)) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 401,
    error:
      "No autorizado. Credenciales de aprovisionamiento ausentes o inválidas.",
  };
}
