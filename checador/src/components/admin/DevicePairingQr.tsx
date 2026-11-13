"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { Check, Copy, Maximize2, QrCode, X } from "lucide-react";

interface DevicePairingQrProps {
  deviceName: string;
  pairingCode: string;
}

function QrCanvas({ value, size }: { value: string; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    void QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      color: {
        dark: "#1e1b4b",
        light: "#ffffff",
      },
    });
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="block rounded-lg"
      aria-label="Código QR de vinculación de quiosco"
    />
  );
}

const emptySubscribe = () => () => {};

export function DevicePairingQr({
  deviceName,
  pairingCode,
}: DevicePairingQrProps) {
  const origin = useSyncExternalStore(
    emptySubscribe,
    () => window.location.origin,
    () => ""
  );
  const pairingUrl = origin ? `${origin}/kiosk?pin=${pairingCode}` : "";
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleCopy = async () => {
    if (!pairingUrl || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(pairingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignorar si el navegador bloquea el portapapeles
    }
  };

  if (!pairingUrl) return null;

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          title="Ampliar código QR"
          className="group relative shrink-0 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xs transition hover:border-[#4f46e5]"
        >
          <QrCanvas value={pairingUrl} size={96} />
          <span className="absolute right-1 bottom-1 rounded bg-white/90 p-0.5 text-slate-600 opacity-0 shadow-xs transition group-hover:opacity-100">
            <Maximize2 className="h-3 w-3" />
          </span>
        </button>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1e1b4b]">
            <QrCode className="h-3.5 w-3.5 text-[#4f46e5]" />
            Escanea para configurar el quiosco
          </p>
          <p className="text-[11px] leading-snug text-slate-600">
            Abre la cámara de la tableta para ir directo a{" "}
            <span className="font-mono font-medium text-slate-800">/kiosk</span>{" "}
            con el PIN precargado.
          </p>
          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Maximize2 className="h-3 w-3" />
              Ampliar QR
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-[#059669]" />
                  Enlace copiado
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copiar enlace
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Vincular {deviceName}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 inline-flex rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <QrCanvas value={pairingUrl} size={220} />
            </div>

            <p className="mt-3 text-xs text-slate-600">
              Escanea este código con la cámara de la terminal para vincularla
              automáticamente.
            </p>
            <p className="tnum mt-2 inline-block rounded-lg bg-indigo-50 px-3 py-1 font-mono text-sm font-bold tracking-widest text-[#1e1b4b]">
              PIN: {pairingCode}
            </p>
            <p className="mt-2 truncate rounded-lg bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-500">
              {pairingUrl}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
