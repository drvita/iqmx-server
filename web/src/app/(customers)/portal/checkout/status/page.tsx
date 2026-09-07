'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowRightIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface CheckoutStatusData {
  subscription_id: number;
  plan_name: string;
  product_name: string;
  status: string;
  price_mxn: number;
  checkout_url?: string | null;
}

function CheckoutStatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const subIdParam = searchParams.get('sub_id');
  const subId = subIdParam ? parseInt(subIdParam, 10) : null;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CheckoutStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(6);

  // Limpiar cualquier intención de pago residual en localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('iqmx_checkout_intent');
    } catch {
      // Ignorar error de acceso a storage
    }
  }, []);

  // Consultar estado de la suscripción (con sondeo inteligente si aún está en pending_payment)
  useEffect(() => {
    if (!subId) {
      setLoading(false);
      setError('No se especificó un identificador de suscripción válido.');
      return;
    }

    let active = true;
    let pollCount = 0;
    const maxPolls = 3;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/public/checkout/status?sub_id=${subId}`);
        if (!res.ok) {
          if (active) {
            setError('No pudimos localizar la información de tu suscripción.');
            setLoading(false);
          }
          return;
        }

        const json: CheckoutStatusData = await res.json();
        if (!active) return;

        setData(json);
        setLoading(false);

        // Si aún está en pending_payment y aún no agotamos intentos de sondeo, reintentar en 2.5s
        if (json.status === 'pending_payment' && pollCount < maxPolls) {
          pollCount += 1;
          setTimeout(fetchStatus, 2500);
        }
      } catch {
        if (active) {
          setError('Error de comunicación al verificar el estado de tu pago.');
          setLoading(false);
        }
      }
    };

    void fetchStatus();

    return () => {
      active = false;
    };
  }, [subId]);

  // Contador de redirección automática si el pago fue exitoso
  useEffect(() => {
    if (!data) return;
    const isSuccess = data.status === 'active' || data.status === 'scheduled';
    if (!isSuccess) return;

    if (countdown <= 0) {
      router.push('/portal/dashboard?payment=success');
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [data, countdown, router]);

  return (
    <div className="w-full max-w-lg mx-auto p-4 sm:p-6">
      {/* Logo y Encabezado */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-block transition-transform hover:scale-105">
          <Image
            src="/images/logo.png"
            alt="IQISSMexico Logo"
            width={170}
            height={50}
            priority
            className="h-11 w-auto mx-auto object-contain"
          />
        </Link>
      </div>

      {/* Tarjeta Principal */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center space-y-4">
            <ArrowPathIcon className="h-12 w-12 text-blue-600 animate-spin mx-auto" />
            <h2 className="text-lg font-bold text-gray-900">Verificando estado de tu pago...</h2>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Estamos consultando la confirmación de tu membresía con Mercado Pago. Esto tomará sólo un momento.
            </p>
          </div>
        ) : error || !data ? (
          <div className="p-8 sm:p-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto ring-8 ring-rose-50/50">
              <XCircleIcon className="h-10 w-10" />
            </div>

            <div>
              <h2 className="text-xl font-black text-gray-900">Información no disponible</h2>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {error || 'No fue posible validar los detalles de tu suscripción.'}
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/portal/dashboard"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
              >
                <span>Ir al Panel de Control</span>
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : data.status === 'active' || data.status === 'scheduled' ? (
          /* ─── ESTADO: ÉXITO Y AGRADECIMIENTO ─── */
          <div className="p-8 sm:p-10 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50/50 animate-bounce">
              <CheckCircleIcon className="h-10 w-10" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 px-3 py-0.5 text-[11px] font-extrabold uppercase mb-2">
                <span>{data.status === 'scheduled' ? 'Membresía Programada' : 'Pago Confirmado'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                ¡Gracias por tu compra!
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-2">
                Tu suscripción ha sido procesada exitosamente. Tu cuenta ya cuenta con todos los beneficios contratados.
              </p>
            </div>

            {/* Resumen del Plan */}
            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-5 text-left space-y-2">
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>Producto:</span>
                <span className="font-bold text-gray-800 uppercase">{data.product_name}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">Plan Adquirido:</span>
                <span className="font-extrabold text-blue-700">{data.plan_name}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-200/60">
                <span>Inversión mensual:</span>
                <span className="font-extrabold text-gray-900">${data.price_mxn.toFixed(2)} MXN / mes</span>
              </div>
            </div>

            {/* Aviso de Redirección Automática */}
            <div className="space-y-3 pt-2">
              <p className="text-xs text-gray-500">
                Serás redirigido automáticamente a tu panel en{' '}
                <span className="font-extrabold text-blue-600">{countdown}</span> segundos...
              </p>

              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${((6 - countdown) / 6) * 100}%` }}
                />
              </div>

              <Link
                href="/portal/dashboard?payment=success"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <span>Ir a mi Panel de Control Ahora</span>
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* ─── ESTADO: PAGO PENDIENTE / INTERRUMPIDO ─── */
          <div className="p-8 sm:p-10 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto ring-8 ring-amber-50/50">
              <ClockIcon className="h-10 w-10" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 px-3 py-0.5 text-[11px] font-extrabold uppercase mb-2">
                <span>Pago Pendiente de Acreditación</span>
              </div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                Tu solicitud está registrada
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">
                Aún no recibimos la confirmación final de Mercado Pago. Si realizaste el pago por transferencia o efectivo, puede demorar unos minutos. Si cerraste la pasarela antes de pagar, puedes completarlo ahora.
              </p>
            </div>

            {/* Resumen del Plan Pendiente */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 text-left space-y-2">
              <div className="flex justify-between items-center text-xs text-amber-900">
                <span>Producto:</span>
                <span className="font-bold uppercase">{data.product_name}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-700 font-medium">Plan Seleccionado:</span>
                <span className="font-extrabold text-amber-900">{data.plan_name}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-amber-200">
                <span>Monto a pagar:</span>
                <span className="font-extrabold text-gray-900">${data.price_mxn.toFixed(2)} MXN</span>
              </div>
            </div>

            {/* Acciones */}
            <div className="space-y-3 pt-2">
              {data.checkout_url && (
                <a
                  href={data.checkout_url}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  <CreditCardIcon className="h-4 w-4" />
                  <span>Completar Pago con Mercado Pago</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </a>
              )}

              <Link
                href="/portal/dashboard"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>Gestionar en mi Panel de Control</span>
              </Link>
            </div>
          </div>
        )}

        {/* Pie de tarjeta informativo */}
        <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex items-center justify-center gap-2 text-center">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-[11px] text-gray-500">
            Transacción cifrada y protegida por Mercado Pago e IQISSMexico.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-lg mx-auto p-12 text-center text-gray-500">
          <ArrowPathIcon className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-xs">Cargando confirmación...</p>
        </div>
      }
    >
      <CheckoutStatusContent />
    </Suspense>
  );
}
