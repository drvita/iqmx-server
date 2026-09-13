import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  createTemplate,
  serializeTemplate,
  syncTemplates,
  TemplateError,
} from "@/server/whatsapp/templates";

const mockCredsLine1 = {
  id: "cred_1",
  organizationId: "org_test",
  wabaId: "waba_alpha",
  phoneNumberId: "phone_111",
  displayPhoneNumber: "+52 55 1111 1111",
  verifiedName: "Ventas",
  label: "Ventas",
  isDefault: true,
  aiEnabled: true,
  assistantId: null,
  signupMethod: "manual" as const,
  status: "connected" as const,
  token: "token_alpha",
};

const mockCredsLine2 = {
  id: "cred_2",
  organizationId: "org_test",
  wabaId: "waba_beta",
  phoneNumberId: "phone_222",
  displayPhoneNumber: "+52 55 2222 2222",
  verifiedName: "Soporte",
  label: "Soporte",
  isDefault: false,
  aiEnabled: true,
  assistantId: null,
  signupMethod: "manual" as const,
  status: "connected" as const,
  token: "token_beta",
};

const graphCalls: { endpoint: string; options?: unknown }[] = [];
const dbInserts: unknown[] = [];

vi.mock("@/server/whatsapp/credentials", () => ({
  getCredentialsByPhoneNumberId: vi.fn(async (phoneId: string) => {
    if (phoneId === "phone_111") return mockCredsLine1;
    if (phoneId === "phone_222") return mockCredsLine2;
    return null;
  }),
  getCredentialsByOrg: vi.fn(async (orgId: string) => {
    if (orgId === "org_test") return mockCredsLine1;
    return null;
  }),
  listCredentialsByOrg: vi.fn(async (orgId: string) => {
    if (orgId === "org_test") return [mockCredsLine1, mockCredsLine2];
    return [];
  }),
  getCredentialsByWabaId: vi.fn(async (wabaId: string) => {
    if (wabaId === "waba_alpha") return mockCredsLine1;
    if (wabaId === "waba_beta") return mockCredsLine2;
    return null;
  }),
  markReconnectRequired: vi.fn(),
}));

vi.mock("@/lib/meta/client", () => ({
  graphRequest: vi.fn(async (endpoint: string, options?: unknown) => {
    graphCalls.push({ endpoint, options });
    if (endpoint.includes("/message_templates") && (options as { method?: string })?.method === "POST") {
      return { id: "wa_tpl_999", status: "PENDING" };
    }
    return { data: [] };
  }),
  MetaApiError: class extends Error {
    isAuthError = false;
    status = 500;
  },
  normalizeRecipient: (p: string) => p.replace(/\D/g, ""),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    insert: () => ({
      values: (v: unknown) => {
        dbInserts.push(v);
        return {
          onConflictDoUpdate: () => ({
            returning: () => [v],
          }),
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([]),
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  }),
  schema: {
    template: {
      id: "id",
      organizationId: "organization_id",
      phoneNumberId: "phone_number_id",
      wabaId: "waba_id",
      name: "name",
      language: "language",
      status: "status",
      createdAt: "created_at",
    },
    conversation: {
      id: "id",
      organizationId: "organization_id",
      contactId: "contact_id",
      isTest: "is_test",
      phoneNumberId: "phone_number_id",
    },
    contact: { id: "id" },
    message: { id: "id" },
  },
}));

beforeAll(() => {
  process.env.APP_BASE_URL = "http://localhost:3000";
  process.env.DATABASE_URL = "postgresql://t:t@localhost:5432/t";
  process.env.BETTER_AUTH_SECRET = "secret-test";
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
});

describe("Gestión Multi-Número y Multi-WABA de Plantillas", () => {
  it("serializeTemplate expone phoneNumberId y wabaId", () => {
    const serialized = serializeTemplate({
      id: "tpl_1",
      organizationId: "org_test",
      phoneNumberId: "phone_111",
      wabaId: "waba_alpha",
      name: "saludo_inicial",
      language: "es_MX",
      category: "UTILITY",
      body: "Hola {{1}}",
      status: "approved",
      rejectionReason: null,
      waTemplateId: "meta_123",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(serialized).toHaveProperty("phoneNumberId", "phone_111");
    expect(serialized).toHaveProperty("wabaId", "waba_alpha");
  });

  it("createTemplate RECHAZA la creación si falta phoneNumberId (cero defaults)", async () => {
    await expect(
      createTemplate("org_test", {
        phoneNumberId: "",
        name: "test_template",
        language: "es_MX",
        category: "UTILITY",
        body: "Hola {{1}}",
      })
    ).rejects.toThrowError(/Debes seleccionar la línea/);
  });

  it("createTemplate RECHAZA si el phoneNumberId no existe en la organización", async () => {
    await expect(
      createTemplate("org_test", {
        phoneNumberId: "phone_inexistente",
        name: "test_template",
        language: "es_MX",
        category: "UTILITY",
        body: "Hola {{1}}",
      })
    ).rejects.toThrowError(/no existe o no pertenece/);
  });

  it("createTemplate crea la plantilla en Meta con el WABA y token de la línea especificada", async () => {
    graphCalls.length = 0;
    const result = await createTemplate("org_test", {
      phoneNumberId: "phone_222",
      name: "promo_soporte",
      language: "es_MX",
      category: "MARKETING",
      body: "Hola {{1}}, tenemos una promo",
    });

    // Validar llamada a Meta Graph API contra la WABA de phone_222 (waba_beta)
    expect(graphCalls).toHaveLength(1);
    expect(graphCalls[0]!.endpoint).toBe("waba_beta/message_templates");
    expect((graphCalls[0]!.options as { token: string }).token).toBe("token_beta");

    // Validar persistencia en BD con phoneNumberId y wabaId de esa línea
    expect(result).toMatchObject({
      organizationId: "org_test",
      phoneNumberId: "phone_222",
      wabaId: "waba_beta",
      name: "promo_soporte",
      category: "MARKETING",
    });
  });

  it("syncTemplates sincroniza todas las WABAs únicas cuando no se especifica línea", async () => {
    graphCalls.length = 0;
    await syncTemplates("org_test");

    // Debe haber consultado ambas WABAs (waba_alpha y waba_beta)
    const endpoints = graphCalls.map((c) => c.endpoint);
    expect(endpoints).toContain("waba_alpha/message_templates");
    expect(endpoints).toContain("waba_beta/message_templates");
  });

  it("syncTemplates filtra por una línea específica cuando se le proporciona phoneNumberId", async () => {
    graphCalls.length = 0;
    await syncTemplates("org_test", { phoneNumberId: "phone_111" });

    expect(graphCalls).toHaveLength(1);
    expect(graphCalls[0]!.endpoint).toBe("waba_alpha/message_templates");
  });
});
