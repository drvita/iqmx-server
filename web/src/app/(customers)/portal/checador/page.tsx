'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  ShieldCheckIcon,
  SparklesIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import PortalLoader from '@/components/PortalLoader';

interface ChecadorSubscription {
  plan_slug: string;
  plan_name: string;
  price_mxn: number;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  features: {
    max_empleados?: number;
    max_dispositivos?: number;
    max_sucursales?: number;
    horas_semanales_max?: number;
    cloud_evidences_enabled?: boolean;
  };
}

interface ChecadorStatus {
  checador_registered: boolean;
  checador_organization_id: string | null;
  checador_organization_name: string | null;
  checador_owner_email: string | null;
  service_url: string;
  has_used_trial_before: boolean;
  subscription: ChecadorSubscription | null;
}

interface PublicChecadorPlan {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_mxn: number;
  billing_interval: string;
  features_payload: {
    max_empleados?: number;
    max_dispositivos?: number;
    max_sucursales?: number;
    horas_semanales_max?: number;
  };
}

export default function PortalChecadorPage() {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<ChecadorStatus | null>(null);
  const [publicPlans, setPublicPlans] = useState<PublicChecadorPlan[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getHeaders = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('iqmx_portal_token') : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const [statusRes, plansRes] = await Promise.all([
        fetch('/api/portal/checador/status', { headers: getHeaders() }),
        fetch(`${apiUrl}/api/public/products/checador/plans?include_free=true`),
      ]);
      if (statusRes.ok) {
        const data = (await statusRes.json()) as ChecadorStatus;
        setStatusData(data);
      }
      if (plansRes.ok) {
        const plansData = (await plansRes.json()) as PublicChecadorPlan[];
        setPublicPlans(Array.isArray(plansData) ? plansData : []);
      }
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleRegister = async () => {
    setBusyAction('register');
    setFeedback(null);
    try {
      const res = await fetch('/api/portal/checador/register-account', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (data.temp_password && data.checador_owner_email) {
          setCreds({ email: data.checador_owner_email, password: data.temp_password });
        }
        setFeedback({ type: 'success', text: data.message });
        await loadStatus();
      } else {
        setFeedback({ type: 'error', text: data.detail || 'No fue posible crear tu cuenta.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error de red al crear la cuenta.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleResetPassword = async () => {
    setBusyAction('reset');
    setFeedback(null);
    try {
      const res = await fetch('/api/portal/checador/reset-password', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (data.temp_password && data.checador_owner_email) {
          setCreds({ email: data.checador_owner_email, password: data.temp_password });
        }
        setFeedback({ type: 'success', text: data.message });
      } else {
        setFeedback({ type: 'error', text: data.detail || 'No fue posible restablecer la contraseña.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error de red al restablecer la contraseña.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancelAccount = async () => {
    setBusyAction('cancel');
    setFeedback(null);
    try {
      const res = await fetch('/api/portal/checador/cancel-account', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setFeedback({ type: 'success', text: data.message });
        setConfirmCancel(false);
        await loadStatus();
      } else {
        setFeedback({ type: 'error', text: data.detail || 'No fue posible cancelar la cuenta.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Error de red al cancelar la cuenta.' });
    } finally {
      setBusyAction(null);
    }
  };

  if (loading) {
    return <PortalLoader message="Cargando estado de Checador Facial..." />;
  }

  const sub = statusData?.subscription;
  const features = sub?.features ?? {};
  const isCancelled = sub?.status === 'cancelled';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <ShieldCheckIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Checador Facial</h1>
            <p className="text-sm text-gray-600 mt-1">
              Control de asistencia facial con prueba de vida y cumplimiento de privacidad.
            </p>
          </div>
        </div>

        {statusData?.checador_registered && !isCancelled && (
          <a
            href={statusData.service_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Abrir Panel Checador
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </a>
        )}
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-4 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {creds && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-2">
          <p className="text-sm font-bold text-amber-950">
            Credenciales temporales de acceso (guárdalas en un lugar seguro)
          </p>
          <p className="text-sm text-amber-900">
            Correo: <span className="font-mono font-semibold">{creds.email}</span>
          </p>
          <p className="text-sm text-amber-900">
            Contraseña temporal: <span className="font-mono font-semibold">{creds.password}</span>
          </p>
        </div>
      )}

      {!statusData?.checador_registered ? (() => {
        const paidPlan = publicPlans.find((p) => p.price_mxn > 0);
        const trialPlan = publicPlans.find((p) => p.price_mxn <= 0);
        const activeRefPlan = statusData?.has_used_trial_before ? paidPlan : (trialPlan || paidPlan);
        const activeFeatures = activeRefPlan?.features_payload || {};
        const maxEmp = activeFeatures.max_empleados ?? 15;
        const maxDisp = activeFeatures.max_dispositivos ?? 2;
        const maxSuc = activeFeatures.max_sucursales ?? 1;

        return (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  <SparklesIcon className="h-3.5 w-3.5" />
                  {statusData?.has_used_trial_before
                    ? paidPlan
                      ? `${paidPlan.name} — $${paidPlan.price_mxn.toLocaleString('es-MX')} MXN/${paidPlan.billing_interval === 'annual' ? 'año' : 'mes'}`
                      : 'Plan de Pago'
                    : trialPlan?.name || 'Prueba Gratuita de 1 Mes'}
                </span>
                <h2 className="text-xl font-bold text-gray-900 mt-3">
                  Activa tu cuenta de Checador Facial
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Incluye hasta {maxEmp} colaboradores, {maxDisp}{' '}
                  {maxDisp === 1 ? 'terminal quiosco' : 'terminales quiosco'}, {maxSuc}{' '}
                  {maxSuc === 1 ? 'sucursal' : 'sucursales'} y reportes semanales de jornada.
                  {!statusData?.has_used_trial_before && paidPlan ? (
                    <>
                      {' '}
                      Después del periodo de prueba: {paidPlan.name} por{' '}
                      <strong>
                        ${paidPlan.price_mxn.toLocaleString('es-MX')} MXN/
                        {paidPlan.billing_interval === 'annual' ? 'año' : 'mes'}
                      </strong>
                      .
                    </>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRegister}
                disabled={busyAction === 'register'}
                className="shrink-0 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busyAction === 'register' ? 'Activando cuenta...' : 'Crear cuenta de Checador'}
              </button>
            </div>
          </div>
        );
      })() : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Membresía y Límites</h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isCancelled
                    ? 'bg-red-50 text-red-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {isCancelled ? (
                  <XCircleIcon className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                )}
                {isCancelled ? 'Cancelada' : sub?.status === 'trial' ? 'Prueba 1 Mes' : 'Activa'}
              </span>
            </div>

            <div className="space-y-2 text-sm text-gray-700">
              <p>
                Plan actual: <strong>{sub?.plan_name ?? 'Plan Básico'}</strong> (
                {sub && sub.price_mxn > 0 ? `$${sub.price_mxn} MXN/mes` : 'Sin costo durante prueba'})
              </p>
              <p>Organización: <strong>{statusData.checador_organization_name}</strong></p>
              <p>Administrador: <span className="font-mono">{statusData.checador_owner_email}</span></p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 text-xs">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-gray-500">Colaboradores</p>
                <p className="text-base font-bold text-gray-900">{features.max_empleados ?? 15}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-gray-500">Terminales Quiosco</p>
                <p className="text-base font-bold text-gray-900">{features.max_dispositivos ?? 2}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-gray-500">Sucursales</p>
                <p className="text-base font-bold text-gray-900">{features.max_sucursales ?? 1}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-gray-500">Jornada semanal</p>
                <p className="text-base font-bold text-gray-900">{features.horas_semanales_max ?? 48} h</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900">Gestión de Acceso y Suscripción</h2>
              <p className="text-sm text-gray-600">
                Puedes generar una nueva contraseña temporal para el administrador o cancelar tu suscripción cuando lo necesites.
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={busyAction !== null || isCancelled}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                <KeyIcon className="h-4 w-4" />
                {busyAction === 'reset' ? 'Generando...' : 'Generar nueva contraseña temporal'}
              </button>

              {!isCancelled && (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  disabled={busyAction !== null}
                  className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Cancelar cuenta de Checador
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <ExclamationTriangleIcon className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-bold text-gray-900">¿Cancelar Checador Facial?</h3>
            </div>
            <p className="text-sm text-gray-600">
              Se suspenderá el acceso al panel y la sincronización de tus quioscos. Tus registros históricos se conservarán resguardados hasta que solicites su eliminación manual.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancelAccount}
                disabled={busyAction === 'cancel'}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busyAction === 'cancel' ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
