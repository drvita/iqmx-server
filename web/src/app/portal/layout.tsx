'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import PortalLoader from '@/components/PortalLoader';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthPage = pathname === '/portal/login' || pathname === '/portal/register';

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('iqmx_portal_token');
    const customer = localStorage.getItem('iqmx_portal_customer');

    if (!token && !isAuthPage) {
      router.push('/portal/login');
      return;
    }

    if (customer && active) {
      try {
        const parsed = JSON.parse(customer);
        const name = parsed.company_name || parsed.contact_name;
        setTimeout(() => {
          if (active) {
            setCustomerName(name);
            setLoading(false);
          }
        }, 0);
        return () => { active = false; };
      } catch {
        // Ignorar error de parsing
      }
    }
    setTimeout(() => {
      if (active) setLoading(false);
    }, 0);
    return () => { active = false; };
  }, [pathname, isAuthPage, router]);

  const handleLogout = () => {
    localStorage.removeItem('iqmx_portal_token');
    localStorage.removeItem('iqmx_portal_customer');
    router.push('/portal/login');
  };

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center font-sans">
        {children}
      </div>
    );
  }

  if (loading) {
    return <PortalLoader fullScreen message="Cargando portal..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      {/* Navbar Superior del Portal - Coherente con Navbar de la página principal */}
      <header className="bg-white border-b border-gray-200 shadow-xs sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/logo.png"
                alt="IQISSMexico Logo"
                width={120}
                height={38}
                className="h-9 w-auto"
                priority
              />
            </Link>
            <span className="hidden sm:inline-flex text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Tech Provider Portal
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {customerName && (
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold text-gray-900">{customerName}</span>
                <span className="text-xs text-green-600 flex items-center justify-end space-x-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block"></span>
                  <span>Cliente Conectado</span>
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 px-3.5 py-2 rounded-lg border border-gray-200 transition-colors cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer Minimalista del Portal */}
      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500">
        Portal Central de Clientes IQISSMexico © {new Date().getFullYear()} · Gateway Despachador de WhatsApp
      </footer>
    </div>
  );
}
