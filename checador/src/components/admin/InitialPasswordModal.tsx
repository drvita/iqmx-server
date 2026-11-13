"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Lock, ShieldAlert } from "lucide-react";
import { setInitialPasswordAction } from "@/actions/admin";

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
      setError(
        "Las contraseñas no coinciden. Verifícalas e intenta nuevamente."
      );
      return;
    }

    setLoading(true);
    try {
      const res = await setInitialPasswordAction({ newPassword });
      if (!res.ok) {
        setError(res.error ?? "No fue posible actualizar la contraseña.");
        return;
      }

      setSuccess(true);
      window.setTimeout(() => {
        setClosed(true);
        if (onSuccess) onSuccess();
      }, 1500);
    } catch {
      setError("Error de comunicación al actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
        {success ? (
          <div className="space-y-3 py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-[#059669]">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">
              ¡Contraseña configurada!
            </h3>
            <p className="text-sm text-slate-600">
              Tu contraseña definitiva ha sido guardada. Bienvenido a Checador
              Facial.
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Establece tu contraseña definitiva
                </h3>
                <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  Primer inicio de sesión
                </span>
              </div>
            </div>

            <p className="mb-5 text-xs leading-relaxed text-slate-600">
              Has ingresado con una contraseña temporal. Por la seguridad de tu
              organización, define tu contraseña personal definitiva para
              continuar.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="initial-new-password"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="initial-new-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pr-3 pl-9 text-sm text-slate-900 focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="initial-confirm-password"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Confirmar nueva contraseña
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="initial-confirm-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pr-3 pl-9 text-sm text-slate-900 focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/20 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4338ca] disabled:opacity-60"
              >
                {loading
                  ? "Guardando contraseña..."
                  : "Guardar contraseña definitiva"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
