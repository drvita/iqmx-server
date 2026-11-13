'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  DeviceTabletIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
  WifiIcon,
} from '@heroicons/react/24/outline';

const BENEFITS = [
  {
    title: 'Reconocimiento Facial con Prueba de Vida',
    description:
      'Verifica que la persona esté presente frente a la cámara en tiempo real, evitando registros con fotografías o videos.',
    icon: SparklesIcon,
  },
  {
    title: 'Funciona Incluso Sin Internet',
    description:
      'Tus colaboradores pueden checar su entrada, comida y salida aunque falle la red; los registros se envían automáticamente al volver la conexión.',
    icon: WifiIcon,
  },
  {
    title: 'Reportes de Jornada Laboral',
    description:
      'Calcula automáticamente horas trabajadas, retardos, tiempos de comida y cumplimiento semanal (de 48h a 40h) listos para nómina.',
    icon: ClockIcon,
  },
  {
    title: 'Vinculación Rápida por Código QR',
    description:
      'Convierte cualquier tablet o teléfono en una terminal de asistencia en segundos escaneando un código QR o ingresando un PIN.',
    icon: QrCodeIcon,
  },
  {
    title: 'Privacidad Protegida (LFPDPPP)',
    description:
      'No almacena fotografías innecesarias en la nube, registra el consentimiento del colaborador y protege la terminal con PIN de auditoría.',
    icon: ShieldCheckIcon,
  },
  {
    title: 'Sucursales y Asistentes',
    description:
      'Organiza tus sedes, asigna horarios por turno y delega el seguimiento diario a tus asistentes de Recursos Humanos.',
    icon: BuildingOffice2Icon,
  },
];

const FAQS = [
  {
    q: '¿Necesito comprar un reloj checador especial?',
    a: 'No. Puedes usar cualquier tablet, computadora con cámara o teléfono Android/iOS conectado en tu sucursal como terminal quiosco.',
  },
  {
    q: '¿Qué pasa si se va el internet en el negocio?',
    a: 'La terminal sigue registrando asistencias normalmente y guarda los eventos de forma segura hasta que regresa la conexión para sincronizarse con tu panel.',
  },
  {
    q: '¿Cómo empiezo la prueba gratuita de 1 mes?',
    a: 'Solo ingresa a tu Portal de Clientes, activa Checador Facial en un clic y recibe tu acceso inmediato sin necesidad de tarjeta de crédito.',
  },
  {
    q: '¿Puedo cambiar el logotipo y colores del quiosco?',
    a: 'Sí. Desde el panel administrativo puedes subir el logotipo de tu empresa, elegir tus colores y personalizar el mensaje de bienvenida.',
  },
];

