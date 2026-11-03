import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  graphRequest: vi.fn(),
  uploadGraphMedia: vi.fn(),
  saveMediaFile: vi.fn(),
  publish: vi.fn(),
  getCredentialsByOrg: vi.fn(),
  selectRows: [] as unknown[][],
  inserts: [] as { table: unknown; values: Record<string, unknown> }[],
}));

vi.mock("@/lib/meta/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/meta/client")>();
  return { ...original, graphRequest: h.graphRequest };
});

vi.mock("@/server/whatsapp/media", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/whatsapp/media")>();
  return {
    ...original,
    uploadGraphMedia: h.uploadGraphMedia,
    saveMediaFile: h.saveMediaFile,
    ensureAssetAvailable: vi.fn(async () => {}),
  };
});

vi.mock("@/server/events/bus", () => ({ publish: h.publish }));

vi.mock("@/server/whatsapp/credentials", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/server/whatsapp/credentials")>();
  return {
    ...original,
    getCredentialsByOrg: h.getCredentialsByOrg,
    getCredentialsByPhoneNumberId: vi.fn(async () => ({
      organizationId: "org_1",
    })),
  };
});

vi.mock("@/server/inbox/identity", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/inbox/identity")>();
  return {
    ...original,
    getOrCreateContactByIdentity: vi.fn(async () => ({
      contact: { id: "ct_1", channel: "whatsapp" },
    })),
  };
});

vi.mock("@/server/inbox/lead-activity", () => ({
  onLeadActivity: vi.fn(async () => {}),
}));
vi.mock("@/server/ai/trigger", () => ({ maybeRunAgentTurn: vi.fn(async () => {}) }));
vi.mock("@/server/ai/pipeline", () => ({ cancelAgentTurn: vi.fn() }));

function chain(result: () => unknown[]) {
  const c: Record<string, unknown> = {};
  for (const m of [
    "from",
    "innerJoin",
    "leftJoin",
    "where",
    "orderBy",
    "set",
    "onConflictDoNothing",
  ]) {
    c[m] = () => c;
  }
  c.limit = () => Promise.resolve(result());
  c.returning = () => Promise.resolve(result());
  c.then = (ok: (v: unknown[]) => unknown, ko?: (e: unknown) => unknown) =>
    Promise.resolve(result()).then(ok, ko);
  return c;
}

vi.mock("@/lib/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/db")>();
  let seq = 0;
  return {
    ...original,
    getDb: () => ({
      select: () => {
        const rows = h.selectRows.shift() ?? [];
        return chain(() => rows);
      },
      insert: (table: unknown) => {
        let values: Record<string, unknown> = {};
        const c = chain(() => [
          {
            createdAt: new Date("2026-10-21T12:00:00Z"),
            waTimestamp: null,
            error: null,
            aiGenerated: false,
            origin: "operator",
            mediaAssetId: null,
            replyToWaMessageId: null,
            ...values,
            id: values.id ?? `row_${++seq}`,
          },
        ]);
        c.values = (v: Record<string, unknown>) => {
          values = v;
          h.inserts.push({ table, values: v });
          return c;
        };
        return c;
      },
      update: () => chain(() => []),
    }),
  };
});

import { schema } from "@/lib/db";
import {
  aCitaDto,
  citaDelWebhook,
  conCita,
} from "@/server/inbox/quotes";

const insertsDeMensajes = () =>
  h.inserts.filter((i) => i.table === schema.message).map((i) => i.values);

beforeEach(() => {
  h.graphRequest.mockReset();
  h.uploadGraphMedia.mockReset();
  h.saveMediaFile.mockReset();
  h.publish.mockReset();
  h.getCredentialsByOrg.mockReset();
  h.selectRows.length = 0;
  h.inserts.length = 0;
});

describe("citaDelWebhook", () => {
  it("toma context.id", () => {
    expect(citaDelWebhook({ context: { from: "521", id: "wamid.A" } })).toBe(
      "wamid.A"
    );
  });

  it("sin context, sin id o vacío → null (reenviados y productos no son citas)", () => {
    expect(citaDelWebhook({})).toBeNull();
    expect(citaDelWebhook({ context: { from: "521" } })).toBeNull();
    expect(citaDelWebhook({ context: { id: "  " } })).toBeNull();
    expect(
      citaDelWebhook({ context: { id: 42 as unknown as string } })
    ).toBeNull();
  });
});

describe("conCita", () => {
  it("agrega context.message_id solo si hay a qué responder", () => {
    const base = { messaging_product: "whatsapp", type: "text" };
    expect(conCita(base, "wamid.A")).toEqual({
      ...base,
      context: { message_id: "wamid.A" },
    });
    expect(conCita(base, null)).toEqual(base);
    expect(conCita(base, undefined)).not.toHaveProperty("context");
  });
});

