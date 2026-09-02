'use client';

import React from 'react';
import { CustomerWebhookConfig } from './types';

interface DeliveryDiagnosticSectionProps {
  webhookConfig: CustomerWebhookConfig | null;
}

export default function DeliveryDiagnosticSection({
  webhookConfig,
}: DeliveryDiagnosticSectionProps) {
  const getDeliveryStatusBadge = () => {
    if (webhookConfig?.last_delivery_status === 'delivered') {
      return <span className="text-green-600 font-semibold">● Entregado con éxito</span>;
    }
    if (webhookConfig?.last_delivery_status === 'failed') {
      return <span className="text-red-600 font-semibold">● Error en la recepción</span>;
    }
    return <span className="text-gray-500 font-normal">Sin actividad reciente</span>;
  };

  const getResponseStatusText = () => {
    if (!webhookConfig?.last_delivery_code) {
      return 'En espera de eventos';
    }
    if (webhookConfig.last_delivery_code >= 200 && webhookConfig.last_delivery_code < 300) {
      return `Respuesta exitosa &middot; Código ${webhookConfig.last_delivery_code}`;
    }
    return `Alerta en tu servidor &middot; Código ${webhookConfig.last_delivery_code}`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Monitoreo de Sincronización
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-2xl">
          Supervisa el estado y la respuesta en tiempo real de las notificaciones enviadas hacia tu sistema.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
          <span className="text-xs text-gray-500 block font-medium">
            Resultado del Último Envío
          </span>
          <div className="text-sm mt-1.5">{getDeliveryStatusBadge()}</div>
        </div>

        <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
          <span className="text-xs text-gray-500 block font-medium">
            Respuesta de tu Servidor
          </span>
          <span
            className="text-sm font-semibold text-gray-800 mt-1.5 block"
            dangerouslySetInnerHTML={{ __html: getResponseStatusText() }}
          />
        </div>

        <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
          <span className="text-xs text-gray-500 block font-medium">
            Fecha y Hora del Envío
          </span>
          <span className="text-sm font-semibold text-gray-800 mt-1.5 block">
            {webhookConfig?.last_delivery_at
              ? new Date(webhookConfig.last_delivery_at).toLocaleString()
              : 'Sin registros'}
          </span>
        </div>
      </div>
    </div>
  );
}
