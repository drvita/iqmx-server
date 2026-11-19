'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownTrayIcon,
  ArrowLeftStartOnRectangleIcon,
  ArrowPathIcon,
  ArrowRightEndOnRectangleIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  BuildingOffice2Icon,
  CalendarIcon,
  CameraIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  Cog6ToothIcon,
  DeviceTabletIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  LockClosedIcon,
  PencilIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Squares2X2Icon,
  TrashIcon,
  UserIcon,
  UserGroupIcon,
  UserPlusIcon,
  UsersIcon,
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

const WEEKLY_COMPLIANCE_ROWS = [
  {
    nombre: 'Carlos Mendoza',
    codigo: 'EMP-014',
    puesto: 'Operador CNC',
    horas: '46.50 h / 48 h',
    dias: '5',
    inProgress: true,
    retardos: '0',
    estado: 'En rango',
    estadoClass: 'bg-emerald-50 text-[#059669]',
  },
  {
    nombre: 'Ana Laura Soto',
    codigo: 'EMP-008',
    puesto: 'Supervisora de Calidad',
    horas: '47.20 h / 48 h',
    dias: '5',
    inProgress: false,
    retardos: '1',
    estado: 'Próximo al límite',
    estadoClass: 'bg-amber-50 text-amber-800',
  },
  {
    nombre: 'Miguel Ángel Ruiz',
    codigo: 'EMP-021',
    puesto: 'Montacarguista',
    horas: '39.80 h / 48 h',
    dias: '4',
    inProgress: true,
    retardos: '0',
    estado: 'En rango',
    estadoClass: 'bg-emerald-50 text-[#059669]',
  },
  {
    nombre: 'Roberto Garza',
    codigo: 'EMP-003',
    puesto: 'Jefe de Mantenimiento',
    horas: '45.00 h / 48 h',
    dias: '5',
    inProgress: false,
    retardos: '0',
    estado: 'En rango',
    estadoClass: 'bg-emerald-50 text-[#059669]',
  },
];

const RECENT_CHECKINS_ROWS = [
  {
    fecha: '18 nov, 07:58 a.m.',
    colaborador: 'Carlos Mendoza',
    codigo: 'Código: EMP-014',
    movimiento: 'Entrada',
    terminal: 'Planta Monterrey · Acceso Principal',
    estado: 'Válido',
    estadoClass: 'bg-emerald-50 text-[#059669]',
    evidencia: 'Local en terminal',
  },
  {
    fecha: '18 nov, 07:56 a.m.',
    colaborador: 'Miguel Ángel Ruiz',
    codigo: 'Código: EMP-021',
    movimiento: 'Entrada',
    terminal: 'Planta Monterrey · Acceso Principal',
    estado: 'Válido',
    estadoClass: 'bg-emerald-50 text-[#059669]',
    evidencia: 'Local en terminal',
  },
  {
    fecha: '18 nov, 08:04 a.m.',
    colaborador: 'Ana Laura Soto',
    codigo: 'Código: EMP-008',
    movimiento: 'Entrada',
    terminal: 'Planta Monterrey · Nave Industrial 2',
    estado: 'Válido',
    estadoClass: 'bg-emerald-50 text-[#059669]',
    evidencia: 'Local en terminal',
  },
  {
    fecha: '18 nov, 07:51 a.m.',
    colaborador: 'Persona no identificada',
    codigo: null,
    movimiento: 'Entrada',
    terminal: 'Planta Monterrey · Acceso Principal',
    estado: 'Foto/Pantalla',
    estadoClass: 'bg-red-50 text-red-700',
    evidencia: 'Local en terminal',
  },
];

const DIRECTORY_EMPLOYEES = [
  {
    nombre: 'Carlos Mendoza',
    meta: 'EMP-014 · Operador CNC',
    rostros: '3 / 3',
  },
  {
    nombre: 'Ana Laura Soto',
    meta: 'EMP-008 · Supervisora de Calidad',
    rostros: '3 / 3',
  },
  {
    nombre: 'Miguel Ángel Ruiz',
    meta: 'EMP-021 · Montacarguista',
    rostros: '3 / 3',
  },
];

