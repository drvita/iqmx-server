import type { z } from "zod";
import { getEnv, isAiConfigured } from "@/lib/env";

/**
 * Adaptador LLM OpenRouter-compatible — ÚNICA frontera con el proveedor de IA
 * (Constitución II). Regla operativa: la salida del modelo es impredecible;
 * todo consumo pasa por extracción robusta + Zod + reintentos, y un hipo del
 * proveedor jamás propaga excepción (resultado `error` tipado).
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatJsonResult<T> =
  | { ok: true; data: T; raw: string }
  | { ok: false; error: "not_configured" | "provider_error" | "invalid_output"; detail: string };

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

export async function chatJson<T>(
  schema: z.ZodType<T>,
  messages: ChatMessage[],
  opts?: { model?: string; judge?: boolean; timeoutMs?: number; organizationId?: string }
): Promise<ChatJsonResult<T>> {
  let token: string | null = null;
  let baseUrl: string | null = null;
  let resolvedModel: string | undefined = opts?.model;

  if (opts?.organizationId) {
    const { getOrganizationSettings, getDecryptedAiApiKey } = await import(
      "@/server/settings/service"
    );
    const settings = await getOrganizationSettings(opts.organizationId);
    if (!settings.aiEnabled) {
      return {
        ok: false,
        error: "not_configured",
        detail: "El asistente de IA no está habilitado para esta organización.",
      };
    }
    token = getDecryptedAiApiKey(settings);
    baseUrl = settings.aiBaseUrl || "https://openrouter.ai/api";
    if (!resolvedModel) {
      resolvedModel = opts?.judge
        ? (settings.aiJudgeModel || settings.aiModel || undefined)
        : (settings.aiModel || undefined);
    }
  }

  // Fallback para entornos de test unitario o llamadas directas
  if (!token) {
    token = process.env.OPENROUTER_API_TOKEN || null;
  }
  if (!baseUrl) {
    baseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api";
  }
  if (!resolvedModel) {
    resolvedModel = opts?.judge
      ? (process.env.OPENROUTER_JUDGE_MODEL ?? process.env.OPENROUTER_MODEL)
      : process.env.OPENROUTER_MODEL;
  }

  if (!token?.trim()) {
    return {
      ok: false,
      error: "not_configured",
      detail: "Sin OPENROUTER_API_TOKEN configurado para esta organización.",
    };
  }

  const model = resolvedModel;
  if (!model?.trim()) {
    return {
      ok: false,
      error: "not_configured",
      detail: "Sin modelo de IA configurado.",
    };
  }

  let lastDetail = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const attemptMessages: ChatMessage[] =
      attempt === 1
        ? messages
        : [
            ...messages,
            {
              role: "system",
              content:
                "STRICT: tu respuesta anterior no fue JSON válido según el esquema. Responde ÚNICAMENTE el objeto JSON, sin explicaciones ni markdown.",
            },
          ];
    try {
      const raw = await callProvider(
        model,
        attemptMessages,
        opts?.timeoutMs,
        token,
        baseUrl
      );
      const extracted = extractJson(raw);
      if (extracted === null) {
        lastDetail = `sin JSON extraíble (raw=${truncate(raw)})`;
        continue;
      }
      const parsed = schema.safeParse(extracted);
      if (!parsed.success) {
        lastDetail = `no cumple el esquema: ${parsed.error.issues
          .map((i) => i.path.join(".") + " " + i.message)
          .join("; ")} (raw=${truncate(raw)})`;
        continue;
      }
      return { ok: true, data: parsed.data, raw };
    } catch (err) {
      lastDetail = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  return {
    ok: false,
    error: lastDetail.includes("esquema") || lastDetail.includes("JSON")
      ? "invalid_output"
      : "provider_error",
    detail: lastDetail,
  };
}

async function callProvider(
  model: string,
  messages: ChatMessage[],
  timeoutMs = 60_000,
  token?: string | null,
  baseUrl?: string | null
): Promise<string> {
  const env = getEnv();
  const effectiveBaseUrl = baseUrl || env.OPENROUTER_BASE_URL;
  const effectiveToken = token || env.OPENROUTER_API_TOKEN;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${effectiveBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        // El token jamás se loguea; solo viaja en este header.
        Authorization: `Bearer ${effectiveToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`proveedor respondió ${res.status}: ${truncate(text)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new Error("respuesta del proveedor sin contenido");
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extracción robusta de JSON de una respuesta de modelo:
 * 1) bloque ```json ... ``` (o ``` ... ```), 2) el texto completo,
 * 3) del primer `{` al último `}`.
 */
export function extractJson(raw: string): unknown | null {
  const candidates: string[] = [];
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());
  candidates.push(raw.trim());
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last > first) {
    candidates.push(raw.slice(first, last + 1));
  }
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      // siguiente candidato
    }
  }
  return null;
}

function truncate(s: string, n = 300): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
