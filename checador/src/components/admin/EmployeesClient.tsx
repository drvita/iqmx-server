"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  Pencil,
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

interface EmployeeRow {
  id: string;
  codigoInterno: string | null;
  nombreCompleto: string;
  puesto: string | null;
  departamento: string | null;
  sucursalId: string | null;
  horarioId: string | null;
  consentimientoBiometrico: boolean;
  activo: boolean;
  vectoresCount: number;
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
  const [puesto, setPuesto] = useState("");
  const [sucursalId, setSucursalId] = useState(branches[0]?.id ?? "");
  const [horarioId, setHorarioId] = useState(schedules[0]?.id ?? "");
  const [consentimiento, setConsentimiento] = useState(false);

  const [vectors, setVectors] = useState<number[][]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

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
        text: "Máximo 3 vectores faciales por empleado.",
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
        text: `Vector 512d #${vectors.length + 1} extraído localmente (${res.latency.totalMs} ms). La foto cruda fue descartada.`,
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 480;
      canvas.height = img.naturalHeight || 480;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      await extractFromCanvas(canvas);
    };
    img.src = url;
    e.target.value = "";
  };

  const resetForm = () => {
    stopCamera();
    setEditingId(null);
    setNombreCompleto("");
    setCodigoInterno("");
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
    setPuesto(emp.puesto ?? "");
    setSucursalId(emp.sucursalId ?? branches[0]?.id ?? "");
    setHorarioId(emp.horarioId ?? schedules[0]?.id ?? "");
    setConsentimiento(emp.consentimientoBiometrico);
    setVectors([]);
    setFeedback({
      type: "ok",
      text: `Editando a ${emp.nombreCompleto}. Si no capturas nuevas fotos, se conservarán sus ${emp.vectoresCount} vectores actuales.`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const payload = {
        nombreCompleto,
        codigoInterno: codigoInterno || undefined,
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
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={codigoInterno}
              onChange={(e) => setCodigoInterno(e.target.value)}
              placeholder="Núm. nómina"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#4f46e5] focus:outline-none"
            />
            <input
              type="text"
              value={puesto}
              onChange={(e) => setPuesto(e.target.value)}
              placeholder="Puesto"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-[#4f46e5] focus:outline-none"
            />
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
              Vectores Faciales Locales
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
              Subir Foto
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

        <label className="flex items-start gap-2 text-[11px] text-slate-600">
          <input
            type="checkbox"
            checked={consentimiento}
            onChange={(e) => setConsentimiento(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-[#4f46e5]"
          />
          <span>
            Confirmo que el empleado otorgó su{" "}
            <strong>consentimiento biométrico expreso (LFPDPPP)</strong>. Solo
            se almacenan vectores 512d, sin fotos crudas.
          </span>
        </label>

        {feedback && (
          <div
            className={`rounded-xl border px-3 py-2 text-xs ${
              feedback.type === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {feedback.text}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
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
                <th className="py-2 pr-3 font-medium">Vectores</th>
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
                      {emp.codigoInterno ?? "Sin nómina"} ·{" "}
                      {emp.puesto ?? "Sin puesto"}
                    </p>
                  </td>
                  <td className="tnum py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-[#4f46e5]">
                      <CheckCircle2 className="h-3 w-3" />
                      {emp.vectoresCount} / 3
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
    </div>
  );
}
