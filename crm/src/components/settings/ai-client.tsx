"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Key,
  Cpu,
  Globe,
  Clock,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Gift,
} from "lucide-react";
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

type AvailableModel = {
  id: string;
  name: string;
  isFree: boolean;
};

const DEFAULT_FREE_MODEL = "minimax/minimax-m2.7:free";

export function AiClient() {
  const [hasCustomApiKey, setHasCustomApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [aiModel, setAiModel] = useState(DEFAULT_FREE_MODEL);
  const [aiJudgeModel, setAiJudgeModel] = useState(DEFAULT_FREE_MODEL);
  const [aiBaseUrl, setAiBaseUrl] = useState("https://openrouter.ai/api");
  const [agentCoalesceMs, setAgentCoalesceMs] = useState(6000);
  const [loaded, setLoaded] = useState(false);

  // Modelos dinámicos desde la API de OpenRouter
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cargar configuración actual
  useEffect(() => {
    fetch("/api/settings/ai")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && d.settings) {
          setHasCustomApiKey(Boolean(d.settings.hasCustomApiKey));
          if (d.settings.aiModel) setAiModel(d.settings.aiModel);
          if (d.settings.aiJudgeModel) setAiJudgeModel(d.settings.aiJudgeModel);
          if (d.settings.aiBaseUrl) setAiBaseUrl(d.settings.aiBaseUrl);
          if (d.settings.agentCoalesceMs) setAgentCoalesceMs(d.settings.agentCoalesceMs);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Cargar catálogo de modelos desde OpenRouter
  useEffect(() => {
    setLoadingModels(true);
    fetch("/api/settings/ai/models")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.models && Array.isArray(d.models)) {
          setAvailableModels(d.models);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingModels(false));
  }, []);

  // Filtrar modelos gratuitos y populares
  const freeModels = useMemo(
    () => availableModels.filter((m) => m.isFree),
    [availableModels]
  );

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/settings/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim() || undefined,
          model: aiModel.trim(),
          baseUrl: aiBaseUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setTestResult({ ok: true, message: data.message });
      } else {
        setTestResult({ ok: false, message: data.error || "No se pudo conectar con el proveedor." });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: `Error de red: ${err.message || err}` });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    const payload: Record<string, unknown> = {
      aiModel: aiModel.trim(),
      aiJudgeModel: aiJudgeModel.trim() || null,
      aiBaseUrl: aiBaseUrl.trim() || "https://openrouter.ai/api",
      agentCoalesceMs,
    };

    if (apiKey.trim().length > 0) {
      payload.aiApiKey = apiKey.trim();
    }

    try {
      const res = await fetch("/api/settings/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setSaveSuccess(true);
        if (apiKey.trim().length > 0) {
          setHasCustomApiKey(true);
          setApiKey("");
        }
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setErrorMessage(data.error || "Error al guardar la configuración.");
      }
    } catch (err: any) {
      setErrorMessage(`Error de conexión: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="text-sm text-text-3">Cargando configuración de IA…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Motor de Inteligencia Artificial OpenRouter
        </h2>
        <p className="text-sm text-text-3 mt-1">
          Configura las credenciales de tu proveedor LLM para que los asistentes conversacionales respondan
          en tus líneas de WhatsApp. Cada organización utiliza sus propias credenciales cifradas con AES-256-GCM.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            Clave de API de OpenRouter
          </CardTitle>
          <CardDescription>
            Obtén tu clave de API en{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline inline-flex items-center gap-1 font-medium"
            >
              openrouter.ai/keys <ExternalLink className="h-3 w-3" />
            </a>
            . Te permite acceder a modelos de OpenAI, Anthropic, DeepSeek, Meta y Google sin cuentas separadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-api-key">API Key privada</Label>
              {hasCustomApiKey ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" /> Clave configurada y activa
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  <AlertCircle className="h-3.5 w-3.5" /> Pendiente de configurar
                </span>
              )}
            </div>
            <Input
              id="ai-api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasCustomApiKey ? "•••••••••••••••••••••••••••••••• (ingresa una nueva para reemplazarla)" : "sk-or-v1-..."}
              className="font-mono text-sm"
            />
            <p className="text-xs text-text-3">
              Tu clave se almacena cifrada en reposo. Nunca se expone en texto plano al navegador.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            Modelo y Parámetros del Agente
          </CardTitle>
          <CardDescription>
            Elige el modelo principal que atenderá a tus contactos y el modelo evaluador para el Laboratorio de autoevaluación.
            Puedes escribir cualquier ID de modelo de OpenRouter o seleccionar de las sugerencias.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Accesos rápidos a modelos gratuitos */}
          {freeModels.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mb-2">
                <Gift className="h-3.5 w-3.5 text-emerald-600" />
                <span>Modelos gratuitos de OpenRouter (sin costo por token):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {freeModels.slice(0, 5).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setAiModel(m.id);
                      setAiJudgeModel(m.id);
                    }}
                    className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-mono text-emerald-900 hover:bg-emerald-100 transition-colors"
                  >
                    {m.id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Modelo Principal con Autocompletador Datalist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-model">Modelo Conversacional Principal</Label>
              {loadingModels && (
                <span className="inline-flex items-center gap-1 text-xs text-text-3">
                  <Loader2 className="h-3 w-3 animate-spin" /> Cargando catálogo de OpenRouter…
                </span>
              )}
            </div>
            <Input
              id="ai-model"
              list="openrouter-models-list"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="Ej: google/gemma-4-31b-it:free o anthropic/claude-3.5-sonnet"
              className="font-mono text-sm"
            />
            <datalist id="openrouter-models-list">
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.isFree ? "— [GRATIS]" : ""}
                </option>
              ))}
            </datalist>
            <p className="text-xs text-text-3">
              Escribe o busca el nombre/ID del modelo según el catálogo de OpenRouter.
            </p>
          </div>

          {/* Modelo Juez con Autocompletador Datalist */}
          <div className="space-y-2">
            <Label htmlFor="ai-judge-model">Modelo Evaluador (Laboratorio)</Label>
            <Input
              id="ai-judge-model"
              list="openrouter-models-list"
              value={aiJudgeModel}
              onChange={(e) => setAiJudgeModel(e.target.value)}
              placeholder="Ej: google/gemma-4-31b-it:free o anthropic/claude-3.5-sonnet"
              className="font-mono text-sm"
            />
            <p className="text-xs text-text-3">
              Se utiliza exclusivamente en el Laboratorio para calificar la precisión y coherencia de las respuestas.
            </p>
          </div>

          {/* URL Base y Debounce */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
            <div className="space-y-2">
              <Label htmlFor="ai-base-url" className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-text-3" />
                URL Base de la API
              </Label>
              <Input
                id="ai-base-url"
                type="url"
                value={aiBaseUrl}
                onChange={(e) => setAiBaseUrl(e.target.value)}
                placeholder="https://openrouter.ai/api"
                className="font-mono text-sm"
              />
              <p className="text-xs text-text-3">
                Predeterminada: <code>https://openrouter.ai/api</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-coalesce" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-text-3" />
                Ventana de Agrupamiento (ms)
              </Label>
              <Input
                id="agent-coalesce"
                type="number"
                min={1000}
                max={30000}
                step={500}
                value={agentCoalesceMs}
                onChange={(e) => setAgentCoalesceMs(parseInt(e.target.value) || 6000)}
                className="text-sm"
              />
              <p className="text-xs text-text-3">
                Tiempo de espera para juntar ráfagas de mensajes del cliente en una sola respuesta (ej. 6000 ms = 6s).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mensajes de retroalimentación */}
      {testResult && (
        <div
          className={`rounded-lg border p-4 text-sm flex items-start gap-2.5 ${
            testResult.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-semibold">{testResult.ok ? "Conexión Exitosa" : "Error en la Prueba"}</p>
            <p className="text-xs mt-0.5">{testResult.message}</p>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Configuración guardada correctamente.</span>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleTestConnection}
          disabled={testing || saving || (!hasCustomApiKey && apiKey.trim().length === 0)}
          className="text-xs"
        >
          {testing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Probando conexión…
            </>
          ) : (
            "Probar conexión con OpenRouter"
          )}
        </Button>

        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || testing}
          className="text-xs px-6"
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Guardando…
            </>
          ) : (
            "Guardar Cambios"
          )}
        </Button>
      </div>
    </div>
  );
}
