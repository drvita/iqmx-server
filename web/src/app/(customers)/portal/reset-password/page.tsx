'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LockClosedIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { GuestGuard } from '@/components/AuthGuard';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [emailMasked, setEmailMasked] = useState<string | null>(null);
  const [contactName, setContactName] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Inspección pasiva del token al cargar
  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      return;
    }

    const checkToken = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(`${apiUrl}/api/portal/auth/reset-password/preview?token=${encodeURIComponent(token)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            setTokenValid(true);
            setEmailMasked(data.email_masked);
            setContactName(data.contact_name);
          } else {
            setTokenValid(false);
          }
        } else {
          setTokenValid(false);
        }
      } catch (err) {
        console.error('[ResetPassword] Error previewing token:', err);
        setTokenValid(false);
      } finally {
        setVerifying(false);
      }
    };

    checkToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      setErrorMsg('Por favor completa todos los campos.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden. Verifica e intenta nuevamente.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/portal/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          token: token.trim(),
          new_password: newPassword,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || 'No se pudo restablecer la contraseña.');
      }

      setSuccess(true);
      // Redirigir al login tras 2 segundos con parámetro reset=ok
      setTimeout(() => {
        router.push('/portal/login?reset=ok');
      }, 1500);
    } catch (err: any) {
      console.error('[ResetPassword] Submit error:', err);
      setErrorMsg(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
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
          Restablecer Contraseña
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Crea una nueva contraseña para acceder a tu cuenta del portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white border border-gray-200 py-8 px-6 shadow-md rounded-2xl sm:px-10">
          {verifying ? (
            <div className="py-12 text-center">
              <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <p className="text-sm text-gray-600">Validando enlace de recuperación...</p>
            </div>
          ) : !tokenValid ? (
            <div className="text-center py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 mb-4">
                <ExclamationTriangleIcon className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Enlace inválido o expirado
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">
                Este enlace de restablecimiento ya fue utilizado o ha superado el tiempo límite de validez (2 horas).
              </p>
              <div className="space-y-3">
                <Link
                  href="/portal/forgot-password"
                  className="w-full inline-flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Solicitar un nuevo enlace
                </Link>
                <Link
                  href="/portal/login"
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Volver a Iniciar Sesión
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="text-center py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 mb-4">
                <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                ¡Contraseña actualizada!
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">
                Tu contraseña ha sido restablecida exitosamente. Redirigiéndote al inicio de sesión...
              </p>
              <Link
                href="/portal/login?reset=ok"
                className="w-full inline-flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
              >
                Ir a Iniciar Sesión ahora &rarr;
              </Link>
            </div>
          ) : (
            <>
              {emailMasked && (
                <div className="mb-6 rounded-xl bg-blue-50 border border-blue-200 p-3.5 text-xs text-blue-900 flex items-center gap-2.5">
                  <LockClosedIcon className="h-5 w-5 text-blue-600 shrink-0" />
                  <div>
                    {contactName && <span className="font-semibold block">{contactName}</span>}
                    <span className="text-blue-700">Restableciendo contraseña para {emailMasked}</span>
                  </div>
                </div>
              )}

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
                    Nueva Contraseña
                  </label>
                  <div className="mt-1.5 relative rounded-lg shadow-xs">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      disabled={loading}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className="block w-full rounded-lg bg-white border border-gray-300 pr-10 pl-3.5 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 text-sm transition-colors disabled:bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Confirmar Nueva Contraseña
                  </label>
                  <div className="mt-1.5 relative rounded-lg shadow-xs">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      disabled={loading}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la nueva contraseña"
                      className="block w-full rounded-lg bg-white border border-gray-300 pr-10 pl-3.5 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 text-sm transition-colors disabled:bg-gray-50"
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
                      Guardando nueva contraseña...
                    </span>
                  ) : (
                    'Guardar y Acceder'
                  )}
                </button>

                <div className="pt-2 text-center">
                  <Link
                    href="/portal/login"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <ArrowLeftIcon className="h-3.5 w-3.5" />
                    Cancelar y volver
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PortalResetPasswordPage() {
  return (
    <GuestGuard role="customer">
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </GuestGuard>
  );
}
