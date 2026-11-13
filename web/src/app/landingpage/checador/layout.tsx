import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Checador Facial IQISS — Control de Asistencia para Empresas',
  description:
    'Control de asistencia por reconocimiento facial con prueba de vida, operación en quiosco incluso sin internet, reportes de jornada laboral y cumplimiento LFPDPPP. Prueba 1 mes gratis.',
  alternates: {
    canonical: 'https://iqissmexico.com/landingpage/checador',
  },
  openGraph: {
    title: 'Checador Facial IQISS — Control de Asistencia con Prueba de Vida',
    description:
      'Convierte cualquier tablet en un reloj checador facial inteligente. Sin filas, sin tarjetas ni fraudes, con reportes automáticos de jornada.',
    url: 'https://iqissmexico.com/landingpage/checador',
    type: 'website',
    locale: 'es_MX',
    siteName: 'IQISSMexico',
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Checador Facial IQISS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android, iOS',
  url: 'https://iqissmexico.com/landingpage/checador',
  description:
    'Plataforma de control de asistencia por reconocimiento facial con prueba de vida, funcionamiento en quiosco sin depender de internet, reportes semanales de jornada y cumplimiento LFPDPPP.',
  publisher: {
    '@type': 'Organization',
    name: 'IQISSMexico',
    url: 'https://iqissmexico.com',
  },
  offers: [
    {
      '@type': 'Offer',
      name: 'Prueba Gratuita 1 Mes',
      price: '0',
      priceCurrency: 'MXN',
    },
    {
      '@type': 'Offer',
      name: 'Plan Básico',
      price: '520',
      priceCurrency: 'MXN',
    },
  ],
};

export default function ChecadorLandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
