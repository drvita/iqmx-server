"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Info } from "lucide-react";
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
import { ZernioConnect } from "@/components/settings/zernio-connect";
import { cn } from "@/lib/utils";

/**
 * 017 — Conexión del canal de Messenger.
 *
 * Dos fuentes, como Instagram: la API unificada de Zernio o una app propia de
 * Meta. Misma forma que el wizard de WhatsApp: se prueba contra la plataforma
 * ANTES de guardar, el token se cifra y hacia fuera solo se enseña su cola. Y
 * la misma regla que los demás canales: la pantalla solo existe si el canal
 * está encendido con `CHANNELS` (ADR-001).
 */

type Source = "zernio" | "meta";

type Connection = {
  source: Source;
  pageId: string | null;
  pageName: string | null;
  accountRef: string | null;
  status: "connected" | "reconnect_required";
  tokenLast4: string;
  aiEnabled?: boolean;
  assistantId?: string | null;
};

type AssistantOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

type WebhookInfo = {
  messengerUrl: string | null;
  verifyToken: string;
  isHttps: boolean;
  signatureLayer: boolean;
};

const HELP: Record<Source, { title: string; items: string[] }> = {
  zernio: {
    title: "Conecta la página en Zernio y pega aquí su cuenta y tu API key",
    items: [
      "La página se vincula en el panel de Zernio, no desde el CRM. Copia de ahí el accountId de la cuenta de Facebook conectada.",
      "La API key se crea en Zernio → Settings → API Keys y se muestra una sola vez (empieza con sk_).",
      "El mismo webhook de Zernio entrega Instagram, WhatsApp y X si esas cuentas están conectadas; el CRM filtra por plataforma y solo ingiere lo de Facebook aquí.",
      "El secreto del webhook es opcional pero recomendado: con él se verifica la firma de cada entrega.",
    ],
  },
  meta: {
    title: "Crea una app en developers.facebook.com con el producto Messenger",
    items: [
      "El ID de la página está en la sección «Información» de la página, o en Messenger → Configuración → Tokens de acceso.",
      "Genera ahí el token de la página con el permiso pages_messaging. Uno de larga duración evita reconectar cada dos meses.",
      "Sin App Review, la página solo recibe mensajes de cuentas con un rol en la app (administradores, desarrolladores, testers).",
    ],
  },
};

