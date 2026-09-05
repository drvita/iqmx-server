'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditCardIcon,
  PlusIcon,
  LinkIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type Subscription = {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  plan_id: number;
  plan_name: string;
  product_slug: string;
  price_mxn: number;
  status: string;
  current_period_start: string;
  current_period_end: string;
  mp_preapproval_id: string | null;
  external_tenant_id: string | null;
};

type CustomerOption = {
  id: number;
  company_name: string;
  email: string;
};

type PlanOption = {
  id: number;
  name: string;
  price_mxn: number;
  product_slug?: string;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  active: {
    label: 'Activa',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  trial: {
    label: 'Prueba',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
  },
  past_due: {
    label: 'Atrasada',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  paused: {
    label: 'Pausada',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
  },
  cancelled: {
    label: 'Cancelada',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
};

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Generador Mercado Pago
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [selectedPlanId, setSelectedPlanId] = useState<number | ''>('');
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // Modal Edición Suscripción
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [editStatus, setEditStatus] = useState<string>('active');
  const [editStart, setEditStart] = useState<string>('');
  const [editEnd, setEditEnd] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('iqmx_admin_token');
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [subsRes, plansRes, tenantsRes] = await Promise.all([
        fetch(`${apiUrl}/api/admin/subscriptions`, { headers }),
        fetch(`${apiUrl}/api/admin/catalog/plans`, { headers }),
        fetch(`${apiUrl}/api/admin/crm/tenants`, { headers }),
      ]);

      if (subsRes.ok) setSubscriptions(await subsRes.json());
      if (plansRes.ok) setPlans(await plansRes.json());
      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json();
        const custs: CustomerOption[] = [];
        const seen = new Set();
        for (const t of tenantsData) {
          if (t.customer_id && !seen.has(t.customer_id)) {
            seen.add(t.customer_id);
            custs.push({
              id: t.customer_id,
              company_name: t.customer_company_name || `Cliente #${t.customer_id}`,
              email: t.customer_email || '',
            });
          }
        }
        setCustomers(custs);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openEditModal = (sub: Subscription) => {
    setEditingSub(sub);
    setEditStatus(sub.status);
    setEditStart(sub.current_period_start.slice(0, 10));
    setEditEnd(sub.current_period_end.slice(0, 10));
    setEditError(null);
  };

  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;

    setSavingEdit(true);
    setEditError(null);

    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const payload = {
        status: editStatus,
        current_period_start: editStart ? new Date(`${editStart}T00:00:00Z`).toISOString() : undefined,
        current_period_end: editEnd ? new Date(`${editEnd}T23:59:59Z`).toISOString() : undefined,
      };

      const res = await fetch(`${apiUrl}/api/admin/subscriptions/${editingSub.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.detail || 'Error al actualizar la suscripción');
        return;
      }

      setEditingSub(null);
      fetchData();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedPlanId) return;

    setGenerating(true);
    setGeneratedLink(null);

    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/subscriptions/generate-link`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: Number(selectedCustomerId),
          plan_id: Number(selectedPlanId),
        }),
      });
      const data = await res.json();
      if (res.ok && data.checkout_url) {
        setGeneratedLink(data.checkout_url);
        fetchData();
      }
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Suscripciones y Membresías</h1>
          <p className="text-sm text-gray-600 mt-1">
            Supervisa estados, edita periodos de vigencia y genera enlaces de pago recurrente de Mercado Pago.
          </p>
        </div>
        <button
          onClick={() => {
            setGeneratedLink(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition-colors shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Generar Link Mercado Pago</span>
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Plan / Producto</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Periodo Actual</th>
              <th className="px-4 py-3">Preapproval MP</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {subscriptions.map((s) => {
              const cfg = STATUS_CONFIG[s.status] || {
                label: s.status,
                badge: 'bg-gray-50 text-gray-700 border-gray-200',
                dot: 'bg-gray-400',
              };

              return (
                <tr key={s.id} className="hover:bg-gray-50/75 transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-gray-900">{s.customer_name}</p>
                    <p className="font-mono text-[11px] text-gray-500">{s.customer_email}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-gray-900">{s.plan_name}</p>
                    <span className="text-[10px] text-blue-600 uppercase font-bold">{s.product_slug}</span>
                  </td>
                  <td className="px-4 py-3.5 font-mono font-bold text-gray-900">
                    ${s.price_mxn.toFixed(2)} MXN
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${cfg.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <span>{cfg.label}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-gray-600">
                    {s.current_period_start.slice(0, 10)} <span className="text-gray-400 font-sans">al</span> {s.current_period_end.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-gray-500 text-[11px]">
                    {s.mp_preapproval_id ? (
                      <span className="truncate max-w-[140px] block" title={s.mp_preapproval_id}>
                        {s.mp_preapproval_id}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Manual / Prueba</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => openEditModal(s)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 hover:text-blue-600 transition-colors"
                      title="Editar periodo y estado"
                    >
                      <PencilSquareIcon className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                  </td>
                </tr>
              );
            })}
            {subscriptions.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400">
                  No hay suscripciones registradas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Claro Generador de Link de Mercado Pago */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5 text-blue-600" />
              <span>Generar Suscripción de Mercado Pago</span>
            </h3>

            {generatedLink ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                    <span>Enlace de Pago Recurrente Generado</span>
                  </div>
                  <p className="mt-1 break-all text-gray-700 font-mono text-[11px]">
                    {generatedLink}
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedLink)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <LinkIcon className="h-4 w-4" />
                    <span>Copiar Enlace</span>
                  </button>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGenerateLink} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Seleccionar Cliente</label>
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">Selecciona una empresa…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700">Plan de Membresía</label>
                  <select
                    required
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">Selecciona un plan…</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - ${p.price_mxn} MXN / mes
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={generating}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {generating ? 'Generando en Mercado Pago…' : 'Crear Enlace'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal de Edición de Suscripción */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <PencilSquareIcon className="h-5 w-5 text-blue-600" />
                <span>Editar Suscripción #{editingSub.id}</span>
              </h3>
              <button
                onClick={() => setEditingSub(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs">
              <p className="font-semibold text-gray-900">{editingSub.customer_name}</p>
              <p className="text-gray-500 font-mono text-[11px]">{editingSub.customer_email}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-medium text-gray-700">{editingSub.plan_name}</span>
                <span className="font-mono font-bold text-gray-900">${editingSub.price_mxn.toFixed(2)} MXN</span>
              </div>
            </div>

            {editError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateSubscription} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Estado de la Suscripción
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                >
                  <option value="active">🟢 Activa (al corriente)</option>
                  <option value="trial">🔵 Periodo de Prueba (trial)</option>
                  <option value="past_due">🟠 Atrasada / Pago Pendiente</option>
                  <option value="paused">🟣 Pausada Temporalmente</option>
                  <option value="cancelled">🔴 Cancelada / Inactiva</option>
                </select>
                <p className="mt-1 text-[11px] text-gray-500">
                  Si tiene inquilino CRM asignado, el estado se sincronizará automáticamente.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Inicio de Periodo
                  </label>
                  <input
                    type="date"
                    required
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Fin de Periodo
                  </label>
                  <input
                    type="date"
                    required
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingSub(null)}
                  className="rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {savingEdit ? 'Guardando cambios…' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
