'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import PortalLoader from '@/components/PortalLoader';
import {
  HomeIcon,
  ChatBubbleLeftRightIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  XMarkIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import LogoutConfirmationModal from '@/components/LogoutConfirmationModal';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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
        setCompanyName(parsed.company_name || 'Mi Empresa');
        setCustomerName(parsed.contact_name || parsed.company_name);
      } catch {
        // Ignorar error de parsing
      }
    }
    setLoading(false);
    return () => {
      active = false;
    };
  }, [pathname, isAuthPage, router]);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
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

  const navItems = [
    {
      name: 'Resumen General',
      href: '/portal/dashboard',
      icon: HomeIcon,
      active: pathname === '/portal/dashboard',
    },
    {
      name: 'CRM WhatsApp',
      href: '/portal/crm',
      icon: ChatBubbleLeftRightIcon,
      active: pathname.startsWith('/portal/crm'),
      badge: 'Producto',
    },
    {
      name: 'Membresías y Facturación',
      href: '/portal/billing',
      icon: CreditCardIcon,
      active: pathname.startsWith('/portal/billing'),
    },
    {
      name: 'Configuración',
      href: '/portal/settings',
      icon: Cog6ToothIcon,
      active: pathname.startsWith('/portal/settings'),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex font-sans">
      {/* ─── BARRA LATERAL (SIDEBAR ESCRITORIO) ─── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 bg-white border-r border-gray-200 shrink-0 sticky top-0 h-screen justify-between z-30">
        <div>
          {/* Logo & Marca */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <Link href="/portal/dashboard" className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="IQISSMexico Logo"
                width={130}
                height={40}
                className="h-8 w-auto"
                priority
              />
            </Link>
          </div>

          {/* Tarjeta de Cuenta */}
          <div className="px-5 py-4 m-3 rounded-2xl bg-gray-50/80 border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Empresa
            </p>
            <p className="text-sm font-bold text-gray-900 truncate">
              {companyName}
            </p>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {customerName}
            </p>
          </div>

          {/* Menú de Navegación */}
          <nav className="px-3 mt-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                    item.active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        item.active
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Pie de la barra lateral */}
        <div className="p-4 border-t border-gray-100 space-y-2">
          <Link
            href="/"
            target="_blank"
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ShieldCheckIcon className="h-4 w-4 text-blue-600" />
              <span>Sitio IQISSMexico</span>
            </span>
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 opacity-60" />
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <ArrowLeftOnRectangleIcon className="h-4 w-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* ─── CONTENIDO PRINCIPAL + NAVBAR MÓVIL ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Navbar Superior */}
        <header className="bg-white border-b border-gray-200 h-16 sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {/* Botón menú móvil */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>

            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Portal de Clientes
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-gray-900">{companyName}</p>
              <p className="text-[11px] text-emerald-600 font-medium flex items-center justify-end gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Sesión activa</span>
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="hidden sm:inline-flex text-xs font-semibold text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Menú desplegable Móvil */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 pt-2 pb-4 space-y-1 shadow-md">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                    item.active
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50"
            >
              <ArrowLeftOnRectangleIcon className="h-5 w-5" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        )}

        {/* Contenido de la Página */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-white py-4 px-6 text-center text-xs text-gray-400">
          IQISSMexico · Portal de Servicios Empresariales © {new Date().getFullYear()}
        </footer>
      </div>

      {/* Modal de Confirmación de Cierre de Sesión */}
      <LogoutConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        userName={companyName || customerName || undefined}
      />
    </div>
  );
}
