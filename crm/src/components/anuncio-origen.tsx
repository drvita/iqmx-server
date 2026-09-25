"use client";

import { useState } from "react";
import { ExternalLink, Megaphone } from "lucide-react";
import type { AnuncioDto } from "@/lib/types";
import { etiquetaDeOrigen, titularDeOrigen } from "@/lib/anuncios";

/**
 * 019 — Miniatura del creativo para listas y tablas (Resultados). Sin imagen,
 * o si deja de servirse, queda el megáfono en el mismo hueco para que las filas
 * no bailen.
 */
export function MiniaturaDeAnuncio({
  imageAssetId,
  alt,
}: {
  imageAssetId: string | null;
  alt: string;
}) {
  const [rota, setRota] = useState(false);
  if (!imageAssetId || rota) {
    return (
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground"
        aria-hidden
      >
        <Megaphone className="h-4 w-4" strokeWidth={1.7} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- adjunto privado servido con sesión
    <img
      src={`/api/media/${imageAssetId}`}
      alt={alt}
      loading="lazy"
      onError={() => setRota(true)}
      className="h-9 w-9 shrink-0 rounded border bg-background object-cover"
    />
  );
}

/**
 * 018 — De qué anuncio llegó esta persona.
 *
 * Muestra la información del creativo y origen de anuncio en el panel de contacto
 * y en el cajón de tratos del pipeline.
 */
export function AnuncioOrigen({ anuncio }: { anuncio: AnuncioDto }) {
  const [imagenRota, setImagenRota] = useState(false);
  const etiqueta = etiquetaDeOrigen(anuncio.sourceType);
  const titular = titularDeOrigen(anuncio.headline, anuncio.sourceType);
  const fecha = new Date(anuncio.capturedAt).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className="rounded-md border border-border-strong bg-card px-3 py-2.5 shadow-sm"
      data-anuncio-origen={anuncio.sourceId ?? ""}
    >
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-brand-text">
        <Megaphone className="h-4 w-4 shrink-0 text-brand" strokeWidth={1.7} />
        {etiqueta === "Anuncio" ? "Llegó por un anuncio" : "Llegó por una publicación"}
      </p>

      <div className="mt-2 flex items-start gap-2.5">
        {anuncio.imageAssetId && !imagenRota && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/media/${anuncio.imageAssetId}`}
            alt={`Creativo: ${titular}`}
            loading="lazy"
            onError={() => setImagenRota(true)}
            className="h-14 w-14 shrink-0 rounded border border-border-strong bg-background object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="break-words text-[13px] font-semibold leading-snug text-foreground">
            {titular}
          </p>
          {anuncio.body && (
            <p className="mt-0.5 line-clamp-3 break-words text-xs text-muted-foreground">
              {anuncio.body}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        <p>
          Primer mensaje · {fecha}
          {anuncio.mediaType === "video" ? " · con video" : ""}
        </p>
        {anuncio.sourceId && (
          <p className="truncate font-mono" title={anuncio.sourceId}>
            ID {anuncio.sourceId}
          </p>
        )}
        {anuncio.hasCtwaClid && <p className="text-brand-text font-medium">Meta identificó el clic</p>}
      </div>

      {anuncio.sourceUrl && (
        <a
          href={anuncio.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-text underline underline-offset-2 hover:text-brand"
        >
          Ver {etiqueta.toLowerCase()}
          <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
        </a>
      )}
    </div>
  );
}
