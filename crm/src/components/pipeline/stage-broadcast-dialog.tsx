"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Filter,
  Loader2,
  Megaphone,
  Send,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LOSS_REASON_LABEL, type LossReason, type StageDto } from "@/lib/types";

type TemplateItem = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  body: string;
};

type RecipientItem = {
  leadId: string;
  contactId: string;
  name: string;
  phone: string | null;
  waIdentity: string;
  lossReason: LossReason | null;
};

type BroadcastResult = {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: { contactName: string; reason: string }[];
};

export function StageBroadcastDialog({
  stage,
  onClose,
  onCompleted,
}: {
  stage: StageDto;
  onClose: () => void;
  onCompleted?: () => void;
}) {
  const [lossReasonFilter, setLossReasonFilter] = useState<string>("all");
  const [loadingAudience, setLoadingAudience] = useState(true);
  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [variables, setVariables] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cargar lista de plantillas aprobadas
  useEffect(() => {
    fetch("/api/templates")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.templates) {
          const approved = (data.templates as TemplateItem[]).filter(
            (t) => t.status === "approved"
          );
          setTemplates(approved);
          if (approved[0]) {
            setSelectedTemplateId(approved[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Cargar audiencia según el filtro seleccionado
  useEffect(() => {
    setLoadingAudience(true);
    setErrorMessage(null);
    const query =
      stage.kind === "lost" && lossReasonFilter !== "all"
        ? `?lossReason=${encodeURIComponent(lossReasonFilter)}`
        : "";

    fetch(`/api/pipeline/stages/${stage.id}/broadcast${query}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.recipients) {
          setRecipients(data.recipients);
        }
      })
      .catch(() => {
        setErrorMessage("No se pudo calcular la audiencia.");
      })
      .finally(() => {
        setLoadingAudience(false);
      });
  }, [stage.id, stage.kind, lossReasonFilter]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const varMatches = selectedTemplate ? selectedTemplate.body.match(/\{\{\d+\}\}/g) || [] : [];
  const varCount = varMatches.length;

  // Ajustar el arreglo de variables cuando cambia la plantilla
  useEffect(() => {
    if (varCount > 0) {
      setVariables((prev) => {
        const next = [...prev];
        while (next.length < varCount) {
          // Por defecto la primera variable suele ser el nombre del cliente
          next.push(next.length === 0 ? "{{nombre}}" : "");
        }
        return next.slice(0, varCount);
      });
    } else {
      setVariables([]);
    }
  }, [varCount, selectedTemplateId]);

  async function handleSend() {
    if (!selectedTemplateId) return;
    setIsSending(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/pipeline/stages/${stage.id}/broadcast`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          lossReason: stage.kind === "lost" ? lossReasonFilter : undefined,
          variableMappings: variables,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || "Error al enviar la difusión");
      }

      setResult(data as BroadcastResult);
      if (onCompleted) onCompleted();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setErrorMessage(msg);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Difusión por etapa"
        className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-lg border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-tint text-primary">
              <Megaphone className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Enviar Difusión · {stage.name}
              </h3>
              <p className="text-xs text-text-3">
                Envía una plantilla de WhatsApp a los prospectos en esta etapa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-3 hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Si ya terminó el envío, mostrar pantalla de resultados */}
          {result ? (
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-tint text-success">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-semibold">Difusión Finalizada</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Se procesó el envío masivo para los contactos de la etapa.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-lg border bg-subtle p-3 text-center">
                <div>
                  <span className="block text-xs text-muted-foreground">Enviados</span>
                  <span className="text-lg font-bold text-success">{result.sent}</span>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">Omitidos (Sin WA)</span>
                  <span className="text-lg font-bold text-muted-foreground">{result.skipped}</span>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">Fallidos</span>
                  <span className="text-lg font-bold text-danger-text">{result.failed}</span>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-left">
                  <span className="block text-xs font-semibold text-destructive mb-1">
                    Detalle de errores ({result.errors.length}):
                  </span>
                  <ul className="max-h-28 overflow-y-auto space-y-1 text-[11px] text-muted-foreground">
                    {result.errors.map((err, idx) => (
                      <li key={idx}>
                        <strong>{err.contactName}:</strong> {err.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button onClick={onClose} className="w-full mt-2">
                Aceptar y Cerrar
              </Button>
            </div>
          ) : (
            <>
              {/* Filtro por motivo de pérdida si la etapa es lost */}
              {stage.kind === "lost" && (
                <div className="rounded-lg border bg-subtle p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-primary" />
                    <Label className="text-xs font-semibold">
                      Filtrar por Motivo de Pérdida
                    </Label>
                  </div>
                  <select
                    value={lossReasonFilter}
                    onChange={(e) => setLossReasonFilter(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="all">
                      Todos los motivos (Toda la etapa Perdidos)
                    </option>
                    {(Object.keys(LOSS_REASON_LABEL) as LossReason[]).map((r) => (
                      <option key={r} value={r}>
                        Solo: {LOSS_REASON_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Resumen de Destinatarios */}
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-4 w-4 text-text-3" />
                  Destinatarios calculados:
                </span>
                {loadingAudience ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Calculando…
                  </span>
                ) : (
                  <span className="font-bold text-foreground">
                    {recipients.length} prospectos
                  </span>
                )}
              </div>

              {/* Selector de Plantilla */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Plantilla Aprobada</Label>
                {templates.length === 0 ? (
                  <div className="rounded-md border border-brand-soft bg-brand-tint p-3 text-xs text-muted-foreground">
                    No tienes plantillas aprobadas disponibles en este momento. Puedes crearlas o sincronizarlas en{" "}
                    <strong>Ajustes → Plantillas</strong>.
                  </div>
                ) : (
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.language}) · {t.category}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Vista previa y variables */}
              {selectedTemplate && (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-subtle p-3">
                    <span className="block text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1">
                      Vista Previa del Mensaje
                    </span>
                    <p className="whitespace-pre-wrap text-xs text-foreground bg-background p-2.5 rounded border">
                      {selectedTemplate.body}
                    </p>
                  </div>

                  {varCount > 0 && (
                    <div className="space-y-2 border-t pt-2">
                      <Label className="text-xs font-semibold">
                        Configurar Variables ({varCount})
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Usa <code>{"{{nombre}}"}</code> para insertar automáticamente el primer nombre del contacto.
                      </p>
                      <div className="space-y-2">
                        {Array.from({ length: varCount }).map((_, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="w-12 shrink-0 font-mono text-xs font-semibold text-text-3">
                              {`{{${idx + 1}}}`}
                            </span>
                            <Input
                              value={variables[idx] || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setVariables((prev) => {
                                  const next = [...prev];
                                  next[idx] = val;
                                  return next;
                                });
                              }}
                              placeholder={`Valor para {{${idx + 1}}} (ej: {{nombre}})`}
                              className="h-8 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mensaje de error si falla */}
              {errorMessage && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div className="flex items-center justify-between border-t px-5 py-3 bg-subtle">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSending}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={
                isSending ||
                recipients.length === 0 ||
                !selectedTemplateId ||
                loadingAudience
              }
              className="flex items-center gap-1.5"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando {recipients.length} mensajes…
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Enviar Difusión ({recipients.length})
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
