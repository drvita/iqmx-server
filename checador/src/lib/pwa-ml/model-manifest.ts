import { z } from "zod";

export const DEFAULT_PHASE0_THRESHOLDS = {
  umbralMatch: 0.6,
  umbralLiveness: 0.8,
  targetLatencyMs: 500,
  modeloIaVersion: "buffalo_s_v1",
} as const;

export interface RequiredModelSpec {
  id: "face-detector" | "liveness-detector" | "face-recognizer";
  filename: string;
  stage: string;
  publicPath: string;
}

export const REQUIRED_PHASE0_MODELS: readonly RequiredModelSpec[] = [
  {
    id: "face-detector",
    filename: "det_500m.onnx",
    stage: "Detección y 5 Landmarks (SCRFD buffalo_s)",
    publicPath: "/models/det_500m.onnx",
  },
  {
    id: "liveness-detector",
    filename: "2.7_80x80_MiniFASNetV2.onnx",
    stage: "Anti-Spoofing / Liveness (MiniFASNetV2)",
    publicPath: "/models/2.7_80x80_MiniFASNetV2.onnx",
  },
  {
    id: "face-recognizer",
    filename: "w600k_mbf.onnx",
    stage: "Reconocimiento 512d (MobileFaceNet buffalo_s)",
    publicPath: "/models/w600k_mbf.onnx",
  },
] as const;

const modelEntrySchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  stage: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().length(64),
  sourceUrl: z.string().min(1),
  ready: z.boolean(),
});

export const modelManifestSchema = z.object({
  version: z.string().min(1),
  generatedAt: z.string().min(1),
  ortFiles: z.array(z.string()),
  models: z.array(modelEntrySchema),
});

export type ModelManifest = z.infer<typeof modelManifestSchema>;

export interface ModelValidationSummary {
  ready: boolean;
  missingModels: string[];
  totalBytes: number;
  ortRuntimeReady: boolean;
  errors: string[];
}

/**
 * Valida que el manifiesto generado por scripts/download-models.mjs
 * contenga los 3 modelos .onnx requeridos para Fase 0 y los binarios WASM de ORT.
 */
export function validateModelManifest(input: unknown): ModelValidationSummary {
  const parsed = modelManifestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ready: false,
      missingModels: REQUIRED_PHASE0_MODELS.map((m) => m.filename),
      totalBytes: 0,
      ortRuntimeReady: false,
      errors: ["Manifiesto de modelos inválido o inexistente."],
    };
  }

  const manifest = parsed.data;
  const byFilename = new Map(manifest.models.map((m) => [m.filename, m]));
  const missingModels: string[] = [];
  const errors: string[] = [];
  let totalBytes = 0;

  for (const spec of REQUIRED_PHASE0_MODELS) {
    const entry = byFilename.get(spec.filename);
    if (!entry || !entry.ready) {
      missingModels.push(spec.filename);
      errors.push(`Modelo faltante o no listo: ${spec.filename}`);
      continue;
    }
    totalBytes += entry.sizeBytes;
  }

  const ortRuntimeReady = manifest.ortFiles.some((file) =>
    file.endsWith(".wasm")
  );
  if (!ortRuntimeReady) {
    errors.push("Faltan archivos .wasm de onnxruntime-web en public/ort/.");
  }

  return {
    ready: missingModels.length === 0 && ortRuntimeReady,
    missingModels,
    totalBytes,
    ortRuntimeReady,
    errors,
  };
}
