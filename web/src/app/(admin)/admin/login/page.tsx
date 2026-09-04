'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShieldCheckIcon, KeyIcon } from '@heroicons/react/24/outline';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('iqmx_admin_token');
    if (token) {
      router.push('/admin/dashboard');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${apiUrl}/api/admin/auth/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.setup_required) {
          setSetupRequired(true);
        }
      })
      .catch(() => null);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Por favor complete todos los campos.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.detail || 'Credenciales administrativas incorrectas.');
        return;
      }

      localStorage.setItem('iqmx_admin_token', data.access_token);
      router.push('/admin/dashboard');
    } catch {
      setErrorMsg('Error de conexión con el servidor central.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-gray-900 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center text-center">
        <Link href="/" className="inline-flex justify-center mb-4">
          <Image
            src="/logo.png"
            alt="IQISSMexico Logo"
            width={150}
            height={48}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
          <ShieldCheckIcon className="h-4 w-4" />
          <span>Acceso Administrativo Central</span>
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
          Portal de Control IQMX
        </h2>
        <p className="mt-1 text-xs text-gray-600">
          Panel de gestión interna para clientes, CRM y membresías
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        {setupRequired && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            <div className="flex items-center gap-2 font-semibold">
              <KeyIcon className="h-4 w-4 text-amber-600" />
              <span>Configuración Inicial Requerida</span>
            </div>
            <p className="mt-1 text-amber-700">
              No existe ningún administrador registrado aún. Haz clic para crear el primer Super-Admin.
            </p>
            <Link
              href="/admin/setup"
              className="mt-2 inline-block font-bold text-amber-900 underline hover:text-amber-800"
            >
              Comenzar Onboarding Inicial →
            </Link>
          </div>
        )}

        <div className="bg-white border border-gray-200 py-8 px-6 shadow-md rounded-2xl sm:px-10">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@iqissmexico.com"
                className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 shadow-sm disabled:opacity-50 transition-colors"
            >
              {loading ? 'Validando…' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
