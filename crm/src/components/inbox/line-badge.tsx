"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Genera un ángulo de matiz (Hue de 0° a 359°) determinista y bien distribuido
 * a partir de un texto (nombre de la línea o número de teléfono).
 * Usa el algoritmo djb2 con rotación de bits para dispersar cadenas similares.
 */
function stringToHue(str: string): number {
  let hash = 5381;
  const clean = str.trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) + hash) + clean.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function LineBadge({
  name,
  seed,
  className,
  size = "sm",
}: {
  name: string;
  seed?: string | null;
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  const hue = useMemo(() => stringToHue(seed || name), [seed, name]);

  // Estilos generados con HSL:
  // - Dot: Color vivo y saturado al 75%
  // - Background: Fondo suave al 94% (light) / transparente al 15% (dark)
  // - Text: Alto contraste al 26% de luminosidad
  // - Border: Tonalidad pastel al 82%
  const badgeStyle = {
    backgroundColor: `hsl(${hue}, 85%, 95%)`,
    borderColor: `hsl(${hue}, 65%, 82%)`,
    color: `hsl(${hue}, 80%, 25%)`,
  };

  const dotStyle = {
    backgroundColor: `hsl(${hue}, 85%, 45%)`,
  };

  return (
    <span
      style={badgeStyle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors select-none",
        size === "xs" && "px-2 py-0.5 text-[10.5px]",
        size === "sm" && "px-2.5 py-0.5 text-[11.5px]",
        size === "md" && "px-3 py-1 text-xs",
        className
      )}
      title={`Línea: ${name}`}
    >
      <span
        style={dotStyle}
        className="h-1.5 w-1.5 rounded-full shrink-0 shadow-xs"
      />
      <span className="truncate max-w-[140px] tracking-tight">{name}</span>
    </span>
  );
}
