'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircleIcon,
  XCircleIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [previewLoading, setPreviewLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [userInfo, setUserInfo] = useState<{ email?: string; masked_email?: string; user_name?: string } | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Consulta pasiva inicial (inofensiva para crawlers/escáneres de Outlook/Gmail)
  useEffect(() => {
    if (!token) {
      setPreviewLoading(false);
      setTokenValid(false);
      return;
    }

    const checkTokenPreview = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(`${apiUrl}/api/portal/auth/verify-email/preview?token=${encodeURIComponent(token)}`);
        if (res.ok) {
          const data = await res.json();
          setTokenValid(data.valid);
          if (data.valid) {
            setUserInfo(data);
          }
        } else {
          setTokenValid(false);
        }
      } catch {
        setTokenValid(false);
      } finally {
        setPreviewLoading(false);
      }
    };

    checkTokenPreview();
  }, [token]);

  // Confirmación Humana Explícita (Acción por POST)
  const handleConfirmVerification = async () => {
    if (!token) return;
    setVerifying(true);
    setErrorMessage('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/portal/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setVerifyStatus('success');
      } else {
        setVerifyStatus('error');
        setErrorMessage(data.detail || 'El enlace de verificación no es válido o ha expirado.');
      }
    } catch {
      setVerifyStatus('error');
      setErrorMessage('Error de conexión al verificar el correo. Intenta nuevamente.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 via-white to-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo / Encabezado */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-black tracking-tight text-blue-900">
              IQISS<span className="text-blue-600">Mexico</span>
            </span>
          </Link>
          <h2 className="mt-4 text-xl font-extrabold text-gray-900 tracking-tight">
            Verificación de Cuenta
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Confirmación de correo electrónico corporativo
          </p>
        </div>

        {/* Tarjeta Principal */}
        <div className="mt-6 bg-white py-8 px-6 shadow-xl shadow-gray-200/50 sm:rounded-3xl border border-gray-100 sm:px-10">
          {previewLoading ? (
            <div className="py-10 text-center space-y-3">
              <ArrowPathIcon className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs text-gray-500 font-medium">Validando enlace de seguridad…</p>
            </div>
          ) : verifyStatus === 'success' ? (
            /* ─── ESTADO: ÉXITO ─── */
            <div className="text-center space-y-4 py-4">
              <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-xs">
                <CheckCircleIcon className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">¡Correo verificado con éxito!</h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Tu cuenta ha sido confirmada y ahora tienes acceso completo a todas las funcionalidades del portal.
                </p>
              </div>
              <div className="pt-3">
                <Link
                  href="/portal/dashboard"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
                >
                  <span>Ir a mi Panel de Control</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : verifyStatus === 'error' || tokenValid === false ? (
            /* ─── ESTADO: ENLACE INVÁLIDO O EXPIRADO ─── */
            <div className="text-center space-y-4 py-4">
              <div className="h-16 w-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100 shadow-xs">
                <XCircleIcon className="h-10 w-10" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Enlace no disponible</h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {errorMessage || 'Este enlace de verificación es inválido, ya fue utilizado o ha expirado.'}
                </p>
              </div>
              <div className="pt-3 space-y-2">
                <Link
                  href="/portal/login"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-black transition-colors"
                >
                  <span>Iniciar sesión para solicitar nuevo enlace</span>
                </Link>
                <Link
                  href="/"
                  className="inline-block text-xs text-gray-400 hover:text-gray-600 font-medium"
                >
                  Volver al inicio
                </Link>
              </div>
            </div>
          ) : (
            /* ─── ESTADO: CONFIRMACIÓN HUMANA EN 2 PASOS (ANTI-SCANNERS) ─── */
            <div className="text-center space-y-5 py-2">
              <div className="h-14 w-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto border border-blue-100 shadow-2xs">
                <ShieldCheckIcon className="h-8 w-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {userInfo?.user_name ? `Hola, ${userInfo.user_name}` : 'Confirmación Requerida'}
                </h3>
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                  Haz clic en el siguiente botón para confirmar que eres tú y activar tu correo electrónico corporativo:
                </p>
                {userInfo?.masked_email && (
                  <p className="mt-2 text-xs font-mono font-bold text-blue-800 bg-blue-50/70 py-1.5 px-3 rounded-lg inline-block border border-blue-100">
                    {userInfo.masked_email}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={handleConfirmVerification}
                  disabled={verifying}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {verifying ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      <span>Verificando tu cuenta…</span>
                    </>
                  ) : (
                    <>
                      <EnvelopeIcon className="h-4 w-4" />
                      <span>Confirmar mi Correo Electrónico</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-gray-400 leading-normal pt-2 border-t border-gray-100">
                🔒 Esta confirmación interactiva protege tu cuenta contra escaneos automáticos de seguridad. Si tú no solicitaste este registro, puedes cerrar esta pestaña con tranquilidad.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <ArrowPathIcon className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
