import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Checador Facial IQISS — Control de Asistencia Biométrico",
  description:
    "Plataforma SaaS multi-inquilino de control de asistencia biométrico offline-first con IA local y cumplimiento de jornada laboral.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e1b4b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#f8fafc] font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