describe("aCitaDto", () => {
  it("original ausente → id null", () => {
    expect(aCitaDto(null)).toEqual({
      id: null,
      direction: null,
      type: null,
      text: null,
      mediaKind: null,
    });
  });

  it("recorta el texto largo y usa el pie de un adjunto", () => {
    const largo = "a".repeat(300);
    const dto = aCitaDto({
      message: { id: "msg_1", direction: "in", type: "text", text: largo } as never,
      media: null,
    });
    expect(dto.text).toHaveLength(201);
    expect(dto.text?.endsWith("…")).toBe(true);

    const foto = aCitaDto({
      message: { id: "msg_2", direction: "out", type: "image", text: null } as never,
      media: { kind: "image", caption: "taladro azul" } as never,
    });
    expect(foto).toMatchObject({ id: "msg_2", text: "taladro azul", mediaKind: "image" });
  });
});

function webhookValue(msg: Record<string, unknown>) {
  return {
    metadata: { phone_number_id: "pn_1" },
    contacts: [{ wa_id: "5215550001234", profile: { name: "Cliente" } }],
    messages: [
      {
        from: "5215550001234",
        id: "wamid.IN",
        timestamp: "1792600000",
        type: "text",
        text: { body: "¿y este en azul?" },
        ...msg,
      },
    ],
  };
}

describe("ingesta de WhatsApp con context", () => {
  it("guarda el wamid citado en reply_to_wa_message_id y lo publica resuelto", async () => {
    h.selectRows.push([
      {
        message: {
          id: "msg_orig",
          direction: "out",
          type: "image",
          text: null,
          waMessageId: "wamid.FOTO",
        },
        media: { kind: "image", caption: "Martillo de uña" },
      },
    ]);
    const { processMessagesValue } = await import("@/server/inbox/ingest");
    await processMessagesValue(
      webhookValue({ context: { from: "521", id: "wamid.FOTO" } }) as never
    );

    const [entrante] = insertsDeMensajes();
    expect(entrante).toMatchObject({
      waMessageId: "wamid.IN",
      direction: "in",
      replyToWaMessageId: "wamid.FOTO",
    });

    const nuevo = h.publish.mock.calls.find(
      ([, e]) => (e as { type: string }).type === "message.new"
    )?.[1] as { data: { message: { replyTo: unknown } } };
    expect(nuevo.data.message.replyTo).toEqual({
      id: "msg_orig",
      direction: "out",
      type: "image",
      text: "Martillo de uña",
      mediaKind: "image",
    });
  });

  it("sin context → reply_to_wa_message_id null y replyTo null", async () => {
    const { processMessagesValue } = await import("@/server/inbox/ingest");
    await processMessagesValue(webhookValue({}) as never);

    const [entrante] = insertsDeMensajes();
    expect(entrante?.replyToWaMessageId).toBeNull();
    const nuevo = h.publish.mock.calls.find(
      ([, e]) => (e as { type: string }).type === "message.new"
    )?.[1] as { data: { message: { replyTo: unknown } } };
    expect(nuevo.data.message.replyTo).toBeNull();
  });

  it("cita a un mensaje que no está en el CRM → se guarda y se enseña como no disponible", async () => {
    h.selectRows.push([]);
    const { processMessagesValue } = await import("@/server/inbox/ingest");
    await processMessagesValue(
      webhookValue({ context: { id: "wamid.VIEJO" } }) as never
    );
    expect(insertsDeMensajes()[0]?.replyToWaMessageId).toBe("wamid.VIEJO");
    const nuevo = h.publish.mock.calls.find(
      ([, e]) => (e as { type: string }).type === "message.new"
    )?.[1] as { data: { message: { replyTo: { id: unknown } } } };
    expect(nuevo.data.message.replyTo.id).toBeNull();
  });

  it("un eco de coexistence citado también guarda la cita", async () => {
    h.selectRows.push([]);
    const { processEchoesValue } = await import("@/server/inbox/ingest");
    await processEchoesValue({
      metadata: { phone_number_id: "pn_1" },
      message_echoes: [
        {
          to: "5215550001234",
          id: "wamid.ECO",
          timestamp: "1792600000",
          type: "text",
          text: { body: "sí, en azul" },
          context: { id: "wamid.IN" },
        },
      ],
    } as never);
    expect(insertsDeMensajes()[0]).toMatchObject({
      waMessageId: "wamid.ECO",
      origin: "manual",
      replyToWaMessageId: "wamid.IN",
    });
  });
});

const CONVERSACION_WA = {
  conversation: {
    id: "cv_1",
    organizationId: "org_1",
    isTest: false,
    channel: "whatsapp",
    lastInboundAt: new Date(),
    channelThreadRef: null,
  },
  contact: { id: "ct_1", phone: "5215550001234", waUserId: null, waIdentity: "5215550001234" },
};

