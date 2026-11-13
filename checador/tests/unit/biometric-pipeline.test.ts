import fs from "node:fs";
import path from "node:path";
import * as ort from "onnxruntime-web";
import { describe, expect, it } from "vitest";
import {
  ARCFACE_DST_LANDMARKS,
  cosineSimilarity,
  estimateAffineTransform112,
  l2Normalize,
  nonMaximumSuppression,
  softmax,
  type FaceDetection,
} from "@/lib/pwa-ml/math-utils";
import {
  runArcFaceEmbedding,
  runMiniFasLiveness,
  runScrfdDetection,
  type OrtModule,
} from "@/lib/pwa-ml/onnx-runners";

function loadModelBuffer(filename: string): Uint8Array {
  const fullPath = path.resolve(
    import.meta.dirname,
    "../../public/models",
    filename
  );
  return new Uint8Array(fs.readFileSync(fullPath));
}

describe("biometric math utils", () => {
  it("normaliza vectores L2 y calcula similitud coseno exacta", () => {
    const a = l2Normalize(new Float32Array([3, 4]));
    expect(a[0]).toBeCloseTo(0.6, 5);
    expect(a[1]).toBeCloseTo(0.8, 5);

    const norm = Math.hypot(a[0] ?? 0, a[1] ?? 0);
    expect(norm).toBeCloseTo(1.0, 5);

    const orthogonal = l2Normalize(new Float32Array([-4, 3]));
    expect(cosineSimilarity(a, a)).toBeCloseTo(1.0, 5);
    expect(cosineSimilarity(a, orthogonal)).toBeCloseTo(0.0, 5);
  });

  it("calcula softmax estable sumando 1.0", () => {
    const probs = softmax([-1.89, 0.41, 1.49]);
    const sum = (probs[0] ?? 0) + (probs[1] ?? 0) + (probs[2] ?? 0);
    expect(sum).toBeCloseTo(1.0, 5);
    expect(probs[2]).toBeGreaterThan(probs[1] ?? 0);
  });

  it("genera la matriz identidad cuando los 5 landmarks ya coinciden con ArcFace 112x112", () => {
    const matrix = estimateAffineTransform112(ARCFACE_DST_LANDMARKS);
    expect(matrix[0]).toBeCloseTo(1, 4);
    expect(matrix[1]).toBeCloseTo(0, 4);
    expect(matrix[2]).toBeCloseTo(0, 4);
    expect(matrix[3]).toBeCloseTo(0, 4);
    expect(matrix[4]).toBeCloseTo(1, 4);
    expect(matrix[5]).toBeCloseTo(0, 4);
  });

  it("aplica NMS descartando cajas solapadas con IoU > 0.4", () => {
    const dummyKps: FaceDetection["landmarks"] = [
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 15, y: 15 },
      { x: 12, y: 20 },
      { x: 18, y: 20 },
    ];
    const detections: FaceDetection[] = [
      {
        bbox: { x1: 0, y1: 0, x2: 100, y2: 100 },
        score: 0.95,
        landmarks: dummyKps,
      },
      {
        bbox: { x1: 5, y1: 5, x2: 102, y2: 102 },
        score: 0.85,
        landmarks: dummyKps,
      },
      {
        bbox: { x1: 200, y1: 200, x2: 300, y2: 300 },
        score: 0.8,
        landmarks: dummyKps,
      },
    ];

    const kept = nonMaximumSuppression(detections, 0.4);
    expect(kept).toHaveLength(2);
    expect(kept[0]?.score).toBe(0.95);
    expect(kept[1]?.score).toBe(0.8);
  });
});

describe("integración real ONNX (3 modelos Fase 0)", () => {
  it("ejecuta SCRFD, MiniFASNetV2 y MobileFaceNet 512d reales en < 500 ms", async () => {
    const ortModule = ort as unknown as OrtModule;

    const detSession = await ort.InferenceSession.create(
      loadModelBuffer("det_500m.onnx")
    );
    const liveSession = await ort.InferenceSession.create(
      loadModelBuffer("2.7_80x80_MiniFASNetV2.onnx")
    );
    const recSession = await ort.InferenceSession.create(
      loadModelBuffer("w600k_mbf.onnx")
    );

    const width = 320;
    const height = 320;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 170;
      rgba[i + 1] = 140;
      rgba[i + 2] = 125;
      rgba[i + 3] = 255;
    }

    const tStart = performance.now();

    const detections = await runScrfdDetection(
      ortModule,
      detSession,
      rgba,
      width,
      height,
      0.5
    );
    expect(Array.isArray(detections)).toBe(true);

    const liveness = await runMiniFasLiveness(
      ortModule,
      liveSession,
      rgba,
      width,
      height,
      { x1: 80, y1: 60, x2: 240, y2: 260 }
    );
    expect(liveness.livenessScore).toBeGreaterThanOrEqual(0);
    expect(liveness.livenessScore).toBeLessThanOrEqual(1);

    const embedding = await runArcFaceEmbedding(
      ortModule,
      recSession,
      rgba,
      width,
      height,
      ARCFACE_DST_LANDMARKS
    );
    const elapsedMs = performance.now() - tStart;

    expect(embedding).toBeInstanceOf(Float32Array);
    expect(embedding.length).toBe(512);

    let normSq = 0;
    for (let i = 0; i < embedding.length; i++) {
      const val = embedding[i] ?? 0;
      normSq += val * val;
    }
    expect(Math.sqrt(normSq)).toBeCloseTo(1.0, 4);
    expect(elapsedMs).toBeLessThan(500);

    console.info(
      `[Fase 0 ONNX Test] Inferencia completa (3 modelos reales): ${elapsedMs.toFixed(1)} ms`
    );
  });
});
