'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  GlobeAltIcon,
  CommandLineIcon,
  CpuChipIcon,
  ArrowRightIcon,
  UserPlusIcon,
  CheckCircleIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';

type ProductItem = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  landing_path: string | null;
  has_memberships: boolean;
};

// Catálogo base de respaldo
const FALLBACK_PRODUCTS: ProductItem[] = [
  {
    id: 1,
    slug: 'crm',
    name: 'CRM WhatsApp Omnicanal',
    description: 'Plataforma multi-agente con inteligencia artificial para gestionar ventas y atención al cliente desde WhatsApp Business API.',
    landing_path: '/landingpage/crm',
    has_memberships: true,
  },
  {
    id: 2,
    slug: 'automatizacion',
    name: 'Automatización de Procesos',
    description: 'Diseño e implementación de flujos automatizados con n8n y Airflow para eliminar tareas manuales y conectar tus sistemas.',
    landing_path: null,
    has_memberships: false,
  },
  {
    id: 3,
    slug: 'diseno-web',
    name: 'Diseño y Desarrollo Web',
    description: 'Sitios web profesionales, landing pages y portales corporativos. Incluye hosting administrado y dominio personalizado.',
    landing_path: null,
    has_memberships: false,
  },
  {
    id: 4,
    slug: 'modelos-ia',
    name: 'Desarrollo de Modelos IA',
    description: 'Entrenamiento, evaluación y despliegue de modelos de inteligencia artificial adaptados a tus datos y procesos de negocio.',
    landing_path: null,
    has_memberships: false,
  },
];

export default function Home() {
  const [products, setProducts] = useState<ProductItem[]>(FALLBACK_PRODUCTS);
  const whatsappNumber = '5213141560219';

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${apiUrl}/api/public/products`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setProducts(data);
        }
      })
      .catch(() => {
        // Mantener fallback
      });
  }, []);

  const getProductIcon = (slug: string) => {
    switch (slug) {
      case 'crm':
        return <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600" />;
      case 'automatizacion':
        return <CommandLineIcon className="h-6 w-6 text-purple-600" />;
      case 'diseno-web':
        return <GlobeAltIcon className="h-6 w-6 text-emerald-600" />;
      case 'modelos-ia':
        return <CpuChipIcon className="h-6 w-6 text-indigo-600" />;
      default:
        return <SparklesIcon className="h-6 w-6 text-blue-600" />;
    }
  };

  const getQuoteUrl = (productName: string) => {
    const text = encodeURIComponent(`Hola, me interesa solicitar una cotización personalizada para el servicio de: ${productName}.`);
    return `https://wa.me/${whatsappNumber}?text=${text}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900 font-sans">
      {/* ─── HERO: 2 OBJETIVOS CLAROS (REGISTRO O EXPLORAR SOLUCIONES) ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />

        <div className="relative max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-400/20 px-4 py-1.5 text-xs font-semibold text-blue-300">
            <SparklesIcon className="h-4 w-4" />
            <span>Tecnología e Inteligencia Artificial para Empresas</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] max-w-4xl mx-auto">
            Soluciones de software, SaaS y automatización a la medida
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Impulsa las ventas y operaciones de tu negocio. Conecta tu equipo en WhatsApp con IA o crea soluciones tecnológicas personalizadas bajo demanda.
          </p>

          {/* 2 Acciones Principales */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/portal/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-4 text-sm font-bold text-white shadow-lg shadow-blue-900/30 hover:bg-blue-500 transition-all hover:scale-[1.02]"
            >
              <UserPlusIcon className="h-4 w-4" />
              <span>Crear Cuenta en el Portal</span>
            </Link>

            <a
              href="#catalogo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 px-7 py-4 text-sm font-bold text-white hover:bg-white/20 transition-all"
            >
              <span>Explorar Soluciones</span>
              <ArrowRightIcon className="h-4 w-4" />
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
              <span>Portal de autogestión de clientes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
              <span>Conexión oficial de WhatsApp Business</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
              <span>Proyectos personalizados bajo demanda</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CATÁLOGO DE PRODUCTOS: SAAS Y PROYECTOS A MEDIDA ─── */}
      <section id="catalogo" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Nuestro Catálogo</span>
            <h2 className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Nuestros Productos y Soluciones
            </h2>
            <p className="mt-3 text-base text-gray-600">
              Membresías SaaS listas para usar y proyectos personalizados bajo demanda para acelerar tu operación.
            </p>
          </div>

          {/* Grilla de productos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {products.map((product) => {
              const isSaaS = product.has_memberships || !!product.landing_path;

              return (
                <div
                  key={product.id}
                  className="rounded-3xl bg-white border border-gray-200 p-8 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                        {getProductIcon(product.slug)}
                      </div>
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                          isSaaS
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isSaaS ? 'SaaS • Membresía' : 'Bajo Demanda • A la Medida'}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-gray-900">{product.name}</h3>
                    <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                      {product.description}
                    </p>

                    {/* Caso especial CRM: Muestra acceso a las 2 landing pages oficiales */}
                    {product.slug === 'crm' && (
                      <div className="mt-6 p-4 rounded-2xl bg-blue-50/70 border border-blue-100/80 space-y-2">
                        <p className="text-xs font-bold text-blue-900 uppercase">
                          Especializado para tu giro:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <Link
                            href="/landingpage/crm"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900"
                          >
                            <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                            <span>CRM General (Ventas e IA) →</span>
                          </Link>
                          <Link
                            href="/landingpage/crm/consultorio"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900"
                          >
                            <CalendarDaysIcon className="h-3.5 w-3.5" />
                            <span>Consultorios y Salud →</span>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-100">
                    {product.landing_path ? (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Link
                          href={product.landing_path}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
                        >
                          <span>Ver Solución y Planes</span>
                          <ArrowRightIcon className="h-4 w-4" />
                        </Link>
                      </div>
                    ) : (
                      <a
                        href={getQuoteUrl(product.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                      >
                        <WhatsAppIcon className="h-4 w-4 fill-white" />
                        <span>Cotizar por WhatsApp</span>
                        <ArrowTopRightOnSquareIcon className="h-4 w-4 opacity-70" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── PORTAL DE CLIENTES: LLAMADO A REGISTRARSE O INGRESAR ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto rounded-3xl bg-linear-to-br from-slate-900 to-blue-950 p-8 sm:p-12 text-white shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                Portal de Clientes
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold leading-tight">
                Gestiona tus suscripciones y servicios en un solo lugar
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Crea tu cuenta de cliente para contratar membresías, gestionar comprobantes y dar seguimiento a tus servicios con IQISSMexico.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:items-end justify-center">
              <Link
                href="/portal/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-blue-500 shadow-md transition-colors"
              >
                <UserPlusIcon className="h-4 w-4" />
                <span>Crear Cuenta Nueva</span>
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
    </div>
  );
}
