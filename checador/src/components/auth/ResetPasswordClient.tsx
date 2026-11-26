"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, ScanFace } from "lucide-react";

export function ResetPasswordClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo restablecer la contraseña.");
        return;
      }
      setDone(true);
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f9ff] px-4 py-10 text-[#0b1c30]">
      <div className="w-full max-w-[440px] rounded-2xl border border-[#c8c5d0]/70 bg-white p-7 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e1b4b] text-white">
            <ScanFace className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#4b41e1]">
              Checador Facial IQISS
            </p>
            <h1 className="text-lg font-bold text-[#070235]">
              Restablecer contraseña
            </h1>
          </div>
        </div>

        {!token ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-800">
              No se encontró un token de recuperación válido en el enlace.
            </p>
            <Link
              href="/login"
              className="flex w-full items-center justify-center rounded-md bg-[#4b41e1] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#645efb]"
            >
              Volver a iniciar sesión
            </Link>
          </div>
        ) : done ? (
          <div className="mt-6 space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[#059669]" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">
                Contraseña actualizada
              </p>
              <p className="text-xs text-slate-600">
                Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
            </div>
            <Link
              href="/login"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[#4b41e1] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#645efb]"
            >
              <span>Ir a iniciar sesión</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="mb-1.5 block text-[13px] font-medium text-[#0b1c30]"
              >
                Nueva contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-[#787680]" />
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-md border border-[#c8c5d0] bg-white py-2.5 pr-10 pl-10 text-sm text-[#0b1c30] focus:border-[#4b41e1] focus:ring-2 focus:ring-[#4b41e1]/20 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#787680] hover:text-[#0b1c30]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-1.5 block text-[13px] font-medium text-[#0b1c30]"
              >
                Confirmar contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-[#787680]" />
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full rounded-md border border-[#c8c5d0] bg-white py-2.5 pr-3.5 pl-10 text-sm text-[#0b1c30] focus:border-[#4b41e1] focus:ring-2 focus:ring-[#4b41e1]/20 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-[#ba1a1a]/25 bg-[#ffdad6] px-3 py-2 text-xs font-medium text-[#93000a]"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[#4b41e1] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#645efb] disabled:opacity-50"
            >
              <span>{busy ? "Actualizando..." : "Guardar nueva contraseña"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
