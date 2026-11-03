"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Cloud,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ArrowRight,
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
import { Switch } from "@/components/ui/switch";

type StorageSettings = {
  enabled: boolean;
  endpoint: string | null;
  bucketName: string | null;
  region: string | null;
  accessKeyId: string | null;
  secretLast4: string | null;
  hasSecret: boolean;
};

export function StorageClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<StorageSettings | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [endpoint, setEndpoint] = useState("https://s3.us-east-1.amazonaws.com");
  const [bucketName, setBucketName] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/storage");
      if (res.ok) {
        const d = await res.json();
        if (d.ok && d.storage) {
          setSettings(d.storage);
          setEnabled(Boolean(d.storage.enabled));
          if (d.storage.endpoint) setEndpoint(d.storage.endpoint);
          if (d.storage.bucketName) setBucketName(d.storage.bucketName);
          if (d.storage.region) setRegion(d.storage.region);
          if (d.storage.accessKeyId) setAccessKeyId(d.storage.accessKeyId);
        }
      }
    } catch (err) {
      console.error("Error al cargar almacenamiento:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(null);

    if (enabled && (!endpoint.trim() || !bucketName.trim() || !accessKeyId.trim())) {
      setError("Por favor completa los campos obligatorios del bucket S3.");
      return;
    }

    if (enabled && !settings?.hasSecret && !secretAccessKey.trim()) {
      setError("Se requiere ingresar la Secret Access Key para la conexión inicial.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        enabled,
        endpoint: endpoint.trim(),
        bucketName: bucketName.trim(),
        region: region.trim() || "us-east-1",
        accessKeyId: accessKeyId.trim(),
      };
      if (secretAccessKey.trim()) {
        payload.secretAccessKey = secretAccessKey.trim();
      }

      const res = await fetch("/api/settings/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error?.message ?? "Error al validar y guardar el bucket S3.");
      } else {
        setSuccess(
          enabled
            ? "Conexión a S3 verificada y credenciales cifradas con éxito."
            : "Configuración guardada (usando almacenamiento local)."
        );
        setSecretAccessKey("");
        void fetchSettings();
      }
    } catch (err) {
      setError(`Error de red: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando configuración de almacenamiento...
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Estado del Almacenamiento */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Almacenamiento de Archivos y Adjuntos</CardTitle>
              <CardDescription>
                Administra dónde se guardan los audios de voz, comprobantes, imágenes y documentos comerciales.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {enabled ? "S3 Nube" : "Local"}
              </span>
              <div
                className={`h-3 w-3 rounded-full ${
                  enabled ? "bg-emerald-500 shadow-sm" : "bg-blue-500"
                }`}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg border p-4 bg-muted/20">
            <div className="flex items-start gap-3">
              {enabled ? (
                <Cloud className="h-6 w-6 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <HardDrive className="h-6 w-6 text-blue-600 mt-0.5 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-sm">
                  {enabled
                    ? `Bucket S3 Activo (${settings?.bucketName ?? bucketName})`
                    : "Almacenamiento Local en Servidor (Predeterminado)"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {enabled
                    ? "Los nuevos archivos se suben a tu bucket S3. Si hay fallas de red, se respaldan localmente en automático."
                    : "Tus archivos se guardan localmente en el volumen del servidor sin costo adicional."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="s3-toggle" className="text-xs font-medium cursor-pointer">
                {enabled ? "Desactivar S3" : "Conectar S3"}
              </Label>
              <Switch
                label="Conectar S3"
                checked={enabled}
                onCheckedChange={(val) => {
                  setEnabled(val);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulario de Conexión S3 Compatible */}
      <Card className={!enabled ? "opacity-75" : ""}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" /> Configuración de AWS S3 o Compatible
          </CardTitle>
          <CardDescription>
            Compatible con Amazon Web Services (AWS S3), Cloudflare R2, MinIO, Wasabi y DigitalOcean Spaces. Las credenciales se guardan cifradas con AES-256-GCM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="endpoint">Endpoint S3</Label>
                <Input
                  id="endpoint"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://s3.us-east-1.amazonaws.com o https://<account_id>.r2.cloudflarestorage.com"
                  disabled={!enabled || saving}
                />
                <p className="text-[11px] text-muted-foreground">
                  Para AWS S3 usa <code>https://s3.&#123;region&#125;.amazonaws.com</code>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bucket">Nombre del Bucket</Label>
                <Input
                  id="bucket"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  placeholder="mi-empresa-medios"
                  disabled={!enabled || saving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="region">Región</Label>
                <Input
                  id="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="us-east-1 o auto"
                  disabled={!enabled || saving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="accessKey">Access Key ID</Label>
                <Input
                  id="accessKey"
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  disabled={!enabled || saving}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="secretKey">Secret Access Key</Label>
                  {settings?.hasSecret && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Actual: ••••••••{settings.secretLast4}
                    </span>
                  )}
                </div>
                <Input
                  id="secretKey"
                  type="password"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  placeholder={
                    settings?.hasSecret
                      ? "Dejar vacío para conservar la clave actual"
                      : "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  }
                  disabled={!enabled || saving}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-400 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <div className="flex items-center justify-end pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando conexión...
                  </>
                ) : (
                  <>
                    Probar conexión y guardar <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
