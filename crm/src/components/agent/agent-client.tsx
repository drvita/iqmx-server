"use client";

import { useCallback, useEffect, useState } from "react";
import {
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
    await fetch("/api/agent/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...patch, id: selectedAssistant.id }),
    }).catch(() => null);
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
    }).then((r) => (r.ok ? r.json() : null));

    if (res?.assistant?.id) {
      setIsCreating(false);
      void refetchProfiles(res.assistant.id);
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
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const name = (
                    form.elements.namedItem("name") as HTMLInputElement
                  ).value;
                  const type = (
                    form.elements.namedItem("type") as HTMLSelectElement
                  ).value as "conversational" | "tool";
                  const description = (
                    form.elements.namedItem("description") as HTMLInputElement
                  ).value;
                  void createAssistant({ name, type, description });
                }}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="create-name">Nombre del Asistente</Label>
                    <Input
                      id="create-name"
                      name="name"
                      placeholder="p. ej. Asistente Ventas"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="create-type">Tipo de Asistente</Label>
                    <select
                      id="create-type"
                      name="type"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
                      defaultValue="conversational"
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
                  <Label htmlFor="create-description">
                    Descripción o Propósito
                  </Label>
                  <Input
                    id="create-description"
                    name="description"
                    placeholder="p. ej. Atiende prospectos de la línea de ventas central"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreating(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">Crear Asistente</Button>
                </div>
              </form>
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
  const [toggling, setToggling] = useState(false);

  useEffect(() => setForm(assistant), [assistant]);

  async function handleSave() {
    setSaving(true);
    setJustSaved(false);
    try {
      await onSave(form);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    const next = !form.enabled;
    setToggling(true);
    setForm((prev) => ({ ...prev, enabled: next }));
    try {
      await onSave({ enabled: next });
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
            <span className="text-xs text-muted-foreground">
              {toggling ? "Actualizando…" : form.enabled ? "Activo" : "Pausado"}
            </span>
            <button
              role="switch"
              disabled={toggling}
              aria-checked={form.enabled}
              onClick={() => void handleToggle()}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                form.enabled ? "bg-primary" : "bg-secondary"
              } ${toggling ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-knob transition-transform ${
                  form.enabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="asst-name">Nombre del Asistente</Label>
            <Input
              id="asst-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asst-desc">Descripción</Label>
            <Input
              id="asst-desc"
              placeholder="p. ej. Línea principal de ventas"
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
              <Label htmlFor="asst-tone">Tono de conversación</Label>
              <Input
                id="asst-tone"
                placeholder="p. ej. cercano y directo, de usted"
                value={form.tone ?? ""}
                onChange={(e) => setForm({ ...form, tone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asst-greeting">Mensaje de Saludo</Label>
              <Input
                id="asst-greeting"
                placeholder="Saludo para conversaciones nuevas en WhatsApp"
                value={form.greeting ?? ""}
                onChange={(e) => setForm({ ...form, greeting: e.target.value })}
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="asst-instructions">
            {form.type === "conversational"
              ? "Instrucciones de Atención (System Prompt)"
              : "Instrucciones de la Tarea / Tool"}
          </Label>
          <Textarea
            id="asst-instructions"
            rows={form.type === "conversational" ? 5 : 7}
            placeholder={
              form.type === "conversational"
                ? "Qué debe y no debe hacer al atender clientes en WhatsApp…"
                : "Qué criterios debe evaluar para clasificar o procesar los datos…"
            }
            value={form.instructions ?? ""}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </div>

        {form.type === "conversational" && (
          <div className="space-y-1.5">
            <Label htmlFor="asst-escalation">Reglas de Escalado a Humano</Label>
            <Textarea
              id="asst-escalation"
              rows={3}
              placeholder="Cuándo pausar la IA y transferir la conversación a un operador…"
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
              disabled={saving}
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

            {justSaved && (
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
