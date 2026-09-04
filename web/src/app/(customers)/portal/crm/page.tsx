'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CreditCardIcon,
  LockClosedIcon,
  ArrowTopRightOnSquareIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  DevicePhoneMobileIcon,
  BuildingOffice2Icon,
  EnvelopeIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import PortalLoader from '@/components/PortalLoader';
import FeedbackAlert from '../dashboard/components/FeedbackAlert';
import WhatsAppAccountsSection from '../dashboard/components/WhatsAppAccountsSection';
import WebhookConfigSection from '../dashboard/components/WebhookConfigSection';
import DeliveryDiagnosticSection from '../dashboard/components/DeliveryDiagnosticSection';
import {
  WhatsAppNumber,
  CustomerWebhookConfig,
  FeedbackMessage,
  SubscriptionItem,
} from '../dashboard/components/types';

interface ActiveProductInfo {
  has_active: boolean;
  product_slug: string;
  product_name: string;
  service_url: string | null;
  subscription: SubscriptionItem | null;
  max_whatsapp_accounts: number;
  max_team_members: number | null;
  max_contacts: number | null;
  agenda_enabled: boolean;
  has_used_trial_before: boolean;
  crm_registered: boolean;
  crm_organization_id: string | null;
  crm_organization_name: string | null;
  crm_owner_email: string | null;
  temp_password?: string | null;
  must_change_password?: boolean | null;
}

