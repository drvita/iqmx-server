import { Metadata } from 'next';
import ConsultoriosClient from './ConsultoriosClient';

export const metadata: Metadata = {
  title: 'Automatización de Consultorios Médicos con IA | Agenda 24/7 y Triaje',
  description: 'Moderniza tu práctica médica con IA. Automatiza agendado 24/7, realiza triaje de pacientes y digitaliza expedientes antes de la consulta. Cumple con NOM-024 y HIPAA.',
  openGraph: {
    title: 'Automatización de Consultorios Médicos con IA | Agenda 24/7 y Triaje',
    description: 'Moderniza tu práctica médica con IA. Automatiza agendado 24/7, realiza triaje de pacientes y digitaliza expedientes.',
    images: ['/medical-hero.png'],
  },
};

export default function ConsultoriosPage() {
  return <ConsultoriosClient />;
}
