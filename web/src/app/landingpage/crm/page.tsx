'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  TrophyIcon,
  ShieldCheckIcon,
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
                <span>CRM con Automatizaciones + WhatsApp API Oficial</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.1]">
                Deja de perder clientes <br className="hidden sm:inline" />
                en tus chats de WhatsApp
              </h1>

              <p className="text-lg text-blue-100 max-w-xl leading-relaxed">
                Centraliza las conversaciones en una bandeja compartida, activa <strong>automatizaciones inteligentes de reabasto y reactivación</strong>, deja que la <strong>IA responda 24/7</strong> y organiza cada prospecto en un <strong>embudo de ventas visual</strong>.
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

              {/* Prueba social */}
              <div className="flex items-center gap-3 pt-4 text-xs text-blue-200/90">
                <div className="flex -space-x-2">
                  <div className="h-7 w-7 rounded-full bg-cyan-500/80 border-2 border-blue-900 flex items-center justify-center text-[10px] font-black text-white shadow-xs">IF</div>
                  <div className="h-7 w-7 rounded-full bg-emerald-500/80 border-2 border-blue-900 flex items-center justify-center text-[10px] font-black text-white shadow-xs">CS</div>
                  <div className="h-7 w-7 rounded-full bg-amber-500/80 border-2 border-blue-900 flex items-center justify-center text-[10px] font-black text-white shadow-xs">RM</div>
                </div>
                <span>Empresas como <strong>ICEFrut México</strong>, clínicas y distribuidoras ya venden en automático con nosotros</span>
              </div>
            </div>

            {/* Mockup visual fiel del Pipeline real */}
            <div className="hidden lg:block">
              <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[12px] font-bold text-blue-200 tracking-wide flex items-center gap-2">
                    <ViewColumnsIcon className="h-4 w-4 text-cyan-300" />
                    <span>Pipeline de Ventas en Vivo</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Automatizaciones activas
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-left">
                  {/* Columna: Nuevo */}
                  <div className="bg-white/8 backdrop-blur rounded-xl p-2.5 border border-white/10 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-blue-200 uppercase">Nuevo</span>
                        <span className="text-[9px] bg-blue-500/30 text-blue-200 px-1.5 py-0.2 rounded-full font-bold">2</span>
                      </div>
                      <div className="bg-slate-900/60 p-2 rounded-lg border border-white/10 shadow-xs mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="h-4 w-4 rounded-full bg-blue-500 text-[8px] font-bold flex items-center justify-center text-white shrink-0">SG</span>
                          <p className="text-[10px] font-bold text-white truncate">Salvador G.</p>
                        </div>
                        <p className="text-[8px] text-blue-200/70 mt-1">Actividad: Hoy</p>
                      </div>
                    </div>
                  </div>

                  {/* Columna: En conversación */}
                  <div className="bg-white/8 backdrop-blur rounded-xl p-2.5 border border-white/10 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-cyan-200 uppercase">Conversación</span>
                        <span className="text-[9px] bg-cyan-500/30 text-cyan-200 px-1.5 py-0.2 rounded-full font-bold">4</span>
                      </div>
                      <div className="bg-slate-900/60 p-2 rounded-lg border border-white/10 shadow-xs mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="h-4 w-4 rounded-full bg-rose-500 text-[8px] font-bold flex items-center justify-center text-white shrink-0">MA</span>
                          <p className="text-[10px] font-bold text-white truncate">Mariana A.</p>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[8px] text-cyan-200/70">10:25 a.m.</span>
                          <span className="text-[9px] font-bold text-cyan-300">$180.00</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Columna: Cliente (Trofeo) */}
                  <div className="bg-white/8 backdrop-blur rounded-xl p-2.5 border border-emerald-500/30 ring-1 ring-emerald-500/20 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-emerald-300 uppercase flex items-center gap-1">
                          <TrophyIcon className="h-3 w-3 text-emerald-400" />
                          <span>Cliente</span>
                        </span>
                        <span className="text-[9px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.2 rounded-full font-bold">140</span>
                      </div>
                      <div className="bg-emerald-950/50 p-2 rounded-lg border border-emerald-500/30 shadow-xs mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="h-4 w-4 rounded-full bg-emerald-500 text-[8px] font-bold flex items-center justify-center text-white shrink-0">SR</span>
                          <p className="text-[10px] font-bold text-white truncate">Sofía R.</p>
                        </div>
                        <p className="text-[8px] text-emerald-300 font-semibold mt-1">🔔 Reabasto: Mañana</p>
                      </div>
                    </div>
                  </div>

                  {/* Columna: Perdido */}
                  <div className="bg-white/8 backdrop-blur rounded-xl p-2.5 border border-purple-500/30 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-purple-200 uppercase">Perdido</span>
                        <span className="text-[9px] bg-purple-500/30 text-purple-200 px-1.5 py-0.2 rounded-full font-bold">54</span>
                      </div>
                      <div className="bg-slate-900/60 p-2 rounded-lg border border-purple-400/20 shadow-xs mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="h-4 w-4 rounded-full bg-amber-500 text-[8px] font-bold flex items-center justify-center text-white shrink-0">GR</span>
                          <p className="text-[10px] font-bold text-white truncate">Gris R.</p>
                        </div>
                        <p className="text-[8px] text-purple-300 font-semibold mt-1">📩 Encuesta enviada</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-blue-200">
                  <span>Sincronizado vía WhatsApp Cloud API Oficial</span>
                  <span className="text-emerald-300 font-semibold">Tasa de recompra: ~45%</span>
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
              <h3 className="text-base font-bold text-gray-900">Sin seguimiento ni recompras</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Nadie avisa al cliente cuando se le va a acabar el producto ni se investiga por qué se perdieron prospectos. 
                <strong>Vendes a ciegas y dejas dinero sobre la mesa</strong>.
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
                  Arrastra cada prospecto por las etapas de tu proceso de venta: <strong>Nuevo → Conversación → Interesado → Cliente 🏆 → Perdido</strong>. Siempre sabrás qué tratos necesitan atención.
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
                  <strong> plantillas aprobadas por Meta</strong> directo en tu panel para automatizar recordatorios y reactivaciones con 1 clic sin salir a plataformas externas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── NUEVA SECCIÓN: AUTOMATIZACIONES INTELIGENTES ─── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">El motor de recompra</span>
            <h2 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white">
              Automatizaciones que generan ventas mientras tú te ocupas del negocio
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
              No dejes que la recompra dependa de la memoria de tu cliente. Nuestro CRM calcula, dispara y da seguimiento de forma autónoma usando plantillas oficiales de WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tarjeta 1: Reabasto Predictivo */}
            <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-6 flex flex-col justify-between hover:border-cyan-500/50 transition-all shadow-lg">
              <div>
                <div className="h-12 w-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-5 border border-cyan-500/30">
                  <ClockIcon className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Predictivo</span>
                <h3 className="text-lg font-bold text-white mt-1">Recordatorio de Reabasto 24h Antes</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  El sistema calcula la duración estimada de los productos adquiridos por cada cliente y envía un recordatorio amistoso exactamente <strong>un día antes de que se le terminen</strong>.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-700/60 text-xs text-cyan-300 font-semibold flex items-center gap-1.5">
                <CheckIcon className="h-4 w-4" />
                <span>Hasta 40% a 50% de conversión en pedidos</span>
              </div>
            </div>

            {/* Tarjeta 2: Recuperación de Perdidos */}
            <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-6 flex flex-col justify-between hover:border-purple-500/50 transition-all shadow-lg">
              <div>
                <div className="h-12 w-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-5 border border-purple-500/30">
                  <ArrowPathIcon className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">Reactivación</span>
                <h3 className="text-lg font-bold text-white mt-1">Encuestas y Recuperación Semanal</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Para los prospectos o clientes que pasan a la etapa de <strong>Perdido</strong> tras campañas o inactividad, el CRM envía automáticamente una encuesta de satisfacción o invitación con oferta.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-700/60 text-xs text-purple-300 font-semibold flex items-center gap-1.5">
                <CheckIcon className="h-4 w-4" />
                <span>Recupera cerca de un 5% de ventas cada semana</span>
              </div>
            </div>

            {/* Tarjeta 3: Sin fricción técnica */}
            <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 p-6 flex flex-col justify-between hover:border-emerald-500/50 transition-all shadow-lg">
              <div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5 border border-emerald-500/30">
                  <BoltIcon className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Listo para usar</span>
                <h3 className="text-lg font-bold text-white mt-1">Generador de Plantillas Oficial</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  La solución ya está lista en tu panel. Cada organización redacta y envía sus plantillas a Meta con 1 clic usando el editor integrado del CRM, 100% verificado y sin riesgo de bloqueo.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-700/60 text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                <CheckIcon className="h-4 w-4" />
                <span>Sin configuraciones complejas ni código</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CASO DE ÉXITO VERIFICADO: ICEFRUT MÉXICO ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-blue-50/50">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-3xl border border-blue-200/80 bg-white p-8 sm:p-12 shadow-xl shadow-blue-900/5 relative overflow-hidden">
            {/* Decoración sutil de fondo */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-cyan-100/40 via-amber-100/20 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

            <div className="relative">
              {/* Encabezado del caso */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 relative rounded-2xl bg-white border border-gray-200 p-2 shadow-xs flex items-center justify-center overflow-hidden">
                    <Image
                      src="/images/icefrut-logo.png"
                      alt="Logo Oficial Ice-Frut México"
                      width={64}
                      height={64}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-gray-900 tracking-tight">ICEFrut México</h3>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <ShieldCheckIcon className="h-3 w-3 text-emerald-600" />
                        Caso Verificado
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Fruta congelada formulada para jugos verdes listos para licuar · <a href="https://icefrutmexico.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-medium">icefrutmexico.com <ArrowTopRightOnSquareIcon className="h-3 w-3" /></a>
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Giro comercial</span>
                  <span className="text-sm font-semibold text-gray-800">Alimentos saludables & Recompra periódica</span>
                </div>
              </div>

              {/* Contenido principal: Cita + Métricas */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 items-center">
                <div className="lg:col-span-7 space-y-4">
                  <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                    <SparklesIcon className="h-4 w-4" />
                    Cómo transformaron su atención y recompra
                  </span>

                  <blockquote className="text-base sm:text-lg text-gray-700 leading-relaxed italic">
                    &ldquo;El CRM calcula de manera automática cuándo el producto de cada cliente está por terminarse y les envía un recordatorio un día antes por WhatsApp para abastecerse de nuevo. Además, a los prospectos que se quedaron en la etapa de perdidos les enviamos una encuesta para saber qué podemos mejorar. Esta simple automatización nos permite recuperar ventas y retroalimentación valiosa semana con semana sin tener que hacerlo manualmente.&rdquo;
                  </blockquote>

                  <div className="pt-2">
                    <p className="text-sm font-bold text-gray-900">Diana Martínez</p>
                    <p className="text-xs text-gray-500 font-medium">Propietaria de ICEFrut México</p>
                  </div>
                </div>

                {/* Métricas destacadas */}
                <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                  <div className="rounded-2xl bg-blue-50/80 border border-blue-100 p-4">
                    <div className="text-2xl sm:text-3xl font-black text-blue-900">4 a 10 ventas</div>
                    <p className="text-xs font-semibold text-blue-700 mt-1">generadas de cada 10 a 20 recordatorios predictivos</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Tasa de conversión de entre 40% y 50% en recompra periódica.</p>
                  </div>

                  <div className="rounded-2xl bg-emerald-50/80 border border-emerald-100 p-4">
                    <div className="text-2xl sm:text-3xl font-black text-emerald-900">~5% semanal</div>
                    <p className="text-xs font-semibold text-emerald-700 mt-1">de recuperación en prospectos perdidos</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Reactivación de leads mediante encuesta de satisfacción e invitación.</p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 border border-gray-200/80 p-4 sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-black text-gray-900">140 Clientes Activos</div>
                        <p className="text-xs text-gray-600 mt-0.5">Gestionados en una sola plataforma con embudo visual y WhatsApp.</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-100 px-2 py-1 rounded-md">54 en seguimiento</span>
                      </div>
                    </div>
                  </div>
                </div>
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
              directamente con las conversaciones de WhatsApp para que sepas al instante el estado de cada negociación y qué automatización aplicar.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Arrastra y suelta prospectos entre etapas (Nuevo, En conversación, Interesado, Cliente, Perdido)',
                'Calculador de reabasto integrado: dispara recordatorios 24 horas antes',
                'Encuestas de reactivación para leads perdidos con plantillas de Meta en 1 clic',
                'Vista unificada: pipeline visual + chat de WhatsApp en la misma pantalla',
                'Historial completo de pedidos y actividad por cada contacto',
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

          {/* Mockup detallado del Pipeline Kanban recreado fielmente */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
              <div>
                <p className="text-xs font-bold text-gray-800">Pipeline Comercial</p>
                <p className="text-[10px] text-gray-400">Visibilidad completa de ingresos y etapas</p>
              </div>
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded-md border border-blue-200">
                194 contactos totales
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Etapa 1: Interesado */}
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200/70">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-gray-600 uppercase">Interesado</p>
                  <span className="text-[9px] bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded-full font-bold">3</span>
                </div>
                <div className="space-y-1.5">
                  <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-gray-900 truncate">Evangelina B.</p>
                      <span className="text-[9px] font-bold text-gray-700">$180</span>
                    </div>
                    <p className="text-[9px] text-gray-400 mt-0.5">Actividad: 11:36 a.m.</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-gray-900 truncate">Mónica V.</p>
                      <span className="text-[9px] font-bold text-gray-700">$180</span>
                    </div>
                    <p className="text-[9px] text-gray-400 mt-0.5">Actividad: Hoy</p>
                  </div>
                </div>
              </div>

              {/* Etapa 2: Cliente 🏆 */}
              <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-1">
                    <TrophyIcon className="h-3 w-3 text-emerald-600" />
                    <span>Cliente</span>
                  </p>
                  <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded-full font-bold">140</span>
                </div>
                <div className="space-y-1.5">
                  <div className="bg-white p-2 rounded-lg border border-emerald-300 shadow-2xs ring-1 ring-emerald-400/20">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-gray-900 truncate">Lucía M.</p>
                      <span className="text-[9px] font-bold text-emerald-700">$180</span>
                    </div>
                    <div className="mt-1 bg-emerald-50 px-1.5 py-0.5 rounded text-[8px] font-semibold text-emerald-800 border border-emerald-200">
                      🔔 Reabasto programado
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-gray-900 truncate">Araceli G.</p>
                      <span className="text-[9px] font-bold text-emerald-700">$180</span>
                    </div>
                    <p className="text-[9px] text-gray-400 mt-0.5">Actividad: 21 sep</p>
                  </div>
                </div>
              </div>

              {/* Etapa 3: Perdido */}
              <div className="bg-purple-50/50 p-2.5 rounded-xl border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-purple-700 uppercase">Perdido</p>
                  <span className="text-[9px] bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded-full font-bold">54</span>
                </div>
                <div className="space-y-1.5">
                  <div className="bg-white p-2 rounded-lg border border-purple-300 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-gray-900 truncate">Nancy P.</p>
                      <span className="text-[8px] bg-purple-100 text-purple-800 px-1 rounded font-semibold">Campaña</span>
                    </div>
                    <div className="mt-1 bg-purple-50 px-1.5 py-0.5 rounded text-[8px] font-semibold text-purple-800 border border-purple-200">
                      📩 Encuesta enviada
                    </div>
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
