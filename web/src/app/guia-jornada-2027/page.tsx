import React from 'react';
import Link from 'next/link';
import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ScaleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const PDF_DOWNLOAD_PATH = '/downloads/reforma-laboral-2027-checador-facial.pdf';

const NAV_ANCHORS = [
  { href: '#contexto-legal', label: 'Contexto Legal' },
  { href: '#calendario-2027', label: 'Calendario 2027' },
  { href: '#obligacion-registro', label: 'Obligaciones' },
  { href: '#riesgos', label: 'Riesgos UMA' },
  { href: '#autodiagnostico', label: 'Autodiagnóstico' },
  { href: '#solucion', label: 'Checador Facial' },
];

const INCUMPLIMIENTOS = [
  'Seguir llevando listas de asistencia en papel, libretas o formatos firmados a mano.',
  'Registrar entradas o salidas en hojas de Excel llenadas manualmente sin marca real.',
  'Mantener horarios ordinarios superiores a 46 horas semanales a partir del 1° de enero de 2027.',
  'Disminuir salarios o prestaciones para intentar compensar la reducción de horas.',
  'No contar con acuerdo expreso del colaborador sobre el método de registro utilizado.',
  'No poder exportar ni entregar el historial electrónico cuando la autoridad laboral lo requiera.',
  'No conservar los controles de asistencia durante el plazo que marca la ley.',
];

