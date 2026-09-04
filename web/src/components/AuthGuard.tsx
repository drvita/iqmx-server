'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCheckoutIntent } from '@/utils/checkoutIntent';

export interface FullScreenLoaderProps {
  message?: string;
}

/**
 * Componente visual reutilizable para pantallas de carga a pantalla completa.
 */
export function FullScreenLoader({ message = 'Cargando...' }: FullScreenLoaderProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
        <p className="text-xs text-gray-500 font-medium">{message}</p>
      </div>
    </div>
  );
}

export interface GuestGuardProps {
  role: 'admin' | 'customer';
  loadingMessage?: string;
  children: React.ReactNode;
}

/**
 * Guard para páginas que solo deben ser accesibles por usuarios NO autenticados
 * (como Login o Registro). Si el usuario ya tiene sesión activa y válida,
 * lo redirige automáticamente a su dashboard correspondiente evitando doble inicio de sesión.
 */
export function GuestGuard({ role, loadingMessage, children }: GuestGuardProps) {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const isAdmin = role === 'admin';
    const tokenKey = isAdmin ? 'iqmx_admin_token' : 'iqmx_portal_token';
    const verifyEndpoint = isAdmin ? '/api/admin/auth/me' : '/api/portal/auth/me';
    const token = localStorage.getItem(tokenKey);

    if (!token) {
      if (isMounted) setCheckingAuth(false);
      return;
    }

    fetch(`${apiUrl}${verifyEndpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.ok) {
          if (!isAdmin && getCheckoutIntent()) {
            router.replace('/portal/dashboard?pending_checkout=1');
          } else {
            router.replace(isAdmin ? '/admin/dashboard' : '/portal/dashboard');
          }
        } else {
          // Token inválido o expirado: limpiar almacenamiento
          if (isAdmin) {
            localStorage.removeItem('iqmx_admin_token');
          } else {
            localStorage.removeItem('iqmx_portal_token');
            localStorage.removeItem('iqmx_portal_customer');
          }
          setCheckingAuth(false);
        }
      })
      .catch(() => {
        if (isMounted) setCheckingAuth(false);
      });

    return () => {
      isMounted = false;
    };
  }, [role, router]);

  if (checkingAuth) {
    const defaultMsg =
      role === 'admin'
        ? 'Verificando sesión administrativa...'
        : 'Verificando sesión de cliente...';
    return <FullScreenLoader message={loadingMessage || defaultMsg} />;
  }

  return <>{children}</>;
}

export interface AuthRedirectProps {
  role: 'admin' | 'customer';
  loadingMessage?: string;
}

/**
 * Componente despachador para páginas raíz (/admin o /portal).
 * Valida la existencia y vigencia de la sesión:
 * - Si es válida: redirige al dashboard respectivo.
 * - Si no existe o no es válida: redirige al login respectivo.
 */
export function AuthRedirect({ role, loadingMessage }: AuthRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const isAdmin = role === 'admin';
    const tokenKey = isAdmin ? 'iqmx_admin_token' : 'iqmx_portal_token';
    const verifyEndpoint = isAdmin ? '/api/admin/auth/me' : '/api/portal/auth/me';
    const loginPath = isAdmin ? '/admin/login' : '/portal/login';
    const dashboardPath = isAdmin ? '/admin/dashboard' : '/portal/dashboard';
    const token = localStorage.getItem(tokenKey);

    if (!token) {
      router.replace(loginPath);
      return;
    }

    fetch(`${apiUrl}${verifyEndpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.ok) {
          if (!isAdmin && getCheckoutIntent()) {
            router.replace('/portal/dashboard?pending_checkout=1');
          } else {
            router.replace(dashboardPath);
          }
        } else {
          if (isAdmin) {
            localStorage.removeItem('iqmx_admin_token');
          } else {
            localStorage.removeItem('iqmx_portal_token');
            localStorage.removeItem('iqmx_portal_customer');
          }
          router.replace(loginPath);
        }
      })
      .catch(() => {
        if (isMounted) router.replace(loginPath);
      });

    return () => {
      isMounted = false;
    };
  }, [role, router]);

  const defaultMsg =
    role === 'admin' ? 'Cargando administración...' : 'Cargando portal de clientes...';

  return <FullScreenLoader message={loadingMessage || defaultMsg} />;
}
