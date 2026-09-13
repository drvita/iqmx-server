"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 016 — Ajustes → Anuncios: conectar el dataset de Meta, decir qué etapa
 * significa "lead calificado" y ver qué se le ha reportado.
 */

type Capi = {
  datasetId: string;
  status: "connected" | "error";
  tokenLast4: string;
  qualifiedStageId: string | null;
};

type Stage = { id: string; name: string; kind: "open" | "won" | "lost" };

type ActivityRow = {
  id: string;
  eventName: string;
  contactName: string | null;
  adHeadline: string | null;
  status: "pending" | "sent" | "failed" | "skipped";
  at: string;
  fbTraceId: string | null;
  error: string | null;
};

const STATUS_LABEL: Record<ActivityRow["status"], string> = {
  sent: "Enviado",
  failed: "Falló",
  skipped: "Omitido",
  pending: "En curso",
};

const STATUS_VARIANT: Record<
  ActivityRow["status"],
  "success" | "destructive" | "secondary"
> = {
  sent: "success",
  failed: "destructive",
  skipped: "secondary",
  pending: "secondary",
};

/** Qué significa cada evento, en el idioma del negocio y no en el de Meta. */
const EVENT_LABEL: Record<string, string> = {
  QualifiedLead: "Lead calificado",
  Purchase: "Venta",
};

