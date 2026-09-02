'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardHeader from './components/DashboardHeader';
import FeedbackAlert from './components/FeedbackAlert';
import WhatsAppAccountsSection from './components/WhatsAppAccountsSection';
import WebhookConfigSection from './components/WebhookConfigSection';
import DeliveryDiagnosticSection from './components/DeliveryDiagnosticSection';
import PortalLoader from '@/components/PortalLoader';
import {
  CustomerProfile,
  WhatsAppNumber,
  CustomerWebhookConfig,
  FeedbackMessage,
} from './components/types';

export default function PortalDashboardPage() {
  const router = useRouter();

  // Estados de datos centrales
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [webhookConfig, setWebhookConfig] = useState<CustomerWebhookConfig | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<FeedbackMessage | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Helper de cabeceras seguras con token JWT
  const getHeaders = useCallback((): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('iqmx_portal_token') : null;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  // Cargar datos del panel de control
  const loadDashboardData = useCallback(async () => {
    const headers = getHeaders();

    try {
      // 1. Verificación y obtención de perfil
      const resMe = await fetch('/api/portal/auth/me', { headers });
      if (resMe.status === 401) {
        localStorage.removeItem('iqmx_portal_token');
        localStorage.removeItem('iqmx_portal_customer');
        router.push('/portal/login');
        return;
      }

      if (resMe.ok) {
        const dataMe = await resMe.json();
        setProfile(dataMe);
      }

      // 2. Líneas oficiales vinculadas
      const resNum = await fetch('/api/portal/whatsapp/numbers', { headers });
      if (resNum.ok) {
        const dataNum = await resNum.json();
        setNumbers(dataNum);
      }

      // 3. Configuración de enlace y destino
      const resWh = await fetch('/api/portal/webhook/config', { headers });
      if (resWh.ok) {
        const dataWh = await resWh.json();
        setWebhookConfig(dataWh);
      }
    } catch {
      setFeedbackMsg({
        type: 'error',
        text: 'Error de comunicación al actualizar la información del panel.',
      });
    } finally {
      setLoadingInitial(false);
    }
  }, [getHeaders, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDashboardData]);

  if (loadingInitial && !profile) {
    return <PortalLoader message="Cargando panel de control..." />;
  }

  return (
    <div className="space-y-8 font-sans text-gray-900">
      {/* 1. Encabezado y Métricas Principales */}
      <DashboardHeader
        profile={profile}
        numbers={numbers}
        webhookConfig={webhookConfig}
      />

      {/* 2. Notificaciones y Alertas del Sistema */}
      <FeedbackAlert
        message={feedbackMsg}
        onDismiss={() => setFeedbackMsg(null)}
      />

      {/* 3. Gestión de Líneas Oficiales de WhatsApp */}
      <WhatsAppAccountsSection
        numbers={numbers}
        getHeaders={getHeaders}
        onRefreshData={loadDashboardData}
        onFeedback={setFeedbackMsg}
      />

      {/* 4. Enlace de Conexión a tu Sistema o CRM */}
      <WebhookConfigSection
        webhookConfig={webhookConfig}
        getHeaders={getHeaders}
        onRefreshData={loadDashboardData}
        onFeedback={setFeedbackMsg}
      />

      {/* 5. Monitoreo de Sincronización y Diagnóstico */}
      <DeliveryDiagnosticSection
        webhookConfig={webhookConfig}
      />
    </div>
  );
}
