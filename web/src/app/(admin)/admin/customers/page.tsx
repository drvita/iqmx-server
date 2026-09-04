'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  XCircleIcon,
  PhoneIcon,
  DevicePhoneMobileIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

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
  privacy_accepted_at: string;
  created_at: string;
  whatsapp_numbers_count: number;
  active_plans: string[];
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchCustomers = useCallback(async () => {
    const token = localStorage.getItem('iqmx_admin_token');
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
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

  const handleToggleStatus = async (customer: Customer) => {
    const token = localStorage.getItem('iqmx_admin_token');
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    setUpdatingId(customer.id);

    try {
      const res = await fetch(`${apiUrl}/api/admin/customers/${customer.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !customer.is_active }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
    } catch {
      // Manejo de error
    } finally {
      setUpdatingId(null);
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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Clientes Corporativos</h1>
          <p className="text-sm text-gray-600 mt-1">
            Directorio central de empresas registradas en la plataforma IQISSMexico.
          </p>
        </div>

        {/* Buscador Rápido */}
        <div className="relative max-w-xs w-full">
          <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por empresa, email, RFC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
            <tr>
              <th className="px-4 py-3">Empresa y Contacto</th>
              <th className="px-4 py-3">Correo y Teléfono</th>
              <th className="px-4 py-3">Membresías Activas</th>
              <th className="px-4 py-3">Líneas WA</th>
              <th className="px-4 py-3">Origen</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">ID Cliente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredCustomers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/75 transition-colors">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <BuildingOffice2Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{c.company_name}</p>
                      <p className="text-[11px] text-gray-500">
                        {c.contact_name} {c.tax_id ? `· RFC: ${c.tax_id}` : ''}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3.5">
                  <p className="font-mono text-gray-700">{c.email}</p>
                  {c.phone && (
                    <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <PhoneIcon className="h-3 w-3 text-gray-400" />
                      <span>{c.phone}</span>
                    </p>
                  )}
                </td>

                <td className="px-4 py-3.5">
                  {c.active_plans.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {c.active_plans.map((p, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200"
                        >
                          <SparklesIcon className="h-3 w-3 text-blue-600" />
                          <span>{p}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-gray-400 italic">Sin plan activo</span>
                  )}
                </td>

                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 text-gray-700 font-semibold">
                    <DevicePhoneMobileIcon className="h-3.5 w-3.5 text-gray-400" />
                    <span>{c.whatsapp_numbers_count}</span>
                  </span>
                </td>

                <td className="px-4 py-3.5 capitalize text-gray-500">{c.origin}</td>

                <td className="px-4 py-3.5">
                  <button
                    onClick={() => handleToggleStatus(c)}
                    disabled={updatingId === c.id}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border transition-colors cursor-pointer disabled:opacity-50 ${
                      c.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                    }`}
                  >
                    {c.is_active ? (
                      <>
                        <CheckCircleIcon className="h-3 w-3 text-emerald-600" />
                        <span>Activo</span>
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="h-3 w-3 text-red-600" />
                        <span>Suspendido</span>
                      </>
                    )}
                  </button>
                </td>

                <td className="px-4 py-3.5 text-right font-mono text-gray-400">#{c.id}</td>
              </tr>
            ))}

            {filteredCustomers.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400">
                  {searchTerm
                    ? 'No se encontraron clientes que coincidan con la búsqueda.'
                    : 'No hay clientes registrados en la plataforma todavía.'}
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
    </div>
  );
}
