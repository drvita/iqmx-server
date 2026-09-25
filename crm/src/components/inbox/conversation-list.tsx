"use client";

import { useEffect, useRef, useState } from "react";
import { Megaphone, Search, Sparkles, UserRound, X } from "lucide-react";
import type { ConversationDto, ConversationLineDto } from "@/lib/types";
import { CHANNEL_LABEL, type Channel } from "@/lib/channels";
import { ChannelBadge } from "@/components/channel-badge";
import { matchesQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import { etiquetaDeOrigen, titularDeOrigen } from "@/lib/anuncios";
import { ContactAvatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { formatTime, previewText } from "./helpers";
import { LineBadge, getLineColor } from "./line-badge";

/* Puntos de etapa con la paleta de la landing: azul, ámbar, verde WhatsApp. */
const STAGE_DOT: Record<string, string> = {
  Nuevo: "#8391aa",
  "En conversación": "#0d5bff",
  Interesado: "#f2a71b",
  Cliente: "#1fb35b",
  Perdido: "#d94a4a",
};
const STAGE_DOT_FALLBACK = "#8391aa";

function EmptyState({ onSeeded }: { onSeeded: () => void }) {
  const [seeding, setSeeding] = useState(false);
  const [failed, setFailed] = useState(false);

  async function seed() {
    setSeeding(true);
    const res = await fetch("/api/seed/demo", { method: "POST" }).catch(
      () => null
    );
    setSeeding(false);
    if (res?.ok) onSeeded();
    else setFailed(true);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-serif text-[21px] italic leading-tight text-foreground">
        Sin conversaciones todavía
      </p>
      <p className="text-xs text-text-3">
        Cuando alguien escriba a tu número de WhatsApp, su conversación
        aparecerá aquí en tiempo real.
      </p>
      {!failed && (
        <Button
          size="sm"
          variant="outline"
          disabled={seeding}
          onClick={() => void seed()}
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.7} />
          {seeding ? "Cargando demo…" : "Cargar datos de demostración"}
        </Button>
      )}
    </div>
  );
}

export function ConversationList({
  conversations: conversationsProp,
  channels,
  lines = [],
  selectedId,
  onSelect,
  onSeeded,
}: {
  conversations: ConversationDto[] | null;
  /** Canales encendidos en esta instancia (ADR-001). */
  channels: readonly Channel[];
  /** Cuentas / líneas telefónicas a las que tiene acceso el usuario. */
  lines?: readonly ConversationLineDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSeeded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "anuncios">("all");
  const [stage, setStage] = useState<string>("all");
  const [inbox, setInbox] = useState<Channel | "all">("all");
  const [lineFilter, setLineFilter] = useState<string | "all">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Rescate de lo tecleado ANTES de que hidratara el JS. La caja se pinta en
   * el HTML del servidor, así que se puede escribir en ella mientras carga la
   * página; al montar, React la dejaba vacía y esas pulsaciones se perdían en
   * silencio (el usuario veía la lista entera "sin filtrar"). Por eso el input
   * es NO controlado: el DOM manda y aquí solo adoptamos su valor.
   */
  useEffect(() => {
    const typed = inputRef.current?.value ?? "";
    if (typed) setQuery(typed);
  }, []);

  const loading = conversationsProp === null;
  const conversations = conversationsProp ?? [];

  // Regla de rol y multi-cuenta: solo se muestra el filtro si el usuario tiene acceso a 2 o más líneas
  const showLineFilter = (lines?.length ?? 0) > 1;

  // Solo NOMBRE y TELÉFONO, como cualquier filtro de contactos.
  const searched = conversations.filter(
    (c) =>
      matchesQuery(query, {
        text: [c.contact.name],
        phone: c.contact.phone,
      }) && (stage === "all" || c.stageName === stage)
  );

  // Filtro por canal (WhatsApp, Instagram, etc.)
  const inInbox =
    inbox === "all" ? searched : searched.filter((c) => c.channel === inbox);

  // Filtro por cuenta / línea de WhatsApp
  const inLine =
    !showLineFilter || lineFilter === "all"
      ? inInbox
      : inInbox.filter((c) => c.phoneNumberId === lineFilter);

  const inboxCount = (ch: Channel) =>
    searched.filter((c) => c.channel === ch).length;

  const lineCount = (phoneNumberId: string) =>
    inInbox.filter((c) => c.phoneNumberId === phoneNumberId).length;

  const unreadCount = inLine.filter((c) => c.unreadCount > 0).length;
  const anunciosCount = inLine.filter((c) => Boolean(c.anuncio)).length;
  const visible =
    filter === "unread"
      ? inLine.filter((c) => c.unreadCount > 0)
      : filter === "anuncios"
        ? inLine.filter((c) => Boolean(c.anuncio))
        : inLine;

  // Distinguir bandejas si hay más de un canal habilitado o con conversaciones activas
  const availableChannels = Array.from(
    new Set([...channels, ...conversations.map((c) => c.channel)])
  );
  const multiChannel = availableChannels.length > 1;

  // Etapas presentes en la bandeja, en el orden en que llegan del pipeline.
  const stages: string[] = [];
  for (const c of conversations) {
    if (c.stageName && !stages.includes(c.stageName)) stages.push(c.stageName);
  }

  function clearQuery() {
    if (inputRef.current) inputRef.current.value = "";
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-[17px] font-bold tracking-tight">Bandeja</h2>
          <span className="font-mono text-[12px] text-text-3">{conversations.length}</span>
          {multiChannel && (
            <div className="ml-auto flex items-center gap-1">
              {availableChannels.map((ch) => {
                const on = inbox === ch;
                return (
                  <button
                    key={ch}
                    onClick={() => setInbox(on ? "all" : ch)}
                    aria-pressed={on}
                    title={
                      on
                        ? "Ver todas las bandejas"
                        : `Ver solo ${CHANNEL_LABEL[ch]}`
                    }
                    className={cn(
                      "flex items-center gap-1 rounded-full border py-[3px] pl-[5px] pr-2 text-[11.5px] font-medium transition-colors",
                      on
                        ? "border-brand bg-brand-veil text-foreground"
                        : "text-text-3 hover:bg-accent",
                      inbox !== "all" && !on && "opacity-45"
                    )}
                  >
                    <ChannelBadge
                      channel={ch}
                      className="h-[13px] w-[13px] rounded-[4px]"
                    />
                    {inboxCount(ch)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border-strong bg-background px-3.5 py-[7px] shadow-sm transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-soft">
          <Search className="h-4 w-4 shrink-0 text-text-3" strokeWidth={1.7} />
          <input
            ref={inputRef}
            placeholder="Buscar por nombre o teléfono…"
            aria-label="Buscar conversación"
            defaultValue=""
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-text-3"
          />
          {query && (
            <button
              onClick={clearQuery}
              aria-label="Limpiar búsqueda"
              className="shrink-0 rounded-full p-0.5 text-text-3 hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      </header>

      {/* Selector de cuenta de WhatsApp: se muestra SOLO si el usuario tiene acceso a 2 o más cuentas */}
      {showLineFilter && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b bg-subtle/35 px-4 py-2 scrollbar-none">
          <button
            onClick={() => setLineFilter("all")}
            aria-pressed={lineFilter === "all"}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
              lineFilter === "all"
                ? "border-brand bg-brand text-brand-fg shadow-xs"
                : "border-border-strong bg-background text-text-2 hover:border-text-3"
            )}
          >
            Todas las cuentas
            <span
              className={cn(
                "rounded-full px-1.5 text-[10.5px]",
                lineFilter === "all"
                  ? "bg-brand-veil text-brand-fg"
                  : "bg-secondary text-text-3"
              )}
            >
              {inInbox.length}
            </span>
          </button>
          {lines.map((l) => {
            const active = lineFilter === l.phoneNumberId;
            const count = lineCount(l.phoneNumberId);
            const colors = getLineColor(l.phoneNumberId ?? l.name);
            return (
              <button
                key={l.phoneNumberId}
                onClick={() => setLineFilter(active ? "all" : l.phoneNumberId)}
                aria-pressed={active}
                style={
                  active
                    ? {
                        backgroundColor: colors.bg,
                        borderColor: colors.accentBorder,
                        color: colors.text,
                      }
                    : undefined
                }
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                  active
                    ? "shadow-xs"
                    : "border-border-strong bg-background text-text-2 hover:border-text-3"
                )}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: colors.dot }}
                />
                <span className="truncate max-w-[120px]">{l.name}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10.5px]",
                    active ? "bg-background/80" : "bg-secondary text-text-3"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
        {(
          [
            { id: "all", label: "Todas", count: inLine.length },
            { id: "unread", label: "No leídas", count: unreadCount },
            { id: "anuncios", label: "Anuncios", count: anunciosCount },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[5px] text-[12.5px] font-semibold transition-colors",
              filter === f.id
                ? "border-brand bg-brand text-brand-fg"
                : "border-border-strong bg-background text-text-2 hover:border-text-3"
            )}
          >
            {f.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px]",
                filter === f.id ? "bg-brand-veil" : "bg-secondary text-text-3"
              )}
            >
              {f.count}
            </span>
          </button>
        ))}

        {stages.length > 0 && (
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            aria-label="Filtrar por etapa del embudo"
            className={cn(
              "ml-auto min-w-0 max-w-[42%] truncate rounded-full border px-2 py-[5px] text-[12.5px] font-semibold transition-colors",
              stage === "all"
                ? "border-border-strong bg-background text-text-2 hover:border-text-3"
                : "border-brand bg-brand text-brand-fg"
            )}
          >
            <option value="all">Toda etapa</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-6 text-center text-xs text-text-3">Cargando…</p>
        ) : conversations.length === 0 ? (
          <EmptyState onSeeded={onSeeded} />
        ) : visible.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-3">
            Sin resultados para este filtro.
          </p>
        ) : (
          <ul>
            {visible.map((c) => {
              const unread = c.unreadCount > 0;
              const active = selectedId === c.id;
              const lineColor =
                showLineFilter && c.phoneNumberId
                  ? getLineColor(c.phoneNumberId ?? c.lineName ?? "")
                  : null;

              return (
                <li key={c.id} className="relative border-b border-border">
                  {active ? (
                    <span className="absolute inset-y-0 left-0 w-[3px] bg-brand" />
                  ) : lineColor ? (
                    <span
                      className="absolute inset-y-0 left-0 w-[3px] opacity-80"
                      style={{ backgroundColor: lineColor.dot }}
                    />
                  ) : null}
                  <button
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      "flex w-full items-start gap-[11px] px-4 py-[var(--row-py)] text-left transition-colors",
                      active ? "bg-[var(--bg-active)]" : "hover:bg-subtle"
                    )}
                  >
                    <span className="relative shrink-0">
                      <ContactAvatar name={c.contact.name} seed={c.contact.id} size="lg" />
                      {c.windowOpen && (
                        <span className="absolute bottom-0 right-0 h-[11px] w-[11px] rounded-full border-[2.5px] border-background bg-success" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {multiChannel && <ChannelBadge channel={c.channel} />}
                          <span
                            className={cn(
                              "truncate text-sm",
                              unread ? "font-[680]" : "font-semibold"
                            )}
                          >
                            {c.contact.name}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-mono text-[10.5px] tracking-[0.02em]",
                            unread ? "font-semibold text-brand" : "text-text-3"
                          )}
                        >
                          {formatTime(c.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-[13px]",
                            unread ? "font-medium text-text-2" : "text-text-3"
                          )}
                        >
                          {previewText(c.preview)}
                        </span>
                        {unread && (
                          <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[10.5px] font-semibold text-brand-fg">
                            {c.unreadCount}
                          </span>
                        )}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
                        <span className="flex items-center gap-1.5">
                          {c.channel === "whatsapp" && c.lineName ? (
                            <LineBadge
                              name={c.lineName}
                              seed={c.phoneNumberId ?? c.lineName}
                              size="xs"
                              showIcon
                            />
                          ) : c.accountName ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-background px-2 py-0.5 text-[11px] font-medium text-text-3">
                              {c.accountName}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex items-center gap-1.5">
                          {c.stageName && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-background px-2 py-0.5 text-[11px] font-medium text-text-2">
                              <span
                                className="h-[7px] w-[7px] rounded-full"
                                style={{
                                  background: STAGE_DOT[c.stageName] ?? STAGE_DOT_FALLBACK,
                                }}
                              />
                              {c.stageName}
                            </span>
                          )}
                          {c.handoffAt && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-warning-soft bg-warning-tint px-2 py-0.5 text-[11px] text-warning-text">
                              <UserRound className="h-3 w-3" strokeWidth={1.7} />
                              Atención humana
                            </span>
                          )}
                          {c.anuncio && (
                            <span
                              className="inline-flex min-w-0 max-w-[150px] items-center gap-1 rounded-full border border-info-soft bg-info-tint px-2 py-0.5 text-[11px] text-info-text"
                              title={titularDeOrigen(c.anuncio.headline, c.anuncio.sourceType)}
                            >
                              <Megaphone className="h-3 w-3 shrink-0" strokeWidth={1.7} />
                              <span className="truncate">
                                {etiquetaDeOrigen(c.anuncio.sourceType)}
                                {c.anuncio.headline ? ` · ${c.anuncio.headline}` : ""}
                              </span>
                            </span>
                          )}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
