"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  FileText,
  HelpCircle,
  Pencil,
  ScanFace,
  Trash2,
  Upload,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import {
  createEmployeeAction,
  toggleEmployeeActiveAction,
  updateEmployeeAction,
} from "@/actions/admin";
import { extractEmbeddingFromRgba } from "@/lib/pwa-ml/biometric-pipeline";
import {
  decodeImageFileToCanvas,
  selectFilesWithinLimit,
} from "@/lib/pwa-ml/image-loader";

interface EmployeeRow {
  id: string;
  codigoInterno: string | null;
  numeroEmpleado: string | null;
  nombreCompleto: string;
  puesto: string | null;
  departamento: string | null;
  sucursalId: string | null;
  horarioId: string | null;
  consentimientoBiometrico: boolean;
  activo: boolean;
  vectoresCount: number;
  documentosCount: number;
}

interface EmployeeDocItem {
  id: string;
  nombreArchivo: string;
  tipoDocumento: string;
  mimeType: string;
  tamanoBytes: number;
  subidoPorNombre: string | null;
  createdAt: string;
}

interface OptionItem {
  id: string;
  nombre: string;
}

interface EmployeesClientProps {
  employees: EmployeeRow[];
  branches: OptionItem[];
  schedules: OptionItem[];
  maxEmpleados: number;
}

