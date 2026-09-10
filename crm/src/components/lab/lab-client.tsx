"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  FlaskConical,
  Play,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEvents } from "@/components/use-events";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LabScenarioItem,
  ScenarioEditor,
} from "@/components/lab/scenario-editor";

type SuiteId = "sandbox" | "live_audit" | "agenda_flow" | "guardrails";

type Run = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  testType?: SuiteId;
  suiteName?: string | null;
  assistantId?: string | null;
  score: number | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  delta: number | null;
  queuePosition?: number;
};

type AssistantOption = {
  id: string;
  name: string;
  isDefault: boolean;
  type: string;
};

type Hallazgo = {
  tipo: "alucinacion" | "fuera_de_kb" | "debio_escalar" | "tono";
  evidencia: string;
  sugerencia?: { pregunta: string; respuesta: string };
};

type Case = {
  id: string;
  persona: string;
  personaLabel: string;
  status: string;
  veredicto: "verde" | "amarillo" | "rojo" | null;
  hallazgos: Hallazgo[];
  transcript: { role: "cliente" | "agente"; text: string }[];
};

const TIPO_LABELS: Record<Hallazgo["tipo"], string> = {
  alucinacion: "Alucinación",
  fuera_de_kb: "Fuera del conocimiento",
  debio_escalar: "Debió escalar",
  tono: "Tono",
};

type ActiveOrgRun = {
  id: string;
  testType: string;
  suiteName: string | null;
  assistantId: string | null;
  status: string;
  queuePosition?: number;
};

const suiteTitles: Record<SuiteId, { title: string; subtitle: string; icon: React.ReactNode; cta: string }> = {
  sandbox: {
    title: "Simulación de Ventas y Atención",
    subtitle: "Prueba con clientes simulados que preguntan precios, objeciones y transferencias",
    icon: <Bot className="h-4 w-4 text-primary" />,
    cta: "Correr Simulación de Ventas",
  },
  live_audit: {
    title: "Auditoría de Conversaciones Reales",
    subtitle: "Revisión automática de chats reales de WhatsApp para calificar la atención del bot",
    icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
    cta: "Auditar Conversaciones Reales",
  },
  agenda_flow: {
    title: "Pruebas de Agenda y Citas",
    subtitle: "Simulación de reservas, disponibilidad de horarios, reagendamientos y cancelaciones",
    icon: <Calendar className="h-4 w-4 text-amber-500" />,
    cta: "Correr Pruebas de Citas",
  },
  guardrails: {
    title: "Pruebas de Seguridad y Filtros",
    subtitle: "Evaluación de resistencia ante preguntas trampa, descuentos falsos y protección de datos",
    icon: <ShieldAlert className="h-4 w-4 text-rose-500" />,
    cta: "Correr Pruebas de Seguridad",
  },
};

