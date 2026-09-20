"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ArrowPathIcon,
  AdjustmentsHorizontalIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  BuildingOffice2Icon,
  CodeBracketIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  TrashIcon,
  SignalIcon,
} from "@heroicons/react/24/outline";
import { RawJsonEditor } from "@/components/admin/RawJsonEditor";

type WhatsAppLine = {
  id: number;
  phone_number_id: string;
  waba_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  customer_id: number;
  customer_company_name: string | null;
  customer_email: string | null;
  organization_id: string | null;
  organization_name: string | null;
  is_synced_in_crm: boolean;
  webhook_url: string | null;
  webhook_is_active: boolean;
  webhook_last_delivery_status: string | null;
  webhook_last_delivery_at: string | null;
};

type Tenant = {
  organization_id: string;
  name: string;
  slug: string | null;
  status: string;
  customer_id: number | null;
  customer_company_name: string | null;
  customer_email: string | null;
  active_plan_name: string | null;
  lines_connected_count: number;
  members_count: number;
  max_whatsapp_accounts: number;
  max_team_members: number;
  agenda_enabled: boolean;
  attribution_enabled: boolean;
  lab_enabled: boolean;
  channels: string;
  has_ai_api_key?: boolean;
  ai_model?: string | null;
  ai_judge_model?: string | null;
  ai_base_url?: string | null;
  agent_coalesce_ms?: number | null;
  created_at: string | null;
};

