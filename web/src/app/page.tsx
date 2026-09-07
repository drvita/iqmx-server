"use client";

import Link from "next/link";
import {
  SparklesIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  UserPlusIcon,
  EnvelopeIcon,
  MapPinIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import { ProductCatalogGrid } from "@/components/landing/ProductCatalogGrid";

export default function Home() {
  const whatsappNumber = "5213141560219";
  const generalContactUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    "Hola IQISSMexico, me gustaría recibir asesoría sobre sus soluciones de software y automatización.",
  )}`;

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900 font-sans">
      {/* ─── 1. HERO INSTITUCIONAL: VALOR EMPRESARIAL Y NEUTRAL ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />

        <div className="relative max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-400/20 px-4 py-1.5 text-xs font-semibold text-blue-300">
            <SparklesIcon className="h-4 w-4" />
            <span>
              IQISSMexico • Ingeniería de Software & Inteligencia Artificial
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] max-w-4xl mx-auto">
            Soluciones de software, automatización e IA a la medida de tu
            empresa
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Impulsamos la productividad y las ventas de negocios en México.
            Diseñamos desde plataformas SaaS listas para operar —como nuestro
            CRM multi-agente en WhatsApp— hasta sistemas a la medida y
            automatización integral de procesos.
          </p>

          {/* Botones Principales de Acción */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <a
              href="#soluciones"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-4 text-sm font-bold text-white shadow-lg shadow-blue-900/30 hover:bg-blue-500 transition-all hover:scale-[1.02]"
            >
              <span>Explorar Soluciones</span>
              <ArrowRightIcon className="h-4 w-4" />
            </a>

            <a
              href={generalContactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 border border-emerald-500/40 px-7 py-4 text-sm font-bold text-white transition-all shadow-md"
            >
              <WhatsAppIcon className="h-4 w-4 fill-white" />
              <span>Contactar Asesor Técnico</span>
              <ArrowTopRightOnSquareIcon className="h-4 w-4 opacity-75" />
            </a>
          </div>

          {/* Indicadores de Confianza */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-xs text-slate-400 border-t border-slate-800/80 max-w-3xl mx-auto">
            <div className="flex items-center gap-1.5">
              <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
              <span>Trayectoria sólida desde 2008</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
              <span>Cobertura en toda la República Mexicana</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
              <span>Portal de autogestión transparente</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. SECCIÓN QUIÉNES SOMOS (ENFOQUE INSTITUCIONAL) ─── */}
      <section
        id="nosotros"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-gray-100"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Sobre IQISSMexico
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
                Innovación pragmática, transparencia y acompañamiento
                tecnológico cercano
              </h2>
              <p className="text-base text-gray-600 leading-relaxed">
                Nacimos en Villa de Álvarez, Colima, con el propósito de acercar
                tecnología de alto nivel a empresas en crecimiento. A lo largo
                de más de 15 años hemos evolucionado desde el desarrollo web y
                software local hasta convertirnos en especialistas en
                automatización de procesos empresariales, microservicios en la
                nube e inteligencia artificial aplicada.
              </p>
              <p className="text-base text-gray-600 leading-relaxed">
                Creemos en un modelo de trabajo claro: sin dependencias forzadas
                ni costos ocultos. Diseñamos soluciones prácticas que generan
                impacto medible en las operaciones diarias de tu equipo.
              </p>

              <div className="pt-2">
                <Link
                  href="/aboutus"
                  className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline group"
                >
                  <span>
                    Conoce más sobre nuestra historia, misión y equipo
                  </span>
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-6 space-y-2">
                <span className="text-2xl font-extrabold text-blue-600">
                  +15 Años
                </span>
                <h4 className="font-bold text-gray-900 text-sm">
                  Experiencia Comprobada
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Resolviendo desafíos tecnológicos para PyMEs y empresas en
                  constante expansión.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-6 space-y-2">
                <span className="text-2xl font-extrabold text-emerald-600">
                  100% Nativo
                </span>
                <h4 className="font-bold text-gray-900 text-sm">
                  Soporte Local en México
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Atención técnica directa, asesoría en tu huso horario y
                  comprensión del mercado nacional.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-6 space-y-2">
                <span className="text-2xl font-extrabold text-purple-600">
                  SaaS & Custom
                </span>
                <h4 className="font-bold text-gray-900 text-sm">
                  Modelos Flexibles
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Elige entre plataformas listas por suscripción o desarrollos a
                  la medida de tu presupuesto.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-6 space-y-2">
                <span className="text-2xl font-extrabold text-amber-600">
                  BYOK & Cloud
                </span>
                <h4 className="font-bold text-gray-900 text-sm">
                  Transparencia en Costos
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Tú eres dueño de tus datos y tus claves de IA, pagando
                  únicamente por lo que utilizas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. CARRUSEL DE PRODUCTOS Y SOLUCIONES DINÁMICO ─── */}
      <section
        id="soluciones"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 border-b border-gray-100"
      >
        <div className="max-w-6xl mx-auto">
          <ProductCatalogGrid
            variant="carousel"
            showFullCatalogLink={true}
            title="Nuestras Soluciones y Productos"
            subtitle="Plataformas SaaS listas para operar y proyectos de software o automatización a la medida de tu empresa."
          />
        </div>
      </section>

      {/* ─── 5. PORTAL DE CLIENTES: AUTOGESTIÓN Y TRANSPARENCIA ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 border-t border-gray-100">
        <div className="max-w-5xl mx-auto rounded-3xl bg-linear-to-br from-slate-900 to-blue-950 p-8 sm:p-12 text-white shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                Portal de Autogestión
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                Gestiona tus membresías, facturación y servicios en un solo
                lugar
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Crea tu cuenta empresarial en el portal de clientes para
                contratar suscripciones, consultar consumos, vincular
                microservicios y dar seguimiento a tus proyectos.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:items-end justify-center">
              <Link
                href="/portal/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-blue-500 shadow-md transition-all hover:scale-[1.02]"
              >
                <UserPlusIcon className="h-4 w-4" />
                <span>Crear Cuenta de Cliente</span>
              </Link>
              <Link
                href="/portal/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors"
              >
                <span>Ya tengo cuenta • Iniciar Sesión</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 6. SECCIÓN DE CONTACTO DIRECTO ─── */}
      <section
        id="contacto"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-100"
      >
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
              Atención Personalizada
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Hablemos de tu próximo proyecto
            </h2>
            <p className="text-base text-gray-600">
              ¿Tienes dudas técnicas o necesitas una cotización específica?
              Nuestro equipo de ingenieros te asesora de inmediato.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-gray-200 p-6 bg-gray-50/50 flex items-start gap-4">
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600 border border-emerald-100 shrink-0">
                <WhatsAppIcon className="h-6 w-6 fill-emerald-600" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-900">
                  WhatsApp Oficial
                </h4>
                <p className="text-xs text-gray-500">+52 314 156 0219</p>
                <a
                  href={generalContactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline pt-1"
                >
                  Chatear ahora →
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-6 bg-gray-50/50 flex items-start gap-4">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-600 border border-blue-100 shrink-0">
                <EnvelopeIcon className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-900">
                  Correo Electrónico
                </h4>
                <p className="text-xs text-gray-500">info@iqissmexico.com</p>
                <a
                  href="mailto:info@iqissmexico.com"
                  className="inline-block text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline pt-1"
                >
                  Enviar mensaje →
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-6 bg-gray-50/50 flex items-start gap-4">
              <div className="rounded-xl bg-purple-50 p-3 text-purple-600 border border-purple-100 shrink-0">
                <MapPinIcon className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-900">
                  Sede & Cobertura
                </h4>
                <p className="text-xs text-gray-500">
                  Villa de Álvarez, Colima, México
                </p>
                <span className="inline-block text-[11px] text-gray-400 pt-1">
                  Atención remota a toda la república
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
