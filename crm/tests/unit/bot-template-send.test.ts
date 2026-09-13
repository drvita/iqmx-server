import { beforeAll, describe, expect, it, vi } from "vitest";

const BOT_KEY = "test-secret-bot-api-key-123456";

const mockTemplateApproved = {
  id: "tpl_approved_1",
  organizationId: "org_test",
  phoneNumberId: "phone_111",
  wabaId: "waba_alpha",
  name: "recordatorio_cita",
  language: "es_MX",
  category: "UTILITY",
  body: "Hola {{1}}, te recordamos tu cita el {{2}}.",
  status: "approved" as const,
  rejectionReason: null,
  waTemplateId: "wa_tpl_appr",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTemplatePending = {
  id: "tpl_pending_1",
  organizationId: "org_test",
  phoneNumberId: "phone_111",
  wabaId: "waba_alpha",
  name: "promo_black_friday",
  language: "es_MX",
  category: "MARKETING",
  body: "Hola {{1}}, gran descuento.",
  status: "pending" as const,
  rejectionReason: null,
  waTemplateId: "wa_tpl_pend",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockConversationActive = {
  id: "conv_active",
  organizationId: "org_test",
  contactId: "cnt_1",
  isTest: false,
  phoneNumberId: "phone_111",
  aiEnabled: true,
  handoffAt: null,
};

const mockConversationPaused = {
  id: "conv_paused",
  organizationId: "org_test",
  contactId: "cnt_2",
  isTest: false,
  phoneNumberId: "phone_111",
  aiEnabled: true,
  handoffAt: new Date(),
};

const sentTemplates: unknown[] = [];

vi.mock("@/server/bot/auth", () => ({
  requireBotKey: (req: Request) => {
    const key = req.headers.get("x-api-key");
    if (!key || key !== BOT_KEY) {
      return new Response(JSON.stringify({ error: { message: "No autorizado" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    return null;
  },
  resolveInstanceOrg: async () => "org_test",
}));

vi.mock("@/server/whatsapp/templates", () => ({
  resolveApprovedTemplate: async (
    orgId: string,
    selector: { templateId?: string; templateName?: string; language?: string }
  ) => {
    if (selector.templateId === mockTemplateApproved.id) return mockTemplateApproved;
    if (selector.templateId === mockTemplatePending.id) {
      const { TemplateError } = await import("@/server/whatsapp/templates");
      throw new TemplateError("invalid", "La plantilla no está aprobada");
    }
    if (selector.templateName === "recordatorio_cita") return mockTemplateApproved;
    const { TemplateError } = await import("@/server/whatsapp/templates");
    throw new TemplateError("not_found", "Plantilla no encontrada");
  },
  sendTemplate: async (input: unknown) => {
    sentTemplates.push(input);
    return { messageId: "msg_sent_123" };
  },
  TemplateError: class TemplateError extends Error {
    code: string;
    constructor(code: string, msg: string) {
      super(msg);
      this.code = code;
    }
  },
  templateErrorStatus: (err: { code: string }) => {
    if (err.code === "not_found") return 404;
    if (err.code === "invalid") return 422;
    return 500;
  },
}));

vi.mock("@/server/inbox/ingest", () => ({
  getOrCreateContact: async () => ({
    contact: { id: "cnt_phone", phone: "+5215512345678" },
    created: true,
  }),
  getOrCreateConversation: async () => ({
    id: "conv_phone_created",
    organizationId: "org_test",
    contactId: "cnt_phone",
  }),
}));

vi.mock("@/server/contacts", () => ({
  getContactById: async (orgId: string, id: string) => {
    if (id === "cnt_1") return { id: "cnt_1", phone: "+5215511111111" };
    return null;
  },
}));

vi.mock("@/server/inbox/send", () => ({
  sendText: async () => ({ messageId: "msg_text_123" }),
  SendError: class SendError extends Error {
    code = "meta_error";
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: (n: number) => {
            return Promise.resolve([mockConversationActive]);
          },
        }),
      }),
    }),
  }),
  schema: {
    conversation: {
      id: "id",
      organizationId: "organization_id",
      aiEnabled: "ai_enabled",
      handoffAt: "handoff_at",
    },
    template: {},
  },
}));