const ADMIN_NAV_ITEMS = [
  { label: 'Inicio', icon: Squares2X2Icon, active: true },
  { label: 'Colaboradores', icon: UsersIcon, active: false },
  { label: 'Horarios', icon: ClockIcon, active: false },
  { label: 'Sucursales', icon: BuildingOffice2Icon, active: false },
  { label: 'Dispositivos', icon: DeviceTabletIcon, active: false },
  { label: 'Asistentes', icon: UserIcon, active: false },
  { label: 'Configuración', icon: Cog6ToothIcon, active: false },
];

const QR_MATRIX_PATTERN = [
  '1111101011111',
  '1000100110001',
  '1010101010101',
  '1000100110001',
  '1111101011111',
  '0000001100000',
  '1011010110101',
  '0000001001100',
  '1111100110110',
  '1000101001001',
  '1010101110101',
  '1000100010110',
  '1111101101011',
];

type PublicChecadorPlan = {
  id: number;
  product_id: number;
  name: string;
  slug: string;
  description: string | null;
  price_mxn: number;
  billing_interval: string;
  features_payload: {
    max_empleados?: number;
    max_dispositivos?: number;
    max_sucursales?: number;
    horas_semanales_max?: number;
    cloud_evidences_enabled?: boolean;
    extra_roles_enabled?: boolean;
    [key: string]: unknown;
  };
};

