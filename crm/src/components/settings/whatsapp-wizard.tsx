"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Globe,
  Phone,
  Trash2,
} from "lucide-react";
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

type Connection = {
  id: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  label: string | null;
  isDefault: boolean;
  aiEnabled: boolean;
  assistantId: string | null;
  signupMethod: "manual" | "embedded_signup";
  status: "connected" | "reconnect_required";
  tokenLast4: string;
};

type AssistantOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

type WebhookInfo = {
  url: string;
  verifyToken: string;
  isHttps: boolean;
  signatureLayer: boolean;
};

export function WhatsappWizard() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [assistants, setAssistants] = useState<AssistantOption[]>([]);
  const [webhook, setWebhook] = useState<WebhookInfo | null>(null);
  const [maxWhatsappAccounts, setMaxWhatsappAccounts] = useState<number>(1);
  const [canAddAccount, setCanAddAccount] = useState<boolean>(true);
  const [loaded, setLoaded] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  const refetch = useCallback(async () => {
    const [c, w] = await Promise.all([
      fetch("/api/settings/whatsapp").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings/webhook").then((r) => (r.ok ? r.json() : null)),
    ]).catch(() => [null, null]);

    if (c) {
      const conns = c.connections ?? (c.connection ? [c.connection] : []);
      setConnections(conns);
      setAssistants(c.assistants ?? []);
      const maxAccs = c.maxWhatsappAccounts ?? 1;
      setMaxWhatsappAccounts(maxAccs);
      setCanAddAccount(c.canAddAccount ?? conns.length < maxAccs);
    }
    if (w) setWebhook(w);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  async function updateLine(
    phoneNumberId: string,
    patch: { assistantId?: string | null; aiEnabled?: boolean; label?: string },
  ) {
    await fetch("/api/settings/whatsapp", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phoneNumberId, ...patch }),
    });
    void refetch();
  }

  async function deleteLine(phoneNumberId: string) {
    if (!confirm("¿Seguro que deseas desconectar esta línea telefónica?"))
      return;
    await fetch(
      `/api/settings/whatsapp?phoneNumberId=${encodeURIComponent(phoneNumberId)}`,
      {
        method: "DELETE",
      },
    );
    void refetch();
  }

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">Cargando líneas…</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            Líneas de WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">
            Conecta y administra múltiples números para tu negocio y asigna qué
            Asistente IA atiende en cada línea.
          </p>
        </div>
        <Badge
          variant={canAddAccount ? "outline" : "secondary"}
          className="shrink-0 text-xs"
        >
          {connections.length} / {maxWhatsappAccounts} línea
          {maxWhatsappAccounts === 1 ? "" : "s"}
        </Badge>
      </div>

      {!canAddAccount && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">
              Límite de líneas alcanzado ({connections.length}/
              {maxWhatsappAccounts})
            </span>
            <p className="mt-0.5 opacity-90">
              Has alcanzado el número máximo de líneas de WhatsApp permitidas
              por tu membresía actual. Para conectar nuevas líneas o transferir
              números, actualiza tu plan en el portal central.
            </p>
          </div>
        </div>
      )}

      {/* Tarjetas de Líneas Conectadas */}
      <div className="space-y-4">
        {connections.map((conn) => (
          <Card key={conn.phoneNumberId} className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        {conn.label ||
                          conn.verifiedName ||
                          conn.displayPhoneNumber ||
                          conn.phoneNumberId}
                      </CardTitle>
                      {conn.isDefault && (
                        <Badge variant="outline">Predeterminado</Badge>
                      )}
                      <Badge
                        variant={
                          conn.status === "connected"
                            ? "success"
                            : "destructive"
                        }
                      >
                        {conn.status === "connected"
                          ? "Conectado"
                          : "Reconexión requerida"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      {conn.displayPhoneNumber
                        ? `${conn.displayPhoneNumber} · `
                        : ""}
                      {conn.verifiedName ? `${conn.verifiedName} · ` : ""}
                      Token …{conn.tokenLast4}
                    </CardDescription>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void deleteLine(conn.phoneNumberId)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Desconectar línea"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 border-t pt-3">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Selector de Asistente IA Conversacional */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor={`asst-${conn.phoneNumberId}`}
                    className="text-xs font-medium"
                  >
                    Asistente IA Asignado
                  </Label>
                  <select
                    id={`asst-${conn.phoneNumberId}`}
                    value={conn.assistantId || ""}
                    onChange={(e) =>
                      void updateLine(conn.phoneNumberId, {
                        assistantId: e.target.value || null,
                      })
                    }
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-xs font-medium shadow-sm"
                  >
                    <option value="">Sin Asistente Asignado (Mudo)</option>
                    {assistants.map((a) => (
                      <option key={a.id} value={a.id}>
                        💬 {a.name} {a.isDefault ? "(Predeterminado)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Switch para activar IA en esta línea */}
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-2.5">
                  <div>
                    <Label className="text-xs font-medium">
                      Atención con IA
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {conn.aiEnabled
                        ? "El asistente responde automáticamente"
                        : "Solo operadores humanos"}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={conn.aiEnabled}
                    onClick={() =>
                      void updateLine(conn.phoneNumberId, {
                        aiEnabled: !conn.aiEnabled,
                      })
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
                      conn.aiEnabled ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        conn.aiEnabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Datos Técnicos para el Propietario */}
              <div className="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
                <span>
                  <strong>Phone Number ID:</strong> {conn.phoneNumberId}
                </span>
                <span>
                  <strong>WABA ID:</strong> {conn.wabaId}
                </span>
                <span>
                  <strong>Origen:</strong>{" "}
                  {conn.signupMethod === "embedded_signup"
                    ? "Embedded Signup"
                    : "Manual"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}

        {connections.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Phone className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 text-sm font-medium">
              No hay números de WhatsApp conectados
            </p>
            <p className="text-xs text-muted-foreground">
              Conecta tu primer número para comenzar a recibir y enviar
              mensajes.
            </p>
          </div>
        )}
      </div>

      {/* Portal Central de Conexión (iqissmexico.com) */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">
                  Onboarding Centralizado en iqissmexico.com
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Las líneas de WhatsApp se conectan de forma segura mediante Meta
                Coexistencia en tu portal central y se aprovisionan
                automáticamente en este CRM.
              </p>
            </div>
            <a
              href="https://iqissmexico.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 shrink-0"
            >
              <span>Ir al Portal Central</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Tarjeta de Webhook */}
      {webhook && <WebhookCard webhook={webhook} />}
    </div>
  );
}
function WebhookCard({ webhook }: { webhook: WebhookInfo }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedProvisionUrl, setCopiedProvisionUrl] = useState(false);

  const provisionUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/settings/whatsapp/provision`
      : "/api/settings/whatsapp/provision";

  function copy(text: string, setFn: (v: boolean) => void) {
    void navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Integración con tu Servidor Central (iqissmexico.com)
        </CardTitle>
        <CardDescription className="text-xs">
          Proporciona estos datos a tu servidor central para que pueda
          aprovisionar números y reenviar los mensajes de Meta hacia este CRM de
          forma 100% automatizada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URL de Reenvío de Webhooks */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            1. URL del Webhook (Reenvío de Mensajes)
          </Label>
          <div className="flex gap-2">
            <Input readOnly value={webhook.url} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(webhook.url, setCopiedUrl)}
            >
              {copiedUrl ? "Copiado" : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            En tu servidor central, configura esta URL como destino de webhook
            para este cliente.
          </p>
        </div>

        {/* Token de Verificación / Clave de Integración */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            2. Verify Token / Clave de Integración
          </Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={webhook.verifyToken}
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(webhook.verifyToken, setCopiedToken)}
            >
              {copiedToken ? "Copiado" : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Úsalo en tu servidor central como cabecera{" "}
            <code>Authorization: Bearer &lt;Token&gt;</code> al llamar a la API
            de aprovisionamiento.
          </p>
        </div>

        {/* Endpoint de Aprovisionamiento */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            3. Endpoint de Aprovisionamiento Automatizado (POST)
          </Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={provisionUrl}
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(provisionUrl, setCopiedProvisionUrl)}
            >
              {copiedProvisionUrl ? "Copiado" : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cuando un cliente complete el onboarding en iqissmexico.com, tu
            servidor debe hacer un <code>POST</code> a esta ruta con{" "}
            <code>wabaId</code>, <code>phoneNumberId</code> y <code>token</code>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