export default function ChecadorLandingPage() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5213318144928';
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    'Hola, quiero más información sobre Checador Facial para mi empresa.'
  )}`;

  const scrollToPlans = () => {
    document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-gray-900 font-sans">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-indigo-950 to-indigo-900 text-white">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-200 border border-white/15">
                <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
                <span>Control de Asistencia Facial + Prueba de Vida</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                Control de asistencia moderno, sin filas ni registros falsos
              </h1>

              <p className="text-base sm:text-lg text-indigo-100 max-w-xl leading-relaxed">
                Convierte cualquier tablet en un <strong>Checador Facial</strong> inteligente.
                Registra entradas, comidas y salidas en segundos, opera incluso sin internet
                y obtén reportes claros de jornada laboral.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  href="/portal/checador"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-indigo-950 shadow-lg hover:bg-indigo-50 transition-all"
                >
                  <span>Probar 1 Mes Gratis</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={scrollToPlans}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition-all"
                >
                  <span>Ver Planes y Límites</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-indigo-200">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-300" />
                  Sin hardware costoso
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-300" />
                  Cumplimiento LFPDPPP
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-300" />
                  Listo en minutos
                </span>
              </div>
            </div>

            {/* Tarjeta visual del Quiosco */}
            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-100">
                  <DeviceTabletIcon className="h-5 w-5 text-emerald-300" />
                  <span>Terminal Quiosco Inteligente</span>
                </div>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                  Prueba de vida activa
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="rounded-xl bg-indigo-950/70 border border-white/10 p-4">
                  <p className="text-[11px] text-indigo-200">Colaboradores</p>
                  <p className="text-2xl font-bold text-white mt-1">Hasta 15</p>
                  <p className="text-[11px] text-emerald-300 mt-1">Plan inicial PyME</p>
                </div>
                <div className="rounded-xl bg-indigo-950/70 border border-white/10 p-4">
                  <p className="text-[11px] text-indigo-200">Tiempo de registro</p>
                  <p className="text-2xl font-bold text-white mt-1">&lt; 1 seg</p>
                  <p className="text-[11px] text-emerald-300 mt-1">Sin contacto físico</p>
                </div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">¿Ya tienes cuenta en Checador Facial?</p>
                  <p className="text-[11px] text-indigo-200 mt-0.5">Ingresa directo al panel o vincula tu quiosco.</p>
                </div>
                <a
                  href="https://checador.iqissmexico.com/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-400 shrink-0"
                >
                  <span>Entrar</span>
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section className="py-16 lg:py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              Diseñado para negocios reales y fácil de usar para todo tu equipo
            </h2>
            <p className="mt-3 text-base text-gray-600">
              Simplifica el pase de lista diario y evita errores manuales en el cálculo de horas trabajadas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="rounded-2xl bg-white border border-gray-200 p-6 shadow-xs hover:shadow-md transition-shadow"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">{b.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{b.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PLANES Y PRECIOS */}
      <section id="planes" className="py-16 lg:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              Empieza gratis y crece a tu ritmo
            </h2>
            <p className="mt-3 text-base text-gray-600">
              Activa tu cuenta en minutos desde el Portal de Clientes sin plazos forzosos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Prueba 1 Mes */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 flex flex-col justify-between">
              <div>
                <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                  Prueba Gratuita
                </span>
                <h3 className="text-2xl font-extrabold text-gray-900 mt-4">1 Mes Sin Costo</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Ideal para validar la operación con tu equipo en sucursal antes de contratar.
                </p>
                <p className="mt-6 text-4xl font-extrabold text-gray-900">
                  $0 <span className="text-sm font-medium text-gray-500">MXN / 30 días</span>
                </p>

                <ul className="mt-6 space-y-3 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                    Hasta 15 colaboradores activos
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                    Hasta 2 terminales quiosco
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                    1 sucursal y reportes semanales
                  </li>
                </ul>
              </div>

              <Link
                href="/portal/checador"
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-600 bg-white px-5 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50 transition-colors"
              >
                <span>Activar Prueba Gratis</span>
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>

            {/* Plan Básico */}
            <div className="rounded-2xl border-2 border-indigo-600 bg-white p-8 shadow-lg flex flex-col justify-between">
              <div>
                <span className="inline-block rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
                  Recomendado PyME
                </span>
                <h3 className="text-2xl font-extrabold text-gray-900 mt-4">Plan Básico</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Operación continua para negocios y equipos que buscan orden y puntualidad.
                </p>
                <p className="mt-6 text-4xl font-extrabold text-gray-900">
                  $520 <span className="text-sm font-medium text-gray-500">MXN / mes</span>
                </p>

                <ul className="mt-6 space-y-3 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                    Hasta 15 colaboradores activos (ampliable)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                    Hasta 2 terminales quiosco con marca propia
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                    Reportes semanales y soporte técnico incluido
                  </li>
                </ul>
              </div>

              <div className="mt-8 space-y-2.5">
                <Link
                  href="/portal/checador"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
                >
                  <span>Contratar en el Portal</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <UserGroupIcon className="h-4 w-4 text-emerald-600" />
                  <span>Cotizar más colaboradores por WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PREGUNTAS FRECUENTES */}
      <section className="py-16 bg-gray-50 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-gray-900 text-center mb-10">
            Preguntas Frecuentes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FAQS.map((item) => (
              <div key={item.q} className="rounded-2xl bg-white border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-900">{item.q}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
