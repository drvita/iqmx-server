"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * 026 — Confirmación de borrado. Es irreversible, así que detalla con claridad
 * qué se elimina según el alcance elegido.
 */
export function DeleteConversationDialog({
  contactName,
  onCancel,
  onConfirm,
}: {
  contactName: string;
  onCancel: () => void;
  /** Devuelve el mensaje de error, o null si se eliminó con éxito. */
  onConfirm: (alsoContact: boolean) => Promise<string | null>;
}) {
  const [alsoContact, setAlsoContact] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  async function confirm() {
    setBusy(true);
    setError(null);
    const problema = await onConfirm(alsoContact);
    if (problema) {
      setError(problema);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Eliminar conversación"
        className="w-full max-w-md rounded-lg border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-semibold">¿Eliminar esta conversación?</h3>
        <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
          Se borran los mensajes con {contactName}, sus adjuntos, la ficha y lo
          que el agente recuerda de esta conversación. Si vuelve a escribir, el
          agente empieza de cero.
        </p>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-md border bg-muted/30 p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-destructive"
            checked={alsoContact}
            disabled={busy}
            onChange={(e) => setAlsoContact(e.target.checked)}
          />
          <span className="text-[13px] leading-snug">
            <span className="font-medium">Borrar también el contacto y su lead</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {alsoContact
                ? "Se van además sus notas, su etapa en el pipeline y sus citas pasadas. Deja de contar en Resultados."
                : "Sin marcar, el contacto conserva sus notas, su etapa y sus citas."}
            </span>
          </span>
        </label>

        <p className="mt-3 text-xs font-medium text-destructive">No se puede deshacer.</p>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive"
          >
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void confirm()}>
            {busy
              ? "Eliminando…"
              : alsoContact
                ? "Eliminar conversación y contacto"
                : "Eliminar conversación"}
          </Button>
        </div>
      </div>
    </div>
  );
}
