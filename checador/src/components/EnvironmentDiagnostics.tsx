"use client";

import { useEffect, useState } from "react";
import { Camera, Cpu, MonitorSmartphone, ShieldCheck } from "lucide-react";

interface BrowserCapabilities {
  webgpu: boolean;
  wasm: boolean;
  mediaDevices: boolean;
  secureContext: boolean;
  viewportCategory: "Smartphone" | "Tablet" | "PC";
  viewportWidth: number;
}

function resolveViewportCategory(width: number): "Smartphone" | "Tablet" | "PC" {
  if (width < 768) return "Smartphone";
  if (width < 1024) return "Tablet";
  return "PC";
}

export function EnvironmentDiagnostics() {
  const [caps, setCaps] = useState<BrowserCapabilities | null>(null);

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
      const hasWasm = typeof WebAssembly === "object";
      const hasMedia =
        typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia);

      setCaps({
        webgpu: hasWebGpu,
        wasm: hasWasm,
        mediaDevices: hasMedia,
        secureContext: window.isSecureContext,
        viewportCategory: resolveViewportCategory(width),
        viewportWidth: width,
      });
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!caps) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Verificando capacidades del navegador...
      </div>
    );
  }

  const items = [
    {
      label: "Backend WebGPU",
      ok: caps.webgpu,
      detail: caps.webgpu ? "Disponible" : "Respaldo WASM activo",
      icon: Cpu,
    },
    {
      label: "WebAssembly (ORT)",
      ok: caps.wasm,
      detail: caps.wasm ? "Soportado" : "No soportado",
      icon: ShieldCheck,
    },
    {
      label: "Cámara (getUserMedia)",
      ok: caps.mediaDevices && caps.secureContext,
      detail:
        caps.mediaDevices && caps.secureContext
          ? "Lista en contexto seguro"
          : "Requiere localhost o HTTPS",
      icon: Camera,
    },
    {
      label: "Viewport DevTools",
      ok: true,
      detail: `${caps.viewportCategory} (${caps.viewportWidth}px)`,
      icon: MonitorSmartphone,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs"
          >
            <div
              className={`rounded-lg p-2 ${
                item.ok
                  ? "bg-emerald-50 text-[#059669]"
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-500">{item.label}</p>
              <p className="tnum text-sm font-semibold text-slate-900">
                {item.detail}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
