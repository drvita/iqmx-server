import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://checador.iqissmexico.com"),
  title: {
    default: "Checador Facial IQISS — Control de Asistencia para Empresas",
    template: "%s | Checador Facial IQISS",
  },
  description:
    "Plataforma de control de asistencia por reconocimiento facial con prueba de vida, operación en quiosco incluso sin internet, reportes de jornada laboral y cumplimiento LFPDPPP, desarrollada por IQISSMexico.",
  keywords: [
    "checador facial",
    "control de asistencia",
    "reloj checador facial",
    "asistencia laboral mexico",
    "quiosco de asistencia",
    "cumplimiento jornada laboral",
    "IQISSMexico",
  ],
  authors: [{ name: "IQISSMexico", url: "https://iqissmexico.com" }],
  creator: "IQISSMexico",
  publisher: "IQISSMexico",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/kiosk-icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "Checador Facial IQISS",
    title: "Checador Facial IQISS — Control de Asistencia para Empresas",
    description:
      "Control de asistencia por reconocimiento facial con prueba de vida, operación en quiosco sin depender de internet y reportes automáticos de jornada laboral.",
  },
  twitter: {
    card: "summary",
    title: "Checador Facial IQISS — Control de Asistencia",
    description:
      "Control de asistencia facial con prueba de vida y cumplimiento de jornada laboral para empresas en México.",
  },
  robots: {
    index: true,
    follow: true,
  },
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