export default function GuiaJornada2027Page() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5213141560219';
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    'Hola, revisé la guía de la reforma laboral 2027 en México y quiero resolver dudas sobre el registro electrónico de asistencia.'
  )}`;
  const whatsappCustomUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    'Hola, me interesa cotizar una solución de control de asistencia a la medida para mi empresa (geolocalización, servidores on-premise o instancia dedicada).'
  )}`;

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-gray-900 font-sans">
      {/* SUBBARRA DE ANCLAS + DESCARGA */}
      <div className="border-b border-slate-200 bg-white/95 backdrop-blur-sm lg:sticky lg:top-16 lg:z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
          <nav
            aria-label="Secciones de la guía 2027"
            className="flex items-center gap-2 overflow-x-auto text-xs font-medium text-slate-600 py-0.5"
          >
            {NAV_ANCHORS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-lg px-2.5 py-1.5 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <a
            href={PDF_DOWNLOAD_PATH}
            download="reforma-laboral-2027-checador-facial.pdf"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#4f46e5] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
          >
            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Descargar PDF</span>
            <span className="sm:hidden">PDF</span>
          </a>
        </div>
      </div>

      {/* PORTADA / HERO EDUCATIVO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#070235] via-[#1e1b4b] to-indigo-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3.5 py-1.5 text-xs font-semibold text-emerald-200">
                <ScaleIcon className="h-4 w-4 text-emerald-300" />
                <span>Aplica exclusivamente en México · Vigencia: 1° de enero de 2027</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                Reforma de Jornada Laboral 2027: qué cambia y cómo preparar a tu empresa
              </h1>

              <p className="text-base sm:text-lg text-indigo-100 leading-relaxed max-w-2xl">
                El <strong>1° de enero de 2027</strong> entra en vigor en México la jornada ordinaria máxima de{' '}
                <strong>46 horas semanales</strong> y la obligación patronal de llevar un{' '}
                <strong>registro electrónico de jornada</strong> (Art. 132, fracc. XXXIV de la LFT).
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href={PDF_DOWNLOAD_PATH}
                  download="reforma-laboral-2027-checador-facial.pdf"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-[#1e1b4b] shadow-lg hover:bg-indigo-50 transition-all"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  <span>Descargar Presentación en PDF</span>
                </a>
                <Link
                  href="/landingpage/checador"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition-all"
                >
                  <span>Ver Checador Facial y Planes</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>

              <p className="text-xs text-indigo-200/90">
                Información vigente con corte al <strong>26 de noviembre de 2026</strong> · Material informativo, no sustituye asesoría legal ni contable.
              </p>
            </div>

            {/* Tarjeta resumen de cifras clave */}
            <div className="lg:col-span-5 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md p-6 shadow-2xl space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Datos clave en México (2026 – 2027)
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-[#070235]/70 p-4">
                  <p className="text-[11px] text-indigo-200">Límite semanal 2027</p>
                  <p className="mt-1 text-2xl font-extrabold text-emerald-300">46 horas</p>
                  <p className="mt-0.5 text-[11px] text-indigo-100/80">Sin reducir salarios</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#070235]/70 p-4">
                  <p className="text-[11px] text-indigo-200">Multa LFT desde</p>
                  <p className="mt-1 text-2xl font-extrabold text-amber-300">$29,327</p>
                  <p className="mt-0.5 text-[11px] text-indigo-100/80">250 a 5,000 UMA 2026</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#070235]/70 p-4 space-y-1.5">
                <p className="text-xs font-bold text-white">
                  99.8 % de los establecimientos son MiPyMEs (INEGI)
                </p>
                <p className="text-xs text-indigo-100/85 leading-relaxed">
                  La gran mayoría de los pequeños negocios todavía controla asistencias en papel o Excel manual, lo que los deja expuestos al entrar en vigor la reforma.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE 1: CONTEXTO LEGAL */}
      <section id="contexto-legal" className="scroll-reveal py-14 lg:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
              1 · Contexto Legal en México
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
              Dos decretos de 2026 que cambian la forma de registrar el tiempo de trabajo
            </h2>
            <p className="mt-2 text-base text-slate-600">
              Aunque la Secretaría del Trabajo y Previsión Social (STPS) aún no emite sus lineamientos técnicos, el marco legal en la Constitución y la Ley Federal del Trabajo ya está publicado en el Diario Oficial de la Federación.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-[#4f46e5]">
                DOF · 3 de marzo de 2026
              </p>
              <h3 className="mt-2 text-lg font-bold text-slate-900">Reforma Constitucional</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Reforma el <strong>Artículo 123, Apartado A</strong> para reducir gradualmente la semana laboral ordinaria de 48 a 40 horas en México, sin disminución salarial.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-[#059669]">
                DOF · 1 de mayo de 2026
              </p>
              <h3 className="mt-2 text-lg font-bold text-slate-900">Armonización de la LFT</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Adiciona el <strong>Artículo 132, Fracción XXXIV</strong>: obligación patronal de llevar un <strong>registro electrónico de la jornada</strong> (hora de inicio y de término).
              </p>
            </div>

            <div className="rounded-2xl bg-[#1e1b4b] p-6 text-white shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Regla clave · STPS pendiente
              </p>
              <h3 className="mt-2 text-lg font-bold">Mismas obligaciones base</h3>
              <p className="mt-2 text-sm text-indigo-100 leading-relaxed">
                A noviembre de 2026, la STPS todavía no publica excepciones ni lineamientos generales; hoy todas las empresas parten de las mismas obligaciones para enero de 2027.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-3 text-sm text-amber-950">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>¿Exige comprar un reloj checador especial?</strong> No. La LFT solicita un{' '}
              <strong>mecanismo electrónico confiable</strong> capaz de registrar la hora de inicio y término de la jornada y entregarse a la autoridad cuando lo requiera.
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE 2: CALENDARIO GRADUAL 2026-2030 */}
      <section id="calendario-2027" className="scroll-reveal py-14 lg:py-20 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800">
              2 · Calendario Oficial en México
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
              Reducción progresiva hasta 2030: el 1° de enero de 2027 baja a 46 horas
            </h2>
            <p className="mt-2 text-base text-slate-600">
              Cada año disminuye 2 horas el tope semanal ordinario. En ningún caso implica reducir sueldos ni prestaciones.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/checador/deck/escalera-40-horas.svg"
              alt="Calendario gradual de reducción de jornada laboral en México de 2026 a 2030"
              width={960}
              height={480}
              loading="lazy"
              className="w-full h-auto rounded-xl"
            />
          </div>
        </div>
      </section>

      {/* BLOQUE 3: PAPEL VS REGISTRO ELECTRÓNICO + INCUMPLIMIENTOS */}
      <section id="obligacion-registro" className="scroll-reveal py-14 lg:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
              3 · Obligación de Registro Electrónico (Art. 132-XXXIV LFT)
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
              ¿En qué incumplen las empresas en 2027 si no se preparan?
            </h2>
            <p className="mt-2 text-base text-slate-600">
              Comparativa entre métodos manuales tradicionales y un registro electrónico listo para entregar información a la autoridad.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/checador/deck/papel-vs-registro-electronico.svg"
              alt="Comparativa entre control en papel y registro electrónico obligatorio en México"
              width={960}
              height={480}
              loading="lazy"
              className="w-full h-auto rounded-xl"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            <h3 className="text-lg font-bold text-slate-900">
              7 puntos de incumplimiento frecuentes a partir del 1° de enero de 2027
            </h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {INCUMPLIMIENTOS.map((punto, idx) => (
                <div
                  key={punto}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-sm text-slate-700"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                    {idx + 1}
                  </span>
                  <span>{punto}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE 4: RIESGOS Y RESGUARDO PROBATORIO */}
      <section id="riesgos" className="scroll-reveal py-14 lg:py-20 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-800">
              4 · Sanciones y Respaldo Probatorio en México
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
              Multas de 250 a 5,000 UMA y por qué estar mejor preparado con evidencia
            </h2>
            <p className="mt-2 text-base text-slate-600">
              Con la UMA 2026 vigente ($117.31 MXN diarios), las sanciones previstas en el Art. 994 Fracc. IV Bis parten de $29,327 MXN. Además, conforme a los Arts. 784 y 804 de la LFT, contar con un registro electrónico confiable brinda mayor evidencia objetiva ante cualquier inspección o aclaración.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/checador/deck/riesgos-sanciones-multas.svg"
              alt="Riesgos financieros, multas en UMA y evidencia probatoria en México"
              width={960}
              height={480}
              loading="lazy"
              className="w-full h-auto rounded-xl"
            />
          </div>
        </div>
      </section>

      {/* BLOQUE 5: AUTODIAGNÓSTICO (5 PREGUNTAS ABIERTAS) */}
      <section id="autodiagnostico" className="scroll-reveal py-14 lg:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-3xl">
            <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
              5 · Autodiagnóstico Rápido
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
              5 preguntas abiertas para evaluar si tu negocio está listo
            </h2>
            <p className="mt-2 text-base text-slate-600">
              Respóndelas con honestidad junto a tu equipo administrativo. Con una sola que no tengas cubierta, conviene resolver ese vacío antes de enero de 2027.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/checador/deck/autodiagnostico-preguntas.svg"
              alt="Autodiagnóstico express de 5 preguntas abiertas para empresas en México"
              width={960}
              height={480}
              loading="lazy"
              className="w-full h-auto rounded-xl"
            />
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#1e1b4b]">
                ¿Te quedó al menos una pregunta sin resolver?
              </h3>
              <p className="mt-1 text-sm text-slate-700">
                Platiquemos sin compromiso para orientarte sobre cómo digitalizar tu registro de asistencia antes de 2027.
              </p>
            </div>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-5 py-3 text-sm font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors"
            >
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              <span>Comunicarme por WhatsApp</span>
            </a>
          </div>
        </div>
      </section>

      {/* BLOQUE 6: LA SOLUCIÓN LISTA HOY (CHECADOR FACIAL GENÉRICO) */}
      <section id="solucion" className="scroll-reveal py-14 lg:py-20 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-5">
              <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800">
                6 · Solución Lista Hoy para PyMEs
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Checador Facial: registro electrónico confiable en cualquier tablet
              </h2>
              <p className="text-base text-slate-600 leading-relaxed">
                Nuestro producto estándar está diseñado para pequeñas y medianas empresas en México que necesitan empezar rápido, sin hardware costoso y con el motor de cumplimiento configurado para jornadas <strong>diurna, mixta y nocturna</strong> (hasta <strong>46 horas semanales</strong> en 2027).
              </p>

              <ul className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <CheckCircleIcon className="h-5 w-5 text-[#059669] shrink-0 mt-0.5" />
                  <span>
                    <strong>PDF Oficial STPS + CSV con sellado SHA-256:</strong> descarga reportes listos para inspección con Razón Social, RFC, Registro Patronal IMSS, desglose de horas ordinarias, extras dobles (200%) y triples (300%) y sello criptográfico inalterable.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircleIcon className="h-5 w-5 text-[#059669] shrink-0 mt-0.5" />
                  <span>
                    <strong>Acuse semanal de conformidad (Arts. 784 y 804 LFT):</strong> confirmación táctil del colaborador en quiosco o móvil personal al cierre de su periodo laboral para respaldar cada jornada.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircleIcon className="h-5 w-5 text-[#059669] shrink-0 mt-0.5" />
                  <span>
                    <strong>Quiosco en sucursal y Dispositivo Personal Móvil 1:1:</strong> opera con prueba de vida facial, registro sin internet en planta y GPS puntual no bloqueante para personal en ruta.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircleIcon className="h-5 w-5 text-[#059669] shrink-0 mt-0.5" />
                  <span>
                    <strong>Cumplimiento LFPDPPP:</strong> consentimiento del colaborador en el alta, minimización biométrica en móviles 1:1 y bitácora inmutable de incidencias.
                  </span>
                </li>
              </ul>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/landingpage/checador"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#4f46e5] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                >
                  <span>Ver Demostración, Planes y Prueba Gratis</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <a
                  href={PDF_DOWNLOAD_PATH}
                  download="reforma-laboral-2027-checador-facial.pdf"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <DocumentTextIcon className="h-4 w-4 text-[#4f46e5]" />
                  <span>Descargar PDF para tu equipo</span>
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafc] p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                  <div>
                    <p className="text-xs font-bold text-[#070235]">Manufacturas del Norte</p>
                    <p className="text-[11px] text-slate-500">Planta Monterrey · Límite 46.0 h activo</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#059669]">
                    En línea · Listo
                  </span>
                </div>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 border-[#1e1b4b]/20 bg-[#070235]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/checador/empleado-fabrica.png"
                    alt="Operador industrial registrando su asistencia en Checador Facial"
                    width={800}
                    height={597}
                    loading="lazy"
                    className="h-full w-full object-cover object-top"
                  />
                  <div className="pointer-events-none absolute inset-4 rounded-lg border border-white/25">
                    <div className="absolute top-0 left-0 h-5 w-5 border-t-2 border-l-2 border-[#85f8c4]" />
                    <div className="absolute top-0 right-0 h-5 w-5 border-t-2 border-r-2 border-[#85f8c4]" />
                    <div className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-[#85f8c4]" />
                    <div className="absolute right-0 bottom-0 h-5 w-5 border-r-2 border-b-2 border-[#85f8c4]" />
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">
                    Entrada registrada — Carlos Mendoza
                  </span>
                  <span className="text-[11px] font-semibold text-[#059669]">PDF STPS + Sello SHA-256</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE 7: SOLUCIONES A LA MEDIDA */}
      <section className="scroll-reveal py-14 lg:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
                7 · Soluciones a la Medida
              </span>
              <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
                ¿Tu operación requiere reglas o infraestructura personalizada?
              </h2>
              <p className="mt-2 text-base text-slate-600">
                IQISSMexico también desarrolla adaptaciones específicas para empresas que necesitan ir más allá de la versión estándar: geocercas estrictas por polígono de ruta, equipos adaptados como checador físico (PC, tableta o móvil), instalación en tus propios servidores o una instancia aparte conectada a tu nómina.
              </p>
            </div>
            <a
              href={whatsappCustomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#1e1b4b] px-5 py-3 text-sm font-bold text-white hover:bg-indigo-900 transition-colors"
            >
              <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
              <span>Solicitar Proyecto a la Medida</span>
            </a>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/checador/deck/soluciones-a-la-medida.svg"
              alt="Soluciones a la medida: geolocalización, PC/tablet/móvil como checador físico, servidores on-premise e instancia aparte"
              width={960}
              height={480}
              loading="lazy"
              className="w-full h-auto rounded-xl"
            />
          </div>
        </div>
      </section>

      {/* BLOQUE 8: FUENTES Y AVISO LEGAL */}
      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-xs text-slate-500 space-y-3 leading-relaxed">
          <p className="font-bold text-slate-700 uppercase tracking-wider">
            Fuentes consultadas y alcance (Exclusivo México · Corte: 26 de noviembre de 2026)
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Diario Oficial de la Federación (03/03/2026): Reforma al Artículo 123, Apartado A constitucional en materia de reducción de la jornada laboral.</li>
            <li>Diario Oficial de la Federación (01/05/2026): Decreto de armonización a la Ley Federal del Trabajo (Arts. 132 fracc. XXXIV, 994 fracc. IV Bis y disposiciones transitorias).</li>
            <li>Ley Federal del Trabajo vigente (Arts. 60, 61, 66–68 sobre tipos de jornada y tiempo extraordinario doble/triple; Arts. 784 y 804 sobre carga probatoria y conservación de controles de asistencia).</li>
            <li>INEGI: Valor oficial de la UMA 2026 ($117.31 MXN diarios) y Censos Económicos (estructura de MiPyMEs en México).</li>
          </ul>
          <p className="pt-2 border-t border-slate-200 text-slate-500">
            <strong>Aviso importante:</strong> Esta guía es de carácter informativo para centros de trabajo en México y se actualizará conforme la STPS publique las disposiciones generales en el DOF. No constituye asesoría jurídica, laboral ni contable.
          </p>
        </div>
      </section>
    </div>
  );
}
