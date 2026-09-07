'use client';

import React, { useEffect, useState } from 'react';
import {
  UserCircleIcon,
  ShieldCheckIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

type AdminProfile = {
  id: number;
  name: string;
  email: string;
  role: string;
  telegram_chat_id: string | null;
};

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

  // Status feedback
  const [saving, setSaving] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const token = localStorage.getItem('iqmx_admin_token');
    if (!token) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: AdminProfile = await res.json();
        setProfile(data);
        setName(data.name || '');
        setTelegramChatId(data.telegram_chat_id || '');
      }
    } catch {
      setFeedback({ type: 'error', message: 'No se pudo cargar la información del perfil.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (password && password.length < 8) {
      setFeedback({ type: 'error', message: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      return;
    }

    if (password && password !== confirmPassword) {
      setFeedback({ type: 'error', message: 'Las contraseñas no coinciden.' });
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

      const payload: { name: string; telegram_chat_id: string; password?: string } = {
        name: name.trim(),
        telegram_chat_id: telegramChatId.trim(),
      };

      if (password.trim()) {
        payload.password = password.trim();
      }

      const res = await fetch(`${apiUrl}/api/admin/auth/me`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data?.detail || 'Error al actualizar el perfil.' });
      } else {
        setProfile(data);
        setPassword('');
        setConfirmPassword('');
        setFeedback({ type: 'success', message: '¡Perfil actualizado exitosamente!' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Error de conexión con el servidor.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramChatId.trim()) {
      setFeedback({ type: 'error', message: 'Ingresa y guarda tu Telegram Chat ID antes de realizar la prueba.' });
      return;
    }

    setTestingTelegram(true);
    setFeedback(null);

    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

      const res = await fetch(`${apiUrl}/api/admin/auth/me/test-telegram`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', message: data?.detail || 'Error al enviar mensaje de prueba.' });
      } else {
        setFeedback({
          type: 'success',
          message: '🔔 ¡Mensaje de prueba enviado con éxito! Revisa tu aplicación de Telegram.',
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Error de conexión al despachar prueba de Telegram.' });
    } finally {
      setTestingTelegram(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-gray-500">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-xs">Cargando perfil…</p>
        </div>
      </div>
    );
  }

  const isTelegramConfigured = Boolean(profile?.telegram_chat_id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <UserCircleIcon className="h-7 w-7 text-blue-600" />
          <span>Mi Perfil de Administrador</span>
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Gestiona tus credenciales de acceso y configura tu identificador de Telegram para recibir alertas en tiempo real cuando un nuevo usuario valide su correo o existan eventos operativos.
        </p>
      </div>

      {/* Banner de Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-sm animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Datos de Cuenta */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-xs p-6 space-y-4">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Datos Personales y Acceso</h2>
              <p className="text-xs text-gray-500">Información básica de tu usuario administrador.</p>
            </div>
            <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200 uppercase tracking-wider">
              {profile?.role || 'Admin'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre Completo</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Ej. Salvador Galindo"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                disabled
                value={profile?.email || ''}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                title="El correo electrónico principal del sistema está protegido"
              />
              <p className="text-[11px] text-gray-400 mt-1">El correo principal no puede ser modificado aquí.</p>
            </div>
          </div>

          {/* Cambio de Contraseña */}
          <div className="pt-3 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <KeyIcon className="h-4 w-4 text-gray-400" />
              <span>Cambiar Contraseña (Opcional)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nueva Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Configuración de Telegram para Alertas Operativas */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-xs p-6 space-y-4">
          <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                ✈️
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Notificaciones Operativas vía Telegram</h2>
                <p className="text-xs text-gray-500">
                  Recibe alertas instantáneas en tu celular cuando un cliente verifique su correo o haya actividad relevante.
                </p>
              </div>
            </div>

            <div>
              {isTelegramConfigured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
                  <CheckIcon className="h-3.5 w-3.5" />
                  <span>Vinculado</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                  <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                  <span>Sin Configurar</span>
                </span>
              )}
            </div>
          </div>

          {/* Guía Amigable para Usuarios No Técnicos */}
          <div className="rounded-xl bg-sky-50/70 border border-sky-200/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>¿Cómo saber tu Telegram Chat ID en 3 simples pasos?</span>
              </h3>
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer"
              >
                <span>Abrir @userinfobot</span>
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </a>
            </div>

            <ol className="text-xs text-sky-900 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>
                Abre Telegram y busca el bot oficial de identificación <strong>@userinfobot</strong> (o presiona el botón azul de arriba).
              </li>
              <li>
                Presiona el botón <strong>Iniciar</strong> (o escribe <em>/start</em>).
              </li>
              <li>
                El bot te responderá una tarjeta. Copia el número que aparece en <strong>Id:</strong> (ej. <em>987654321</em>) y pégalo abajo.
              </li>
            </ol>
          </div>

          {/* Input Chat ID y Botón de Prueba */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Tu Telegram Chat ID (Numérico)
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="Ej. 123456789"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={testingTelegram || !telegramChatId.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  <span>{testingTelegram ? 'Enviando prueba…' : 'Probar Notificación'}</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                Al presionar &quot;Probar Notificación&quot;, te enviaremos un mensaje de prueba al instante para que verifiques la recepción.
              </p>
            </div>
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
          >
            <ShieldCheckIcon className="h-4 w-4" />
            <span>{saving ? 'Guardando cambios…' : 'Guardar Perfil'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
