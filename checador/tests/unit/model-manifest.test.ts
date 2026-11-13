import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHASE0_THRESHOLDS,
  REQUIRED_PHASE0_MODELS,
  validateModelManifest,
} from "@/lib/pwa-ml/model-manifest";

describe("model-manifest (Fase 0)", () => {
  it("define los 3 modelos exactos requeridos y los umbrales base", () => {
    expect(REQUIRED_PHASE0_MODELS.map((m) => m.filename)).toEqual([
      "det_500m.onnx",
      "2.7_80x80_MiniFASNetV2.onnx",
      "w600k_mbf.onnx",
    ]);
    expect(DEFAULT_PHASE0_THRESHOLDS.umbralMatch).toBe(0.6);
    expect(DEFAULT_PHASE0_THRESHOLDS.umbralLiveness).toBe(0.8);
    expect(DEFAULT_PHASE0_THRESHOLDS.modeloIaVersion).toBe("buffalo_s_v1");
  });

  it("valida correctamente un manifiesto completo", () => {
    const validManifest = {
      version: "buffalo_s_v1",
      generatedAt: "2026-11-13T14:00:00.000Z",
      ortFiles: ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"],
      models: REQUIRED_PHASE0_MODELS.map((spec) => ({
        id: spec.id,
        filename: spec.filename,
        stage: spec.stage,
        sizeBytes: 2_500_000,
        sha256: "a".repeat(64),
        sourceUrl: "https://example.com/model.onnx",
        ready: true,
      })),
    };

    const result = validateModelManifest(validManifest);
    expect(result.ready).toBe(true);
    expect(result.missingModels).toEqual([]);
    expect(result.ortRuntimeReady).toBe(true);
    expect(result.totalBytes).toBe(7_500_000);
    expect(result.errors).toEqual([]);
  });

  it("detecta modelos faltantes o ausencia de WASM", () => {
    const incompleteManifest = {
      version: "buffalo_s_v1",
      generatedAt: "2026-11-13T14:00:00.000Z",
      ortFiles: [],
      models: [
        {
          id: "face-detector",
          filename: "det_500m.onnx",
          stage: "Detección",
          sizeBytes: 2_000_000,
          sha256: "b".repeat(64),
          sourceUrl: "local-cache",
          ready: true,
        },
      ],
    };

    const result = validateModelManifest(incompleteManifest);
    expect(result.ready).toBe(false);
    expect(result.missingModels).toEqual([
      "2.7_80x80_MiniFASNetV2.onnx",
      "w600k_mbf.onnx",
    ]);
    expect(result.ortRuntimeReady).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
