import Hero from '@/components/Hero';
import Section from '@/components/Section';
import { UserGroupIcon, LightBulbIcon, ClockIcon, MapPinIcon, EnvelopeIcon, PhoneIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';

export const metadata = {
  title: 'Sobre Nosotros - IQISS México',
  description: 'Conoce la historia, misión y equipo detrás de IQISS México. Impulsando el éxito empresarial a través de la tecnología.',
};

export default function AboutUsPage() {
  const historyEvents = [
    {
      year: '2008',
      title: 'El Comienzo',
      description: 'Nacimos en Villa de Álvarez, Colima. Iniciamos ofreciendo desarrollo de software para PyMES en Colima, trabajando inicialmente de forma individual.',
    },
    {
      year: '2015',
      title: 'Alianza Estratégica',
      description: 'Nos asociamos para expandir nuestros horizontes y comenzamos a trabajar en la región occidente de México.',
    },
    {
      year: '2018',
      title: 'Innovación con Chatbots',
      description: 'Incursionamos en el desarrollo de chatbots, anticipándonos a las tendencias de automatización.',
    },
    {
      year: '2022',
      title: 'Crecimiento del Equipo',
      description: 'Crecimos a un equipo de 4 especialistas, enfocándonos en automatizaciones para PyMES y consolidando nuestra experiencia.',
    },
    {
      year: '2024',
      title: 'Expansión Nacional',
      description: 'Iniciamos operaciones en toda la república mexicana, llevando nuestras soluciones tecnológicas a nivel nacional.',
    },
  ];

  const teamMembers = [
    {
      name: 'Salvador González',
      role: 'Director',
      initials: 'SG',
    },
    {
      name: 'Pedro Pérez',
      role: 'Producción',
      initials: 'PP',
    },
    {
      name: 'Diana Verónica',
      role: 'Marketing',
      initials: 'DV',
    },
  ];

  return (
    <main className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <Hero
        title="Nuestra Historia y Visión"
        subtitle="En IQISS México, transformamos ideas en soluciones tecnológicas escalables."
        backgroundImage="/medical-hero.png" // Reusing an existing image as placeholder/background if suitable, or strict consistent styling. Used medical-hero as it's available.
        backgroundColorClass="bg-blue-900"
      />

      {/* Misión y Visión */}
      <Section title="Misión & Visión" className="bg-white dark:bg-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                            <LightBulbIcon className="h-6 w-6" aria-hidden="true" />
                        </div>
                    </div>
                    <div className="ml-4">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Nuestra Misión</h3>
                        <p className="mt-2 text-base text-gray-500 dark:text-gray-300">
                            Impulsar la evolución digital de la industria médica mediante la automatización inteligente y el desarrollo tecnológico, ofreciendo transparencia y acompañamiento constante para que los profesionales de la salud se enfoquen en lo más importante: sus pacientes.
                        </p>
                    </div>
                </div>

                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                            <UserGroupIcon className="h-6 w-6" aria-hidden="true" />
                        </div>
                    </div>
                    <div className="ml-4">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Nuestra Visión</h3>
                        <p className="mt-2 text-base text-gray-500 dark:text-gray-300">
                            Convertirnos en el aliado tecnológico estratégico número uno de la industria médica en México, liderando la adopción de soluciones digitales que definan el futuro de la administración de salud.
                        </p>
                    </div>
                </div>
            </div>
            <div className="rounded-lg bg-gray-100 dark:bg-gray-700 p-8 flex items-center justify-center h-full min-h-[300px]">
                 {/* Abstract visual/placeholder instead of image */}
                 <div className="text-center">
                    <span className="block text-6xl font-bold text-blue-200 dark:text-blue-900 opacity-50">IQISS</span>
                    <span className="block text-2xl font-semibold text-gray-400 mt-2">Tecnología + Estrategia</span>
                 </div>
            </div>
        </div>
      </Section>

      {/* Historia (Timeline) */}
      <Section title="Nuestra Trayectoria" className="bg-gray-50 dark:bg-gray-900">
        <div className="relative border-l border-gray-200 dark:border-gray-700 ml-3 md:ml-6 space-y-12 py-8">
            {historyEvents.map((event, index) => (
                <div key={index} className="mb-10 ml-6 md:ml-10 relative">
                    <span className="flex absolute -left-[35px] md:-left-[51px] justify-center items-center w-8 h-8 md:w-10 md:h-10 bg-blue-100 rounded-full ring-8 ring-white dark:ring-gray-900 dark:bg-blue-900">
                        <ClockIcon className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-300" />
                    </span>
                    <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700 transition hover:shadow-md">
                        <time className="mb-1 text-sm font-normal text-gray-400 uppercase tracking-widest">{event.year}</time>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{event.title}</h3>
                        <p className="mb-4 text-base font-normal text-gray-500 dark:text-gray-400 mt-2">
                            {event.description}
                        </p>
                    </div>
                </div>
            ))}
        </div>
      </Section>

       {/* Valores */}
      <Section title="Nuestros Valores" className="bg-blue-900 text-white">
        <div className="flex flex-col md:flex-row justify-center items-center gap-12 text-center py-12">
            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-xl max-w-md w-full hover:bg-white/20 transition-all duration-300">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-500 mb-6">
                    <CheckBadgeIcon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Honestidad y Transparencia</h3>
                <p className="text-blue-100 text-lg">
                    Son los pilares fundamentales de cada relación que construimos. Creemos en hablar claro, actuar con integridad y mantener procesos abiertos con nuestros clientes.
                </p>
            </div>
        </div>
      </Section>

       {/* Equipo */}
       <Section title="Nuestro Equipo" className="bg-white dark:bg-gray-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {teamMembers.map((member, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-8 text-center border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-300 group">
                        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                            <span className="text-2xl font-bold text-white">{member.initials}</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{member.name}</h3>
                        <p className="text-blue-600 dark:text-blue-400 font-medium mt-1">{member.role}</p>
                    </div>
                ))}
            </div>
       </Section>

      {/* Contacto */}
      <Section title="Contáctanos" className="bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="p-8 md:p-12 bg-blue-600 text-white">
                    <h3 className="text-2xl font-bold mb-6">Información de Contacto</h3>
                    <p className="mb-8 text-blue-100">
                        ¿Listo para transformar tu empresa? Estamos aquí para ayudarte a dar el siguiente paso.
                    </p>
                    <div className="space-y-6">
                        <div className="flex items-center space-x-4">
                            <MapPinIcon className="h-6 w-6 text-blue-300" />
                            <span>Villa de Álvarez, Colima</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <PhoneIcon className="h-6 w-6 text-blue-300" />
                            <span>314 156 0219</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <EnvelopeIcon className="h-6 w-6 text-blue-300" />
                            <span>chava.galindo.82@gmail.com</span>
                        </div>
                    </div>
                </div>
                <div className="p-8 md:p-12 flex items-center justify-center bg-gray-50 dark:bg-gray-700">
                    <div className="text-center">
                         <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">IQISS México</h4>
                         <p className="text-gray-500 dark:text-gray-400">Tu aliado tecnológico</p>
                         <a href="mailto:chava.galindo.82@gmail.com" className="mt-6 inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors shadow-lg hover:shadow-xl">
                            Enviar Mensaje
                         </a>
                    </div>
                </div>
            </div>
        </div>
      </Section>
    </main>
  );
}
