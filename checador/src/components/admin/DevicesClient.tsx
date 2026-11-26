"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  KeyRound,
  Pencil,
  RefreshCw,
  Smartphone,
  TabletSmartphone,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import {
  createDeviceAction,
  deleteDeviceAction,
  regenerateDevicePinAction,
  revokeDeviceAction,
  updateDeviceNameAction,
} from "@/actions/admin";
import { DevicePairingQr } from "@/components/admin/DevicePairingQr";
import { filterAvailableEmployeesForPersonalMobile } from "@/services/admin/device-limits";

interface DeviceRow {
  id: string;
  sucursalNombre: string | null;
  tipo: string;
  empleadoId: string | null;
  empleadoNombre: string | null;
  nombre: string;
  pairingCode: string | null;
  pairingExpiresAt: Date | null;
  plataforma?: string | null;
  activo: boolean;
  revocadoAt: Date | null;
  vinculado: string | null;
}

interface BranchOption {
  id: string;
  nombre: string;
}

interface EmployeeOption {
  id: string;
  nombreCompleto: string;
  codigoInterno: string | null;
}

export function DevicesClient({
  devices,
  branches,
  employees,
  maxDispositivos,
  maxEmpleados,
}: {
  devices: DeviceRow[];
  branches: BranchOption[];
  employees: EmployeeOption[];
  maxDispositivos: number;
  maxEmpleados: number;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [sucursalId, setSucursalId] = useState(branches[0]?.id ?? "");
  const [tipo, setTipo] = useState<"kiosco_sucursal" | "dispositivo_personal_movil">(
    "kiosco_sucursal"
  );
  const availableEmployees = filterAvailableEmployeesForPersonalMobile(
    employees,
    devices
  );
  const [empleadoId, setEmpleadoId] = useState(availableEmployees[0]?.id ?? "");
  const effectiveEmpleadoId = availableEmployees.some(
    (emp) => emp.id === empleadoId
  )
    ? empleadoId
    : (availableEmployees[0]?.id ?? "");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const isPersonalMobile = tipo === "dispositivo_personal_movil";
    const res = await createDeviceAction({
      sucursalId: isPersonalMobile ? null : sucursalId || null,
      nombre: isPersonalMobile ? "" : nombre,
      tipo,
      empleadoId: isPersonalMobile ? effectiveEmpleadoId || null : null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo registrar el dispositivo.");
      return;
    }
    setNombre("");
    router.refresh();
  };

  const selectedEmployee = availableEmployees.find(
    (emp) => emp.id === effectiveEmpleadoId
  );
  const autoMobilePreview = selectedEmployee
    ? `dispositivo_${
        selectedEmployee.nombreCompleto
          .trim()
          .split(/\s+/)[0]
          ?.normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "colaborador"
      }_XXXX`
    : "dispositivo_colaborador_XXXX";

  const handleSaveRename = async (id: string) => {
    setBusy(true);
    setError(null);
    const res = await updateDeviceNameAction(id, renameValue);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo actualizar el nombre.");
      return;
    }
    setRenamingId(null);
    setRenameValue("");
    router.refresh();
  };

  const handleRegenerate = async (id: string) => {
    setBusy(true);
    setError(null);
    const res = await regenerateDevicePinAction(id);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Error al regenerar PIN.");
    router.refresh();
  };

  const handleRevoke = async (id: string) => {
    setBusy(true);
    setError(null);
    const res = await revokeDeviceAction(id);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Error al desvincular dispositivo.");
    router.refresh();
  };

  const handleDelete = async (id: string, deviceName: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `¿Eliminar el dispositivo "${deviceName}"? Su sesión se cerrará de inmediato.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await deleteDeviceAction(id);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Error al eliminar dispositivo.");
    router.refresh();
  };

  const activeKioskCount = devices.filter(
    (d) => d.activo && d.tipo === "kiosco_sucursal"
  ).length;
  const activePersonalCount = devices.filter(
    (d) => d.activo && d.tipo === "dispositivo_personal_movil"
  ).length;
  const limitReached =
    tipo === "kiosco_sucursal"
      ? activeKioskCount >= maxDispositivos
      : activePersonalCount >= maxEmpleados;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">
            Dar de Alta Dispositivo Quiosco
          </h2>
          {limitReached && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Límite alcanzado
            </span>
          )}
        </div>

        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipo("kiosco_sucursal")}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 font-semibold transition ${
                tipo === "kiosco_sucursal"
                  ? "border-[#4f46e5] bg-indigo-50 text-[#4f46e5]"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <TabletSmartphone className="h-3.5 w-3.5" />
              Kiosco Fijo
            </button>
            <button
              type="button"
              onClick={() => setTipo("dispositivo_personal_movil")}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 font-semibold transition ${
                tipo === "dispositivo_personal_movil"
                  ? "border-[#4f46e5] bg-indigo-50 text-[#4f46e5]"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Móvil Personal
            </button>
          </div>

          {tipo === "kiosco_sucursal" ? (
            <>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre de la terminal"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              />
              <select
                value={sucursalId}
                onChange={(e) => setSucursalId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div className="space-y-2.5">
              <div className="space-y-1">
                <label className="block font-medium text-slate-600">
                  Colaborador en ruta / campo
                </label>
                <select
                  required
                  value={effectiveEmpleadoId}
                  onChange={(e) => setEmpleadoId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                >
                  {availableEmployees.length === 0 && (
                    <option value="">
                      {employees.length > 0
                        ? "Todos los colaboradores activos ya tienen dispositivo asignado"
                        : "No hay colaboradores activos"}
                    </option>
                  )}
                  {availableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombreCompleto}
                      {emp.codigoInterno ? ` (${emp.codigoInterno})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-[11px] text-slate-600">
                <p>
                  Nombre automático:{" "}
                  <strong className="font-mono text-[#1e1b4b]">
                    {autoMobilePreview}
                  </strong>
                </p>
                <p className="mt-0.5 text-slate-500">
                  Sin sucursal fija: valida ubicación mediante GPS al checar.
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={
            busy ||
            limitReached ||
            (tipo === "kiosco_sucursal" ? !sucursalId : !effectiveEmpleadoId)
          }
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <KeyRound className="h-4 w-4" />
          Generar Dispositivo y PIN
        </button>
      </form>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Terminales Registradas
          </h2>
          <span className="tnum rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
            {devices.length} registradas
          </span>
        </div>

        <div className="space-y-3">
          {devices.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 text-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                {renamingId === d.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveRename(d.id)}
                      className="rounded-lg bg-[#059669] p-1 text-white"
                      title="Guardar nombre"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="rounded-lg border border-slate-200 p-1 text-slate-600"
                      title="Cancelar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {d.tipo === "dispositivo_personal_movil" ? (
                      <Smartphone className="h-4 w-4 text-[#059669]" />
                    ) : (
                      <TabletSmartphone className="h-4 w-4 text-[#4f46e5]" />
                    )}
                    <span className="font-bold text-slate-900">{d.nombre}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        d.tipo === "dispositivo_personal_movil"
                          ? "bg-indigo-50 text-[#4f46e5]"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {d.tipo === "dispositivo_personal_movil"
                        ? "Móvil Personal"
                        : "Kiosco Sucursal"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        !d.activo
                          ? "bg-red-50 text-red-700"
                          : d.vinculado
                            ? "bg-emerald-50 text-[#059669]"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {!d.activo
                        ? "Revocado"
                        : d.vinculado
                          ? "Vinculado"
                          : "Pendiente de PIN"}
                    </span>
                    {d.plataforma && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {d.plataforma}
                      </span>
                    )}
                  </div>
                )}

                <p className="text-slate-500">
                  {d.tipo === "dispositivo_personal_movil"
                    ? `En campo (GPS)${d.empleadoNombre ? ` · Asignado a: ${d.empleadoNombre}` : ""}`
                    : `Sucursal: ${d.sucursalNombre ?? "Sin sucursal"}`}
                </p>
                {d.activo && !d.vinculado && d.pairingCode && (
                  <>
                    <p className="tnum inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-2.5 py-1 font-mono text-sm font-bold tracking-widest text-[#1e1b4b]">
                      PIN: {d.pairingCode}
                    </p>
                    <DevicePairingQr
                      deviceName={d.nombre}
                      pairingCode={d.pairingCode}
                    />
                  </>
                )}
              </div>

              {d.activo && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setRenamingId(d.id);
                      setRenameValue(d.nombre);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar Nombre
                  </button>
                  {d.vinculado ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRevoke(d.id)}
                      title="Cierra la sesión del dispositivo actual y genera un nuevo PIN y QR para vincular otro"
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 font-medium text-amber-800 hover:bg-amber-50"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      Desvincular
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleRegenerate(d.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Nuevo PIN
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(d.id, d.nombre)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 font-medium text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
          {devices.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-500">
              Aún no hay dispositivos registrados.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