beforeAll(() => {
  process.env.APP_BASE_URL = "http://localhost:3000";
  process.env.DATABASE_URL = "postgresql://t:t@localhost:5432/t";
  process.env.BOT_API_KEY = BOT_KEY;
});

describe("Envío de Plantillas desde Cerebro Externo (/api/bot/*)", () => {
  it("rechaza peticiones sin X-API-Key con 401", async () => {
    const { POST } = await import("@/app/api/bot/messages/template/route");
    const req = new Request("http://localhost/api/bot/messages/template", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: "conv_1", templateId: "tpl_1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rechaza si falta destino (conversationId, contactId o phone) con 422", async () => {
    const { POST } = await import("@/app/api/bot/messages/template/route");
    const req = new Request("http://localhost/api/bot/messages/template", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": BOT_KEY,
      },
      body: JSON.stringify({ templateId: "tpl_approved_1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.message).toMatch(/al menos un destino/);
  });

  it("rechaza si falta plantilla (templateId o templateName) con 422", async () => {
    const { POST } = await import("@/app/api/bot/messages/template/route");
    const req = new Request("http://localhost/api/bot/messages/template", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": BOT_KEY,
      },
      body: JSON.stringify({ conversationId: "conv_active" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.message).toMatch(/templateId.*templateName/);
  });

  it("rechaza si la plantilla existe pero no está aprobada (ej. pending)", async () => {
    const { POST } = await import("@/app/api/bot/messages/template/route");
    const req = new Request("http://localhost/api/bot/messages/template", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": BOT_KEY,
      },
      body: JSON.stringify({
        conversationId: "conv_active",
        templateId: mockTemplatePending.id,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.message).toMatch(/no está aprobada/);
  });

  it("envía exitosamente por conversationId usando templateId", async () => {
    sentTemplates.length = 0;
    const { POST } = await import("@/app/api/bot/messages/template/route");
    const req = new Request("http://localhost/api/bot/messages/template", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": BOT_KEY,
      },
      body: JSON.stringify({
        conversationId: "conv_active",
        templateId: mockTemplateApproved.id,
        variables: ["María", "Mañana a las 10 am"],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      ok: true,
      messageId: "msg_sent_123",
      conversationId: "conv_active",
      templateId: mockTemplateApproved.id,
    });
    expect(sentTemplates).toHaveLength(1);
    expect(sentTemplates[0]).toMatchObject({
      conversationId: "conv_active",
      templateId: mockTemplateApproved.id,
      variables: ["María", "Mañana a las 10 am"],
    });
  });

  it("envía exitosamente por teléfono (phone) resolviendo por templateName", async () => {
    sentTemplates.length = 0;
    const { POST } = await import("@/app/api/bot/messages/template/route");
    const req = new Request("http://localhost/api/bot/messages/template", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": BOT_KEY,
      },
      body: JSON.stringify({
        phone: "+5215512345678",
        templateName: "recordatorio_cita",
        variables: ["Carlos", "Viernes 4 pm"],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      ok: true,
      messageId: "msg_sent_123",
      conversationId: "conv_phone_created",
      templateId: mockTemplateApproved.id,
    });
    expect(sentTemplates).toHaveLength(1);
  });

  it("POST /api/bot/messages soporta polimórficamente el envío de plantillas", async () => {
    sentTemplates.length = 0;
    const { POST } = await import("@/app/api/bot/messages/route");
    const req = new Request("http://localhost/api/bot/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": BOT_KEY,
      },
      body: JSON.stringify({
        conversationId: "conv_active",
        templateName: "recordatorio_cita",
        variables: ["Alejandro", "Lunes 9 am"],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      ok: true,
      messageId: "msg_sent_123",
      conversationId: "conv_active",
    });
    expect(sentTemplates).toHaveLength(1);
  });
});
