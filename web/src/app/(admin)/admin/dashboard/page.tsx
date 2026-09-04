'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  UsersIcon,
  CpuChipIcon,
  CubeIcon,
  CreditCardIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    customersCount: 0,
    crmTenantsCount: 0,
    productsCount: 0,
    plansCount: 0,
    subscriptionsCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('iqmx_admin_token');
    if (!token) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${apiUrl}/api/admin/customers`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${apiUrl}/api/admin/crm/tenants`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${apiUrl}/api/admin/catalog/products`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${apiUrl}/api/admin/catalog/plans`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${apiUrl}/api/admin/subscriptions`, { headers }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([customers, tenants, products, plans, subs]) => {
        setStats({
          customersCount: customers.length,
          crmTenantsCount: tenants.length,
          productsCount: products.length,
          plansCount: plans.length,
          subscriptionsCount: subs.length,
        });
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Panel Administrativo Central</h1>
        <p className="text-sm text-gray-600 mt-1">
          Supervisión general del ecosistema SaaS: clientes, suscripciones, productos y microservicios.
        </p>
      </div>

      {/* Tarjetas de Métricas Claras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Organizaciones CRM</p>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <CpuChipIcon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 mt-2">
            {loading ? '…' : stats.crmTenantsCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">Inquilinos en producción</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Productos Activos</p>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <CubeIcon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 mt-2">
            {loading ? '…' : stats.productsCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">{stats.plansCount} planes configurados</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Suscripciones</p>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <CreditCardIcon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 mt-2">
            {loading ? '…' : stats.subscriptionsCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">Mercado Pago y pruebas</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Clientes Corporativos</p>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <UsersIcon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 mt-2">
            {loading ? '…' : stats.customersCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">Empresas registradas</p>
        </div>
      </div>

      {/* Accesos Directos Operativos Claros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <CpuChipIcon className="h-5 w-5 text-blue-600" />
            <span>Gestión del Microservicio CRM</span>
          </h3>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            Supervisa los inquilinos del CRM, consulta líneas conectadas, integrantes de equipo y ejecuta sincronizaciones de planes en tiempo real vía M2M.
          </p>
          <Link
            href="/admin/crm"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
          >
            <span>Ver Organizaciones CRM</span>
            <ArrowTrendingUpIcon className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <CubeIcon className="h-5 w-5 text-emerald-600" />
            <span>Catálogo de Productos y Membresías</span>
          </h3>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            Administra los planes y cuotas para el CRM WhatsApp o futuros productos como Gestión de Candidatos y Agentes de Voz.
          </p>
          <Link
            href="/admin/products"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
          >
            <span>Configurar Planes y Cuotas</span>
            <ArrowTrendingUpIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
