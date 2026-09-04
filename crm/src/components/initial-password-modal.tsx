"use client";

import { useState } from "react";
import { KeyRound, ShieldAlert, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InitialPasswordModal({
  isOpen,
  onSuccess,
}: {
  isOpen: boolean;
  onSuccess?: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [closed, setClosed] = useState(false);

  if (!isOpen || closed) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden. Verifícalas e intenta nuevamente.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-initial-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "No fue posible actualizar la contraseña.");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        setClosed(true);
        if (onSuccess) onSuccess();
      }, 1800);
    } catch {
      setError("Error de comunicación al actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-gray-100 text-gray-900">
        {success ? (
          <div className="text-center py-4 space-y-3">
            <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-extrabold text-gray-900">
              ¡Contraseña configurada!
            </h3>
            <p className="text-sm text-gray-600">
              Tu contraseña definitiva ha sido guardada exitosamente. Bienvenido a tu CRM.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Establece tu contraseña definitiva
                </h3>
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Primer inicio de sesión
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed mb-5">
              Has ingresado utilizando una contraseña temporal generada por el Portal IQISSMexico.
              Por la seguridad de tu empresa, por favor define tu contraseña personal definitiva.
            </p>

            {error && (
              <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-800 border border-red-200 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-9 text-sm"
                  />
                  <Lock className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirmar nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="Repite tu nueva contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-9 text-sm"
                  />
                  <Lock className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 rounded-xl"
                >
                  {loading ? "Guardando contraseña…" : "Guardar contraseña definitiva"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
