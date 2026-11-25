'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { CpuChipIcon, XMarkIcon } from '@heroicons/react/24/outline';

export type BotItem = {
  id: number;
  name: string;
  email: string;
  customer_id: number | null;
  company_name: string | null;
  description: string | null;
  is_active: boolean;
  tokens_active: number;
  created_at: string;
};

export type CompanyOption = {
  id: number;
  company_name: string;
};

type BotFormModalProps = {
  isOpen: boolean;
  editingBot: BotItem | null;
  companies: CompanyOption[];
  onClose: () => void;
  onSaved: () => void;
};

export default function BotFormModal({
  isOpen,
  editingBot,
  companies,
  onClose,
  onSaved,
}: BotFormModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      setName(editingBot?.name || '');
      setDescription(editingBot?.description || '');
      setCustomerId(editingBot?.customer_id ? String(editingBot.customer_id) : '');
      setErrorMsg(null);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, editingBot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      const token = localStorage.getItem('iqmx_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        customer_id: customerId ? Number(customerId) : null,
      };

      const url = editingBot
        ? `${apiUrl}/api/admin/bots/${editingBot.id}`
        : `${apiUrl}/api/admin/bots`;
      const method = editingBot ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(data?.detail || 'No se pudo guardar el bot.');
      } else {
        onSaved();
        onClose();
      }
    } catch {
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={(e) => {
        e.currentTarget.returnValue = '';
        onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h1 id={titleId} className="flex items-center gap-2 text-base font-bold text-gray-900">
          <CpuChipIcon className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <span>{editingBot ? 'Editar Bot' : 'Nuevo Bot MCP'}</span>
        </h1>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana"
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <XMarkIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {errorMsg && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="bot-name-input" className="block text-xs font-semibold text-gray-700">
            Nombre del bot
          </label>
          <input
            id="bot-name-input"
            type="text"
            required
            minLength={2}
            maxLength={100}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Danna Asistente"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div>
          <label htmlFor="bot-desc-input" className="block text-xs font-semibold text-gray-700">
            Descripción (opcional)
          </label>
          <textarea
            id="bot-desc-input"
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe para qué se utilizará este asistente en el foro"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div>
          <label htmlFor="bot-company-select" className="block text-xs font-semibold text-gray-700">
            Empresa asignada
          </label>
          <select
            id="bot-company-select"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="">Todas las empresas</option>
            {companies.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.company_name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-gray-500">
            Si seleccionas una empresa, el bot solo podrá consultar y comentar temas de esa empresa.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Guardando…' : editingBot ? 'Guardar cambios' : 'Crear Bot'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
