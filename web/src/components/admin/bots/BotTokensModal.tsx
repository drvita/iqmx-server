'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { BotItem } from './BotFormModal';
import CopyButton from './CopyButton';

type BotTokenItem = {
  id: number;
  name: string;
  token_prefix: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type BotTokensModalProps = {
  bot: BotItem | null;
  onClose: () => void;
  onTokensChanged: () => void;
};

export default function BotTokensModal({
  bot,
  onClose,
  onTokensChanged,
}: BotTokensModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const [tokens, setTokens] = useState<BotTokenItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tokenName, setTokenName] = useState('');
  const [noExpiration, setNoExpiration] = useState(true);
  const [expiresDate, setExpiresDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);

  const [confirmRevokeId, setConfirmRevokeId] = useState<number | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchTokens = useCallback(async (botId: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/bots/${botId}/tokens`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.detail || 'No se pudieron cargar los tokens.');
      } else {
        const data = await res.json();
        setTokens(data);
      }
    } catch {
      setErrorMsg('Error de conexión al consultar tokens.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (bot) {
      setTokenName('');
      setNoExpiration(true);
      setExpiresDate('');
      setNewlyCreatedToken(null);
      setConfirmRevokeId(null);
      if (!dialog.open) {
        dialog.showModal();
      }
      fetchTokens(bot.id);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [bot, fetchTokens]);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bot) return;
    setCreating(true);
    setErrorMsg(null);

    try {
      const adminToken = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      let expiresAt: string | null = null;
      if (!noExpiration && expiresDate) {
        expiresAt = new Date(`${expiresDate}T23:59:59`).toISOString();
      }

      const res = await fetch(`${apiUrl}/api/admin/bots/${bot.id}/tokens`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tokenName.trim(),
          expires_at: expiresAt,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(data?.detail || 'No se pudo generar el token.');
      } else {
        setNewlyCreatedToken(data.token);
        setTokenName('');
        setNoExpiration(true);
        setExpiresDate('');
        fetchTokens(bot.id);
        onTokensChanged();
      }
    } catch {
      setErrorMsg('Error de conexión al generar el token.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (tokenId: number) => {
    if (!bot) return;
    setRevoking(true);
    setErrorMsg(null);
    try {
      const adminToken = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/admin/bots/${bot.id}/tokens/${tokenId}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.detail || 'No se pudo revocar el token.');
      } else {
        setConfirmRevokeId(null);
        fetchTokens(bot.id);
        onTokensChanged();
      }
    } catch {
      setErrorMsg('Error de conexión al revocar el token.');
    } finally {
      setRevoking(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getTokenStatus = (t: BotTokenItem) => {
    if (t.revoked_at) {
      return (
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
          Revocado
        </span>
      );
    }
    if (t.expires_at && new Date(t.expires_at) <= new Date()) {
      return (
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
          Expirado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Activo
      </span>
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={(e) => {
        e.currentTarget.returnValue = '';
        onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3">
        <div>
          <h1 id={titleId} className="flex items-center gap-2 text-base font-bold text-gray-900">
            <KeyIcon className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <span>Tokens de acceso — {bot?.name}</span>
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Genera credenciales de larga vida para conectar este bot al servidor MCP.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana"
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <XMarkIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        {newlyCreatedToken && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>Token generado con éxito</span>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800">
              <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span>Este token se muestra una sola vez. Cópialo y guárdalo ahora en un lugar seguro.</span>
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 select-all">
                {newlyCreatedToken}
              </code>
              <CopyButton
                value={newlyCreatedToken}
                label="Copiar token"
                copiedLabel="¡Copiado!"
                ariaLabel="Copiar token de acceso"
                variant="primary"
              />
            </div>
          </div>
        )}

        <form onSubmit={handleCreateToken} className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-800">Generar nuevo token</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="token-name-input" className="block text-[11px] font-semibold text-gray-600">
                Nombre del token
              </label>
              <input
                id="token-name-input"
                type="text"
                required
                minLength={2}
                maxLength={100}
                autoFocus
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="Ej. Servidor producción"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-gray-600">Vencimiento</span>
              <div className="mt-1 flex items-center gap-3 min-h-[34px]">
                <label className="inline-flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noExpiration}
                    onChange={(e) => setNoExpiration(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Sin vencimiento</span>
                </label>
                {!noExpiration && (
                  <input
                    type="date"
                    required
                    value={expiresDate}
                    onChange={(e) => setExpiresDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {creating ? 'Generando…' : 'Crear token'}
            </button>
          </div>
        </form>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
              <tr>
                <th className="px-3.5 py-2.5">Nombre</th>
                <th className="px-3.5 py-2.5">Prefijo</th>
                <th className="px-3.5 py-2.5">Último uso</th>
                <th className="px-3.5 py-2.5">Estado</th>
                <th className="px-3.5 py-2.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    Cargando tokens…
                  </td>
                </tr>
              )}
              {!loading && tokens.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    Este bot aún no tiene tokens generados.
                  </td>
                </tr>
              )}
              {!loading &&
                tokens.map((t) => {
                  const isRevoked = Boolean(t.revoked_at);
                  const confirming = confirmRevokeId === t.id;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50/70">
                      <td className="px-3.5 py-2.5 font-medium text-gray-900">
                        <div>{t.name}</div>
                        <div className="text-[10px] text-gray-400">
                          {t.expires_at ? `Vence: ${formatDate(t.expires_at)}` : 'Sin vencimiento'}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-gray-600">
                        {t.token_prefix}…
                      </td>
                      <td className="px-3.5 py-2.5 text-gray-500">{formatDate(t.last_used_at)}</td>
                      <td className="px-3.5 py-2.5">{getTokenStatus(t)}</td>
                      <td className="px-3.5 py-2.5 text-right">
                        {!isRevoked &&
                          (confirming ? (
                            <span className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={revoking}
                                onClick={() => handleRevoke(t.id)}
                                className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 cursor-pointer disabled:opacity-50"
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRevokeId(null)}
                                className="rounded-md px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRevokeId(t.id)}
                              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
                            >
                              Revocar
                            </button>
                          ))}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Cerrar
        </button>
      </div>
    </dialog>
  );
}