export default function ChecadorLandingPage() {
  const [plans, setPlans] = useState<PublicChecadorPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${apiUrl}/api/public/products/checador/plans?include_free=true`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, []);

  const heroEmployees = plans[0]?.features_payload?.max_empleados ?? 15;

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
            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4 sm:p-5 shadow-2xl space-y-4">
              {/* Vista compacta de Terminal Quiosco en operación */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#f8f9ff] text-[#0b1c30] shadow-lg">
                {/* Header del Quiosco */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1e1b4b] text-[11px] font-bold text-white">
                      MN
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#070235]">
                        Manufacturas del Norte
                      </p>
                      <p className="truncate text-[10px] font-medium text-slate-500">
                        Planta Monterrey · Acceso Principal
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-bold text-[#070235] tabular-nums">
                      07:58:14 <span className="text-[10px] text-[#4f46e5]">AM</span>
                    </p>
                    <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#059669]">
                      <WifiIcon className="h-3 w-3" />
                      <span>En línea · 0 por enviar</span>
                    </p>
                  </div>
                </div>

                {/* Cuerpo compacto */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3.5 items-stretch">
                  <div className="sm:col-span-6 flex flex-col justify-between gap-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between rounded-lg bg-[#059669] px-3 py-2 text-white shadow-xs">
                        <div className="flex items-center gap-2">
                          <ArrowRightEndOnRectangleIcon className="h-4 w-4 shrink-0" />
                          <div>
                            <span className="block text-[8px] font-semibold uppercase tracking-wider text-emerald-100">
                              Entrada
                            </span>
                            <span className="block text-[11px] font-extrabold">
                              REGISTRAR ENTRADA
                            </span>
                          </div>
                        </div>
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-[#1e1b4b] px-3 py-2 text-white shadow-xs">
                        <div className="flex items-center gap-2">
                          <ArrowLeftStartOnRectangleIcon className="h-4 w-4 shrink-0" />
                          <div>
                            <span className="block text-[8px] font-semibold uppercase tracking-wider text-indigo-200">
                              Salida
                            </span>
                            <span className="block text-[11px] font-extrabold">
                              REGISTRAR SALIDA
                            </span>
                          </div>
                        </div>
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                          <span className="block text-[9px] text-slate-500">Pausa</span>
                          <span className="block text-[10px] font-bold text-[#070235]">
                            Inicio Comida
                          </span>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                          <span className="block text-[9px] text-slate-500">Reanudación</span>
                          <span className="block text-[10px] font-bold text-[#070235]">
                            Fin Comida
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-emerald-900">
                      <div className="flex items-start gap-1.5">
                        <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#059669] mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold leading-tight">
                            Entrada registrada — Carlos Mendoza
                          </p>
                          <p className="text-[10px] text-emerald-800">
                            Asistencia guardada correctamente.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visor óptico con foto de empleado industrial */}
                  <div className="sm:col-span-6">
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 border-[#1e1b4b]/20 bg-[#070235] shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/images/checador/empleado-fabrica.png"
                        alt="Colaborador industrial frente a la cámara de Checador Facial"
                        width={800}
                        height={597}
                        fetchPriority="high"
                        className="h-full w-full object-cover object-top"
                      />
                      <div className="pointer-events-none absolute inset-3 rounded-lg border border-white/25">
                        <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-[#85f8c4]" />
                        <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-[#85f8c4]" />
                        <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-[#85f8c4]" />
                        <div className="absolute right-0 bottom-0 h-4 w-4 border-r-2 border-b-2 border-[#85f8c4]" />
                      </div>
                      <span className="absolute top-2 right-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
                        Prueba de vida activa
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="rounded-xl bg-indigo-950/70 border border-white/10 p-3.5">
                  <p className="text-[11px] text-indigo-200">Colaboradores</p>
                  <p className="text-xl font-bold text-white mt-0.5">Hasta {heroEmployees}</p>
                  <p className="text-[11px] text-emerald-300 mt-0.5">Plan inicial PyME</p>
                </div>
                <div className="rounded-xl bg-indigo-950/70 border border-white/10 p-3.5">
                  <p className="text-[11px] text-indigo-200">Tiempo de registro</p>
                  <p className="text-xl font-bold text-white mt-0.5">&lt; 1 seg</p>
                  <p className="text-[11px] text-emerald-300 mt-0.5">Sin contacto físico</p>
                </div>
              </div>

              <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 flex items-center justify-between">
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

      {/* CÓMO FUNCIONA EN TU OPERACIÓN DIARIA */}
      <section id="como-funciona" className="py-16 lg:py-24 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
              Vistas reales de la aplicación
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-gray-900">
              Así funciona Checador Facial en tu operación diaria
            </h2>
            <p className="mt-3 text-base text-gray-600">
              Desde el registro frente a la tablet en planta hasta los reportes semanales de jornada y la vinculación de tus terminales.
            </p>
          </div>

          {/* BLOQUE 1: TERMINAL QUIOSCO EN SUCURSAL (/kiosk) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  1 · Terminal Quiosco en Sucursal
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-1">
                  Registro facial en segundos, con o sin internet
                </h3>
              </div>
              <p className="text-xs text-gray-500 max-w-md">
                El colaborador selecciona Entrada, Salida o Comida frente a la cámara; la terminal valida prueba de vida y sincroniza automáticamente.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#f8f9ff] text-[#0b1c30] shadow-xl">
              {/* Barra superior dinámica del quiosco */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e1b4b] text-xs font-bold text-white shadow-xs">
                    MN
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-bold text-[#070235]">
                      Manufacturas del Norte
                    </p>
                    <p className="text-xs font-medium text-slate-500">
                      Planta Monterrey · Acceso Principal
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex items-baseline justify-end gap-1 font-mono text-xl sm:text-2xl font-bold text-[#070235] tabular-nums">
                      <span>07:58:14</span>
                      <span className="text-xs font-bold text-[#4f46e5]">AM</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5 text-[11px]">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#059669]">
                        <WifiIcon className="h-3.5 w-3.5" />
                        En línea
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-600 tabular-nums">0 por enviar</span>
                      <span className="hidden sm:inline text-slate-300">·</span>
                      <span className="hidden sm:inline text-slate-500">
                        Sinc.: 18-nov, 07:55 a.m.
                      </span>
                    </div>
                  </div>
                  <div
                    aria-label="Auditoría Local"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
                  >
                    <LockClosedIcon className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* Contenido principal del quiosco */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6">
                {/* Columna izquierda: 4 botones */}
                <div className="lg:col-span-6 flex flex-col justify-between space-y-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#4f46e5]">
                      BIENVENIDO, REGISTRA TU ASISTENCIA
                    </p>
                    <h4 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-[#070235]">
                      Selecciona tu movimiento frente a la cámara
                    </h4>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl bg-[#059669] px-5 py-4 text-white shadow-md">
                      <div className="flex items-center gap-3.5">
                        <ArrowRightEndOnRectangleIcon className="h-7 w-7 shrink-0" />
                        <div>
                          <span className="block text-[11px] font-semibold uppercase tracking-widest text-emerald-100">
                            Entrada
                          </span>
                          <span className="block text-lg sm:text-xl font-extrabold tracking-tight">
                            REGISTRAR ENTRADA
                          </span>
                        </div>
                      </div>
                      <ArrowRightIcon className="h-5 w-5 shrink-0" />
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-[#1e1b4b] px-5 py-4 text-white shadow-md">
                      <div className="flex items-center gap-3.5">
                        <ArrowLeftStartOnRectangleIcon className="h-7 w-7 shrink-0" />
                        <div>
                          <span className="block text-[11px] font-semibold uppercase tracking-widest text-indigo-200">
                            Salida
                          </span>
                          <span className="block text-lg sm:text-xl font-extrabold tracking-tight">
                            REGISTRAR SALIDA
                          </span>
                        </div>
                      </div>
                      <ArrowRightIcon className="h-5 w-5 shrink-0" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                          <ClockIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-500">Pausa</span>
                          <span className="block text-xs sm:text-sm font-bold text-[#070235]">
                            Inicio Comida
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#4f46e5]">
                          <ClockIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-500">Reanudación</span>
                          <span className="block text-xs sm:text-sm font-bold text-[#070235]">
                            Fin Comida
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Estado limpio sin advertencias de desarrollo */}
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheckIcon className="h-4 w-4 text-[#059669]" />
                      <span>Colaboradores activos: 24</span>
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-[#059669]">
                      Listo
                    </span>
                  </div>
                </div>

                {/* Columna derecha: visor óptico y resultado */}
                <div className="lg:col-span-6 flex flex-col space-y-3">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border-2 border-[#1e1b4b]/20 bg-[#070235] shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/checador/empleado-fabrica.png"
                      alt="Registro de entrada de colaborador en planta industrial"
                      width={800}
                      height={597}
                      loading="lazy"
                      className="h-full w-full object-cover object-top"
                    />
                    <div className="pointer-events-none absolute inset-5 rounded-xl border border-white/25">
                      <div className="absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2 border-[#85f8c4]" />
                      <div className="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-[#85f8c4]" />
                      <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-[#85f8c4]" />
                      <div className="absolute right-0 bottom-0 h-6 w-6 border-r-2 border-b-2 border-[#85f8c4]" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-emerald-900 shadow-xs">
                    <div className="flex items-start gap-3">
                      <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#059669]" />
                      <div>
                        <p className="text-sm font-bold">
                          Entrada registrada — Carlos Mendoza
                        </p>
                        <p className="mt-0.5 text-xs text-emerald-800">
                          Asistencia guardada correctamente.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BLOQUE 2: PANEL DE CONTROL Y REPORTES DE JORNADA (/dashboard) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  2 · Panel de Control y Reportes de Jornada
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-1">
                  Supervisión en tiempo real y cumplimiento semanal
                </h3>
              </div>
              <p className="text-xs text-gray-500 max-w-md">
                Consulta asistencias, retardos, turnos en curso, intentos rechazados por prueba de vida y exporta tus reportes semanales en CSV.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafc] shadow-xl lg:flex">
              {/* Sidebar AdminShell */}
              <aside className="bg-[#1e1b4b] text-white lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:justify-between">
                <div>
                  <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-indigo-100">
                      MN
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-indigo-200">
                        Checador Facial
                      </p>
                      <p className="truncate text-sm font-bold text-white">
                        Manufacturas del Norte
                      </p>
                    </div>
                  </div>

                  <nav className="flex gap-1.5 overflow-x-auto px-3 py-2.5 lg:flex-col lg:space-y-1 lg:p-3">
                    {ADMIN_NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium ${
                            item.active
                              ? 'bg-[#4f46e5] text-white shadow-xs'
                              : 'text-indigo-100/90'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                      );
                    })}
                  </nav>
                </div>

                <div className="hidden border-t border-white/10 p-4 lg:block">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">Laura Gómez</p>
                      <p className="truncate text-[11px] text-indigo-200">
                        Administradora
                      </p>
                    </div>
                    <ArrowLeftStartOnRectangleIcon className="h-4 w-4 shrink-0 text-indigo-200" />
                  </div>
                </div>
              </aside>

              {/* Área principal del Dashboard */}
              <div className="flex-1 p-4 sm:p-6 space-y-5 min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-lg sm:text-xl font-bold text-slate-900">
                      Panel de Control — Manufacturas del Norte
                    </h4>
                    <p className="text-xs text-slate-500">
                      Estado: <strong className="text-slate-700">Activa</strong> · Zona horaria: America/Mexico_City
                    </p>
                  </div>
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white">
                    <UsersIcon className="h-4 w-4" />
                    Enrolar Empleado
                  </span>
                </div>

                {/* 4 Tarjetas superiores */}
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500">
                        Empleados Activos
                      </span>
                      <span className="rounded-lg bg-indigo-50 p-1.5 text-[#4f46e5]">
                        <UsersIcon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">24</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500">
                        Dispositivos Quiosco
                      </span>
                      <span className="rounded-lg bg-emerald-50 p-1.5 text-[#059669]">
                        <DeviceTabletIcon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">3</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500">
                        Sucursales
                      </span>
                      <span className="rounded-lg bg-slate-100 p-1.5 text-[#1e1b4b]">
                        <BuildingOffice2Icon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">2</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500">
                        Jornada Máx. Semanal
                      </span>
                      <span className="rounded-lg bg-amber-50 p-1.5 text-amber-700">
                        <ClockIcon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">48.0 h</p>
                  </div>
                </div>

                {/* Barra de actualización */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <ClockIcon className="h-4 w-4 text-slate-400" />
                    <span>
                      Última actualización:{' '}
                      <strong className="text-slate-900 tabular-nums">
                        18-nov, 08:15:20 a.m.
                      </strong>
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                    <ArrowPathIcon className="h-3.5 w-3.5" />
                    Actualizar datos
                  </span>
                </div>

                {/* 4 KPIs del día */}
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Asistencias Hoy</span>
                      <CheckCircleIcon className="h-4 w-4 text-[#059669]" />
                    </div>
                    <p className="mt-1.5 text-xl font-bold text-slate-900 tabular-nums">22</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Retardos Hoy</span>
                      <ClockIcon className="h-4 w-4 text-amber-600" />
                    </div>
                    <p className="mt-1.5 text-xl font-bold text-slate-900 tabular-nums">1</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Turnos en Curso Hoy</span>
                      <ClockIcon className="h-4 w-4 text-[#4f46e5]" />
                    </div>
                    <p className="mt-1.5 text-xl font-bold text-slate-900 tabular-nums">18</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Intentos Rechazados Hoy</span>
                      <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
                    </div>
                    <p className="mt-1.5 text-xl font-bold text-slate-900 tabular-nums">1</p>
                  </div>
                </div>

                {/* Tabla 1: Cumplimiento Semanal de Jornada */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h5 className="text-sm font-bold text-slate-900">
                        Cumplimiento Semanal de Jornada
                      </h5>
                      <p className="text-[11px] text-slate-500">
                        Límite configurado: 48 horas semanales · Turnos sin salida se marcan como requiere corrección
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] text-slate-700">
                        <span className="text-slate-500">Semana del:</span>
                        <span className="font-semibold text-slate-900 tabular-nums">16/11/2026</span>
                        <CalendarIcon className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#4f46e5] px-3 py-1.5 text-[11px] font-semibold text-white">
                        <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                        Exportar CSV
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-3 font-semibold">Colaborador</th>
                          <th className="px-3 py-2 font-semibold">Puesto</th>
                          <th className="px-3 py-2 font-semibold">Horas Trabajadas</th>
                          <th className="px-3 py-2 font-semibold">Días Completos</th>
                          <th className="px-3 py-2 font-semibold">Retardos</th>
                          <th className="py-2 pl-3 font-semibold">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {WEEKLY_COMPLIANCE_ROWS.map((row) => (
                          <tr key={row.codigo}>
                            <td className="py-2.5 pr-3">
                              <p className="font-semibold text-slate-900">{row.nombre}</p>
                              <p className="text-[11px] text-slate-500">Código: {row.codigo}</p>
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">{row.puesto}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-900 tabular-nums">
                              {row.horas}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 tabular-nums">
                              <span>{row.dias}</span>
                              {row.inProgress && (
                                <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-[#4f46e5]">
                                  En curso hoy
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 tabular-nums">
                              {row.retardos}
                            </td>
                            <td className="py-2.5 pl-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${row.estadoClass}`}
                              >
                                {row.estado}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabla 2: Registros Recientes de Asistencia */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h5 className="text-sm font-bold text-slate-900">
                        Registros Recientes de Asistencia
                      </h5>
                      <p className="text-[11px] text-slate-500">
                        Movimientos sincronizados desde terminales (America/Mexico_City)
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-medium">
                        <span className="rounded-md bg-white px-2 py-0.5 text-slate-900 shadow-2xs">
                          Todos
                        </span>
                        <span className="px-2 py-0.5 text-slate-600">Válidos</span>
                        <span className="px-2 py-0.5 text-slate-600">Rechazados</span>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                        Evidencia Local 15 días
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-3 font-semibold">Fecha y Hora</th>
                          <th className="px-3 py-2 font-semibold">Colaborador</th>
                          <th className="px-3 py-2 font-semibold">Movimiento</th>
                          <th className="px-3 py-2 font-semibold">Terminal</th>
                          <th className="px-3 py-2 font-semibold">Estado</th>
                          <th className="py-2 pl-3 font-semibold">Evidencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {RECENT_CHECKINS_ROWS.map((rec, idx) => (
                          <tr key={`${rec.fecha}-${idx}`}>
                            <td className="py-2.5 pr-3 text-slate-700 tabular-nums">
                              {rec.fecha}
                            </td>
                            <td className="px-3 py-2.5">
                              <p className="font-semibold text-slate-900">{rec.colaborador}</p>
                              {rec.codigo && (
                                <p className="text-[11px] text-slate-500">{rec.codigo}</p>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700">{rec.movimiento}</td>
                            <td className="px-3 py-2.5 text-slate-600">{rec.terminal}</td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${rec.estadoClass}`}
                              >
                                {rec.estado}
                              </span>
                            </td>
                            <td className="py-2.5 pl-3 text-[11px] text-slate-400">
                              {rec.evidencia}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BLOQUE 3: CONFIGURACIÓN REAL (/empleados y /dispositivos) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  3 · Enrolamiento Biométrico y Vinculación de Terminales
                </span>
                <h3 className="text-xl font-bold text-gray-900 mt-1">
                  Alta de colaboradores sin guardar fotos crudas y vinculación por QR
                </h3>
              </div>
              <p className="text-xs text-gray-500 max-w-md">
                Módulos reales de Colaboradores y Dispositivos para registrar rostros en segundos y enlazar tablets con código QR o PIN de 6 dígitos.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Módulo Colaboradores (/empleados) */}
              <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-indigo-50 p-1.5 text-[#4f46e5]">
                      <UserPlusIcon className="h-4 w-4" />
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">
                      Alta y Enrolamiento Biométrico
                    </h4>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#4f46e5]">
                    3 de 3 capturas
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-xs">
                  <div className="rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-900">
                    Carlos Mendoza
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800">
                      EMP-014
                    </div>
                    <div className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800">
                      Operador CNC
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700">
                      Planta Monterrey
                    </div>
                    <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700">
                      Turno Matutino 08:00 - 17:00
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">Capturas de Rostro</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-[#4f46e5]">
                        3 de 3
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700">
                        <CameraIcon className="h-3.5 w-3.5" />
                        Usar Cámara
                      </span>
                      <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700">
                        Subir Foto
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                    Rostro #3 capturado correctamente. La fotografía no se guarda por privacidad.
                  </div>

                  <div className="flex items-start gap-2 text-[11px] text-slate-600">
                    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#4f46e5] text-white">
                      <CheckIcon className="h-3 w-3" />
                    </span>
                    <span>
                      Confirmo que el colaborador otorgó su{' '}
                      <strong className="text-slate-800">autorización para registro facial</strong>. Solo se guarda una firma matemática segura del rostro, nunca la fotografía original.
                    </span>
                  </div>
                </div>

                {/* Resumen del directorio */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold text-slate-900">
                      Directorio de Empleados
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      24 registrados
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs">
                    {DIRECTORY_EMPLOYEES.map((emp) => (
                      <div key={emp.nombre} className="flex items-center justify-between py-2">
                        <div>
                          <p className="font-semibold text-slate-900">{emp.nombre}</p>
                          <p className="text-[11px] text-slate-500">{emp.meta}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-[#4f46e5]">
                            <CheckCircleIcon className="h-3 w-3" />
                            {emp.rostros}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-[#059669]">
                            Activo
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Módulo Dispositivos (/dispositivos) */}
              <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-emerald-50 p-1.5 text-[#059669]">
                      <DeviceTabletIcon className="h-4 w-4" />
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">
                      Terminales Registradas
                    </h4>
                  </div>
                  <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                    2 registradas
                  </span>
                </div>

                {/* Terminal vinculada */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <DeviceTabletIcon className="h-4 w-4 text-[#4f46e5]" />
                      <span className="font-bold text-slate-900">Acceso Principal</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-[#059669]">
                        Vinculado
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        android
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1">
                        <PencilIcon className="h-3 w-3" />
                        Editar Nombre
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-red-700">
                        <TrashIcon className="h-3 w-3" />
                        Eliminar
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-500">Sucursal: Planta Monterrey</p>
                </div>

                {/* Terminal pendiente con PIN + QR */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <DeviceTabletIcon className="h-4 w-4 text-[#4f46e5]" />
                      <span className="font-bold text-slate-900">Nave Industrial 2</span>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        Pendiente de PIN
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                      <KeyIcon className="h-3 w-3" />
                      Nuevo PIN
                    </span>
                  </div>
                  <p className="text-slate-500">Sucursal: Planta Monterrey</p>
                  <p className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-2.5 py-1 font-mono text-sm font-bold tracking-widest text-[#1e1b4b] tabular-nums">
                    PIN: 482910
                  </p>

                  {/* Bloque DevicePairingQr */}
                  <div className="flex flex-wrap items-center gap-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                    <div
                      aria-label="Código QR de vinculación de quiosco"
                      className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 shadow-2xs"
                    >
                      <div className="grid grid-cols-13 gap-[1.5px] bg-white">
                        {QR_MATRIX_PATTERN.flatMap((row, rIdx) =>
                          row.split('').map((cell, cIdx) => (
                            <span
                              key={`${rIdx}-${cIdx}`}
                              className={`block h-1.5 w-1.5 ${
                                cell === '1' ? 'bg-[#1e1b4b]' : 'bg-white'
                              }`}
                            />
                          ))
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1e1b4b]">
                        <QrCodeIcon className="h-3.5 w-3.5 text-[#4f46e5]" />
                        <span>Escanea para configurar el quiosco</span>
                      </p>
                      <p className="text-[11px] leading-snug text-slate-600">
                        Abre la cámara de la tableta para ir directo a{' '}
                        <span className="font-mono font-medium text-slate-800">/kiosk</span> con el PIN precargado.
                      </p>
                    </div>
                  </div>
                </div>
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

          {loadingPlans ? (
            <div className="p-12 text-center text-gray-400">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <p className="mt-3 text-xs">Cargando membresías disponibles…</p>
            </div>
          ) : plans.length > 0 ? (
            <div
              className={`grid grid-cols-1 gap-8 items-stretch mx-auto ${
                plans.length === 1
                  ? 'max-w-md'
                  : plans.length === 2
                    ? 'md:grid-cols-2'
                    : 'md:grid-cols-3'
              }`}
            >
              {plans.map((plan, idx) => {
                const isFree = plan.price_mxn <= 0;
                const isPaidFeatured = !isFree && (plans.length === 1 || idx === 1 || plan.slug.includes('basic'));
                const f = plan.features_payload || {};
                const maxEmpleados = f.max_empleados ?? 15;
                const maxDispositivos = f.max_dispositivos ?? 2;
                const maxSucursales = f.max_sucursales ?? 1;
                const horasMax = f.horas_semanales_max ?? 48;

                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl p-8 flex flex-col justify-between ${
                      isPaidFeatured
                        ? 'border-2 border-indigo-600 bg-white shadow-lg'
                        : 'border border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div>
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                          isFree
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {isFree ? 'Prueba Gratuita' : 'Plan Disponible'}
                      </span>
                      <h3 className="text-2xl font-extrabold text-gray-900 mt-4">
                        {plan.name}
                      </h3>
                      <p className="mt-2 text-sm text-gray-600">
                        {plan.description ||
                          'Control de asistencia facial con respaldo y reportes de jornada.'}
                      </p>
                      <p className="mt-6 text-4xl font-extrabold text-gray-900">
                        {isFree
                          ? '$0'
                          : `$${plan.price_mxn.toLocaleString('es-MX', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })}`}{' '}
                        <span className="text-sm font-medium text-gray-500">
                          {isFree
                            ? 'MXN / 30 días'
                            : `MXN / ${plan.billing_interval === 'annual' ? 'año' : 'mes'}`}
                        </span>
                      </p>

                      <ul className="mt-6 space-y-3 text-sm text-gray-700">
                        <li className="flex items-center gap-2">
                          <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Hasta {maxEmpleados} colaboradores activos</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>
                            Hasta {maxDispositivos}{' '}
                            {maxDispositivos === 1 ? 'terminal quiosco' : 'terminales quiosco'}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>
                            {maxSucursales}{' '}
                            {maxSucursales === 1 ? 'sucursal activa' : 'sucursales activas'}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Control de jornada semanal ({horasMax} h) y reportes</span>
                        </li>
                        {f.cloud_evidences_enabled === true && (
                          <li className="flex items-center gap-2">
                            <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span>Respaldo de capturas de rostro en la nube incluido</span>
                          </li>
                        )}
                        {f.extra_roles_enabled === true && (
                          <li className="flex items-center gap-2">
                            <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span>Roles adicionales de supervisión y auditoría incluidos</span>
                          </li>
                        )}
                      </ul>
                    </div>

                    {isFree ? (
                      <Link
                        href="/portal/checador"
                        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-600 bg-white px-5 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50 transition-colors"
                      >
                        <span>Activar Prueba Gratis</span>
                        <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    ) : (
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
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center max-w-lg mx-auto">
              <h3 className="text-base font-bold text-gray-900">
                Membresías en actualización
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Estamos actualizando los paquetes disponibles. Contáctanos por WhatsApp para cotizar tu plan a la medida.
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                <UserGroupIcon className="h-4 w-4" />
                <span>Solicitar información por WhatsApp</span>
              </a>
            </div>
          )}
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
