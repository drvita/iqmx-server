"use client";

import { ExternalLink, Megaphone } from "lucide-react";
import type { AdReferralDto } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Tarjeta contextual que muestra el anuncio de Meta (Click-to-WhatsApp)
 * desde el cual inició la conversación.
 */
export function AdReferralCard({ ad }: { ad?: AdReferralDto | null }) {
  if (!ad) return null;

  return (
    <div className="my-3 flex justify-center px-2">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border-strong bg-card text-card-foreground shadow-sm transition-all hover:shadow-md">
        {/* Cabecera distintiva */}
        <div className="flex items-center justify-between border-b border-border-strong/60 bg-muted/40 px-3.5 py-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-text">
            <Megaphone className="h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={2} />
            <span>Anuncio de Meta · Click-to-WhatsApp</span>
          </div>
          {ad.sourceId && (
            <span className="font-mono text-[10.5px] text-muted-foreground">
              ID: {ad.sourceId}
            </span>
          )}
        </div>

        {/* Contenido publicitario */}
        <div className="p-3.5">
          <div className="flex items-start gap-3">
            {ad.imageUrl && (
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border-strong/80 bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ad.imageUrl}
                  alt={ad.headline ?? "Creativo publicitario"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            )}

            <div className="min-w-0 flex-1">
              {ad.headline && (
                <h4 className="text-[13.5px] font-bold leading-snug tracking-tight text-foreground">
                  {ad.headline}
                </h4>
              )}
              {ad.body && (
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
                  {ad.body}
                </p>
              )}
            </div>
          </div>

          {/* Enlace al anuncio original si existe */}
          {ad.sourceUrl && (
            <div className="mt-3 flex items-center justify-end border-t border-border-strong/40 pt-2.5">
              <a
                href={ad.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-brand-text",
                  "transition-colors hover:bg-brand/10 hover:text-brand"
                )}
              >
                <span>Ver anuncio en Meta</span>
                <ExternalLink className="h-3 w-3" strokeWidth={2} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
