"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import {
  createOrgUserAction,
  deleteOrgUserAction,
  toggleOrgUserActiveAction,
  updateOrgUserAction,
} from "@/actions/admin";
import type { RolCodigo } from "@/lib/auth/session";

interface OrgUserRow {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  rolCodigo: string;
}

const ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN: "Administrador Principal",
  RH_ASSISTANT: "Asistente de RH",
  SUPERVISOR_SUCURSAL: "Supervisor de Sucursal",
  AUDITOR_NOMINA: "Auditor de Nómina",
};

export function AsistentesClient({
  users,
  currentUserId,
  currentUserRole,
  extraRolesEnabled,
}: {
  users: OrgUserRow[];
  currentUserId: string;
  currentUserRole: RolCodigo;
  extraRolesEnabled: boolean;
}) {
  const router = useRouter();
  const [editingUser, setEditingUser] = useState<OrgUserRow | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rolCodigo, setRolCodigo] = useState<RolCodigo>("RH_ASSISTANT");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isMainAdmin = currentUserRole === "ORG_ADMIN";

  const resetForm = () => {
    setEditingUser(null);
    setNombre("");
    setEmail("");
    setPassword("");
    setRolCodigo("RH_ASSISTANT");
  };

  const handleEdit = (u: OrgUserRow) => {
    setEditingUser(u);
    setNombre(u.nombre);
    setEmail(u.email);
    setPassword("");
    setRolCodigo((u.rolCodigo as RolCodigo) || "RH_ASSISTANT");
    setMsg(null);
    setErr(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);

    const res = editingUser
      ? await updateOrgUserAction(editingUser.id, {
          nombre,
          email,
          password: password || undefined,
          rolCodigo,
        })
      : await createOrgUserAction({
          nombre,
          email,
          password,
          rolCodigo,
        });

    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? "No se pudo guardar el usuario.");
      return;
    }

    const wasEdit = Boolean(editingUser);
    resetForm();
    setMsg(
      wasEdit
        ? "Datos actualizados correctamente."
        : "Asistente registrado correctamente."
    );
    router.refresh();
  };

  const handleToggleActive = async (u: OrgUserRow) => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await toggleOrgUserActiveAction(u.id, !u.activo);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? "No se pudo actualizar el estado.");
      return;
    }
    router.refresh();
  };

  const handleDelete = async (u: OrgUserRow) => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await deleteOrgUserAction(u.id);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? "No se pudo eliminar el asistente.");
      return;
    }
    if (editingUser?.id === u.id) resetForm();
    router.refresh();
  };

  const showForm = isMainAdmin || Boolean(editingUser);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              {editingUser ? "Editar Acceso" : "Nuevo Asistente"}
            </h2>
            {editingUser && (
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
              placeholder="Nombre completo"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@tuempresa.com"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
            <input
              type="password"
              required={!editingUser}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                editingUser
                  ? "Nueva contraseña opcional"
                  : "Contraseña mínimo 8 caracteres"
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
            {editingUser?.rolCodigo !== "ORG_ADMIN" && (
              <select
                value={rolCodigo}
                onChange={(e) => setRolCodigo(e.target.value as RolCodigo)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
              >
                <option value="RH_ASSISTANT">Asistente de RH</option>
                {extraRolesEnabled && (
                  <>
                    <option value="SUPERVISOR_SUCURSAL">
                      Supervisor de Sucursal
                    </option>
                    <option value="AUDITOR_NOMINA">Auditor de Nómina</option>
                  </>
                )}
              </select>
            )}
          </div>

          {err && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {err}
            </p>
          )}
          {msg && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            {busy
              ? "Guardando..."
              : editingUser
                ? "Guardar Cambios"
                : "Crear Asistente"}
          </button>
        </form>
      )}

      <div
        className={`space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs ${
          showForm ? "lg:col-span-7" : "lg:col-span-12"
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Asistentes y Administradores
          </h2>
          <span className="tnum rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
            {users.length} cuentas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">Usuario</th>
                <th className="py-2 pr-3 font-medium">Rol</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isTargetMainAdmin = u.rolCodigo === "ORG_ADMIN";
                const canEditThisRow = isTargetMainAdmin
                  ? isMainAdmin
                  : isMainAdmin;
                const canManageStatusOrDelete =
                  isMainAdmin && !isTargetMainAdmin && u.id !== currentUserId;

                return (
                  <tr key={u.id}>
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-slate-900">{u.nombre}</p>
                      <p className="text-[11px] text-slate-500">{u.email}</p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-[#4f46e5]">
                        {ROLE_LABELS[u.rolCodigo] ?? u.rolCodigo}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          u.activo
                            ? "bg-emerald-50 text-[#059669]"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {canEditThisRow && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleEdit(u)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </button>
                        )}
                        {canManageStatusOrDelete && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleToggleActive(u)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {u.activo ? (
                                <>
                                  <UserX className="h-3 w-3" />
                                  Desactivar
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3 w-3" />
                                  Activar
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDelete(u)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
