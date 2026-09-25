"use client";

import { cn } from "@/lib/utils";

/**
 * El interruptor del CRM: el del Agente (Encendido/Apagado) y el de «IA en
 * esta conversación» son ESTE componente.
 *
 * `inline-flex` asegura que el pomo blanco (bg-knob / bg-white) se desplace
 * dentro de la pista sin desbordar ni quedar descentrado.
 */

const SIZES = {
  /** Cabeceras: la pista de 44 px que ya usaba el Agente. */
  md: { track: "h-6 w-11 px-0.5", knob: "h-5 w-5", on: "translate-x-5" },
  /** Paneles compactos: la de 36 px del panel de contacto. */
  sm: { track: "h-5 w-9 px-0.5", knob: "h-4 w-4", on: "translate-x-4" },
} as const;

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  size = "md",
  className,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Nombre accesible: el interruptor no lleva texto propio. */
  label: string;
  disabled?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-40",
        s.track,
        checked ? "bg-brand" : "bg-border-strong",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "rounded-full bg-white shadow-md transition-transform",
          s.knob,
          checked ? s.on : "translate-x-0"
        )}
      />
    </button>
  );
}
