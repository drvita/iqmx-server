import crypto from "node:crypto";

export interface CheckInIntegrityPayload {
  id: string;
  orgId: string;
  dispositivoId: string;
  empleadoId: string | null;
  tipo: string;
  estado: string;
  timestampLocalIso: string;
  timestampServidorIso: string;
  latitud: string | null;
  longitud: string | null;
}

function buildCanonicalCheckInString(input: CheckInIntegrityPayload): string {
  return [
    input.id,
    input.orgId,
    input.dispositivoId,
    input.empleadoId ?? "NULL",
    input.tipo,
    input.estado,
    input.timestampLocalIso,
    input.timestampServidorIso,
    input.latitud ?? "NULL",
    input.longitud ?? "NULL",
  ].join("|");
}

/**
 * Genera el sello criptográfico SHA-256 (64 caracteres hex) para un registro de checada.
 */
export function computeCheckInIntegrityHash(
  input: CheckInIntegrityPayload
): string {
  return crypto
    .createHash("sha256")
    .update(buildCanonicalCheckInString(input), "utf8")
    .digest("hex");
}

/**
 * Verifica de forma segura en tiempo constante que una checada no haya sido alterada.
 */
export function verifyCheckInIntegrityHash(
  input: CheckInIntegrityPayload,
  expectedHash: string
): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = computeCheckInIntegrityHash(input);
  return crypto.timingSafeEqual(
    Buffer.from(actual, "hex"),
    Buffer.from(expectedHash.toLowerCase(), "hex")
  );
}

/**
 * Genera el hash SHA-256 del contenido canónico de un reporte oficial STPS.
 */
export function computeDocumentIntegrityHash(canonicalContent: string): string {
  return crypto
    .createHash("sha256")
    .update(canonicalContent, "utf8")
    .digest("hex");
}