export function MessengerClient() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [assistants, setAssistants] = useState<AssistantOption[]>([]);
  const [webhook, setWebhook] = useState<WebhookInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState<Source>("zernio");
  const [pageId, setPageId] = useState("");
  const [accountRef, setAccountRef] = useState("");
  const [token, setToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>("");
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState<"url" | "token" | null>(null);

  // Estado de suscripción de eventos Webhook en Meta
  const [subscription, setSubscription] = useState<{
    subscribed: boolean;
    fields: string[];
    loading: boolean;
  }>({ subscribed: false, fields: [], loading: false });
  const [subscribing, setSubscribing] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [subSuccess, setSubSuccess] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    setSubscription((s) => ({ ...s, loading: true }));
    setSubError(null);
    try {
      const res = await fetch("/api/settings/messenger/subscription");
      if (res.ok) {
        const data = await res.json();
        setSubscription({
          subscribed: Boolean(data.subscribed),
          fields: Array.isArray(data.fields) ? data.fields : [],
          loading: false,
        });
      } else {
        setSubscription((s) => ({ ...s, loading: false }));
      }
    } catch {
      setSubscription((s) => ({ ...s, loading: false }));
    }
  }, []);

  async function handleSubscribe() {
    setSubscribing(true);
    setSubError(null);
    setSubSuccess(null);
    try {
      const res = await fetch("/api/settings/messenger/subscription", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setSubError(data?.error?.message ?? "Error al suscribir eventos en Meta");
      } else {
        setSubSuccess("¡Página suscrita con éxito a todos los eventos!");
        setSubscription({
          subscribed: true,
          fields: data.fields ?? [],
          loading: false,
        });
      }
    } catch {
      setSubError("Error de conexión al suscribir eventos");
    } finally {
      setSubscribing(false);
    }
  }

  const refetch = useCallback(async () => {
    const [c, w] = await Promise.all([
      fetch("/api/settings/messenger").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings/webhook").then((r) => (r.ok ? r.json() : null)),
    ]).catch(() => [null, null]);
    if (c) {
      setConnection(c.connection);
      setAssistants(c.assistants ?? []);
      if (c.connection) {
        setSource(c.connection.source);
        if (c.connection.pageId) setPageId(c.connection.pageId);
        if (c.connection.accountRef) setAccountRef(c.connection.accountRef);
        setSelectedAssistantId(c.connection.assistantId || "");
        setAiEnabled(c.connection.aiEnabled ?? true);
      }
    }
    if (w) setWebhook(w);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (connection?.status === "connected" && connection.source === "meta") {
      void checkSubscription();
    }
  }, [connection?.status, connection?.source, checkSubscription]);

  async function updateAiSettings(patch: { assistantId?: string | null; aiEnabled?: boolean }) {
    setSavingAi(true);
    await fetch("/api/settings/messenger", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    setSavingAi(false);
    void refetch();
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(null);
    const res = await fetch("/api/settings/messenger", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source,
        pageId: pageId.trim() || null,
        accountRef: accountRef.trim() || null,
        token: token.trim(),
        webhookSecret: webhookSecret.trim() || null,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(data?.error?.message ?? "No se pudo conectar la página");
      return;
    }
    const data = (await res.json()) as { pageName?: string | null };
    setToken("");
    setWebhookSecret("");
    setSaved(data.pageName ? `Página conectada: ${data.pageName}` : "Conexión guardada");
    void refetch();
  }

  async function copy(text: string, what: "url" | "token") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // sin portapapeles (contexto no seguro): el texto sigue visible
    }
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const help = HELP[source];
  const canSave =
    token.trim().length > 0 &&
    (source === "zernio" ? accountRef.trim().length > 0 : pageId.trim().length > 0);

  return (
    <div className="max-w-3xl space-y-6">
      {connection?.status === "reconnect_required" && (
        <div className="flex items-start gap-2 rounded-lg border border-danger-soft bg-danger-tint p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-danger-text">
              El token expiró o fue revocado.
            </p>
            <p className="text-danger-text opacity-80">
              Los envíos por Messenger están pausados. Pega uno nuevo abajo para
              reconectar.
            </p>
          </div>
        </div>
      )}

      {connection?.status === "connected" && (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-success-soft bg-success-tint p-4">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-success-text">
                Conectado por {connection.source === "zernio" ? "Zernio" : "Meta"}
                {connection.pageName ? `: ${connection.pageName}` : ""}
              </p>
              <p className="text-success-text opacity-80">
                {connection.source === "zernio"
                  ? `Cuenta ${connection.accountRef}`
                  : `Página ${connection.pageId}`}{" "}
                · token que termina en ····{connection.tokenLast4}
              </p>
            </div>
            <Badge variant="success">Messenger activo</Badge>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Asistente IA para Facebook Messenger</CardTitle>
              <CardDescription>
                Elige qué asistente atenderá a los usuarios que escriban por Messenger y si debe responder automáticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fb-assistant" className="text-xs font-medium">
                    Asistente IA Asignado
                  </Label>
                  <select
                    id="fb-assistant"
                    value={selectedAssistantId}
                    disabled={savingAi}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedAssistantId(val);
                      void updateAiSettings({ assistantId: val || null });
                    }}
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-xs font-medium shadow-sm"
                  >
                    <option value="">Sin Asistente Específico (Usa el predeterminado)</option>
                    {assistants.map((a) => (
                      <option key={a.id} value={a.id}>
                        💬 {a.name} {a.isDefault ? "(Predeterminado)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="fb-ai-toggle" className="text-xs font-medium cursor-pointer">
                      Atención con IA activa
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Si se apaga, la IA no responderá mensajes de Messenger.
                    </p>
                  </div>
                  <input
                    id="fb-ai-toggle"
                    type="checkbox"
                    checked={aiEnabled}
                    disabled={savingAi}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAiEnabled(checked);
                      void updateAiSettings({ aiEnabled: checked });
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {connection.source === "meta" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Suscripción de Webhook (Meta)</CardTitle>
                    <CardDescription>
                      Para que los mensajes y confirmaciones lleguen al CRM, la aplicación debe estar suscrita a los eventos de la página de Facebook.
                    </CardDescription>
                  </div>
                  <Badge variant={subscription.subscribed ? "success" : "secondary"}>
                    {subscription.loading
                      ? "Consultando..."
                      : subscription.subscribed
                      ? "Suscrito"
                      : "No suscrito"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-1">Eventos requeridos:</span>
                    <span className="text-muted-foreground">
                      messages, messaging_postbacks, messaging_referrals, message_deliveries, message_reads
                    </span>
                  </div>
                  {subscription.subscribed && subscription.fields.length > 0 && (
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="font-medium text-text-1">Campos actualmente activos:</span>
                      <span className="font-mono text-[11px] text-brand-text">
                        {subscription.fields.join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {subError && <p className="text-xs text-destructive">{subError}</p>}
                {subSuccess && <p className="text-xs text-success-text">{subSuccess} ✓</p>}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={subscription.loading || subscribing}
                    onClick={() => void checkSubscription()}
                  >
                    {subscription.loading ? "Verificando..." : "Verificar suscripción"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={subscribing}
                    onClick={() => void handleSubscribe()}
                  >
                    {subscribing ? "Suscribiendo..." : "Suscribir eventos de la página"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {connection ? "Reconectar Messenger" : "Conectar Messenger"}
          </CardTitle>
          <CardDescription>
            Los mensajes que la gente le escribe a tu página entran a la misma
            bandeja que WhatsApp, con su distintivo de canal. {help.title}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>¿De dónde llegan los mensajes?</Label>
            <div className="flex flex-wrap gap-2">
              {(["zernio", "meta"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  aria-pressed={source === s}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                    source === s
                      ? "border-brand bg-brand-tint text-brand-text"
                      : "border-border-strong hover:bg-accent"
                  )}
                >
                  {s === "zernio" ? "Zernio (API unificada)" : "App propia de Meta"}
                </button>
              ))}
            </div>
          </div>

          <ul className="list-disc space-y-1 pl-5 text-xs text-text-2">
            {help.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>

          {source === "zernio" ? (
            <ZernioConnect
              endpoint="/api/settings/messenger"
              extraBody={{ source: "zernio" }}
              what="tu página de Facebook"
              idPrefix="fb"
              onSaved={() => void refetch()}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fb-page-id">ID de la página</Label>
                  <Input
                    id="fb-page-id"
                    value={pageId}
                    onChange={(e) => setPageId(e.target.value)}
                    placeholder="1234567890"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fb-token">Token de la página</Label>
                  <Input
                    id="fb-token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="EAAG…"
                    autoComplete="off"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {saved && <p className="text-sm text-success-text">{saved} ✓</p>}

              <Button disabled={saving || !canSave} onClick={() => void save()}>
                {saving ? "Probando…" : "Probar y guardar"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {webhook?.messengerUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Webhook de Messenger</CardTitle>
            <CardDescription>
              {source === "zernio" ? (
                <>
                  En Zernio, da de alta este endpoint con el evento{" "}
                  <code>message.received</code> y, si usas secreto, el mismo que
                  pegaste arriba.
                </>
              ) : (
                <>
                  En tu app de Meta: Messenger → Configuración → Webhooks. Objeto{" "}
                  <code>page</code>, campo <code>messages</code>. Pega esta URL y
                  este token de verificación, y suscribe la página a la app.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>URL de callback</Label>
              <div className="flex gap-2">
                <Input readOnly value={webhook.messengerUrl} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copiar la URL"
                  onClick={() => void copy(webhook.messengerUrl!, "url")}
                >
                  {copied === "url" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {source === "meta" && (
              <div className="space-y-1.5">
                <Label>Token de verificación</Label>
                <div className="flex gap-2">
                  <Input readOnly value={webhook.verifyToken} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copiar el token de verificación"
                    onClick={() => void copy(webhook.verifyToken, "token")}
                  >
                    {copied === "token" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
            <p className="flex items-start gap-2 text-xs text-text-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {source === "zernio"
                ? "Con secreto configurado, cada entrega se verifica con su firma HMAC; sin él, la protección es el segmento secreto de la URL."
                : webhook.signatureLayer
                  ? "Cada entrega se verifica con la firma del App Secret de tu app."
                  : "Define META_APP_SECRET en la instancia para que además se verifique la firma de cada entrega."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
