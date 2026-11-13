import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Checador Facial IQISS — Quiosco",
    short_name: "Checador Quiosco",
    description:
      "Terminal biométrica offline-first de control de asistencia empresarial.",
    start_url: "/kiosk",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f8f9ff",
    theme_color: "#1e1b4b",
    icons: [
      {
        src: "/icons/kiosk-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
