'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { KeyIcon, LockClosedIcon } from '@heroicons/react/24/outline';

export default function AdminSetupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${apiUrl}/api/admin/auth/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.setup_required) {
          setIsAllowed(true);
        } else {
          setIsAllowed(false);
        }
      })
      .catch(() => setIsAllowed(false))
      .finally(() => setChecking(false));
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setErrorMsg('Por favor complete todos los campos.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.detail || 'Error al configurar el Super-Admin inicial.');
        return;
      }

      localStorage.setItem('iqmx_admin_token', data.access_token);
      router.push('/admin/dashboard');
    } catch {
      setErrorMsg('Error de red al comunicarse con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        <p className="text-xs">Verificando estado del sistema…</p>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 px-4 text-center text-gray-900 font-sans">
        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-4">
          <LockClosedIcon className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Registro Administrativo Cerrado</h2>
        <p className="mt-2 text-sm text-gray-600 max-w-sm">
          El sistema ya cuenta con administradores registrados. Por motivos de seguridad, el onboarding inicial está cerrado permanentemente.
        </p>
        <Link
          href="/admin/login"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Ir al Inicio de Sesión
        </Link>
      </div>
    );
  }

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
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
          <KeyIcon className="h-4 w-4 text-amber-600" />
          <span>Configuración Única del Sistema</span>
        </div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
          Crear Super-Admin Inicial
        </h2>
        <p className="mt-1 text-xs text-gray-600">
          Este formulario solo se ejecuta una vez. Al completarse, el registro público se bloqueará permanentemente.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white border border-gray-200 py-8 px-6 shadow-md rounded-2xl sm:px-10">
          <form className="space-y-4" onSubmit={handleSetup}>
            {errorMsg && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Nombre Completo
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ingeniero Administrador"
                className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

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
                className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Contraseña Maestra (Mínimo 8 caracteres)
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1.5 block w-full rounded-lg bg-white border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 shadow-sm disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creando Super-Admin…' : 'Finalizar Configuración'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