const CITADO = {
  message: {
    id: "msg_in",
    conversationId: "cv_1",
    direction: "in",
    type: "text",
    text: "¿y este en azul?",
    waMessageId: "wamid.IN",
  },
  media: null,
};

function conectado() {
  h.getCredentialsByOrg.mockResolvedValue({
    organizationId: "org_1",
    phoneNumberId: "pn_1",
    token: "tok",
    status: "connected",
  });
  h.graphRequest.mockResolvedValue({ messages: [{ id: "wamid.OUT" }] });
}

describe("envío con context", () => {
  it("sendText citando → Graph recibe context.message_id y el saliente guarda la cita", async () => {
    conectado();
    h.selectRows.push([CONVERSACION_WA], [CITADO]);
    const { sendText } = await import("@/server/inbox/send");

    await sendText({
      conversationId: "cv_1",
      organizationId: "org_1",
      text: "Sí, lo tenemos",
      replyToMessageId: "msg_in",
    });

    const [, init] = h.graphRequest.mock.calls[0]!;
    expect(init.body).toMatchObject({
      type: "text",
      text: { body: "Sí, lo tenemos" },
      context: { message_id: "wamid.IN" },
    });
    expect(insertsDeMensajes()[0]).toMatchObject({
      waMessageId: "wamid.OUT",
      replyToWaMessageId: "wamid.IN",
    });
    const nuevo = h.publish.mock.calls[0]![1] as {
      data: { message: { replyTo: { id: string } } };
    };
    expect(nuevo.data.message.replyTo.id).toBe("msg_in");
  });

  it("sendText sin cita → sin context en el payload", async () => {
    conectado();
    h.selectRows.push([CONVERSACION_WA]);
    const { sendText } = await import("@/server/inbox/send");

    await sendText({ conversationId: "cv_1", organizationId: "org_1", text: "hola" });

    const [, init] = h.graphRequest.mock.calls[0]!;
    expect(init.body).not.toHaveProperty("context");
    expect(insertsDeMensajes()[0]?.replyToWaMessageId).toBeNull();
  });

  it("adjunto citando → context en el payload del adjunto", async () => {
    conectado();
    h.saveMediaFile.mockResolvedValue("org_1/asset.jpg");
    h.uploadGraphMedia.mockResolvedValue("media_1");
    h.selectRows.push([CONVERSACION_WA], [CITADO]);
    const { sendMediaMessage } = await import("@/server/inbox/send");

    await sendMediaMessage({
      conversationId: "cv_1",
      organizationId: "org_1",
      file: { data: Buffer.from("x"), mimeType: "image/jpeg" },
      replyToMessageId: "msg_in",
    });

    const [, init] = h.graphRequest.mock.calls[0]!;
    expect(init.body).toMatchObject({
      type: "image",
      image: { id: "media_1" },
      context: { message_id: "wamid.IN" },
    });
  });

  it("ubicación citando → context en el payload", async () => {
    conectado();
    h.selectRows.push([CONVERSACION_WA], [CITADO]);
    const { sendStructured } = await import("@/server/inbox/send");

    await sendStructured({
      conversationId: "cv_1",
      organizationId: "org_1",
      kind: "location",
      location: { latitude: 20.67, longitude: -103.35 },
      replyToMessageId: "msg_in",
    });

    const [, init] = h.graphRequest.mock.calls[0]!;
    expect(init.body).toMatchObject({
      type: "location",
      context: { message_id: "wamid.IN" },
    });
  });

  it("citar un mensaje de otra conversación → reply_unavailable sin llamar a Graph", async () => {
    conectado();
    h.selectRows.push([CONVERSACION_WA], []);
    const { sendText } = await import("@/server/inbox/send");

    await expect(
      sendText({
        conversationId: "cv_1",
        organizationId: "org_1",
        text: "hola",
        replyToMessageId: "msg_ajeno",
      })
    ).rejects.toMatchObject({ code: "reply_unavailable" });
    expect(h.graphRequest).not.toHaveBeenCalled();
  });

  it("citar un mensaje sin wamid (falló o es de pruebas) → reply_unavailable", async () => {
    conectado();
    h.selectRows.push(
      [CONVERSACION_WA],
      [
        {
          message: {
            id: "msg_fallido",
            conversationId: "cv_1",
            waMessageId: null,
          },
          media: null,
        },
      ]
    );
    const { sendText } = await import("@/server/inbox/send");

    await expect(
      sendText({
        conversationId: "cv_1",
        organizationId: "org_1",
        text: "hola",
        replyToMessageId: "msg_fallido",
      })
    ).rejects.toMatchObject({ code: "reply_unavailable" });
    expect(h.graphRequest).not.toHaveBeenCalled();
  });
});
