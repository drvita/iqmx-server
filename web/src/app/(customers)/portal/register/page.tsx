'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getCheckoutIntent, CheckoutIntent } from '@/utils/checkoutIntent';
import { ShoppingBagIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/20/solid';
import { GuestGuard } from '@/components/AuthGuard';

export default function PortalRegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    tax_id: '',
    password: '',
    privacy_accepted: false,
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<CheckoutIntent | null>(null);

  // Validación de requisitos de contraseña
  const password = formData.password;
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const criteriaMetCount = [hasMinLength, hasUpper, hasLower, hasNumber].filter(Boolean).length;
  const isPasswordSecure = criteriaMetCount === 4;

  const getStrengthInfo = () => {
    if (!password) return { label: '', color: 'bg-gray-200', textCol: 'text-gray-400', width: '0%' };
    switch (criteriaMetCount) {
      case 1:
        return { label: 'Débil', color: 'bg-red-500', textCol: 'text-red-600', width: '25%' };
      case 2:
        return { label: 'Regular', color: 'bg-orange-500', textCol: 'text-orange-600', width: '50%' };
      case 3:
        return { label: 'Buena', color: 'bg-amber-500', textCol: 'text-amber-600', width: '75%' };
      case 4:
        return { label: 'Segura', color: 'bg-emerald-600', textCol: 'text-emerald-700', width: '100%' };
      default:
        return { label: '', color: 'bg-gray-200', textCol: 'text-gray-400', width: '0%' };
    }
  };
  const strength = getStrengthInfo();

  useEffect(() => {
    const intent = getCheckoutIntent();
    if (intent) {
      setPendingIntent(intent);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.privacy_accepted) {
      setErrorMsg('Debes leer y aceptar el Aviso de Privacidad y Términos de Servicio.');
      return;
    }

    if (!isPasswordSecure) {
      setErrorMsg('La contraseña no cumple con todos los requisitos de seguridad (8+ caracteres, mayúscula, minúscula y número).');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/portal/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Ocurrió un error durante el registro.');
      }

      // Guardar credenciales de sesión
      localStorage.setItem('iqmx_portal_token', data.access_token);
      localStorage.setItem('iqmx_portal_customer', JSON.stringify(data.customer));

      if (pendingIntent) {
        router.push('/portal/dashboard?pending_checkout=1');
      } else {
        router.push('/portal/dashboard');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Ocurrió un error inesperado al registrar la cuenta.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <GuestGuard role="customer">
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-gray-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center text-center">
        <Link href="/" className="inline-flex justify-center mb-2">
          <Image
            src="/logo.png"
            alt="IQISSMexico Logo"
            width={150}
            height={48}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Registro de Cliente Empresarial
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Conecta tus líneas de WhatsApp Business mediante Meta Tech Provider
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white border border-gray-200 py-8 px-6 shadow-md rounded-2xl sm:px-10">
          {errorMsg && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Nombre de la Empresa *
                </label>
                <input
                  type="text"
                  name="company_name"
                  required
                  value={formData.company_name}
                  onChange={handleChange}
                  placeholder="Mi Empresa S.A."
                  className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Contacto / Administrador *
                </label>
                <input
                  type="text"
                  name="contact_name"
                  required
                  value={formData.contact_name}
                  onChange={handleChange}
                  placeholder="Juan Pérez"
                  className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 text-sm transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contacto@miempresa.com"
                  className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Teléfono de Contacto
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+52 314 123 4567"
                  className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 text-sm transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  RFC / Tax ID (Opcional)
                </label>
                <input
                  type="text"
                  name="tax_id"
                  value={formData.tax_id}
                  onChange={handleChange}
                  placeholder="XAXX010101000"
                  className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Contraseña *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 8 caracteres"
                  className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 text-sm transition-colors"
                />
              </div>
            </div>

            {/* Indicador de Fortaleza y Requisitos de Contraseña */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Nivel de seguridad:</span>
                <span className={`font-bold ${strength.textCol}`}>
                  {strength.label || 'Ingresa una contraseña'}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${strength.color} transition-all duration-300`}
                  style={{ width: strength.width }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                  {hasMinLength ? (
                    <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-1.5 mr-1 flex-shrink-0" />
                  )}
                  <span>Mínimo 8 caracteres</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                  {hasUpper ? (
                    <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-1.5 mr-1 flex-shrink-0" />
                  )}
                  <span>Al menos 1 mayúscula (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLower ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                  {hasLower ? (
                    <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-1.5 mr-1 flex-shrink-0" />
                  )}
                  <span>Al menos 1 minúscula (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                  {hasNumber ? (
                    <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-1.5 mr-1 flex-shrink-0" />
                  )}
                  <span>Al menos 1 número (0-9)</span>
                </div>
              </div>
            </div>

            {/* Aceptación obligatoria de Aviso de Privacidad y Términos */}
            <div className="pt-1">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="privacy_accepted"
                  required
                  checked={formData.privacy_accepted}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1 cursor-pointer"
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  He leído y acepto expresamente el{' '}
                  <Link
                    href="/privacidad"
                    target="_blank"
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Aviso de Privacidad
                  </Link>{' '}
                  y los{' '}
                  <Link
                    href="/terminos"
                    target="_blank"
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Términos de Servicio
                  </Link>
                  . Se registrará la fecha y dirección IP con fines de auditoría legal (LFPDPPP).
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordSecure}
              title={!isPasswordSecure ? 'Cumple con los 4 requisitos de contraseña para continuar' : undefined}
              className="w-full mt-4 flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Creando cuenta...' : 'Crear Cuenta y Continuar'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 border-t border-gray-100 pt-5">
            ¿Ya tienes una cuenta registrada?{' '}
            <Link
              href="/portal/login"
              className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Inicia sesión aquí
            </Link>
          </div>
        </div>
      </div>
    </div>
  </GuestGuard>
);
}
