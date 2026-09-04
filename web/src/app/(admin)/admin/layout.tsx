'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChartBarIcon,
  UsersIcon,
  CubeIcon,
  CreditCardIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import LogoutConfirmationModal from '@/components/LogoutConfirmationModal';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: ChartBarIcon },
  { name: 'Clientes', href: '/admin/customers', icon: UsersIcon },
  { name: 'Productos y Planes', href: '/admin/products', icon: CubeIcon },
  { name: 'Suscripciones', href: '/admin/subscriptions', icon: CreditCardIcon },
  { name: 'Gestión CRM', href: '/admin/crm', icon: CpuChipIcon },
  { name: 'Usuarios Sistema', href: '/admin/users', icon: ShieldCheckIcon },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const isAuthPage = pathname.startsWith('/admin/login') || pathname.startsWith('/admin/setup');

  useEffect(() => {
    if (isAuthPage) {
      setLoading(false);
      return;
    }

    const token = localStorage.getItem('iqmx_admin_token');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${apiUrl}/api/admin/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Sesión no válida');
        return res.json();
      })
      .then((user) => {
        setAdminUser(user);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('iqmx_admin_token');
        router.push('/admin/login');
      });
  }, [pathname, isAuthPage, router]);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('iqmx_admin_token');
    router.push('/admin/login');
  };

  if (isAuthPage) {
    return <div className="min-h-screen bg-gray-50 text-gray-900">{children}</div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-xs font-medium">Verificando sesión administrativa…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col lg:flex-row font-sans">
      {/* Sidebar Lateral Claro */}
      <aside className="w-full lg:w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 shadow-xs">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="IQISSMexico Logo"
              width={120}
              height={36}
              className="h-8 w-auto"
              priority
            />
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
              Admin
            </span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Perfil del Admin & Logout */}
        <div className="p-3 border-t border-gray-200 bg-gray-50/50">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="truncate">
              <p className="text-xs font-semibold text-gray-900 truncate">{adminUser?.name}</p>
              <p className="text-[11px] text-gray-500 truncate">{adminUser?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar Sesión"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-red-600 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido Principal Claro */}
      <main className="flex-1 overflow-y-auto min-w-0 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      {/* Modal de Confirmación de Cierre de Sesión */}
      <LogoutConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
        userName={adminUser?.name || adminUser?.email}
      />
    </div>
  );
}
