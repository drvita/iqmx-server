"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  CodeBracketIcon,
  ExclamationCircleIcon,
  IdentificationIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { RawJsonEditor } from "@/components/admin/RawJsonEditor";

type ChecadorTenant = {
  organization_id: string;
  external_customer_id: string | null;
  nombre: string;
  razon_social: string | null;
  rfc: string | null;
  zona_horaria: string;
  estado: string;
  plan_codigo: string;
  max_empleados: number;
  max_dispositivos: number;
  max_sucursales: number;
  cloud_evidences_enabled: boolean;
  extra_roles_enabled: boolean;
  horas_semanales_max: number;
  empleados_count: number;
  dispositivos_count: number;
  sucursales_count: number;
  usuarios_count: number;
  owner_email: string | null;
  customer_id: number | null;
  customer_company_name: string | null;
  customer_email: string | null;
  subscription_id: number | null;
  subscription_status: string | null;
  active_plan_name: string | null;
  active_plan_slug: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  created_at: string | null;
};

const TIMEZONE_OPTIONS = [
  "America/Mexico_City",
  "America/Monterrey",
  "America/Tijuana",
  "America/Cancun",
  "America/Hermosillo",
  "America/Merida",
  "America/Chihuahua",
];

const ORG_STATUS_STYLES: Record<string, { label: string; badge: string }> = {
  activo: {
    label: "Activo",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  prueba: {
    label: "Prueba",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
  },
  suspendido: {
    label: "Suspendido",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  cancelado: {
    label: "Cancelado",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

const SUB_STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  trial: "Prueba",
  past_due: "Atrasada",
  paused: "Pausada",
  cancelled: "Cancelada",
};

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function addDaysToDateInput(dateStr: string, days: number): string {
  const base = dateStr ? new Date(`${dateStr}T12:00:00Z`) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export default function AdminChecadorPage() {
  const [tenants, setTenants] = useState<ChecadorTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [resetResult, setResetResult] = useState<{
    orgName: string;
    ownerEmail: string;
    tempPassword: string;
  } | null>(null);

  // Búsqueda y Paginación
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal de Configuración
  const [selectedTenant, setSelectedTenant] = useState<ChecadorTenant | null>(
    null,
  );
  const [modalTab, setModalTab] = useState<"account" | "limits" | "raw">(
    "account",
  );
  const [rawJsonText, setRawJsonText] = useState("");
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formState, setFormState] = useState({
    nombre: "",
    razon_social: "",
    rfc: "",
    zona_horaria: "America/Mexico_City",
    subscription_status: "active",
    current_period_start: "",
    current_period_end: "",
    plan_codigo: "basico",
    max_empleados: 15,
    max_dispositivos: 2,
    max_sucursales: 1,
    horas_semanales_max: 48,
    cloud_evidences_enabled: false,
    extra_roles_enabled: false,
  });

  const fetchTenants = useCallback(async () => {
    const token = localStorage.getItem("iqmx_admin_token");
    if (!token) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiUrl}/api/admin/checador/tenants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setTenants(await res.json());
      } else {
        setFeedbackMsg({
          type: "error",
          text: "No se pudo cargar la lista de organizaciones de Checador Facial.",
        });
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error de conexión al consultar la API central.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const filteredTenants = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return tenants;
    return tenants.filter((t) => {
      return (
        t.nombre.toLowerCase().includes(term) ||
        t.organization_id.toLowerCase().includes(term) ||
        (t.razon_social && t.razon_social.toLowerCase().includes(term)) ||
        (t.rfc && t.rfc.toLowerCase().includes(term)) ||
        (t.owner_email && t.owner_email.toLowerCase().includes(term)) ||
        (t.customer_company_name &&
          t.customer_company_name.toLowerCase().includes(term)) ||
        (t.customer_email && t.customer_email.toLowerCase().includes(term)) ||
        (t.active_plan_name && t.active_plan_name.toLowerCase().includes(term))
      );
    });
  }, [tenants, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredTenants.length / pageSize));
  const paginatedTenants = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTenants.slice(start, start + pageSize);
  }, [filteredTenants, currentPage, pageSize]);

  const buildPayloadFromForm = (tenant: ChecadorTenant) => {
    const payload: Record<string, unknown> = {
      nombre: formState.nombre.trim(),
      razon_social: formState.razon_social.trim() || null,
      rfc: formState.rfc.trim().toUpperCase() || null,
      zona_horaria: formState.zona_horaria,
      plan_codigo: formState.plan_codigo.trim() || "basico",
      max_empleados: Number(formState.max_empleados),
      max_dispositivos: Number(formState.max_dispositivos),
      max_sucursales: Number(formState.max_sucursales),
      horas_semanales_max: Number(formState.horas_semanales_max),
      cloud_evidences_enabled: formState.cloud_evidences_enabled,
      extra_roles_enabled: formState.extra_roles_enabled,
    };

    if (tenant.subscription_id) {
      payload.subscription_status = formState.subscription_status;
      if (formState.current_period_start) {
        payload.current_period_start = new Date(
          `${formState.current_period_start}T00:00:00Z`,
        ).toISOString();
      }
      if (formState.current_period_end) {
        payload.current_period_end = new Date(
          `${formState.current_period_end}T23:59:59Z`,
        ).toISOString();
      }
    }
    return payload;
  };

  const openConfigModal = (tenant: ChecadorTenant) => {
    setSelectedTenant(tenant);
    setModalTab("account");
    setRawJsonError(null);
    const nextState = {
      nombre: tenant.nombre || "",
      razon_social: tenant.razon_social || "",
      rfc: tenant.rfc || "",
      zona_horaria: tenant.zona_horaria || "America/Mexico_City",
      subscription_status: tenant.subscription_status || "active",
      current_period_start: tenant.current_period_start
        ? tenant.current_period_start.slice(0, 10)
        : "",
      current_period_end: tenant.current_period_end
        ? tenant.current_period_end.slice(0, 10)
        : "",
      plan_codigo: tenant.plan_codigo || "basico",
      max_empleados: tenant.max_empleados || 15,
      max_dispositivos: tenant.max_dispositivos || 2,
      max_sucursales: tenant.max_sucursales || 1,
      horas_semanales_max: tenant.horas_semanales_max || 48,
      cloud_evidences_enabled: Boolean(tenant.cloud_evidences_enabled),
      extra_roles_enabled: Boolean(tenant.extra_roles_enabled),
    };
    setFormState(nextState);
    setRawJsonText(
      JSON.stringify(
        {
          nombre: nextState.nombre,
          razon_social: nextState.razon_social || null,
          rfc: nextState.rfc || null,
          zona_horaria: nextState.zona_horaria,
          plan_codigo: nextState.plan_codigo,
          max_empleados: nextState.max_empleados,
          max_dispositivos: nextState.max_dispositivos,
          max_sucursales: nextState.max_sucursales,
          horas_semanales_max: nextState.horas_semanales_max,
          cloud_evidences_enabled: nextState.cloud_evidences_enabled,
          extra_roles_enabled: nextState.extra_roles_enabled,
        },
        null,
        2,
      ),
    );
  };

  const handleSwitchModalTab = (tab: "account" | "limits" | "raw") => {
    if (tab === modalTab || !selectedTenant) return;
    if (tab === "raw") {
      setRawJsonText(
        JSON.stringify(buildPayloadFromForm(selectedTenant), null, 2),
      );
      setRawJsonError(null);
    }
    setModalTab(tab);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    let payload: Record<string, unknown>;
    if (modalTab === "raw") {
      try {
        const parsed = JSON.parse(rawJsonText);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          setRawJsonError("El contenido debe ser un objeto JSON válido.");
          return;
        }
        payload = parsed;
      } catch {
        setRawJsonError("JSON inválido. Verifica la sintaxis antes de guardar.");
        return;
      }
    } else {
      payload = buildPayloadFromForm(selectedTenant);
    }

    setSaving(true);
    setFeedbackMsg(null);
    try {
      const token = localStorage.getItem("iqmx_admin_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(
        `${apiUrl}/api/admin/checador/tenants/${selectedTenant.organization_id}/override`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedbackMsg({
          type: "error",
          text:
            data?.detail ||
            "No se pudo guardar la configuración de la organización.",
        });
      } else {
        setFeedbackMsg({
          type: "success",
          text: `Configuración actualizada para ${selectedTenant.nombre}.`,
        });
        setSelectedTenant(null);
        fetchTenants();
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error de red al guardar los cambios.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncPlan = async (orgId: string) => {
    setActionLoading(orgId);
    setFeedbackMsg(null);
    try {
      const token = localStorage.getItem("iqmx_admin_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(
        `${apiUrl}/api/admin/checador/tenants/${orgId}/sync-plan`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedbackMsg({
          type: "error",
          text: data?.detail || "Fallo al sincronizar el plan con Checador Facial.",
        });
      } else {
        setFeedbackMsg({
          type: "success",
          text: "Límites del plan sincronizados correctamente con Checador Facial.",
        });
        fetchTenants();
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error de red al sincronizar el plan.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (tenant: ChecadorTenant) => {
    const isSuspended =
      tenant.estado === "suspendido" || tenant.estado === "cancelado";
    const nextStatus = isSuspended ? "activo" : "suspendido";

    setActionLoading(tenant.organization_id);
    setFeedbackMsg(null);
    try {
      const token = localStorage.getItem("iqmx_admin_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(
        `${apiUrl}/api/admin/checador/tenants/${tenant.organization_id}/status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedbackMsg({
          type: "error",
          text: data?.detail || "No se pudo cambiar el estado de la organización.",
        });
      } else {
        setFeedbackMsg({
          type: "success",
          text: `Organización ${nextStatus === "activo" ? "reactivada" : "suspendida"} correctamente.`,
        });
        fetchTenants();
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error de red al cambiar el estado.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetOwnerPassword = async (tenant: ChecadorTenant) => {
    setActionLoading(`pwd-${tenant.organization_id}`);
    setFeedbackMsg(null);
    try {
      const token = localStorage.getItem("iqmx_admin_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(
        `${apiUrl}/api/admin/checador/tenants/${tenant.organization_id}/reset-owner-password`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFeedbackMsg({
          type: "error",
          text:
            data?.detail ||
            "No se pudo restablecer la contraseña del propietario.",
        });
      } else {
        setResetResult({
          orgName: tenant.nombre,
          ownerEmail: data.owner_email || tenant.owner_email || "Propietario",
          tempPassword: data.temp_password,
        });
        setFeedbackMsg({
          type: "success",
          text: `Contraseña temporal generada para ${tenant.nombre}.`,
        });
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error de red al restablecer contraseña.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <IdentificationIcon className="h-7 w-7 text-blue-600" />
            <span>Gestión de Checador Facial</span>
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Administra organizaciones, vigencia de membresías, datos de cuenta,
            límites y soporte técnico.
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchTenants();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-xs transition-colors shrink-0"
        >
          <ArrowPathIcon
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Feedback */}
      {feedbackMsg && (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            feedbackMsg.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === "success" ? (
              <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <ExclamationCircleIcon className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="p-1 hover:opacity-70"
            aria-label="Cerrar aviso"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Contraseña temporal generada para soporte */}
      {resetResult && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <KeyIcon className="h-4 w-4 text-blue-600" />
              Contraseña temporal generada para {resetResult.orgName}
            </p>
            <p className="text-blue-800">
              Usuario: <span className="font-semibold">{resetResult.ownerEmail}</span>{" "}
              · Contraseña temporal:{" "}
              <code className="rounded bg-white px-2 py-0.5 font-mono font-bold text-blue-950 border border-blue-200">
                {resetResult.tempPassword}
              </code>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(resetResult.tempPassword);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700"
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
              <span>Copiar</span>
            </button>
            <button
              onClick={() => setResetResult(null)}
              className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 font-semibold text-blue-700 hover:bg-blue-100"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Barra de búsqueda y paginación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar por empresa, razón social, RFC, correo o plan..."
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>Mostrar</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span>por página · {filteredTenants.length} organizaciones</span>
        </div>
      </div>

      {/* Tabla principal */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
              <tr>
                <th className="px-4 py-3">Organización & Cuenta</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Membresía & Vigencia</th>
                <th className="px-4 py-3">Uso / Límites</th>
                <th className="px-4 py-3">Módulos</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    Cargando organizaciones de Checador Facial...
                  </td>
                </tr>
              ) : paginatedTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    No se encontraron organizaciones registradas en Checador Facial.
                  </td>
                </tr>
              ) : (
                paginatedTenants.map((t) => {
                  const statusCfg = ORG_STATUS_STYLES[t.estado] || {
                    label: t.estado,
                    badge: "bg-gray-100 text-gray-700 border-gray-200",
                  };
                  const isBusy = actionLoading === t.organization_id;
                  const isSuspended =
                    t.estado === "suspendido" || t.estado === "cancelado";

                  return (
                    <tr
                      key={t.organization_id}
                      className="hover:bg-gray-50/70 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-gray-900">
                          {t.nombre}
                        </div>
                        {(t.razon_social || t.rfc) && (
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {t.razon_social || "Sin razón social"}
                            {t.rfc ? ` · ${t.rfc}` : ""}
                          </div>
                        )}
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {t.owner_email || t.customer_email || "Sin correo"}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusCfg.badge}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-medium text-gray-900">
                          {t.active_plan_name || `Plan ${t.plan_codigo}`}
                        </div>
                        {t.subscription_id ? (
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            {SUB_STATUS_LABELS[t.subscription_status || ""] ||
                              t.subscription_status}{" "}
                            · Vence: {formatShortDate(t.current_period_end)}
                          </div>
                        ) : (
                          <div className="text-[11px] text-amber-600 mt-0.5">
                            Sin suscripción vinculada en portal
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 space-y-0.5 text-[11px]">
                        <div>
                          Colaboradores:{" "}
                          <span className="font-semibold text-gray-900">
                            {t.empleados_count} / {t.max_empleados}
                          </span>
                        </div>
                        <div>
                          Terminales:{" "}
                          <span className="font-semibold text-gray-900">
                            {t.dispositivos_count} / {t.max_dispositivos}
                          </span>
                        </div>
                        <div>
                          Sucursales:{" "}
                          <span className="font-semibold text-gray-900">
                            {t.sucursales_count} / {t.max_sucursales}
                          </span>{" "}
                          · {t.horas_semanales_max}h
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                              t.cloud_evidences_enabled
                                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                : "border-gray-200 bg-gray-50 text-gray-400"
                            }`}
                          >
                            Evidencias Nube
                          </span>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                              t.extra_roles_enabled
                                ? "border-purple-200 bg-purple-50 text-purple-700"
                                : "border-gray-200 bg-gray-50 text-gray-400"
                            }`}
                          >
                            Roles Extra
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openConfigModal(t)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                          >
                            <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
                            <span>Configurar</span>
                          </button>
                          <button
                            onClick={() => handleSyncPlan(t.organization_id)}
                            disabled={isBusy || !t.subscription_id}
                            title="Sincronizar límites del plan"
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                          >
                            <ArrowPathIcon
                              className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`}
                            />
                            <span>Sync</span>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(t)}
                            disabled={isBusy}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                              isSuspended
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            }`}
                          >
                            <NoSymbolIcon className="h-3.5 w-3.5" />
                            <span>{isSuspended ? "Reactivar" : "Suspender"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-600">
            <span>
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-gray-300 bg-white p-1.5 hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-gray-300 bg-white p-1.5 hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Configuración, Vigencia y Soporte */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Configurar {selectedTenant.nombre}
                </h2>
                <p className="text-xs text-gray-500">
                  {selectedTenant.owner_email || selectedTenant.customer_email || "Sin correo asignado"}
                </p>
              </div>
              <button
                onClick={() => setSelectedTenant(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-6 gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleSwitchModalTab("account")}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  modalTab === "account"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <CalendarDaysIcon className="h-4 w-4" />
                <span>Cuenta y Vigencia</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchModalTab("limits")}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  modalTab === "limits"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
                <span>Límites y Módulos</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchModalTab("raw")}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  modalTab === "raw"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <CodeBracketIcon className="h-4 w-4" />
                <span>JSON Avanzado</span>
              </button>
            </div>

            <form
              onSubmit={handleSaveConfig}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              {modalTab === "account" && (
                <>
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Datos de la Cuenta
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Nombre comercial
                        </label>
                        <input
                          type="text"
                          required
                          value={formState.nombre}
                          onChange={(e) =>
                            setFormState((p) => ({
                              ...p,
                              nombre: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Zona horaria
                        </label>
                        <select
                          value={formState.zona_horaria}
                          onChange={(e) =>
                            setFormState((p) => ({
                              ...p,
                              zona_horaria: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900"
                        >
                          {TIMEZONE_OPTIONS.map((tz) => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Razón social
                        </label>
                        <input
                          type="text"
                          value={formState.razon_social}
                          onChange={(e) =>
                            setFormState((p) => ({
                              ...p,
                              razon_social: e.target.value,
                            }))
                          }
                          placeholder="Opcional"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          RFC
                        </label>
                        <input
                          type="text"
                          maxLength={13}
                          value={formState.rfc}
                          onChange={(e) =>
                            setFormState((p) => ({
                              ...p,
                              rfc: e.target.value.toUpperCase(),
                            }))
                          }
                          placeholder="Opcional"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs uppercase text-gray-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vigencia de membresía */}
                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        Vigencia de Membresía
                      </h3>
                      {selectedTenant.subscription_id && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setFormState((p) => ({
                                ...p,
                                current_period_end: addDaysToDateInput(
                                  p.current_period_end,
                                  30,
                                ),
                              }))
                            }
                            className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            +30 días
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setFormState((p) => ({
                                ...p,
                                current_period_end: addDaysToDateInput(
                                  p.current_period_end,
                                  365,
                                ),
                              }))
                            }
                            className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            +1 año
                          </button>
                        </div>
                      )}
                    </div>

                    {selectedTenant.subscription_id ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Estado suscripción
                          </label>
                          <select
                            value={formState.subscription_status}
                            onChange={(e) =>
                              setFormState((p) => ({
                                ...p,
                                subscription_status: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900"
                          >
                            <option value="active">Activa</option>
                            <option value="trial">Prueba</option>
                            <option value="past_due">Atrasada</option>
                            <option value="paused">Pausada</option>
                            <option value="cancelled">Cancelada</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Inicio de vigencia
                          </label>
                          <input
                            type="date"
                            value={formState.current_period_start}
                            onChange={(e) =>
                              setFormState((p) => ({
                                ...p,
                                current_period_start: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Fin de vigencia
                          </label>
                          <input
                            type="date"
                            value={formState.current_period_end}
                            onChange={(e) =>
                              setFormState((p) => ({
                                ...p,
                                current_period_end: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Esta organización no tiene una suscripción vinculada en el
                        portal central. Puedes seguir editando sus datos de cuenta,
                        estado y límites directamente.
                      </p>
                    )}
                  </div>

                  {/* Soporte de acceso */}
                  <div className="border-t border-gray-200 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        Soporte de Acceso
                      </h3>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Genera una contraseña temporal para el administrador principal
                        de esta cuenta.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResetOwnerPassword(selectedTenant)}
                      disabled={
                        actionLoading === `pwd-${selectedTenant.organization_id}`
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shrink-0"
                    >
                      <KeyIcon className="h-4 w-4 text-blue-600" />
                      <span>Restablecer Contraseña</span>
                    </button>
                  </div>
                </>
              )}

              {modalTab === "limits" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Código de plan
                      </label>
                      <input
                        type="text"
                        value={formState.plan_codigo}
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            plan_codigo: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Jornada semanal máxima en horas
                      </label>
                      <input
                        type="number"
                        min={20}
                        max={72}
                        step={0.5}
                        value={formState.horas_semanales_max}
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            horas_semanales_max: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Máximo de colaboradores
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formState.max_empleados}
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            max_empleados: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Máximo de terminales quiosco
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formState.max_dispositivos}
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            max_dispositivos: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Máximo de sucursales
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formState.max_sucursales}
                        onChange={(e) =>
                          setFormState((p) => ({
                            ...p,
                            max_sucursales: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900"
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-900">
                          Evidencias en la Nube
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Habilita respaldo en la nube de capturas de asistencia.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={formState.cloud_evidences_enabled}
                        onClick={() =>
                          setFormState((p) => ({
                            ...p,
                            cloud_evidences_enabled: !p.cloud_evidences_enabled,
                          }))
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          formState.cloud_evidences_enabled
                            ? "bg-blue-600"
                            : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition ${
                            formState.cloud_evidences_enabled
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-900">
                          Roles Extra por Sucursal
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Permite asignar supervisores y auditores adicionales.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={formState.extra_roles_enabled}
                        onClick={() =>
                          setFormState((p) => ({
                            ...p,
                            extra_roles_enabled: !p.extra_roles_enabled,
                          }))
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          formState.extra_roles_enabled
                            ? "bg-blue-600"
                            : "bg-gray-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition ${
                            formState.extra_roles_enabled
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {modalTab === "raw" && (
                <div className="space-y-2">
                  <RawJsonEditor
                    value={rawJsonText}
                    onChange={(val) => {
                      setRawJsonText(val);
                      setRawJsonError(null);
                    }}
                  />
                  {rawJsonError && (
                    <p className="text-xs font-medium text-rose-600">
                      {rawJsonError}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedTenant(null)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
