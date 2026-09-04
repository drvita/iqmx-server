"use client";

import { cn } from "@/lib/utils";

// Paleta armónica y distinguible para líneas de WhatsApp
const LINE_PALETTES = [
  {
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  {
    bg: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
    dot: "bg-indigo-500",
  },
  {
    bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  {
    bg: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
    dot: "bg-purple-500",
  },
  {
    bg: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    dot: "bg-sky-500",
  },
  {
    bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    dot: "bg-rose-500",
  },
  {
    bg: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
    dot: "bg-teal-500",
  },
];

function getPalette(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % LINE_PALETTES.length;
  return LINE_PALETTES[index]!;
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
  const palette = getPalette(seed || name);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        palette.bg,
        size === "xs" && "px-1.5 py-0.5 text-[10px]",
        size === "sm" && "px-2 py-0.5 text-[11px]",
        size === "md" && "px-2.5 py-1 text-xs",
        className
      )}
      title={`Línea: ${name}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", palette.dot)} />
      <span className="truncate max-w-[130px]">{name}</span>
    </span>
  );
}
