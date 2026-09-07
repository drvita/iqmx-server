'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckIcon,
  CreditCardIcon,
  SparklesIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { saveCheckoutIntent } from '@/utils/checkoutIntent';

export type Plan = {
  id: number;
  product_id: number;
  name: string;
  slug: string;
  description: string | null;
  price_mxn: number;
  billing_interval: string;
  features_payload: any;
};

interface MembershipPlansProps {
  theme?: 'blue' | 'teal';
  sector?: 'general' | 'health';
  endpointAgenda?: boolean;
  includeFree?: boolean;
  id?: string;
  title?: string;
  subtitle?: string;
}

export default function MembershipPlans({
  theme = 'blue',
  sector = 'general',
  endpointAgenda = false,
  includeFree = false,
  id = 'planes',
  title = 'Elige tu membresía y activa tu plataforma hoy',
  subtitle = 'Pagos mensuales seguros procesados con Mercado Pago. Cancela cuando quieras sin penalización ni plazos forzosos.',
}: MembershipPlansProps) {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [claimingTrial, setClaimingTrial] = useState(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const freeParam = includeFree ? '&include_free=true' : '';
    fetch(`${apiUrl}/api/public/products/crm/plans?agenda=${endpointAgenda}${freeParam}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPlans(data))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, [endpointAgenda, includeFree]);

  const handleSelectPlan = async (plan: Plan) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('iqmx_portal_token') : null;

    // Si es plan gratis (Trial dinámico)
    if (plan.price_mxn <= 0) {
      if (token) {
        setClaimingTrial(true);
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
          const res = await fetch(`${apiUrl}/api/portal/subscriptions/claim-trial`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            router.push('/portal/dashboard?trial=1');
            return;
          }
        } catch {
          // Si falla conexión, redirigir al panel
        } finally {
          setClaimingTrial(false);
        }
        router.push('/portal/dashboard');
      } else {
        router.push('/portal/register');
      }
      return;
    }

    saveCheckoutIntent({
      plan_id: plan.id,
      plan_name: plan.name,
      price_mxn: plan.price_mxn,
      product_slug: 'crm',
    });

    if (!token) {
      router.push('/portal/login?redirect=checkout');
    } else {
      router.push('/portal/dashboard?pending_checkout=1');
    }
  };

  const isTeal = theme === 'teal';

  // Tokens de estilo según tema
  const themeClasses = {
    badgeText: isTeal ? 'text-teal-600' : 'text-blue-600',
    primaryBg: isTeal ? 'bg-teal-600 hover:bg-teal-700' : 'bg-blue-600 hover:bg-blue-700',
    checkIcon: isTeal ? 'text-teal-600' : 'text-blue-600',
    popularBorder: isTeal ? 'border-2 border-teal-600 ring-2 ring-teal-100' : 'border-2 border-blue-600 ring-2 ring-blue-100',
    popularBadgeBg: isTeal ? 'bg-teal-600' : 'bg-blue-600',
    spinnerBorder: isTeal ? 'border-teal-600' : 'border-blue-600',
  };

  // Determinamos de forma unívoca cuál es el único plan popular
  const popularPlan = (() => {
    if (plans.length === 0) return null;
    // 1. Si algún plan tiene explícitamente is_popular en features_payload
    const explicitPopular = plans.find((p) => p.features_payload?.is_popular === true);
    if (explicitPopular) return explicitPopular;

    // 2. Por slug según el sector
    if (sector === 'health') {
      return (
        plans.find((p) => p.slug === 'consultorio-pro') ||
        plans.find((p) => p.slug.includes('pro')) ||
        plans[plans.length - 1] ||
        null
      );
    }

    // Para CRM General: priorizamos el plan de crecimiento (Basic +)
    return (
      plans.find((p) => p.slug === 'crm-basic-plus') ||
      plans.find((p) => p.slug.includes('plus')) ||
      (plans.length > 1 ? plans[plans.length - 1] : plans[0]) ||
      null
    );
  })();

  const popularPlanId = popularPlan?.id;

  return (
    <section id={id} className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 border-t border-gray-200">
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className={`text-xs font-bold uppercase tracking-wider ${themeClasses.badgeText}`}>
            Membresías
          </span>
          <h2 className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
            {title}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {subtitle}
          </p>
        </div>

        {loadingPlans ? (
          <div className="p-16 text-center text-gray-400">
            <div className={`inline-block h-8 w-8 animate-spin rounded-full border-2 border-t-transparent ${themeClasses.spinnerBorder}`} />
            <p className="mt-3 text-xs">Cargando membresías disponibles…</p>
          </div>
        ) : plans.length > 0 ? (
          <div
            className={`grid gap-8 max-w-4xl mx-auto ${
              plans.length === 1
                ? 'grid-cols-1 max-w-md'
                : plans.length === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1 md:grid-cols-3'
            }`}
          >
            {plans.map((p) => {
              const isFree = p.price_mxn <= 0;
              // Exactamente un solo plan de pago puede ser popular
              const isPopular = !isFree && p.id === popularPlanId;

              const whatsappAccounts = p.features_payload?.max_whatsapp_accounts ?? 1;
              const teamMembers = p.features_payload?.max_team_members;
              const contacts = p.features_payload?.max_contacts;
              const hasAgenda = p.features_payload?.agenda_enabled;

              return (
                <div
                  key={p.id}
                  className={`rounded-3xl bg-white p-8 flex flex-col justify-between shadow-sm transition-all hover:shadow-lg relative ${
                    isPopular
                      ? themeClasses.popularBorder
                      : isFree
                      ? 'border border-gray-200 bg-gradient-to-b from-gray-50/60 to-white'
                      : 'border border-gray-200'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold text-white uppercase shadow-sm ${themeClasses.popularBadgeBg}`}>
                        <StarIcon className="h-3 w-3" />
                        {sector === 'health' ? 'Recomendado para Consultorios' : 'Más Popular'}
                      </span>
                    </div>
                  )}

                  {isFree && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white uppercase shadow-sm">
                        Sin Costo Inicial
                      </span>
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>
                    <p className="mt-1 text-sm text-gray-500">{p.description}</p>

                    <div className="mt-6 flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-gray-900">
                        {isFree ? 'Gratis' : `$${p.price_mxn.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                      </span>
                      <span className="text-sm text-gray-500 font-medium">
                        {isFree ? 'sin tarjeta' : 'MXN / mes'}
                      </span>
                    </div>

                    <ul className="mt-6 space-y-3 border-t border-gray-100 pt-6">
                      <li className="flex items-center gap-2 text-sm text-gray-700">
                        <CheckIcon className={`h-4 w-4 shrink-0 ${themeClasses.checkIcon}`} />
                        <span>
                          Hasta <strong>{whatsappAccounts}</strong> {whatsappAccounts === 1 ? 'línea' : 'líneas'} de WhatsApp oficial
                        </span>
                      </li>

                      <li className="flex items-center gap-2 text-sm text-gray-700">
                        <CheckIcon className={`h-4 w-4 shrink-0 ${themeClasses.checkIcon}`} />
                        <span>
                          {teamMembers === null || teamMembers === undefined ? (
                            sector === 'health' ? (
                              <strong>Médicos y recepcionistas sin límite</strong>
                            ) : (
                              <strong>Miembros de equipo sin límite</strong>
                            )
                          ) : (
                            <>
                              Hasta <strong>{teamMembers}</strong> {sector === 'health' ? 'médicos y recepcionistas' : 'agentes / miembros'}
                            </>
                          )}
                        </span>
                      </li>

                      <li className="flex items-center gap-2 text-sm text-gray-700">
                        <CheckIcon className={`h-4 w-4 shrink-0 ${themeClasses.checkIcon}`} />
                        <span>
                          {contacts === null || contacts === undefined ? (
                            sector === 'health' ? (
                              <strong>Pacientes registrados sin límite</strong>
                            ) : (
                              <strong>Prospectos y contactos sin límite</strong>
                            )
                          ) : (
                            <>
                              Hasta <strong>{Number(contacts).toLocaleString()}</strong> {sector === 'health' ? 'pacientes registrados' : 'contactos / prospectos'}
                            </>
                          )}
                        </span>
                      </li>

                      {sector === 'health' ? (
                        <>
                          <li className="flex items-center gap-2 text-sm text-gray-700">
                            <CheckIcon className={`h-4 w-4 shrink-0 ${themeClasses.checkIcon}`} />
                            <span>Asistente virtual 24/7 para agendar y atender pacientes</span>
                          </li>
                          {hasAgenda && (
                            <li className="flex items-center gap-2 text-sm text-gray-700">
                              <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-emerald-700">
                                Agenda médica de citas por WhatsApp incluida{' '}
                                <span className="text-xs font-normal text-teal-600 block sm:inline">
                                  (Recordatorios automáticos: próximamente)
                                </span>
                              </span>
                            </li>
                          )}
                        </>
                      ) : (
                        <>
                          <li className="flex items-center gap-2 text-sm text-gray-700">
                            <CheckIcon className={`h-4 w-4 shrink-0 ${themeClasses.checkIcon}`} />
                            <span>Pipeline visual de oportunidades (Kanban)</span>
                          </li>
                          <li className="flex items-center gap-2 text-sm text-gray-700">
                            <CheckIcon className={`h-4 w-4 shrink-0 ${themeClasses.checkIcon}`} />
                            <span>Asistente de IA 24/7 para tus prospectos</span>
                          </li>
                        </>
                      )}

                      {p.features_payload?.lab_enabled && (
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-purple-600 shrink-0" />
                          <span className="font-semibold text-purple-700">Laboratorio de pruebas de IA</span>
                        </li>
                      )}

                      {p.features_payload?.tasks_enabled && (
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-purple-600 shrink-0" />
                          <span className="font-semibold text-purple-700">Notas internas y seguimiento comercial en chat</span>
                        </li>
                      )}

                      {p.features_payload?.attribution_enabled && (
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-purple-600 shrink-0" />
                          <span className="font-semibold text-purple-700">Medición de campañas publicitarias</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  <button
                    onClick={() => handleSelectPlan(p)}
                    disabled={isFree && claimingTrial}
                    className={`mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold shadow-md transition-all hover:shadow-lg ${
                      isFree
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50'
                        : isPopular
                        ? `${themeClasses.primaryBg} text-white`
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {isFree ? (
                      claimingTrial ? (
                        <span>Activando membresía…</span>
                      ) : (
                        <>
                          <SparklesIcon className="h-4 w-4" />
                          <span>Probar Gratis</span>
                        </>
                      )
                    ) : (
                      <>
                        <CreditCardIcon className="h-4 w-4" />
                        <span>Contratar Ahora</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center max-w-lg mx-auto shadow-xs">
            <h3 className="text-base font-bold text-gray-900">Membresías en actualización</h3>
            <p className="mt-2 text-sm text-gray-600">
              Estamos actualizando los paquetes disponibles. Muy pronto podrás contratarlos directamente aquí.
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-500 mt-8 max-w-2xl mx-auto leading-relaxed">
          Todos los planes incluyen soporte continuo por WhatsApp y actualizaciones automáticas. La inteligencia artificial opera con conexión directa a costo real de proveedor, sin recargos ocultos.
        </p>
      </div>
    </section>
  );
}
