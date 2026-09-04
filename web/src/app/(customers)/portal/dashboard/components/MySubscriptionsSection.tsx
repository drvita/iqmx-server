'use client';

import React from 'react';
import Link from 'next/link';
import {
  SparklesIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { SubscriptionItem } from './types';

interface MySubscriptionsSectionProps {
  subscriptions: SubscriptionItem[];
}

export default function MySubscriptionsSection({
  subscriptions,
}: MySubscriptionsSectionProps) {
  const activeSub = subscriptions.find(
    (s) => s.status === 'active' || s.status === 'trial'
  );
  const scheduledSubs = subscriptions.filter((s) => s.status === 'scheduled');

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 mb-2">
            <ShieldCheckIcon className="h-4 w-4" />
            <span>Membresías y Facturación</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Mis Membresías Activas
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Consulta el estado de tu servicio contratado y tus próximas vigencias.
          </p>
        </div>

        <Link
          href="/landingpage/crm"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
        >
          <span>Explorar otros planes</span>
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>

      {activeSub ? (
        <div className="space-y-6">
          {/* Tarjeta de membresía actual */}
          <div className="rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50/60 to-white p-6 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                    <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{activeSub.status === 'trial' ? 'Período de Prueba' : 'Membresía Activa'}</span>
                  </span>
                  <span className="text-xs text-gray-500">
                    Producto: <strong>{activeSub.product_name}</strong>
                  </span>
                </div>

                <h3 className="text-2xl font-black text-gray-900 mt-2">
                  {activeSub.plan_name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {activeSub.price_mxn > 0
                    ? `$${activeSub.price_mxn.toFixed(2)} MXN / mes`
                    : 'Sin costo'}
                </p>
              </div>

              <div className="sm:text-right bg-white sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-gray-100">
                <p className="text-xs text-gray-500 font-medium">Vigencia hasta</p>
                <p className="text-base font-bold text-gray-900 mt-0.5">
                  {formatDate(activeSub.current_period_end)}
                </p>
                <p className="text-xs text-blue-600 font-semibold mt-0.5">
                  {activeSub.days_remaining} {activeSub.days_remaining === 1 ? 'día restante' : 'días restantes'}
                </p>
              </div>
            </div>

            {/* Características principales */}
            <div className="mt-5 pt-4 border-t border-blue-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-700">
              <div>
                <span className="text-gray-400 block">Líneas WhatsApp:</span>
                <strong>{activeSub.features_payload?.max_whatsapp_accounts ?? 1}</strong>
              </div>
              <div>
                <span className="text-gray-400 block">Operadores:</span>
                <strong>
                  {activeSub.features_payload?.max_team_members === null
                    ? 'Sin límite'
                    : (activeSub.features_payload?.max_team_members ?? 5)}
                </strong>
              </div>
              <div>
                <span className="text-gray-400 block">Contactos:</span>
                <strong>
                  {activeSub.features_payload?.max_contacts === null
                    ? 'Sin límite'
                    : (activeSub.features_payload?.max_contacts ?? 500).toLocaleString()}
                </strong>
              </div>
              <div>
                <span className="text-gray-400 block">Agenda de Citas:</span>
                <strong className={activeSub.features_payload?.agenda_enabled ? 'text-emerald-700' : 'text-gray-500'}>
                  {activeSub.features_payload?.agenda_enabled ? 'Incluida ✓' : 'No incluida'}
                </strong>
              </div>
            </div>
          </div>

          {/* Membresías programadas (si existen) */}
          {scheduledSubs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <ClockIcon className="h-4 w-4 text-blue-600" />
                <span>Próximas Membresías Programadas</span>
              </h4>

              {scheduledSubs.map((sched) => (
                <div
                  key={sched.id}
                  className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <CalendarDaysIcon className="h-5 w-5 text-blue-600 shrink-0" />
                    <div>
                      <p className="font-bold text-gray-900 text-sm">
                        {sched.plan_name} (${sched.price_mxn.toFixed(2)} MXN)
                      </p>
                      <p className="text-gray-500">
                        Entrará en vigor automáticamente al terminar tu membresía actual.
                      </p>
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-800 uppercase">
                      Inicia: {formatDate(sched.current_period_start)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center max-w-lg mx-auto">
          <SparklesIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-gray-800">
            No tienes una membresía activa en este momento
          </h3>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            Elige un plan para tu negocio y comienza a atender a tus clientes con inteligencia artificial.
          </p>
          <Link
            href="/landingpage/crm"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition-colors"
          >
            <span>Ver Planes Disponibles</span>
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
