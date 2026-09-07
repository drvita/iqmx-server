"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChatBubbleLeftRightIcon,
  CreditCardIcon,
  ShoppingBagIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  BoltIcon,
  CalendarDaysIcon,
  BuildingOffice2Icon,
  CommandLineIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import PortalLoader from "@/components/PortalLoader";
import FeedbackAlert from "./components/FeedbackAlert";
import {
  getCheckoutIntent,
  clearCheckoutIntent,
  CheckoutIntent,
} from "@/utils/checkoutIntent";
import {
  CustomerProfile,
  FeedbackMessage,
  SubscriptionItem,
  ConflictCheckInfo,
} from "./components/types";

export default function PortalDashboardPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<FeedbackMessage | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Intención o suscripción pendiente de pago
  const [pendingIntent, setPendingIntent] = useState<CheckoutIntent | null>(
    null,
  );
  const [conflictInfo, setConflictInfo] = useState<ConflictCheckInfo | null>(
    null,
  );
  const [payingPending, setPayingPending] = useState(false);
  const [cancellingPending, setCancellingPending] = useState(false);

  // Suscripción pendiente detectada en base de datos
  const dbPendingSub = subscriptions.find(
    (s) => s.status === "pending_payment",
  );
  const activePendingPlanId =
    dbPendingSub?.plan_id || pendingIntent?.plan_id;
  const activePendingPlanName =
    dbPendingSub?.plan_name || pendingIntent?.plan_name;
  const activePendingPrice =
    dbPendingSub?.price_mxn ?? pendingIntent?.price_mxn ?? 0;

  // Verificación de Correo
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendEmailMsg, setResendEmailMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const getHeaders = useCallback((): Record<string, string> => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("iqmx_portal_token")
        : null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const loadData = useCallback(async () => {
    const headers = getHeaders();
    try {
      // 1. Perfil del cliente
      const resMe = await fetch("/api/portal/auth/me", { headers });
      if (resMe.status === 401) {
        localStorage.removeItem("iqmx_portal_token");
        localStorage.removeItem("iqmx_portal_customer");
        router.push("/portal/login");
        return;
      }
      if (resMe.ok) {
        setProfile(await resMe.json());
      }

      // 2. Membresías del cliente
      const resSubs = await fetch("/api/portal/subscriptions/my", { headers });
      if (resSubs.ok) {
        setSubscriptions(await resSubs.json());
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error de red al consultar la información del panel.",
      });
    } finally {
      setLoadingInitial(false);
    }
  }, [getHeaders, router]);

  useEffect(() => {
    void loadData();

    // Detección de intenciones y parámetros de URL
    const intent = getCheckoutIntent();
    if (intent) setPendingIntent(intent);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("trial") === "1" || params.get("trial") === "success") {
        setFeedbackMsg({
          type: "success",
          text: "¡Tu membresía de Prueba Gratuita (Free Trial) ha sido activada exitosamente!",
        });
      } else if (params.get("payment") === "success") {
        setFeedbackMsg({
          type: "success",
          text: "¡Tu pago ha sido validado exitosamente con Mercado Pago y tu membresía está activa!",
        });
      }
    }
  }, [loadData]);

  // Verificar conflicto de membresía cuando existe plan pendiente
  useEffect(() => {
    if (activePendingPlanId) {
      const headers = getHeaders();
      fetch(
        `/api/portal/subscriptions/check-conflict?plan_id=${activePendingPlanId}`,
        { headers },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && data.has_active) {
            setConflictInfo(data);
          } else {
            setConflictInfo(null);
          }
        })
        .catch(() => setConflictInfo(null));
    } else {
      setConflictInfo(null);
    }
  }, [activePendingPlanId, getHeaders]);

  const handlePayPending = async () => {
    if (dbPendingSub?.checkout_url) {
      clearCheckoutIntent();
      setPendingIntent(null);
      window.location.href = dbPendingSub.checkout_url;
      return;
    }

    if (!activePendingPlanId || !profile) return;
    setPayingPending(true);

    try {
      const res = await fetch("/api/public/checkout/preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: activePendingPlanId,
          company_name: profile.company_name,
          contact_name: profile.contact_name,
          email: profile.email,
        }),
      });

      const data = await res.json();
      if (res.ok && data.checkout_url) {
        clearCheckoutIntent();
        setPendingIntent(null);
        window.location.href = data.checkout_url;
      } else {
        setFeedbackMsg({
          type: "error",
          text:
            data.detail || "Error al conectar con la pasarela de Mercado Pago.",
        });
      }
    } catch {
      setFeedbackMsg({
        type: "error",
        text: "Error de red al procesar el pago.",
      });
    } finally {
      setPayingPending(false);
    }
  };

  const handleCancelPending = async () => {
    if (dbPendingSub) {
      setCancellingPending(true);
      try {
        const headers = getHeaders();
        const res = await fetch(
          `/api/portal/subscriptions/${dbPendingSub.id}/cancel-pending`,
          {
            method: "DELETE",
            headers,
          },
        );
        const data = await res.json();
        if (res.ok) {
          clearCheckoutIntent();
          setPendingIntent(null);
          setFeedbackMsg({
            type: "success",
            text: "La solicitud de membresía pendiente ha sido cancelada y descartada exitosamente.",
          });
          void loadData();
        } else {
          setFeedbackMsg({
            type: "error",
            text: data.detail || "Error al cancelar la suscripción pendiente.",
          });
        }
      } catch {
        setFeedbackMsg({
          type: "error",
          text: "Error de red al cancelar la suscripción pendiente.",
        });
      } finally {
        setCancellingPending(false);
      }
    } else {
      clearCheckoutIntent();
      setPendingIntent(null);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    setResendEmailMsg(null);
    try {
      const headers = getHeaders();
      const res = await fetch("/api/portal/auth/resend-verification", {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (res.ok) {
        setResendEmailMsg({
          type: "success",
          text: data.message || "Enlace enviado a tu bandeja de correo.",
        });
      } else {
        setResendEmailMsg({
          type: "error",
          text: data.detail || "No se pudo enviar el correo de verificación.",
        });
      }
    } catch {
      setResendEmailMsg({
        type: "error",
        text: "Error de comunicación al solicitar el reenvío.",
      });
    } finally {
      setResendingEmail(false);
    }
  };

  if (loadingInitial && !profile) {
    return <PortalLoader message="Cargando panel de control..." />;
  }

  // Identificar membresía del CRM
  const crmSub = subscriptions.find(
    (s) =>
      s.product_slug === "crm" &&
      (s.status === "active" || s.status === "trial"),
  );

  return (
    <div className="space-y-8 font-sans text-gray-900">
      {/* ─── BANNER DE CORREO NO VERIFICADO (OPCIÓN A) ─── */}
      {profile && profile.email_verified === false && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-2xs">
              <EnvelopeIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-950">
                  Confirma tu correo electrónico
                </h3>
                <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 uppercase">
                  Pendiente
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Enviamos un enlace de validación a{" "}
                <strong>{profile.email}</strong>. Confirma tu cuenta para
                proteger tu acceso y habilitar la contratación de planes.
              </p>
              {resendEmailMsg && (
                <p
                  className={`text-xs mt-2 font-semibold ${
                    resendEmailMsg.type === "success"
                      ? "text-emerald-700"
                      : "text-red-600"
                  }`}
                >
                  {resendEmailMsg.text}
                </p>
              )}
            </div>
          </div>

          <div className="w-full sm:w-auto flex justify-end shrink-0">
            <button
              onClick={handleResendVerification}
              disabled={resendingEmail}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-bold text-amber-900 shadow-2xs hover:bg-amber-100/50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <EnvelopeIcon className="h-4 w-4 text-amber-700" />
              <span>{resendingEmail ? "Enviando…" : "Reenviar enlace"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── BANNER DE CONTRATACIÓN PENDIENTE (SI EXISTE) ─── */}
      {(dbPendingSub || pendingIntent) && (
        <div className="rounded-3xl border-2 border-amber-400 bg-amber-50/90 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs">
              <ShoppingBagIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-950">
                  Tienes una contratación pendiente por completar
                </h3>
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900 uppercase">
                  Pago Pendiente
                </span>
              </div>
              <p className="text-xs text-amber-900 mt-1">
                Membresía seleccionada:{" "}
                <strong>{activePendingPlanName}</strong> por{" "}
                <strong>${activePendingPrice.toFixed(2)} MXN / mes</strong>{" "}
                a través de Mercado Pago.
              </p>

              {conflictInfo?.has_active && conflictInfo.message && (
                <div
                  className={`mt-2.5 rounded-xl border p-2.5 text-xs flex items-start gap-2 ${
                    conflictInfo.conflict_type === "upgrade"
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : "border-blue-200 bg-blue-100/70 text-blue-900"
                  }`}
                >
                  {conflictInfo.conflict_type === "upgrade" ? (
                    <BoltIcon className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  ) : (
                    <CalendarDaysIcon className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold text-[10px] uppercase tracking-wider">
                      {conflictInfo.conflict_type === "upgrade"
                        ? "⚡ Mejora de Membresía (Upgrade)"
                        : "📅 Activación Programada"}
                    </p>
                    <p className="mt-0.5 leading-relaxed">
                      {conflictInfo.message}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handlePayPending}
              disabled={payingPending || cancellingPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <CreditCardIcon className="h-4 w-4" />
              <span>
                {payingPending ? "Conectando…" : "Pagar con Mercado Pago →"}
              </span>
            </button>
            <button
              onClick={handleCancelPending}
              disabled={payingPending || cancellingPending}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:text-rose-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancellingPending ? "Cancelando…" : "Cancelar Solicitud"}
            </button>
          </div>
        </div>
      )}

      {/* Alertas del sistema */}
      <FeedbackAlert
        message={feedbackMsg}
        onDismiss={() => setFeedbackMsg(null)}
      />

      {/* ─── ENCABEZADO EJECUTIVO ─── */}
      <div className="rounded-3xl border border-gray-200 bg-linear-to-br from-slate-900 to-blue-950 p-6 sm:p-8 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 border border-blue-400/30 px-3 py-1 text-[11px] font-semibold text-blue-300 mb-3">
            <BuildingOffice2Icon className="h-3.5 w-3.5" />
            <span>Panel Central de Clientes</span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Bienvenido, {profile?.company_name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Gestiona tus productos contratados, configura tus integraciones y da
            seguimiento a tus membresías desde este portal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/portal/crm"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition-colors"
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4" />
            <span>Ir al Módulo CRM</span>
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ─── ESTADO DE PRODUCTOS DISPONIBLES Y CONTRATADOS ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
            Tus Productos y Servicios
          </h2>
          <Link
            href="/landingpage/crm"
            className="text-xs font-bold text-blue-600 hover:text-blue-800"
          >
            Ver catálogo completo →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tarjeta Producto: CRM WhatsApp */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-600" />
                </div>

                {crmSub ? (
                  <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold uppercase flex items-center gap-1">
                    <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                    <span>
                      {crmSub.status === "trial"
                        ? "Prueba Gratuita"
                        : crmSub.plan_name}
                    </span>
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 text-gray-600 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                    Sin membresía activa
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold text-gray-900">
                CRM WhatsApp Omnicanal
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Centraliza las conversaciones de WhatsApp Business, asigna
                múltiples agentes y automatiza respuestas 24/7 con IA.
              </p>

              {crmSub && (
                <div className="mt-4 p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 space-y-1">
                  <p>
                    Plan: <strong>{crmSub.plan_name}</strong>
                  </p>
                  <p className="text-[11px] text-blue-700">
                    Vence:{" "}
                    <strong>
                      {new Date(crmSub.current_period_end).toLocaleDateString(
                        "es-MX",
                      )}
                    </strong>{" "}
                    ({crmSub.days_remaining} días restantes)
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <Link
                href="/portal/crm"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
              >
                <span>Gestionar CRM WhatsApp</span>
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Tarjeta: Proyectos a la Medida (Automatización, Web, Modelos IA) */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-2xl bg-purple-50 flex items-center justify-center">
                  <CommandLineIcon className="h-5 w-5 text-purple-600" />
                </div>
                <span className="rounded-full bg-purple-100 text-purple-800 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                  Bajo Demanda
                </span>
              </div>

              <h3 className="text-lg font-bold text-gray-900">
                Soluciones de Software y Automatización
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Flujos automatizados con n8n y Airflow, diseño de sitios web
                empresariales y entrenamiento de modelos de inteligencia
                artificial a la medida.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
              <a
                href="https://wa.me/5213141560219?text=Hola,%20solicito%20informaci%C3%B3n%20sobre%20un%20proyecto%20personalizado."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span>Cotizar Proyecto por WhatsApp</span>
                <ArrowRightIcon className="h-3.5 w-3.5 text-gray-400" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── RESUMEN RÁPIDO DE FACTURACIÓN ─── */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-700 shrink-0">
            <CreditCardIcon className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">
              Facturación y Vigencias
            </h4>
            <p className="text-xs text-gray-500">
              {subscriptions.length > 0
                ? `Tienes ${subscriptions.length} registro(s) de membresías en tu cuenta.`
                : "No cuentas con membresías activas registradas."}
            </p>
          </div>
        </div>

        <Link
          href="/portal/billing"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
        >
          <span>Ver detalle de pagos</span>
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
