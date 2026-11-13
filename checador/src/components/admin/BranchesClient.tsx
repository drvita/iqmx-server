"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createBranchAction,
  deleteBranchAction,
  updateBranchAction,
} from "@/actions/admin";

interface BranchRow {
  id: string;
  nombre: string;
  direccion: string | null;
  zonaHoraria: string | null;
  activo: boolean;
}

export function BranchesClient({
  branches,
  maxSucursales,
}: {
  branches: BranchRow[];
  maxSucursales: number;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setNombre("");
    setDireccion("");
    setError(null);
  };

  const handleEdit = (b: BranchRow) => {
    setEditingId(b.id);
    setNombre(b.nombre);
    setDireccion(b.direccion ?? "");
    setError(null);
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    setError(null);
    const res = await deleteBranchAction(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo eliminar la sucursal.");
      return;
    }
    if (editingId === id) resetForm();
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = editingId
      ? await updateBranchAction(editingId, { nombre, direccion })
      : await createBranchAction({ nombre, direccion });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar la sucursal.");
      return;
    }
    resetForm();
    router.refresh();
  };

  const limitReached = branches.length >= maxSucursales;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">
            {editingId ? "Editar Sucursal" : "Nueva Sucursal"}
          </h2>
          <div className="flex items-center gap-2">
            {limitReached && !editingId && (
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
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la sede"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
          />
          <input
            type="text"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Dirección física opcional"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
          />
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {editingId ? "Actualizar Sucursal" : "Crear Sucursal"}
        </button>
      </form>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Sucursales Activas
          </h2>
          <span className="tnum rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
            {branches.length} registradas
          </span>
        </div>
        <div className="space-y-2.5">
          {branches.map((b) => (
            <div
              key={b.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-900">{b.nombre}</p>
                <p className="mt-0.5 text-slate-500">
                  {b.direccion ?? "Sin dirección registrada"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleEdit(b)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(b.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {branches.length === 0 && (
            <div className="flex items-center gap-2 py-6 text-xs text-slate-500">
              <Building2 className="h-4 w-4" />
              <span>Aún no hay sucursales registradas.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
