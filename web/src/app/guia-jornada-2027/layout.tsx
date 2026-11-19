import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title:
    'Guía Reforma Laboral México 2027: Jornada de 46 Horas y Registro Electrónico | IQISSMexico',
  description:
    'Qué cambia en México a partir del 1° de enero de 2027 con la reducción de la jornada laboral a 46 horas y el registro electrónico obligatorio en la Ley Federal del Trabajo (Art. 132-XXXIV). Descarga la guía ejecutiva en PDF.',
  alternates: {
    canonical: 'https://iqissmexico.com/guia-jornada-2027',
  },
  openGraph: {
    title: 'Reforma Laboral México 2027 — Jornada de 46 Horas y Registro Electrónico',
    description:
      'Explicación clara para empresas y negocios en México sobre las obligaciones de la reforma 2026-2027, autodiagnóstico abierto, multas UMA y soluciones disponibles.',
    url: 'https://iqissmexico.com/guia-jornada-2027',
    type: 'article',
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
  '@type': 'Article',
  headline:
    'Reducción de la Jornada Laboral a 46 Horas y Registro Electrónico Obligatorio en México (2027)',
  description:
    'Guía informativa sobre los decretos publicados en el Diario Oficial de la Federación (3 de marzo y 1 de mayo de 2026) y sus efectos a partir del 1 de enero de 2027 en México.',
  inLanguage: 'es-MX',
  datePublished: '2026-11-19',
  dateModified: '2026-11-19',
  author: {
    '@type': 'Organization',
    name: 'IQISSMexico',
    url: 'https://iqissmexico.com',
  },
  publisher: {
    '@type': 'Organization',
    name: 'IQISSMexico',
    url: 'https://iqissmexico.com',
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': 'https://iqissmexico.com/guia-jornada-2027',
  },
};

export default function GuiaJornada2027Layout({
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
