'use client';

import React, { useState, useEffect } from 'react';
import { CustomerWebhookConfig, FeedbackMessage, PingResult } from './types';

interface WebhookConfigSectionProps {
  webhookConfig: CustomerWebhookConfig | null;
  getHeaders: () => Record<string, string>;
  onRefreshData: () => Promise<void>;
  onFeedback: (msg: FeedbackMessage | null) => void;
}

export default function WebhookConfigSection({
  webhookConfig,
  getHeaders,
  onRefreshData,
  onFeedback,
}: WebhookConfigSectionProps) {
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [webhookSecretInput, setWebhookSecretInput] = useState('');
  const [webhookActiveInput, setWebhookActiveInput] = useState(true);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Sincronizar estado local al recibir configuración del backend
  useEffect(() => {
    if (webhookConfig) {
      const timer = setTimeout(() => {
        setWebhookUrlInput(webhookConfig.url || '');
        setWebhookSecretInput(webhookConfig.secret_token || '');
        setWebhookActiveInput(webhookConfig.is_active ?? true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [webhookConfig]);

  // Generar clave secreta aleatoria segura directamente en el cliente
  const handleGenerateRandomSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(32);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < 32; i++) {
      result += chars[randomValues[i] % chars.length];
    }
    setWebhookSecretInput(result);
    onFeedback({
      type: 'success',
      text: 'Nueva clave generada en el campo. Haz clic en "Guardar Configuración" para aplicarla.',
    });
  };

  // Guardar configuración del webhook
  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWebhook(true);
    onFeedback(null);

    try {
      const res = await fetch('/api/portal/webhook/config', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          url: webhookUrlInput.trim() || null,
          secret_token: webhookSecretInput.trim() || '',
          is_active: webhookActiveInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al guardar la configuración de conexión.');
      }

      onFeedback({
        type: 'success',
        text: 'La configuración de conexión con tu sistema se guardó correctamente.',
      });
      await onRefreshData();
    } catch (err: unknown) {
      onFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al guardar la configuración.',
      });
    } finally {
      setSavingWebhook(false);
    }
  };

  // Probar conexión con ping de prueba
  const handleTestPing = async () => {
    setTestingPing(true);
    setPingResult(null);

    try {
      const res = await fetch('/api/portal/webhook/test-ping', {
        method: 'POST',
        headers: getHeaders(),
      });

      const data = await res.json();
      setPingResult(data);
      await onRefreshData();
    } catch (err: unknown) {
      setPingResult({
        success: false,
        latency_ms: 0,
        message:
          err instanceof Error
            ? err.message
            : 'No fue posible establecer comunicación con la dirección web indicada.',
      });
    } finally {
      setTestingPing(false);
    }
  };

  // Copiar clave al portapapeles
  const copySecretToClipboard = () => {
    if (!webhookSecretInput) return;
    navigator.clipboard.writeText(webhookSecretInput);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2500);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="pb-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">
          Enlace de Conexión a tu Sistema o CRM
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-2xl">
          Indica la dirección web de tu sistema donde deseas recibir los mensajes y notificaciones de WhatsApp. Todas tus líneas conectadas reenviarán su información a este destino.
        </p>
      </div>

      <form onSubmit={handleSaveWebhook} className="mt-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Campo Dirección Web con Prefijo POST */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Dirección Web de Recepción
            </label>
            <div className="mt-1.5 flex rounded-lg shadow-xs">
              <span className="inline-flex items-center px-3.5 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-700 font-mono text-xs font-bold tracking-wider select-none">
                POST
              </span>
              <input
                type="url"
                required
                value={webhookUrlInput}
                onChange={(e) => setWebhookUrlInput(e.target.value)}
                placeholder="https://crm.tuempresa.com/api/webhooks/whatsapp"
                className="block w-full rounded-r-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 text-sm font-mono transition-colors"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Las notificaciones de cada evento se despachan mediante peticiones HTTP POST con carga útil en formato JSON. Se requiere certificado seguro HTTPS.
            </p>
          </div>

          {/* Campo Clave Secreta Editable y Opcional */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Clave Secreta de Seguridad
              </label>
              <span className="text-[11px] text-gray-500 font-medium">Opcional</span>
            </div>
            <div className="mt-1.5 flex items-center space-x-2">
              <input
                type="text"
                value={webhookSecretInput}
                onChange={(e) => setWebhookSecretInput(e.target.value)}
                placeholder="Pega la clave de tu CRM o déjala vacía"
                className="block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2 text-gray-900 placeholder-gray-400 text-xs font-mono focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
              />
              <button
                type="button"
                onClick={handleGenerateRandomSecret}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 px-3 py-2 rounded-lg text-xs font-medium border border-gray-300 transition-colors whitespace-nowrap cursor-pointer"
                title="Generar clave aleatoria automáticamente"
              >
                Generar
              </button>
              {webhookSecretInput && (
                <button
                  type="button"
                  onClick={copySecretToClipboard}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg text-xs font-medium border border-gray-300 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {copiedSecret ? '¡Copiado!' : 'Copiar'}
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Si tu CRM ya incluye el token de verificación en la dirección web, puedes dejar este campo vacío. Si tu CRM solicita autenticación, ingresa la clave aquí y se enviará como token de autorización.
            </p>
          </div>

          {/* Interruptor de Reenvío */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Reenvío de Notificaciones
            </label>
            <div className="mt-2.5 flex items-center space-x-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={webhookActiveInput}
                  onChange={(e) => setWebhookActiveInput(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <span className="text-sm font-medium text-gray-700">
                {webhookActiveInput ? 'Reenvío Activo' : 'Reenvío Pausado'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={savingWebhook}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {savingWebhook ? 'Guardando...' : 'Guardar Configuración'}
          </button>

          <button
            type="button"
            onClick={handleTestPing}
            disabled={testingPing || !webhookUrlInput}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-5 py-2.5 rounded-lg text-sm font-semibold border border-gray-300 transition-colors disabled:opacity-40 cursor-pointer"
          >
            {testingPing ? 'Comprobando conexión...' : 'Probar Conexión'}
          </button>
        </div>
      </form>

      {/* Resultado de la Prueba de Conexión */}
      {pingResult && (
        <div
          className={`mt-6 p-4 rounded-xl text-sm border ${
            pingResult.success
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              {pingResult.success ? '✓ Conexión establecida correctamente' : '✗ No se pudo conectar con tu sistema'}
            </span>
            <span className="text-xs font-mono">{pingResult.latency_ms} ms</span>
          </div>
          <p className="mt-1 text-xs opacity-90">{pingResult.message}</p>
        </div>
      )}
    </div>
  );
}
