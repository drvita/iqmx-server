import crypto from "node:crypto";

export type ProvisionAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

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
    process.env.CHECADOR_PROVISION_SECRET ||
    process.env.INTERNAL_API_KEY;
  return secret && secret.trim().length > 0 ? secret.trim() : null;
}

/**
 * Valida peticiones M2M de aprovisionamiento desde `api/`:
 * 1) Bearer token o `x-api-key` / `x-provision-key` comparado en tiempo constante.
 * 2) Firma HMAC-SHA256 (`x-provision-timestamp` + `x-provision-signature`) con ventana anti-replay de 300s.
 */
export async function authenticateProvisionRequest(
  req: Request,
  rawBody: string = ""
): Promise<ProvisionAuthResult> {
  const secret = getProvisionSecret();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "PROVISION_SECRET_KEY no está configurada.",
    };
  }

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

  const timestampHeader =
    req.headers.get("x-provision-timestamp") ||
    req.headers.get("x-signature-timestamp");
  const signatureHeader =
    req.headers.get("x-provision-signature") ||
    req.headers.get("x-signature");

  if (timestampHeader && signatureHeader) {
    const timestampSec = Number.parseInt(timestampHeader, 10);
    if (Number.isNaN(timestampSec)) {
      return {
        ok: false,
        status: 401,
        error: "Cabecera de timestamp inválida.",
      };
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timestampSec) > 300) {
      return {
        ok: false,
        status: 401,
        error: "Firma expirada o timestamp desfasado.",
      };
    }

    const expectedHex = crypto
      .createHmac("sha256", secret)
      .update(`${timestampSec}.${rawBody}`)
      .digest("hex");

    const cleanSig = signatureHeader.replace(/^sha256=/, "").trim();
    if (safeCompare(cleanSig, expectedHex)) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    status: 401,
    error: "Credenciales M2M inválidas.",
  };
}
