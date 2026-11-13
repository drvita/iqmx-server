"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createScheduleAction,
  deleteScheduleAction,
  updateScheduleAction,
} from "@/actions/admin";

interface ScheduleRow {
  id: string;
  nombre: string;
  horaEntrada: string;
  horaSalida: string;
  toleranciaMin: number;
  minutosComida: number;
  diasLaborales: number[];
}

const DAY_LABELS: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
  7: "Dom",
};

export function SchedulesClient({ schedules }: { schedules: ScheduleRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [horaEntrada, setHoraEntrada] = useState("09:00");
  const [horaSalida, setHoraSalida] = useState("18:00");
  const [toleranciaMin, setToleranciaMin] = useState(10);
  const [minutosComida, setMinutosComida] = useState(60);
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: number) => {
    setDias((prev) =>
      prev.includes(d)
        ? prev.filter((item) => item !== d)
        : [...prev, d].sort((a, b) => a - b)
    );
  };

  const resetForm = () => {
    setEditingId(null);
    setNombre("");
    setHoraEntrada("09:00");
    setHoraSalida("18:00");
    setToleranciaMin(10);
    setMinutosComida(60);
    setDias([1, 2, 3, 4, 5]);
    setError(null);
  };

  const handleEdit = (s: ScheduleRow) => {
    setEditingId(s.id);
    setNombre(s.nombre);
    setHoraEntrada(String(s.horaEntrada).slice(0, 5));
    setHoraSalida(String(s.horaSalida).slice(0, 5));
    setToleranciaMin(s.toleranciaMin);
    setMinutosComida(s.minutosComida);
    setDias(Array.isArray(s.diasLaborales) ? s.diasLaborales : [1, 2, 3, 4, 5]);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    setError(null);
    const res = await deleteScheduleAction(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo eliminar el horario.");
      return;
    }
    if (editingId === id) resetForm();
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      nombre,
      horaEntrada,
      horaSalida,
      toleranciaMin,
      minutosComida,
      diasLaborales: dias,
    };
    const res = editingId
      ? await updateScheduleAction(editingId, payload)
      : await createScheduleAction(payload);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar el horario.");
      return;
    }
    resetForm();
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">
            {editingId ? "Editar Horario" : "Nuevo Horario"}
          </h2>
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

        <div className="space-y-3 text-xs">
          <input
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Matutino L-V"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-slate-600">Entrada</span>
              <input
                type="time"
                value={horaEntrada}
                onChange={(e) => setHoraEntrada(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-600">Salida</span>
              <input
                type="time"
                value={horaSalida}
                onChange={(e) => setHoraSalida(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-slate-600">Tolerancia en minutos</span>
              <input
                type="number"
                min={0}
                max={120}
                value={toleranciaMin}
                onChange={(e) => setToleranciaMin(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-600">Comida en minutos</span>
              <input
                type="number"
                min={0}
                max={180}
                value={minutosComida}
                onChange={(e) => setMinutosComida(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <div>
            <span className="text-slate-600">Días laborales</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`rounded-lg px-2.5 py-1 font-medium ${
                    dias.includes(d)
                      ? "bg-[#4f46e5] text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {DAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || dias.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {editingId ? "Actualizar Horario" : "Guardar Horario"}
        </button>
      </form>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Turnos Configurados
          </h2>
          <span className="tnum rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
            {schedules.length} registrados
          </span>
        </div>

        <div className="space-y-2.5">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-900">{s.nombre}</p>
                <p className="tnum mt-0.5 text-slate-500">
                  {String(s.horaEntrada).slice(0, 5)} –{" "}
                  {String(s.horaSalida).slice(0, 5)} · Tolerancia:{" "}
                  {s.toleranciaMin} min · Comida: {s.minutosComida} min
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Días:{" "}
                  {(Array.isArray(s.diasLaborales) ? s.diasLaborales : [])
                    .map((d) => DAY_LABELS[d] ?? d)
                    .join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleEdit(s)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(s.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {schedules.length === 0 && (
            <div className="flex items-center gap-2 py-6 text-xs text-slate-500">
              <Clock className="h-4 w-4" />
              <span>Aún no hay horarios registrados.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
