'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!email.trim() || !password) {
      setErrorMsg('Por favor complete todos los campos.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      console.log('[Portal Login] Enviando credenciales a:', `${apiUrl}/api/portal/auth/login`);

      const res = await fetch(`${apiUrl}/api/portal/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      console.log(`[Portal Login] Código de respuesta: HTTP ${res.status} (${res.statusText})`);

      const contentType = res.headers.get('content-type') || '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = null;

      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const rawText = await res.text();
        console.error('[Portal Login] El servidor no devolvió JSON:', rawText.slice(0, 300));
        throw new Error(
          `El servidor respondió con código HTTP ${res.status}. No se pudo procesar la respuesta JSON.`
        );
      }

      if (!res.ok) {
        console.warn('[Portal Login] Autenticación rechazada por la API:', data);
        const detail =
          data?.detail ||
          'Correo electrónico o contraseña incorrectos. Por favor revise sus credenciales.';
        setErrorMsg(detail);
        return;
      }

      console.log('[Portal Login] ¡Autenticación exitosa! Guardando sesión en localStorage...');
      localStorage.setItem('iqmx_portal_token', data.access_token);
      localStorage.setItem('iqmx_portal_customer', JSON.stringify(data.customer));

      console.log('[Portal Login] Redirigiendo al panel de control (/portal/dashboard)...');
      router.push('/portal/dashboard');
    } catch (err: unknown) {
      console.error('[Portal Login] Excepción atrapada:', err);
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Error de red o conexión al comunicarse con el servidor.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-gray-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block">
          <Image
            src="/logo.png"
            alt="IQISSMexico Logo"
            width={140}
            height={44}
            className="h-10 w-auto mx-auto"
            priority
          />
        </Link>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Portal de Clientes WhatsApp
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Inicia sesión para gestionar tus líneas de WhatsApp Business y Webhooks
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white border border-gray-200 py-8 px-6 shadow-md rounded-2xl sm:px-10">
          {errorMsg && (
            <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800 flex items-start space-x-3 shadow-xs">
              <span className="text-red-500 font-bold text-base leading-none mt-0.5">⚠️</span>
              <div className="flex-1">
                <span className="font-semibold block text-red-900">Error de autenticación</span>
                <span className="text-xs text-red-700 leading-relaxed mt-0.5 block">{errorMsg}</span>
              </div>
            </div>
          )}

          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(e);
            }}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@tuempresa.com"
                className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 text-sm transition-colors disabled:bg-gray-50"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Contraseña
                </label>
              </div>
              <input
                type="password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 text-sm transition-colors disabled:bg-gray-50"
              />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={(e) => void handleSubmit(e)}
              className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center space-x-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent inline-block"></span>
                  <span>Verificando credenciales...</span>
                </span>
              ) : (
                'Ingresar al Portal'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 border-t border-gray-100 pt-5">
            ¿Aún no tienes una cuenta de cliente?{' '}
            <Link
              href="/portal/register"
              className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Regístrate aquí
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
