'use client';

import React, { useState } from 'react';
import {
  CodeBracketIcon,
  ExclamationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export interface RawJsonEditorProps {
  value: string;
  onChange: (val: string) => void;
  error?: string | null;
  onErrorChange?: (err: string | null) => void;
  label?: string;
  description?: string;
  rows?: number;
  tip?: string;
}

export const RawJsonEditor: React.FC<RawJsonEditorProps> = ({
  value,
  onChange,
  error,
  onErrorChange,
  label = 'Configuración de Features (JSON)',
  description = 'Edita los parámetros directamente en formato JSON raw.',
  rows = 9,
  tip = 'Tip: Puedes agregar nuevas claves o banderas booleanas. Serán enviadas y persistidas en el CRM.',
}) => {
  const [internalError, setInternalError] = useState<string | null>(null);

  const activeError = error !== undefined ? error : internalError;

  const handlePrettify = () => {
    try {
      if (!value.trim()) {
        const emptyObj = '{\n}';
        onChange(emptyObj);
        setInternalError(null);
        onErrorChange?.(null);
        return;
      }

      const parsed = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        const msg = 'El contenido debe ser un objeto JSON válido ({ ... }).';
        setInternalError(msg);
        onErrorChange?.(msg);
        return;
      }

      const formatted = JSON.stringify(parsed, null, 2);
      onChange(formatted);
      setInternalError(null);
      onErrorChange?.(null);
    } catch (err: any) {
      const msg = `Sintaxis JSON inválida: ${err?.message || 'error de formato'}`;
      setInternalError(msg);
      onErrorChange?.(msg);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          {label && (
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <CodeBracketIcon className="h-4 w-4 text-gray-500" />
              <span>{label}</span>
            </label>
          )}
          {description && (
            <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
          )}
        </div>

        <button
          type="button"
          onClick={handlePrettify}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors shadow-2xs cursor-pointer shrink-0"
          title="Indentación y validación automática del JSON"
        >
          <SparklesIcon className="h-3.5 w-3.5 text-blue-500" />
          <span>Dar Formato</span>
        </button>
      </div>

      <div className="relative">
        <textarea
          rows={rows}
          spellCheck={false}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (activeError) {
              setInternalError(null);
              onErrorChange?.(null);
            }
          }}
          placeholder={'{\n  "max_whatsapp_accounts": 1\n}'}
          className="w-full rounded-xl border border-gray-300 bg-gray-950 p-3.5 text-xs font-mono text-emerald-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden leading-relaxed shadow-inner"
        />
      </div>

      {activeError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 flex items-start gap-2">
          <ExclamationCircleIcon className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
          <span>{activeError}</span>
        </div>
      )}

      {tip && (
        <p className="text-[11px] text-gray-500 leading-normal">
          {tip}
        </p>
      )}
    </div>
  );
};
