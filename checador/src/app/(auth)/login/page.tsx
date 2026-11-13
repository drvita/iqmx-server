import type { Metadata } from "next";
import { LoginClient } from "@/components/auth/LoginClient";

export const metadata: Metadata = {
  title: "Iniciar Sesión",
  description:
    "Accede al panel administrativo de Checador Facial IQISS para gestionar colaboradores, horarios, sucursales, terminales quiosco y reportes de asistencia laboral.",
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    title: "Checador Facial IQISS — Acceso al Panel de Asistencia",
    description:
      "Plataforma de control de asistencia por reconocimiento facial con prueba de vida, modo quiosco sin conexión y cumplimiento de jornada laboral.",
    url: "https://checador.iqissmexico.com/login",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Checador Facial IQISS",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Android, iOS",
  url: "https://checador.iqissmexico.com/login",
  sameAs: "https://iqissmexico.com/landingpage/checador",
  description:
    "Sistema empresarial de control de asistencia por reconocimiento facial con prueba de vida anti-suplantación, funcionamiento en quiosco incluso sin internet, reportes de jornada laboral y cumplimiento LFPDPPP.",
  publisher: {
    "@type": "Organization",
    name: "IQISSMexico",
    url: "https://iqissmexico.com",
  },
  offers: [
    {
      "@type": "Offer",
      name: "Prueba Gratuita 1 Mes",
      price: "0",
      priceCurrency: "MXN",
    },
    {
      "@type": "Offer",
      name: "Plan Básico Mensual",
      price: "520",
      priceCurrency: "MXN",
    },
  ],
  featureList: [
    "Reconocimiento facial con prueba de vida en tiempo real",
    "Modo quiosco para tablets que funciona sin depender de internet",
    "Vinculación rápida de terminales mediante código QR",
    "Reportes semanales de cumplimiento de jornada laboral, retardos y horas extra",
    "Cumplimiento LFPDPPP con consentimiento registrado y sin almacenar fotos innecesarias",
  ],
};

export default function LoginPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LoginClient />
    </>
  );
}
