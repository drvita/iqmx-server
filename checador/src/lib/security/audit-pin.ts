import crypto from "node:crypto";

/**
 * Genera el hash SHA-256 con sal por organización para el PIN de auditoría local del quiosco.
 * Coincide exactamente con el cálculo WebCrypto del navegador en `/kiosk`.
 */
export function hashAuditPinServer(orgId: string, pin: string): string {
  return crypto
    .createHash("sha256")
    .update(`${orgId}:${pin.trim()}`)
    .digest("hex");
}
