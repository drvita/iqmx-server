'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WhatsAppNumber, WhatsAppCredentials, FeedbackMessage } from './types';

// Tipos para Facebook SDK
export interface FBAuthResponse {
  authResponse?: {
    code: string;
    accessToken?: string;
    userID?: string;
  };
  status?: string;
}

export interface FacebookSDK {
  init: (params: {
    appId: string;
    autoLogAppEvents: boolean;
    xfbml: boolean;
    version: string;
  }) => void;
  login: (
    callback: (response: FBAuthResponse) => void,
    params: Record<string, unknown>
  ) => void;
}

declare global {
  interface Window {
    FB?: FacebookSDK;
    fbAsyncInit?: () => void;
  }
}

interface WhatsAppAccountsSectionProps {
  numbers: WhatsAppNumber[];
  getHeaders: () => Record<string, string>;
  onRefreshData: () => Promise<void>;
  onFeedback: (msg: FeedbackMessage | null) => void;
}

export default function WhatsAppAccountsSection({
  numbers,
  getHeaders,
  onRefreshData,
  onFeedback,
}: WhatsAppAccountsSectionProps) {
  const [connectingMeta, setConnectingMeta] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [loadingCredsId, setLoadingCredsId] = useState<number | null>(null);
  const [credentialsModal, setCredentialsModal] = useState<WhatsAppCredentials | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Inicializar SDK oficial de Meta v26.0
  useEffect(() => {
    if (window.FB) return;

    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID || '1560064249064360',
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v26.0',
      });
    };

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/es_LA/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    }
  }, []);

  // Intercambiar código devuelto por Meta con el servidor
  const processExchangeCode = useCallback(
    async (code: string, wabaId?: string, phoneNumberId?: string) => {
      setConnectingMeta(true);
      onFeedback(null);

      try {
        const res = await fetch('/api/portal/whatsapp/exchange', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            code,
            waba_id: wabaId,
            phone_number_id: phoneNumberId,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Error al vincular el número con el servidor central.');
        }

        onFeedback({
          type: 'success',
          text: `¡Línea ${data.display_phone_number || data.phone_number_id} conectada exitosamente! Si tienes configurada la URL de aprovisionamiento, se sincronizará automáticamente con tu CRM.`,
        });

        await onRefreshData();
      } catch (err: unknown) {
        onFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : 'Error inesperado durante la vinculación.',
        });
      } finally {
        setConnectingMeta(false);
      }
    },
    [getHeaders, onRefreshData, onFeedback]
  );

  // Escuchar mensaje devuelto por ventana emergente
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data === 'string' && event.data.includes('WA_EMBEDDED_SIGNUP')) {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event === 'WA_EMBEDDED_SIGNUP' && parsed.data?.code) {
            void processExchangeCode(
              parsed.data.code,
              parsed.data.waba_id,
              parsed.data.phone_number_id
            );
          }
        } catch (e) {
          console.error('Error parseando mensaje de Meta:', e);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [processExchangeCode]);

  // Lanzar Embedded Signup (SDK FB.login con fallback a OAuth directo)
  const launchWhatsAppSignup = () => {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID || '1560064249064360';
    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID || '1361536738927806';

    if (window.FB) {
      try {
        window.FB.login(
          (response: FBAuthResponse) => {
            if (response.authResponse?.code) {
              void processExchangeCode(response.authResponse.code);
            } else {
              console.warn('FB.login cancelado o sin código. Abriendo ventana directa...');
              launchDirectOAuthPopup(appId, configId);
            }
          },
          {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
              setup: {},
              featureType: '',
              sessionInfoVersion: '3',
            },
          }
        );
        return;
      } catch (sdkErr) {
        console.warn('Excepción en FB.login, recurriendo a ventana directa:', sdkErr);
      }
    }

    launchDirectOAuthPopup(appId, configId);
  };

  // Apertura de ventana emergente directa con Meta OAuth
  const launchDirectOAuthPopup = (appId: string, configId: string) => {
    const redirectUri = window.location.origin;
    const oauthUrl =
      `https://www.facebook.com/v26.0/dialog/oauth` +
      `?client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&config_id=${configId}` +
      `&response_type=code` +
      `&override_default_response_type=true`;

    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      oauthUrl,
      'MetaWhatsAppSignup',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=1`
    );
  };

  // Sincronizar línea manualmente al CRM
  const handleSyncWithCrm = async (numberId: number) => {
    setSyncingId(numberId);
    onFeedback(null);

    try {
      const res = await fetch(`/api/portal/whatsapp/numbers/${numberId}/provision`, {
        method: 'POST',
        headers: getHeaders(),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al aprovisionar la línea en el CRM.');
      }

      onFeedback({
        type: data.success ? 'success' : 'error',
        text: data.message || (data.success ? 'Línea aprovisionada correctamente en tu CRM.' : 'El CRM rechazó la solicitud.'),
      });
    } catch (err: unknown) {
      onFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al contactar con la URL de aprovisionamiento.',
      });
    } finally {
      setSyncingId(null);
    }
  };

  // Obtener credenciales para modal de configuración manual
  const handleOpenCredentials = async (numberId: number) => {
    setLoadingCredsId(numberId);
    onFeedback(null);

    try {
      const res = await fetch(`/api/portal/whatsapp/numbers/${numberId}/credentials`, {
        headers: getHeaders(),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al obtener credenciales de la línea.');
      }

      setCredentialsModal(data);
    } catch (err: unknown) {
      onFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'No fue posible cargar las credenciales.',
      });
    } finally {
      setLoadingCredsId(null);
    }
  };

  // Copiar token permanente al portapapeles
  const handleCopyToken = () => {
    if (!credentialsModal?.token) return;
    navigator.clipboard.writeText(credentialsModal.token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  // Desvincular número
  const handleDeleteNumber = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas desvincular esta línea telefónica de WhatsApp?')) {
      return;
    }

    setDeletingId(id);
    onFeedback(null);

    try {
      const res = await fetch(`/api/portal/whatsapp/numbers/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al desvincular el número.');
      }

      onFeedback({
        type: 'success',
        text: 'La línea fue desvinculada exitosamente.',
      });

      await onRefreshData();
    } catch (err: unknown) {
      onFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al desvincular la línea.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-gray-200 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Líneas Telefónicas de WhatsApp
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Conecta tus números de WhatsApp con opción de coexistencia para seguir usando la app en tu teléfono mientras se integran con tu CRM.
          </p>
        </div>

        <button
          type="button"
          onClick={launchWhatsAppSignup}
          disabled={connectingMeta}
          className="inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          <span>💬</span>
          <span>{connectingMeta ? 'Vinculando con Meta...' : 'Vincular Nueva Línea'}</span>
        </button>
      </div>

      {/* Tabla de Cuentas */}
      <div className="mt-6">
        {numbers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <p className="text-sm font-medium text-gray-600">
              No tienes ninguna línea de WhatsApp vinculada en este momento.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Haz clic en "Vincular Nueva Línea" para registrar tu número oficial con Meta.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Línea Telefónica</th>
                  <th className="px-4 py-3">ID de Teléfono</th>
                  <th className="px-4 py-3">ID de Cuenta (WABA)</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha de Alta</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {numbers.map((num) => (
                  <tr key={num.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-gray-900">
                      <div>
                        {num.display_phone_number || 'Línea Principal'}
                        {num.verified_name && (
                          <span className="block text-xs font-normal text-gray-500">
                            {num.verified_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-600">
                      {num.phone_number_id}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-600">
                      {num.waba_id}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        ● Conectado
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">
                      {new Date(num.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end space-x-2">
                        {/* Botón Sincronizar / Enviar al CRM */}
                        <button
                          type="button"
                          onClick={() => handleSyncWithCrm(num.id)}
                          disabled={syncingId === num.id}
                          className="text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          title="Aprovisionar y sincronizar esta línea en el CRM"
                        >
                          {syncingId === num.id ? 'Enviando...' : 'Enviar al CRM'}
                        </button>

                        {/* Botón Ver Credenciales */}
                        <button
                          type="button"
                          onClick={() => handleOpenCredentials(num.id)}
                          disabled={loadingCredsId === num.id}
                          className="text-xs font-medium text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                          title="Ver datos y token de acceso para configuración manual"
                        >
                          {loadingCredsId === num.id ? 'Cargando...' : 'Credenciales'}
                        </button>

                        {/* Botón Desvincular */}
                        <button
                          type="button"
                          onClick={() => handleDeleteNumber(num.id)}
                          disabled={deletingId === num.id}
                          className="text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          {deletingId === num.id ? 'Desvinculando...' : 'Desvincular'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Credenciales para Configuración Manual */}
      {credentialsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 sm:p-7 border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Credenciales de la Línea
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Utiliza estos datos para configurar manualmente tu CRM si lo requieres.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCredentialsModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs font-mono">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider font-sans mb-1">
                  ID de Cuenta de WhatsApp (wabaId)
                </label>
                <input
                  type="text"
                  readOnly
                  value={credentialsModal.waba_id}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-800 select-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider font-sans mb-1">
                  ID de Número Telefónico (phoneNumberId)
                </label>
                <input
                  type="text"
                  readOnly
                  value={credentialsModal.phone_number_id}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-800 select-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider font-sans mb-1">
                  Nombre Verificado y Número
                </label>
                <input
                  type="text"
                  readOnly
                  value={`${credentialsModal.verified_name || ''} (${credentialsModal.display_phone_number || ''})`}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-800 select-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider font-sans">
                    Token Permanente de Meta (token)
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="text-[11px] font-sans font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    {copiedToken ? '¡Copiado!' : 'Copiar Token'}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={3}
                  value={credentialsModal.token}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-800 select-all font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setCredentialsModal(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-xs font-semibold border border-gray-300 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