export default function PortalCrmPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [crmInfo, setCrmInfo] = useState<ActiveProductInfo | null>(null);
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [webhookConfig, setWebhookConfig] = useState<CustomerWebhookConfig | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<FeedbackMessage | null>(null);
  const [claimingTrial, setClaimingTrial] = useState(false);
  const [registeringCrm, setRegisteringCrm] = useState(false);
  const [justRegisteredCreds, setJustRegisteredCreds] = useState<{ email?: string; password?: string } | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [activeTab, setActiveTab] = useState<'lines' | 'membership' | 'connection' | 'diagnostics'>('lines');

  const getHeaders = useCallback((): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('iqmx_portal_token') : null;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const loadData = useCallback(async () => {
    const headers = getHeaders();
    try {
      // 1. Membresía y estado del CRM
      const resCrm = await fetch('/api/portal/subscriptions/active-product?product_slug=crm', { headers });
      if (resCrm.status === 401) {
        router.push('/portal/login');
        return;
      }
      if (resCrm.ok) {
        const dataCrm = await resCrm.json();
        setCrmInfo(dataCrm);
      }

      // 2. Líneas oficiales de WhatsApp
      const resNum = await fetch('/api/portal/whatsapp/numbers', { headers });
      if (resNum.ok) {
        setNumbers(await resNum.json());
      }

      // 3. Configuración de Webhook
      const resWh = await fetch('/api/portal/webhook/config', { headers });
      if (resWh.ok) {
        setWebhookConfig(await resWh.json());
      }
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'Error de comunicación al consultar el módulo del CRM.',
      });
    } finally {
      setLoading(false);
    }
  }, [getHeaders, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Activar prueba gratuita directamente (validando trial único)
  const handleClaimTrial = async () => {
    setClaimingTrial(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/portal/subscriptions/claim-trial', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.status === 'activated') {
        setFeedbackMsg({
          type: 'success',
          text: '¡Tu período de Prueba Gratuita (Free Trial de 30 días) ha sido activado exitosamente!',
        });
        await loadData();
      } else if (data.status === 'already_used') {
        setFeedbackMsg({
          type: 'error',
          text: data.message || 'La prueba gratuita ya fue utilizada previamente por esta cuenta.',
        });
        await loadData();
      } else if (data.status === 'already_active') {
        setFeedbackMsg({
          type: 'success',
          text: data.message || 'Tu membresía activa ha sido reconocida.',
        });
        await loadData();
      } else {
        setFeedbackMsg({
          type: 'error',
          text: data.detail || data.message || 'No fue posible activar la prueba gratuita.',
        });
      }
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'Error de red al activar la prueba gratuita.',
      });
    } finally {
      setClaimingTrial(false);
    }
  };

  // Registrar cuenta en el CRM oficial
  const handleRegisterCrm = async () => {
    setRegisteringCrm(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/portal/crm/register-account', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (data.temp_password) {
          setJustRegisteredCreds({
            email: crmInfo?.crm_owner_email || undefined,
            password: data.temp_password,
          });
        }
        setFeedbackMsg({
          type: 'success',
          text: data.message || 'Tu cuenta en el CRM ha sido creada exitosamente.',
        });
        await loadData();
      } else {
        setFeedbackMsg({
          type: 'error',
          text: data.detail || data.message || 'No fue posible registrar la cuenta en el CRM.',
        });
      }
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'Error de red al registrar tu cuenta en el CRM.',
      });
    } finally {
      setRegisteringCrm(false);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  if (loading) {
    return <PortalLoader message="Cargando módulo CRM WhatsApp..." />;
  }

  const hasActiveCrm = crmInfo?.has_active;
  const sub = crmInfo?.subscription;
  const maxAccounts = crmInfo?.max_whatsapp_accounts ?? 1;
  const quotaReached = numbers.length >= maxAccounts;
  const serviceUrl = crmInfo?.service_url;
  const isCrmRegistered = crmInfo?.crm_registered;
  const hasUsedTrialBefore = crmInfo?.has_used_trial_before;
  const currentTempPassword = justRegisteredCreds?.password || crmInfo?.temp_password;
  const crmUserEmail = crmInfo?.crm_owner_email || justRegisteredCreds?.email;

  return (
    <div className="space-y-8 font-sans text-gray-900">
      {/* ─── CABECERA LIMPIA Y COMPACTA DEL MÓDULO CRM ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 text-blue-800 px-3 py-0.5 text-xs font-semibold">
              <ChatBubbleLeftRightIcon className="h-3.5 w-3.5 text-blue-600" />
              <span>Módulo de Producto</span>
            </span>

            {isCrmRegistered ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold">
                <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                <span>CRM Propietario: {crmInfo?.crm_owner_email || 'Vinculado'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-xs font-medium">
                <span>Sin cuenta CRM vinculada</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            CRM WhatsApp Omnicanal
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Conecta tus líneas oficiales de WhatsApp Business, integra con tu propio webhook o accede a la plataforma oficial del CRM.
          </p>
        </div>

        {/* Acciones principales en la cabecera */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botón hacia la aplicación CRM si service_url está configurada */}
          {serviceUrl && (
            <a
              href={serviceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition-colors"
            >
              <span>Abrir CRM Web</span>
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            </a>
          )}

          {/* Opción para registrar cuenta en el CRM si aún no está vinculado */}
          {!isCrmRegistered && (
            <button
              onClick={handleRegisterCrm}
              disabled={registeringCrm}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <SparklesIcon className="h-3.5 w-3.5" />
              <span>{registeringCrm ? 'Registrando...' : 'Registrar en CRM'}</span>
            </button>
          )}

          {hasActiveCrm && (
            <Link
              href="/landingpage/crm"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-xs transition-colors"
            >
              <span>Mejorar Plan</span>
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Alertas y notificaciones del sistema */}
      <FeedbackAlert message={feedbackMsg} onDismiss={() => setFeedbackMsg(null)} />

      {/* ─── TARJETA DE CREDENCIALES TEMPORALES (PRIMER ACCESO CRM) ─── */}
      {currentTempPassword && (
        <div className="rounded-2xl border border-amber-300 bg-linear-to-r from-amber-50 to-orange-50 p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">
                  <KeyIcon className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-gray-900">
                  Credenciales Provisionales de Acceso al CRM
                </h3>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-300">
                  Primer Inicio de Sesión
                </span>
              </div>
              <p className="text-xs text-gray-600 max-w-2xl">
                Utiliza estas credenciales para acceder por primera vez a la aplicación CRM Web. Al ingresar, el sistema te solicitará de forma obligatoria establecer tu contraseña definitiva.
              </p>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 max-w-xl">
                <div className="rounded-xl border border-amber-200 bg-white/90 p-2.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Usuario / Correo</span>
                  <span className="text-xs font-semibold text-gray-900 break-all">{crmUserEmail || 'Tu correo de cuenta'}</span>
                </div>

                <div className="rounded-xl border border-amber-200 bg-white/90 p-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Contraseña Temporal</span>
                    <span className="text-xs font-mono font-bold text-amber-900 block truncate">
                      {showPass ? currentTempPassword : '••••••••••••'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      title={showPass ? 'Ocultar' : 'Mostrar'}
                    >
                      {showPass ? (
                        <EyeSlashIcon className="h-4 w-4" />
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(currentTempPassword);
                        setCopiedPass(true);
                        setTimeout(() => setCopiedPass(false), 2500);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-2xs cursor-pointer"
                    >
                      {copiedPass ? (
                        <>
                          <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 text-white" />
                          <span>¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="h-3.5 w-3.5 text-white" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex sm:flex-col justify-end">
              {serviceUrl && (
                <a
                  href={serviceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700 shadow-sm transition-colors text-center"
                >
                  <span>Iniciar Sesión en CRM</span>
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── PESTAÑAS DE GESTIÓN DEL PRODUCTO CRM ─── */}
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap gap-2 sm:gap-6 text-xs font-bold">
          {/* Pestaña 1: Líneas de WhatsApp */}
          <button
            onClick={() => setActiveTab('lines')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'lines'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <DevicePhoneMobileIcon className="h-4 w-4" />
            <span>Líneas de WhatsApp ({numbers.length}/{hasActiveCrm ? maxAccounts : 0})</span>
          </button>

          {/* Pestaña 2: Membresía y Cuotas */}
          <button
            onClick={() => setActiveTab('membership')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'membership'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CreditCardIcon className="h-4 w-4" />
            <span>Membresía y Cuotas</span>
            {hasActiveCrm && sub && (
              <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
                {sub.status === 'trial' ? 'Prueba' : 'Activa'}
              </span>
            )}
          </button>

          {/* Pestaña 3: Destino y Conexión al CRM */}
          <button
            onClick={() => setActiveTab('connection')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'connection'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4" />
            <span>Destino y Conexión</span>
          </button>

          {/* Pestaña 4: Monitoreo y Diagnóstico */}
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CheckCircleIcon className="h-4 w-4" />
            <span>Monitoreo y Diagnóstico</span>
          </button>
        </nav>
      </div>

      {/* ─── PESTAÑA 1: LÍNEAS DE WHATSAPP ─── */}
      {activeTab === 'lines' && (
        <div className="space-y-4">
          {!hasActiveCrm && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-2.5">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Membresía requerida para habilitar números oficiales</p>
                <p className="mt-0.5 text-amber-800">
                  Puedes vincular y gestionar tus números de WhatsApp. Para procesar mensajes y agentes, activa tu membresía en la pestaña &quot;Membresía y Cuotas&quot;.
                </p>
              </div>
            </div>
          )}

          {hasActiveCrm && quotaReached && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-950 flex items-start justify-between gap-4">
              <div>
                <p className="font-bold">Has alcanzado el límite de líneas de tu plan actual ({maxAccounts} línea(s))</p>
                <p className="mt-0.5 text-blue-800">
                  Si requieres conectar más números para distintas sucursales o equipos, puedes hacer un upgrade de plan.
                </p>
              </div>
              <Link
                href="/landingpage/crm"
                className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
              >
                <span>Mejorar Plan</span>
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </div>
          )}

          <div>
            <WhatsAppAccountsSection
              numbers={numbers}
              getHeaders={getHeaders}
              onRefreshData={loadData}
              onFeedback={setFeedbackMsg}
            />
          </div>
        </div>
      )}

      {/* ─── PESTAÑA 2: MEMBRESÍA Y CUOTAS (NUEVA UBICACIÓN) ─── */}
      {activeTab === 'membership' && (
        <div className="space-y-6">
          {hasActiveCrm && sub ? (
            <div className="rounded-3xl border border-blue-200 bg-linear-to-br from-blue-50/70 via-white to-blue-50/30 p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-blue-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold uppercase flex items-center gap-1">
                      <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{sub.status === 'trial' ? 'Prueba Gratuita' : 'Membresía Activa'}</span>
                    </span>
                    <span className="text-xs text-gray-500">Plan actual del CRM</span>
                  </div>
                  <h2 className="text-2xl font-black text-gray-900">{sub.plan_name}</h2>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {sub.price_mxn > 0 ? `$${sub.price_mxn.toFixed(2)} MXN / mes` : 'Sin costo'}
                  </p>
                </div>

                <div className="sm:text-right bg-white sm:bg-transparent p-4 sm:p-0 rounded-2xl border sm:border-0 border-blue-100">
                  <p className="text-xs text-gray-500 font-medium">Vigencia hasta</p>
                  <p className="text-sm sm:text-base font-bold text-gray-900 mt-0.5">
                    {formatDate(sub.current_period_end)}
                  </p>
                  <p className="text-xs text-blue-600 font-semibold mt-0.5">
                    {sub.days_remaining} {sub.days_remaining === 1 ? 'día restante' : 'días restantes'}
                  </p>
                </div>
              </div>

              {/* Límites operativos del CRM */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-xs text-gray-700">
                <div className="rounded-xl bg-white p-3.5 border border-blue-100/70 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <DevicePhoneMobileIcon className="h-4 w-4 text-blue-600" />
                    <span>Líneas WhatsApp</span>
                  </div>
                  <p className="text-base font-extrabold text-gray-900">
                    {numbers.length} / {maxAccounts}
                  </p>
                  <span className="text-[10px] text-gray-400">
                    {quotaReached ? 'Cuota alcanzada' : `${maxAccounts - numbers.length} disponible(s)`}
                  </span>
                </div>

                <div className="rounded-xl bg-white p-3.5 border border-blue-100/70 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <UserGroupIcon className="h-4 w-4 text-blue-600" />
                    <span>Equipo / Miembros</span>
                  </div>
                  <p className="text-base font-extrabold text-gray-900">
                    {crmInfo?.max_team_members === null ? 'Ilimitados' : `${crmInfo?.max_team_members ?? 5}`}
                  </p>
                  <span className="text-[10px] text-gray-400">Agentes autorizados</span>
                </div>

                <div className="rounded-xl bg-white p-3.5 border border-blue-100/70 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <ChatBubbleLeftRightIcon className="h-4 w-4 text-blue-600" />
                    <span>Contactos</span>
                  </div>
                  <p className="text-base font-extrabold text-gray-900">
                    {crmInfo?.max_contacts === null
                      ? 'Ilimitados'
                      : `${(crmInfo?.max_contacts ?? 500).toLocaleString()}`}
                  </p>
                  <span className="text-[10px] text-gray-400">Capacidad en base de datos</span>
                </div>

                <div className="rounded-xl bg-white p-3.5 border border-blue-100/70 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                    <CalendarDaysIcon className="h-4 w-4 text-blue-600" />
                    <span>Agenda de Citas</span>
                  </div>
                  <p className={`text-base font-extrabold ${crmInfo?.agenda_enabled ? 'text-emerald-700' : 'text-gray-400'}`}>
                    {crmInfo?.agenda_enabled ? 'Habilitada ✓' : 'No incluida'}
                  </p>
                  <span className="text-[10px] text-gray-400">
                    {crmInfo?.agenda_enabled ? 'Recordatorios IA' : 'Solo en planes superiores'}
                  </span>
                </div>
              </div>

              <div className="pt-6 border-t border-blue-100 mt-6 flex justify-end">
                <Link
                  href="/landingpage/crm"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition-colors"
                >
                  <span>Mejorar o Renovar Plan</span>
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ) : hasUsedTrialBefore ? (
            /* ─── CASO: TRIAL YA FUE USADO PREVIAMENTE ─── */
            <div className="rounded-3xl border border-amber-200 bg-linear-to-br from-amber-50/60 to-white p-8 text-center max-w-3xl mx-auto shadow-xs">
              <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-4">
                <LockClosedIcon className="h-6 w-6 text-amber-700" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                La prueba gratuita ya fue utilizada previamente
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 max-w-xl mx-auto mt-2 leading-relaxed">
                El período de prueba de 30 días ya fue otorgado con anterioridad a esta cuenta.
                Para continuar utilizando las líneas de WhatsApp, asesores de inteligencia artificial y
                la plataforma CRM, por favor adquiere una membresía comercial.
              </p>

              <div className="pt-6 flex justify-center">
                <Link
                  href="/landingpage/crm"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
                >
                  <CreditCardIcon className="h-4 w-4" />
                  <span>Ver Planes y Precios Comerciales</span>
                </Link>
              </div>
            </div>
          ) : (
            /* ─── CASO: SIN MEMBRESÍA Y TRIAL DISPONIBLE ─── */
            <div className="rounded-3xl border-2 border-dashed border-emerald-300 bg-linear-to-br from-emerald-50/60 to-white p-8 text-center max-w-3xl mx-auto shadow-xs">
              <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-4">
                <SparklesIcon className="h-6 w-6 text-emerald-700" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Comienza con 30 días de Prueba Gratuita
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 max-w-xl mx-auto mt-2 leading-relaxed">
                Prueba sin compromiso las funciones del CRM WhatsApp Omnicanal con agentes autorizados,
                gestión de contactos y conexión oficial con Meta.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6">
                <button
                  onClick={handleClaimTrial}
                  disabled={claimingTrial}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <SparklesIcon className="h-4 w-4" />
                  <span>{claimingTrial ? 'Activando prueba…' : 'Activar Prueba Gratuita (30 días)'}</span>
                </button>

                <Link
                  href="/landingpage/crm"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
                >
                  <CreditCardIcon className="h-4 w-4" />
                  <span>Ver Planes Comerciales</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── PESTAÑA 3: CONEXIÓN AL CRM O SISTEMA EXTERNO ─── */}
      {activeTab === 'connection' && (
        <div className="space-y-6">
          {/* Tarjeta de Acceso y Estado del CRM Oficial */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Plataforma Oficial
                </span>
                <h3 className="text-lg font-bold text-gray-900 mt-2">
                  CRM IQISSMexico Omnicanal
                </h3>
                <p className="text-xs text-gray-500 mt-1 max-w-xl leading-relaxed">
                  Bandeja de entrada multi-agente para atender conversaciones de WhatsApp, embudo de ventas Kanban y monitoreo con IA.
                </p>

                {/* Detalles de la cuenta en CRM si está registrado */}
                {isCrmRegistered ? (
                  <div className="mt-4 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-950 space-y-1.5 max-w-md">
                    <div className="flex items-center gap-2 font-bold text-emerald-900">
                      <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Cuenta vinculada al CRM</span>
                    </div>
                    {crmInfo?.crm_owner_email && (
                      <div className="flex items-center gap-2 text-emerald-800">
                        <EnvelopeIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Correo Propietario: <strong>{crmInfo.crm_owner_email}</strong></span>
                      </div>
                    )}
                    {crmInfo?.crm_organization_name && (
                      <div className="flex items-center gap-2 text-emerald-800">
                        <BuildingOffice2Icon className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Organización: <strong>{crmInfo.crm_organization_name}</strong></span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 max-w-xl">
                    <p className="font-bold">Aún no cuentas con un espacio registrado en el CRM oficial</p>
                    <p className="mt-1 text-amber-800 leading-relaxed">
                      Si planeas usar WhatsApp con tu propio software, puedes conectar únicamente el Webhook externo abajo.
                      Si deseas utilizar la plataforma oficial del CRM, haz clic en el botón para crear tu cuenta en 1 segundo.
                    </p>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex flex-col gap-2 shrink-0">
                {serviceUrl && isCrmRegistered && (
                  <a
                    href={serviceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
                  >
                    <span>Abrir CRM Web</span>
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </a>
                )}

                {!isCrmRegistered && (
                  <button
                    onClick={handleRegisterCrm}
                    disabled={registeringCrm}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <SparklesIcon className="h-4 w-4" />
                    <span>{registeringCrm ? 'Creando cuenta CRM...' : 'Registrar mi cuenta en el CRM'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Configuración Avanzada: Webhook a CRM externo */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs">
            <div className="mb-4">
              <span className="rounded-full bg-purple-100 text-purple-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Integración Externa
              </span>
              <h3 className="text-lg font-bold text-gray-900 mt-2">
                Reenviar Mensajes a un CRM o Sistema Propio (Webhook)
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
                Si cuentas con tu propio software, CRM interno o flujos en n8n / Airflow, puedes configurar la URL de tu servidor para recibir los eventos entrantes de WhatsApp firmados con HMAC-SHA256.
              </p>
            </div>

            <WebhookConfigSection
              webhookConfig={webhookConfig}
              getHeaders={getHeaders}
              onRefreshData={loadData}
              onFeedback={setFeedbackMsg}
              isCrmManaged={Boolean(crmInfo?.crm_registered)}
            />
          </div>
        </div>
      )}

      {/* ─── PESTAÑA 4: DIAGNÓSTICO DE ENTREGA ─── */}
      {activeTab === 'diagnostics' && (
        <DeliveryDiagnosticSection webhookConfig={webhookConfig} />
      )}
    </div>
  );
}
