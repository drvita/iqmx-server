'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeftIcon, EnvelopeIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { GuestGuard } from '@/components/AuthGuard';

export default function PortalForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setErrorMsg('Por favor ingresa tu correo electrónico.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/portal/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || 'No se pudo procesar la solicitud. Intenta nuevamente.');
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error('[ForgotPassword] Error:', err);
      setErrorMsg(err.message || 'Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GuestGuard role="customer">
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <Link href="/" className="inline-block transition-opacity hover:opacity-90">
            <Image
              src="/logo.png"
              alt="IQISSMexico Logo"
              width={150}
              height={48}
              className="h-10 w-auto object-contain mx-auto"
              priority
            />
          </Link>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Recuperar Contraseña
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Ingresa tu correo asociado para recibir un enlace seguro de restablecimiento
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
          <div className="bg-white border border-gray-200 py-8 px-6 shadow-md rounded-2xl sm:px-10">
            {submitted ? (
              <div className="text-center py-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 mb-4">
                  <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  ¡Revisa tu bandeja de entrada!
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-6">
                  Si la dirección <strong className="text-gray-900">{email.trim()}</strong> está registrada, recibirás un correo con un botón para restablecer tu contraseña en unos momentos.
                </p>
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-800 text-left mb-6">
                  <p className="font-semibold mb-1">⏳ ¿No encuentras el correo?</p>
                  <p className="text-blue-700">Revisa tu carpeta de spam o correo no deseado. El enlace es de un solo uso y expirará en 2 horas.</p>
                </div>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setEmail('');
                    }}
                    className="w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Intentar con otro correo
                  </button>
                  <Link
                    href="/portal/login"
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Volver a Iniciar Sesión
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {errorMsg && (
                  <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800 flex items-start space-x-3 shadow-xs">
                    <span className="text-red-500 font-bold text-base leading-none mt-0.5">⚠️</span>
                    <div className="flex-1">
                      <span className="font-semibold block text-red-900">Atención</span>
                      <span className="text-xs text-red-700 leading-relaxed mt-0.5 block">{errorMsg}</span>
                    </div>
                  </div>
                )}

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Correo Electrónico
                    </label>
                    <div className="mt-1.5 relative rounded-lg shadow-xs">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                        <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        required
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contacto@tuempresa.com"
                        className="block w-full rounded-lg bg-white border border-gray-300 pl-10 pr-3.5 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 text-sm transition-colors disabled:bg-gray-50"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        Enviando enlace...
                      </span>
                    ) : (
                      'Enviar enlace de restablecimiento'
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <Link
                      href="/portal/login"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <ArrowLeftIcon className="h-3.5 w-3.5" />
                      Volver a Iniciar Sesión
                    </Link>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </GuestGuard>
  );
}
