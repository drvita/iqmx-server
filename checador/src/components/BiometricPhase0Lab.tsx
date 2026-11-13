"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Play,
  ShieldAlert,
  Trash2,
  Upload,
  UserPlus,
  Zap,
} from "lucide-react";
import {
  evaluateCheckInFromRgba,
  extractEmbeddingFromRgba,
  initBiometricEngine,
  runSyntheticBenchmark,
  type BenchmarkSummary,
  type CheckInEvaluationResult,
  type CheckInType,
  type EngineInitStats,
  type EnrolledEmployeeVector,
} from "@/lib/pwa-ml/biometric-pipeline";
import type { FaceDetection } from "@/lib/pwa-ml/math-utils";
import { DEFAULT_PHASE0_THRESHOLDS } from "@/lib/pwa-ml/model-manifest";

type CaptureSource = "camera" | "upload" | "demo";

interface TrialRecord {
  id: string;
  viewport: "Smartphone" | "Tablet" | "PC";
  tipo: CheckInType;
  fuente: CaptureSource;
  estado: CheckInEvaluationResult["estado"];
  livenessScore: number;
  matchConfidence: number;
  detectMs: number;
  livenessMs: number;
  recognizeMs: number;
  totalMs: number;
  empleadoNombre: string;
}

const CHECKIN_BUTTONS: readonly {
  type: CheckInType;
  label: string;
  accentClass: string;
}[] = [
  {
    type: "entrada",
    label: "Registrar Entrada",
    accentClass: "bg-[#059669] hover:bg-emerald-700 text-white",
  },
  {
    type: "salida",
    label: "Registrar Salida",
    accentClass: "bg-[#1e1b4b] hover:bg-indigo-950 text-white",
  },
  {
    type: "inicio_comida",
    label: "Inicio Comida",
    accentClass: "bg-[#4f46e5] hover:bg-indigo-700 text-white",
  },
  {
    type: "fin_comida",
    label: "Fin Comida",
    accentClass: "bg-slate-800 hover:bg-slate-900 text-white",
  },
] as const;

function getViewportLabel(): "Smartphone" | "Tablet" | "PC" {
  if (typeof window === "undefined") return "Smartphone";
  const w = window.innerWidth;
  if (w < 768) return "Smartphone";
  if (w < 1024) return "Tablet";
  return "PC";
}