export default function AdminCrmPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Modelos de OpenRouter
  const [aiModels, setAiModels] = useState<
    { id: string; name: string; is_free: boolean }[]
  >([]);

  // Búsqueda y Paginación (Inquilinos)
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Pestaña Activa
  const [activeTab, setActiveTab] = useState<"tenants" | "whatsapp">("tenants");

  // Gestión de Líneas de WhatsApp
  const [whatsappLines, setWhatsappLines] = useState<WhatsAppLine[]>([]);
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(false);
  const [searchTermWhatsapp, setSearchTermWhatsapp] = useState("");
  const [currentWhatsappPage, setCurrentWhatsappPage] = useState(1);
  const [whatsappPageSize, setWhatsappPageSize] = useState(10);
  const [deletingLine, setDeletingLine] = useState<WhatsAppLine | null>(null);
  const [syncingLineId, setSyncingLineId] = useState<number | null>(null);

  // Modal de Override
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [overrideModalTab, setOverrideModalTab] = useState<"form" | "raw">(
    "form",
  );
  const [rawJsonText, setRawJsonText] = useState<string>("");
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);
  const [extraRawFields, setExtraRawFields] = useState<Record<string, any>>({});
  const [overrideForm, setOverrideForm] = useState({
    organization_name: "",
    max_whatsapp_accounts: 1,
    max_team_members: 2,
    agenda_enabled: false,
    attribution_enabled: false,
    lab_enabled: false,
    messenger_enabled: false,
    instagram_enabled: false,
    ai_api_key: "",
    ai_model: "minimax/minimax-m2.7:free",
    ai_judge_model: "minimax/minimax-m2.7:free",
    ai_base_url: "https://openrouter.ai/api",
    agent_coalesce_ms: 3000,
  });

  // Cargar catálogo de modelos de OpenRouter
  useEffect(() => {
    const token = localStorage.getItem("iqmx_admin_token");
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${apiUrl}/api/admin/crm/ai-models`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.models && Array.isArray(d.models)) {
          setAiModels(d.models);
        }
      })
      .catch(() => {});
  }, []);

  const fetchTenants = useCallback(async () => {
    const token = localStorage.getItem("iqmx_admin_token");
    if (!token) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiUrl}/api/admin/crm/tenants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(data);
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error al conectar con la API central.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWhatsappLines = useCallback(async () => {
    const token = localStorage.getItem("iqmx_admin_token");
    if (!token) return;
    setLoadingWhatsapp(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiUrl}/api/admin/crm/whatsapp-lines`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWhatsappLines(data);
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error al cargar las líneas de WhatsApp.",
      });
    } finally {
      setLoadingWhatsapp(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
    fetchWhatsappLines();
  }, [fetchTenants, fetchWhatsappLines]);

  const handleConfirmDeleteWhatsappLine = async () => {
    if (!deletingLine) return;
    setActionLoading("delete-wa");
    try {
      const token = localStorage.getItem("iqmx_admin_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(
        `${apiUrl}/api/admin/crm/whatsapp-lines/${deletingLine.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setFeedbackMsg({
          type: "success",
          text: data.message || "Línea desvinculada exitosamente.",
        });
        setDeletingLine(null);
        fetchWhatsappLines();
        fetchTenants();
      } else {
        const err = await res.json().catch(() => null);
        setFeedbackMsg({
          type: "error",
          text: err?.detail || "No se pudo desvincular la línea.",
        });
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error de red al intentar desvincular la línea.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReprovisionWhatsappLine = async (lineId: number) => {
    setSyncingLineId(lineId);
    try {
      const token = localStorage.getItem("iqmx_admin_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(
        `${apiUrl}/api/admin/crm/whatsapp-lines/${lineId}/reprovision`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setFeedbackMsg({
          type: "success",
          text: data.message || "Línea sincronizada exitosamente con el CRM.",
        });
        fetchWhatsappLines();
        fetchTenants();
      } else {
        const err = await res.json().catch(() => null);
        setFeedbackMsg({
          type: "error",
          text: err?.detail || "Error al sincronizar con el CRM.",
        });
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error de red al intentar sincronizar con el CRM.",
      });
    } finally {
      setSyncingLineId(null);
    }
  };

  // Filtrado y paginación reactiva de Líneas WhatsApp
  const filteredWhatsappLines = useMemo(() => {
    const term = searchTermWhatsapp.toLowerCase().trim();
    if (!term) return whatsappLines;
    return whatsappLines.filter((l) => {
      return (
        (l.display_phone_number && l.display_phone_number.toLowerCase().includes(term)) ||
        (l.verified_name && l.verified_name.toLowerCase().includes(term)) ||
        l.phone_number_id.toLowerCase().includes(term) ||
        l.waba_id.toLowerCase().includes(term) ||
        (l.customer_company_name && l.customer_company_name.toLowerCase().includes(term)) ||
        (l.customer_email && l.customer_email.toLowerCase().includes(term)) ||
        (l.organization_name && l.organization_name.toLowerCase().includes(term)) ||
        (l.organization_id && l.organization_id.toLowerCase().includes(term))
      );
    });
  }, [whatsappLines, searchTermWhatsapp]);

  const totalWhatsappPages = Math.max(1, Math.ceil(filteredWhatsappLines.length / whatsappPageSize));
  const paginatedWhatsappLines = useMemo(() => {
    const start = (currentWhatsappPage - 1) * whatsappPageSize;
    return filteredWhatsappLines.slice(start, start + whatsappPageSize);
  }, [filteredWhatsappLines, currentWhatsappPage, whatsappPageSize]);


  // Filtrado y paginación reactiva
  const filteredTenants = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return tenants;
    return tenants.filter((t) => {
      return (
        t.name.toLowerCase().includes(term) ||
        t.organization_id.toLowerCase().includes(term) ||
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

  const handleSyncPlan = async (orgId: string) => {
    setActionLoading(orgId);
    setFeedbackMsg(null);
    try {
      const token = localStorage.getItem("iqmx_admin_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(
        `${apiUrl}/api/admin/crm/tenants/${orgId}/sync-plan`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setFeedbackMsg({
          type: "error",
          text: data.detail || "Fallo al sincronizar plan con CRM.",
        });
      } else {
        setFeedbackMsg({
          type: "success",
          text: `Límites del plan sincronizados exitosamente con el CRM.`,
        });
        fetchTenants();
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error de red al despachar al CRM.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (orgId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    setActionLoading(orgId);
    setFeedbackMsg(null);
    try {
      const token = localStorage.getItem("iqmx_admin_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(
        `${apiUrl}/api/admin/crm/tenants/${orgId}/status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      if (!res.ok) {
        setFeedbackMsg({
          type: "error",
          text: "No se pudo cambiar el estado de la organización.",
        });
      } else {
        setFeedbackMsg({
          type: "success",
          text: `Organización ${nextStatus === "active" ? "reactivada" : "suspendida"} correctamente.`,
        });
        fetchTenants();
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Error de red." });
    } finally {
      setActionLoading(null);
    }
  };

  const openOverrideModal = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setOverrideModalTab("form");
    setRawJsonError(null);
    setExtraRawFields({});
    const activeChannels = (tenant.channels || "").split(",").map((c) => c.trim().toLowerCase());
    const formState = {
      organization_name: tenant.name || "",
      max_whatsapp_accounts: tenant.max_whatsapp_accounts,
      max_team_members: tenant.max_team_members,
      agenda_enabled: tenant.agenda_enabled,
      attribution_enabled: tenant.attribution_enabled,
      lab_enabled: tenant.lab_enabled,
      messenger_enabled: activeChannels.includes("messenger"),
      instagram_enabled: activeChannels.includes("instagram"),
      ai_api_key: "",
      ai_model: tenant.ai_model || "minimax/minimax-m2.7:free",
      ai_judge_model: tenant.ai_judge_model || "google/gemma-4-31b-it:free",
      ai_base_url: tenant.ai_base_url || "https://openrouter.ai/api",
      agent_coalesce_ms: tenant.agent_coalesce_ms || 3000,
    };
    setOverrideForm(formState);

    const channelsList = ["whatsapp"];
    if (formState.messenger_enabled) channelsList.push("messenger");
    if (formState.instagram_enabled) channelsList.push("instagram");

    const initialJson: Record<string, any> = {
      organization_name: formState.organization_name,
      max_whatsapp_accounts: formState.max_whatsapp_accounts,
      max_team_members: formState.max_team_members,
      agenda_enabled: formState.agenda_enabled,
      attribution_enabled: formState.attribution_enabled,
      lab_enabled: formState.lab_enabled,
      channels: channelsList.join(","),
      ai_model: formState.ai_model,
      ai_judge_model: formState.ai_judge_model,
      ai_base_url: formState.ai_base_url,
      agent_coalesce_ms: formState.agent_coalesce_ms,
    };
    setRawJsonText(JSON.stringify(initialJson, null, 2));
  };

  const handleSwitchTab = (targetTab: "form" | "raw") => {
    if (targetTab === overrideModalTab) return;

    if (targetTab === "raw") {
      const channelsList = ["whatsapp"];
      if (overrideForm.messenger_enabled) channelsList.push("messenger");
      if (overrideForm.instagram_enabled) channelsList.push("instagram");

      const payload: Record<string, any> = {
        ...extraRawFields,
        max_whatsapp_accounts: overrideForm.max_whatsapp_accounts,
        max_team_members: overrideForm.max_team_members,
        agenda_enabled: overrideForm.agenda_enabled,
        attribution_enabled: overrideForm.attribution_enabled,
        lab_enabled: overrideForm.lab_enabled,
        channels: channelsList.join(","),
        ai_model: overrideForm.ai_model,
        ai_judge_model: overrideForm.ai_judge_model,
        ai_base_url: overrideForm.ai_base_url,
        agent_coalesce_ms: overrideForm.agent_coalesce_ms,
      };
      if (overrideForm.ai_api_key.trim()) {
        payload.ai_api_key = overrideForm.ai_api_key.trim();
      }
      setRawJsonText(JSON.stringify(payload, null, 2));
      setRawJsonError(null);
      setOverrideModalTab("raw");
    } else {
      try {
        const parsed = JSON.parse(rawJsonText);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          setRawJsonError(
            "El contenido debe ser un objeto JSON válido con pares clave-valor.",
          );
          return;
        }
        setOverrideForm((prev) => ({
          ...prev,
          max_whatsapp_accounts:
            typeof parsed.max_whatsapp_accounts === "number"
              ? parsed.max_whatsapp_accounts
              : prev.max_whatsapp_accounts,
          max_team_members:
            typeof parsed.max_team_members === "number"
              ? parsed.max_team_members
              : prev.max_team_members,
          agenda_enabled:
            typeof parsed.agenda_enabled === "boolean"
              ? parsed.agenda_enabled
              : prev.agenda_enabled,
          attribution_enabled:
            typeof parsed.attribution_enabled === "boolean"
              ? parsed.attribution_enabled
              : prev.attribution_enabled,
          lab_enabled:
            typeof parsed.lab_enabled === "boolean"
              ? parsed.lab_enabled
              : prev.lab_enabled,
          messenger_enabled:
            typeof parsed.channels === "string"
              ? parsed.channels.toLowerCase().includes("messenger")
              : typeof parsed.messenger_enabled === "boolean"
                ? parsed.messenger_enabled
                : prev.messenger_enabled,
          instagram_enabled:
            typeof parsed.channels === "string"
              ? parsed.channels.toLowerCase().includes("instagram")
              : typeof parsed.instagram_enabled === "boolean"
                ? parsed.instagram_enabled
                : prev.instagram_enabled,
          ai_model:
            typeof parsed.ai_model === "string"
              ? parsed.ai_model
              : prev.ai_model,
          ai_judge_model:
            typeof parsed.ai_judge_model === "string"
              ? parsed.ai_judge_model
              : prev.ai_judge_model,
          ai_base_url:
            typeof parsed.ai_base_url === "string"
              ? parsed.ai_base_url
              : prev.ai_base_url,
          agent_coalesce_ms:
            typeof parsed.agent_coalesce_ms === "number"
              ? parsed.agent_coalesce_ms
              : prev.agent_coalesce_ms,
          ai_api_key:
            typeof parsed.ai_api_key === "string"
              ? parsed.ai_api_key
              : prev.ai_api_key,
        }));

        const knownKeys = new Set([
          "max_whatsapp_accounts",
          "max_team_members",
          "agenda_enabled",
          "attribution_enabled",
          "lab_enabled",
          "channels",
          "messenger_enabled",
          "instagram_enabled",
          "ai_model",
          "ai_judge_model",
          "ai_base_url",
          "agent_coalesce_ms",
          "ai_api_key",
        ]);
        const extras: Record<string, any> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (!knownKeys.has(k)) {
            extras[k] = v;
          }
        }
        setExtraRawFields(extras);
        setRawJsonError(null);
        setOverrideModalTab("form");
      } catch (err: any) {
        setRawJsonError(`Sintaxis JSON inválida: ${err.message}`);
      }
    }
  };

  const handlePrettifyJson = () => {
    try {
      const parsed = JSON.parse(rawJsonText);
      setRawJsonText(JSON.stringify(parsed, null, 2));
      setRawJsonError(null);
    } catch (err: any) {
      setRawJsonError(`No se puede formatear: ${err.message}`);
    }
  };

  const handleSaveOverride = async () => {
    if (!selectedTenant) return;
    setActionLoading("modal");
    setFeedbackMsg(null);
    setRawJsonError(null);

    let payload: Record<string, any> = {};

    if (overrideModalTab === "raw") {
      try {
        const parsed = JSON.parse(rawJsonText);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          setRawJsonError("El contenido debe ser un objeto JSON válido.");
          setActionLoading(null);
          return;
        }
        payload = parsed;
      } catch (err: any) {
        setRawJsonError(`Sintaxis JSON inválida: ${err.message}`);
        setActionLoading(null);
        return;
      }
    } else {
      const channelsList = ["whatsapp"];
      if (overrideForm.messenger_enabled) channelsList.push("messenger");
      if (overrideForm.instagram_enabled) channelsList.push("instagram");

      payload = {
        ...extraRawFields,
        organization_name: overrideForm.organization_name.trim(),
        max_whatsapp_accounts: overrideForm.max_whatsapp_accounts,
        max_team_members: overrideForm.max_team_members,
        agenda_enabled: overrideForm.agenda_enabled,
        attribution_enabled: overrideForm.attribution_enabled,
        lab_enabled: overrideForm.lab_enabled,
        channels: channelsList.join(","),
        ai_model: overrideForm.ai_model,
        ai_judge_model: overrideForm.ai_judge_model,
        ai_base_url: overrideForm.ai_base_url,
        agent_coalesce_ms: overrideForm.agent_coalesce_ms,
      };
      if (overrideForm.ai_api_key.trim()) {
        payload.ai_api_key = overrideForm.ai_api_key.trim();
      }
    }

    try {
      const token = localStorage.getItem("iqmx_admin_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

      const res = await fetch(
        `${apiUrl}/api/admin/crm/tenants/${selectedTenant.organization_id}/override`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        const errorText = data.detail || "Error al aplicar ajustes en el CRM.";
        if (overrideModalTab === "raw") {
          setRawJsonError(errorText);
        } else {
          setFeedbackMsg({
            type: "error",
            text: errorText,
          });
        }
      } else {
        setFeedbackMsg({
          type: "success",
          text: "Límites y configuración aplicados de inmediato en el CRM.",
        });
        setSelectedTenant(null);
        fetchTenants();
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error de conexión con el servidor central.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado con Botones de Acción */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Gestión del Microservicio CRM
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Supervisa inquilinos, monitorea uso y cuotas M2M de forma
            centralizada.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              setLoading(true);
              fetchTenants();
              fetchWhatsappLines();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-gray-300 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-xs transition-colors cursor-pointer"
          >
            <ArrowPathIcon
              className={`h-4 w-4 text-gray-500 ${loading || loadingWhatsapp ? "animate-spin" : ""}`}
            />
            <span>Refrescar</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`rounded-xl border p-4 text-xs font-medium flex items-center gap-2.5 ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {feedbackMsg.type === "success" ? (
            <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <ExclamationCircleIcon className="h-5 w-5 text-red-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Selector de Pestañas Principales */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          onClick={() => setActiveTab("tenants")}
          className={`flex items-center gap-2 pb-3 pt-1 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "tenants"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <BuildingOffice2Icon className="h-4 w-4" />
          <span>Inquilinos CRM</span>
          <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {tenants.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("whatsapp")}
          className={`flex items-center gap-2 pb-3 pt-1 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "whatsapp"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <ChatBubbleLeftRightIcon className="h-4 w-4" />
          <span>Líneas de WhatsApp & Webhooks</span>
          <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {whatsappLines.length}
          </span>
          {whatsappLines.some((l) => !l.is_synced_in_crm) && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {whatsappLines.filter((l) => !l.is_synced_in_crm).length} huérfanas
            </span>
          )}
        </button>
      </div>

      {/* PESTAÑA 1: INQUILINOS CRM */}
      {activeTab === "tenants" && (
        <>
          {/* Barra de Filtros y Paginación Superior */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por empresa, ID de tenant o correo…"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <span>Mostrar:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-600"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <span>
                {filteredTenants.length === 0
                  ? "0 cuentas"
                  : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredTenants.length)} de ${filteredTenants.length}`}
              </span>
            </div>
          </div>

          {/* Tabla Ergonómica y Optimizada de 5 Columnas */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Organización y Cliente</th>
                    <th className="px-5 py-3.5">Plan y Capacidad</th>
                    <th className="px-5 py-3.5">Servicios (IA y Módulos)</th>
                    <th className="px-5 py-3.5">Estado</th>
                    <th className="px-5 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedTenants.map((t) => (
                    <tr
                      key={t.organization_id}
                      className="hover:bg-gray-50/75 transition-colors"
                    >
                      {/* Columna 1: Organización y Cliente */}
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <p className="font-bold text-gray-900 text-sm">
                            {t.name}
                          </p>
                          <p className="font-mono text-[11px] text-gray-400 select-all">
                            {t.organization_id}
                          </p>
                          {t.customer_company_name ? (
                            <div className="flex items-center gap-1.5 pt-0.5 text-gray-600">
                              <BuildingOffice2Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              <span className="font-medium text-gray-800">
                                {t.customer_company_name}
                              </span>
                              {t.customer_email && (
                                <span className="text-gray-400 text-[11px]">
                                  ({t.customer_email})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">
                              Sin cliente corporativo vinculado
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Columna 2: Plan y Capacidad */}
                      <td className="px-5 py-4">
                        <div className="space-y-1.5">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 font-semibold text-blue-700 border border-blue-200 text-[11px] whitespace-nowrap">
                            {t.active_plan_name || "Personalizado"}
                          </span>
                          <div className="flex flex-col gap-0.5 text-[11px] text-gray-600">
                            <span>
                              <strong>Líneas:</strong>{" "}
                              <span
                                className={
                                  t.lines_connected_count >= t.max_whatsapp_accounts
                                    ? "text-amber-600 font-bold"
                                    : "text-gray-800"
                                }
                              >
                                {t.lines_connected_count} /{" "}
                                {t.max_whatsapp_accounts}
                              </span>
                            </span>
                            <span>
                              <strong>Miembros:</strong> {t.members_count} /{" "}
                              {t.max_team_members}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Columna 3: Servicios (IA y Módulos) */}
                      <td className="px-5 py-4">
                        <div className="space-y-1.5">
                          {/* Estado de IA y Modelo */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium text-[11px] border ${
                                t.has_ai_api_key
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-gray-100 text-gray-600 border-gray-200"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  t.has_ai_api_key
                                    ? "bg-purple-600"
                                    : "bg-gray-400"
                                }`}
                              />
                              {t.has_ai_api_key ? "IA Propia" : "IA Global"}
                            </span>
                            {t.ai_model && (
                              <span className="text-[11px] text-gray-500 font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                                {t.ai_model.split("/").pop()}
                              </span>
                            )}
                          </div>

                          {/* Módulos Activos (Badges) */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {t.agenda_enabled && (
                              <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                                Agenda
                              </span>
                            )}
                            {t.attribution_enabled && (
                              <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 border border-indigo-200">
                                Atribución
                              </span>
                            )}
                            {t.lab_enabled && (
                              <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                                Lab
                              </span>
                            )}
                            {t.channels && t.channels !== "whatsapp" && (
                              <span className="inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 border border-sky-200">
                                Multi-canal
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Columna 4: Estado */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
                            t.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : t.status === "trial"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : t.status === "suspended"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              t.status === "active"
                                ? "bg-emerald-500"
                                : t.status === "trial"
                                  ? "bg-blue-500"
                                  : t.status === "suspended"
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                            }`}
                          />
                          {t.status.toUpperCase()}
                        </span>
                      </td>

                      {/* Columna 5: Acciones */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botón Sincronizar Membresía */}
                          <button
                            onClick={() => handleSyncPlan(t.organization_id)}
                            disabled={actionLoading === t.organization_id}
                            title="Forzar resincronización de plan y beneficios"
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <ArrowPathIcon
                              className={`h-3 w-3 ${actionLoading === t.organization_id ? "animate-spin text-blue-600" : "text-gray-500"}`}
                            />
                            <span>Sincronizar</span>
                          </button>

                          {/* Botón Ajustes / Override */}
                          <button
                            onClick={() => openOverrideModal(t)}
                            title="Ajustar límites manualmente (Override)"
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
                            <span>Ajustar</span>
                          </button>

                          {/* Botón Suspender / Reactivar */}
                          <button
                            onClick={() =>
                              handleToggleStatus(t.organization_id, t.status)
                            }
                            disabled={actionLoading === t.organization_id}
                            title={
                              t.status === "active"
                                ? "Suspender acceso"
                                : "Reactivar acceso"
                            }
                            className={`rounded-lg p-1.5 border transition-colors cursor-pointer ${
                              t.status === "active"
                                ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                                : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                            }`}
                          >
                            {t.status === "active" ? (
                              <NoSymbolIcon className="h-4 w-4" />
                            ) : (
                              <CheckCircleIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {paginatedTenants.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center text-gray-500"
                      >
                        <BuildingOffice2Icon className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                        <p className="font-medium text-sm text-gray-700">
                          No se encontraron inquilinos
                        </p>
                        {searchTerm ? (
                          <p className="text-xs text-gray-400 mt-1">
                            No hay resultados para "{searchTerm}". Prueba con
                            otro término.
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">
                            No existen organizaciones creadas en el CRM en este
                            momento.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación Inferior */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-5 py-3 text-xs text-gray-600">
                <span>
                  Página <strong>{currentPage}</strong> de{" "}
                  <strong>{totalPages}</strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                    <span>Anterior</span>
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                  >
                    <span>Siguiente</span>
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* PESTAÑA 2: LÍNEAS DE WHATSAPP & WEBHOOKS */}
      {activeTab === "whatsapp" && (
        <div className="space-y-6">
          {/* Tarjetas de Métricas Resumen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
              <p className="text-xs font-medium text-gray-500">Total Líneas Registradas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{whatsappLines.length}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">En base central public.whatsapp_numbers</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
              <p className="text-xs font-medium text-gray-500">Líneas Conectadas</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {whatsappLines.filter((l) => l.status === "connected").length}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Activas y listas para recibir mensajes</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
              <p className="text-xs font-medium text-gray-500">Sincronizadas en CRM</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {whatsappLines.filter((l) => l.is_synced_in_crm).length}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Presentes en crm.meta_credentials</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
              <p className="text-xs font-medium text-gray-500">Huérfanas / Desincronizadas</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  whatsappLines.some((l) => !l.is_synced_in_crm)
                    ? "text-amber-600"
                    : "text-gray-900"
                }`}
              >
                {whatsappLines.filter((l) => !l.is_synced_in_crm).length}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {whatsappLines.some((l) => !l.is_synced_in_crm)
                  ? "Requieren atención o desvinculación"
                  : "Todo el catálogo está alineado"}
              </p>
            </div>
          </div>

          {/* Barra de Filtros y Búsqueda de WhatsApp */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por teléfono, empresa, WABA o Phone ID…"
                value={searchTermWhatsapp}
                onChange={(e) => {
                  setSearchTermWhatsapp(e.target.value);
                  setCurrentWhatsappPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <span>Mostrar:</span>
                <select
                  value={whatsappPageSize}
                  onChange={(e) => {
                    setWhatsappPageSize(Number(e.target.value));
                    setCurrentWhatsappPage(1);
                  }}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 focus:border-blue-600"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <span>
                {filteredWhatsappLines.length === 0
                  ? "0 líneas"
                  : `${(currentWhatsappPage - 1) * whatsappPageSize + 1}–${Math.min(currentWhatsappPage * whatsappPageSize, filteredWhatsappLines.length)} de ${filteredWhatsappLines.length}`}
              </span>
            </div>
          </div>

          {/* Tabla de Líneas de WhatsApp */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Línea y Número</th>
                    <th className="px-5 py-3.5">Cliente Propietario</th>
                    <th className="px-5 py-3.5">Inquilino CRM</th>
                    <th className="px-5 py-3.5">Webhook de Reenvío</th>
                    <th className="px-5 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedWhatsappLines.map((line) => (
                    <tr key={line.id} className="hover:bg-gray-50/75 transition-colors">
                      {/* Columna 1: Línea y Número */}
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <PhoneIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="font-bold text-gray-900 text-sm">
                              {line.display_phone_number || "(Sin número registrado)"}
                            </span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                line.status === "connected"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }`}
                            >
                              {line.status === "connected" ? "Conectada" : line.status}
                            </span>
                          </div>
                          {line.verified_name && (
                            <p className="text-gray-600 text-xs font-medium">
                              {line.verified_name}
                            </p>
                          )}
                          <div className="flex items-center gap-2 pt-0.5 text-[10px] text-gray-400 font-mono">
                            <span>ID #{line.id}</span>
                            <span>•</span>
                            <span>Phone ID: {line.phone_number_id}</span>
                            <span>•</span>
                            <span>WABA: {line.waba_id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Columna 2: Cliente Propietario */}
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <p className="font-bold text-gray-900">
                            {line.customer_company_name || `Cliente #${line.customer_id}`}
                          </p>
                          {line.customer_email && (
                            <p className="text-gray-500 text-[11px]">{line.customer_email}</p>
                          )}
                          <p className="text-gray-400 text-[10px]">
                            Cliente ID: {line.customer_id}
                          </p>
                        </div>
                      </td>

                      {/* Columna 3: Inquilino CRM */}
                      <td className="px-5 py-4">
                        <div className="space-y-1.5">
                          {line.organization_name ? (
                            <p className="font-medium text-gray-800">
                              {line.organization_name}
                            </p>
                          ) : (
                            <p className="text-gray-400 italic text-[11px]">
                              Sin inquilino vinculado
                            </p>
                          )}
                          <div>
                            {line.is_synced_in_crm ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                                <CheckCircleIcon className="h-3 w-3" />
                                <span>Sincronizado en CRM</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                                <ExclamationCircleIcon className="h-3 w-3" />
                                <span>Huérfano (Falta en CRM)</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Columna 4: Webhook de Reenvío */}
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          {line.webhook_url ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <SignalIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span
                                  className="font-mono text-[11px] text-gray-700 truncate max-w-[220px]"
                                  title={line.webhook_url}
                                >
                                  {line.webhook_url}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border ${
                                    line.webhook_is_active
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-gray-100 text-gray-600 border-gray-200"
                                  }`}
                                >
                                  {line.webhook_is_active ? "Activo" : "Inactivo"}
                                </span>
                                {line.webhook_last_delivery_status && (
                                  <span className="text-[10px] text-gray-400">
                                    Último: {line.webhook_last_delivery_status}
                                  </span>
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">
                              Sin webhook configurado
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Columna 5: Acciones */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botón Sincronizar / Reprovisionar al CRM */}
                          <button
                            onClick={() => handleReprovisionWhatsappLine(line.id)}
                            disabled={syncingLineId === line.id}
                            title="Re-aprovisionar credenciales hacia el microservicio CRM"
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <ArrowPathIcon
                              className={`h-3 w-3 ${
                                syncingLineId === line.id
                                  ? "animate-spin text-blue-600"
                                  : "text-gray-500"
                              }`}
                            />
                            <span>Sincronizar</span>
                          </button>

                          {/* Botón Desvincular Forzosamente */}
                          <button
                            onClick={() => setDeletingLine(line)}
                            title="Desvincular línea de la API, CRM y Meta"
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 shadow-2xs transition-colors cursor-pointer"
                          >
                            <TrashIcon className="h-3 w-3 text-red-600" />
                            <span>Desvincular</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {paginatedWhatsappLines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-500">
                        <ChatBubbleLeftRightIcon className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                        <p className="font-medium text-sm text-gray-700">
                          No se encontraron líneas de WhatsApp
                        </p>
                        {searchTermWhatsapp ? (
                          <p className="text-xs text-gray-400 mt-1">
                            No hay resultados para "{searchTermWhatsapp}". Prueba con otro término.
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">
                            Aún no hay números de WhatsApp registrados en la plataforma.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación Inferior de WhatsApp */}
            {totalWhatsappPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-5 py-3 text-xs text-gray-600">
                <span>
                  Página <strong>{currentWhatsappPage}</strong> de{" "}
                  <strong>{totalWhatsappPages}</strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentWhatsappPage((p) => Math.max(1, p - 1))}
                    disabled={currentWhatsappPage === 1}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                    <span>Anterior</span>
                  </button>
                  <button
                    onClick={() =>
                      setCurrentWhatsappPage((p) => Math.min(totalWhatsappPages, p + 1))
                    }
                    disabled={currentWhatsappPage === totalWhatsappPages}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 font-medium hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                  >
                    <span>Siguiente</span>
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Desvincular Línea de WhatsApp */}
      {deletingLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-200">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-red-600">
                <TrashIcon className="h-5 w-5" />
                <h3 className="text-base font-bold text-gray-900">
                  Desvincular Línea de WhatsApp
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingLine(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-gray-600">
              <p>
                ¿Estás seguro de que deseas desvincular forzosamente la línea{" "}
                <strong className="text-gray-900">
                  {deletingLine.display_phone_number || deletingLine.phone_number_id}
                </strong>
                {deletingLine.verified_name ? ` (${deletingLine.verified_name})` : ""}?
              </p>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800 space-y-1">
                <p className="font-semibold">Esta acción ejecutará:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Eliminación en la API Central (<code className="font-mono">public.whatsapp_numbers</code>) para liberar el número y permitir re-onboarding.</li>
                  <li>Eliminación de credenciales en el CRM (<code className="font-mono">crm.meta_credentials</code>).</li>
                  <li>Desuscripción en Meta (<code className="font-mono">DELETE /{deletingLine.waba_id}/subscribed_apps</code>) si no quedan más líneas en esa cuenta.</li>
                </ul>
              </div>

              <div className="text-[11px] text-gray-500 font-mono bg-gray-50 p-2.5 rounded border border-gray-200 space-y-0.5">
                <p>Phone Number ID: {deletingLine.phone_number_id}</p>
                <p>WABA ID: {deletingLine.waba_id}</p>
                <p>Cliente ID: {deletingLine.customer_id} ({deletingLine.customer_company_name || "Sin empresa"})</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setDeletingLine(null)}
                className="rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteWhatsappLine}
                disabled={actionLoading === "delete-wa"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {actionLoading === "delete-wa" ? (
                  <>
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                    <span>Desvinculando…</span>
                  </>
                ) : (
                  <span>Confirmar Desvinculación</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ajuste de Beneficios y Configuración */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-gray-200 max-h-[92vh] overflow-y-auto">
            {/* Cabecera */}
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Ajuste de Beneficios y Configuración
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Organización:{" "}
                  <strong className="text-gray-800">
                    {selectedTenant.name}
                  </strong>{" "}
                  • ID {selectedTenant.organization_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTenant(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Selector de Pestañas: Formulario Asistido / Editor Raw JSON */}
            <div className="mt-4 flex items-center gap-2 border-b border-gray-200 pb-2">
              <button
                type="button"
                onClick={() => handleSwitchTab("form")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  overrideModalTab === "form"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <DocumentTextIcon className="h-4 w-4" />
                <span>Formulario Asistido</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab("raw")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  overrideModalTab === "raw"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <CodeBracketIcon className="h-4 w-4" />
                <span>Editor JSON Raw</span>
              </button>
            </div>

            {/* Vista 1: Formulario Asistido */}
            {overrideModalTab === "form" && (
              <div className="mt-4 space-y-4">
                {/* Nombre de la Empresa / Organización */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Nombre de la Empresa / CRM
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={overrideForm.organization_name}
                    onChange={(e) =>
                      setOverrideForm({
                        ...overrideForm,
                        organization_name: e.target.value,
                      })
                    }
                    placeholder="Ej. Mi Empresa o Marca"
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Sección Límites y Cuotas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">
                      Líneas WhatsApp
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={overrideForm.max_whatsapp_accounts}
                      onChange={(e) =>
                        setOverrideForm({
                          ...overrideForm,
                          max_whatsapp_accounts: parseInt(e.target.value) || 1,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700">
                      Miembros Equipo
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={overrideForm.max_team_members}
                      onChange={(e) =>
                        setOverrideForm({
                          ...overrideForm,
                          max_team_members: parseInt(e.target.value) || 1,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </div>

                {/* Módulos */}
                <div className="pt-3 space-y-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-800">
                    Módulos Adicionales
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overrideForm.agenda_enabled}
                        onChange={(e) =>
                          setOverrideForm({
                            ...overrideForm,
                            agenda_enabled: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Agenda</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overrideForm.attribution_enabled}
                        onChange={(e) =>
                          setOverrideForm({
                            ...overrideForm,
                            attribution_enabled: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Meta CAPI</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overrideForm.lab_enabled}
                        onChange={(e) =>
                          setOverrideForm({
                            ...overrideForm,
                            lab_enabled: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Laboratorio</span>
                    </label>
                  </div>
                </div>

                {/* Canales y Redes Sociales */}
                <div className="pt-3 space-y-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-800">
                      Canales y Redes Sociales Habilitadas
                    </p>
                    <span className="text-[11px] text-gray-400">
                      Multi-Tenant estricto
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-not-allowed opacity-75">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled={true}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>WhatsApp (Base)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overrideForm.messenger_enabled}
                        onChange={(e) =>
                          setOverrideForm({
                            ...overrideForm,
                            messenger_enabled: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span>Facebook Messenger</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overrideForm.instagram_enabled}
                        onChange={(e) =>
                          setOverrideForm({
                            ...overrideForm,
                            instagram_enabled: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                      />
                      <span>Instagram Direct</span>
                    </label>
                  </div>
                </div>

                {/* Configuración de Inteligencia Artificial */}
                <div className="pt-3 space-y-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-800">
                      Configuración de Inteligencia Artificial
                    </p>
                    {selectedTenant.has_ai_api_key && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        Clave Guardada
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700">
                      OpenRouter API Key
                    </label>
                    <input
                      type="password"
                      placeholder={
                        selectedTenant.has_ai_api_key
                          ? "••••••••••••••••••••"
                          : "sk-or-v1-..."
                      }
                      value={overrideForm.ai_api_key}
                      onChange={(e) =>
                        setOverrideForm({
                          ...overrideForm,
                          ai_api_key: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 font-mono focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      {selectedTenant.has_ai_api_key
                        ? "Dejar en blanco para conservar la clave actual guardada."
                        : "Cada inquilino utiliza su propia API Key de OpenRouter para consultas a LLMs."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Modelo IA Chat
                      </label>
                      <input
                        type="text"
                        list="ai-models-list"
                        placeholder="minimax/minimax-m2.7:free"
                        value={overrideForm.ai_model}
                        onChange={(e) =>
                          setOverrideForm({
                            ...overrideForm,
                            ai_model: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 font-mono focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                      <datalist id="ai-models-list">
                        {aiModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.is_free ? "• Gratis" : ""}
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Modelo IA Juez
                      </label>
                      <input
                        type="text"
                        list="ai-models-list"
                        placeholder="google/gemma-4-31b-it:free"
                        value={overrideForm.ai_judge_model}
                        onChange={(e) =>
                          setOverrideForm({
                            ...overrideForm,
                            ai_judge_model: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 font-mono focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Base URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://openrouter.ai/api"
                        value={overrideForm.ai_base_url}
                        onChange={(e) =>
                          setOverrideForm({
                            ...overrideForm,
                            ai_base_url: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 font-mono focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Ventana Agrupamiento ms
                      </label>
                      <input
                        type="number"
                        min={500}
                        max={30000}
                        step={500}
                        placeholder="3000"
                        value={overrideForm.agent_coalesce_ms}
                        onChange={(e) =>
                          setOverrideForm({
                            ...overrideForm,
                            agent_coalesce_ms: parseInt(e.target.value) || 3000,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {Object.keys(extraRawFields).length > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-800">
                    <span className="font-semibold">
                      Parámetros extra activos:
                    </span>{" "}
                    Hay {Object.keys(extraRawFields).length} propiedad(es)
                    personalizada(s) configurada(s) en la vista Raw que se
                    conservarán al guardar.
                  </div>
                )}
              </div>
            )}

            {/* Vista 2: Editor JSON Raw */}
            {overrideModalTab === "raw" && (
              <div className="mt-4">
                <RawJsonEditor
                  value={rawJsonText}
                  onChange={(val) => {
                    setRawJsonText(val);
                    setRawJsonError(null);
                  }}
                  error={rawJsonError}
                  onErrorChange={setRawJsonError}
                  rows={13}
                  label="Payload Raw de Ajustes"
                  description="Edita el payload directamente para agregar parámetros no contemplados en el formulario."
                  tip="Tip: Puedes agregar nuevas claves a nivel raíz o dentro del objeto extra. Serán enviadas y persistidas en el CRM."
                />
              </div>
            )}

            {/* Botones de Acción Inferiores */}
            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setSelectedTenant(null)}
                className="rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveOverride}
                disabled={actionLoading === "modal"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {actionLoading === "modal" ? (
                  <>
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                    <span>Aplicando en CRM…</span>
                  </>
                ) : (
                  <span>Aplicar al CRM</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
