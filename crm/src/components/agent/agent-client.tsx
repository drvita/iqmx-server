"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { BrainStatusCard } from "@/components/agent/brain-status-card";
import type { BrainStatusDto } from "@/lib/brain-status";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type Assistant = {
  id: string;
  name: string;
  type: "conversational" | "tool";
  isDefault: boolean;
  enabled: boolean;
  description: string | null;
  tone: string | null;
  instructions: string | null;
  escalationRules: string | null;
  greeting: string | null;
};

type KbEntry = {
  id: string;
  kind: "qa" | "block";
  question: string | null;
  answer: string | null;
  content: string | null;
};

export function AgentClient() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<
    "all" | "conversational" | "tool"
  >("all");
  const [isCreating, setIsCreating] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [entries, setEntries] = useState<KbEntry[]>([]);
  const [kbSize, setKbSize] = useState<{
    chars: number;
    warnAt: number;
    warning: boolean;
  } | null>(null);
  const [loadingKb, setLoadingKb] = useState(false);
  const [saved, setSaved] = useState(false);
  const [brain, setBrain] = useState<BrainStatusDto | null>(null);

  const loadBrain = useCallback(async () => {
    const b = await fetch("/api/agent/brain-status")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    setBrain(b);
  }, []);

  useEffect(() => {
    void loadBrain();
    const interval = setInterval(() => {
      void loadBrain();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadBrain]);

  // Carga perfiles de asistentes
  const refetchProfiles = useCallback(
    async (preferredId?: string) => {
      const p = await fetch("/api/agent/profile")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      if (p) {
        const list = (p.assistants as Assistant[]) ?? [];
        setAssistants(list);
        setAiConfigured(p.aiConfigured);
        if (preferredId) {
          setSelectedId(preferredId);
        } else if (!selectedId && list[0]) {
          setSelectedId(list[0].id);
        }
      }
    },
    [selectedId],
  );

  const selectedAssistant =
    assistants.find((a) => a.id === selectedId) ?? assistants[0] ?? null;

  // Carga la base de conocimiento exclusiva del asistente activo
  const refetchKb = useCallback(async (assistantId?: string) => {
    const targetId = assistantId ?? selectedAssistant?.id;
    if (!targetId) return;

    setLoadingKb(true);
    try {
      const [kb, size] = await Promise.all([
        fetch(`/api/kb?assistantId=${targetId}`).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`/api/kb/size?assistantId=${targetId}`).then((r) =>
          r.ok ? r.json() : null
        ),
      ]);
      if (kb) setEntries(kb.entries ?? []);
      if (size) setKbSize(size);
    } finally {
      setLoadingKb(false);
    }
  }, [selectedAssistant?.id]);

  useEffect(() => {
    void refetchProfiles();
  }, [refetchProfiles]);

  useEffect(() => {
    if (selectedAssistant?.id) {
      void refetchKb(selectedAssistant.id);
    }
  }, [selectedAssistant?.id, refetchKb]);

  async function saveAssistant(patch: Partial<Assistant>) {
    if (!selectedAssistant) return;
    const res = await fetch("/api/agent/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...patch, id: selectedAssistant.id }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        data?.error?.message ||
        `Error del servidor (${res.status}). No se pudieron guardar los cambios.`;
      throw new Error(msg);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    void refetchProfiles(selectedAssistant.id);
  }

  async function createAssistant(data: {
    name: string;
    type: "conversational" | "tool";
    description?: string;
  }) {
    const res = await fetch("/api/agent/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        result?.error?.message ||
        `Error al crear asistente (${res.status})`;
      throw new Error(msg);
    }

    if (result?.assistant?.id) {
      setIsCreating(false);
      void refetchProfiles(result.assistant.id);
    }
  }

  async function deleteAssistant(id: string) {
    if (!confirm("¿Seguro que deseas eliminar este Asistente IA?")) return;
    const res = await fetch(`/api/agent/profile?id=${id}`, {
      method: "DELETE",
    }).then((r) => (r.ok ? r.json() : null));

    if (res?.ok) {
      void refetchProfiles();
    }
  }

  const filteredAssistants = assistants.filter((a) => {
    if (filterType === "all") return true;
    return a.type === filterType;
  });

  if (!selectedAssistant && assistants.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Cargando asistentes…
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-[17px] font-bold tracking-tight">
              Asistentes IA
            </h2>
            <p className="text-xs text-muted-foreground">
              Configura tus modelos conversacionales y herramientas de análisis
              interno
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-primary">Guardado ✓</span>}
          <Button
            size="sm"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Nuevo Asistente IA
          </Button>
        </div>
      </header>

      {brain && (
        <div className="mx-4 mt-4 sm:mx-6 sm:mt-6">
          <BrainStatusCard status={brain} />
        </div>
      )}

      {!aiConfigured && (
        <div className="mx-4 mt-4 rounded-lg border border-brand-soft bg-brand-tint p-5 text-center sm:mx-6 sm:mt-6 sm:p-6">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="font-medium text-foreground">
            Configura tu motor de IA para activar los asistentes
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Ingresa tu clave de OpenRouter y selecciona el modelo para que tu agente pueda interactuar con tus clientes.
          </p>
          <div className="mt-3">
            <Link href="/settings/ai" className={buttonVariants({ size: "sm" })}>
              Configurar Inteligencia Artificial
            </Link>
          </div>
        </div>
      )}

      {/* Modal / Formulario de Creación */}
      {isCreating && (
        <div className="p-4 sm:p-6">
          <Card className="border-primary/40 shadow-sm">
            <CardHeader>
              <CardTitle>Crear Nuevo Asistente IA</CardTitle>
              <CardDescription>
                Define si este asistente atenderá clientes o ejecutará procesos
                internos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateAssistantForm
                onCancel={() => setIsCreating(false)}
                onSubmit={createAssistant}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Selector de Asistente y Filtros */}
      <div className="border-b px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Filtro:
            </span>
            <button
              onClick={() => setFilterType("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filterType === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              Todos ({assistants.length})
            </button>
            <button
              onClick={() => setFilterType("conversational")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filterType === "conversational"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              Conversacionales (
              {assistants.filter((a) => a.type === "conversational").length})
            </button>
            <button
              onClick={() => setFilterType("tool")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filterType === "tool"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              Tools / Procesos (
              {assistants.filter((a) => a.type === "tool").length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Asistente Activo:
            </span>
            <select
              value={selectedAssistant?.id ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium shadow-sm"
            >
              {filteredAssistants.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.type === "conversational" ? "💬 " : "⚙️ "}
                  {a.name} {a.isDefault ? "(Predeterminado)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Editor del Asistente Seleccionado y Knowledge Base */}
      {selectedAssistant && (
        <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 lg:grid-cols-2 lg:items-start">
          <AssistantEditor
            assistant={selectedAssistant}
            onSave={saveAssistant}
            onDelete={
              assistants.length > 1
                ? () => deleteAssistant(selectedAssistant.id)
                : undefined
            }
            canDelete={assistants.length > 1 && !selectedAssistant.isDefault}
          />
          <KbSection
            assistantId={selectedAssistant.id}
            assistantName={selectedAssistant.name}
            entries={entries}
            kbSize={kbSize}
            loading={loadingKb}
            onChanged={() => void refetchKb(selectedAssistant.id)}
          />
        </div>
      )}
    </div>
  );
}

const LIMITS = {
  name: 100,
  description: 1000,
  tone: 1500,
  greeting: 2000,
  instructions: 16000,
  escalationRules: 8000,
} as const;

function CharacterCount({
  current,
  max,
  className = "",
}: {
  current: number;
  max: number;
  className?: string;
}) {
  const isOver = current > max;
  const isNear = !isOver && current >= max * 0.85;

  return (
    <span
      className={`text-[11px] font-mono tabular-nums transition-colors ${
        isOver
          ? "text-destructive font-bold"
          : isNear
          ? "text-amber-500 dark:text-amber-400 font-medium"
          : "text-muted-foreground"
      } ${className}`}
    >
      {current.toLocaleString()} / {max.toLocaleString()} car.
      {isOver && ` (excede por ${(current - max).toLocaleString()})`}
    </span>
  );
}

function CreateAssistantForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (data: {
    name: string;
    type: "conversational" | "tool";
    description?: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"conversational" | "tool">("conversational");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNameOver = name.length > LIMITS.name;
  const isDescOver = description.length > LIMITS.description;
  const hasError = isNameOver || isDescOver || !name.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasError) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        type,
        description: description.trim() || undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear asistente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="create-name">Nombre del Asistente *</Label>
            <CharacterCount current={name.length} max={LIMITS.name} />
          </div>
          <Input
            id="create-name"
            placeholder="p. ej. Asistente Dental - Sucursal Providencia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={LIMITS.name + 20}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="create-type">Tipo de Asistente</Label>
          <select
            id="create-type"
            value={type}
            onChange={(e) =>
              setType(e.target.value as "conversational" | "tool")
            }
            className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
          >
            <option value="conversational">
              💬 Conversacional (Atiende WhatsApp en vivo)
            </option>
            <option value="tool">
              ⚙️ Herramienta / Tool (Procesos y análisis interno)
            </option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="create-description">Descripción o Propósito</Label>
          <CharacterCount current={description.length} max={LIMITS.description} />
        </div>
        <Input
          id="create-description"
          placeholder="p. ej. Atiende prospectos de ortodoncia, califica intención de compra y agenda valoraciones"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={LIMITS.description + 50}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={hasError || loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando…
            </>
          ) : (
            "Crear Asistente"
          )}
        </Button>
      </div>
    </form>
  );
}

function AssistantEditor({
  assistant,
  onSave,
  onDelete,
  canDelete,
}: {
  assistant: Assistant;
  onSave: (patch: Partial<Assistant>) => Promise<void>;
  onDelete?: () => void;
  canDelete: boolean;
}) {
  const [form, setForm] = useState(assistant);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    setForm(assistant);
    setSaveError(null);
  }, [assistant]);

  // Validaciones reactivas de longitud
  const nameLen = (form.name ?? "").length;
  const descLen = (form.description ?? "").length;
  const toneLen = (form.tone ?? "").length;
  const greetingLen = (form.greeting ?? "").length;
  const instructionsLen = (form.instructions ?? "").length;
  const escalationLen = (form.escalationRules ?? "").length;

  const isNameOver = nameLen > LIMITS.name;
  const isDescOver = descLen > LIMITS.description;
  const isToneOver = form.type === "conversational" && toneLen > LIMITS.tone;
  const isGreetingOver =
    form.type === "conversational" && greetingLen > LIMITS.greeting;
  const isInstructionsOver = instructionsLen > LIMITS.instructions;
  const isEscalationOver =
    form.type === "conversational" && escalationLen > LIMITS.escalationRules;

  const hasValidationError =
    !form.name?.trim() ||
    isNameOver ||
    isDescOver ||
    isToneOver ||
    isGreetingOver ||
    isInstructionsOver ||
    isEscalationOver;

  async function handleSave() {
    if (hasValidationError) return;
    setSaving(true);
    setJustSaved(false);
    setSaveError(null);
    try {
      await onSave(form);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al guardar los cambios."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    const next = !form.enabled;
    setToggling(true);
    setSaveError(null);
    setForm((prev) => ({ ...prev, enabled: next }));
    try {
      await onSave({ enabled: next });
    } catch (err: unknown) {
      // Revertir estado visual si falla
      setForm((prev) => ({ ...prev, enabled: !next }));
      setSaveError(
        err instanceof Error
          ? err.message
          : "No se pudo cambiar el estado del asistente."
      );
    } finally {
      setToggling(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{form.name}</CardTitle>
              <Badge
                variant={
                  form.type === "conversational" ? "default" : "secondary"
                }
              >
                {form.type === "conversational"
                  ? "💬 Conversacional"
                  : "⚙️ Tool / Proceso"}
              </Badge>
              {form.isDefault && (
                <Badge variant="outline">Predeterminado</Badge>
              )}
            </div>
            <CardDescription className="mt-1">
              {form.type === "conversational"
                ? "Este asistente puede asignarse a líneas de WhatsApp para dialogar en tiempo real con prospectos."
                : "Este asistente está diseñado para procesos secundarios, análisis de pipeline y tareas internas."}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">
              {toggling ? "Actualizando…" : form.enabled ? "Activo" : "Pausado"}
            </span>
            <button
              type="button"
              role="switch"
              disabled={toggling}
              aria-checked={form.enabled}
              aria-label={
                form.enabled ? "Desactivar asistente" : "Activar asistente"
              }
              onClick={() => void handleToggle()}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                form.enabled
                  ? "bg-primary"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/40"
              } ${toggling ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <span
                className={`pointer-events-none block h-5 w-5 rounded-full bg-white dark:bg-zinc-100 shadow-md ring-0 transition-transform ${
                  form.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Banner de error si falló el guardado */}
        {saveError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">
                No se pudieron guardar los cambios
              </span>
              <span className="leading-relaxed block">{saveError}</span>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="asst-name">Nombre del Asistente *</Label>
              <CharacterCount current={nameLen} max={LIMITS.name} />
            </div>
            <Input
              id="asst-name"
              placeholder="p. ej. Asistente Dental - Sucursal Providencia"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="asst-desc">Descripción</Label>
              <CharacterCount current={descLen} max={LIMITS.description} />
            </div>
            <Input
              id="asst-desc"
              placeholder="p. ej. Atiende prospectos de ortodoncia, califica intención de compra y agenda valoraciones"
              value={form.description ?? ""}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
        </div>

        {form.type === "conversational" && (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="asst-tone">Tono de conversación</Label>
                <CharacterCount current={toneLen} max={LIMITS.tone} />
              </div>
              <Textarea
                id="asst-tone"
                rows={2}
                placeholder="p. ej. Profesional, empático y resolutivo. Dirigirse de usted con calidez. Usar emojis con moderación (máx. 1 por mensaje) y evitar tecnicismos médicos complejos."
                value={form.tone ?? ""}
                onChange={(e) => setForm({ ...form, tone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="asst-greeting">Mensaje de Saludo</Label>
                <CharacterCount current={greetingLen} max={LIMITS.greeting} />
              </div>
              <Textarea
                id="asst-greeting"
                rows={2}
                placeholder="p. ej. ¡Hola! Bienvenido a DentalCare. Soy Sofía, tu asistente virtual. ¿En qué podemos apoyarte hoy con tu cita o presupuesto?"
                value={form.greeting ?? ""}
                onChange={(e) => setForm({ ...form, greeting: e.target.value })}
              />
            </div>
          </>
        )}

        {form.type === "conversational" && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Tip de configuración:</span>{" "}
              El CRM ya coordina automáticamente la <strong>agenda de citas</strong> (según Ajustes → Agenda), la <strong>base de conocimiento</strong>, el <strong>pipeline de ventas</strong> y la <strong>transferencia a humanos</strong> cuando el cliente lo solicita. No necesitas redactar horarios ni catálogos aquí: enfócate en el objetivo comercial, la personalidad del negocio y cómo deseas que atienda a tus prospectos.
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="asst-instructions">
              {form.type === "conversational"
                ? "Instrucciones de Atención (System Prompt)"
                : "Instrucciones de la Tarea / Tool"}
            </Label>
            <CharacterCount
              current={instructionsLen}
              max={LIMITS.instructions}
            />
          </div>
          <Textarea
            id="asst-instructions"
            rows={form.type === "conversational" ? 7 : 9}
            placeholder={
              form.type === "conversational"
                ? `[ROL Y OBJETIVO]
Eres el asesor virtual de la clínica. Tu meta es responder dudas con amabilidad y orientar al prospecto a agendar su consulta de valoración.

[PAUTAS DE ATENCIÓN]
- Responde de forma concisa y natural para WhatsApp (1 a 2 párrafos cortos).
- Si preguntan precios, indica el rango base e invita a la valoración para diagnóstico certero.

[LO QUE NUNCA DEBE HACER]
- No des diagnósticos definitivos ni recetas médicas sin consulta presencial.
- No contradigas las políticas ni prometas descuentos no autorizados.`
                : `[OBJETIVO DE LA TAREA]
Analizar las conversaciones cerradas para calificar el sentimiento y clasificar los motivos de pérdida según la taxonomía definida.`
            }
            value={form.instructions ?? ""}
            onChange={(e) =>
              setForm({ ...form, instructions: e.target.value })
            }
          />
        </div>

        {form.type === "conversational" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="asst-escalation">
                  Reglas de Escalado a Humano
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  El sistema transfiere automáticamente si el cliente pide un asesor humano o fuera de ventana. Especifica aquí condiciones adicionales propias de tu negocio.
                </span>
              </div>
              <CharacterCount
                current={escalationLen}
                max={LIMITS.escalationRules}
              />
            </div>
            <Textarea
              id="asst-escalation"
              rows={3}
              placeholder="p. ej. Transferir a un asesor humano si: 1) El usuario solicita hablar con una persona. 2) Reclamos o inconformidades graves con tratamientos previos. 3) Dudas clínicas complejas que requieran criterio médico."
              value={form.escalationRules ?? ""}
              onChange={(e) =>
                setForm({ ...form, escalationRules: e.target.value })
              }
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || hasValidationError}
              className="min-w-[150px] transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : justSaved ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-emerald-400" />
                  ¡Guardado!
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>

            {hasValidationError && (
              <span className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {isInstructionsOver
                  ? `Las instrucciones exceden el límite de ${LIMITS.instructions.toLocaleString()} caracteres.`
                  : isEscalationOver
                  ? `Las reglas de escalado exceden el límite de ${LIMITS.escalationRules.toLocaleString()} caracteres.`
                  : isToneOver
                  ? `El tono excede el límite de ${LIMITS.tone.toLocaleString()} caracteres.`
                  : isGreetingOver
                  ? `El saludo excede el límite de ${LIMITS.greeting.toLocaleString()} caracteres.`
                  : isDescOver
                  ? `La descripción excede el límite de ${LIMITS.description.toLocaleString()} caracteres.`
                  : !form.name?.trim()
                  ? "El nombre es obligatorio."
                  : "Por favor corrige los campos que exceden el límite."}
              </span>
            )}

            {justSaved && !hasValidationError && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-300">
                <Check className="h-4 w-4" /> Cambios guardados correctamente
              </span>
            )}
          </div>

          {canDelete && onDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Eliminar Asistente
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function KbSection({
  assistantId,
  assistantName,
  entries,
  kbSize,
  loading,
  onChanged,
}: {
  assistantId: string;
  assistantName: string;
  entries: KbEntry[];
  kbSize: { chars: number; warnAt: number; warning: boolean } | null;
  loading?: boolean;
  onChanged: () => void;
}) {
  const [kind, setKind] = useState<"qa" | "block">("qa");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [content, setContent] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // Estados para edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startEdit(e: KbEntry) {
    setEditingId(e.id);
    setEditQuestion(e.question ?? "");
    setEditAnswer(e.answer ?? "");
    setEditContent(e.content ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditQuestion("");
    setEditAnswer("");
    setEditContent("");
  }

  async function saveEdit(e: KbEntry) {
    setSavingId(e.id);
    const payload =
      e.kind === "qa"
        ? { id: e.id, kind: "qa", question: editQuestion, answer: editAnswer }
        : { id: e.id, kind: "block", content: editContent };

    try {
      const res = await fetch("/api/kb", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditingId(null);
        onChanged();
      }
    } finally {
      setSavingId(null);
    }
  }

  async function addEntry() {
    setIsAdding(true);
    setJustAdded(false);
    const payload =
      kind === "qa"
        ? { assistantId, kind: "qa", question, answer }
        : { assistantId, kind: "block", content };
    try {
      const res = await fetch("/api/kb", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      setQuestion("");
      setAnswer("");
      setContent("");
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 3000);
      onChanged();
    } finally {
      setIsAdding(false);
    }
  }

  async function deleteEntry(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/kb?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        onChanged();
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Base de Conocimiento · {assistantName}</CardTitle>
          {loading ? (
            <span className="text-xs text-muted-foreground animate-pulse">Cargando…</span>
          ) : kbSize ? (
            <span
              className={`text-xs ${
                kbSize.warning
                  ? "font-semibold text-warning"
                  : "text-muted-foreground"
              }`}
            >
              {kbSize.chars} caracteres
            </span>
          ) : null}
        </div>
        <CardDescription>
          Información del negocio exclusiva de este asistente para responder preguntas
          frecuentes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={kind === "qa" ? "default" : "outline"}
            onClick={() => setKind("qa")}
          >
            Pregunta / Respuesta
          </Button>
          <Button
            size="sm"
            variant={kind === "block" ? "default" : "outline"}
            onClick={() => setKind("block")}
          >
            Bloque libre
          </Button>
        </div>

        {kind === "qa" ? (
          <div className="space-y-2">
            <Input
              placeholder="Pregunta (p. ej. ¿Aceptan tarjeta?)"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <Textarea
              rows={2}
              placeholder="Respuesta"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </div>
        ) : (
          <Textarea
            rows={3}
            placeholder="Información libre (políticas, catálogo, horarios…)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        )}

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => void addEntry()}
            disabled={
              isAdding ||
              (kind === "qa"
                ? !question.trim() || !answer.trim()
                : !content.trim())
            }
            className="min-w-[130px] transition-all"
          >
            {isAdding ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Guardando…
              </>
            ) : justAdded ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                ¡Agregado!
              </>
            ) : (
              <>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Agregar entrada
              </>
            )}
          </Button>

          {justAdded && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-300">
              <Check className="h-3.5 w-3.5" /> Entrada agregada exitosamente
            </span>
          )}
        </div>

        <div className="max-h-[500px] divide-y divide-border overflow-y-auto pr-2 pt-2 scrollbar-thin">
          {entries.map((e) => {
            const isEditing = editingId === e.id;
            return (
              <div
                key={e.id}
                className="group flex flex-col gap-2 py-3 text-sm transition-colors hover:bg-muted/20 px-2.5 rounded-lg border border-transparent hover:border-border/50"
              >
                {isEditing ? (
                  <div className="space-y-2.5 w-full">
                    {e.kind === "qa" ? (
                      <>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            Pregunta
                          </Label>
                          <Input
                            value={editQuestion}
                            onChange={(ev) => setEditQuestion(ev.target.value)}
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            Respuesta
                          </Label>
                          <Textarea
                            rows={2}
                            value={editAnswer}
                            onChange={(ev) => setEditAnswer(ev.target.value)}
                            className="text-xs"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Contenido del bloque
                        </Label>
                        <Textarea
                          rows={3}
                          value={editContent}
                          onChange={(ev) => setEditContent(ev.target.value)}
                          className="text-xs"
                        />
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={cancelEdit}
                        disabled={savingId === e.id}
                        className="h-7 text-xs"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveEdit(e)}
                        disabled={savingId === e.id}
                        className="h-7 text-xs min-w-[115px]"
                      >
                        {savingId === e.id ? (
                          <>
                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            Guardando…
                          </>
                        ) : (
                          "Guardar cambios"
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3 w-full">
                    <div className="min-w-0 flex-1 space-y-1">
                      {e.kind === "qa" ? (
                        <>
                          <p className="font-semibold text-foreground text-sm leading-snug">
                            {e.question}
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed break-words">
                            {e.answer}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words">
                          {e.content}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(e)}
                        className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Editar entrada"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteEntry(e.id)}
                        disabled={deletingId === e.id}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="Eliminar entrada"
                      >
                        {deletingId === e.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {entries.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No hay entradas de conocimiento aún. Agrega preguntas frecuentes
              para nutrir la IA.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
