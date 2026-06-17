import Hero from '@/components/Hero';
import Section from '@/components/Section';
import InfoCard from '@/components/InfoCard';
import ActionButton from '@/components/ActionButton';
import HighlightBanner from '@/components/HighlightBanner';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import Image from 'next/image';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title:
    'Asistente para WhatsApp 24/7 | Recupera tu Tiempo y Aumenta Ventas – IQISSMexico',
  description:
    'Delega tus mensajes de WhatsApp. Más ventas, menos estrés, más tiempo para ti. Tu asistente virtual que trabaja mientras tú descansas.',
  keywords: [
    'automatización de WhatsApp',
    'WhatsApp Business',
    'asistente para WhatsApp',
    'respuestas automáticas',
    'atención 24/7',
    'pequeños negocios',
    'emprendedoras',
    'agendado de citas',
    'balance vida-trabajo',
    'reducir estrés',
    'delegación de tareas',
    'asistente virtual WhatsApp',
  ],
  authors: [{ name: 'IQISSMexico' }],
  creator: 'IQISSMexico',
  publisher: 'IQISSMexico',
  robots: 'index, follow',
  metadataBase: new URL('https://www.iqissmexico.com'), // cámbialo cuando tengas dominio
  openGraph: {
    title:
      'Asistente para WhatsApp 24/7 | Recupera tu Tiempo y Aumenta Ventas – IQISSMexico',
    description:
      'Deja de estar pegada al celular. Tu asistente atiende 24/7 mientras tú recuperas tu tiempo y aumentas ventas.',
    url: 'https://www.iqissmexico.com',
    siteName: 'IQISSMexico',
    locale: 'es_MX',
    type: 'website',
  },
};

