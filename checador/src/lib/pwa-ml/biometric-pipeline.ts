import {
  cosineSimilarity,
  type FaceDetection,
} from "./math-utils";
import {
  DEFAULT_PHASE0_THRESHOLDS,
  REQUIRED_PHASE0_MODELS,
} from "./model-manifest";
import {
  runArcFaceEmbedding,
  runMiniFasLiveness,
  runScrfdDetection,
  type InferenceSessionLike,
  type OrtModule,
} from "./onnx-runners";

export type CheckInType =
  | "entrada"
  | "salida"
  | "inicio_comida"
  | "fin_comida";

export type CheckInStatus =
  | "valido"
  | "rechazado_spoof"
  | "rechazado_desconocido"
  | "sin_rostro";

export interface EnrolledEmployeeVector {
  id: string;
  nombre: string;
  embedding: Float32Array;
}

export interface BiometricThresholds {
  umbralMatch: number;
  umbralLiveness: number;
}

export interface EngineInitStats {
  executionProvider: "webgpu" | "wasm";
  loadTimesMs: {
    detector: number;
    liveness: number;
    recognizer: number;
    total: number;
  };
}

export interface PipelineLatency {
  detectMs: number;
  livenessMs: number;
  recognizeMs: number;
  totalMs: number;
}

export interface CheckInEvaluationResult {
  estado: CheckInStatus;
  matchedEmployee: {
    id: string;
    nombre: string;
    similarity: number;
  } | null;
  livenessScore: number;
  spoofPaperScore: number;
  spoofScreenScore: number;
  matchConfidence: number;
  latency: PipelineLatency;
  detection: FaceDetection | null;
}

export interface EnrollmentExtractionResult {
  ok: boolean;
  embedding: Float32Array | null;
  livenessScore: number;
  detection: FaceDetection | null;
  latency: PipelineLatency;
  reason?: string;
}

export interface BenchmarkSummary {
  iterations: number;
  executionProvider: "webgpu" | "wasm";
  avgDetectMs: number;
  avgLivenessMs: number;
  avgRecognizeMs: number;
  avgTotalMs: number;
  minTotalMs: number;
  maxTotalMs: number;
  underTarget500Ms: boolean;
}

interface EngineState {
  ort: OrtModule;
  detector: InferenceSessionLike;
  liveness: InferenceSessionLike;
  recognizer: InferenceSessionLike;
  stats: EngineInitStats;
}

let cachedEngine: EngineState | null = null;
let initPromise: Promise<EngineState> | null = null;

async function createSessionWithFallback(
  ort: OrtModule,
  modelUrl: string
): Promise<{ session: InferenceSessionLike; provider: "webgpu" | "wasm" }> {
  const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  if (hasWebGpu) {
    try {
      const session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ["webgpu", "wasm"],
        graphOptimizationLevel: "all",
        logSeverityLevel: 3,
      });
      return { session, provider: "webgpu" };
    } catch {
      // Fallback explícito a WASM si WebGPU falla en este dispositivo/navegador
    }
  }

  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
    logSeverityLevel: 3,
  });
  return { session, provider: "wasm" };
}

