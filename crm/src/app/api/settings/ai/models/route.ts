import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type CachedModels = {
  timestamp: number;
  models: OpenRouterModelItem[];
};

export type OpenRouterModelItem = {
  id: string;
  name: string;
  isFree: boolean;
  contextLength?: number;
};

let cache: CachedModels | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

const FALLBACK_MODELS: OpenRouterModelItem[] = [
  { id: "google/gemma-4-31b-it:free", name: "Google: Gemma 4 31B (free)", isFree: true },
  { id: "minimax/minimax-m2.7:free", name: "MiniMax: MiniMax M2.7 (free)", isFree: true },
  { id: "liquid/lfm-2.5-2.6b:free", name: "LiquidAI: LFM2.5-2.6B (free)", isFree: true },
  { id: "anthropic/claude-3.5-sonnet", name: "Anthropic: Claude 3.5 Sonnet", isFree: false },
  { id: "openai/gpt-4o-mini", name: "OpenAI: GPT-4o Mini", isFree: false },
  { id: "deepseek/deepseek-chat", name: "DeepSeek: V3", isFree: false },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Meta: Llama 3.3 70B Instruct", isFree: false },
  { id: "google/gemini-2.0-flash-001", name: "Google: Gemini 2.0 Flash", isFree: false },
];

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ models: cache.models });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.warn("[ai-models] OpenRouter API status:", res.status);
      return NextResponse.json({ models: cache?.models ?? FALLBACK_MODELS });
    }

    const json = await res.json();
    const rawList: any[] = Array.isArray(json?.data) ? json.data : [];

    const parsed: OpenRouterModelItem[] = rawList.map((m) => {
      const isFree =
        m.id.includes(":free") ||
        (m.pricing && parseFloat(m.pricing.prompt || "1") === 0);
      return {
        id: m.id,
        name: m.name || m.id,
        isFree,
        contextLength: m.context_length,
      };
    });

    // Ordenar: primero los gratuitos, luego populares / reconocidos, luego por nombre
    parsed.sort((a, b) => {
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return a.name.localeCompare(b.name);
    });

    cache = {
      timestamp: now,
      models: parsed,
    };

    return NextResponse.json({ models: parsed });
  } catch (err) {
    console.error("[ai-models] Error obteniendo modelos de OpenRouter:", err);
    return NextResponse.json({ models: cache?.models ?? FALLBACK_MODELS });
  }
}
