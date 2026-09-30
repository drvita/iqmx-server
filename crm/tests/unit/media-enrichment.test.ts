import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/whatsapp/media", () => ({
  readMediaFile: vi.fn(),
}));

vi.mock("@/server/settings/service", () => ({
  getOrganizationSettings: vi.fn(),
  getDecryptedAiApiKey: vi.fn(),
}));

let mockDbAsset: any = null;
let mockDbUpdateSet: any = null;

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mockDbAsset ? [mockDbAsset] : []),
        }),
      }),
    }),
    update: () => ({
      set: (values: any) => {
        mockDbUpdateSet = values;
        return {
          where: () => Promise.resolve([values]),
        };
      },
    }),
  }),
  schema: {
    mediaAsset: { id: "media_asset.id" },
  },
}));

describe("media-enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAsset = null;
    mockDbUpdateSet = null;
  });

  it("retorna error no_model_configured si la org no tiene aiSttModel configurado", async () => {
    const { getOrganizationSettings } = await import("@/server/settings/service");
    (getOrganizationSettings as any).mockResolvedValue({
      aiSttModel: null,
    });

    mockDbAsset = {
      id: "ast_1",
      organizationId: "org_1",
      kind: "audio",
      mimeType: "audio/ogg",
    };

    const { enrichAudioMedia } = await import("@/server/ai/media-enrichment");
    const res = await enrichAudioMedia("org_1", "ast_1");

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("no_model_configured");
    }
  });

  it("transcribe audio exitosamente con Whisper y persiste en mediaAsset", async () => {
    const { getOrganizationSettings, getDecryptedAiApiKey } = await import(
      "@/server/settings/service"
    );
    const { readMediaFile } = await import("@/server/whatsapp/media");

    (getOrganizationSettings as any).mockResolvedValue({
      aiSttModel: "openai/whisper-1",
      aiBaseUrl: "https://openrouter.ai/api",
    });
    (getDecryptedAiApiKey as any).mockReturnValue("test_key");
    (readMediaFile as any).mockResolvedValue(Buffer.from("fake-audio-bytes"));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: "Hola, quisiera agendar una cita para mañana." }),
    } as any);

    mockDbAsset = {
      id: "ast_2",
      organizationId: "org_1",
      kind: "audio",
      mimeType: "audio/ogg",
      caption: null,
    };

    const { enrichAudioMedia } = await import("@/server/ai/media-enrichment");
    const res = await enrichAudioMedia("org_1", "ast_2");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.transcript).toBe("Hola, quisiera agendar una cita para mañana.");
    }
    expect(mockDbUpdateSet).toBeDefined();
    expect(mockDbUpdateSet.aiTranscript).toBe("Hola, quisiera agendar una cita para mañana.");
    expect(mockDbUpdateSet.caption).toBe("Hola, quisiera agendar una cita para mañana.");
  });

  it("describe imagen exitosamente con Gemini 2.5 Flash y persiste en mediaAsset", async () => {
    const { getOrganizationSettings, getDecryptedAiApiKey } = await import(
      "@/server/settings/service"
    );
    const { readMediaFile } = await import("@/server/whatsapp/media");

    (getOrganizationSettings as any).mockResolvedValue({
      aiVisionModel: "google/gemini-2.5-flash",
      aiBaseUrl: "https://openrouter.ai/api",
    });
    (getDecryptedAiApiKey as any).mockReturnValue("test_key");
    (readMediaFile as any).mockResolvedValue(Buffer.from("fake-image-bytes"));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Comprobante de transferencia bancaria por $1,500 MXN a nombre de Clínica Vital.",
            },
          },
        ],
      }),
    } as any);

    mockDbAsset = {
      id: "ast_3",
      organizationId: "org_1",
      kind: "image",
      mimeType: "image/jpeg",
    };

    const { enrichImageMedia } = await import("@/server/ai/media-enrichment");
    const res = await enrichImageMedia("org_1", "ast_3");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.description).toBe(
        "Comprobante de transferencia bancaria por $1,500 MXN a nombre de Clínica Vital."
      );
    }
    expect(mockDbUpdateSet).toBeDefined();
    expect(mockDbUpdateSet.aiDescription).toBe(
      "Comprobante de transferencia bancaria por $1,500 MXN a nombre de Clínica Vital."
    );
  });
});
