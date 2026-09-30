import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type CachedCategorizedModels = {
  timestamp: number;
  models: OpenRouterModelItem[];
  sttModels: OpenRouterModelItem[];
  visionModels: OpenRouterModelItem[];
};

export type OpenRouterModelItem = {
  id: string;
  name: string;
  isFree: boolean;
  contextLength?: number;
};

let cache: CachedCategorizedModels | null = null;
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

const FALLBACK_STT_MODELS: OpenRouterModelItem[] = [
  { id: "openai/whisper-large-v3-turbo", name: "OpenAI: Whisper Large V3 Turbo", isFree: false },
  { id: "openai/whisper-large-v3", name: "OpenAI: Whisper Large V3", isFree: false },
  { id: "openai/whisper-1", name: "OpenAI: Whisper 1", isFree: false },
  { id: "openai/gpt-4o-mini-transcribe", name: "OpenAI: GPT-4o Mini Transcribe", isFree: false },
  { id: "mistralai/voxtral-mini-3b-2507", name: "Mistral: Voxtral Mini 3B", isFree: false },
  { id: "qwen/qwen3-asr-0.6b", name: "Qwen: Qwen3 ASR 0.6B", isFree: false },
  { id: "deepgram/nova-3", name: "Deepgram: Nova-3", isFree: false },
];

const FALLBACK_VISION_MODELS: OpenRouterModelItem[] = [
  { id: "google/gemini-2.5-flash", name: "Google: Gemini 2.5 Flash", isFree: false },
  { id: "google/gemini-2.5-flash-lite", name: "Google: Gemini 2.5 Flash Lite", isFree: false },
  { id: "openai/gpt-4o-mini", name: "OpenAI: GPT-4o Mini", isFree: false },
  { id: "anthropic/claude-3.5-sonnet", name: "Anthropic: Claude 3.5 Sonnet", isFree: false },
];

function parseAndSortModels(rawList: any[]): OpenRouterModelItem[] {
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

  parsed.sort((a, b) => {
    if (a.isFree && !b.isFree) return -1;
    if (!a.isFree && b.isFree) return 1;
    return a.name.localeCompare(b.name);
  });

  return parsed;
}

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      models: cache.models,
      sttModels: cache.sttModels,
      visionModels: cache.visionModels,
    });
  }

  try {
    const [resChat, resStt] = await Promise.all([
      fetch("https://openrouter.ai/api/v1/models", {
        headers: { "Content-Type": "application/json" },
        next: { revalidate: 3600 },
      }),
      fetch("https://openrouter.ai/api/v1/models?output_modalities=transcription", {
        headers: { "Content-Type": "application/json" },
        next: { revalidate: 3600 },
      }),
    ]);

    let chatData: any[] = [];
    if (resChat.ok) {
      const json = await resChat.json();
      chatData = Array.isArray(json?.data) ? json.data : [];
    }

    let sttData: any[] = [];
    if (resStt.ok) {
      const json = await resStt.json();
      sttData = Array.isArray(json?.data) ? json.data : [];
    }

    const allChatModels = parseAndSortModels(chatData.length > 0 ? chatData : FALLBACK_MODELS);
    
    // Modelos con capacidad de visión (input_modalities incluye 'image')
    const rawVision = chatData.filter((m) =>
      Array.isArray(m.architecture?.input_modalities) &&
      m.architecture.input_modalities.includes("image")
    );
    const visionModels = rawVision.length > 0
      ? parseAndSortModels(rawVision)
      : FALLBACK_VISION_MODELS;

    // Modelos de transcripción de audio (STT)
    const sttModels = sttData.length > 0
      ? parseAndSortModels(sttData)
      : FALLBACK_STT_MODELS;

    cache = {
      timestamp: now,
      models: allChatModels,
      sttModels,
      visionModels,
    };

    return NextResponse.json({
      models: allChatModels,
      sttModels,
      visionModels,
    });
  } catch (err) {
    console.error("[ai-models] Error obteniendo modelos de OpenRouter:", err);
    return NextResponse.json({
      models: cache?.models ?? FALLBACK_MODELS,
      sttModels: cache?.sttModels ?? FALLBACK_STT_MODELS,
      visionModels: cache?.visionModels ?? FALLBACK_VISION_MODELS,
    });
  }
}
