'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CreditCardIcon,
  CheckCircleIcon,
  ClockIcon,
  CalendarDaysIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import PortalLoader from '@/components/PortalLoader';
import { SubscriptionItem } from '../dashboard/components/types';

export default function PortalBillingPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const getHeaders = useCallback((): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('iqmx_portal_token') : null;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  useEffect(() => {
    const headers = getHeaders();
    fetch('/api/portal/subscriptions/my', { headers })
      .then((r) => {
        if (r.status === 401) {
          router.push('/portal/login');
          return [];
        }
        return r.ok ? r.json() : [];
      })
      .then((data) => setSubscriptions(data))
      .catch(() => setSubscriptions([]))
      .finally(() => setLoading(false));
  }, [getHeaders, router]);

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  if (loading) {
    return <PortalLoader message="Cargando historial de membresías..." />;
  }

  const activeSubs = subscriptions.filter((s) => s.status === 'active' || s.status === 'trial');
  const scheduledSubs = subscriptions.filter((s) => s.status === 'scheduled');
  const pastSubs = subscriptions.filter((s) => s.status === 'cancelled' || s.status === 'past_due');

  return (
    <div className="space-y-8 font-sans text-gray-900">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 mb-2">
            <CreditCardIcon className="h-4 w-4" />
            <span>Facturación y Pagos</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Membresías y Suscripciones
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Consulta el estado de tus membresías por producto, fechas de renovación y vigencias.
          </p>
        </div>

        <Link
          href="/landingpage/crm"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
        >
          <span>Explorar Planes Comerciales</span>
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* ─── 1. MEMBRESÍAS ACTIVAS ─── */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
          <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
          <span>Membresías Vigentes</span>
        </h2>

        {activeSubs.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {activeSubs.map((sub) => (
              <div
                key={sub.id}
                className="rounded-3xl border border-blue-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                        <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{sub.status === 'trial' ? 'Prueba Gratuita' : 'Membresía Activa'}</span>
                      </span>
                      <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-md">
                        {sub.product_name}
                      </span>
                    </div>

                    <h3 className="text-2xl font-black text-gray-900">{sub.plan_name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {sub.price_mxn > 0 ? `$${sub.price_mxn.toFixed(2)} MXN / mes` : 'Sin costo'}
                    </p>
                  </div>

                  <div className="sm:text-right bg-gray-50 sm:bg-transparent p-4 sm:p-0 rounded-2xl">
                    <p className="text-xs text-gray-500 font-medium">Vigencia a medianoche</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">
                      {formatDate(sub.current_period_end)}
                    </p>
                    <p className="text-xs text-blue-600 font-semibold mt-0.5">
                      {sub.days_remaining} {sub.days_remaining === 1 ? 'día restante' : 'días restantes'}
                    </p>
                  </div>
                </div>

                <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-gray-600">
                  <div className="flex flex-wrap gap-4">
                    <span>Líneas: <strong>{sub.features_payload?.max_whatsapp_accounts ?? 1}</strong></span>
                    <span>Operadores: <strong>{sub.features_payload?.max_team_members ?? 'Ilimitados'}</strong></span>
                    <span>Contactos: <strong>{(sub.features_payload?.max_contacts ?? 500).toLocaleString()}</strong></span>
                  </div>

                  <Link
                    href={`/landingpage/${sub.product_slug}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
                  >
                    <span>Cambiar o Renovar Plan</span>
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center max-w-lg mx-auto">
            <ShoppingBagIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-gray-800">No tienes membresías activas</h3>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Puedes contratar un plan para el CRM o solicitar la prueba gratuita.
            </p>
            <Link
              href="/landingpage/crm"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              <span>Ver Planes del CRM</span>
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* ─── 2. MEMBRESÍAS PROGRAMADAS (RENOVACIONES O DOWNGRADES) ─── */}
      {scheduledSubs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-blue-600" />
            <span>Membresías Programadas para Próxima Activación</span>
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {scheduledSubs.map((sub) => (
              <div
                key={sub.id}
                className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-start gap-3">
                  <CalendarDaysIcon className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                      {sub.product_name}
                    </span>
                    <h4 className="text-sm font-bold text-gray-900 mt-0.5">
                      {sub.plan_name} (${sub.price_mxn.toFixed(2)} MXN / mes)
                    </h4>
                    <p className="text-gray-500 mt-0.5">
                      Entrará en vigor automáticamente al expirar tu membresía vigente.
                    </p>
                  </div>
                </div>

                <div className="sm:text-right">
                  <span className="rounded-full bg-blue-200/70 text-blue-900 px-3 py-1 text-[11px] font-bold">
                    Inicia el: {formatDate(sub.current_period_start)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 3. HISTORIAL DE MEMBRESÍAS CANCELADAS O ANTERIORES ─── */}
      {pastSubs.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <XCircleIcon className="h-4 w-4 text-gray-400" />
            <span>Membresías Concluidas o Canceladas</span>
          </h2>

          <div className="space-y-2">
            {pastSubs.map((sub) => (
              <div
                key={sub.id}
                className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between text-xs text-gray-500"
              >
                <div>
                  <span className="font-semibold text-gray-700">{sub.plan_name}</span> ({sub.product_name})
                  <span className="text-gray-400 ml-2">Finalizó: {formatDate(sub.current_period_end)}</span>
                </div>
                <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[10px] font-bold uppercase">
                  {sub.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── NOTA SOBRE POLÍTICA DE VIGENCIA ─── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-xs text-gray-500 space-y-2">
        <h4 className="font-bold text-gray-800 flex items-center gap-1.5">
          <ShieldCheckIcon className="h-4 w-4 text-blue-600" />
          <span>Información sobre Facturación y Ciclos de Membresía</span>
        </h4>
        <p className="leading-relaxed">
          Todos los ciclos de servicio mensual concluyen a las <strong>23:59:59 horas (medianoche)</strong>.
          En caso de adquirir una membresía superior (Upgrade), la activación es instantánea.
          Para más detalles, consulta nuestros{' '}
          <Link href="/terminos" target="_blank" className="text-blue-600 font-semibold hover:underline">
            Términos y Condiciones de Servicio
          </Link>.
        </p>
      </div>
    </div>
  );
}
