'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PlusIcon, CubeIcon, CodeBracketIcon } from '@heroicons/react/24/outline';

type Product = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  service_url: string | null;
  is_active: boolean;
  plans_count: number;
};

type Plan = {
  id: number;
  product_id: number;
  name: string;
  slug: string;
  description: string | null;
  price_mxn: number;
  billing_interval: string;
  features_payload: any;
  is_public: boolean;
  is_active: boolean;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal para Crear/Editar Plan con JSON crudo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: '',
    slug: '',
    description: '',
    price_mxn: 0,
    billing_interval: 'monthly',
    is_public: true,
    is_active: true,
    features_json: JSON.stringify(
      {
        max_whatsapp_accounts: 1,
        max_team_members: 5,
        max_contacts: 200,
        agenda_enabled: false,
        lab_enabled: false,
        tasks_enabled: false,
      },
      null,
      2
    ),
  });
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('iqmx_admin_token');
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [prodsRes, plansRes] = await Promise.all([
        fetch(`${apiUrl}/api/admin/catalog/products`, { headers }),
        fetch(`${apiUrl}/api/admin/catalog/plans`, { headers }),
      ]);
      if (prodsRes.ok && plansRes.ok) {
        const prods = await prodsRes.json();
        const plns = await plansRes.json();
        setProducts(prods);
        setPlans(plns);
        if (prods.length > 0 && selectedProductId === null) {
          setSelectedProductId(prods[0].id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedProductId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(planForm.features_json);
      setJsonError(null);
    } catch {
      setJsonError('El JSON de configuración no es válido. Revisa las comillas y comas.');
      return;
    }

    setSavingPlan(true);

    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/catalog/plans`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: selectedProductId,
          name: planForm.name.trim(),
          slug: planForm.slug.trim().toLowerCase(),
          description: planForm.description.trim() || undefined,
          price_mxn: Number(planForm.price_mxn),
          billing_interval: planForm.billing_interval,
          features_payload: parsedPayload,
          is_public: planForm.is_public,
          is_active: planForm.is_active,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      } else {
        const d = await res.json();
        setJsonError(d.detail || 'Error al guardar el plan.');
      }
    } catch {
      setJsonError('Error de red al comunicarse con el servidor.');
    } finally {
      setSavingPlan(false);
    }
  };

  const filteredPlans = selectedProductId
    ? plans.filter((p) => p.product_id === selectedProductId)
    : plans;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Catálogo de Productos y Membresías</h1>
          <p className="text-sm text-gray-600 mt-1">
            Gestiona los microservicios y define manualmente los planes y el JSON de configuraciones que se despachará al CRM.
          </p>
        </div>
        <button
          onClick={() => {
            setJsonError(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition-colors shrink-0"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Nuevo Plan de Membresía</span>
        </button>
      </div>

      {/* Pestañas Claras de Producto */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        {products.map((prod) => (
          <button
            key={prod.id}
            onClick={() => setSelectedProductId(prod.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
              selectedProductId === prod.id
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <CubeIcon className="h-4 w-4" />
            <span>{prod.name}</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">
              {prod.plans_count} planes
            </span>
          </button>
        ))}
      </div>

      {/* Grid Claro de Planes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {filteredPlans.map((plan) => (
          <div
            key={plan.id}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200 font-mono">
                  {plan.slug}
                </span>
                <span className="text-xs font-semibold text-gray-500 capitalize">
                  {plan.billing_interval === 'monthly' ? 'Mensual' : 'Anual'}
                </span>
              </div>

              <h3 className="mt-3 text-lg font-bold text-gray-900">{plan.name}</h3>
              <p className="mt-1 text-xs text-gray-500">{plan.description || 'Sin descripción'}</p>

              <div className="mt-4 flex items-baseline gap-1 border-b border-gray-100 pb-4">
                <span className="text-3xl font-extrabold text-gray-900">
                  ${plan.price_mxn.toFixed(2)}
                </span>
                <span className="text-xs text-gray-500">MXN / mes</span>
              </div>

              {/* JSON de Configuraciones / Features */}
              <div className="mt-4 space-y-2">
                <p className="font-semibold text-gray-500 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <CodeBracketIcon className="h-3.5 w-3.5 text-gray-400" />
                  <span>Configuración enviada al CRM:</span>
                </p>
                <pre className="rounded-lg bg-gray-50 p-3 text-[11px] font-mono text-gray-700 border border-gray-200 overflow-x-auto">
                  {JSON.stringify(plan.features_payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
              <span>{plan.is_public ? 'Público en portal' : 'Membresía privada/oculta'}</span>
              <span className={`font-semibold ${plan.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                {plan.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        ))}

        {filteredPlans.length === 0 && !loading && (
          <div className="col-span-3 rounded-2xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
            No hay planes registrados para este producto todavía.
          </div>
        )}
      </div>

      {/* Modal Claro para Crear Plan con JSON Crudo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <PlusIcon className="h-5 w-5 text-blue-600" />
              <span>Nuevo Plan de Membresía</span>
            </h3>

            {jsonError && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
                {jsonError}
              </div>
            )}

            <form onSubmit={handleCreatePlan} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Nombre del Plan</label>
                  <input
                    type="text"
                    required
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    placeholder="Plan Crecimiento"
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Slug (Identificador)</label>
                  <input
                    type="text"
                    required
                    value={planForm.slug}
                    onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                    placeholder="crm-crecimiento"
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 font-mono focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Precio Mensual (MXN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={planForm.price_mxn}
                    onChange={(e) => setPlanForm({ ...planForm, price_mxn: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Intervalo</label>
                  <select
                    value={planForm.billing_interval}
                    onChange={(e) => setPlanForm({ ...planForm, billing_interval: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="monthly">Mensual</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Descripción</label>
                <input
                  type="text"
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  placeholder="Hasta 3 líneas y 5 miembros..."
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-700">
                    JSON de Configuración (features que procesa el CRM)
                  </label>
                  <span className="text-[10px] text-gray-400">Formato JSON válido</span>
                </div>
                <textarea
                  rows={6}
                  required
                  value={planForm.features_json}
                  onChange={(e) => setPlanForm({ ...planForm, features_json: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
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
                  disabled={savingPlan}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {savingPlan ? 'Guardando…' : 'Crear Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
