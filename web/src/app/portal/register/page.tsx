'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

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

      router.push('/portal/dashboard');
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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-gray-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block">
          <Image
            src="/logo.png"
            alt="IQISSMexico Logo"
            width={140}
            height={44}
            className="h-10 w-auto mx-auto"
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
                  minLength={6}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 text-sm transition-colors"
                />
              </div>
            </div>

            {/* Aceptación obligatoria de Aviso de Privacidad y Términos */}
            <div className="pt-2">
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
              disabled={loading}
              className="w-full mt-4 flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
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
  );
}
