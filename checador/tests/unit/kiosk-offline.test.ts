import { describe, expect, it } from "vitest";
import {
  LOCAL_COOLDOWN_MS,
  LOCAL_THUMBNAIL_RETENTION_DAYS,
  SYNC_STALE_WARNING_MS,
  SYNCED_META_RETENTION_DAYS,
  detectClockTampering,
  hashAuditPinClient,
  isSyncStale24h,
} from "@/lib/pwa-db/kiosk-db";
import { hashAuditPinServer } from "@/lib/security/audit-pin";
import { hashDeviceToken } from "@/services/sync/device-auth";

describe("kiosk offline helpers", () => {
  it("detects clock tampering when time regresses more than 60 seconds", () => {
    const base = 1_700_000_000_000;

    expect(detectClockTampering(base + 5_000, base)).toEqual({ tampered: false });
    expect(detectClockTampering(base - 30_000, base)).toEqual({ tampered: false });
    expect(detectClockTampering(base - 60_000, base)).toEqual({ tampered: false });

    const regressed = detectClockTampering(base - 60_001, base);
    expect(regressed.tampered).toBe(true);
    expect(regressed.reason).toBe(
      "Se detectó un retroceso en el reloj del dispositivo."
    );
  });

  it("produces a deterministic 64-char SHA-256 hex hash for device tokens", () => {
    const token = "dev_token_ejemplo_123";
    const h1 = hashDeviceToken(token);
    const h2 = hashDeviceToken(token);

    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
    expect(hashDeviceToken("otro_token")).not.toBe(h1);
  });

  it("enforces LFPDPPP retention and anti-spam cooldown constants and matches server/client PIN hash", async () => {
    expect(LOCAL_THUMBNAIL_RETENTION_DAYS).toBe(15);
    expect(SYNCED_META_RETENTION_DAYS).toBe(7);
    expect(LOCAL_COOLDOWN_MS).toBe(180_000);
    expect(SYNC_STALE_WARNING_MS).toBe(86_400_000);
    const serverHash = hashAuditPinServer("org-123", "482910");
    const clientHash = await hashAuditPinClient("org-123", "482910");
    expect(clientHash).toBe(serverHash);
    expect(clientHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("flags sync as stale only when more than 24 hours have elapsed", () => {
    const now = 1_700_100_000_000;
    const within24h = new Date(now - 23 * 60 * 60 * 1000).toISOString();
    const exactly24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const over24h = new Date(now - 24 * 60 * 60 * 1000 - 1_000).toISOString();

    expect(isSyncStale24h(within24h, now)).toBe(false);
    expect(isSyncStale24h(exactly24h, now)).toBe(false);
    expect(isSyncStale24h(over24h, now)).toBe(true);
    expect(isSyncStale24h(null, now)).toBe(true);
    expect(isSyncStale24h("invalid-date", now)).toBe(true);
  });
});
