"use client";

import { useMemo } from "react";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Genera un ángulo de matiz (Hue de 0° a 359°) determinista y bien distribuido
 * a partir de un texto (nombre de la línea o número de teléfono).
 * Usa el algoritmo djb2 con rotación de bits para dispersar cadenas similares.
 */
export function stringToHue(str: string): number {
  let hash = 5381;
  const clean = str.trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) + hash + clean.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function getLineColor(seed: string) {
  const hue = stringToHue(seed);
  return {
    hue,
    dot: `hsl(${hue}, 85%, 45%)`,
    border: `hsl(${hue}, 70%, 78%)`,
    bg: `hsl(${hue}, 85%, 95%)`,
    text: `hsl(${hue}, 80%, 25%)`,
    accentBorder: `hsl(${hue}, 80%, 48%)`,
  };
}

export function LineBadge({
  name,
  seed,
  className,
  size = "sm",
  showIcon = false,
}: {
  name: string;
  seed?: string | null;
  className?: string;
  size?: "xs" | "sm" | "md";
  showIcon?: boolean;
}) {
  const colors = useMemo(() => getLineColor(seed || name), [seed, name]);

  const badgeStyle = {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    color: colors.text,
  };

  const dotStyle = {
    backgroundColor: colors.dot,
  };

  return (
    <span
      style={badgeStyle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold transition-colors select-none",
        size === "xs" && "px-2 py-0.5 text-[10.5px]",
        size === "sm" && "px-2.5 py-0.5 text-[11.5px]",
        size === "md" && "px-3 py-1 text-xs",
        className
      )}
      title={`Línea: ${name}`}
    >
      {showIcon ? (
        <Phone className="h-2.5 w-2.5 shrink-0 opacity-85" strokeWidth={2.2} />
      ) : (
        <span
          style={dotStyle}
          className="h-1.5 w-1.5 rounded-full shrink-0 shadow-xs"
        />
      )}
      <span className="truncate max-w-[140px] tracking-tight">{name}</span>
    </span>
  );
}
