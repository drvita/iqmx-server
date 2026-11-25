"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  XCircleIcon,
  PhoneIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  PlusIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

type Customer = {
  id: number;
  user_id: number;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  tax_id: string | null;
  origin: string;
  is_active: boolean;
  forum_enabled: boolean;
  has_password?: boolean;
  has_real_email?: boolean;
  privacy_accepted_at: string;
  created_at: string;
  whatsapp_numbers_count: number;
  active_plans: string[];
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Estados para modal de edición
  const [selectedCustomerForEdit, setSelectedCustomerForEdit] =
    useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    tax_id: "",
    is_active: true,
    forum_enabled: false,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Estados para modal de creación manual
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    company_name: "",
    contact_name: "",
    phone: "",
    email: "",
    tax_id: "",
    forum_enabled: true,
  });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchCustomers = useCallback(async () => {
    const token = localStorage.getItem("iqmx_admin_token");
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    try {
      const res = await fetch(`${apiUrl}/api/admin/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch {
      // Manejar error silenciosamente
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (!showCreateModal && !selectedCustomerForEdit) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowCreateModal(false);
        setSelectedCustomerForEdit(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showCreateModal, selectedCustomerForEdit]);

  const handleToggleStatus = async (customer: Customer) => {
    const token = localStorage.getItem("iqmx_admin_token");
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    setUpdatingId(customer.id);
    setFeedbackMsg(null);

    try {
      const res = await fetch(
        `${apiUrl}/api/admin/customers/${customer.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_active: !customer.is_active }),
        },
      );

      if (res.ok) {
        const updated = await res.json();
        setCustomers((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
        setFeedbackMsg({
          type: "success",
          text: `Estado de ${updated.company_name} actualizado a ${updated.is_active ? "Activo" : "Suspendido"}.`,
        });
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error al cambiar estado del cliente.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleForumEnabled = async (customer: Customer) => {
    const token = localStorage.getItem("iqmx_admin_token");
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    setUpdatingId(customer.id);
    setFeedbackMsg(null);

    try {
      const res = await fetch(`${apiUrl}/api/admin/customers/${customer.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ forum_enabled: !customer.forum_enabled }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCustomers((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
        setFeedbackMsg({
          type: "success",
          text: `${updated.company_name} ${updated.forum_enabled ? "habilitada" : "deshabilitada"} en el Foro Colaborativo.`,
        });
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error al cambiar visibilidad de la empresa en el foro.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const openCreateModal = () => {
    setCreateForm({
      company_name: "",
      contact_name: "",
      phone: "",
      email: "",
      tax_id: "",
      forum_enabled: true,
    });
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setFeedbackMsg(null);

    const cleanPhone = createForm.phone.trim();
    const cleanEmail = createForm.email.trim();
    if (!cleanPhone && !cleanEmail) {
      setCreateError(
        "Debes ingresar al menos un número de teléfono o un correo electrónico.",
      );
      return;
    }

    const token = localStorage.getItem("iqmx_admin_token");
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    setCreateSaving(true);

    try {
      const res = await fetch(`${apiUrl}/api/admin/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          company_name: createForm.company_name.trim(),
          contact_name: createForm.contact_name.trim(),
          phone: cleanPhone || null,
          email: cleanEmail || null,
          tax_id: createForm.tax_id.trim() || null,
          forum_enabled: createForm.forum_enabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : "Error al registrar el cliente.";
        setCreateError(detail);
      } else {
        setCustomers((prev) => [data, ...prev]);
        setFeedbackMsg({
          type: "success",
          text: `Cliente ${data.company_name} registrado exitosamente.`,
        });
        setShowCreateModal(false);
      }
    } catch {
      setCreateError("Error de comunicación con el servidor.");
    } finally {
      setCreateSaving(false);
    }
  };

  const openEditModal = (c: Customer) => {
    setSelectedCustomerForEdit(c);
    setEditForm({
      company_name: c.company_name,
      contact_name: c.contact_name,
      email: c.has_real_email === false ? "" : c.email,
      phone: c.phone || "",
      tax_id: c.tax_id || "",
      is_active: c.is_active,
      forum_enabled: Boolean(c.forum_enabled),
    });
    setEditError(null);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForEdit) return;
    setEditSaving(true);
    setEditError(null);
    setFeedbackMsg(null);

    const token = localStorage.getItem("iqmx_admin_token");
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

    try {
      const res = await fetch(
        `${apiUrl}/api/admin/customers/${selectedCustomerForEdit.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            company_name: editForm.company_name.trim(),
            contact_name: editForm.contact_name.trim(),
            ...(editForm.email.trim() ? { email: editForm.email.trim() } : {}),
            phone: editForm.phone.trim() || null,
            tax_id: editForm.tax_id.trim() || null,
            is_active: editForm.is_active,
            forum_enabled: editForm.forum_enabled,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        setEditError(
          data.detail || "Error al actualizar información del cliente.",
        );
      } else {
        setCustomers((prev) => prev.map((c) => (c.id === data.id ? data : c)));
        setFeedbackMsg({
          type: "success",
          text: `Datos de ${data.company_name} actualizados exitosamente.`,
        });
        setSelectedCustomerForEdit(null);
      }
    } catch {
      setEditError("Error de comunicación con el servidor.");
    } finally {
      setEditSaving(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.company_name.toLowerCase().includes(term) ||
      c.contact_name.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.phone && c.phone.includes(term)) ||
      (c.tax_id && c.tax_id.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Clientes Corporativos
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Directorio central de empresas registradas en la plataforma
            IQISSMexico.
          </p>
        </div>

        {/* Buscador Rápido y Botón Alta Manual */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative sm:w-64 w-full">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por empresa, email, RFC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer whitespace-nowrap"
          >
            <PlusIcon className="h-4 w-4 shrink-0" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-gray-400 hover:text-gray-600 cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700 min-w-[760px]">
          <thead className="bg-gray-50/80 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
            <tr>
              <th className="px-5 py-3.5">Empresa y Contacto</th>
              <th className="px-5 py-3.5">Correo y Teléfono</th>
              <th className="px-4 py-3.5">Membresías Activas</th>
              <th className="px-4 py-3.5">Origen</th>
              <th className="px-4 py-3.5">Foro</th>
              <th className="px-4 py-3.5">Estado</th>
              <th className="px-4 py-3.5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredCustomers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/75 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/70 mt-0.5">
                      <BuildingOffice2Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0" title={`#${c.id}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">
                          {c.company_name}
                        </span>
                        {c.has_password === false && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                            Sin acceso al portal
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-medium text-gray-700">
                          {c.contact_name}
                        </span>
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4">
                  {c.has_real_email === false ? (
                    <p className="text-[11px] text-gray-400 italic">
                      Sin correo registrado
                    </p>
                  ) : (
                    <p className="font-mono text-xs text-gray-800">{c.email}</p>
                  )}
                  {c.phone ? (
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                      <PhoneIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span>{c.phone}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400 mt-1 italic">
                      Sin teléfono registrado
                    </p>
                  )}
                </td>

                <td className="px-4 py-4">
                  {c.active_plans.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {c.active_plans.map((p, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200"
                        >
                          <SparklesIcon className="h-3 w-3 text-blue-600" />
                          <span>{p}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">
                      Sin plan activo
                    </span>
                  )}
                </td>

                <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-600">
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                    {c.origin === "web_signup"
                      ? "Registro Web"
                      : c.origin === "direct_sales"
                        ? "Cliente Físico"
                        : c.origin === "admin_granted"
                          ? "Alta Manual"
                          : c.origin}
                  </span>
                </td>

                <td className="px-4 py-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleToggleForumEnabled(c)}
                    disabled={updatingId === c.id}
                    title="Clic para habilitar o deshabilitar en el Foro Colaborativo"
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
                      c.forum_enabled
                        ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                    }`}
                  >
                    {c.forum_enabled ? "Habilitada" : "Oculta"}
                  </button>
                </td>

                <td className="px-4 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleToggleStatus(c)}
                    disabled={updatingId === c.id}
                    title="Clic para cambiar estado"
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
                      c.is_active
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                    }`}
                  >
                    {c.is_active ? (
                      <>
                        <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>Activo</span>
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        <span>Suspendido</span>
                      </>
                    )}
                  </button>
                </td>

                <td className="px-4 py-4 text-center whitespace-nowrap">
                  <button
                    onClick={() => openEditModal(c)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer shadow-2xs"
                  >
                    <PencilSquareIcon className="h-4 w-4 text-gray-500 shrink-0" />
                    <span>Editar</span>
                  </button>
                </td>
              </tr>
            ))}

            {filteredCustomers.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400">
                  {searchTerm
                    ? "No se encontraron clientes que coincidan con la búsqueda."
                    : "No hay clientes registrados en la plataforma todavía."}
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400">
                  Cargando directorio de clientes…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Registro Manual de Cliente */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-customer-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-gray-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div>
                <h3
                  id="create-customer-modal-title"
                  className="text-base font-bold text-gray-900"
                >
                  Registrar Cliente Manual
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Alta rápida de cliente físico para trabajar en el Foro Colaborativo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
                <ExclamationCircleIcon className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre de la Empresa *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={createForm.company_name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, company_name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
                  placeholder="Ej. Ferretería del Pacífico S.A."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre del Contacto Principal *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={createForm.contact_name}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, contact_name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
                  placeholder="Ej. Carlos Mendoza"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="tel"
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, phone: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
                    placeholder="+52 314 123 4567"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, email: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
                    placeholder="opcional@empresa.com"
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-500 -mt-2">
                Ingresa al menos un teléfono o un correo electrónico para identificar al cliente.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  RFC / Tax ID (Opcional)
                </label>
                <input
                  type="text"
                  value={createForm.tax_id}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      tax_id: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 font-mono uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
                  placeholder="XAXX010101000"
                />
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.forum_enabled}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        forum_enabled: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-gray-900">
                      Habilitada en el Foro Colaborativo
                    </span>
                    <span className="block text-[11px] text-gray-600 mt-0.5">
                      Permite crear temas y participar en el Foro de inmediato.
                    </span>
                  </div>
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 flex items-start gap-2">
                <InformationCircleIcon className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Se registrará la empresa sin contraseña para trabajar en el Foro. Si el
                  cliente se registra después en el portal con el mismo teléfono o correo,
                  su cuenta se vinculará automáticamente sin duplicarse.
                </span>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {createSaving ? (
                    <>
                      <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      <span>Registrando…</span>
                    </>
                  ) : (
                    <span>Registrar Cliente</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edición de Cliente */}
      {selectedCustomerForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-gray-200 max-h-[92vh] overflow-y-auto">
            {/* Cabecera */}
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Editar Información del Cliente
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  ID Cliente #{selectedCustomerForEdit.id} · Usuario ID #
                  {selectedCustomerForEdit.user_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerForEdit(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2">
                <ExclamationCircleIcon className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre de la Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.company_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, company_name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
                  placeholder="Ej. Acme Corp S.A. de C.V."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre del Contacto Principal *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.contact_name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, contact_name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Correo Electrónico de Login{" "}
                    {selectedCustomerForEdit.has_real_email !== false ? "*" : "(Opcional)"}
                  </label>
                  <input
                    type="email"
                    required={selectedCustomerForEdit.has_real_email !== false}
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
                    placeholder="contacto@empresa.com"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Es la credencial para acceder a /portal/login.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
                    placeholder="+52 33 1234 5678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  RFC / Tax ID Fiscal
                </label>
                <input
                  type="text"
                  value={editForm.tax_id}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      tax_id: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 font-mono uppercase focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden"
                  placeholder="XAXX010101000"
                />
              </div>

              {/* Selector de Estado */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 space-y-2">
                <label className="block text-xs font-bold text-gray-800">
                  Estado de la Cuenta
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="customer_status"
                      checked={editForm.is_active === true}
                      onChange={() =>
                        setEditForm({ ...editForm, is_active: true })
                      }
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      ● Activo
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="customer_status"
                      checked={editForm.is_active === false}
                      onChange={() =>
                        setEditForm({ ...editForm, is_active: false })
                      }
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                      ● Suspendido
                    </span>
                  </label>
                </div>
                <p className="text-[11px] text-gray-500 leading-normal pt-1">
                  Al marcar como <strong>Suspendido</strong> se bloquea
                  inmediatamente el acceso a esta plataforma central
                  (/portal/login). El cliente puede seguir utilizando el CRM u
                  otros productos de manera independiente.
                </p>
              </div>

              {/* Habilitación en Foro Colaborativo */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.forum_enabled}
                    onChange={(e) =>
                      setEditForm({ ...editForm, forum_enabled: e.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-gray-900">
                      Habilitada en el Foro Colaborativo
                    </span>
                    <span className="block text-[11px] text-gray-600 mt-0.5">
                      Al activarla, esta empresa aparece en el módulo Foro y en la herramienta de consulta para bots.
                    </span>
                  </div>
                </label>
              </div>

              {/* Botones */}
              <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedCustomerForEdit(null)}
                  className="rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {editSaving ? (
                    <>
                      <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      <span>Guardando Cambios…</span>
                    </>
                  ) : (
                    <span>Guardar Cambios</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