export function LabClient({ agendaEnabled = false }: { agendaEnabled?: boolean }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeOrgRun, setActiveOrgRun] = useState<ActiveOrgRun | null>(null);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ run: Run; cases: Case[] } | null>(
    null,
  );
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    testType?: SuiteId;
    suiteName?: string | null;
  } | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Asistente seleccionado para evaluar
  const [assistants, setAssistants] = useState<AssistantOption[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>("");

  // Suite seleccionada (null = Vista de Catálogo de Benchmarks)
  const [selectedSuite, setSelectedSuite] = useState<SuiteId | null>(null);
  const [scenarios, setScenarios] = useState<LabScenarioItem[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [sampleSize, setSampleSize] = useState<number>(10);

  useEffect(() => {
    if (selectedSuite === "agenda_flow" && !agendaEnabled) {
      setSelectedSuite(null);
    }
  }, [selectedSuite, agendaEnabled]);

  const refetchAssistants = useCallback(async () => {
    const res = await fetch("/api/agent/profile?type=conversational").catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { assistants?: AssistantOption[] };
    if (data?.assistants && data.assistants.length > 0) {
      setAssistants(data.assistants);
      setSelectedAssistantId((prev) => {
        if (prev && data.assistants!.some((a) => a.id === prev)) return prev;
        const defaultOne = data.assistants!.find((a) => a.isDefault) ?? data.assistants![0];
        return defaultOne ? defaultOne.id : "";
      });
    }
  }, []);

  const refetchRuns = useCallback(async (asstId?: string) => {
    const query = asstId ? `?assistantId=${asstId}` : "";
    const res = await fetch(`/api/lab/runs${query}`).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as {
      runs: Run[];
      aiConfigured: boolean;
      activeOrgRun?: ActiveOrgRun | null;
    };
    setRuns(data.runs);
    setAiConfigured(data.aiConfigured);
    setActiveOrgRun(data.activeOrgRun ?? null);
  }, []);

  const refetchScenarios = useCallback(async (asstId?: string, testType?: string) => {
    const params = new URLSearchParams();
    if (asstId) params.set("assistantId", asstId);
    if (testType) params.set("testType", testType);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/lab/scenarios${query}`).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { scenarios: LabScenarioItem[] };
    setScenarios(data.scenarios);
  }, []);

  const refetchDetail = useCallback(async (runId: string) => {
    const res = await fetch(`/api/lab/runs/${runId}`).catch(() => null);
    if (!res?.ok) return;
    setDetail((await res.json()) as { run: Run; cases: Case[] });
  }, []);

  useEffect(() => {
    void refetchAssistants();
  }, [refetchAssistants]);

  useEffect(() => {
    if (selectedAssistantId) {
      void refetchRuns(selectedAssistantId);
      void refetchScenarios(selectedAssistantId, selectedSuite || "sandbox");
    } else {
      void refetchRuns();
      void refetchScenarios(undefined, selectedSuite || "sandbox");
    }
  }, [selectedAssistantId, selectedSuite, refetchRuns, refetchScenarios]);

  // Al seleccionar una suite, seleccionar automáticamente la última corrida de esa suite
  useEffect(() => {
    if (selectedSuite) {
      const suiteRuns = runs.filter((r) =>
        selectedSuite === "sandbox"
          ? r.testType === "sandbox" || !r.testType
          : r.testType === selectedSuite,
      );
      if (suiteRuns[0]) {
        setSelectedRunId(suiteRuns[0].id);
      } else {
        setSelectedRunId(null);
        setDetail(null);
      }
    }
  }, [selectedSuite, runs]);

  useEffect(() => {
    if (selectedRunId) void refetchDetail(selectedRunId);
  }, [selectedRunId, refetchDetail]);

  useEvents({
    onLabRun: (data) => {
      // Solo actualizar la barra de progreso si pertenece a la suite activa
      const eventTestType = data.testType ?? "sandbox";
      if (data.status === "running") {
        setProgress({
          done: data.progress.done,
          total: data.progress.total,
          testType: eventTestType as SuiteId,
          suiteName: data.suiteName ?? null,
        });
      } else {
        setProgress(null);
      }
      void refetchRuns(selectedAssistantId);
      if (selectedRunId === data.runId || !selectedRunId) {
        setSelectedRunId(data.runId);
        void refetchDetail(data.runId);
      }
    },
  });

  async function launch(suite: SuiteId) {
    if (suite !== "live_audit" && scenarios.length === 0) {
      setError(
        "No hay preguntas configuradas para esta prueba. Primero pulsa en 'Editar preguntas de prueba' y genera o personaliza las preguntas de tu negocio."
      );
      setIsEditorOpen(true);
      return;
    }

    setLaunching(true);
    setError(null);
    const res = await fetch("/api/lab/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testType: suite,
        assistantId: selectedAssistantId || undefined,
        sampleSize: suite === "live_audit" ? sampleSize : undefined,
      }),
    }).catch(() => null);
    setLaunching(false);
    if (!res) return;
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(data?.error?.message ?? "No se pudo lanzar la corrida");
      return;
    }
    const data = (await res.json()) as {
      runId: string;
      status?: "running" | "queued";
      queuePosition?: number;
    };
    setSelectedRunId(data.runId);
    if (data.status === "queued") {
      setProgress(null);
    } else {
      setProgress({
        done: 0,
        total: suite === "live_audit" ? sampleSize : scenarios.length || 6,
        testType: suite,
        suiteName: null,
      });
    }
    void refetchRuns(selectedAssistantId);
  }

  if (!aiConfigured) {
    return (
      <div className="flex h-full flex-col">
        <header className="border-b px-6 py-4">
          <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-tight">
            <FlaskConical className="h-5 w-5 text-primary" /> Laboratorio de
            Validación y Benchmarking
          </h2>
        </header>
        <div className="m-6 rounded-lg border border-brand-soft bg-brand-tint p-8 text-center">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="font-medium text-foreground">
            Configura tu motor de IA para usar el Laboratorio
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            El Laboratorio necesita que configures tu clave de OpenRouter en
            Configuración para evaluar las conversaciones de prueba.
          </p>
          <div className="mt-3">
            <Link
              href="/settings/ai"
              className={buttonVariants({ size: "sm" })}
            >
              Configurar Inteligencia Artificial
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Filtrar corridas para la suite actualmente seleccionada
  const filteredRuns = runs.filter((r) =>
    selectedSuite === "sandbox"
      ? r.testType === "sandbox" || !r.testType
      : r.testType === selectedSuite,
  );

  const running = runs.some((r) => r.status === "running");

  // VISTA 1: CATÁLOGO DE BENCHMARKS Y SUITES (cuando selectedSuite es null)
  if (!selectedSuite) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
              <FlaskConical className="h-4 w-4" /> Centro de Pruebas y Validación
              SaaS
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
              Laboratorio de Inteligencia Artificial
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Selecciona el benchmark o prueba que deseas ejecutar. Puedes
              calibrar a tu agente en sandbox antes de conectar WhatsApp o auditar
              la calidad de atención con clientes reales en producción.
            </p>
          </div>

          <AssistantSelector
            assistants={assistants}
            selectedId={selectedAssistantId}
            onChange={(id) => setSelectedAssistantId(id)}
          />
        </div>

        {activeOrgRun && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-700 dark:text-amber-300">
            <Sparkles className="h-5 w-5 shrink-0 animate-pulse text-amber-500" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                Hay una prueba en curso en tu organización
              </p>
              <p className="text-xs text-amber-700/90 dark:text-amber-300/90 mt-0.5">
                Evaluando: <strong>{activeOrgRun.suiteName ?? suiteTitles[activeOrgRun.testType as SuiteId]?.title ?? "Benchmark"}</strong>
                {activeOrgRun.assistantId && (
                  <> en el asistente <strong>{assistants.find((a) => a.id === activeOrgRun.assistantId)?.name ?? "Asignado"}</strong></>
                )}. Recuerda que las pruebas se ejecutan de una en una por inquilino.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Tarjeta 1: Simulación de Ventas y Atención */}
          <SuiteCard
            title="Simulación de Ventas y Atención"
            subtitle="Prueba con clientes simulados que preguntan precios, objeciones y transferencias"
            badgeText="Pre-Producción"
            badgeVariant="default"
            icon={<Bot className="h-6 w-6 text-primary" />}
            description="Simula conversaciones automáticas con perfiles de prueba adaptados al catálogo de tu negocio (comprador decidido, regateador, cliente molesto o dudas fuera de catálogo). Permite editar cada pregunta o generarlas con IA."
            lastScore={
              runs.find((r) => r.testType === "sandbox" || !r.testType)
                ?.score ?? null
            }
            onSelect={() => setSelectedSuite("sandbox")}
            ctaText="Abrir Simulación de Ventas"
          />

          {/* Tarjeta 2: Auditoría de Conversaciones Reales */}
          <SuiteCard
            title="Auditoría de Conversaciones Reales"
            subtitle="Revisión automática de chats reales de WhatsApp para calificar la atención del bot"
            badgeText="Post-Producción"
            badgeVariant="secondary"
            icon={<ShieldCheck className="h-6 w-6 text-emerald-500" />}
            description="Toma una muestra aleatoria de conversaciones reales atendidas por el bot y las califica con el Juez de IA para detectar alucinaciones, respuestas fuera de política o transferencias a humanos no realizadas."
            lastScore={
              runs.find((r) => r.testType === "live_audit")?.score ?? null
            }
            onSelect={() => setSelectedSuite("live_audit")}
            ctaText="Abrir Auditoría Real"
          />

          {/* Tarjeta 3: Pruebas de Agenda y Citas */}
          {agendaEnabled && (
            <SuiteCard
              title="Pruebas de Agenda y Citas"
              subtitle="Simulación de reservas, disponibilidad de horarios, reagendamientos y cancelaciones"
              badgeText="Agenda y Turnos"
              badgeVariant="secondary"
              icon={<Calendar className="h-6 w-6 text-amber-500" />}
              description="Evalúa cómo interactúa el agente cuando los clientes solicitan citas directas, piden horarios inhábiles o festivos, o intentan cambiar y cancelar citas existentes."
              lastScore={
                runs.find((r) => r.testType === "agenda_flow")?.score ?? null
              }
              onSelect={() => setSelectedSuite("agenda_flow")}
              ctaText="Abrir Pruebas de Citas"
            />
          )}

          {/* Tarjeta 4: Pruebas de Seguridad y Filtros */}
          <SuiteCard
            title="Pruebas de Seguridad y Filtros"
            subtitle="Evaluación de resistencia ante preguntas trampa, descuentos falsos y protección de datos"
            badgeText="Seguridad y Filtros"
            badgeVariant="destructive"
            icon={<ShieldAlert className="h-6 w-6 text-rose-500" />}
            description="Pone a prueba los límites del bot simulando intentos de inyección de instrucciones (DAN/jailbreaks), solicitudes de descuentos falsos y solicitudes para revelar datos confidenciales."
            lastScore={
              runs.find((r) => r.testType === "guardrails")?.score ?? null
            }
            onSelect={() => setSelectedSuite("guardrails")}
            ctaText="Abrir Pruebas de Seguridad"
          />
        </div>
      </div>
    );
  }

  // VISTA 2: EJECUCIÓN Y RESULTADOS DEL BENCHMARK SELECCIONADO
  const currentSuiteInfo = suiteTitles[selectedSuite];

  // Determinar si hay una corrida en progreso en toda la organización
  // (un inquilino solo puede correr un benchmark a la vez, en ningún otro asistente ni suite)
  const currentRunning =
    activeOrgRun ?? runs.find((r) => r.status === "running" || r.status === "queued") ?? null;
  const isThisActive = Boolean(
    currentRunning &&
      (currentRunning.testType === selectedSuite ||
        (!currentRunning.testType && selectedSuite === "sandbox")) &&
      (!currentRunning.assistantId || currentRunning.assistantId === selectedAssistantId)
  );
  const isThisQueued = Boolean(isThisActive && currentRunning?.status === "queued");
  const isThisRunning = Boolean(isThisActive && currentRunning?.status === "running");
  const isOtherActive = Boolean(currentRunning && !isThisActive);
  const otherAssistant = currentRunning?.assistantId
    ? assistants.find((a) => a.id === currentRunning.assistantId)?.name ?? "otro asistente"
    : null;
  const otherSuiteTitle = currentRunning?.testType
    ? suiteTitles[currentRunning.testType as SuiteId]?.title ?? "otra prueba"
    : "otra prueba";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header Superior: Navegación e Información de la Suite */}
      <div className="border-b bg-card px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedSuite(null)}
              className="gap-1.5 text-xs shrink-0 mt-0.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Todos los benchmarks
            </Button>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
                {currentSuiteInfo.icon}
                {currentSuiteInfo.title}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentSuiteInfo.subtitle}
              </p>
            </div>
          </div>

          {/* Selector de Asistente alineado a la derecha */}
          <div className="shrink-0">
            <AssistantSelector
              assistants={assistants}
              selectedId={selectedAssistantId}
              onChange={(id) => setSelectedAssistantId(id)}
            />
          </div>
        </div>

        {/* Toolbar de Acciones y Parámetros: Segunda fila organizada */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-3 border-t border-border/50">
          <div className="flex flex-wrap items-center gap-2">
            {selectedSuite !== "live_audit" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditorOpen(true)}
                className="gap-1.5 text-xs"
              >
                <Edit3 className="h-3.5 w-3.5 text-primary" />
                Editar preguntas de prueba
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 shadow-sm">
                <span className="text-xs text-muted-foreground">Muestra a evaluar:</span>
                <select
                  value={sampleSize}
                  onChange={(e) => setSampleSize(Number(e.target.value))}
                  className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                >
                  <option value={5}>5 conversaciones</option>
                  <option value={10}>10 conversaciones</option>
                  <option value={20}>20 conversaciones</option>
                </select>
              </div>
            )}
          </div>

          {/* Botón de Ejecución */}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => void launch(selectedSuite)}
              disabled={isThisRunning || isThisQueued || isOtherActive || launching}
              className="gap-1.5"
            >
              <Play className="h-4 w-4" />
              {isThisRunning
                ? "Evaluación en curso…"
                : isThisQueued
                  ? `En cola (Turno #${currentRunning?.queuePosition ?? 1})…`
                  : isOtherActive
                    ? otherAssistant && currentRunning?.assistantId !== selectedAssistantId
                      ? `Ocupado en ${otherAssistant}…`
                      : `Ocupado en ${otherSuiteTitle}…`
                    : selectedSuite !== "live_audit" && scenarios.length === 0
                      ? "Configurar preguntas primero"
                      : currentSuiteInfo.cta}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <p className="px-4 pt-3 text-sm text-destructive sm:px-6">{error}</p>
      )}

      {/* Banner Informativo si ESTE benchmark está en cola */}
      {isThisQueued && (
        <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 animate-pulse text-amber-500" />
            <span>
              Este benchmark está en <strong>cola de espera (Turno #{currentRunning?.queuePosition ?? 1})</strong>. El servidor está atendiendo otra prueba prioritaria; tu benchmark iniciará automáticamente en cuanto termine el proceso actual.
            </span>
          </div>
        </div>
      )}

      {/* Banner Informativo si OTRA prueba está corriendo en esta organización */}
      {isOtherActive && (
        <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 animate-pulse" />
            <span>
              {otherAssistant && currentRunning?.assistantId !== selectedAssistantId ? (
                <>
                  Hay una evaluación en ejecución en el asistente <strong>{otherAssistant}</strong> (<em>{otherSuiteTitle}</em>). Por política del sistema, los benchmarks se ejecutan de uno en uno por inquilino. Podrás iniciar en cuanto finalice la actual.
                </>
              ) : (
                <>
                  Hay una evaluación en ejecución en <strong>{otherSuiteTitle}</strong>. Para mantener la estabilidad del agente, las pruebas se ejecutan de una en una por inquilino. Podrás iniciar esta prueba en cuanto finalice la actual.
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Banner Informativo si no hay preguntas configuradas para esta suite sintética */}
      {selectedSuite !== "live_audit" && scenarios.length === 0 && (
        <div className="mx-6 mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-700 dark:text-amber-300">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                No hay preguntas configuradas para esta prueba
              </p>
              <p className="text-xs text-amber-700/90 dark:text-amber-300/90 mt-0.5">
                Para ejecutar este benchmark, primero debes configurar o generar las preguntas de los perfiles de prueba de tu negocio.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setIsEditorOpen(true)}
            className="gap-1.5 shrink-0 self-start sm:self-center text-xs"
          >
            <Sparkles className="h-4 w-4" />
            Configurar preguntas ahora
          </Button>
        </div>
      )}

      {/* Barra de progreso ÚNICAMENTE para la prueba actualmente en curso */}
      {isThisRunning && progress && (
        <div className="mx-6 mt-4 rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">
              {selectedSuite === "live_audit"
                ? "Auditanado conversaciones reales de WhatsApp…"
                : "Evaluando perfiles de clientes simulados…"}
            </span>
            <span className="text-muted-foreground">
              {progress.done} / {progress.total}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Grid: Historial a la izquierda, Resultados/Reporte a la derecha */}
      <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 lg:grid-cols-[300px_1fr]">
        <HistoryList
          runs={filteredRuns}
          selectedRunId={selectedRunId}
          onSelect={setSelectedRunId}
          suiteTitle={`Corridas: ${currentSuiteInfo.title}`}
          assistants={assistants}
        />
        {detail ? (
          <Report
            detail={detail}
            assistantId={detail.run.assistantId ?? selectedAssistantId}
            onApplied={() => void refetchDetail(detail.run.id)}
          />
        ) : (
          <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground space-y-3">
            <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="font-medium text-foreground">
              {filteredRuns.length === 0
                ? "Aún no has ejecutado este benchmark."
                : "Selecciona una corrida del historial izquierdo para ver su reporte."}
            </p>
            <p className="text-xs max-w-sm mx-auto text-muted-foreground">
              Presiona '{currentSuiteInfo.cta}' arriba para evaluar cómo responde tu agente en esta dimensión.
            </p>
          </div>
        )}
      </div>

      {/* Modal Editor de Escenarios */}
      <ScenarioEditor
        key={`${selectedSuite}-${selectedAssistantId}`}
        isOpen={isEditorOpen}
        scenarios={scenarios}
        onClose={() => setIsEditorOpen(false)}
        assistantId={selectedAssistantId}
        testType={
          selectedSuite === "agenda_flow" || selectedSuite === "guardrails"
            ? selectedSuite
            : "sandbox"
        }
        suiteTitle={currentSuiteInfo.title}
        onRefresh={async () => {
          await refetchScenarios(
            selectedAssistantId,
            selectedSuite === "agenda_flow" || selectedSuite === "guardrails"
              ? selectedSuite
              : "sandbox"
          );
        }}
      />
    </div>
  );
}

function AssistantSelector({
  assistants,
  selectedId,
  onChange,
}: {
  assistants: AssistantOption[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  if (assistants.length === 0) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 shadow-sm">
      <Bot className="h-4 w-4 text-primary shrink-0" />
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Asistente a evaluar
        </span>
        <select
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer pr-2"
        >
          {assistants.map((a) => (
            <option key={a.id} value={a.id} className="bg-popover text-foreground">
              {a.name} {a.isDefault ? "★ (Principal)" : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SuiteCard({
  title,
  subtitle,
  badgeText,
  badgeVariant,
  icon,
  description,
  lastScore,
  onSelect,
  ctaText,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  badgeText: string;
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
  icon: React.ReactNode;
  description: string;
  lastScore: number | null;
  onSelect?: () => void;
  ctaText: string;
  disabled?: boolean;
}) {
  return (
    <Card
      className={`flex flex-col justify-between transition-all ${
        disabled
          ? "opacity-60 cursor-not-allowed bg-muted/20"
          : "hover:border-primary hover:shadow-md cursor-pointer bg-card"
      }`}
      onClick={disabled ? undefined : onSelect}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="rounded-xl border p-2.5 bg-muted/30">{icon}</div>
          <Badge variant={badgeVariant}>{badgeText}</Badge>
        </div>
        <div>
          <CardTitle className="text-lg font-bold">{title}</CardTitle>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            {subtitle}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
        <div className="flex items-center justify-between pt-3 border-t">
          <div>
            <span className="text-[11px] text-muted-foreground">
              Último score:
            </span>
            <p className="text-sm font-bold text-foreground">
              {lastScore !== null ? `${lastScore}/100` : "Sin corridas"}
            </p>
          </div>
          <Button
            size="sm"
            variant={disabled ? "ghost" : "default"}
            disabled={disabled}
            className="gap-1 text-xs"
          >
            {ctaText}
            {!disabled && <ArrowRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryList({
  runs,
  selectedRunId,
  onSelect,
  suiteTitle,
  assistants,
}: {
  runs: Run[];
  selectedRunId: string | null;
  onSelect: (id: string) => void;
  suiteTitle: string;
  assistants?: AssistantOption[];
}) {
  return (
    <div className="space-y-2">
      <p className="kicker">{suiteTitle}</p>
      {runs.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">
          Sin corridas registradas.
        </p>
      )}
      {runs.map((run) => {
        const asst = assistants?.find((a) => a.id === run.assistantId);
        return (
          <button
            key={run.id}
            onClick={() => onSelect(run.id)}
            className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent ${
              selectedRunId === run.id
                ? "border-brand bg-brand-tint"
                : "border-border-strong bg-card"
            }`}
          >
            <div className="flex items-center justify-between">
              <ScoreBadge run={run} />
              {run.delta !== null && run.delta !== 0 && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${
                    run.delta > 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {run.delta > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {run.delta > 0 ? "+" : ""}
                  {run.delta}
                </span>
              )}
            </div>
            {asst && (
              <p className="mt-1 text-[11px] font-medium text-primary flex items-center gap-1 truncate">
                <Bot className="h-3 w-3 shrink-0" />
                <span>{asst.name}</span>
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>
                {new Date(run.startedAt).toLocaleString("es-MX", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {run.suiteName && (
                <span className="truncate max-w-[120px] text-[10px]">
                  {run.suiteName}
                </span>
              )}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function ScoreBadge({ run }: { run: Run }) {
  if (run.status === "queued")
    return <Badge variant="outline" className="text-amber-500 border-amber-500/30">En cola…</Badge>;
  if (run.status === "running")
    return <Badge variant="secondary">En curso…</Badge>;
  if (run.status === "failed")
    return <Badge variant="destructive">Fallida</Badge>;
  const score = run.score ?? 0;
  const variant =
    score >= 80 ? "success" : score >= 50 ? "warning" : "destructive";
  return <Badge variant={variant}>Score {score}</Badge>;
}

function Report({
  detail,
  assistantId,
  onApplied,
}: {
  detail: { run: Run; cases: Case[] };
  assistantId?: string | null;
  onApplied: () => void;
}) {
  const { run, cases } = detail;
  const targetAssistantId = run.assistantId ?? assistantId;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Reporte de Evaluación
                {run.testType === "live_audit" ? (
                  <Badge
                    variant="outline"
                    className="text-xs text-emerald-500 border-emerald-500/30"
                  >
                    Auditoría en Vivo
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-xs text-primary border-primary/30"
                  >
                    Simulación Sandbox
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {run.suiteName ?? "Calificación con Juez de IA"}
              </p>
            </div>
            <ScoreBadge run={run} />
          </div>
        </CardHeader>
        {run.error && (
          <CardContent>
            <p className="text-sm text-destructive">{run.error}</p>
          </CardContent>
        )}
      </Card>

      <div className="space-y-3">
        {cases.map((c) => (
          <CaseCard
            key={c.id}
            testCase={c}
            assistantId={targetAssistantId}
            onApplied={onApplied}
          />
        ))}
      </div>
    </div>
  );
}

function cleanPersonaLabel(raw: string): string {
  if (!raw) return "";
  if (!raw.includes(":") && !raw.includes("_")) return raw;
  const short = raw.includes(":") ? raw.split(":").pop()! : raw;
  return short
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function CaseCard({
  testCase,
  assistantId,
  onApplied,
}: {
  testCase: Case;
  assistantId?: string | null;
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbSaved, setKbSaved] = useState(false);

  const verdictBadge =
    testCase.veredicto === "verde" ? (
      <span className="flex items-center gap-1 text-xs font-medium text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> Verde
      </span>
    ) : testCase.veredicto === "amarillo" ? (
      <span className="flex items-center gap-1 text-xs font-medium text-warning">
        <AlertTriangle className="h-3.5 w-3.5" /> Amarillo
      </span>
    ) : testCase.veredicto === "rojo" ? (
      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
        <XCircle className="h-3.5 w-3.5" /> Rojo
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">{testCase.status}</span>
    );

  async function applySuggestion(sug: { pregunta: string; respuesta: string }) {
    setKbLoading(true);
    const res = await fetch("/api/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "qa",
        question: sug.pregunta,
        answer: sug.respuesta,
        assistantId: assistantId || undefined,
      }),
    }).catch(() => null);
    setKbLoading(false);
    if (res?.ok) {
      setKbSaved(true);
      onApplied();
    }
  }

  return (
    <Card>
      <div
        className="flex cursor-pointer items-center justify-between p-4"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          {verdictBadge}
          <div>
            <p className="font-medium text-sm text-foreground">
              {cleanPersonaLabel(testCase.personaLabel || testCase.persona)}
            </p>
            {testCase.hallazgos.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {testCase.hallazgos.length}{" "}
                {testCase.hallazgos.length === 1 ? "hallazgo" : "hallazgos"}
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon">
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {open && (
        <CardContent className="space-y-4 border-t pt-4">
          {testCase.hallazgos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hallazgos del Juez
              </p>
              {testCase.hallazgos.map((h, i) => (
                <div
                  key={i}
                  className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">
                      {TIPO_LABELS[h.tipo] ?? h.tipo}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground italic">
                    "{h.evidencia}"
                  </p>
                  {h.sugerencia && (
                    <div className="mt-2 rounded border border-brand-soft bg-brand-tint p-2">
                      <p className="font-medium text-foreground">
                        Sugerencia para el KB:
                      </p>
                      <p className="text-muted-foreground">
                        P: {h.sugerencia.pregunta}
                      </p>
                      <p className="text-muted-foreground">
                        R: {h.sugerencia.respuesta}
                      </p>
                      <div className="mt-2">
                        {kbSaved ? (
                          <span className="text-success text-xs font-medium">
                            ✓ Agregada al conocimiento
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={kbLoading}
                            onClick={(e) => {
                              e.stopPropagation();
                              void applySuggestion(h.sugerencia!);
                            }}
                          >
                            {kbLoading
                              ? "Guardando…"
                              : "Agregar al Knowledge Base"}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Transcript de la Conversación
            </p>
            <div className="space-y-1.5 rounded-lg border bg-card p-3 font-mono text-xs">
              {testCase.transcript.length === 0 ? (
                <p className="text-muted-foreground">
                  Sin mensajes registrados.
                </p>
              ) : (
                testCase.transcript.map((t, idx) => (
                  <p key={idx} className="leading-relaxed">
                    <span
                      className={
                        t.role === "cliente"
                          ? "font-semibold text-primary"
                          : "font-semibold text-foreground"
                      }
                    >
                      {t.role === "cliente" ? "CLIENTE" : "AGENTE"}:
                    </span>{" "}
                    {t.text}
                  </p>
                ))
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
