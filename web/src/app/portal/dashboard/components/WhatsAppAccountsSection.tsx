'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WhatsAppNumber, FeedbackMessage } from './types';

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
        const exchangeRes = await fetch('/api/portal/whatsapp/exchange', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            code,
            waba_id: wabaId,
            phone_number_id: phoneNumberId,
          }),
        });

        const exchangeData = await exchangeRes.json();
        if (!exchangeRes.ok) {
          throw new Error(exchangeData.detail || 'Fallo en la conexión del número con Meta.');
        }

        onFeedback({
          type: 'success',
          text: `Se vinculó exitosamente el número ${exchangeData.display_phone_number || exchangeData.phone_number_id}.`,
        });
        await onRefreshData();
      } catch (err: unknown) {
        onFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : 'Error al conectar el número con Meta.',
        });
      } finally {
        setConnectingMeta(false);
        sessionStorage.removeItem('meta_waba_id');
        sessionStorage.removeItem('meta_phone_number_id');
      }
    },
    [getHeaders, onRefreshData, onFeedback]
  );

  // Escuchar mensajes devueltos por el asistente de Meta
  useEffect(() => {
    const messageListener = (event: MessageEvent) => {
      if (typeof event.origin === 'string' && event.origin.includes('facebook.com')) {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data?.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
            sessionStorage.setItem('meta_waba_id', data.data?.waba_id || '');
            sessionStorage.setItem('meta_phone_number_id', data.data?.phone_number_id || '');
          }
        } catch {
          // Ignorar mensajes ajenos a JSON
        }
      }
    };

    window.addEventListener('message', messageListener);
    return () => window.removeEventListener('message', messageListener);
  }, []);

  // Detectar retorno de código por redirección en URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      const wabaId = sessionStorage.getItem('meta_waba_id') || undefined;
      const phoneNumberId = sessionStorage.getItem('meta_phone_number_id') || undefined;
      const timer = setTimeout(() => {
        void processExchangeCode(code, wabaId, phoneNumberId);
      }, 0);
      window.history.replaceState({}, document.title, window.location.pathname);
      return () => clearTimeout(timer);
    }
  }, [processExchangeCode]);

  // Diálogo oficial directo de Meta OAuth
  const launchDirectMetaPopup = useCallback(() => {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID || '1560064249064360';
    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID || '968187492720390';
    const redirectUri = window.location.origin + '/portal/dashboard';
    const extras = JSON.stringify({
      featureType: 'whatsapp_business_app_onboarding',
      setup: {},
      sessionInfoVersion: '2',
    });

    const oauthUrl = `https://www.facebook.com/v26.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&config_id=${configId}&extras=${encodeURIComponent(extras)}`;

    const width = 640;
    const height = 740;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      oauthUrl,
      'MetaWhatsAppSignup',
      `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
    );

    if (!popup) {
      onFeedback({
        type: 'error',
        text: 'Tu navegador bloqueó la ventana emergente. Por favor permite ventanas emergentes para este sitio web.',
      });
      setConnectingMeta(false);
      return;
    }

    onFeedback({
      type: 'success',
      text: 'Se abrió la ventana oficial de Meta. Completa los pasos para conectar tu línea de WhatsApp.',
    });
  }, [onFeedback]);

  // Iniciar conexión con Meta
  const handleLaunchMetaSignup = () => {
    setConnectingMeta(true);
    onFeedback(null);

    // Si está en conexión HTTP local, recurrir a la ventana emergente directa
    if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
      launchDirectMetaPopup();
      return;
    }

    if (!window.FB) {
      launchDirectMetaPopup();
      return;
    }

    try {
      window.FB.login(
        (response: FBAuthResponse) => {
          if (response.authResponse?.code) {
            const code = response.authResponse.code;
            const wabaId = sessionStorage.getItem('meta_waba_id') || undefined;
            const phoneNumberId = sessionStorage.getItem('meta_phone_number_id') || undefined;
            void processExchangeCode(code, wabaId, phoneNumberId);
          } else {
            setConnectingMeta(false);
            onFeedback({
              type: 'error',
              text: 'Se canceló la autorización o no se concedieron los permisos solicitados por Meta.',
            });
          }
        },
        {
          config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID || '968187492720390',
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            featureType: 'whatsapp_business_app_onboarding',
            setup: {},
            sessionInfoVersion: '2',
          },
        }
      );
    } catch {
      launchDirectMetaPopup();
    }
  };

  // Desvincular línea telefónica
  const handleDeleteNumber = async (numberId: number) => {
    if (
      !confirm(
        '¿Deseas desvincular esta línea telefónica? Tu sistema dejará de recibir mensajes para este número.'
      )
    ) {
      return;
    }

    setDeletingId(numberId);
    try {
      const res = await fetch(`/api/portal/whatsapp/numbers/${numberId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'No se pudo desvincular la línea telefónica.');
      }

      onFeedback({ type: 'success', text: 'Línea telefónica desvinculada satisfactoriamente.' });
      await onRefreshData();
    } catch (err: unknown) {
      onFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al desvincular la línea telefónica.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Líneas Oficiales de WhatsApp
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-2xl">
            Conecta tus números de WhatsApp Business. Podrás recibir mensajes directamente en tu sistema sin perder el uso de la aplicación en tu celular.
          </p>
        </div>

        <button
          onClick={handleLaunchMetaSignup}
          disabled={connectingMeta}
          className="inline-flex items-center justify-center space-x-2 bg-[#1877F2] hover:bg-[#166fe5] text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>{connectingMeta ? 'Conectando con Meta...' : 'Conectar WhatsApp con Meta'}</span>
        </button>
      </div>

      {/* Listado de Números Conectados */}
      <div className="mt-6">
        {numbers.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
            <p className="text-gray-600 text-sm font-medium">No tienes ninguna línea telefónica conectada actualmente.</p>
            <p className="text-gray-500 text-xs mt-1">Haz clic en el botón azul para iniciar el proceso de vinculación oficial.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Número y Nombre Comercial</th>
                  <th className="px-4 py-3">Identificador de Línea</th>
                  <th className="px-4 py-3">Identificador de Cuenta</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha de Conexión</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {numbers.map((num) => (
                  <tr key={num.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-gray-900">
                        {num.display_phone_number || 'Línea de WhatsApp'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {num.verified_name || 'Nombre comercial verificado'}
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
                      <button
                        onClick={() => handleDeleteNumber(num.id)}
                        disabled={deletingId === num.id}
                        className="text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {deletingId === num.id ? 'Desvinculando...' : 'Desvincular'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
