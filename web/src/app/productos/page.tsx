import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { ProductCatalogGrid } from "@/components/landing/ProductCatalogGrid";
import { SparklesIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";

export const metadata: Metadata = {
  title: "Catálogo de Soluciones y Productos - IQISSMexico",
  description:
    "Explora todas las plataformas SaaS, membresías, desarrollos a la medida y servicios de automatización con IA que ofrecemos en IQISSMexico.",
};

export default function ProductosPage() {
  const whatsappNumber = "5213141560219";
  const customQuoteUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    "Hola IQISSMexico, requiero asesoría para un proyecto personalizado de desarrollo de software o automatización.",
  )}`;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* ─── HEADER DE CATÁLOGO ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />

        <div className="relative max-w-4xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-400/20 px-4 py-1.5 text-xs font-semibold text-blue-300">
            <SparklesIcon className="h-4 w-4" />
            <span>Portafolio Tecnológico IQISSMexico</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Catálogo Completo de Soluciones y Productos
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Desde plataformas SaaS listas para operar como nuestro CRM
            multi-agente en WhatsApp, hasta automatizaciones e ingeniería de
            software a la medida para tu negocio.
          </p>
        </div>
      </section>

      {/* ─── GRID COMPLETO DE PRODUCTOS ─── */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <ProductCatalogGrid
            showFullCatalogLink={false}
            title=""
            subtitle=""
          />
        </div>
      </section>

      {/* ─── BANNER ASESORÍA PERSONALIZADA & PORTAL ─── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto rounded-3xl bg-slate-900 text-white p-8 sm:p-12 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                ¿No encuentras lo que buscas?
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                Diseñamos software y automatizaciones a la medida exacta de tu
                operación
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Cuéntanos tu requerimiento o proceso manual. Analizamos tu flujo
                y te proponemos una arquitectura viable, escalable y con
                presupuesto transparente.
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-3 justify-center">
              <a
                href={customQuoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-emerald-500 shadow-md transition-all hover:scale-[1.02]"
              >
                <WhatsAppIcon className="h-4 w-4 fill-white" />
                <span>Hablar con un Asesor Técnico</span>
              </a>

              <Link
                href="/portal/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors"
              >
                <UserPlusIcon className="h-4 w-4" />
                <span>Crear Cuenta en el Portal</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
