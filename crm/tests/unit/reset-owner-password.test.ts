import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as handleResetOwnerPasswordPost } from "@/app/api/provision/reset-owner-password/route";

const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("Endpoint POST /api/provision/reset-owner-password", () => {
  beforeEach(() => {
    process.env.PROVISION_SECRET_KEY = TEST_SECRET;
  });

  it("rechaza peticiones sin autenticación con 401", async () => {
    const req = new Request("https://crm.local/api/provision/reset-owner-password", {
      method: "POST",
      body: JSON.stringify({
        externalCustomerId: "cust_123",
        password: "tempPassword123",
      }),
    });

    const res = await handleResetOwnerPasswordPost(req);
    expect(res.status).toBe(401);
  });

  it("rechaza peticiones con token inválido con 401", async () => {
    const req = new Request("https://crm.local/api/provision/reset-owner-password", {
      method: "POST",
      headers: {
        authorization: "Bearer wrong_secret",
      },
      body: JSON.stringify({
        externalCustomerId: "cust_123",
        password: "tempPassword123",
      }),
    });

    const res = await handleResetOwnerPasswordPost(req);
    expect(res.status).toBe(401);
  });

  it("rechaza peticiones con datos incompletos (sin email ni externalCustomerId) con 422", async () => {
    const req = new Request("https://crm.local/api/provision/reset-owner-password", {
      method: "POST",
      headers: {
        authorization: `Bearer ${TEST_SECRET}`,
      },
      body: JSON.stringify({
        password: "tempPassword123",
      }),
    });

    const res = await handleResetOwnerPasswordPost(req);
    expect(res.status).toBe(422);
  });

  it("rechaza contraseñas con longitud menor a 8 caracteres con 422", async () => {
    const req = new Request("https://crm.local/api/provision/reset-owner-password", {
      method: "POST",
      headers: {
        authorization: `Bearer ${TEST_SECRET}`,
      },
      body: JSON.stringify({
        externalCustomerId: "cust_123",
        password: "short",
      }),
    });

    const res = await handleResetOwnerPasswordPost(req);
    expect(res.status).toBe(422);
  });
});
