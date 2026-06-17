import ActionButton from '@/components/ActionButton';
import Hero from '@/components/Hero';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import Section from '@/components/Section';
import Image from 'next/image';

export default function Home() {
  const subtitlesColor = 'text-blue-600';
  const number = '5213141560219';

  return (
    <div className="flex flex-col min-h-screen">
      <Hero
        title="Impulsa tu negocio con tecnología hecha a tu medida"
        subtitle="Creamos automatizaciones, sistemas y herramientas con IA para que tu empresa trabaje más fácil y venda más."
        ctaText="Contáctanos"
        ctaLink="/#contact"
      />

      <Section title="¿Qué hacemos por tu negocio?" className="bg-gray-50">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <p className="text-gray-700 text-lg">
            En IQISSMexico ayudamos a pequeñas y medianas empresas a adoptar
            tecnología sin complicaciones. Desde automatizaciones hasta sistemas
            completos, hacemos que tu negocio trabaje mejor, más rápido y con
            procesos inteligentes.
          </p>
          <p className="text-gray-700 text-lg">
            Nuestro enfoque es simple: soluciones accesibles, hechas a tu medida
            y diseñadas para generar resultados reales.
          </p>
        </div>
      </Section>

      <Section title="Especializados por Sector" className="bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="group relative overflow-hidden rounded-3xl border border-gray-100 shadow-lg transition-all hover:shadow-2xl">
            <div className="aspect-video relative overflow-hidden">
               <Image 
                src="/wa-solution.png" 
                alt="Automatización de WhatsApp" 
                fill 
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-linear-to-t from-green-900/80 to-transparent flex flex-col justify-end p-6">
                <span className="bg-green-500 text-white text-[10px] font-bold uppercase py-1 px-3 rounded-full w-fit mb-2">Producto Estrella</span>
                <h3 className="text-white text-2xl font-bold">Automatización de WhatsApp</h3>
                <p className="text-green-50 text-sm mt-2">Atención 24/7 y cierre de ventas automático para tu negocio.</p>
              </div>
            </div>
            <div className="p-6 bg-white">
              <ActionButton 
                text="Ver Solución WhatsApp" 
                url="/landingpage/whatsapp" 
                className="w-full justify-center bg-green-600 hover:bg-green-700 text-white" 
              />
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-3xl border border-gray-100 shadow-lg transition-all hover:shadow-2xl">
            <div className="aspect-video relative overflow-hidden">
               <Image 
                src="/medical-hero.png" 
                alt="Clínica Inteligente" 
                fill 
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-linear-to-t from-teal-900/80 to-transparent flex flex-col justify-end p-6">
                <span className="bg-teal-400 text-teal-950 text-[10px] font-bold uppercase py-1 px-3 rounded-full w-fit mb-2">Sector Salud</span>
                <h3 className="text-white text-2xl font-bold">Clínica Inteligente 24/7</h3>
                <p className="text-teal-50 text-sm mt-2">Optimiza tu consultorio y agenda pacientes mientras descansas.</p>
              </div>
            </div>
            <div className="p-6 bg-white">
              <ActionButton 
                text="Ver Solución Médica" 
                url="/landingpage/consultorios" 
                className="w-full justify-center bg-teal-600 hover:bg-teal-700 text-white" 
              />
            </div>
          </div>
        </div>
      </Section>

      <Section id="contact" title="Contáctanos" className="bg-gray-50">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-lg text-gray-700 mb-6">
            ¿Tienes una idea o necesitas una solución para tu negocio? Estamos
            listos para ayudarte a llevar tu proyecto al siguiente nivel.
          </p>

          <ActionButton
            id="home_btn_contact"
            text="Enviar Mensaje"
            icon={<WhatsAppIcon />}
            url={`https://wa.me/${number}?text=Quiero%20una%20cita%20para%20mi%20negocio`}
            className="inline-flex items-center justify-center border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          />

          <p className="text-sm text-gray-500 mt-4">
            Respuesta en menos de 24 horas hábiles.
          </p>
        </div>
      </Section>
    </div>
  );
}
