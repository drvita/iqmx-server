"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Loader2, MessageSquare, Phone, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { TemplateButton, TemplateDto } from "@/lib/types";
import { countVariables, validateBodyVariables } from "@/lib/templates";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<
  TemplateDto["status"],
  { label: string; variant: "secondary" | "warning" | "success" | "destructive" }
> = {
  draft: { label: "Borrador", variant: "secondary" },
  pending: { label: "Pendiente de Meta", variant: "warning" },
  approved: { label: "Aprobada", variant: "success" },
  rejected: { label: "Rechazada", variant: "destructive" },
};

type WhatsAppLine = {
  id: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  label: string | null;
  isDefault: boolean;
  status: "connected" | "reconnect_required";
};

export function TemplatesClient() {
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [lines, setLines] = useState<WhatsAppLine[]>([]);
  const [filterPhoneId, setFilterPhoneId] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteTpl = async (tpl: TemplateDto) => {
    if (!confirm(`¿Eliminar la plantilla "${tpl.name}" (${tpl.language})? También se eliminará de Meta si está registrada.`)) {
      return;
    }
    setDeletingId(tpl.id);
    try {
      const res = await fetch(`/api/templates/${tpl.id}`, { method: "DELETE" });
      if (res.ok) {
        void refetch();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        alert(data?.error?.message ?? "No se pudo eliminar la plantilla");
      }
    } catch {
      alert("Error de red al eliminar la plantilla");
    } finally {
      setDeletingId(null);
    }
  };

  const fetchLines = useCallback(async () => {
    const res = await fetch("/api/settings/whatsapp").catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { connections?: WhatsAppLine[] };
    setLines(data.connections ?? []);
  }, []);

  const refetch = useCallback(async (phoneId?: string) => {
    const activeFilter = phoneId !== undefined ? phoneId : filterPhoneId;
    const url =
      activeFilter && activeFilter !== "all"
        ? `/api/templates?phoneNumberId=${encodeURIComponent(activeFilter)}`
        : "/api/templates";
    const res = await fetch(url).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { templates: TemplateDto[] };
    setTemplates(data.templates);
  }, [filterPhoneId]);

  const sync = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setSyncing(true);
        setSyncMsg(null);
      }
      const url =
        filterPhoneId && filterPhoneId !== "all"
          ? `/api/templates/sync?phoneNumberId=${encodeURIComponent(filterPhoneId)}`
          : "/api/templates/sync";
      const res = await fetch(url, { method: "POST" }).catch(() => null);
      if (!silent) setSyncing(false);
      if (res?.ok) {
        const data = (await res.json()) as { updated: number };
        if (!silent) {
          setSyncMsg(
            data.updated > 0
              ? `${data.updated} plantilla(s) actualizada(s)`
              : "Todo al día"
          );
        }
        if (!silent || data.updated > 0) void refetch();
      } else if (!silent) {
        const data = (await res?.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setSyncMsg(data?.error?.message ?? "No se pudo sincronizar");
      }
    },
    [filterPhoneId, refetch]
  );

  useEffect(() => {
    void fetchLines();
    void refetch().then(() => sync({ silent: true }));
  }, [fetchLines, refetch, sync]);

  const lineMap = new Map<string, WhatsAppLine>();
  for (const l of lines) {
    lineMap.set(l.phoneNumberId, l);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Las plantillas permiten reabrir conversaciones con la ventana de 24 h
          cerrada. Meta las aprueba en horas o días y aplican a la línea de WhatsApp
          autorizada. Esta pantalla consulta el estado a Meta automáticamente.
        </p>
        <Button variant="outline" size="sm" disabled={syncing} onClick={() => void sync()}>
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          Sincronizar
        </Button>
      </div>
      {syncMsg && <p className="text-xs text-muted-foreground">{syncMsg}</p>}

      {lines.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center">
            <Phone className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-base font-semibold">Sin líneas de WhatsApp conectadas</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Para crear y gestionar plantillas, conecta primero tu número de WhatsApp en la sección de Canales.
            </p>
            <Link
              href="/settings/channels"
              className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
            >
              Ir a Canales
            </Link>
          </CardContent>
        </Card>
      ) : (
        <CreateForm lines={lines} onCreated={() => void refetch()} />
      )}

      {lines.length > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
          <span className="text-sm font-medium">Filtrar por línea:</span>
          <select
            value={filterPhoneId}
            onChange={(e) => {
              const val = e.target.value;
              setFilterPhoneId(val);
              void refetch(val);
            }}
            className="flex h-9 rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="all">Todas las líneas</option>
            {lines.map((l) => (
              <option key={l.phoneNumberId} value={l.phoneNumberId}>
                {l.label ? `${l.label} · ` : ""}
                {l.displayPhoneNumber ?? l.phoneNumberId}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((t) => {
          const associatedLine = t.phoneNumberId ? lineMap.get(t.phoneNumberId) : null;
          return (
            <div key={t.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-mono text-sm font-medium">
                    {t.name}{" "}
                    <span className="text-muted-foreground text-xs font-normal">
                      ({t.language} · {t.category})
                    </span>
                  </p>
                  {associatedLine && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {associatedLine.label ? `${associatedLine.label} · ` : ""}
                      {associatedLine.displayPhoneNumber ?? associatedLine.phoneNumberId}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_BADGE[t.status].variant}>
                    {STATUS_BADGE[t.status].label}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    title="Eliminar plantilla"
                    disabled={deletingId === t.id}
                    onClick={() => void deleteTpl(t)}
                  >
                    {deletingId === t.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Vista previa enriquecida */}
              <div className="rounded-lg bg-surface-2 p-3 text-sm border border-border/60 space-y-2">
                <p className="whitespace-pre-wrap text-text-1">{t.body}</p>
                {t.footer && (
                  <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-1.5">
                    {t.footer}
                  </p>
                )}
                {t.buttons && t.buttons.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
                    {t.buttons.map((b, i) => (
                      <div
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        {b.type === "URL" ? (
                          <>
                            <ExternalLink className="h-3 w-3" />
                            <span>{b.text}</span>
                          </>
                        ) : (
                          <>
                            <MessageSquare className="h-3 w-3" />
                            <span>{b.text}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {t.status === "rejected" && t.rejectionReason && (
                <p className="text-xs text-destructive">
                  Razón del rechazo: {t.rejectionReason}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t pt-2.5 text-xs text-muted-foreground">
                <span className="font-mono text-[11px]">ID: {t.id}</span>
                <CopyButton text={t.id} label="Copiar ID" />
                <span className="text-border">·</span>
                <span className="font-mono text-[11px]">Nombre: {t.name}</span>
                <CopyButton text={t.name} label="Copiar Nombre" />
              </div>
            </div>
          );
        })}
        {templates.length === 0 && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sin plantillas todavía. Crea la primera arriba para conversaciones frías.
          </p>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copiar ${label}`}
      className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copiado</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

function CreateForm({
  lines,
  onCreated,
}: {
  lines: WhatsAppLine[];
  onCreated: () => void;
}) {
  const [phoneNumberId, setPhoneNumberId] = useState(lines[0]?.phoneNumberId ?? "");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("es_MX");
  const [category, setCategory] = useState<"UTILITY" | "MARKETING">("UTILITY");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mantener phoneNumberId alineado si cambian las líneas
  useEffect(() => {
    if (!phoneNumberId && lines[0]?.phoneNumberId) {
      setPhoneNumberId(lines[0].phoneNumberId);
    }
  }, [lines, phoneNumberId]);

  const bodyError = body.trim() ? validateBodyVariables(body) : null;
  const variableCount = countVariables(body);

  const addButton = (type: "QUICK_REPLY" | "URL") => {
    if (buttons.length >= 3) return;
    if (type === "URL") {
      setButtons([...buttons, { type: "URL", text: "Visitar web", url: "https://" }]);
    } else {
      setButtons([...buttons, { type: "QUICK_REPLY", text: "Confirmar" }]);
    }
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, patch: Partial<TemplateButton>) => {
    setButtons(
      buttons.map((b, i) => {
        if (i !== index) return b;
        return { ...b, ...patch } as TemplateButton;
      })
    );
  };

  async function create() {
    if (!phoneNumberId) {
      setError("Debes seleccionar la línea de WhatsApp a la que pertenece esta plantilla");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phoneNumberId,
        name,
        language,
        category,
        body,
        footer: footer.trim() || undefined,
        buttons: buttons.length > 0 ? buttons : undefined,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(data?.error?.message ?? "No se pudo crear la plantilla");
      return;
    }
    setName("");
    setBody("");
    setFooter("");
    setButtons([]);
    onCreated();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva plantilla</CardTitle>
        <CardDescription>
          Cuerpo con las variables que necesites: numéralas{" "}
          <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>, <code>{"{{3}}"}</code>
          … en orden y sin saltos. Se envía a aprobación de Meta para la línea seleccionada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="tpl-phone">Línea de WhatsApp</Label>
          <select
            id="tpl-phone"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            {lines.map((l) => (
              <option key={l.phoneNumberId} value={l.phoneNumberId}>
                {l.label ? `${l.label} · ` : ""}
                {l.displayPhoneNumber ?? l.phoneNumberId}
                {l.isDefault ? " (predeterminada)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Nombre</Label>
            <Input
              id="tpl-name"
              placeholder="seguimiento_cotizacion"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-lang">Idioma</Label>
            <select
              id="tpl-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="es_MX">es_MX</option>
              <option value="es">es</option>
              <option value="es_AR">es_AR</option>
              <option value="en_US">en_US</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-cat">Categoría</Label>
            <select
              id="tpl-cat"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as "UTILITY" | "MARKETING")
              }
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="UTILITY">UTILITY (seguimiento)</option>
              <option value="MARKETING">MARKETING</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-body">Cuerpo</Label>
          <Textarea
            id="tpl-body"
            rows={3}
            placeholder="Hola {{1}}, te confirmo tu cita el {{2}} a las {{3}}."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {bodyError ? (
            <p className="text-xs text-destructive">{bodyError}</p>
          ) : (
            variableCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {variableCount === 1
                  ? "1 variable: al enviar pedirá su valor."
                  : `${variableCount} variables: al enviar pedirá los ${variableCount} valores.`}
              </p>
            )
          )}
        </div>

        {/* Pie de página (Footer) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="tpl-footer">Pie de página (opcional)</Label>
            <span className="text-[11px] text-muted-foreground">
              {footer.length}/60 caracteres
            </span>
          </div>
          <Input
            id="tpl-footer"
            placeholder="Rastrea tu pedido en icefrutmexico.com"
            maxLength={60}
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Aparece en texto gris al final del mensaje de WhatsApp.
          </p>
        </div>

        {/* Botones (Buttons) */}
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <Label>Botones interactivos (opcional, máx. 3)</Label>
            {buttons.length < 3 && (
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => addButton("URL")}
                >
                  <Plus className="h-3 w-3" />
                  Botón URL
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => addButton("QUICK_REPLY")}
                >
                  <Plus className="h-3 w-3" />
                  Respuesta Rápida
                </Button>
              </div>
            )}
          </div>

          {buttons.map((btn, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-lg border bg-surface-2 p-2 text-sm"
            >
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {btn.type === "URL" ? "URL" : "Rápido"}
              </span>
              <Input
                placeholder="Texto del botón"
                value={btn.text}
                maxLength={25}
                onChange={(e) => updateButton(idx, { text: e.target.value })}
                className="h-8 text-xs max-w-[160px]"
              />
              {btn.type === "URL" && (
                <Input
                  placeholder="https://ejemplo.com"
                  value={btn.url ?? ""}
                  onChange={(e) => updateButton(idx, { url: e.target.value })}
                  className="h-8 text-xs flex-1"
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeButton(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          disabled={saving || !phoneNumberId || !name.trim() || !body.trim() || bodyError !== null}
          onClick={() => void create()}
        >
          {saving ? "Enviando a Meta…" : "Crear y enviar a aprobación"}
        </Button>
      </CardContent>
    </Card>
  );
}
