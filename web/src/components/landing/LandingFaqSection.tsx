'use client';

import React from 'react';
import { ChevronDownIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

interface LandingFaqSectionProps {
  theme?: 'blue' | 'teal';
  sector?: 'general' | 'health';
  id?: string;
}

export default function LandingFaqSection({
  theme = 'blue',
  sector = 'general',
  id = 'preguntas-frecuentes',
}: LandingFaqSectionProps) {
  const isTeal = theme === 'teal';

  const themeClasses = {
    badgeText: isTeal ? 'text-teal-600' : 'text-blue-600',
    iconColor: isTeal ? 'text-teal-600' : 'text-blue-600',
    highlightBorder: isTeal ? 'focus:ring-teal-500' : 'focus:ring-blue-500',
  };

  const faqsGeneral = [
    {
      q: '¿Cómo funciona el asistente de Inteligencia Artificial y qué costo tiene?',
      a: 'Tu asistente de IA atiende a tus prospectos 24/7 de forma inmediata, respondiendo dudas frecuentes y calificando oportunidades. Para brindarte máxima transparencia y el costo más bajo del mercado, la IA opera con conexión directa a tu cuenta de proveedor (como OpenRouter), pagando únicamente centavos de dólar por lo que realmente consumes, sin recargos ocultos ni intermediarios.',
    },
    {
      q: '¿Puedo conectar el número de WhatsApp que ya utiliza mi negocio?',
      a: 'Sí. Conectamos tu número a través de la API Oficial de WhatsApp Business. Esto permite que todo tu equipo atienda desde una sola línea verificada, desde múltiples computadoras o celulares, evitando riesgos de baneo y resguardando el historial comercial de tu empresa.',
    },
    {
      q: '¿Cómo ayuda el embudo visual (Pipeline) a cerrar más ventas?',
      a: 'Cada conversación entrante se organiza visualmente en columnas según su etapa comercial (Nuevo, Cotizado, En seguimiento, Ganado). Así tu equipo sabe exactamente a qué cliente contactar hoy, qué cotizaciones están pendientes y qué oportunidades requieren atención urgente.',
    },
    {
      q: '¿Qué sucede si un prospecto deja de responder después de varios días?',
      a: 'WhatsApp establece una ventana de atención de 24 horas por privacidad. Con IQISS CRM no necesitas entrar al complejo administrador de Meta: puedes crear y gestionar plantillas oficiales directamente en tu panel para enviar mensajes de seguimiento o cotizaciones aprobadas de WhatsApp con un solo clic, reactivando la conversación de forma 100% segura.',
    },
    {
      q: '¿Mis datos y los de mis clientes están seguros?',
      a: 'Totalmente. Toda la información viaja cifrada bajo estándares bancarios y se almacena en servidores seguros con controles estrictos de acceso. Tu base de clientes y conversaciones son propiedad exclusiva de tu empresa.',
    },
    {
      q: '¿Cómo se realizan los pagos y puedo cancelar cuando lo desee?',
      a: 'Las membresías se cobran de forma mensual recurrente y 100% segura a través de Mercado Pago. No existen contratos forzosos ni plazos mínimos; tienes la libertad de cambiar de plan o cancelar tu suscripción en cualquier momento desde tu panel.',
    },
  ];

  const faqsHealth = [
    {
      q: '¿Cómo funciona la agenda de citas médicas por WhatsApp?',
      a: 'El paciente escribe a cualquier hora del día o noche y el asistente virtual le presenta los horarios disponibles en tiempo real. Al confirmar la cita, queda agendada al instante en el calendario de tu consultorio y el paciente recibe su confirmación oficial. Además, actualmente estamos desarrollando el módulo de recordatorios automáticos programados (24h y 2h antes) que se sumará próximamente sin costo adicional a tu suscripción.',
    },
    {
      q: '¿Cómo opera el asistente de IA en un consultorio o clínica?',
      a: 'La IA realiza un triaje preliminar recopilando el motivo de consulta y síntomas básicos, y contesta dudas recurrentes sobre ubicación, servicios y formas de pago. Funciona con conexión directa a motores de IA a costo real de proveedor (centavos de dólar), garantizando respuestas rápidas y confiables sin sobrecostos mensuales.',
    },
    {
      q: '¿La información médica y de pacientes cuenta con resguardo seguro?',
      a: 'Sí. La plataforma está construida con controles y protocolos de seguridad orientados al manejo responsable de información sensible, incorporando cifrado de datos en reposo y tránsito, alineado a las mejores prácticas de privacidad clínica y directrices de la NOM-024-SSA3.',
    },
    {
      q: '¿Mi secretaria o equipo de recepción puede intervenir en las conversaciones?',
      a: 'Por supuesto. La bandeja de entrada es multi-agente: tanto el médico como las recepcionistas pueden ver los chats en tiempo real, tomar el control cuando se requiera atención humana personalizada y dejar notas internas privadas que solo el equipo médico puede leer.',
    },
    {
      q: '¿Hay contratos forzosos o penalizaciones por cancelación?',
      a: 'No. El servicio se renueva mensualmente sin plazos forzosos a través de Mercado Pago. Puedes ajustar tu plan o cancelar tu membresía cuando lo consideres necesario directamente desde el portal.',
    },
  ];

  const faqs = sector === 'health' ? faqsHealth : faqsGeneral;

  return (
    <section id={id} className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-100">
      <div className="max-w-4xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 justify-center mb-2">
            <QuestionMarkCircleIcon className={`h-4 w-4 ${themeClasses.iconColor}`} />
            <span className={`text-xs font-bold uppercase tracking-wider ${themeClasses.badgeText}`}>
              Preguntas Frecuentes
            </span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Todo lo que necesitas saber
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Respuestas claras y transparentes sobre el funcionamiento, la tecnología y las membresías.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-gray-200 bg-gray-50/50 p-5 transition-all open:bg-white open:shadow-sm open:border-gray-300"
            >
              <summary className="flex cursor-pointer items-center justify-between font-bold text-gray-900 text-base list-none focus:outline-none">
                <span className="pr-4">{faq.q}</span>
                <span className="shrink-0 transition-transform duration-200 group-open:rotate-180 text-gray-400 group-open:text-gray-700">
                  <ChevronDownIcon className="h-5 w-5" />
                </span>
              </summary>
              <div className="mt-3.5 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3.5">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
