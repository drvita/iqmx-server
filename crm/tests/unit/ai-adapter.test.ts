import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { chatJson, extractJson } from "@/lib/ai";
import { _resetEnvForTesting } from "@/lib/env";

describe("extractJson (extracción robusta)", () => {
  it("JSON limpio", () => {
    expect(extractJson('{"action":"none"}')).toEqual({ action: "none" });
  });

  it("bloque ```json con texto alrededor", () => {
    const raw = 'Claro, aquí está:\n```json\n{"action":"reply","text":"hola"}\n```\nEspero que sirva.';
    expect(extractJson(raw)).toEqual({ action: "reply", text: "hola" });
  });

  it("JSON incrustado en prosa (primer { al último })", () => {
    const raw = 'La acción que tomaré es {"action":"handoff","reason":"cliente"} por lo dicho.';
    expect(extractJson(raw)).toEqual({ action: "handoff", reason: "cliente" });
  });

  it("sin JSON → null", () => {
    expect(extractJson("no tengo nada que decir")).toBeNull();
  });

  it("JSON con saltos de línea literales dentro de strings", () => {
    const raw = '{"action":"reply","text":"Línea 1\nLínea 2 con viñetas\n* Jugo 1"}';
    expect(extractJson(raw)).toEqual({
      action: "reply",
      text: "Línea 1\nLínea 2 con viñetas\n* Jugo 1",
    });
  });

  it("JSON con comas finales (trailing comma)", () => {
    const raw = '{"action":"reply","text":"hola",}';
    expect(extractJson(raw)).toEqual({ action: "reply", text: "hola" });
  });
});

describe("chatJson (reintentos y errores tipados)", () => {
  const schema = z.object({ action: z.literal("reply"), text: z.string() });

  beforeEach(() => {
    _resetEnvForTesting();
    vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", "postgresql://t:t@localhost:5432/t");
    vi.stubEnv("BETTER_AUTH_SECRET", "secret-de-test-suficiente");
    vi.stubEnv("ENCRYPTION_KEY", Buffer.alloc(32, 3).toString("base64"));
    vi.stubEnv("META_WEBHOOK_VERIFY_TOKEN", "verify-test");
    vi.stubEnv("OPENROUTER_API_TOKEN", "token-test");
    vi.stubEnv("OPENROUTER_MODEL", "modelo-test");
  });

  afterEach(() => {
    _resetEnvForTesting();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function providerResponse(content: string) {
    return new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }

  it("salida inválida al primer intento → reintenta con STRICT y triunfa", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(providerResponse("no soy json"))
      .mockResolvedValueOnce(providerResponse('{"action":"reply","text":"ok"}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatJson(schema, [{ role: "user", content: "hola" }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.text).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // el reintento agrega la instrucción STRICT
    const secondBody = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string);
    expect(JSON.stringify(secondBody.messages)).toContain("STRICT");
  });

  it("proveedor caído (500 persistente) → error tipado, jamás excepción", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response("boom", { status: 500 }))
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatJson(schema, [{ role: "user", content: "hola" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("provider_error");
    expect(fetchMock).toHaveBeenCalledTimes(3); // agotó los 3 intentos
  });

  it("salida que nunca cumple el esquema → invalid_output", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(providerResponse('{"action":"otra_cosa"}'))
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatJson(schema, [{ role: "user", content: "hola" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_output");
      expect(result.raw).toBe('{"action":"otra_cosa"}');
    }
  });

  it("envía response_format json_object al proveedor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(providerResponse('{"action":"reply","text":"ok"}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatJson(schema, [{ role: "user", content: "hola" }]);
    expect(result.ok).toBe(true);
    const firstBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(firstBody.response_format).toEqual({ type: "json_object" });
  });

  it("sin token → not_configured sin tocar la red", async () => {
    vi.stubEnv("OPENROUTER_API_TOKEN", "");
    _resetEnvForTesting();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatJson(schema, [{ role: "user", content: "hola" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Pipeline Helpers: formatAssistantHistoryMessage y extractConversationalText", () => {
  it("formatAssistantHistoryMessage envuelve texto en JSON reply", async () => {
    const { formatAssistantHistoryMessage } = await import(
      "@/server/ai/pipeline"
    );
    expect(formatAssistantHistoryMessage("Hola")).toBe(
      JSON.stringify({ action: "reply", text: "Hola" })
    );
    // Si ya era JSON, no lo re-envuelve
    const alreadyJson = '{"action":"reply","text":"Hola"}';
    expect(formatAssistantHistoryMessage(alreadyJson)).toBe(alreadyJson);
  });

  it("extractConversationalText rescata texto conversacional de salidas no estructuradas", async () => {
    const { extractConversationalText } = await import("@/server/ai/pipeline");
    const raw1 =
      "¡No te preocupes! Nuestras entregas son 100% garantizadas y puntuales en los horarios que elijas (8-10am o 6-8pm).";
    expect(extractConversationalText(raw1)).toBe(raw1);

    const rawMarkdown = "```\nClaro, tenemos tres sabores disponibles\n```";
    expect(extractConversationalText(rawMarkdown)).toBe(
      "Claro, tenemos tres sabores disponibles"
    );

    const brokenJson = '{"action":"reply","text":"Hola, ¿en qué puedo ayudarte?';
    expect(extractConversationalText(brokenJson)).toBe(
      "Hola, ¿en qué puedo ayudarte?"
    );

    // Objetos no conversacionales
    expect(extractConversationalText("{}")).toBeNull();
    expect(extractConversationalText("")).toBeNull();
  });
});
