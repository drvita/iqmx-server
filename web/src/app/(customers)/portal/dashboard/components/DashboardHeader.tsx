'use client';

import React from 'react';
import { CustomerProfile, WhatsAppNumber, CustomerWebhookConfig } from './types';

interface DashboardHeaderProps {
  profile: CustomerProfile | null;
  numbers: WhatsAppNumber[];
  webhookConfig: CustomerWebhookConfig | null;
}

export default function DashboardHeader({
  profile,
  numbers,
  webhookConfig,
}: DashboardHeaderProps) {
  const isConnectionActive = Boolean(webhookConfig?.is_active && webhookConfig?.url);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
            Panel de Control
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
            {profile?.company_name || 'Mi Empresa'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Administrador responsable: <span className="font-semibold text-gray-800">{profile?.contact_name}</span> &middot; {profile?.email}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-xl text-center min-w-[130px]">
            <span className="text-xs text-gray-500 block font-medium">Líneas Conectadas</span>
            <span className="text-xl font-bold text-blue-600">{numbers.length}</span>
          </div>

          <div className="bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-xl text-center min-w-[130px]">
            <span className="text-xs text-gray-500 block font-medium">Estado del Enlace</span>
            <span className={`text-sm font-bold ${isConnectionActive ? 'text-green-600' : 'text-amber-600'}`}>
              {isConnectionActive ? 'Activo' : 'Pendiente'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
