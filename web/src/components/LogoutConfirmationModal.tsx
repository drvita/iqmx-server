'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightOnRectangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  userName?: string;
}

export default function LogoutConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Deseas cerrar sesión?',
  description = 'Tendrás que volver a ingresar tus credenciales para acceder a tu cuenta.',
  confirmText = 'Cerrar Sesión',
  cancelText = 'Cancelar',
  userName,
}: LogoutConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Manejo de tecla Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-dialog-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 transition-all transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar X */}
        <button
          onClick={onClose}
          aria-label="Cerrar ventana"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 rounded-lg p-1 transition-colors hover:bg-gray-100 cursor-pointer"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        {/* Icono de salida */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 mb-4 border border-red-100">
          <ArrowRightOnRectangleIcon className="h-7 w-7" />
        </div>

        {/* Título y descripción */}
        <div className="text-center">
          <h3 id="logout-dialog-title" className="text-base font-bold text-gray-900">
            {title}
          </h3>
          {userName && (
            <p className="mt-1 text-xs font-semibold text-gray-700 bg-gray-50 py-1 px-2.5 rounded-lg inline-block border border-gray-200/70">
              {userName}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
            {description}
          </p>
        </div>

        {/* Acciones */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer text-center"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="w-full sm:flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-red-700 transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
