'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cog6ToothIcon,
  BuildingOffice2Icon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import PortalLoader from '@/components/PortalLoader';
import { CustomerProfile } from '../dashboard/components/types';

export default function PortalSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const getHeaders = useCallback((): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('iqmx_portal_token') : null;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  useEffect(() => {
    const headers = getHeaders();
    fetch('/api/portal/auth/me', { headers })
      .then((r) => {
        if (r.status === 401) {
          router.push('/portal/login');
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (data) setProfile(data);
      })
      .finally(() => setLoading(false));
  }, [getHeaders, router]);

  if (loading) {
    return <PortalLoader message="Cargando configuración de la cuenta..." />;
  }

  return (
    <div className="space-y-8 font-sans text-gray-900 max-w-4xl">
      {/* Cabecera */}
      <div className="border-b border-gray-200 pb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 mb-2">
          <Cog6ToothIcon className="h-4 w-4 text-gray-600" />
          <span>Configuración</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
          Perfil de la Empresa
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Información legal, datos de contacto de tu organización y estado de la cuenta.
        </p>
      </div>

      {profile && (
        <div className="space-y-6">
          {/* Tarjeta de Información General */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <BuildingOffice2Icon className="h-5 w-5 text-blue-600" />
              <span>Datos Fiscales y Comerciales</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div>
                <span className="text-gray-400 block font-medium">Nombre o Razón Social</span>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{profile.company_name}</p>
              </div>

              <div>
                <span className="text-gray-400 block font-medium">RFC / Identificación Fiscal</span>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {profile.tax_id || 'No registrado'}
                </p>
              </div>

              <div>
                <span className="text-gray-400 block font-medium">Contacto Principal</span>
                <p className="text-sm font-bold text-gray-900 mt-0.5 flex items-center gap-1.5">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                  <span>{profile.contact_name}</span>
                </p>
              </div>

              <div>
                <span className="text-gray-400 block font-medium">Correo Electrónico de Cuenta</span>
                <p className="text-sm font-bold text-gray-900 mt-0.5 flex items-center gap-1.5">
                  <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                  <span>{profile.email}</span>
                </p>
              </div>

              <div>
                <span className="text-gray-400 block font-medium">Teléfono Registrado</span>
                <p className="text-sm font-bold text-gray-900 mt-0.5 flex items-center gap-1.5">
                  <PhoneIcon className="h-4 w-4 text-gray-400" />
                  <span>{profile.phone || 'No registrado'}</span>
                </p>
              </div>

              <div>
                <span className="text-gray-400 block font-medium">Estado de la Cuenta</span>
                <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                  <ShieldCheckIcon className="h-3 w-3 text-emerald-600" />
                  <span>{profile.is_active ? 'Activa y Verificada' : 'Suspendida'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Cumplimiento Legal */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
              <DocumentTextIcon className="h-5 w-5 text-blue-600" />
              <span>Privacidad y Cumplimiento Legal</span>
            </h2>

            <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
              <p>
                Tu cuenta opera bajo las políticas de protección de datos personales vigentes (LFPDPPP) y los estándares de seguridad de WhatsApp Business API.
              </p>
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-500">
                <span>Consentimiento aceptado al registrarse · Auditoría IP registrada con éxito.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
