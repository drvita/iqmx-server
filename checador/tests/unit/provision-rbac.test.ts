import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSessionToken, verifySessionToken } from "@/lib/auth/session";
import {
  deviceBlacklistKey,
  generateSixDigitPin,
  pairingPinKey,
} from "@/services/admin/devices";
import { authenticateProvisionRequest } from "@/services/provision/auth";
import { normalizeOrgStatus } from "@/services/provision/tenant";

describe("Provisioning M2M Auth", () => {
  const ORIGINAL_ENV = { ...process.env };
  const TEST_SECRET = "test-provision-secret-0123456789abcdef";

  beforeEach(() => {
    process.env.PROVISION_SECRET_KEY = TEST_SECRET;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns 503 when PROVISION_SECRET_KEY is not configured", async () => {
    delete process.env.PROVISION_SECRET_KEY;
    delete process.env.CHECADOR_PROVISION_SECRET;
    delete process.env.INTERNAL_API_KEY;

    const req = new Request("http://localhost:3002/api/provision/tenant", {
      method: "POST",
    });
    const result = await authenticateProvisionRequest(req, "{}");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
    }
  });

  it("accepts valid Bearer token and x-provision-key", async () => {
    const reqBearer = new Request("http://localhost:3002/api/provision/tenant", {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_SECRET}` },
    });
    expect(await authenticateProvisionRequest(reqBearer)).toEqual({ ok: true });

    const reqHeader = new Request("http://localhost:3002/api/provision/tenant", {
      method: "POST",
      headers: { "x-provision-key": TEST_SECRET },
    });
    expect(await authenticateProvisionRequest(reqHeader)).toEqual({ ok: true });
  });

  it("rejects invalid Bearer token with 401", async () => {
    const req = new Request("http://localhost:3002/api/provision/tenant", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const result = await authenticateProvisionRequest(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it("validates HMAC-SHA256 signature within 300s window", async () => {
    const rawBody = JSON.stringify({ externalCustomerId: "cust_123" });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${ts}.${rawBody}`)
      .digest("hex");

    const req = new Request("http://localhost:3002/api/provision/tenant", {
      method: "POST",
      headers: {
        "x-provision-timestamp": ts,
        "x-provision-signature": sig,
      },
    });
    expect(await authenticateProvisionRequest(req, rawBody)).toEqual({
      ok: true,
    });
  });

  it("rejects expired HMAC timestamp (>300s) and tampered body", async () => {
    const rawBody = JSON.stringify({ externalCustomerId: "cust_123" });
    const expiredTs = String(Math.floor(Date.now() / 1000) - 400);
    const expiredSig = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${expiredTs}.${rawBody}`)
      .digest("hex");

    const expiredReq = new Request("http://localhost:3002/api/provision/tenant", {
      method: "POST",
      headers: {
        "x-provision-timestamp": expiredTs,
        "x-provision-signature": expiredSig,
      },
    });
    const expiredRes = await authenticateProvisionRequest(expiredReq, rawBody);
    expect(expiredRes.ok).toBe(false);
    if (!expiredRes.ok) expect(expiredRes.status).toBe(401);

    const freshTs = String(Math.floor(Date.now() / 1000));
    const freshSig = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${freshTs}.${rawBody}`)
      .digest("hex");
    const tamperedReq = new Request("http://localhost:3002/api/provision/tenant", {
      method: "POST",
      headers: {
        "x-provision-timestamp": freshTs,
        "x-provision-signature": freshSig,
      },
    });
    const tamperedRes = await authenticateProvisionRequest(
      tamperedReq,
      JSON.stringify({ externalCustomerId: "cust_999" })
    );
    expect(tamperedRes.ok).toBe(false);
  });
});

describe("Password hashing & Session token", () => {
  it("hashes and verifies passwords with scrypt", () => {
    const hash = hashPassword("S3cur3-P@ssw0rd!");
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(verifyPassword("S3cur3-P@ssw0rd!", hash)).toBe(true);
    expect(verifyPassword("wrong-pass", hash)).toBe(false);
    expect(verifyPassword("anything", "invalid-format")).toBe(false);
  });

  it("signs and verifies session tokens and rejects tampered tokens", () => {
    const token = signSessionToken({
      userId: "u-1",
      orgId: "org-1",
      rol: "ORG_ADMIN",
      nombre: "Admin Prueba",
      email: "admin@empresa.mx",
    });

    const verified = verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.orgId).toBe("org-1");
    expect(verified?.rol).toBe("ORG_ADMIN");

    const [payloadB64, sig] = token.split(".");
    expect(verifySessionToken(`${payloadB64}.tampered-${sig}`)).toBeNull();
    expect(verifySessionToken("malformed")).toBeNull();
  });
});

describe("Tenant status normalization & device Redis keys", () => {
  it("normalizes external billing statuses", () => {
    expect(normalizeOrgStatus("active")).toBe("activo");
    expect(normalizeOrgStatus("trial")).toBe("prueba");
    expect(normalizeOrgStatus("suspended")).toBe("suspendido");
    expect(normalizeOrgStatus("cancelled")).toBe("cancelado");
    expect(normalizeOrgStatus("suspendido")).toBe("suspendido");
    expect(normalizeOrgStatus(undefined)).toBe("activo");
  });

  it("generates 6-digit pairing PINs and deterministic Redis keys", () => {
    for (let i = 0; i < 20; i++) {
      const pin = generateSixDigitPin();
      expect(pin).toMatch(/^\d{6}$/);
    }
    expect(deviceBlacklistKey("abc123hash")).toBe("blacklist:device:abc123hash");
    expect(pairingPinKey("482910")).toBe("pairing:pin:482910");
  });
});
