'use client';

import React from 'react';
import Link from 'next/link';
import {
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  SparklesIcon,
  ViewColumnsIcon,
  CheckIcon,
  BoltIcon,
  ClockIcon,
  ArrowRightIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import MembershipPlans from '@/components/landing/MembershipPlans';
import LandingFaqSection from '@/components/landing/LandingFaqSection';

export default function CrmLandingPage() {
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
                <span>CRM Omnicanal para WhatsApp con IA</span>
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
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-blue-950 shadow-lg hover:bg-blue-50 transition-all hover:shadow-xl cursor-pointer"
                >
                  <span>Ver Membresías y Planes</span>
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
                <h3 className="text-base font-bold text-gray-900">Asistente virtual de IA que no duerme</h3>
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
                <h3 className="text-base font-bold text-gray-900">Conexión oficial y plantillas de Meta integradas</h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  Cuenta verificada oficial <strong>sin riesgo de baneo</strong>. Además, crea y gestiona 
                  <strong> plantillas aprobadas por Meta</strong> directo en tu panel para reactivar prospectos con 1 clic sin salir a plataformas externas.
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
                'Arrastra y suelta prospectos entre etapas comerciales',
                'Filtra por asesor, etiqueta o fecha de última interacción',
                'Reactivación de prospectos inactivos con plantillas oficiales en 1 clic',
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
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <span>Ver Membresías</span>
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
          <p className="text-sm text-gray-500 uppercase tracking-wider font-bold">¿Tienes un consultorio o clínica?</p>
          <h3 className="mt-1 text-xl font-bold text-gray-900">
            Tenemos una solución especializada para profesionales de la salud
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Agenda médica especializada, agendamiento de pacientes 24/7 y triaje por WhatsApp.
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

      {/* ─── MEMBRESÍAS Y PLANES (COMPONENTE MODULAR DINÁMICO) ─── */}
      <MembershipPlans
        theme="blue"
        sector="general"
        endpointAgenda={false}
        includeFree={true}
        id="planes"
        title="Elige tu plan y activa tu CRM hoy mismo"
        subtitle="Pagos recurrentes mensuales seguros procesados con Mercado Pago. Cancela cuando quieras sin penalización."
      />

      {/* ─── PREGUNTAS FRECUENTES (FAQ & SEO) ─── */}
      <LandingFaqSection theme="blue" sector="general" id="faq" />

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
            className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-blue-950 shadow-xl hover:bg-blue-50 transition-all hover:shadow-2xl cursor-pointer"
          >
            <span>Ver Membresías Disponibles</span>
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
