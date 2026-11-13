"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, KeyRound, Palette, Upload } from "lucide-react";
import {
  changeOwnPasswordAction,
  updateBrandingAction,
} from "@/actions/admin";

interface ConfiguracionClientProps {
  org: {
    logoUrl: string | null;
    colorPrimario: string;
    colorSecundario: string;
    mensajeBienvenida: string;
    horasSemanalesMax: string;
    hasAuditPin: boolean;
  };
  canEdit: boolean;
}

export function ConfiguracionClient({
  org,
  canEdit,
}: ConfiguracionClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [logoUrl, setLogoUrl] = useState(org.logoUrl ?? "");
  const [colorPrimario, setColorPrimario] = useState(org.colorPrimario);
  const [colorSecundario, setColorSecundario] = useState(org.colorSecundario);
  const [mensajeBienvenida, setMensajeBienvenida] = useState(
    org.mensajeBienvenida
  );
  const [horasSemanalesMax, setHorasSemanalesMax] = useState(
    Number(org.horasSemanalesMax)
  );
  const [pinAuditoria, setPinAuditoria] = useState("");
  const [pinConfigured, setPinConfigured] = useState(org.hasAuditPin);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingLogo(true);
    setMsg(null);
    setErr(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/branding/logo", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        ok: boolean;
        logoUrl?: string;
        error?: string;
      };

      if (!res.ok || !data.ok || !data.logoUrl) {
        setErr(data.error ?? "No se pudo subir el logo.");
        return;
      }

      setLogoUrl(data.logoUrl);
      setMsg("Logotipo actualizado y almacenado correctamente.");
      router.refresh();
    } catch {
      setErr("Error de conexión al subir la imagen.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinAuditoria.trim();
    if (cleanPin && !/^\d{6}$/.test(cleanPin)) {
      setErr("El PIN de auditoría debe ser exactamente de 6 dígitos numéricos.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await updateBrandingAction({
      logoUrl: logoUrl || null,
      colorPrimario,
      colorSecundario,
      mensajeBienvenida,
      horasSemanalesMax,
      ...(cleanPin ? { pinAuditoria: cleanPin } : {}),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? "No se pudo guardar la configuración.");
      return;
    }
    if (cleanPin) {
      setPinConfigured(true);
      setPinAuditoria("");
    }
    setMsg("Configuración de marca, jornada y seguridad actualizada.");
    router.refresh();
  };

  return (
    <div className="max-w-2xl space-y-6">
    <form
      onSubmit={handleSave}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-[#4f46e5]" />
        <h2 className="text-sm font-bold text-slate-900">
          Marca Blanca y Jornada Laboral
        </h2>
      </div>

      {/* Carga de logotipo de la organización */}
      <div className="space-y-2 text-xs">
        <span className="block font-medium text-slate-700">
          Logotipo de la Organización
        </span>
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logotipo de la organización"
                className="h-full w-full object-contain p-1.5"
              />
            ) : (
              <ImagePlus className="h-7 w-7 text-slate-300" />
            )}
          </div>

          <div className="flex-1 space-y-2">
            <p className="text-[11px] leading-relaxed text-slate-600">
              Formatos permitidos: PNG, JPG o WEBP, máximo 2 MB. Este logotipo se
              sincronizará automáticamente en las terminales quiosco para
              operación sin conexión.
            </p>
            {canEdit && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingLogo
                    ? "Subiendo imagen..."
                    : logoUrl
                      ? "Cambiar Logotipo"
                      : "Subir Logotipo"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-slate-600">Color Primario</span>
            <input
              type="color"
              disabled={!canEdit}
              value={colorPrimario}
              onChange={(e) => setColorPrimario(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-300 p-1"
            />
          </label>
          <label className="space-y-1">
            <span className="text-slate-600">Color Secundario</span>
            <input
              type="color"
              disabled={!canEdit}
              value={colorSecundario}
              onChange={(e) => setColorSecundario(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-300 p-1"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-slate-600">Mensaje de Bienvenida en Quiosco</span>
          <input
            type="text"
            required
            disabled={!canEdit}
            value={mensajeBienvenida}
            onChange={(e) => setMensajeBienvenida(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 disabled:bg-slate-50"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-slate-600">Límite Semanal de Horas</span>
          <input
            type="number"
            min={20}
            max={72}
            step="0.5"
            disabled={!canEdit}
            value={horasSemanalesMax}
            onChange={(e) => setHorasSemanalesMax(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 disabled:bg-slate-50"
          />
        </label>

        <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-700">
              PIN de Auditoría en Quioscos
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                pinConfigured
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {pinConfigured ? "Configurado" : "Sin configurar"}
            </span>
          </div>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            disabled={!canEdit}
            value={pinAuditoria}
            onChange={(e) =>
              setPinAuditoria(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder={
              pinConfigured
                ? "Ingresa 6 dígitos solo si deseas cambiarlo"
                : "Define un PIN de 6 dígitos"
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-slate-900 disabled:bg-slate-100"
          />
          <p className="text-[11px] text-slate-500">
            Se almacena cifrado para permitir desbloquear la auditoría local del
            quiosco sin internet. Si lo cambias, los quioscos vinculados cerrarán
            sesión automáticamente al reconectarse.
          </p>
        </div>
      </div>

      {err && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {msg}
        </p>
      )}

      {canEdit && (
        <button
          type="submit"
          disabled={busy || uploadingLogo}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#4f46e5] px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "Guardando..." : "Guardar Configuración"}
        </button>
      )}
    </form>

    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setPwMsg(null);
        setPwErr(null);

        if (newPassword.length < 8) {
          setPwErr("La nueva contraseña debe tener al menos 8 caracteres.");
          return;
        }
        if (newPassword !== confirmPassword) {
          setPwErr("Las contraseñas no coinciden.");
          return;
        }

        setPwBusy(true);
        const res = await changeOwnPasswordAction({
          currentPassword,
          newPassword,
        });
        setPwBusy(false);

        if (!res.ok) {
          setPwErr(res.error ?? "No se pudo actualizar la contraseña.");
          return;
        }

        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPwMsg("Tu contraseña ha sido actualizada correctamente.");
      }}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
    >
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-[#4f46e5]" />
        <h2 className="text-sm font-bold text-slate-900">
          Seguridad de la Cuenta · Cambiar Contraseña
        </h2>
      </div>

      <div className="grid gap-3 text-xs sm:grid-cols-3">
        <div>
          <label className="mb-1 block font-medium text-slate-700">
            Contraseña actual
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
          />
        </div>
        <div>
          <label className="mb-1 block font-medium text-slate-700">
            Nueva contraseña
          </label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
          />
        </div>
        <div>
          <label className="mb-1 block font-medium text-slate-700">
            Confirmar nueva contraseña
          </label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite la contraseña"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
          />
        </div>
      </div>

      {pwErr && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
          {pwErr}
        </p>
      )}
      {pwMsg && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {pwMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={pwBusy}
        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pwBusy ? "Actualizando..." : "Actualizar Contraseña"}
      </button>
    </form>
  </div>
  );
}