export default function WhatsappLandingPage() {
  const titlesColor = 'text-green-900';
  const subtitlesColor = 'text-green-700';
  const number = '5213141560219';

  return (
    <div className="flex flex-col min-h-screen">
      <Hero
        title="Recupera tu tiempo y deja de perder ventas"
        subtitle="Delega tus mensajes de WhatsApp a una asistente 24/7. Más ventas, menos estrés, más vida personal."
        ctaText="Empieza Ahora"
        ctaLink="#incentivos"
        backgroundColorClass="bg-green-900"
        ctaButtonClass="bg-green-500 hover:bg-green-600"
      />
      {/** Establecimiento del problema principal */}
      <Section
        title="Tú no necesitas otra herramienta. Necesitas delegar."
        className="bg-white"
        titleClassName={titlesColor}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h3 className={`text-2xl font-bold mb-4 ${titlesColor}`}>
              Cuando delegas, no pierdes ventas ni sacrificas tu tiempo personal
            </h3>
            <p className="text-gray-600 mb-4">
              Sabemos lo que se siente: mensajes que llegan a todas horas, clientes que esperan respuesta inmediata, y tú atrapada entre atender el negocio y tener tiempo para ti. El resultado: ventas perdidas, agotamiento constante, y cero tiempo para tu familia. Una asistente que responde por ti no es solo tecnología — es alguien en quien delegas, para que puedas respirar y vivir.
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>Atención inmediata para cada cliente <strong>sin que tú estés al celular</strong></li>
              <li>Disponibilidad 24/7 <strong>mientras tú descansas</strong></li>
              <li><strong>Recupera horas de tu día</strong> para lo que realmente importa</li>
            </ul>
          </div>
          <div className="rounded-xl overflow-hidden">
            <Image
              src="/wa-solution.png"
              alt="Asistente de WhatsApp automatizado respondiendo mensajes"
              width={800}
              height={600}
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      </Section>
      {/** Beneficios y caracteristicas */}
      <Section
        title="¿Qué ganas al delegar tus mensajes de WhatsApp?"
        className="bg-gray-50"
        titleClassName={titlesColor}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <InfoCard
            title="Más ventas, sin estar pegada al celular"
            description="Tu asistente atiende al instante. Tus clientes no se van con la competencia, y tú no tienes que estar disponible 24/7."
            titleClassName={`text-xl font-semibold mb-2 ${subtitlesColor}`}
          />

          <InfoCard
            title="Recupera tu tiempo y energía"
            description="Deja de contestar lo mismo una y otra vez. Tu asistente maneja las preguntas frecuentes mientras tú te enfocas en crecer o simplemente descansar."
            titleClassName={`text-xl font-semibold mb-2 ${subtitlesColor}`}
          />

          <InfoCard
            title="Tiempo real para ti y tu familia"
            description="Desconéctate con tranquilidad. Tu negocio sigue atendido aunque estés en la cena familiar, con tus hijos, o tomándote un respiro."
            titleClassName={`text-xl font-semibold mb-2 ${subtitlesColor}`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          <InfoCard
            title="Respuestas Automáticas"
            description="Tu asistente atiende al instante y da información clara sin que tengas que estar al celular."
            titleClassName={`text-xl font-semibold mb-2 ${subtitlesColor}`}
          />

          <InfoCard
            title="Información Siempre Disponible"
            description="Comparte horarios, precios, servicios, catálogos o detalles de tus productos las 24 horas."
            titleClassName={`text-xl font-semibold mb-2 ${subtitlesColor}`}
          />

          <InfoCard
            title="Agendado de Citas o Pedidos"
            description="Si lo necesitas, tu asistente puede tomar citas o guiar al cliente paso a paso."
            titleClassName={`text-xl font-semibold mb-2 ${subtitlesColor}`}
          />
        </div>
      </Section>
      {/** Incentivos */}
      <Section
        id="incentivos"
        title="⚠️ ¿Cansada de estar siempre disponible sin ver resultados?"
        className="bg-linear-to-br from-green-600 to-green-800"
        titleClassName="text-white"
      >
        <div className="max-w-3xl mx-auto text-center">
          <h3 className="text-3xl font-bold text-white mb-6">
            Obtén un Diagnóstico de Automatización GRATUITO y descubre cómo delegar
          </h3>

          <p className="text-blue-50 text-lg mb-6">
            En una sesión rápida por WhatsApp, analizamos tu negocio y te mostramos exactamente:
          </p>

          <ul className="text-left text-blue-50 space-y-4 mb-8 max-w-2xl mx-auto">
            <li className="flex items-start">
              <svg
                className="w-6 h-6 text-yellow-300 mr-3 mt-1 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                ></path>
              </svg>
              <span>
                <strong className="text-white">Cuántas horas estás perdiendo</strong> al no delegar tus mensajes.
              </span>
            </li>
            <li className="flex items-start">
              <svg
                className="w-6 h-6 text-yellow-300 mr-3 mt-1 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                ></path>
              </svg>
              <span>
                <strong className="text-white">Qué tareas</strong> (citas, pedidos, dudas) tu asistente puede manejar por ti.
              </span>
            </li>
            <li className="flex items-start">
              <svg
                className="w-6 h-6 text-yellow-300 mr-3 mt-1 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                ></path>
              </svg>
              <span>
                <strong className="text-white">El plan más simple</strong> para que empieces a recuperar tu tiempo esta semana.
              </span>
            </li>
          </ul>

          <p className="text-blue-100 text-lg mb-8 italic">
            Es una consultoría sin costo y sin compromiso. ¡Solo ganancias para tu negocio!
          </p>

          <ActionButton
            text="Quiero Mi Diagnóstico Gratuito por WhatsApp"
            id="wa_btn_diagnostico"
            icon={<WhatsAppIcon />}
            url={`https://wa.me/${number}?text=Hola,%20quiero%20mi%20diagnóstico%20gratuito%20de%20automatización`}
            className="bg-yellow-400 text-blue-900 hover:bg-yellow-300 font-bold text-lg px-8 py-4"
          />
        </div>
      </Section>
      {/* credibilidad */}
      <Section className="bg-white" titleClassName={titlesColor}>
        <div className="space-y-8">
          {/* Banner de Validación Técnica */}
          <HighlightBanner variant="green">
            <div className="flex items-center justify-center gap-4 mb-4">
              <svg
                className="w-12 h-12 text-green-600"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <h3 className="text-2xl font-bold text-green-800">
                Conexión Oficial y Segura
              </h3>
            </div>
            <p className="text-center text-gray-700 text-lg mb-4">
              Utilizamos la{' '}
              <strong className="text-green-700">
                API Oficial de WhatsApp Business
              </strong>{' '}
              para garantizar:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              <div className="flex items-center gap-2 bg-white p-3 rounded-lg shadow-sm">
                <svg
                  className="w-6 h-6 text-green-600 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  ></path>
                </svg>
                <span className="text-gray-700 font-semibold">
                  100% Seguro
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white p-3 rounded-lg shadow-sm">
                <svg
                  className="w-6 h-6 text-green-600 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  ></path>
                </svg>
                <span className="text-gray-700 font-semibold">
                  Siempre Estable
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white p-3 rounded-lg shadow-sm">
                <svg
                  className="w-6 h-6 text-green-600 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
                <span className="text-gray-700 font-semibold">
                  Cero Bloqueos
                </span>
              </div>
            </div>
          </HighlightBanner>

          {/* Bloque de Anulación de Riesgo */}
          <HighlightBanner variant="yellow" className="p-8 shadow-lg">
            <div className="text-center">
              <div className="inline-block bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-bold text-sm mb-4">
                🛡️ GARANTÍA INCLUIDA
              </div>
              <h3 className="text-3xl font-extrabold text-gray-900 mb-4">
                Nuestra Garantía de Cero Riesgo (30 Días)
              </h3>
              <p className="text-gray-700 text-lg mb-6 leading-relaxed">
                Si después de 30 días <strong>no ves una mejora visible</strong>{' '}
                en la atención al cliente de tu negocio, te devolvemos{' '}
                <strong className="text-orange-600">
                  el 100% de tu inversión
                </strong>
                , sin preguntas.
              </p>
              <div className="bg-white rounded-lg p-6 mb-6 border border-yellow-200">
                <p className="text-gray-600 text-base">
                  Además, si decides cambiar de proveedor, te ayudamos a{' '}
                  <strong>migrar todos tus datos sin costo adicional</strong>.
                  Tu satisfacción es nuestra prioridad.
                </p>
              </div>
              <p className="text-gray-500 italic text-sm">
                Prueba sin riesgo. Si no funciona para ti, recuperas tu dinero.
                Así de simple.
              </p>
            </div>
          </HighlightBanner>
        </div>
      </Section>
      {/** Llamada a la acción final */}
      <Section
        id="cta-final"
        className="bg-white py-16"
      >
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-green-900 px-8 py-16 shadow-2xl sm:px-16 md:py-24 text-center">
            {/* Elementos decorativos de fondo */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-green-800 opacity-50 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-green-500 opacity-20 blur-3xl"></div>

            <div className="relative z-10">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-6">
                ¿Lista para recuperar tu tiempo y aumentar tus ventas?
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-green-100 mb-10">
                No necesitas otra herramienta difícil de usar. Necesitas delegar lo que te quita energía para enfocarte en lo que te hace crecer.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <ActionButton
                  text="Agendar Asesoría Gratuita por WhatsApp"
                  id="wa_btn_final_cta"
                  url={`https://wa.me/${number}?text=Hola,%20quiero%20mejorar%20la%20atención%20de%20mi%20negocio`}
                  className="bg-green-500 text-white hover:bg-green-400 font-bold text-xl px-10 py-5 shadow-lg transform transition hover:scale-105"
                  icon={<WhatsAppIcon />}
                  iconPosition="left"
                />
              </div>
              
              <p className="mt-8 text-sm text-green-200">
                * Sesión gratuita de 15 minutos para analizar tu negocio.
              </p>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