export function AdsClient() {
  const [capi, setCapi] = useState<Capi | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [datasetId, setDatasetId] = useState("");
  const [token, setToken] = useState("");
  const [qualifiedStageId, setQualifiedStageId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [detectingDataset, setDetectingDataset] = useState(false);
  const [detectSuccess, setDetectSuccess] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<
    Array<{
      wabaId: string;
      phoneNumber: string | null;
      label: string | null;
      datasetId: string | null;
      error: string | null;
    }> | null
  >(null);

  const loadActivity = useCallback(async () => {
    const res = await fetch("/api/settings/capi/events").catch(() => null);
    if (!res?.ok) return setActivity([]);
    const data = (await res.json()) as { events: ActivityRow[] };
    setActivity(data.events);
  }, []);

  async function detectDataset() {
    setDetectingDataset(true);
    setError(null);
    setDetectSuccess(null);
    try {
      const res = await fetch("/api/settings/capi/waba-dataset");
      const data = (await res.json()) as {
        ok?: boolean;
        datasetId?: string;
        accounts?: Array<{
          wabaId: string;
          phoneNumber: string | null;
          label: string | null;
          datasetId: string | null;
          error: string | null;
        }>;
        error?: string;
      };
      if (res.ok && (data.datasetId || (data.accounts && data.accounts.length > 0))) {
        if (data.datasetId) {
          setDatasetId(data.datasetId);
        }
        if (data.accounts) {
          setAccounts(data.accounts);
        }
        if (data.accounts && data.accounts.length > 1) {
          setDetectSuccess(
            `Se detectaron ${data.accounts.length} cuentas de WhatsApp (Multi-WABA). Vocero enruta automáticamente cada evento a su dataset.`
          );
        } else if (data.datasetId) {
          setDetectSuccess(
            `Dataset ${data.datasetId} detectado y vinculado a WhatsApp.`
          );
        }
      } else {
        setError(data.error ?? "No se pudo obtener el dataset de WhatsApp.");
      }
    } catch {
      setError("Error al consultar Meta para detectar el dataset.");
    } finally {
      setDetectingDataset(false);
    }
  }

  async function retryEvent(eventId: string) {
    setRetryingId(eventId);
    setRetryError(null);
    try {
      const res = await fetch("/api/settings/capi/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setRetryError(body?.error?.message ?? "Falló el reintento");
      }
    } catch {
      setRetryError("Error de conexión al reintentar");
    } finally {
      setRetryingId(null);
      await loadActivity();
    }
  }

  useEffect(() => {
    void (async () => {
      const [cfg, stg] = await Promise.all([
        fetch("/api/settings/capi").catch(() => null),
        fetch("/api/pipeline/stages").catch(() => null),
      ]);
      if (cfg?.ok) {
        const data = (await cfg.json()) as { capi: Capi | null };
        setCapi(data.capi);
        setDatasetId(data.capi?.datasetId ?? "");
        setQualifiedStageId(data.capi?.qualifiedStageId ?? "");
      }
      if (stg?.ok) {
        const data = (await stg.json()) as { stages: Stage[] };
        setStages(data.stages);
      }
      await loadActivity();
    })();
  }, [loadActivity]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/settings/capi", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        datasetId: datasetId.trim(),
        // Vacío = reusar el token de WhatsApp. Se omite en vez de mandar "".
        ...(token.trim() ? { token: token.trim() } : {}),
        qualifiedStageId: qualifiedStageId || null,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(body?.error?.message ?? "No se pudo guardar");
      return;
    }
    setToken("");
    setSaved(true);
    const cfg = await fetch("/api/settings/capi").catch(() => null);
    if (cfg?.ok) {
      const data = (await cfg.json()) as { capi: Capi | null };
      setCapi(data.capi);
    }
  }

  async function disconnect() {
    setSaving(true);
    await fetch("/api/settings/capi", { method: "DELETE" }).catch(() => null);
    setSaving(false);
    setCapi(null);
    setDatasetId("");
    setToken("");
    setQualifiedStageId("");
    setSaved(false);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Conversiones de anuncios</CardTitle>
          <CardDescription>
            Meta sabe qué conversaciones empezaron desde un anuncio, pero no
            cuáles sirvieron. Conecta tu dataset y el CRM le avisará cuándo un
            lead se califica y cuándo se cierra la venta, para que optimice
            hacia quien compra y no hacia quien solo escribe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {capi ? (
            <p className="text-sm text-muted-foreground">
              Conectado al dataset{" "}
              <span className="font-medium text-foreground">
                {capi.datasetId}
              </span>{" "}
              · token ····{capi.tokenLast4}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="capi-dataset">ID del conjunto de datos (Dataset)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-primary hover:text-primary/80 px-2"
                disabled={detectingDataset}
                onClick={() => void detectDataset()}
              >
                {detectingDataset ? "Detectando…" : "Detectar de WhatsApp"}
              </Button>
            </div>
            <Input
              id="capi-dataset"
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              placeholder="1708105527110154"
            />
            {detectSuccess ? (
              <p className="text-xs text-success-text">{detectSuccess}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Meta exige que el dataset esté vinculado a tu WhatsApp Business Account (WABA).
                Puedes pulsar &quot;Detectar de WhatsApp&quot; para obtenerlo automáticamente.
              </p>
            )}

            {accounts && accounts.length > 1 && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between font-medium text-foreground">
                  <span>Cuentas de WhatsApp (Multi-WABA)</span>
                  <span className="text-[10px] tracking-wide bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                    Enrutamiento automático
                  </span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Cada evento se reporta al dataset vinculado a la cuenta de WhatsApp que atendió la conversación.
                </p>
                <div className="divide-y divide-border/60 pt-1">
                  {accounts.map((acc) => (
                    <div
                      key={acc.wabaId}
                      className="flex items-center justify-between py-1.5 font-mono text-[11px]"
                    >
                      <div className="truncate pr-2">
                        <span className="font-medium text-foreground font-sans mr-2">
                          {acc.label || acc.phoneNumber || "Línea WhatsApp"}
                        </span>
                        <span className="text-muted-foreground">WABA: {acc.wabaId}</span>
                      </div>
                      <div className="shrink-0">
                        {acc.datasetId ? (
                          <span className="text-success-text font-medium">
                            Dataset: {acc.datasetId}
                          </span>
                        ) : (
                          <span className="text-destructive font-medium">
                            {acc.error || "Sin dataset"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="capi-token">Token (opcional)</Label>
            <Input
              id="capi-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Déjalo vacío para reusar el de WhatsApp"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Para evitar errores de permisos, genera este token en Administrador
              de eventos de Meta → tu Conjunto de datos → Configuración → API de
              conversiones → Generar token de acceso.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="capi-stage">¿Qué etapa es un lead calificado?</Label>
            <select
              id="capi-stage"
              value={qualifiedStageId}
              onChange={(e) => setQualifiedStageId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
            >
              <option value="">No reportar leads calificados</option>
              {stages
                .filter((s) => s.kind === "open")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <p className="text-xs text-muted-foreground">
              La venta se reporta sola cuando el trato entra a tu etapa ganada.
            </p>
          </div>

          {error ? (
            <p className="text-sm text-danger-text" role="alert">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="text-sm text-success-text">Guardado.</p>
          ) : null}

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !datasetId.trim()}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
            {capi ? (
              <Button variant="outline" onClick={disconnect} disabled={saving}>
                Desconectar
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1 pr-4">
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>
              Lo último que se le reportó a Meta. Si algo no salió, aquí dice por
              qué — es la forma de saber si esto funciona, sin salir del CRM.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadActivity()}
            className="shrink-0"
          >
            Actualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {retryError ? (
            <div
              className="rounded-lg border border-destructive/25 bg-destructive/10 p-3.5 text-xs text-destructive leading-relaxed"
              role="alert"
            >
              <div className="font-semibold mb-1 flex items-center gap-1.5 text-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                Respuesta de Meta CAPI
              </div>
              <p className="text-muted-foreground break-words">{retryError}</p>
            </div>
          ) : null}

          {activity === null ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Cargando actividad…</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Todavía no hay conversiones. Aparecerán cuando un lead que llegó
              por un anuncio avance de etapa.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-3 font-medium min-w-[140px]">Evento</th>
                    <th className="py-2.5 px-3 font-medium min-w-[120px]">Contacto</th>
                    <th className="py-2.5 px-3 font-medium min-w-[90px]">Estado</th>
                    <th className="py-2.5 px-3 font-medium min-w-[150px]">Cuándo</th>
                    <th className="py-2.5 px-3 font-medium min-w-[220px]">Detalle</th>
                    <th className="py-2.5 px-3 text-right font-medium min-w-[110px]">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activity.map((row) => (
                    <tr key={row.id} className="align-middle hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-foreground">
                          {EVENT_LABEL[row.eventName] ?? row.eventName}
                        </span>
                        {row.adHeadline ? (
                          <span
                            className="block text-xs text-muted-foreground line-clamp-1 mt-0.5"
                            title={row.adHeadline}
                          >
                            {row.adHeadline}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 text-foreground whitespace-nowrap">
                        {row.contactName ?? "—"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <Badge variant={STATUS_VARIANT[row.status]}>
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(row.at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-xs md:max-w-md">
                        <span
                          className="line-clamp-2 cursor-help"
                          title={row.error ?? row.fbTraceId ?? undefined}
                        >
                          {row.error ?? row.fbTraceId ?? "—"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {row.status === "failed" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={retryingId === row.id}
                            onClick={() => void retryEvent(row.id)}
                            className="h-7 px-2.5 text-xs font-medium"
                          >
                            {retryingId === row.id
                              ? "Reintentando…"
                              : "Reintentar"}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
