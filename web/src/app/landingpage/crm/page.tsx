'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  SparklesIcon,
  ViewColumnsIcon,
  CheckIcon,
  CreditCardIcon,
  BoltIcon,
  ClockIcon,
  ArrowRightIcon,
  ChartBarIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { saveCheckoutIntent } from '@/utils/checkoutIntent';

type Plan = {
  id: number;
  product_id: number;
  name: string;
  slug: string;
  description: string | null;
  price_mxn: number;
  billing_interval: string;
  features_payload: any;
};

export default function CrmLandingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${apiUrl}/api/public/products/crm/plans?agenda=false&include_free=true`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPlans(data))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, []);

  const [claimingTrial, setClaimingTrial] = useState(false);

  const handleSelectPlan = async (plan: Plan) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('iqmx_portal_token') : null;
    
    // Si es plan gratis (Trial)
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
          // Si falla red, redirigir al panel
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

  const scrollToPlans = () => {
    document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-3.5 py-1 text-xs font-semibold text-blue-200 border border-white/15">
                <SparklesIcon className="h-4 w-4 text-blue-300" />
                <span>CRM Omnicanal con IA para WhatsApp</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.1]">
                Deja de perder clientes <br className="hidden sm:inline" />
                en tus chats de WhatsApp
              </h1>

              <p className="text-lg text-blue-100 max-w-xl leading-relaxed">
                Centraliza <strong>todas las conversaciones</strong> de tu equipo comercial en una bandeja compartida, 
                deja que la <strong>IA responda</strong> cuando no estés disponible y organiza cada prospecto en un 
                <strong> embudo de ventas visual</strong> para que ninguna oportunidad se pierda.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={scrollToPlans}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-blue-950 shadow-lg hover:bg-blue-50 transition-all hover:shadow-xl"
                >
                  <span>Ver Planes y Contratar</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Prueba social mínima */}
              <div className="flex items-center gap-3 pt-4 text-xs text-blue-200/80">
                <div className="flex -space-x-2">
                  <div className="h-7 w-7 rounded-full bg-blue-400/30 border-2 border-blue-800 flex items-center justify-center text-[10px] font-bold text-white">M</div>
                  <div className="h-7 w-7 rounded-full bg-emerald-400/30 border-2 border-blue-800 flex items-center justify-center text-[10px] font-bold text-white">C</div>
                  <div className="h-7 w-7 rounded-full bg-amber-400/30 border-2 border-blue-800 flex items-center justify-center text-[10px] font-bold text-white">R</div>
                </div>
                <span>Empresas y consultorios ya gestionan sus ventas con nosotros</span>
              </div>
            </div>

            {/* Mockup visual del Pipeline */}
            <div className="hidden lg:block">
              <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5 shadow-2xl">
                <div className="text-[11px] font-bold text-blue-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <ViewColumnsIcon className="h-4 w-4" />
                  <span>Pipeline de Ventas</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-white/8 backdrop-blur rounded-xl p-3 border border-white/10">
                    <p className="text-[10px] font-bold text-blue-300 uppercase mb-2">Nuevos</p>
                    <div className="space-y-1.5">
                      <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-400/20">
                        <p className="text-[11px] font-bold text-white">Dr. García</p>
                        <p className="text-[9px] text-blue-200">Pregunta por cotización</p>
                      </div>
                      <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-400/20">
                        <p className="text-[11px] font-bold text-white">Hotel Pacific</p>
                        <p className="text-[9px] text-blue-200">Necesita 3 líneas</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/8 backdrop-blur rounded-xl p-3 border border-white/10">
                    <p className="text-[10px] font-bold text-amber-300 uppercase mb-2">Cotización</p>
                    <div className="space-y-1.5">
                      <div className="bg-amber-500/20 p-2 rounded-lg border border-amber-400/20">
                        <p className="text-[11px] font-bold text-white">Clínica Dental</p>
                        <p className="text-[9px] text-amber-200">$999/mes enviado</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/8 backdrop-blur rounded-xl p-3 border border-white/10">
                    <p className="text-[10px] font-bold text-emerald-300 uppercase mb-2">Ganados</p>
                    <div className="space-y-1.5">
                      <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-400/20">
                        <p className="text-[11px] font-bold text-white">Ferretería MX</p>
                        <p className="text-[9px] text-emerald-200">Membresía activa ✓</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PROBLEMA ─── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">El problema que resolvemos</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">
              Tu equipo pierde ventas todos los días sin saberlo
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-white p-6 border border-gray-200 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 mb-4">
                <ClockIcon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Mensajes sin responder</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Un cliente que espera más de 5 minutos sin respuesta <strong>busca a la competencia</strong>. 
                Fuera de horario, la pérdida es aún mayor.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 border border-gray-200 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 mb-4">
                <ChatBubbleLeftRightIcon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Chats dispersos en celulares</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Si un vendedor se enferma o renuncia, <strong>sus conversaciones y clientes se van con él</strong>. 
                No hay visibilidad ni control.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 border border-gray-200 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 mb-4">
                <ChartBarIcon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Sin embudo de ventas</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                No sabes cuántos prospectos tienes, en qué etapa están ni cuáles necesitan seguimiento urgente. 
                <strong>Vendes a ciegas</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SOLUCIÓN (4 PILARES) ─── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Cómo lo resolvemos</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">
              4 herramientas en una sola plataforma
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-xs">
                <UserGroupIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Bandeja compartida multi-agente</h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  Todo tu equipo atiende desde <strong>una sola línea oficial</strong> de WhatsApp Business API. 
                  Asigna conversaciones, deja notas internas y nunca pierdas el hilo.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs">
                <SparklesIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Agente de IA que no duerme</h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  Responde preguntas frecuentes, <strong>califica prospectos</strong> automáticamente y escala al 
                  humano indicado cuando se requiere. Disponible <strong>24 horas, 7 días</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
                <ViewColumnsIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Pipeline Kanban de oportunidades</h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  Arrastra cada prospecto por las etapas de tu proceso de venta: <strong>Nuevo → Cotizado → 
                  En seguimiento → Cerrado</strong>. Siempre sabrás qué tratos necesitan atención.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 shadow-xs">
                <BoltIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Conexión oficial verificada</h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  Tu número queda verificado como cuenta oficial de negocio en WhatsApp. 
                  <strong>Sin riesgo de baneo</strong>, sin apps de terceros, sin compartir tu celular personal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DIFERENCIADOR: PIPELINE KANBAN VISUAL ─── */}
      <section className="py-16 bg-blue-50 border-y border-blue-100 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Diferenciador clave</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
              Convierte chats dispersos en un embudo de ventas visual
            </h2>
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">
              La mayoría de los CRM solo guardan contactos. Nuestro <strong>Tablero Kanban</strong> conecta 
              directamente con las conversaciones de WhatsApp para que sepas al instante el estado de cada negociación.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Arrastra y suelta contactos entre etapas comerciales',
                'Filtra por asesor, etiqueta o fecha de última interacción',
                'Vista unificada: pipeline + chat en la misma pantalla',
                'Métricas de conversión por etapa en tiempo real',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-gray-700">
                  <CheckIcon className="h-5 w-5 text-blue-600 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={scrollToPlans}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
            >
              <span>Empezar Ahora</span>
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Mockup simplificado del Pipeline */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-[11px] font-bold text-gray-500 uppercase mb-2">Nuevos</p>
                <div className="space-y-2">
                  <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                    <p className="text-xs font-bold text-blue-900">Clínica San Ángel</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Interesado en agenda</p>
                  </div>
                  <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                    <p className="text-xs font-bold text-blue-900">Inmobiliaria MX</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">3 líneas requeridas</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-[11px] font-bold text-amber-600 uppercase mb-2">Cotización</p>
                <div className="space-y-2">
                  <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                    <p className="text-xs font-bold text-amber-900">Hotel Colima</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">$999/mes enviado</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-[11px] font-bold text-emerald-600 uppercase mb-2">Ganados ✓</p>
                <div className="space-y-2">
                  <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                    <p className="text-xs font-bold text-emerald-900">Ferretería Gómez</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Plan Profesional</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA PUENTE ─── */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-gray-500 uppercase tracking-wider font-bold">¿Tu consultorio médico?</p>
          <h3 className="mt-1 text-xl font-bold text-gray-900">
            Tenemos una solución especializada para clínicas y profesionales de la salud
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Agenda de citas inteligente, recordatorios automáticos, triaje por WhatsApp y más.
          </p>
          <Link
            href="/landingpage/crm/consultorio"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-700 transition-colors shadow-xs"
          >
            <span>Ver Solución para Consultorios</span>
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* ─── PLANES Y CHECKOUT ─── */}
      <section id="planes" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 border-t border-gray-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Membresías</span>
            <h2 className="mt-2 text-3xl font-extrabold text-gray-900">
              Elige tu plan y activa tu CRM hoy mismo
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Pagos recurrentes mensuales seguros con Mercado Pago. Cancela cuando quieras sin penalización.
            </p>
          </div>

          {loadingPlans ? (
            <div className="p-16 text-center text-gray-400">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="mt-3 text-xs">Cargando membresías disponibles…</p>
            </div>
          ) : plans.length > 0 ? (
            <div className={`grid gap-8 max-w-4xl mx-auto ${plans.length === 1 ? 'grid-cols-1 max-w-md' : plans.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
              {plans.map((p) => {
                const isFree = p.price_mxn <= 0;
                const isPopular = p.slug === 'crm-basic-plus';
                return (
                  <div
                    key={p.id}
                    className={`rounded-3xl bg-white p-8 flex flex-col justify-between shadow-sm transition-all hover:shadow-lg relative ${
                      isPopular 
                        ? 'border-2 border-blue-600 ring-2 ring-blue-100' 
                        : isFree
                        ? 'border border-gray-200 bg-linear-to-b from-gray-50/50 to-white'
                        : 'border border-gray-200'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold text-white uppercase shadow-sm">
                          <StarIcon className="h-3 w-3" /> Más Popular
                        </span>
                      </div>
                    )}

                    {isFree && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white uppercase shadow-sm">
                          Sin Costo
                        </span>
                      </div>
                    )}

                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{p.name}</h3>
                      <p className="mt-1 text-sm text-gray-500">{p.description}</p>

                      <div className="mt-6 flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-gray-900">
                          {isFree ? 'Gratis' : `$${p.price_mxn.toFixed(0)}`}
                        </span>
                        <span className="text-sm text-gray-500 font-medium">{isFree ? 'sin tarjeta' : 'MXN / mes'}</span>
                      </div>

                      <ul className="mt-6 space-y-3 border-t border-gray-100 pt-6">
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>Hasta <strong>{p.features_payload?.max_whatsapp_accounts ?? 1}</strong> {(p.features_payload?.max_whatsapp_accounts ?? 1) === 1 ? 'línea' : 'líneas'} de WhatsApp</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>Hasta <strong>{p.features_payload?.max_team_members ?? 5}</strong> agentes / miembros</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>Hasta <strong>{(p.features_payload?.max_contacts ?? 500).toLocaleString()}</strong> contactos</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>Pipeline Kanban de ventas</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>Agente de IA 24/7</span>
                        </li>
                        {p.features_payload?.lab_enabled && (
                          <li className="flex items-center gap-2 text-sm text-gray-700">
                            <CheckIcon className="h-4 w-4 text-purple-600 shrink-0" />
                            <span className="font-semibold text-purple-700">Laboratorio de evaluación IA</span>
                          </li>
                        )}
                        {p.features_payload?.tasks_enabled && (
                          <li className="flex items-center gap-2 text-sm text-gray-700">
                            <CheckIcon className="h-4 w-4 text-purple-600 shrink-0" />
                            <span className="font-semibold text-purple-700">Módulo de tareas</span>
                          </li>
                        )}
                        {p.features_payload?.attribution_enabled && (
                          <li className="flex items-center gap-2 text-sm text-gray-700">
                            <CheckIcon className="h-4 w-4 text-purple-600 shrink-0" />
                            <span className="font-semibold text-purple-700">Atribución Meta CAPI</span>
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
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      {isFree ? (
                        claimingTrial ? (
                          <span>Activando prueba gratuita…</span>
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
              <h3 className="text-base font-bold text-gray-900">Próximamente</h3>
              <p className="mt-2 text-sm text-gray-600">
                Estamos preparando los planes de membresía. Pronto podrás contratar directamente aquí.
              </p>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-8">
            Todos los planes incluyen soporte por WhatsApp y actualizaciones automáticas.
          </p>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-950 to-blue-800 text-white text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold">
            ¿Listo para dejar de perder ventas en WhatsApp?
          </h2>
          <p className="text-blue-200 text-base max-w-xl mx-auto">
            Activa tu CRM hoy y empieza a cerrar más tratos con tu equipo conectado, 
            inteligencia artificial respondiendo y un pipeline visual de oportunidades.
          </p>
          <button
            onClick={scrollToPlans}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-blue-950 shadow-xl hover:bg-blue-50 transition-all hover:shadow-2xl"
          >
            <span>Ver Planes y Contratar</span>
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