export async function initBiometricEngine(): Promise<EngineInitStats> {
  if (cachedEngine) {
    return cachedEngine.stats;
  }
  if (initPromise) {
    const state = await initPromise;
    return state.stats;
  }

  initPromise = (async () => {
    const ort = (await import("onnxruntime-web")) as OrtModule;
    ort.env.logLevel = "error";
    ort.env.wasm.wasmPaths = "/ort/";
    if (typeof window !== "undefined" && !window.crossOriginIsolated) {
      ort.env.wasm.numThreads = 1;
    }

    const totalStart = performance.now();
    const detPath =
      REQUIRED_PHASE0_MODELS.find((m) => m.id === "face-detector")?.publicPath ??
      "/models/det_500m.onnx";
    const livePath =
      REQUIRED_PHASE0_MODELS.find((m) => m.id === "liveness-detector")
        ?.publicPath ?? "/models/2.7_80x80_MiniFASNetV2.onnx";
    const recPath =
      REQUIRED_PHASE0_MODELS.find((m) => m.id === "face-recognizer")
        ?.publicPath ?? "/models/w600k_mbf.onnx";

    const t0 = performance.now();
    const det = await createSessionWithFallback(ort, detPath);
    const detectorMs = performance.now() - t0;

    const t1 = performance.now();
    const live = await createSessionWithFallback(ort, livePath);
    const livenessMs = performance.now() - t1;

    const t2 = performance.now();
    const rec = await createSessionWithFallback(ort, recPath);
    const recognizerMs = performance.now() - t2;

    const totalMs = performance.now() - totalStart;
    const provider: "webgpu" | "wasm" =
      det.provider === "webgpu" &&
      live.provider === "webgpu" &&
      rec.provider === "webgpu"
        ? "webgpu"
        : "wasm";

    const state: EngineState = {
      ort,
      detector: det.session,
      liveness: live.session,
      recognizer: rec.session,
      stats: {
        executionProvider: provider,
        loadTimesMs: {
          detector: Math.round(detectorMs),
          liveness: Math.round(livenessMs),
          recognizer: Math.round(recognizerMs),
          total: Math.round(totalMs),
        },
      },
    };
    cachedEngine = state;
    return state;
  })();

  try {
    const state = await initPromise;
    return state.stats;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

async function getEngineState(): Promise<EngineState> {
  if (cachedEngine) return cachedEngine;
  await initBiometricEngine();
  if (!cachedEngine) {
    throw new Error("No se pudo inicializar el motor biométrico ONNX");
  }
  return cachedEngine;
}

export async function extractEmbeddingFromRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Promise<EnrollmentExtractionResult> {
  const { ort, detector, liveness, recognizer } = await getEngineState();
  const totalStart = performance.now();

  const tDet0 = performance.now();
  const detections = await runScrfdDetection(ort, detector, rgba, width, height);
  const detectMs = performance.now() - tDet0;

  const primaryFace = detections[0] ?? null;
  if (!primaryFace) {
    return {
      ok: false,
      embedding: null,
      livenessScore: 0,
      detection: null,
      latency: {
        detectMs: Math.round(detectMs),
        livenessMs: 0,
        recognizeMs: 0,
        totalMs: Math.round(performance.now() - totalStart),
      },
      reason: "No se detectó ningún rostro en la imagen.",
    };
  }

  const tLive0 = performance.now();
  const livenessResult = await runMiniFasLiveness(
    ort,
    liveness,
    rgba,
    width,
    height,
    primaryFace.bbox
  );
  const livenessMs = performance.now() - tLive0;

  const tRec0 = performance.now();
  const embedding = await runArcFaceEmbedding(
    ort,
    recognizer,
    rgba,
    width,
    height,
    primaryFace.landmarks
  );
  const recognizeMs = performance.now() - tRec0;

  return {
    ok: true,
    embedding,
    livenessScore: livenessResult.livenessScore,
    detection: primaryFace,
    latency: {
      detectMs: Math.round(detectMs),
      livenessMs: Math.round(livenessMs),
      recognizeMs: Math.round(recognizeMs),
      totalMs: Math.round(performance.now() - totalStart),
    },
  };
}

export async function evaluateCheckInFromRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  enrolledEmployees: readonly EnrolledEmployeeVector[],
  thresholds: BiometricThresholds = {
    umbralMatch: DEFAULT_PHASE0_THRESHOLDS.umbralMatch,
    umbralLiveness: DEFAULT_PHASE0_THRESHOLDS.umbralLiveness,
  }
): Promise<CheckInEvaluationResult> {
  const { ort, detector, liveness, recognizer } = await getEngineState();
  const totalStart = performance.now();

  const tDet0 = performance.now();
  const detections = await runScrfdDetection(ort, detector, rgba, width, height);
  const detectMs = performance.now() - tDet0;

  const primaryFace = detections[0] ?? null;
  if (!primaryFace) {
    return {
      estado: "sin_rostro",
      matchedEmployee: null,
      livenessScore: 0,
      spoofPaperScore: 0,
      spoofScreenScore: 0,
      matchConfidence: 0,
      latency: {
        detectMs: Math.round(detectMs),
        livenessMs: 0,
        recognizeMs: 0,
        totalMs: Math.round(performance.now() - totalStart),
      },
      detection: null,
    };
  }

  const tLive0 = performance.now();
  const livenessResult = await runMiniFasLiveness(
    ort,
    liveness,
    rgba,
    width,
    height,
    primaryFace.bbox
  );
  const livenessMs = performance.now() - tLive0;

  if (livenessResult.livenessScore < thresholds.umbralLiveness) {
    return {
      estado: "rechazado_spoof",
      matchedEmployee: null,
      livenessScore: livenessResult.livenessScore,
      spoofPaperScore: livenessResult.spoofPaperScore,
      spoofScreenScore: livenessResult.spoofScreenScore,
      matchConfidence: 0,
      latency: {
        detectMs: Math.round(detectMs),
        livenessMs: Math.round(livenessMs),
        recognizeMs: 0,
        totalMs: Math.round(performance.now() - totalStart),
      },
      detection: primaryFace,
    };
  }

  const tRec0 = performance.now();
  const probeEmbedding = await runArcFaceEmbedding(
    ort,
    recognizer,
    rgba,
    width,
    height,
    primaryFace.landmarks
  );
  const recognizeMs = performance.now() - tRec0;

  let bestEmployee: EnrolledEmployeeVector | null = null;
  let bestSimilarity = -1;

  for (const emp of enrolledEmployees) {
    const sim = cosineSimilarity(probeEmbedding, emp.embedding);
    if (sim > bestSimilarity) {
      bestSimilarity = sim;
      bestEmployee = emp;
    }
  }

  const normalizedBest = Math.max(0, bestSimilarity);
  const totalMs = performance.now() - totalStart;

  if (!bestEmployee || normalizedBest < thresholds.umbralMatch) {
    return {
      estado: "rechazado_desconocido",
      matchedEmployee: null,
      livenessScore: livenessResult.livenessScore,
      spoofPaperScore: livenessResult.spoofPaperScore,
      spoofScreenScore: livenessResult.spoofScreenScore,
      matchConfidence: normalizedBest,
      latency: {
        detectMs: Math.round(detectMs),
        livenessMs: Math.round(livenessMs),
        recognizeMs: Math.round(recognizeMs),
        totalMs: Math.round(totalMs),
      },
      detection: primaryFace,
    };
  }

  return {
    estado: "valido",
    matchedEmployee: {
      id: bestEmployee.id,
      nombre: bestEmployee.nombre,
      similarity: normalizedBest,
    },
    livenessScore: livenessResult.livenessScore,
    spoofPaperScore: livenessResult.spoofPaperScore,
    spoofScreenScore: livenessResult.spoofScreenScore,
    matchConfidence: normalizedBest,
    latency: {
      detectMs: Math.round(detectMs),
      livenessMs: Math.round(livenessMs),
      recognizeMs: Math.round(recognizeMs),
      totalMs: Math.round(totalMs),
    },
    detection: primaryFace,
  };
}

/**
 * Ejecuta inferencia real sobre las 3 sesiones ONNX para medir latencia del hardware actual.
 */
export async function runSyntheticBenchmark(
  iterations = 5
): Promise<BenchmarkSummary> {
  const { ort, detector, liveness, recognizer, stats } = await getEngineState();
  const safeIters = Math.max(1, Math.min(iterations, 20));

  const dummyWidth = 320;
  const dummyHeight = 320;
  const dummyRgba = new Uint8ClampedArray(dummyWidth * dummyHeight * 4);
  for (let i = 0; i < dummyRgba.length; i += 4) {
    dummyRgba[i] = 180;
    dummyRgba[i + 1] = 150;
    dummyRgba[i + 2] = 135;
    dummyRgba[i + 3] = 255;
  }

  const syntheticBox = { x1: 80, y1: 60, x2: 240, y2: 260 };
  const syntheticLandmarks = [
    { x: 120, y: 120 },
    { x: 200, y: 120 },
    { x: 160, y: 160 },
    { x: 130, y: 210 },
    { x: 190, y: 210 },
  ] as const;

  let sumDet = 0;
  let sumLive = 0;
  let sumRec = 0;
  const totals: number[] = [];

  for (let i = 0; i < safeIters; i++) {
    const t0 = performance.now();
    await runScrfdDetection(ort, detector, dummyRgba, dummyWidth, dummyHeight, 0.9);
    const dMs = performance.now() - t0;

    const t1 = performance.now();
    await runMiniFasLiveness(ort, liveness, dummyRgba, dummyWidth, dummyHeight, syntheticBox);
    const lMs = performance.now() - t1;

    const t2 = performance.now();
    await runArcFaceEmbedding(ort, recognizer, dummyRgba, dummyWidth, dummyHeight, syntheticLandmarks);
    const rMs = performance.now() - t2;

    const tot = dMs + lMs + rMs;
    sumDet += dMs;
    sumLive += lMs;
    sumRec += rMs;
    totals.push(tot);
  }

  const avgTotalMs = totals.reduce((a, b) => a + b, 0) / safeIters;
  return {
    iterations: safeIters,
    executionProvider: stats.executionProvider,
    avgDetectMs: Math.round(sumDet / safeIters),
    avgLivenessMs: Math.round(sumLive / safeIters),
    avgRecognizeMs: Math.round(sumRec / safeIters),
    avgTotalMs: Math.round(avgTotalMs),
    minTotalMs: Math.round(Math.min(...totals)),
    maxTotalMs: Math.round(Math.max(...totals)),
    underTarget500Ms: avgTotalMs < DEFAULT_PHASE0_THRESHOLDS.targetLatencyMs,
  };
}
