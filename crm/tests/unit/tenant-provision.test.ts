import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import {
  authenticateProvisionRequest,
  getProvisionSecret,
} from "@/server/provision/auth";
import {
  provisionTenant,
  setTenantStatus,
} from "@/server/provision/tenant";
import { POST as handleProvisionPost } from "@/app/api/provision/tenant/route";
import { PATCH as handleStatusPatch } from "@/app/api/provision/tenant/[id]/status/route";

const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("SaaS Multi-Tenant Provisioning & Security", () => {
  beforeEach(() => {
    process.env.PROVISION_SECRET_KEY = TEST_SECRET;
  });

  describe("Capa de Seguridad y Autenticación M2M", () => {
    it("obtiene la clave secreta desde la variable de entorno", () => {
      expect(getProvisionSecret()).toBe(TEST_SECRET);
    });

    it("rechaza peticiones sin credenciales (401)", async () => {
      const req = new Request("https://crm.local/api/provision/tenant", {
        method: "POST",
      });
      const auth = await authenticateProvisionRequest(req, "{}");
      expect(auth.ok).toBe(false);
      if (!auth.ok) {
        expect(auth.status).toBe(401);
      }
    });

    it("rechaza peticiones con token Bearer inválido (401)", async () => {
      const req = new Request("https://crm.local/api/provision/tenant", {
        method: "POST",
        headers: {
          authorization: "Bearer clave_totalmente_incorrecta",
        },
      });
      const auth = await authenticateProvisionRequest(req, "{}");
      expect(auth.ok).toBe(false);
      if (!auth.ok) {
        expect(auth.status).toBe(401);
      }
    });

    it("acepta peticiones con token Bearer correcto (timing-safe)", async () => {
      const req = new Request("https://crm.local/api/provision/tenant", {
        method: "POST",
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
        },
      });
      const auth = await authenticateProvisionRequest(req, "{}");
      expect(auth.ok).toBe(true);
    });

    it("rechaza peticiones con timestamp desfasado por más de 5 minutos (Anti-Replay)", async () => {
      const staleTimestamp = Math.floor(Date.now() / 1000) - 400; // 400s en el pasado (>300s)
      const rawBody = JSON.stringify({ companyName: "Test" });
      const signature = crypto
        .createHmac("sha256", TEST_SECRET)
        .update(`${staleTimestamp}.${rawBody}`)
        .digest("hex");

      const req = new Request("https://crm.local/api/provision/tenant", {
        method: "POST",
        headers: {
          "x-provision-timestamp": staleTimestamp.toString(),
          "x-provision-signature": signature,
        },
      });

      const auth = await authenticateProvisionRequest(req, rawBody);
      expect(auth.ok).toBe(false);
      if (!auth.ok) {
        expect(auth.error).toContain("expirada o timestamp desfasado");
      }
    });

    it("rechaza peticiones con cuerpo alterado aunque el timestamp sea válido (Anti-Tampering)", async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const originalBody = JSON.stringify({ companyName: "Original" });
      const signature = crypto
        .createHmac("sha256", TEST_SECRET)
        .update(`${nowSec}.${originalBody}`)
        .digest("hex");

      const tamperedBody = JSON.stringify({ companyName: "Tampered" });
      const req = new Request("https://crm.local/api/provision/tenant", {
        method: "POST",
        headers: {
          "x-provision-timestamp": nowSec.toString(),
          "x-provision-signature": signature,
        },
      });

      const auth = await authenticateProvisionRequest(req, tamperedBody);
      expect(auth.ok).toBe(false);
      if (!auth.ok) {
        expect(auth.error).toContain("Firma inválida");
      }
    });

    it("acepta peticiones con firma HMAC-SHA256 válida y fresca", async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const rawBody = JSON.stringify({ companyName: "Valida" });
      const signature = crypto
        .createHmac("sha256", TEST_SECRET)
        .update(`${nowSec}.${rawBody}`)
        .digest("hex");

      const req = new Request("https://crm.local/api/provision/tenant", {
        method: "POST",
        headers: {
          "x-provision-timestamp": nowSec.toString(),
          "x-provision-signature": signature,
        },
      });

      const auth = await authenticateProvisionRequest(req, rawBody);
      expect(auth.ok).toBe(true);
    });
  });

  describe("API Endpoints de Aprovisionamiento y Suspensión", () => {
    it("POST /api/provision/tenant rechaza sin autenticación", async () => {
      const req = new Request("https://crm.local/api/provision/tenant", {
        method: "POST",
        body: JSON.stringify({
          externalCustomerId: "iq_1",
          companyName: "Acme",
          ownerEmail: "owner@acme.com",
          ownerName: "Admin",
        }),
      });
      const res = await handleProvisionPost(req);
      expect(res.status).toBe(401);
    });

    it("POST /api/provision/tenant valida esquema de entrada con Zod (422)", async () => {
      const req = new Request("https://crm.local/api/provision/tenant", {
        method: "POST",
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
        },
        body: JSON.stringify({
          externalCustomerId: "", // Vacío inválido
          companyName: "A", // Muy corto
          ownerEmail: "no-es-correo",
          ownerName: "",
        }),
      });
      const res = await handleProvisionPost(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.ok).toBe(false);
    });

    it("PATCH /api/provision/tenant/[id]/status rechaza sin autenticación", async () => {
      const req = new Request("https://crm.local/api/provision/tenant/org_123/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "suspended" }),
      });
      const res = await handleStatusPatch(req, {
        params: Promise.resolve({ id: "org_123" }),
      });
      expect(res.status).toBe(401);
    });

    it("PATCH /api/provision/tenant/[id]/status valida que el status sea enum válido", async () => {
      const req = new Request("https://crm.local/api/provision/tenant/org_123/status", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
        },
        body: JSON.stringify({ status: "status_inexistente" }),
      });
      const res = await handleStatusPatch(req, {
        params: Promise.resolve({ id: "org_123" }),
      });
      expect(res.status).toBe(422);
    });
  });
});
