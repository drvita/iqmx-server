"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Candidate = { id: string; name: string };
type Health = { level: "ok" | "warn" | "error"; message: string };
type Saved = {
  accountName?: string | null;
  username?: string | null;
  pageName?: string | null;
  health?: Health;
  webhook?: { ok: boolean; created?: boolean; message?: string };
};

export function ZernioConnect({
  endpoint,
  extraBody,
  what,
  idPrefix,
  onSaved,
}: {
  /** La ruta de ajustes del canal (`/api/settings/instagram`…). */
  endpoint: string;
  /** Campos fijos del cuerpo (p. ej. `{ source: "zernio" }`). */
  extraBody?: Record<string, unknown>;
  /** Cómo se llama lo que se conecta: «tu cuenta de Instagram». */
  what: string;
  idPrefix: string;
  onSaved: () => void;
}) {
  const [token, setToken] = useState("");
  const [manual, setManual] = useState(false);
  const [accountRef, setAccountRef] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  async function save(ref?: string) {
    setSaving(true);
    setError(null);
    setSaved(null);
    const res = await fetch(endpoint, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...extraBody,
        token: token.trim(),
        accountRef: ref ?? (manual ? accountRef.trim() || null : null),
      }),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string; details?: { accounts?: Candidate[] } };
      } | null;
      setCandidates(data?.error?.details?.accounts ?? []);
      setError(data?.error?.message ?? "No se pudo conectar. Intenta de nuevo.");
      return;
    }
    const data = (await res.json().catch(() => ({}))) as Saved;
    setToken("");
    setAccountRef("");
    setManual(false);
    setCandidates([]);
    setSaved(data);
    onSaved();
  }

  const canSave = token.trim().length > 0 && (!manual || accountRef.trim().length > 0);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5 sm:max-w-md">
        <Label htmlFor={`${idPrefix}-token`}>API Key de Zernio</Label>
        <Input
          id={`${idPrefix}-token`}
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="sk_…"
          autoComplete="off"
        />
        <p className="text-xs text-text-3">
          Con esa llave el CRM autodescubre {what} en Zernio y registra el webhook automáticamente: no hace falta copiar ningún ID.
        </p>
      </div>

      {manual && (
        <div className="space-y-1.5 sm:max-w-md">
          <Label htmlFor={`${idPrefix}-account`}>accountId de la cuenta en Zernio</Label>
          <Input
            id={`${idPrefix}-account`}
            value={accountRef}
            onChange={(e) => setAccountRef(e.target.value)}
            placeholder="665f1c2e8b3a4d0012345678"
            autoComplete="off"
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className={candidates.length > 0 ? "text-sm font-medium" : "text-sm text-destructive"}
        >
          {error}
        </p>
      )}

      {candidates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-2">Cuentas disponibles en esa llave:</p>
          <div className="flex flex-wrap gap-2">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={saving || token.trim().length === 0}
                onClick={() => void save(c.id)}
                className="rounded-full border border-border-strong px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-accent disabled:opacity-50"
              >
                Conectar {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={saving || !canSave} onClick={() => void save()}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando en Zernio...
            </>
          ) : (
            "Probar y conectar"
          )}
        </Button>
        {!manual && (
          <button
            type="button"
            onClick={() => setManual(true)}
            className="text-xs font-semibold text-text-2 underline-offset-2 hover:underline"
          >
            Pegar accountId manualmente
          </button>
        )}
      </div>

      {saved && (
        <div className="space-y-2 rounded-lg border border-success-soft bg-success-tint p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-success-text">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Conectado{saved.accountName || saved.username || saved.pageName ? `: ${saved.accountName ?? saved.username ?? saved.pageName}` : ""}
          </p>
          {saved.webhook?.ok && (
            <p className="text-success-text opacity-80 text-xs">
              {saved.webhook.created
                ? "El CRM registró su webhook en tu cuenta de Zernio automáticamente y cifró el secreto de firma."
                : "El webhook de Zernio quedó actualizado y limitado a tus cuentas conectadas."}
            </p>
          )}
          {saved.health && saved.health.level !== "ok" && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
              {saved.health.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