export function EmployeesClient({
  employees,
  branches,
  schedules,
  maxEmpleados,
}: EmployeesClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [codigoInterno, setCodigoInterno] = useState("");
  const [numeroEmpleado, setNumeroEmpleado] = useState("");
  const [puesto, setPuesto] = useState("");
  const [sucursalId, setSucursalId] = useState(branches[0]?.id ?? "");
  const [horarioId, setHorarioId] = useState(schedules[0]?.id ?? "");
  const [consentimiento, setConsentimiento] = useState(false);

  const [vectors, setVectors] = useState<number[][]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    label: string;
  } | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "warn" | "error";
    text: string;
    details?: string[];
  } | null>(null);
  const [docsEmployee, setDocsEmployee] = useState<EmployeeRow | null>(null);
  const [docsList, setDocsList] = useState<EmployeeDocItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docType, setDocType] = useState("acuerdo_interno");
  const [docError, setDocError] = useState<string | null>(null);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    setCameraOn(false);
  };

  useEffect(() => {
    if (!cameraOn || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play().catch(() => {
      // Algunos navegadores ya inician con autoPlay + muted
    });
  }, [cameraOn]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop();
        streamRef.current = null;
      }
    };
  }, []);

  const handleToggleCamera = async () => {
    if (cameraOn) {
      stopCamera();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setFeedback({
        type: "error",
        text: "No se pudo acceder a la cámara del navegador.",
      });
    }
  };

  const extractFromCanvas = async (canvas: HTMLCanvasElement) => {
    if (vectors.length >= 3) {
      setFeedback({
        type: "error",
        text: "Máximo 3 capturas de rostro por colaborador.",
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const res = await extractEmbeddingFromRgba(
        imgData.data,
        canvas.width,
        canvas.height
      );
      if (!res.ok || !res.embedding) {
        setFeedback({
          type: "error",
          text: res.reason ?? "No se detectó rostro frontal en la captura.",
        });
        return;
      }
      setVectors((prev) => [...prev, Array.from(res.embedding!)]);
      setFeedback({
        type: "ok",
        text: `Rostro #${vectors.length + 1} capturado correctamente. La fotografía no se guarda por privacidad.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Error al procesar rostro.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCaptureFromCamera = async () => {
    const video = videoRef.current;
    if (!video || !cameraOn) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    await extractFromCanvas(canvas);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (rawFiles.length === 0) return;

    const { selected, ignoredCount } = selectFilesWithinLimit(
      rawFiles,
      vectors.length,
      3
    );

    if (selected.length === 0) {
      setFeedback({
        type: "error",
        text: "Ya completaste el máximo de 3 capturas de rostro para este colaborador.",
      });
      return;
    }

    setBusy(true);
    setFeedback(null);

    const addedVectors: number[][] = [];
    const fileErrors: string[] = [];
    const total = selected.length;

    try {
      for (let i = 0; i < total; i++) {
        const file = selected[i]!;
        const stepBase = i / total;
        const stepSpan = 1 / total;

        setUploadProgress({
          current: i + 1,
          total,
          percent: Math.round((stepBase + stepSpan * 0.1) * 100),
          label: `Procesando ${i + 1} de ${total}: ${file.name}`,
        });

        try {
          const canvas = await decodeImageFileToCanvas(file, (stage) => {
            setUploadProgress({
              current: i + 1,
              total,
              percent: Math.round(
                (stepBase + stepSpan * (stage === "converting_heic" ? 0.35 : 0.6)) *
                  100
              ),
              label:
                stage === "converting_heic"
                  ? `Convirtiendo foto HEIC (${i + 1} de ${total}): ${file.name}`
                  : `Preparando imagen (${i + 1} de ${total}): ${file.name}`,
            });
          });

          setUploadProgress({
            current: i + 1,
            total,
            percent: Math.round((stepBase + stepSpan * 0.85) * 100),
            label: `Analizando rostro (${i + 1} de ${total}): ${file.name}`,
          });

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            fileErrors.push(`${file.name}: No se pudo leer el contenido de la imagen.`);
            continue;
          }
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const res = await extractEmbeddingFromRgba(
            imgData.data,
            canvas.width,
            canvas.height
          );
          if (!res.ok || !res.embedding) {
            fileErrors.push(
              `${file.name}: ${res.reason ?? "No se detectó un rostro frontal claro."}`
            );
            continue;
          }
          addedVectors.push(Array.from(res.embedding));
        } catch (err) {
          fileErrors.push(
            `${file.name}: ${err instanceof Error ? err.message : "No se pudo procesar el archivo."}`
          );
        }
      }

      if (addedVectors.length > 0) {
        setVectors((prev) => [...prev, ...addedVectors].slice(0, 3));
      }

      const details = [...fileErrors];
      if (ignoredCount > 0) {
        details.push(
          `Se omitieron ${ignoredCount} archivo(s) adicional(es) porque el máximo es de 3 fotos.`
        );
      }

      if (addedVectors.length > 0 && details.length === 0) {
        setFeedback({
          type: "ok",
          text:
            addedVectors.length === 1
              ? "1 rostro procesado correctamente. La fotografía no se guarda por privacidad."
              : `${addedVectors.length} rostros procesados correctamente. Las fotografías no se guardan por privacidad.`,
        });
      } else if (addedVectors.length > 0) {
        setFeedback({
          type: "warn",
          text: `Se procesaron ${addedVectors.length} de ${total} foto(s) seleccionada(s).`,
          details,
        });
      } else {
        setFeedback({
          type: "error",
          text: "No se pudo registrar ningún rostro de las imágenes seleccionadas.",
          details,
        });
      }
    } finally {
      setUploadProgress(null);
      setBusy(false);
    }
  };

  const resetForm = () => {
    stopCamera();
    setEditingId(null);
    setNombreCompleto("");
    setCodigoInterno("");
    setNumeroEmpleado("");
    setPuesto("");
    setSucursalId(branches[0]?.id ?? "");
    setHorarioId(schedules[0]?.id ?? "");
    setConsentimiento(false);
    setVectors([]);
  };

  const handleEdit = (emp: EmployeeRow) => {
    stopCamera();
    setEditingId(emp.id);
    setNombreCompleto(emp.nombreCompleto);
    setCodigoInterno(emp.codigoInterno ?? "");
    setNumeroEmpleado(emp.numeroEmpleado ?? "");
    setPuesto(emp.puesto ?? "");
    setSucursalId(emp.sucursalId ?? branches[0]?.id ?? "");
    setHorarioId(emp.horarioId ?? schedules[0]?.id ?? "");
    setConsentimiento(emp.consentimientoBiometrico);
    setVectors([]);
    setFeedback({
      type: "ok",
      text: `Editando a ${emp.nombreCompleto}. Si no tomas nuevas capturas, se conservarán sus ${emp.vectoresCount} registros faciales actuales.`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId && vectors.length < 1) {
      setFeedback({
        type: "error",
        text: "Captura o sube al menos 1 fotografía frontal del colaborador antes de guardar.",
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const payload = {
        nombreCompleto,
        codigoInterno: codigoInterno || undefined,
        numeroEmpleado: numeroEmpleado || undefined,
        puesto: puesto || undefined,
        sucursalId: sucursalId || null,
        horarioId: horarioId || null,
        consentimientoBiometrico: consentimiento,
        vectors,
      };

      const res = editingId
        ? await updateEmployeeAction(editingId, payload)
        : await createEmployeeAction(payload);

      if (!res.ok) {
        setFeedback({
          type: "error",
          text: res.error ?? "No se pudo guardar el empleado.",
        });
        return;
      }

      const wasEdit = Boolean(editingId);
      resetForm();
      setFeedback({
        type: "ok",
        text: wasEdit
          ? "Empleado actualizado correctamente."
          : "Empleado registrado correctamente.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (id: string, nextActivo: boolean) => {
    setBusy(true);
    await toggleEmployeeActiveAction(id, nextActivo);
    setBusy(false);
    router.refresh();
  };

  const openDocsModal = async (emp: EmployeeRow) => {
    setDocsEmployee(emp);
    setDocsLoading(true);
    setDocError(null);
    try {
      const res = await fetch(`/api/admin/employees/${emp.id}/documents`);
      if (res.ok) {
        const data = (await res.json()) as { documents?: EmployeeDocItem[] };
        setDocsList(data.documents ?? []);
      }
    } finally {
      setDocsLoading(false);
    }
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !docsEmployee) return;
    setDocsLoading(true);
    setDocError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("tipoDocumento", docType);
      const res = await fetch(
        `/api/admin/employees/${docsEmployee.id}/documents`,
        { method: "POST", body: fd }
      );
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setDocError(data?.error ?? "No se pudo subir el documento.");
      } else {
        await openDocsModal(docsEmployee);
        router.refresh();
      }
    } finally {
      setDocsLoading(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!docsEmployee) return;
    setDocsLoading(true);
    setDocError(null);
    try {
      const res = await fetch(
        `/api/admin/employees/${docsEmployee.id}/documents/${docId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        await openDocsModal(docsEmployee);
        router.refresh();
      }
    } finally {
      setDocsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Formulario Alta + Enrolamiento Local */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">
            {editingId ? "Editar Empleado" : "Alta y Enrolamiento Biométrico"}
          </h2>
          <div className="flex items-center gap-2">
            {employees.filter((e) => e.activo).length >= maxEmpleados && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Límite alcanzado
              </span>
            )}
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                <X className="h-3 w-3" />
                Cancelar
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <input
            type="text"
            required
            value={nombreCompleto}
            onChange={(e) => setNombreCompleto(e.target.value)}
            placeholder="Nombre completo *"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#4f46e5] focus:outline-none"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="relative">
              <div className="mb-1 flex items-center justify-between gap-1">
                <label
                  htmlFor="emp-numero-empleado"
                  className="text-[11px] font-medium text-slate-700"
                >
                  Núm. de empleado
                </label>
                <span className="group relative inline-flex items-center">
                  <button
                    type="button"
                    aria-label="¿Para qué sirve el número de empleado?"
                    title="Este número identifica al colaborador en el sistema y le permite consultar su semana en el quiosco físico. Déjalo vacío si no deseas habilitarle esa consulta."
                    className="rounded-full text-slate-400 hover:text-[#4f46e5] focus:text-[#4f46e5] focus:outline-none"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute right-0 bottom-full z-20 mb-1.5 hidden w-60 rounded-lg bg-slate-900 px-2.5 py-2 text-[11px] leading-snug text-white shadow-lg group-hover:block group-focus-within:block"
                  >
                    Este número identifica al colaborador en el sistema y le
                    permite consultar su semana en el quiosco físico. Déjalo
                    vacío si no deseas habilitarle esa consulta.
                  </span>
                </span>
              </div>
              <input
                id="emp-numero-empleado"
                type="text"
                inputMode="numeric"
                maxLength={8}
                pattern="[0-9]*"
                value={numeroEmpleado}
                onChange={(e) =>
                  setNumeroEmpleado(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                placeholder="Solo dígitos (máx. 8)"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#4f46e5] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="emp-codigo-nomina"
                className="mb-1 block text-[11px] font-medium text-slate-700"
              >
                Núm. de nómina (opcional)
              </label>
              <input
                id="emp-codigo-nomina"
                type="text"
                value={codigoInterno}
                onChange={(e) => setCodigoInterno(e.target.value)}
                placeholder="Alfanumérico"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#4f46e5] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="emp-puesto"
                className="mb-1 block text-[11px] font-medium text-slate-700"
              >
                Puesto
              </label>
              <input
                id="emp-puesto"
                type="text"
                value={puesto}
                onChange={(e) => setPuesto(e.target.value)}
                placeholder="Puesto"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#4f46e5] focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="">Sin sucursal</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
            <select
              value={horarioId}
              onChange={(e) => setHorarioId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="">Sin horario</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Captura local 1-3 vectores */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">
              Capturas de Rostro
            </span>
            <div className="flex items-center gap-2">
              <span className="tnum rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-[#4f46e5]">
                {vectors.length} de 3
              </span>
              {vectors.length > 0 && (
                <button
                  type="button"
                  onClick={() => setVectors([])}
                  className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline"
                >
                  <Trash2 className="h-3 w-3" />
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {cameraOn && (
            <div className="space-y-2">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-[4/3] w-full rounded-lg bg-slate-900 object-cover"
              />
              <button
                type="button"
                disabled={busy}
                onClick={handleCaptureFromCamera}
                className="w-full rounded-lg bg-[#059669] px-3 py-2 text-xs font-semibold text-white"
              >
                Capturar Rostro Frontal
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleToggleCamera}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <Camera className="h-3.5 w-3.5" />
              {cameraOn ? "Apagar Cámara" : "Usar Cámara"}
            </button>
            <button
              type="button"
              disabled={busy || vectors.length >= 3}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              Subir Fotos
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.heic,.heif"
              onChange={(e) => void handleFileUpload(e)}
              className="hidden"
            />
          </div>

          <p className="text-[11px] text-slate-500">
            Puedes seleccionar hasta 3 fotos a la vez (JPG, PNG, WebP o HEIC de iPhone).
          </p>

          {uploadProgress && (
            <div className="space-y-1.5 rounded-lg border border-indigo-200 bg-white p-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-700">
                <span className="truncate">{uploadProgress.label}</span>
                <span className="tnum shrink-0 font-semibold text-[#4f46e5]">
                  {uploadProgress.percent}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={uploadProgress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
              >
                <div
                  className="h-full rounded-full bg-[#4f46e5] transition-all duration-200"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <label className="flex items-start gap-2 text-[11px] text-slate-600">
          <input
            type="checkbox"
            checked={consentimiento}
            onChange={(e) => setConsentimiento(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-[#4f46e5]"
          />
          <span>
            Confirmo que el colaborador otorgó su{" "}
            <strong>autorización para registro facial</strong>. Solo se guarda
            una firma matemática segura del rostro, nunca la fotografía original.
          </span>
        </label>

        {feedback && (
          <div
            role="status"
            className={`rounded-xl border px-3 py-2 text-xs ${
              feedback.type === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : feedback.type === "warn"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <p className="font-medium">{feedback.text}</p>
            {feedback.details && feedback.details.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px]">
                {feedback.details.map((detail, idx) => (
                  <li key={idx}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || (!editingId && vectors.length === 0)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />
          {busy
            ? "Guardando..."
            : editingId
              ? "Actualizar Empleado"
              : "Guardar Empleado"}
        </button>
      </form>

      {/* Directorio */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Directorio de Empleados
          </h2>
          <span className="tnum rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
            {employees.length} registrados
          </span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Empleado</th>
                <th className="py-2 pr-3 font-medium">Rostros</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="py-2.5 pr-3">
                    <p className="font-semibold text-slate-900">
                      {emp.nombreCompleto}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {emp.numeroEmpleado
                        ? `No. Emp: ${emp.numeroEmpleado} · `
                        : ""}
                      {emp.codigoInterno ?? "Sin nómina"} ·{" "}
                      {emp.puesto ?? "Sin puesto"}
                    </p>
                  </td>
                  <td className="tnum py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-[#4f46e5]">
                      <ScanFace className="h-3.5 w-3.5" />
                      {emp.vectoresCount}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        emp.activo
                          ? "bg-emerald-50 text-[#059669]"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {emp.activo ? "Activo" : "Baja"}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void openDocsModal(emp)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <FileText className="h-3 w-3" />
                        {emp.documentosCount > 0
                          ? `Docs (${emp.documentosCount})`
                          : "Docs"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleEdit(emp)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleActive(emp.id, !emp.activo)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <UserX className="h-3 w-3" />
                        {emp.activo ? "Dar de Baja" : "Reactivar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    Aún no hay empleados registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {docsEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Documentos de {docsEmployee.nombreCompleto}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Resguardo digital opcional (PDF, JPG o PNG, máx. 5 MB).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDocsEmployee(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
              >
                <option value="acuerdo_interno">Acuerdo / Consentimiento</option>
                <option value="contrato">Contrato / Anexo</option>
                <option value="identificacion">Identificación</option>
                <option value="otro">Otro documento</option>
              </select>
              <button
                type="button"
                disabled={docsLoading}
                onClick={() => docFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                Subir Archivo
              </button>
              <input
                ref={docFileInputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={handleUploadDoc}
                className="hidden"
              />
            </div>

            {docError && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                {docError}
              </p>
            )}

            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto text-xs">
              {docsLoading && (
                <p className="py-4 text-center text-slate-400">Cargando...</p>
              )}
              {!docsLoading && docsList.length === 0 && (
                <p className="rounded-xl bg-slate-50 py-5 text-center text-slate-500">
                  Sin documento adjunto en plataforma.
                </p>
              )}
              {!docsLoading &&
                docsList.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
                  >
                    <div className="min-w-0">
                      <a
                        href={`/api/admin/employees/${docsEmployee.id}/documents/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate font-semibold text-[#4f46e5] hover:underline"
                      >
                        {doc.nombreArchivo}
                      </a>
                      <p className="text-[11px] text-slate-500">
                        {new Date(doc.createdAt).toLocaleDateString("es-MX")}
                        {doc.subidoPorNombre
                          ? ` · Por ${doc.subidoPorNombre}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={docsLoading}
                      onClick={() => void handleDeleteDoc(doc.id)}
                      className="rounded-lg border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
                      title="Eliminar documento"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
