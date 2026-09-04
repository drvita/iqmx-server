"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  userName?: string;
  isLoggingOut?: boolean;
}

export function LogoutModal({
  isOpen,
  onClose,
  onConfirm,
  userName,
  isLoggingOut = false,
}: LogoutModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isLoggingOut) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isLoggingOut]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      onClick={() => {
        if (!isLoggingOut) onClose();
      }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-2xl text-card-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={isLoggingOut}
          aria-label="Cerrar modal"
          className="absolute top-4 right-4 rounded-lg p-1 text-text-3 hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4 border border-destructive/20">
          <LogOut className="h-6 w-6" strokeWidth={1.8} />
        </div>

        <div className="text-center">
          <h3 id="logout-modal-title" className="text-base font-bold text-foreground">
            ¿Cerrar sesión?
          </h3>
          {userName && (
            <p className="mt-1 text-xs font-semibold text-text-2 bg-accent/50 py-0.5 px-2.5 rounded-full inline-block border border-border">
              {userName}
            </p>
          )}
          <p className="mt-2 text-xs text-text-3 leading-relaxed max-w-xs mx-auto">
            ¿Estás seguro de que deseas salir del CRM? Para volver a acceder deberás introducir tus credenciales.
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isLoggingOut}
            onClick={onClose}
            className="w-full sm:flex-1 text-xs cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isLoggingOut}
            onClick={onConfirm}
            className="w-full sm:flex-1 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{isLoggingOut ? "Cerrando..." : "Cerrar Sesión"}</span>
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
