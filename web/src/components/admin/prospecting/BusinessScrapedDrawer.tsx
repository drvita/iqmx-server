'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  XMarkIcon,
  GlobeAltIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  SparklesIcon,
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { ProspectingBusinessDetail } from './types';

interface BusinessScrapedDrawerProps {
  business: ProspectingBusinessDetail | null;
  onClose: () => void;
  loading: boolean;
  mailtrapConfigured?: boolean;
}

export const BusinessScrapedDrawer: React.FC<BusinessScrapedDrawerProps> = ({
  business,
  onClose,
  loading,
  mailtrapConfigured = true,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Cerrar al hacer clic en el backdrop fuera del panel
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!business && !loading) return null;

  // Mensaje genérico inicial pre-cargado para el primer contacto manual del vendedor por WhatsApp
  const waFirstMessage = `Hola, un gusto saludarte. Notamos tu negocio ${business?.name || ''} en ${business?.municipality || 'Colima'} y nos gustaría presentarte una solución para digitalizar tu atención a clientes y citas automáticas por WhatsApp. ¿Con quién tendríamos el gusto de conversar?`;

  const handleOpenWhatsApp = () => {
    if (!business?.phone) return;
    const cleanPhone = business.phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waFirstMessage)}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = async () => {
    if (!business?.id || !business.email || !mailtrapConfigured) return;
    setSendingEmail(true);
    setEmailFeedback(null);
    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/prospecting/businesses/${business.id}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al enviar correo');
      }
      setEmailFeedback({
        type: 'success',
        message: `Correo enviado exitosamente a ${business.email}`,
      });
    } catch (err: unknown) {
      setEmailFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'No se pudo enviar el correo.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 overflow-hidden bg-gray-900/40 backdrop-blur-xs flex justify-end transition-opacity"
    >
      <div
        ref={drawerRef}
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
      >
        {/* Cabecera del Panel */}
        <div className="p-5 border-b border-gray-200 flex items-start justify-between bg-gray-50/70">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                ID DENUE: {business?.denue_id}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  (business?.total_score ?? 0) >= 70
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                Score Total: {business?.total_score}/100
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                (DENUE: {business?.denue_score} + Digital: {business?.digital_score})
              </span>
            </div>
            <h2 className="text-base font-bold text-gray-900 mt-1 truncate max-w-md">
              {business?.name}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {business?.scian_activity || 'Giro comercial'} • {business?.municipality || 'Colima'}, Col.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors cursor-pointer"
            title="Cerrar panel"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-gray-400">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span className="text-xs">Cargando análisis comercial…</span>
            </div>
          ) : business ? (
            <>
              {/* Sección 0: Acción Rápida de Contacto (Decisión del Vendedor) */}
              <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-2xs space-y-3">
                <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Acciones de Contacto Comercial
                </p>

                {/* Feedback del envío de email */}
                {emailFeedback && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                      emailFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {emailFeedback.type === 'success' ? (
                      <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <ExclamationCircleIcon className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <span>{emailFeedback.message}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  {/* Botón WhatsApp */}
                  {business.phone ? (
                    <button
                      onClick={handleOpenWhatsApp}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer flex-1"
                      title="Abrir WhatsApp en pestaña nueva con primer mensaje pre-cargado"
                    >
                      <ChatBubbleLeftRightIcon className="h-4 w-4" />
                      <span>Contactar por WhatsApp</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-400 cursor-not-allowed flex-1"
                      title="Sin número telefónico reportado"
                    >
                      <ChatBubbleLeftRightIcon className="h-4 w-4" />
                      <span>Sin WhatsApp</span>
                    </button>
                  )}

                  {/* Botón Enviar Email (Mailtrap) */}
                  {business.email && mailtrapConfigured ? (
                    business.email_sent_at ? (
                      <div className="flex-1 flex flex-col gap-1">
                        <button
                          onClick={handleSendEmail}
                          disabled={sendingEmail}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer w-full"
                          title="Hacer clic para reenviar si es estrictamente necesario"
                        >
                          <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                          <span>
                            {business.email_delivery_status === 'opened'
                              ? 'Correo Abierto'
                              : business.email_delivery_status === 'delivered'
                              ? 'Correo Entregado'
                              : business.email_delivery_status === 'clicked'
                              ? 'Enlace Clickeado'
                              : 'Correo Enviado'}
                          </span>
                        </button>
                        <span className="text-[10px] text-gray-500 text-center">
                          Enviado el {new Date(business.email_sent_at).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={handleSendEmail}
                        disabled={sendingEmail}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer flex-1 disabled:opacity-60 disabled:cursor-wait"
                        title="Enviar propuesta por correo electrónico con plantilla oficial de Mailtrap"
                      >
                        {sendingEmail ? (
                          <>
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Enviando…</span>
                          </>
                        ) : (
                          <>
                            <PaperAirplaneIcon className="h-4 w-4" />
                            <span>Enviar Propuesta Email</span>
                          </>
                        )}
                      </button>
                    )
                  ) : (
                    <button
                      disabled
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-400 cursor-not-allowed flex-1"
                      title={
                        !business.email
                          ? 'Sin correo electrónico reportado'
                          : 'Plantilla de Mailtrap no configurada en el servidor'
                      }
                    >
                      <EnvelopeIcon className="h-4 w-4" />
                      <span>{!business.email ? 'Sin Email' : 'Email no configurado'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sección 1: Análisis Comercial para el Equipo de Ventas */}
              {business.llm_analysis ? (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <SparklesIcon className="h-4 w-4 text-indigo-600" />
                      <span>Análisis para el Equipo de Ventas</span>
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 uppercase">
                      {business.status}
                    </span>
                  </div>

                  {/* Diagnóstico Ejecutivo */}
                  <div className="bg-white p-3 rounded-lg border border-indigo-100 text-xs text-gray-700 leading-relaxed shadow-2xs">
                    <p className="font-bold text-gray-900 text-[11px] uppercase tracking-wider mb-1">
                      Diagnóstico del Negocio:
                    </p>
                    <p>{business.llm_analysis.internal_diagnosis || 'Sin diagnóstico disponible.'}</p>
                  </div>

                  {/* Instrucción de Acción Comercial */}
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-xs text-emerald-900 shadow-2xs">
                    <p className="font-bold text-emerald-950 text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1">
                      <ShieldCheckIcon className="h-4 w-4 text-emerald-700" />
                      <span>Estrategia de Venta Recomendada:</span>
                    </p>
                    <p className="font-medium">
                      {business.llm_analysis.sales_action_recommendation || 'Proceder con contacto estándar.'}
                    </p>
                  </div>

                  {/* Oportunidades Concretas Detectadas */}
                  {business.llm_analysis.opportunities && (
                    <div className="space-y-1.5 text-xs pt-1">
                      <p className="text-[11px] font-bold text-indigo-900 uppercase">
                        Servicios aplicables a proponer:
                      </p>
                      {business.llm_analysis.opportunities.website_development?.applicable && (
                        <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs">
                          <span className="font-semibold text-blue-700">• Desarrollo Web: </span>
                          <span className="text-gray-600">
                            {business.llm_analysis.opportunities.website_development.reason_for_sales_team}
                          </span>
                        </div>
                      )}
                      {business.llm_analysis.opportunities.crm_whatsapp?.applicable && (
                        <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs">
                          <span className="font-semibold text-emerald-700">• CRM WhatsApp: </span>
                          <span className="text-gray-600">
                            {business.llm_analysis.opportunities.crm_whatsapp.reason_for_sales_team}
                          </span>
                        </div>
                      )}
                      {business.llm_analysis.opportunities.automated_booking?.applicable && (
                        <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-2xs">
                          <span className="font-semibold text-indigo-700">• Agenda Online: </span>
                          <span className="text-gray-600">
                            {business.llm_analysis.opportunities.automated_booking.reason_for_sales_team}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Sección 2: Canales de Contacto Verificados */}
              <div className="rounded-xl border border-gray-200 p-4 bg-white space-y-3">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Canales de Contacto Disponibles
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2 text-gray-800">
                    <PhoneIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{business.phone || 'Sin teléfono reportado'}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-800 truncate">
                    <EnvelopeIcon className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="truncate">{business.email || 'Sin correo reportado'}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-800 col-span-2 truncate">
                    <GlobeAltIcon className="h-4 w-4 text-amber-600 shrink-0" />
                    {business.website_url ? (
                      <a
                        href={business.website_url.startsWith('http') ? business.website_url : `https://${business.website_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate"
                      >
                        {business.website_url}
                      </a>
                    ) : (
                      <span className="text-gray-400 italic">Sin sitio web oficial</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sección 3: Ubicación y Google Maps */}
              <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50 space-y-3">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPinIcon className="h-4 w-4 text-blue-600" />
                  <span>Ubicación Física (Visita de Campo)</span>
                </h3>

                <p className="text-xs text-gray-700">
                  <strong>Dirección:</strong>{' '}
                  {[business.street, business.neighborhood, business.municipality, business.state]
                    .filter(Boolean)
                    .join(', ') || 'No especificada'}
                </p>

                {business.latitude && business.longitude && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors shadow-2xs"
                  >
                    <span>Abrir en Google Maps</span>
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
