'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  GlobeAltIcon,
  CommandLineIcon,
  CpuChipIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';

export type ProductItem = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  landing_path: string | null;
  has_memberships: boolean;
};

export const FALLBACK_PRODUCTS: ProductItem[] = [
  {
    id: 1,
    slug: 'crm',
    name: 'CRM WhatsApp Omnicanal',
    description:
      'Plataforma multi-agente con inteligencia artificial para gestionar ventas y atención al cliente desde WhatsApp Business API oficial.',
    landing_path: '/landingpage/crm',
    has_memberships: true,
  },
  {
    id: 2,
    slug: 'automatizacion',
    name: 'Automatización de Procesos (iPaaS)',
    description:
      'Diseño e integración de flujos automáticos con n8n, webhooks y APIs para eliminar tareas manuales y conectar tus sistemas en tiempo real.',
    landing_path: null,
    has_memberships: false,
  },
  {
    id: 3,
    slug: 'diseno-web',
    name: 'Desarrollo de Software y Portales Web',
    description:
      'Aplicaciones web a la medida, plataformas corporativas, SaaS y portales de clientes con arquitectura escalable y diseño responsivo.',
    landing_path: null,
    has_memberships: false,
  },
  {
    id: 4,
    slug: 'modelos-ia',
    name: 'Integración de Modelos e Inteligencia Artificial',
    description:
      'Entrenamiento, evaluación y despliegue de agentes inteligentes (LLMs) adaptados a tus datos y bases de conocimiento operativas.',
    landing_path: null,
    has_memberships: false,
  },
];

interface ProductCatalogGridProps {
  variant?: 'grid' | 'carousel';
  limit?: number;
  showFullCatalogLink?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const ProductCatalogGrid: React.FC<ProductCatalogGridProps> = ({
  variant = 'grid',
  limit,
  showFullCatalogLink = false,
  title = 'Nuestras Soluciones y Productos',
  subtitle = 'Plataformas SaaS listas para usar y proyectos personalizados bajo demanda para acelerar tu operación.',
  className = '',
}) => {
  const [products, setProducts] = useState<ProductItem[]>(FALLBACK_PRODUCTS);
  const carouselRef = useRef<HTMLDivElement>(null);
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
        // Mantener fallback de respaldo
      });
  }, []);

  const displayedProducts = limit ? products.slice(0, limit) : products;

  const scroll = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 340;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

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
    const text = encodeURIComponent(
      `Hola IQISSMexico, me interesa solicitar una cotización y asesoría personalizada para el servicio de: ${productName}.`
    );
    return `https://wa.me/${whatsappNumber}?text=${text}`;
  };

  // ─── VISTA 1: CARRUSEL HORIZONTAL COMPACTO (HOME) ───
  if (variant === 'carousel') {
    return (
      <div className={`space-y-8 ${className}`}>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
              Soluciones & Especialidades
            </span>
            {title && (
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          {/* Flechas de navegación del carrusel */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => scroll('left')}
              className="p-2.5 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-blue-600 shadow-2xs transition-colors cursor-pointer"
              aria-label="Desplazar a la izquierda"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              className="p-2.5 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-blue-600 shadow-2xs transition-colors cursor-pointer"
              aria-label="Desplazar a la derecha"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Contenedor desplazable con tarjetas compactas (sin botones dentro) */}
        <div
          ref={carouselRef}
          className="flex gap-5 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-4 pt-1 px-1 scroll-smooth"
        >
          {displayedProducts.map((product) => {
            const isSaaS = product.has_memberships || !!product.landing_path;

            return (
              <div
                key={product.id}
                className="w-[280px] sm:w-[320px] flex-shrink-0 snap-start rounded-3xl bg-white border border-gray-200 p-6 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-11 w-11 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center shadow-2xs">
                      {getProductIcon(product.slug)}
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        isSaaS
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isSaaS ? 'SaaS' : 'A la Medida'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-gray-900 tracking-tight line-clamp-1">
                    {product.name}
                  </h3>
                  <p className="mt-2 text-xs text-gray-600 leading-relaxed line-clamp-3">
                    {product.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Botón hacia el catálogo completo con texto claro y sin paréntesis */}
        {showFullCatalogLink && (
          <div className="text-center pt-2">
            <Link
              href="/productos"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-md hover:scale-[1.02]"
            >
              <span>Ver todas las soluciones y productos</span>
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    );
  }

  // ─── VISTA 2: CUADRÍCULA COMPLETA CON DETALLE Y ACCIONES (/PRODUCTOS) ───
  return (
    <div className={`space-y-12 ${className}`}>
      {(title || subtitle) && (
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
            Catálogo Oficial de Soluciones
          </span>
          {title && (
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Grilla de Productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {displayedProducts.map((product) => {
          const isSaaS = product.has_memberships || !!product.landing_path;

          return (
            <div
              key={product.id}
              className="rounded-3xl bg-white border border-gray-200 p-8 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="h-12 w-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center shadow-2xs">
                    {getProductIcon(product.slug)}
                  </div>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                      isSaaS
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {isSaaS ? 'SaaS • Membresía' : 'Bajo Demanda • A la Medida'}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                  {product.name}
                </h3>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                  {product.description}
                </p>

                {/* Caso especial CRM: Muestra acceso a las 2 landing pages oficiales */}
                {product.slug === 'crm' && (
                  <div className="mt-6 p-4 rounded-2xl bg-blue-50/60 border border-blue-100/80 space-y-2">
                    <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                      Especializado para tu giro:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <Link
                        href="/landingpage/crm"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors"
                      >
                        <ChatBubbleLeftRightIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>CRM General (Ventas e IA) →</span>
                      </Link>
                      <Link
                        href="/landingpage/crm/consultorio"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900 transition-colors"
                      >
                        <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>Consultorios y Salud →</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100">
                {product.landing_path ? (
                  <Link
                    href={product.landing_path}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
                  >
                    <span>Ver Solución y Planes</span>
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                ) : (
                  <a
                    href={getQuoteUrl(product.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                  >
                    <WhatsAppIcon className="h-4 w-4 fill-white shrink-0" />
                    <span>Cotizar por WhatsApp</span>
                    <ArrowTopRightOnSquareIcon className="h-4 w-4 opacity-75 shrink-0" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showFullCatalogLink && (
        <div className="text-center pt-4">
          <Link
            href="/productos"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-md hover:scale-[1.02]"
          >
            <span>Ver todas las soluciones y productos</span>
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
};