function drawDemoPortrait(canvas: HTMLCanvasElement, variant: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = 480;
  canvas.height = 480;

  // Fondo neutro de oficina
  ctx.fillStyle = variant % 2 === 0 ? "#e2e8f0" : "#cbd5e1";
  ctx.fillRect(0, 0, 480, 480);

  // Hombros
  ctx.fillStyle = "#1e1b4b";
  ctx.beginPath();
  ctx.ellipse(240, 460, 145, 95, 0, Math.PI, 0);
  ctx.fill();

  // Rostro sintético con rasgos proporcionados
  ctx.fillStyle = variant % 2 === 0 ? "#e6b89c" : "#d9a07e";
  ctx.beginPath();
  ctx.ellipse(240, 225, 86, 112, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cabello
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.ellipse(240, 145, 88, 48, 0, Math.PI, 0);
  ctx.fill();

  // Ojos
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(204, 205, 9, 0, Math.PI * 2);
  ctx.arc(276, 205, 9, 0, Math.PI * 2);
  ctx.fill();

  // Cejas
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(186, 185);
  ctx.lineTo(222, 185);
  ctx.moveTo(258, 185);
  ctx.lineTo(294, 185);
  ctx.stroke();

  // Nariz
  ctx.strokeStyle = "#b47b5c";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(240, 208);
  ctx.lineTo(234, 248);
  ctx.lineTo(248, 252);
  ctx.stroke();

  // Boca
  ctx.strokeStyle = "#9f5848";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(240, 275, 24, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

function drawDetectionOverlay(
  canvas: HTMLCanvasElement,
  detection: FaceDetection | null
) {
  if (!detection) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { bbox, landmarks, score } = detection;
  ctx.strokeStyle = "#059669";
  ctx.lineWidth = 3;
  ctx.strokeRect(
    bbox.x1,
    bbox.y1,
    Math.max(1, bbox.x2 - bbox.x1),
    Math.max(1, bbox.y2 - bbox.y1)
  );

  ctx.fillStyle = "#059669";
  ctx.font = "600 13px sans-serif";
  ctx.fillText(
    `SCRFD ${(score * 100).toFixed(1)}%`,
    bbox.x1,
    Math.max(16, bbox.y1 - 6)
  );

  ctx.fillStyle = "#4f46e5";
  for (const pt of landmarks) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function BiometricPhase0Lab() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [engineStats, setEngineStats] = useState<EngineInitStats | null>(null);
  const [engineLoading, setEngineLoading] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  const [benchmark, setBenchmark] = useState<BenchmarkSummary | null>(null);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);

  const [source, setSource] = useState<CaptureSource>("upload");
  const [cameraActive, setCameraActive] = useState(false);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(
    null
  );

  const [employeeName, setEmployeeName] = useState("Roberto Méndez");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [enrolled, setEnrolled] = useState<EnrolledEmployeeVector[]>([]);

  const [umbralMatch, setUmbralMatch] = useState<number>(
    DEFAULT_PHASE0_THRESHOLDS.umbralMatch
  );
  const [umbralLiveness, setUmbralLiveness] = useState<number>(
    DEFAULT_PHASE0_THRESHOLDS.umbralLiveness
  );

  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CheckInEvaluationResult | null>(
    null
  );
  const [trials, setTrials] = useState<TrialRecord[]>([]);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (uploadedPreviewUrl) {
        URL.revokeObjectURL(uploadedPreviewUrl);
      }
    };
  }, [stopCamera, uploadedPreviewUrl]);

  const handleInitEngine = async () => {
    setEngineLoading(true);
    setEngineError(null);
    try {
      const stats = await initBiometricEngine();
      setEngineStats(stats);
      setStatusMessage(
        `Motor ONNX listo (${stats.executionProvider.toUpperCase()}) en ${stats.loadTimesMs.total} ms.`
      );
    } catch (error) {
      setEngineError(
        error instanceof Error
          ? error.message
          : "No se pudo cargar onnxruntime-web"
      );
    } finally {
      setEngineLoading(false);
    }
  };

  const handleRunBenchmark = async () => {
    setBenchmarkRunning(true);
    setEngineError(null);
    try {
      const stats = await initBiometricEngine();
      setEngineStats(stats);
      const summary = await runSyntheticBenchmark(5);
      setBenchmark(summary);
      setStatusMessage(
        `Benchmark completado: promedio ${summary.avgTotalMs} ms por checada.`
      );
    } catch (error) {
      setEngineError(
        error instanceof Error ? error.message : "Falló el benchmark ONNX"
      );
    } finally {
      setBenchmarkRunning(false);
    }
  };

  const handleStartCamera = async () => {
    setEngineError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setSource("camera");
    } catch (error) {
      setEngineError(
        error instanceof Error
          ? `No se pudo activar la cámara: ${error.message}`
          : "Cámara no disponible en este navegador/contexto"
      );
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (uploadedPreviewUrl) {
      URL.revokeObjectURL(uploadedPreviewUrl);
    }
    const url = URL.createObjectURL(file);
    setUploadedPreviewUrl(url);
    setSource("upload");
    stopCamera();

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth || 480;
      canvas.height = img.naturalHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
    };
    img.src = url;
  };

  const handleLoadDemoFace = (variant = 0) => {
    stopCamera();
    setSource("demo");
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawDemoPortrait(canvas, variant);
    setStatusMessage("Rostro demo renderizado en el visor de pruebas.");
  };

  const captureRgbaFromActiveSource = useCallback((): {
    rgba: Uint8ClampedArray;
    width: number;
    height: number;
  } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    if (source === "camera" && videoRef.current && cameraActive) {
      const video = videoRef.current;
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
    } else if (canvas.width === 0 || canvas.height === 0) {
      drawDemoPortrait(canvas, 0);
    }

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return {
      rgba: imgData.data,
      width: canvas.width,
      height: canvas.height,
    };
  }, [cameraActive, source]);

  const handleEnroll = async () => {
    if (!consentAccepted) {
      setStatusMessage(
        "Debes marcar el consentimiento biométrico (LFPDPPP) antes de extraer el vector."
      );
      return;
    }
    const trimmed = employeeName.trim();
    if (!trimmed) {
      setStatusMessage("Ingresa el nombre del empleado para enrolar.");
      return;
    }

    setProcessing(true);
    setEngineError(null);
    try {
      const stats = await initBiometricEngine();
      setEngineStats(stats);

      const frame = captureRgbaFromActiveSource();
      if (!frame) {
        setStatusMessage("No hay imagen disponible en el visor.");
        return;
      }

      const extraction = await extractEmbeddingFromRgba(
        frame.rgba,
        frame.width,
        frame.height
      );

      if (canvasRef.current && extraction.detection) {
        drawDetectionOverlay(canvasRef.current, extraction.detection);
      }

      if (!extraction.ok || !extraction.embedding) {
        setStatusMessage(
          extraction.reason ??
            "No se detectó rostro. Sube una fotografía frontal real o usa el rostro de prueba."
        );
        return;
      }

      const newEntry: EnrolledEmployeeVector = {
        id: crypto.randomUUID(),
        nombre: trimmed,
        embedding: extraction.embedding,
      };
      setEnrolled((prev) => [newEntry, ...prev]);
      setStatusMessage(
        `Enrolado "${trimmed}" (vector 512d extraído localmente en ${extraction.latency.totalMs} ms · Liveness ${(extraction.livenessScore * 100).toFixed(1)}%).`
      );
    } catch (error) {
      setEngineError(
        error instanceof Error ? error.message : "Error al enrolar rostro"
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckIn = async (tipo: CheckInType) => {
    setProcessing(true);
    setEngineError(null);
    try {
      const stats = await initBiometricEngine();
      setEngineStats(stats);

      const frame = captureRgbaFromActiveSource();
      if (!frame) return;

      const result = await evaluateCheckInFromRgba(
        frame.rgba,
        frame.width,
        frame.height,
        enrolled,
        { umbralMatch, umbralLiveness }
      );

      if (canvasRef.current && result.detection) {
        drawDetectionOverlay(canvasRef.current, result.detection);
      }

      setLastResult(result);

      const record: TrialRecord = {
        id: crypto.randomUUID(),
        viewport: getViewportLabel(),
        tipo,
        fuente: source,
        estado: result.estado,
        livenessScore: result.livenessScore,
        matchConfidence: result.matchConfidence,
        detectMs: result.latency.detectMs,
        livenessMs: result.latency.livenessMs,
        recognizeMs: result.latency.recognizeMs,
        totalMs: result.latency.totalMs,
        empleadoNombre: result.matchedEmployee?.nombre ?? "—",
      };
      setTrials((prev) => [record, ...prev]);
    } catch (error) {
      setEngineError(
        error instanceof Error ? error.message : "Error al ejecutar checada"
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyMarkdown = async () => {
    const header =
      "| Viewport | Tipo | Fuente | Estado | Detección (ms) | Liveness (ms) | ArcFace (ms) | Total (ms) | Liveness | Match |\n| :--- | :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: |";
    const rows = trials.map(
      (t) =>
        `| ${t.viewport} | ${t.tipo} | ${t.fuente} | ${t.estado} | ${t.detectMs} | ${t.livenessMs} | ${t.recognizeMs} | ${t.totalMs} | ${t.livenessScore.toFixed(2)} | ${t.matchConfidence.toFixed(2)} |`
    );
    await navigator.clipboard.writeText(`${header}\n${rows.join("\n")}`);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  return (
    <section className="mt-6 space-y-5">
      {/* Barra de control del motor ONNX */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1e1b4b]">
              Laboratorio Interactivo Fase 0 (100% Navegador)
            </h2>
            <p className="text-xs text-slate-600">
              Ejecuta SCRFD + MiniFASNetV2 + MobileFaceNet 512d localmente y
              calibra umbrales por viewport.
            </p>
          </div>

          <div className="flex flex-col gap-2 md:flex-row">
            <button
              type="button"
              onClick={handleInitEngine}
              disabled={engineLoading || benchmarkRunning}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Zap className="h-4 w-4" />
              {engineLoading
                ? "Cargando 3 modelos..."
                : engineStats
                  ? `Motor activo (${engineStats.executionProvider.toUpperCase()})`
                  : "Inicializar Motor ONNX"}
            </button>

            <button
              type="button"
              onClick={handleRunBenchmark}
              disabled={engineLoading || benchmarkRunning}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Play className="h-4 w-4 text-[#059669]" />
              {benchmarkRunning
                ? "Midiendo latencia..."
                : "Benchmark Latencia (5x)"}
            </button>
          </div>
        </div>

        {engineError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            {engineError}
          </div>
        )}

        {statusMessage && (
          <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3.5 py-2 text-xs text-[#1e1b4b]">
            {statusMessage}
          </div>
        )}

        {benchmark && (
          <div className="tnum mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-5">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">SCRFD Detección</p>
              <p className="text-sm font-bold text-slate-900">
                {benchmark.avgDetectMs} ms
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">MiniFASNetV2</p>
              <p className="text-sm font-bold text-slate-900">
                {benchmark.avgLivenessMs} ms
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">ArcFace 512d</p>
              <p className="text-sm font-bold text-slate-900">
                {benchmark.avgRecognizeMs} ms
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">Promedio Total</p>
              <p
                className={`text-sm font-bold ${
                  benchmark.underTarget500Ms
                    ? "text-[#059669]"
                    : "text-amber-600"
                }`}
              >
                {benchmark.avgTotalMs} ms
              </p>
            </div>
            <div className="col-span-2 rounded-xl bg-slate-50 p-3 md:col-span-1">
              <p className="text-[11px] text-slate-500">Meta &lt; 500 ms</p>
              <p className="text-sm font-bold text-slate-900">
                {benchmark.underTarget500Ms ? "Cumplida" : "Por calibrar"} (
                {benchmark.executionProvider.toUpperCase()})
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Grid principal: 1 col Smartphone, 2 cols Tablet, 12 cols PC */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-12">
        {/* Columna Visor + 4 Botones de Checada */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              Terminal de Prueba y Visor Biométrico
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={handleStartCamera}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  source === "camera" && cameraActive
                    ? "bg-[#1e1b4b] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                Cámara
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  source === "upload"
                    ? "bg-[#1e1b4b] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                Subir Foto
              </button>
              <button
                type="button"
                onClick={() => handleLoadDemoFace(0)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  source === "demo"
                    ? "bg-[#1e1b4b] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                Rostro Demo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`h-full w-full object-cover ${
                source === "camera" && cameraActive ? "block" : "hidden"
              }`}
            />
            <canvas
              ref={canvasRef}
              className={`h-full w-full object-contain ${
                source === "camera" && cameraActive ? "hidden" : "block"
              }`}
            />
            {source !== "camera" && !uploadedPreviewUrl && (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                <span className="rounded-full bg-slate-900/75 px-3 py-1 text-[11px] text-white">
                  Sube una foto real/pantalla o activa la cámara para probar
                </span>
              </div>
            )}
          </div>

          {/* 4 botones explícitos de asistencia (Mobile-First: 2x2 táctiles) */}
          <div className="grid grid-cols-2 gap-2.5">
            {CHECKIN_BUTTONS.map((btn) => (
              <button
                key={btn.type}
                type="button"
                disabled={processing}
                onClick={() => handleCheckIn(btn.type)}
                className={`rounded-xl px-3 py-3 text-xs font-semibold shadow-xs transition disabled:opacity-50 md:text-sm ${btn.accentClass}`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Resultado de la última evaluación */}
          {lastResult && (
            <div
              className={`rounded-xl border p-3.5 ${
                lastResult.estado === "valido"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {lastResult.estado === "valido" ? (
                    <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-900">
                    {lastResult.estado}
                  </span>
                </div>
                <span className="tnum text-xs font-semibold text-slate-700">
                  {lastResult.latency.totalMs} ms
                </span>
              </div>
              <p className="tnum mt-1.5 text-xs text-slate-700">
                Empleado:{" "}
                <strong>
                  {lastResult.matchedEmployee?.nombre ?? "No identificado"}
                </strong>{" "}
                · Liveness:{" "}
                <strong>{(lastResult.livenessScore * 100).toFixed(1)}%</strong>{" "}
                · Match:{" "}
                <strong>{(lastResult.matchConfidence * 100).toFixed(1)}%</strong>
              </p>
            </div>
          )}
        </div>

        {/* Columna Enrolamiento + Calibración */}
        <div className="space-y-4 lg:col-span-5">
          {/* Calibración */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">
              Calibración de Umbrales
            </h3>
            <div className="tnum mt-3 space-y-3 text-xs">
              <div>
                <div className="flex justify-between">
                  <label htmlFor="umbral-match" className="font-medium text-slate-700">
                    umbral_match (similitud coseno)
                  </label>
                  <strong className="text-[#4f46e5]">
                    {umbralMatch.toFixed(2)}
                  </strong>
                </div>
                <input
                  id="umbral-match"
                  type="range"
                  min={0.3}
                  max={0.9}
                  step={0.02}
                  value={umbralMatch}
                  onChange={(e) => setUmbralMatch(Number(e.target.value))}
                  className="mt-1 w-full accent-[#4f46e5]"
                />
              </div>

              <div>
                <div className="flex justify-between">
                  <label htmlFor="umbral-liveness" className="font-medium text-slate-700">
                    umbral_liveness (persona real)
                  </label>
                  <strong className="text-[#059669]">
                    {umbralLiveness.toFixed(2)}
                  </strong>
                </div>
                <input
                  id="umbral-liveness"
                  type="range"
                  min={0.3}
                  max={0.98}
                  step={0.02}
                  value={umbralLiveness}
                  onChange={(e) => setUmbralLiveness(Number(e.target.value))}
                  className="mt-1 w-full accent-[#059669]"
                />
              </div>
            </div>
          </div>

          {/* Enrolamiento local LFPDPPP */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">
              Enrolamiento Local de Prueba (512d)
            </h3>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Nombre completo del empleado"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#4f46e5] focus:outline-none"
              />

              <label className="flex items-start gap-2 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#4f46e5]"
                />
                <span>
                  Confirmo consentimiento biométrico (LFPDPPP). Solo se conserva
                  el vector 512d en memoria, sin subir fotos crudas.
                </span>
              </label>

              <button
                type="button"
                disabled={processing}
                onClick={handleEnroll}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                Extraer Vector 512d y Enrolar
              </button>

              {enrolled.length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {enrolled.map((emp) => (
                    <li
                      key={emp.id}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-slate-800">
                        {emp.nombre}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEnrolled((prev) =>
                            prev.filter((item) => item.id !== emp.id)
                          )
                        }
                        aria-label={`Eliminar ${emp.nombre}`}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla Comparativa de Resultados */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Tabla Comparativa de Calibración (Smartphone → Tablet → PC)
          </h3>
          {trials.length > 0 && (
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {copiedMarkdown ? (
                <ClipboardCheck className="h-3.5 w-3.5 text-[#059669]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedMarkdown ? "Tabla copiada" : "Copiar Tabla Markdown"}
            </button>
          )}
        </div>

        {trials.length === 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            Aún no hay registros. Ejecuta una checada con los botones de arriba
            para medir latencia y tasa de acierto/rechazo.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="tnum w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Viewport</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium">SCRFD</th>
                  <th className="py-2 pr-3 font-medium">Liveness</th>
                  <th className="py-2 pr-3 font-medium">ArcFace</th>
                  <th className="py-2 pr-3 font-medium">Total</th>
                  <th className="py-2 pr-3 font-medium">Liveness %</th>
                  <th className="py-2 font-medium">Match %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trials.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 pr-3 font-semibold text-slate-800">
                      {row.viewport}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{row.tipo}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          row.estado === "valido"
                            ? "bg-emerald-50 text-[#059669]"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {row.estado}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {row.detectMs} ms
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {row.livenessMs} ms
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {row.recognizeMs} ms
                    </td>
                    <td className="py-2 pr-3 font-semibold text-slate-900">
                      {row.totalMs} ms
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {(row.livenessScore * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 text-slate-700">
                      {(row.matchConfidence * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
