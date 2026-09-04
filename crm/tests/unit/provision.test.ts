import { describe, expect, it, vi } from "vitest";
import { POST, DELETE } from "@/app/api/settings/whatsapp/provision/route";

vi.mock("@/server/whatsapp/webhook-token", () => ({
  isWebhookTokenValid: vi.fn(
    async (tok: string) =>
      tok === "1f6451ba4fe31f8f7806162958a215e61bf19b5fcc4f9ae35a8aa328d274401e",
  ),
  getOrGenerateWebhookToken: vi.fn(
    async () =>
      "1f6451ba4fe31f8f7806162958a215e61bf19b5fcc4f9ae35a8aa328d274401e",
  ),
  getOrganizationByWebhookToken: vi.fn(
    async (tok: string) =>
      tok === "1f6451ba4fe31f8f7806162958a215e61bf19b5fcc4f9ae35a8aa328d274401e"
        ? { id: "org_test_123" }
        : null,
  ),
}));

vi.mock("@/server/settings/limits", () => ({
  assertCanAddWhatsappAccount: vi.fn().mockResolvedValue(undefined),
}));

// Mock de la base de datos
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: "org_test_123" }]),
    delete: vi.fn().mockReturnThis(),
  })),
  schema: {
    organization: { id: "id" },
    agentProfile: {
      id: "id",
      organizationId: "organization_id",
      type: "type",
      isDefault: "is_default",
      createdAt: "created_at",
    },
    metaCredentials: {
      id: "id",
      organizationId: "organization_id",
      phoneNumberId: "phone_number_id",
      wabaId: "waba_id",
    },
    memberPhoneAccess: {
      organizationId: "organization_id",
      phoneNumberId: "phone_number_id",
    },
  },
}));

// Mock de credentials y connect
vi.mock("@/server/whatsapp/credentials", () => ({
  saveCredentials: vi.fn().mockResolvedValue(undefined),
  deleteCredentials: vi.fn().mockResolvedValue(undefined),
  getCredentialsByPhoneNumberId: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/server/whatsapp/connect", () => ({
  testConnection: vi.fn().mockResolvedValue({
    ok: true,
    displayPhoneNumber: "+52 1 55 1234 5678",
    verifiedName: "Mi Empresa",
  }),
  subscribeAppToWaba: vi.fn().mockResolvedValue(undefined),
  unsubscribeAppFromWaba: vi.fn().mockResolvedValue(undefined),
}));

describe("API /api/settings/whatsapp/provision", () => {
  const verifyToken = "1f6451ba4fe31f8f7806162958a215e61bf19b5fcc4f9ae35a8aa328d274401e";

  it("rechaza peticiones sin autorización con 401", async () => {
    const req = new Request("http://localhost/api/settings/whatsapp/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        wabaId: "123",
        phoneNumberId: "456",
        token: "tok",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it("rechaza datos incompletos con 422", async () => {
    const req = new Request("http://localhost/api/settings/whatsapp/provision", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${verifyToken}`,
      },
      body: JSON.stringify({
        wabaId: "123",
        // phoneNumberId falta
        token: "tok",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("aprovisiona exitosamente con Authorization Bearer y datos completos", async () => {
    const req = new Request("http://localhost/api/settings/whatsapp/provision", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${verifyToken}`,
      },
      body: JSON.stringify({
        wabaId: "waba_999",
        phoneNumberId: "phone_999",
        token: "EAAG_super_token",
        displayPhoneNumber: "+52 1 55 9999 8888",
        verifiedName: "Tienda Demo",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.line.phoneNumberId).toBe("phone_999");
    expect(json.line.wabaId).toBe("waba_999");
  });

  it("elimina/desaprovisiona una línea con DELETE cuando existe", async () => {
    const { getCredentialsByPhoneNumberId, deleteCredentials } = await import(
      "@/server/whatsapp/credentials"
    );
    vi.mocked(getCredentialsByPhoneNumberId).mockResolvedValueOnce({
      id: "cred_1",
      organizationId: "org_test_123",
      wabaId: "waba_999",
      phoneNumberId: "phone_999",
      token: "tok",
      displayPhoneNumber: null,
      verifiedName: null,
      label: null,
      isDefault: true,
      aiEnabled: true,
      assistantId: null,
      signupMethod: "embedded_signup",
      status: "connected",
    });

    const req = new Request(
      "http://localhost/api/settings/whatsapp/provision?phoneNumberId=phone_999",
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${verifyToken}`,
        },
      }
    );

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.action).toBe("deleted");
    expect(deleteCredentials).toHaveBeenCalled();
  });

  it("responde 200 OK de forma resiliente si la línea no existe al hacer DELETE", async () => {
    const { getCredentialsByPhoneNumberId } = await import(
      "@/server/whatsapp/credentials"
    );
    vi.mocked(getCredentialsByPhoneNumberId).mockResolvedValueOnce(null);

    const req = new Request(
      "http://localhost/api/settings/whatsapp/provision?phoneNumberId=phone_inexistente",
      {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${verifyToken}`,
        },
      }
    );

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.action).toBe("noop");
  });

  it("actualiza la línea si ya existe en vez de duplicarla al hacer POST", async () => {
    const { getCredentialsByPhoneNumberId, saveCredentials } = await import(
      "@/server/whatsapp/credentials"
    );
    vi.mocked(getCredentialsByPhoneNumberId).mockResolvedValueOnce({
      id: "cred_existente",
      organizationId: "org_test_123",
      wabaId: "waba_999",
      phoneNumberId: "phone_existente",
      token: "tok_viejo",
      displayPhoneNumber: "+52 1 55 9999 0000",
      verifiedName: "Nombre Previo",
      label: "Mi Bot Ventas",
      isDefault: true,
      aiEnabled: true,
      assistantId: "asistente_configurado_123",
      signupMethod: "embedded_signup",
      status: "connected",
    });

    const req = new Request("http://localhost/api/settings/whatsapp/provision", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${verifyToken}`,
      },
      body: JSON.stringify({
        wabaId: "waba_999",
        phoneNumberId: "phone_existente",
        token: "tok_nuevo_renovado",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.action).toBe("updated");
    expect(saveCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumberId: "phone_existente",
        token: "tok_nuevo_renovado",
        assistantId: "asistente_configurado_123", // preservó el asistente previo
        label: "Mi Bot Ventas", // preservó el label previo
      })
    );
  });
});
