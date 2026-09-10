"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Edit3,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type LabScenarioItem = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  contactName: string;
  syntheticPhone: string;
  script: string[];
  isCustom: boolean;
  isDefaultFallback?: boolean;
};

interface ScenarioEditorProps {
  scenarios: LabScenarioItem[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  assistantId?: string;
  testType?: "sandbox" | "agenda_flow" | "guardrails";
  suiteTitle?: string;
}

export function ScenarioEditor({
  scenarios,
  isOpen,
  onClose,
  onRefresh,
  assistantId,
  testType = "sandbox",
  suiteTitle = "Simulación de Ventas y Atención",
}: ScenarioEditorProps) {
  const [selectedKey, setSelectedKey] = useState<string>(
    scenarios[0]?.key ?? "",
  );
  const [editingScript, setEditingScript] = useState<string[]>([]);
  const [editingLabel, setEditingLabel] = useState<string>("");
  const [editingDesc, setEditingDesc] = useState<string>("");
  const [editingContact, setEditingContact] = useState<string>("");
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function resetFormState() {
    setSelectedKey("");
    setEditingScript([]);
    setEditingLabel("");
    setEditingDesc("");
    setEditingContact("");
    setActiveScenarioId(null);
    setMessage(null);
  }

  // Sincronizar estado local limpiamente al abrir o cambiar de suite/asistente/escenarios
  useEffect(() => {
    if (!isOpen) {
      resetFormState();
      return;
    }
    if (scenarios.length > 0) {
      const initial = scenarios.find((s) => s.key === selectedKey) ?? scenarios[0]!;
      setSelectedKey(initial.key);
      setActiveScenarioId(initial.id.startsWith("default_") ? null : initial.id);
      setEditingScript([...initial.script]);
      setEditingLabel(initial.label);
      setEditingDesc(initial.description ?? "");
      setEditingContact(initial.contactName);
      setMessage(null);
    } else {
      resetFormState();
    }
  }, [isOpen, testType, assistantId, scenarios]);

  // Seleccionar automáticamente el escenario de la suite activa
  const activeScenario =
    scenarios.find((s) => s.key === selectedKey) ?? scenarios[0] ?? null;

  // Sincronizar estado local al cambiar de escenario
  function selectScenario(item: LabScenarioItem) {
    setSelectedKey(item.key);
    setActiveScenarioId(item.id.startsWith("default_") ? null : item.id);
    setEditingScript([...item.script]);
    setEditingLabel(item.label);
    setEditingDesc(item.description ?? "");
    setEditingContact(item.contactName);
    setMessage(null);
  }

  function handleAddQuestion() {
    setEditingScript((prev) => [...prev, ""]);
  }

  function handleUpdateQuestion(index: number, val: string) {
    setEditingScript((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  }

  function handleRemoveQuestion(index: number) {
    if (editingScript.length <= 1) return;
    setEditingScript((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleGenerateWithAi(forceAll: boolean = false) {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/lab/scenarios/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceAll, assistantId, testType }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error?.message ?? "Error al generar escenarios con IA",
        );
      }
      await onRefresh();
      setMessage({
        type: "success",
        text: "¡Preguntas generadas y adaptadas exitosamente a tu negocio!",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error al generar",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveScenario() {
    if (!activeScenario) return;
    setSaving(true);
    setMessage(null);

    const cleanScript = editingScript.map((s) => s.trim()).filter(Boolean);
    if (cleanScript.length === 0) {
      setMessage({
        type: "error",
        text: "El guion debe tener al menos una pregunta o mensaje del cliente.",
      });
      setSaving(false);
      return;
    }

    try {
      if (activeScenarioId) {
        // Actualizar existente
        const res = await fetch(`/api/lab/scenarios/${activeScenarioId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: editingLabel,
            description: editingDesc,
            contactName: editingContact,
            script: cleanScript,
          }),
        });
        if (!res.ok) throw new Error("No se pudieron guardar los cambios");
      } else {
        // Primer guardado de un escenario que era default
        const res = await fetch("/api/lab/scenarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: activeScenario.key,
            label: editingLabel,
            description: editingDesc,
            contactName: editingContact,
            script: cleanScript,
            assistantId,
            testType,
          }),
        });
        if (!res.ok)
          throw new Error("No se pudo crear el escenario personalizado");
      }

      await onRefresh();
      setMessage({
        type: "success",
        text: "Guion de preguntas guardado correctamente.",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error al guardar cambios",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const hasOnlyDefaultFallback = scenarios.length > 0 && scenarios.every((s) => s.isDefaultFallback);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header del Modal */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-primary" />
                Preguntas de Prueba: {suiteTitle}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Personaliza o genera con IA las preguntas que enviará el cliente simulado en cada perfil.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleGenerateWithAi(false)}
              disabled={generating}
              className="gap-1.5"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Sparkles className="h-4 w-4 text-primary" />
              )}
              {generating ? "Generando con IA…" : "Adaptar a mi negocio con IA"}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                resetFormState();
                onClose();
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Banner Informativo si se usan preguntas base recomendadas */}
        {hasOnlyDefaultFallback && (
          <div className="flex items-center gap-2 bg-primary/10 border-b border-primary/20 px-6 py-2.5 text-xs text-primary font-medium">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>
              Estas son las preguntas base recomendadas para {suiteTitle}. Puedes editarlas directamente o pulsar <strong>"Adaptar a mi negocio con IA"</strong> para generar un set especializado con tus productos o servicios.
            </span>
          </div>
        )}

        {/* Notificaciones */}
        {message && (
          <div
            className={`flex items-center gap-2 px-6 py-2.5 text-xs font-medium ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-500 border-b border-emerald-500/20"
                : "bg-destructive/10 text-destructive border-b border-destructive/20"
            }`}
          >
            {message.type === "success" ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {message.text}
          </div>
        )}

        {/* Contenido dividido: Lista de escenarios a la izq, Editor de preguntas a la der */}
        <div className="grid flex-1 grid-cols-1 md:grid-cols-[300px_1fr] overflow-hidden">
          {/* Columna Izquierda: Escenarios */}
          <div className="border-r overflow-y-auto p-4 space-y-2 bg-muted/10">
            <div className="px-1 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Perfiles de Prueba ({scenarios.length})
            </div>
            {scenarios.map((sc) => {
              const isSelected = sc.key === selectedKey;
              return (
                <button
                  key={sc.key}
                  onClick={() => selectScenario(sc)}
                  className={`w-full text-left rounded-lg p-3 transition-all border ${
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground shadow-sm"
                      : "border-transparent hover:bg-accent/50 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">
                      {sc.label}
                    </span>
                    {sc.isCustom ? (
                      <Badge variant="secondary" className="text-[10px] py-0">
                        Manual
                      </Badge>
                    ) : sc.isDefaultFallback ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 text-muted-foreground"
                      >
                        Base
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 text-primary border-primary/30"
                      >
                        IA
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {sc.description || `${sc.script.length} preguntas`}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Columna Derecha: Editor del Guion de Preguntas */}
          <div className="flex flex-col overflow-y-auto p-6 space-y-6">
            {activeScenario ? (
              <>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="scenario-label" className="text-xs">
                        Nombre del Perfil
                      </Label>
                      <Input
                        id="scenario-label"
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        placeholder="Ej. Comprador decidido"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contact-name" className="text-xs">
                        Nombre del Contacto Simulado
                      </Label>
                      <Input
                        id="contact-name"
                        value={editingContact}
                        onChange={(e) => setEditingContact(e.target.value)}
                        placeholder="Ej. [Prueba] Comprador decidido"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="scenario-desc" className="text-xs">
                      Objetivo / Descripción
                    </Label>
                    <Input
                      id="scenario-desc"
                      value={editingDesc}
                      onChange={(e) => setEditingDesc(e.target.value)}
                      placeholder="Qué comportamiento evalúa este perfil"
                    />
                  </div>
                </div>

                {/* Secuencia de Mensajes del Cliente Simulado */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Secuencia de Preguntas del Cliente
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        El simulador enviará estos mensajes en orden, turno por
                        turno, esperando la respuesta del agente.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddQuestion}
                      className="gap-1 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar pregunta
                    </Button>
                  </div>

                  <div className="space-y-2.5">
                    {editingScript.map((question, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 rounded-lg border bg-card p-3 shadow-sm"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary mt-1">
                          {idx + 1}
                        </span>
                        <Textarea
                          value={question}
                          onChange={(e) =>
                            handleUpdateQuestion(idx, e.target.value)
                          }
                          placeholder={`Mensaje ${idx + 1} del cliente…`}
                          rows={2}
                          className="flex-1 resize-none text-sm"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveQuestion(idx)}
                          disabled={editingScript.length <= 1}
                          className="shrink-0 text-muted-foreground hover:text-destructive mt-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Botón Guardar */}
                <div className="flex items-center justify-between pt-4 border-t mt-auto">
                  <span className="text-xs text-muted-foreground">
                    Al guardar, las próximas corridas usarán este guion exacto.
                  </span>
                  <Button
                    onClick={() => void handleSaveScenario()}
                    disabled={saving}
                    className="gap-1.5"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {saving ? "Guardando…" : "Guardar cambios en el guion"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center p-8 space-y-4 text-muted-foreground">
                <Sparkles className="h-10 w-10 text-primary/40 animate-pulse" />
                <div className="max-w-md space-y-1">
                  <p className="font-semibold text-foreground text-sm">
                    No hay preguntas configuradas para {suiteTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Para correr este benchmark necesitas configurar preguntas. Pulsa el botón para que la IA genere preguntas adaptadas a tu negocio o pulsa en agregar pregunta.
                  </p>
                </div>
                <Button
                  onClick={() => void handleGenerateWithAi(false)}
                  disabled={generating}
                  className="gap-2 text-xs"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generating ? "Generando con IA…" : "Generar preguntas con IA"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
