"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Coffee,
  Database,
  Lock,
  LogIn,
  LogOut,
  ScanFace,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Utensils,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  checkLocalCooldown,
  clearKioskLocalData,
  detectClockTampering,
  getKioskDb,
  hashAuditPinClient,
  isSyncStale24h,
  purgeExpiredLocalRecords,
  type KioskDeviceConfig,
  type LocalAttendanceRecord,
  type LocalEmployee,
  type LocalVector,
} from "@/lib/pwa-db/kiosk-db";
import {
  evaluateCheckInFromRgba,
  initBiometricEngine,
  type CheckInType,
  type EnrolledEmployeeVector,
} from "@/lib/pwa-ml/biometric-pipeline";

function detectPlatform(): "android" | "ios" | "web" {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  return "web";
}

function formatTimeParts(date: Date): { time: string; period: string } {
  const hours24 = date.getHours();
  const period = hours24 >= 12 ? "PM" : "AM";
  const h12 = String(hours24 % 12 || 12).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return { time: `${h12}:${m}:${s}`, period };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function formatLastSyncLabel(iso: string | undefined): string {
  if (!iso) return "Sin registro";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin registro";
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CHECKIN_LABELS: Record<CheckInType, string> = {
  entrada: "Entrada",
  salida: "Salida",
  inicio_comida: "Inicio Comida",
  fin_comida: "Fin Comida",
};

interface FeedbackBanner {
  tone: "ok" | "warn" | "error";
  title: string;
  detail: string;
}

export function KioskApp() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [booting, setBooting] = useState(true);
  const [config, setConfig] = useState<KioskDeviceConfig | null>(null);
  const [employees, setEmployees] = useState<LocalEmployee[]>([]);
  const [vectors, setVectors] = useState<LocalVector[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => new Date());

  // Estado de vinculación
  const [pin, setPin] = useState("");
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  // Estado de checado activo
  const [busyCheckIn, setBusyCheckIn] = useState(false);
  const [orgSuspended, setOrgSuspended] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  const syncInFlightRef = useRef(false);
  const uploadInFlightRef = useRef(false);
  const uploadQueuedRef = useRef(false);
  const autoPairedPinRef = useRef<string | null>(null);

  // Modal de Auditoría Local (15 días)
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditPinInput, setAuditPinInput] = useState("");
  const [auditUnlocked, setAuditUnlocked] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditRecords, setAuditRecords] = useState<LocalAttendanceRecord[]>([]);

  const logoBlob = config?.logoBlob ?? null;
  const logoObjectUrl = useMemo(() => {
    if (!logoBlob) return null;
    return URL.createObjectURL(logoBlob);
  }, [logoBlob]);

  useEffect(() => {
    return () => {
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    };
  }, [logoObjectUrl]);

  const enrolledForPipeline = useMemo<EnrolledEmployeeVector[]>(() => {
    const empById = new Map(employees.map((e) => [e.id, e]));
    return vectors
      .filter((v) => empById.has(v.empleadoId))
      .map((v) => ({
        id: v.empleadoId,
        nombre: empById.get(v.empleadoId)?.nombreCompleto ?? "Empleado",
        embedding: new Float32Array(v.embedding),
      }));
  }, [employees, vectors]);

  const loadLocalState = useCallback(async () => {
    const db = getKioskDb();
    const cfg = await db.config_dispositivo.get("current");
    if (!cfg) {
      setConfig(null);
      setEmployees([]);
      setVectors([]);
      setPendingCount(0);
      return;
    }

    await purgeExpiredLocalRecords(cfg.cloudEvidencesEnabled);
    const [emps, vecs, pending] = await Promise.all([
      db.empleados_locales
        .toArray()
        .then((all) => all.filter((e) => Boolean(e.activo))),
      db.vectores_locales.toArray(),
      db.checadas_locales.where("sincronizado").equals(0).count(),
    ]);

    setConfig(cfg);
    setEmployees(emps);
    setVectors(vecs);
    setPendingCount(pending);
    console.debug("[Kiosk Sync State]", {
      employees: emps.length,
      vectors: vecs.length,
      pending,
      lastSyncAt: cfg.lastSyncAt,
    });
  }, []);

  const flushPendingAttendances = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (uploadInFlightRef.current) {
      uploadQueuedRef.current = true;
      return;
    }

    const db = getKioskDb();
    const currentCfg = await db.config_dispositivo.get("current");
    if (!currentCfg) return;

    uploadInFlightRef.current = true;
    try {
      const headers = {
        Authorization: `Bearer ${currentCfg.deviceToken}`,
        "Content-Type": "application/json",
      };

      let keepFlushing = true;
      while (keepFlushing) {
        uploadQueuedRef.current = false;
        const unsynced = await db.checadas_locales
          .where("sincronizado")
          .equals(0)
          .toArray();

        if (unsynced.length === 0) break;

        const BATCH_SIZE = 25;
        for (let i = 0; i < unsynced.length; i += BATCH_SIZE) {
          const batch = unsynced.slice(i, i + BATCH_SIZE);
          const payloadRecords = await Promise.all(
            batch.map(async (rec) => ({
              id: rec.id,
              empleadoId: rec.empleadoId,
              tipo: rec.tipo,
              estado: rec.estado,
              timestampLocal: rec.timestampLocal,
              livenessScore: rec.livenessScore,
              matchConfidence: rec.similitud,
              relojAlterado: rec.relojAlterado,
              evidenciaBase64:
                currentCfg.cloudEvidencesEnabled && rec.evidenciaBlob
                  ? await blobToDataUrl(rec.evidenciaBlob).catch(() => null)
                  : null,
            }))
          );

          const attRes = await fetch("/api/sync/attendance", {
            method: "POST",
            headers,
            body: JSON.stringify({
              clientTimeMs: Date.now(),
              records: payloadRecords,
            }),
          });

          if (attRes.status === 403) {
            setOrgSuspended(true);
            keepFlushing = false;
            break;
          }
          if (!attRes.ok) {
            keepFlushing = false;
            break;
          }

          const attData = (await attRes.json()) as {
            ok: boolean;
            acceptedIds?: string[];
            cloudEvidencesEnabled?: boolean;
          };
          const accepted = attData.acceptedIds ?? [];
          const purgeLocalBlob = Boolean(attData.cloudEvidencesEnabled);

          if (accepted.length > 0) {
            await db.transaction("rw", db.checadas_locales, async () => {
              for (const id of accepted) {
                await db.checadas_locales.update(id, {
                  sincronizado: 1,
                  ...(purgeLocalBlob ? { evidenciaBlob: null } : {}),
                });
              }
            });
          }
        }

        const remaining = await db.checadas_locales
          .where("sincronizado")
          .equals(0)
          .count();
        setPendingCount(remaining);
        keepFlushing = uploadQueuedRef.current && remaining > 0;
      }
    } catch (err) {
      console.debug("[Kiosk Upload Error]", err);
    } finally {
      uploadInFlightRef.current = false;
    }
  }, []);

  const runBackgroundSync = useCallback(async () => {
    void flushPendingAttendances();
    if (syncInFlightRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const db = getKioskDb();
    const currentCfg = await db.config_dispositivo.get("current");
    if (!currentCfg) return;

    syncInFlightRef.current = true;
    try {
      const headers = {
        Authorization: `Bearer ${currentCfg.deviceToken}`,
        "Content-Type": "application/json",
      };

      // 1. Heartbeat y validación de estado de la organización (403 ORG_SUSPENDED)
      const hbRes = await fetch("/api/sync/heartbeat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          appVersion: "1.0.0",
          modeloIaVersion: "buffalo_s_v1",
          clientTimeMs: Date.now(),
        }),
      });

      if (hbRes.status === 401) {
        await clearKioskLocalData();
        setAuditOpen(false);
        setAuditUnlocked(false);
        setPairError(
          "Esta terminal fue desvinculada desde el panel administrativo. Ingresa un nuevo PIN para vincularla."
        );
        await loadLocalState();
        return;
      }

      if (hbRes.status === 403) {
        const hbErr = (await hbRes.json().catch(() => null)) as {
          code?: string;
        } | null;
        if (hbErr?.code === "ORG_SUSPENDED") {
          setOrgSuspended(true);
          return;
        }
      }

      if (!hbRes.ok) return;
      setOrgSuspended(false);

      const hbData = (await hbRes.json().catch(() => null)) as {
        organization?: {
          pinAuditoriaHash?: string | null;
        };
      } | null;

      // Si el PIN de auditoría cambió en el servidor, cerrar sesión y purgar datos locales
      const serverPinHash = hbData?.organization?.pinAuditoriaHash ?? null;
      if (
        currentCfg.auditPinHash &&
        serverPinHash !== currentCfg.auditPinHash
      ) {
        await clearKioskLocalData();
        setAuditOpen(false);
        setAuditUnlocked(false);
        setPairError(
          "El PIN de auditoría fue actualizado por el administrador. Por seguridad se cerró la sesión de esta terminal."
        );
        await loadLocalState();
        return;
      }

      // 2. Sync incremental de empleados + purga LFPDPPP de bajas (deletedIds)
      const empUrl = currentCfg.lastSyncAt
        ? `/api/sync/employees?since=${encodeURIComponent(currentCfg.lastSyncAt)}`
        : "/api/sync/employees";
      const empRes = await fetch(empUrl, { headers });

      if (empRes.status === 403) {
        setOrgSuspended(true);
        return;
      }

      if (empRes.ok) {
        const empData = (await empRes.json()) as {
          ok: boolean;
          fullSync?: boolean;
          serverTime: string;
          organization?: {
            nombre: string;
            logoUrl: string | null;
            colorPrimario: string;
            colorSecundario: string;
            mensajeBienvenida: string;
            cloudEvidencesEnabled: boolean;
            horasSemanalesMax: number;
            pinAuditoriaHash?: string | null;
          } | null;
          employees?: LocalEmployee[];
          deletedIds?: string[];
          vectors?: LocalVector[];
        };

        let nextLogoBlob = currentCfg.logoBlob;
        if (
          empData.organization?.logoUrl &&
          empData.organization.logoUrl !== currentCfg.logoUrl
        ) {
          try {
            const logoRes = await fetch(empData.organization.logoUrl);
            if (logoRes.ok) nextLogoBlob = await logoRes.blob();
          } catch {
            // Mantener logo previo en caché
          }
        } else if (empData.organization && !empData.organization.logoUrl) {
          nextLogoBlob = null;
        }

        await db.transaction(
          "rw",
          [db.config_dispositivo, db.empleados_locales, db.vectores_locales],
          async () => {
            if (empData.deletedIds && empData.deletedIds.length > 0) {
              await db.empleados_locales.bulkDelete(empData.deletedIds);
              await db.vectores_locales
                .where("empleadoId")
                .anyOf(empData.deletedIds)
                .delete();
            }

            if (empData.fullSync) {
              await db.empleados_locales.clear();
              await db.vectores_locales.clear();
            }

            if (empData.employees && empData.employees.length > 0) {
              await db.empleados_locales.bulkPut(empData.employees);
              const updatedIds = empData.employees.map((e) => e.id);
              await db.vectores_locales
                .where("empleadoId")
                .anyOf(updatedIds)
                .delete();
            }

            if (empData.vectors && empData.vectors.length > 0) {
              await db.vectores_locales.bulkPut(empData.vectors);
            }

            await db.config_dispositivo.update("current", {
              lastSyncAt: empData.serverTime,
              ...(empData.organization
                ? {
                    orgNombre: empData.organization.nombre,
                    logoUrl: empData.organization.logoUrl,
                    logoBlob: nextLogoBlob,
                    colorPrimario: empData.organization.colorPrimario,
                    colorSecundario: empData.organization.colorSecundario,
                    mensajeBienvenida: empData.organization.mensajeBienvenida,
                    cloudEvidencesEnabled:
                      empData.organization.cloudEvidencesEnabled,
                    horasSemanalesMax: empData.organization.horasSemanalesMax,
                    auditPinHash:
                      empData.organization.pinAuditoriaHash ??
                      currentCfg.auditPinHash ??
                      null,
                  }
                : {}),
            });
          }
        );
      }

      await loadLocalState();
      console.debug("[Kiosk Sync Complete]");
    } catch (err) {
      console.debug("[Kiosk Sync Error]", err);
    } finally {
      syncInFlightRef.current = false;
    }
  }, [loadLocalState, flushPendingAttendances]);

  // Registro Service Worker, estado de red y reloj
  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void runBackgroundSync();
    };
    const onOffline = () => setOnline(false);
    queueMicrotask(() => {
      if (typeof navigator !== "undefined") setOnline(navigator.onLine);
    });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const clockTimer = window.setInterval(() => setNow(new Date()), 1000);

    void (async () => {
      await loadLocalState();
      setBooting(false);
      void runBackgroundSync();
    })();

    const syncTimer = window.setInterval(() => {
      void runBackgroundSync();
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(clockTimer);
      window.clearInterval(syncTimer);
    };
  }, [loadLocalState, runBackgroundSync]);

  // Calentar motor biométrico ONNX en background
  useEffect(() => {
    let active = true;
    void initBiometricEngine()
      .then(() => {
        if (active) setEngineReady(true);
      })
      .catch(() => {
        if (active) setEngineReady(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Cámara activa para el quiosco + verificación hardware
  useEffect(() => {
    let cancelled = false;
    async function startCam() {
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;
        setCameraReady(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setCameraReady(false);
      }
    }

    if (config) {
      void startCam();
    } else if (navigator.mediaDevices?.enumerateDevices) {
      void navigator.mediaDevices
        .enumerateDevices()
        .then((devs) => setCameraReady(devs.some((d) => d.kind === "videoinput")))
        .catch(() => setCameraReady(false));
    }

    return () => {
      cancelled = true;
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop();
        streamRef.current = null;
      }
    };
  }, [config]);

  // Wake Lock cuando el quiosco está activo
  useEffect(() => {
    if (!config || !("wakeLock" in navigator)) return;
    let wakeLock: WakeLockSentinel | null = null;

    const requestLock = async () => {
      try {
        wakeLock = await navigator.wakeLock.request("screen");
      } catch {
        // Ignorar si la pestaña no está visible o el navegador no lo permite
      }
    };

    void requestLock();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void requestLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void wakeLock?.release().catch(() => undefined);
    };
  }, [config]);

  const pairWithPin = useCallback(
    async (rawPin: string) => {
      const normalizedPin = rawPin.trim();
      if (!/^\d{6}$/.test(normalizedPin)) {
        setPairError("Ingresa el PIN numérico de 6 dígitos.");
        return;
      }

      setPairingBusy(true);
      setPairError(null);

      try {
        const plataforma = detectPlatform();
        const res = await fetch("/api/sync/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pin: normalizedPin,
            plataforma,
            appVersion: "1.0.0",
          }),
        });
        const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        deviceToken?: string;
        device?: {
          id: string;
          nombre: string;
          sucursalId: string;
          sucursalNombre: string;
          plataforma: "android" | "ios" | "web";
        };
        organization?: {
          id: string;
          nombre: string;
          logoUrl: string | null;
          colorPrimario: string;
          colorSecundario: string;
          mensajeBienvenida: string;
          cloudEvidencesEnabled: boolean;
          horasSemanalesMax: number;
          pinAuditoriaHash?: string | null;
        };
        employees?: LocalEmployee[];
        vectors?: LocalVector[];
      };

      if (!res.ok || !data.ok || !data.deviceToken || !data.device || !data.organization) {
        setPairError(data.error ?? "No se pudo vincular el dispositivo.");
        return;
      }

      if (navigator.storage?.persist) {
        await navigator.storage.persist().catch(() => false);
      }

      let logoBlob: Blob | null = null;
      if (data.organization.logoUrl) {
        try {
          const logoRes = await fetch(data.organization.logoUrl);
          if (logoRes.ok) {
            logoBlob = await logoRes.blob();
          }
        } catch {
          // Continuar sin logo si falla descarga
        }
      }

      await initBiometricEngine();
      setEngineReady(true);

      const db = getKioskDb();
      const nowMs = Date.now();
      await db.transaction(
        "rw",
        [db.config_dispositivo, db.empleados_locales, db.vectores_locales],
        async () => {
          await db.config_dispositivo.put({
            id: "current",
            deviceToken: data.deviceToken!,
            deviceId: data.device!.id,
            deviceName: data.device!.nombre,
            orgId: data.organization!.id,
            orgNombre: data.organization!.nombre,
            sucursalId: data.device!.sucursalId,
            sucursalNombre: data.device!.sucursalNombre,
            plataforma: data.device!.plataforma,
            logoUrl: data.organization!.logoUrl,
            logoBlob,
            colorPrimario: data.organization!.colorPrimario,
            colorSecundario: data.organization!.colorSecundario,
            mensajeBienvenida: data.organization!.mensajeBienvenida,
            cloudEvidencesEnabled: data.organization!.cloudEvidencesEnabled,
            horasSemanalesMax: data.organization!.horasSemanalesMax,
            auditPinHash: data.organization!.pinAuditoriaHash ?? null,
            lastValidTimestampMs: nowMs,
            lastSyncAt: new Date(nowMs).toISOString(),
          });
          await db.empleados_locales.clear();
          if (data.employees && data.employees.length > 0) {
            await db.empleados_locales.bulkPut(data.employees);
          }
          await db.vectores_locales.clear();
          if (data.vectors && data.vectors.length > 0) {
            await db.vectores_locales.bulkPut(data.vectors);
          }
        }
      );

      setPin("");
      await loadLocalState();
    } catch {
      setPairError("Error de red al intentar vincular la terminal.");
    } finally {
      setPairingBusy(false);
    }
    },
    [loadLocalState]
  );

  const handlePair = (e: React.FormEvent) => {
    e.preventDefault();
    void pairWithPin(pin);
  };

  useEffect(() => {
    if (booting || config) return;
    if (typeof window === "undefined") return;
    const queryPin = new URLSearchParams(window.location.search)
      .get("pin")
      ?.replace(/\D/g, "")
      .slice(0, 6);
    if (!queryPin || !/^\d{6}$/.test(queryPin)) return;
    if (autoPairedPinRef.current === queryPin) return;

    const timer = window.setTimeout(() => {
      autoPairedPinRef.current = queryPin;
      setPin(queryPin);
      window.history.replaceState(null, "", "/kiosk");
      if (navigator.onLine) {
        void pairWithPin(queryPin);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [booting, config, pairWithPin]);

  const captureThumbnailBlob = async (
    canvas: HTMLCanvasElement
  ): Promise<Blob | null> => {
    const thumb = document.createElement("canvas");
    const targetW = 320;
    const targetH = Math.round((canvas.height / canvas.width) * targetW) || 240;
    thumb.width = targetW;
    thumb.height = targetH;
    thumb.getContext("2d")?.drawImage(canvas, 0, 0, targetW, targetH);

    return new Promise((resolve) => {
      thumb.toBlob((blob) => resolve(blob), "image/jpeg", 0.55);
    });
  };

  const handleCheckIn = async (tipo: CheckInType) => {
    if (!config || busyCheckIn) return;
    const video = videoRef.current;
    if (!video || !cameraReady || video.videoWidth === 0) {
      setFeedback({
        tone: "error",
        title: "Cámara no disponible",
        detail: "Verifica los permisos de cámara para realizar el registro.",
      });
      return;
    }

    setBusyCheckIn(true);
    setFeedback(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const evalRes = await evaluateCheckInFromRgba(
        imgData.data,
        canvas.width,
        canvas.height,
        enrolledForPipeline
      );

      if (evalRes.estado === "sin_rostro") {
        setFeedback({
          tone: "warn",
          title: "No se detectó rostro",
          detail: "Colócate frente a la cámara con buena iluminación e intenta de nuevo.",
        });
        return;
      }

      const nowMs = Date.now();
      const clockCheck = detectClockTampering(
        nowMs,
        config.lastValidTimestampMs
      );
      const evidenciaBlob = await captureThumbnailBlob(canvas);
      const db = getKioskDb();

      if (evalRes.estado === "rechazado_spoof") {
        console.info("[Kiosk Audit]", {
          tipo,
          estado: "rechazado_spoof",
          livenessScore: evalRes.livenessScore,
          relojAlterado: clockCheck.tampered,
        });
        await db.checadas_locales.add({
          id: crypto.randomUUID(),
          empleadoId: null,
          empleadoNombre: null,
          tipo,
          estado: "rechazado_spoof",
          similitud: null,
          livenessScore: evalRes.livenessScore,
          evidenciaBlob,
          timestampLocal: nowMs,
          relojAlterado: clockCheck.tampered,
          sincronizado: 0,
        });
        setPendingCount((c) => c + 1);
        setFeedback({
          tone: "error",
          title: "Prueba de vida rechazada",
          detail: "No se aceptan fotografías ni pantallas. Coloca tu rostro real.",
        });
        void flushPendingAttendances();
        return;
      }

      if (evalRes.estado === "rechazado_desconocido" || !evalRes.matchedEmployee) {
        console.info("[Kiosk Audit]", {
          tipo,
          estado: "rechazado_desconocido",
          similitud: evalRes.matchConfidence,
          livenessScore: evalRes.livenessScore,
          employeesLoaded: employees.length,
          vectorsLoaded: vectors.length,
          relojAlterado: clockCheck.tampered,
        });
        await db.checadas_locales.add({
          id: crypto.randomUUID(),
          empleadoId: null,
          empleadoNombre: null,
          tipo,
          estado: "rechazado_desconocido",
          similitud: evalRes.matchConfidence,
          livenessScore: evalRes.livenessScore,
          evidenciaBlob,
          timestampLocal: nowMs,
          relojAlterado: clockCheck.tampered,
          sincronizado: 0,
        });
        setPendingCount((c) => c + 1);
        setFeedback({
          tone: "warn",
          title: "Rostro no reconocido",
          detail: "Acércate de frente a la cámara o solicita enrolamiento con RH.",
        });
        void flushPendingAttendances();
        return;
      }

      const cooldown = await checkLocalCooldown(
        evalRes.matchedEmployee.id,
        nowMs
      );
      if (cooldown.blocked) {
        setFeedback({
          tone: "warn",
          title: `Registro reciente para ${evalRes.matchedEmployee.nombre}`,
          detail: `Espera ${cooldown.remainingSeconds} s antes de registrar otro movimiento.`,
        });
        return;
      }

      await db.checadas_locales.add({
        id: crypto.randomUUID(),
        empleadoId: evalRes.matchedEmployee.id,
        empleadoNombre: evalRes.matchedEmployee.nombre,
        tipo,
        estado: "valido",
        similitud: evalRes.matchConfidence,
        livenessScore: evalRes.livenessScore,
        evidenciaBlob,
        timestampLocal: nowMs,
        relojAlterado: clockCheck.tampered,
        sincronizado: 0,
      });

      if (!clockCheck.tampered) {
        await db.config_dispositivo.update("current", {
          lastValidTimestampMs: nowMs,
        });
        setConfig((prev) =>
          prev ? { ...prev, lastValidTimestampMs: nowMs } : prev
        );
      }

      console.info("[Kiosk Audit]", {
        tipo,
        estado: "valido",
        empleadoId: evalRes.matchedEmployee.id,
        empleadoNombre: evalRes.matchedEmployee.nombre,
        similitud: evalRes.matchConfidence,
        livenessScore: evalRes.livenessScore,
        relojAlterado: clockCheck.tampered,
      });

      setPendingCount((c) => c + 1);
      setFeedback({
        tone: "ok",
        title: `${CHECKIN_LABELS[tipo]} registrada — ${evalRes.matchedEmployee.nombre}`,
        detail: clockCheck.tampered
          ? "Asistencia guardada con aviso en la hora del equipo."
          : "Asistencia guardada correctamente.",
      });
      void flushPendingAttendances();
    } catch (err) {
      setFeedback({
        tone: "error",
        title: "Error al procesar registro",
        detail: err instanceof Error ? err.message : "Intenta nuevamente.",
      });
    } finally {
      setBusyCheckIn(false);
    }
  };

  const openAuditModal = () => {
    setAuditPinInput("");
    setAuditUnlocked(false);
    setAuditError(null);
    setAuditOpen(true);
  };

  const handleUnlockAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    if (!config.auditPinHash) {
      setAuditError(
        "No hay un PIN de auditoría configurado. Solicita al administrador definirlo en Configuración."
      );
      return;
    }
    const enteredHash = await hashAuditPinClient(config.orgId, auditPinInput);
    if (enteredHash !== config.auditPinHash) {
      setAuditError("PIN de auditoría incorrecto.");
      return;
    }
    const db = getKioskDb();
    const list = await db.checadas_locales
      .orderBy("timestampLocal")
      .reverse()
      .limit(100)
      .toArray();
    setAuditRecords(list);
    setAuditUnlocked(true);
    setAuditError(null);
  };

  const handleUnpair = async () => {
    await clearKioskLocalData();
    setAuditOpen(false);
    setAuditUnlocked(false);
    setFeedback(null);
    await loadLocalState();
  };

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9ff] text-sm font-medium text-[#47464f]">
        Iniciando terminal quiosco...
      </div>
    );
  }

  // =========================================================================
  // VISTA 1: VINCULAR TERMINAL QUIOSCO (SIN CONFIGURACIÓN LOCAL)
  // =========================================================================
  if (!config) {
    return (
      <div className="flex min-h-screen flex-col justify-between bg-[#f8f9ff] text-[#0b1c30]">
        <header className="flex w-full items-center justify-between border-b border-[#c8c5d0]/70 bg-white px-6 py-3.5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e1b4b] text-white">
              <ScanFace className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-bold text-[#070235]">
                Checador Facial IQISS
              </span>
              <span className="block text-[11px] uppercase tracking-wider text-[#47464f]">
                Terminal de Asistencia
              </span>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              online
                ? "bg-emerald-50 text-[#179c6e]"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {online ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            <span>{online ? "En línea" : "Sin conexión"}</span>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md rounded-2xl border border-[#c8c5d0]/70 bg-white p-6 shadow-xl sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e1b4b] text-white shadow-md">
              <ScanFace className="h-7 w-7" />
            </div>

            <div className="mt-4 text-center">
              <h1 className="text-xl font-bold tracking-tight text-[#070235]">
                Vincular Terminal Quiosco
              </h1>
              <p className="mt-1 text-xs text-[#47464f]">
                Ingresa el código de 6 dígitos generado en el módulo de
                Dispositivos.
              </p>
            </div>

            <form onSubmit={handlePair} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="kiosk-pin"
                  className="mb-2 block text-center text-xs font-semibold text-[#47464f]"
                >
                  Código de Enlace de Dispositivo
                </label>
                <input
                  id="kiosk-pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="••••••"
                  className="tnum w-full rounded-xl border border-[#c8c5d0] bg-[#f8f9ff] px-4 py-3.5 text-center font-mono text-2xl font-bold tracking-[0.45em] text-[#070235] focus:border-[#4b41e1] focus:ring-2 focus:ring-[#4b41e1]/20 focus:outline-none"
                />
              </div>

              {pairError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {pairError}
                </div>
              )}

              <button
                type="submit"
                disabled={pairingBusy || !online}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4b41e1] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#645efb] disabled:opacity-50"
              >
                <span>
                  {pairingBusy ? "Vinculando y descargando..." : "Vincular Dispositivo"}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-6 rounded-xl border border-[#c8c5d0]/70 bg-[#eff4ff] p-4">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#179c6e]">
                Verificación Técnica del Dispositivo
              </h2>
              <ul className="mt-2.5 space-y-2 text-xs text-[#0b1c30]">
                <li className="flex items-center gap-2">
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 ${
                      engineReady ? "text-[#179c6e]" : "text-amber-500"
                    }`}
                  />
                  <span>
                    Reconocimiento facial{" "}
                    {engineReady ? "listo" : "preparando..."}
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Database className="h-4 w-4 shrink-0 text-[#179c6e]" />
                  <span>Respaldo sin conexión activo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Camera
                    className={`h-4 w-4 shrink-0 ${
                      cameraReady ? "text-[#179c6e]" : "text-amber-500"
                    }`}
                  />
                  <span>
                    {cameraReady
                      ? "Cámara frontal disponible"
                      : "Permiso de cámara pendiente al iniciar"}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // VISTA 2: TERMINAL QUIOSCO ACTIVA (BRANDING DINÁMICO + 4 BOTONES)
  // =========================================================================
  const { time, period } = formatTimeParts(now);
  const missingRosterOrVectors = employees.length === 0 || vectors.length === 0;
  const syncStale24h = isSyncStale24h(config.lastSyncAt, now.getTime());

  return (
    <div
      className="flex min-h-screen flex-col bg-[#f8f9ff] text-[#0b1c30]"
      style={
        {
          "--kiosk-primary": config.colorPrimario || "#1e1b4b",
          "--kiosk-secondary": config.colorSecundario || "#4f46e5",
        } as React.CSSProperties
      }
    >
      {/* Barra superior con branding dinámico */}
      <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#c8c5d0]/70 bg-white px-3.5 py-2.5 shadow-xs sm:gap-4 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {logoObjectUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoObjectUrl}
              alt={config.orgNombre}
              className="h-9 w-9 rounded-xl border border-slate-200 bg-white object-contain p-1 sm:h-11 sm:w-11"
            />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white sm:h-11 sm:w-11"
              style={{ backgroundColor: config.colorPrimario || "#1e1b4b" }}
            >
              <ScanFace className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
          )}

          <div>
            <p className="text-sm font-bold text-[#070235] sm:text-base">
              {config.orgNombre}
            </p>
            <p className="text-[11px] font-medium text-[#47464f] sm:text-xs">
              {config.sucursalNombre} · {config.deviceName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4">
          <div className="text-right">
            <div className="tnum flex items-baseline justify-end gap-1 font-mono text-xl font-bold text-[#070235] sm:text-3xl">
              <span>{time}</span>
              <span
                className="text-xs font-bold sm:text-sm"
                style={{ color: config.colorSecundario || "#4f46e5" }}
              >
                {period}
              </span>
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[10px] sm:gap-2 sm:text-[11px]">
              <span
                className={`inline-flex items-center gap-1 font-semibold ${
                  online ? "text-[#179c6e]" : "text-amber-700"
                }`}
              >
                {online ? (
                  <Wifi className="h-3 w-3" />
                ) : (
                  <WifiOff className="h-3 w-3" />
                )}
                {online ? "En línea" : "Sin conexión"}
              </span>
              <span className="text-slate-300">·</span>
              <span
                className="tnum text-[#47464f]"
                title="Registros pendientes de enviar al panel"
              >
                {pendingCount} por enviar
              </span>
              <span className="hidden text-slate-300 sm:inline">·</span>
              <span className="hidden text-[#47464f] sm:inline">
                Sinc.: {formatLastSyncLabel(config.lastSyncAt)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={openAuditModal}
            title="Auditoría Local"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 sm:h-10 sm:w-10"
          >
            <Lock className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Panel principal táctil */}
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-3 p-3 sm:gap-6 sm:p-6 lg:grid-cols-12">
        {/* Columna izquierda en desktop / abajo de la cámara en móvil: 4 Botones explícitos */}
        <section className="order-2 flex flex-col justify-between space-y-3 sm:space-y-5 lg:order-1 lg:col-span-6">
          <div className="hidden lg:block">
            <p
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: config.colorSecundario || "#4f46e5" }}
            >
              {config.mensajeBienvenida}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#070235]">
              Selecciona tu movimiento frente a la cámara
            </h1>
          </div>

          {orgSuspended && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-900 sm:p-4">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-bold">Servicio temporalmente suspendido</p>
                <p className="mt-0.5">
                  La suscripción de esta organización está suspendida. Contacta
                  al administrador para reactivar los registros de asistencia.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2.5 sm:space-y-3.5">
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-1 lg:gap-3.5">
              <button
                type="button"
                disabled={busyCheckIn || orgSuspended}
                onClick={() => handleCheckIn("entrada")}
                className="flex w-full items-center justify-between rounded-2xl bg-[#059669] px-3.5 py-3.5 text-left text-white shadow-md transition hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 sm:px-6 sm:py-5 lg:py-6"
              >
                <div className="flex items-center gap-2.5 sm:gap-4">
                  <LogIn className="h-6 w-6 shrink-0 sm:h-8 sm:w-8 lg:h-9 lg:w-9" />
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-100 sm:text-[11px] sm:tracking-widest">
                      Entrada
                    </span>
                    <span className="block text-base font-extrabold tracking-tight sm:text-xl lg:text-2xl">
                      <span className="lg:hidden">REGISTRAR</span>
                      <span className="hidden lg:inline">REGISTRAR ENTRADA</span>
                    </span>
                  </div>
                </div>
                <ArrowRight className="hidden h-5 w-5 shrink-0 lg:block lg:h-6 lg:w-6" />
              </button>

              <button
                type="button"
                disabled={busyCheckIn || orgSuspended}
                onClick={() => handleCheckIn("salida")}
                style={{ backgroundColor: config.colorSecundario || "#4f46e5" }}
                className="flex w-full items-center justify-between rounded-2xl px-3.5 py-3.5 text-left text-white shadow-md transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60 sm:px-6 sm:py-5 lg:py-6"
              >
                <div className="flex items-center gap-2.5 sm:gap-4">
                  <LogOut className="h-6 w-6 shrink-0 sm:h-8 sm:w-8 lg:h-9 lg:w-9" />
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-indigo-100 sm:text-[11px] sm:tracking-widest">
                      Salida
                    </span>
                    <span className="block text-base font-extrabold tracking-tight sm:text-xl lg:text-2xl">
                      <span className="lg:hidden">REGISTRAR</span>
                      <span className="hidden lg:inline">REGISTRAR SALIDA</span>
                    </span>
                  </div>
                </div>
                <ArrowRight className="hidden h-5 w-5 shrink-0 lg:block lg:h-6 lg:w-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
              <button
                type="button"
                disabled={busyCheckIn || orgSuspended}
                onClick={() => handleCheckIn("inicio_comida")}
                className="flex items-center gap-2.5 rounded-2xl border border-[#c8c5d0] bg-white p-3 text-left shadow-xs transition hover:border-[#4b41e1] active:scale-[0.99] disabled:opacity-60 sm:gap-3 sm:p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 sm:h-10 sm:w-10">
                  <Utensils className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-medium text-[#47464f] sm:text-[11px]">
                    Pausa
                  </span>
                  <span className="block text-xs font-bold text-[#070235] sm:text-sm">
                    Inicio Comida
                  </span>
                </div>
              </button>

              <button
                type="button"
                disabled={busyCheckIn || orgSuspended}
                onClick={() => handleCheckIn("fin_comida")}
                className="flex items-center gap-2.5 rounded-2xl border border-[#c8c5d0] bg-white p-3 text-left shadow-xs transition hover:border-[#4b41e1] active:scale-[0.99] disabled:opacity-60 sm:gap-3 sm:p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#4f46e5] sm:h-10 sm:w-10">
                  <Coffee className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <span className="block text-[10px] font-medium text-[#47464f] sm:text-[11px]">
                    Reanudación
                  </span>
                  <span className="block text-xs font-bold text-[#070235] sm:text-sm">
                    Fin Comida
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {(missingRosterOrVectors || syncStale24h) && (
              <div className="space-y-2">
                {missingRosterOrVectors && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      No hay personal sincronizado en esta terminal. Verifica el
                      registro de empleados en el panel; los intentos seguirán
                      guardándose para revisión.
                    </span>
                  </div>
                )}
                {syncStale24h && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      Más de 24 horas sin sincronizar (última:{" "}
                      {formatLastSyncLabel(config.lastSyncAt)}). El registro de
                      entradas y salidas sigue operando normalmente.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-[#47464f]">
              <span className="flex items-center gap-2">
                <ShieldCheck
                  className={`h-4 w-4 ${
                    missingRosterOrVectors ? "text-amber-500" : "text-[#179c6e]"
                  }`}
                />
                <span>Colaboradores activos: {employees.length}</span>
              </span>
              <span className="font-mono text-[11px]">
                {engineReady ? "Listo" : "Preparando..."}
              </span>
            </div>
          </div>
        </section>

        {/* Columna derecha en desktop / arriba en móvil: Visor óptico y resultado */}
        <section className="order-1 flex flex-col space-y-3 sm:space-y-4 lg:order-2 lg:col-span-6">
          <div className="relative h-[34svh] min-h-[200px] max-h-[260px] overflow-hidden rounded-2xl border-2 border-[#1e1b4b]/20 bg-[#070235] shadow-xl lg:h-auto lg:max-h-none lg:flex-1">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover lg:min-h-[320px]"
            />
            {/* Mirilla óptica */}
            <div className="pointer-events-none absolute inset-6 rounded-xl border border-white/20">
              <div className="absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2 border-[#85f8c4]" />
              <div className="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-[#85f8c4]" />
              <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-[#85f8c4]" />
              <div className="absolute right-0 bottom-0 h-6 w-6 border-r-2 border-b-2 border-[#85f8c4]" />
            </div>

            {busyCheckIn && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#070235]/60 backdrop-blur-xs">
                <div className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#070235] shadow-lg">
                  Verificando biometría y prueba de vida...
                </div>
              </div>
            )}
          </div>

          {feedback && (
            <div
              role="status"
              className={`rounded-2xl border p-4 shadow-xs ${
                feedback.tone === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : feedback.tone === "warn"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              <div className="flex items-start gap-3">
                {feedback.tone === "ok" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#059669]" />
                ) : feedback.tone === "warn" ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                ) : (
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                )}
                <div>
                  <p className="text-sm font-bold">{feedback.title}</p>
                  <p className="mt-0.5 text-xs">{feedback.detail}</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Modal de Auditoría Local (15 días) */}
      {auditOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#070235]/65 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#4f46e5]" />
                <h2 className="text-base font-bold text-slate-900">
                  Auditoría Local de Terminales
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAuditOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!auditUnlocked ? (
              <form onSubmit={handleUnlockAudit} className="mt-5 space-y-4">
                <p className="text-xs text-slate-600">
                  Ingresa el PIN de auditoría configurado por tu administrador
                  para consultar los registros y miniaturas de los últimos 15
                  días.
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={auditPinInput}
                  onChange={(e) => setAuditPinInput(e.target.value)}
                  placeholder="PIN de 6 dígitos"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-center font-mono text-lg tracking-widest"
                />
                {auditError && (
                  <p className="text-xs font-medium text-red-600">
                    {auditError}
                  </p>
                )}
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#4f46e5] py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Desbloquear Auditoría
                </button>
              </form>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Registros recientes (últimos 15 días): {auditRecords.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleUnpair}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Desvincular Terminal
                  </button>
                </div>

                <div className="space-y-2.5">
                  {auditRecords.map((rec) => (
                    <AuditRecordRow key={rec.id} record={rec} />
                  ))}
                  {auditRecords.length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-500">
                      Aún no hay checadas registradas en este dispositivo.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditRecordRow({ record }: { record: LocalAttendanceRecord }) {
  const thumbUrl = useMemo(() => {
    if (!record.evidenciaBlob) return null;
    return URL.createObjectURL(record.evidenciaBlob);
  }, [record.evidenciaBlob]);

  useEffect(() => {
    return () => {
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    };
  }, [thumbUrl]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-xs">
      <div className="flex items-center gap-3">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt="Evidencia local"
            className="h-12 w-16 rounded-lg border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400">
            Sin foto
          </div>
        )}
        <div>
          <p className="font-bold text-slate-900">
            {record.empleadoNombre ?? "Persona no identificada"} ·{" "}
            {CHECKIN_LABELS[record.tipo]}
          </p>
          <p className="tnum text-[11px] text-slate-500">
            {new Date(record.timestampLocal).toLocaleString("es-MX")}
            {record.relojAlterado ? " · Alerta de reloj" : ""}
          </p>
        </div>
      </div>

      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          record.estado === "valido"
            ? "bg-emerald-50 text-[#059669]"
            : "bg-red-50 text-red-700"
        }`}
      >
        {record.estado === "valido"
          ? "Válido"
          : record.estado === "rechazado_spoof"
            ? "Foto/Pantalla"
            : "Desconocido"}
      </span>
    </div>
  );
}
