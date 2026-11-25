'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

type CopyButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  ariaLabel?: string;
  variant?: 'primary' | 'secondary';
  className?: string;
};

let lastAnnouncement = '';

function legacyCopy(text: string): boolean {
  const previousFocus = document.activeElement as HTMLElement | null;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0';
  document.body.append(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
    previousFocus?.focus?.({ preventScroll: true });
  }
}

export default function CopyButton({
  value,
  label = 'Copiar',
  copiedLabel = 'Copiado',
  ariaLabel,
  variant = 'secondary',
  className = '',
}: CopyButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [liveMessage, setLiveMessage] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const announce = (ok: boolean) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    let msg = ok ? copiedLabel : 'No se pudo copiar';
    if (msg === lastAnnouncement) {
      msg += '\u00A0';
    }
    lastAnnouncement = msg;
    setStatus(ok ? 'copied' : 'failed');
    setLiveMessage(msg);
    timerRef.current = setTimeout(() => {
      setStatus('idle');
      setLiveMessage('');
    }, 2200);
  };

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      announce(true);
    } catch {
      const ok = legacyCopy(value);
      announce(ok);
    }
  };

  const baseClasses =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600 shadow-xs'
      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 shadow-2xs';

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={ariaLabel}
        data-copied={status === 'copied' ? '' : undefined}
        data-failed={status === 'failed' ? '' : undefined}
        className={`inline-flex min-h-[32px] min-w-[32px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${baseClasses} ${className}`}
      >
        {status === 'copied' ? (
          <CheckIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <ClipboardDocumentIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <span>{status === 'copied' ? copiedLabel : label}</span>
      </button>
      <span
        role="status"
        className={`text-[11px] font-medium transition-opacity duration-150 ${
          status === 'failed'
            ? 'text-red-600 opacity-100'
            : status === 'copied'
            ? 'text-emerald-700 opacity-100 sr-only'
            : 'opacity-0 sr-only'
        }`}
      >
        {liveMessage}
      </span>
    </span>
  );
}
