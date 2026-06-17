'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Hero from '@/components/Hero';
import Section from '@/components/Section';
import ActionButton from '@/components/ActionButton';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { 
  ClockIcon, 
  ChatBubbleBottomCenterTextIcon, 
  ClipboardDocumentCheckIcon, 
  ShieldCheckIcon,
  PhoneIcon,
  IdentificationIcon
} from '@heroicons/react/24/outline';


export default function ConsultoriosClient() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [waitTime, setWaitTime] = useState(15);
  const phoneNumber = '5213141560219';

  // Modo Oscuro Adaptativo (8 PM a 8 AM)
  useEffect(() => {
    const checkTime = () => {
      const hour = new Date().getHours();
      setIsDarkMode(hour >= 20 || hour < 8);
    };
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Simulación de widget de tiempo de espera
  useEffect(() => {
    const hours = new Date().getHours();
    let time = 15;
    if (hours >= 10 && hours <= 14) time = 45; // Hora pico mañana
    if (hours >= 16 && hours <= 19) time = 30; // Hora pico tarde
    setWaitTime(time);
  }, []);

  const themeClasses = isDarkMode 
    ? 'bg-slate-900 text-slate-100' 
    : 'bg-white text-slate-900';

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-1000 ${themeClasses}`}>
      {/* Widget de Tiempo de Espera Real - Arquitectura 2026 */}
      <div className="fixed top-20 right-4 z-50 animate-bounce group">
        <div className={`p-4 rounded-2xl shadow-2xl backdrop-blur-md border border-teal-200 flex items-center gap-3 ${isDarkMode ? 'bg-teal-900/80' : 'bg-white/80'}`}>
          <div className="relative">
            <ClockIcon className="w-8 h-8 text-teal-500" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
            </span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-500">Espera en clínica</p>
            <p className="text-xl font-black">{waitTime} min</p>
          </div>
        </div>
      </div>

      <Hero
        title="Tu clínica nunca duerme. Tu agenda tampoco."
        subtitle="Automatiza el agendado y la digitalización de expedientes 24/7. No pierdas más pacientes por falta de respuesta nocturna y elimina el papeleo en tu sala de espera."
        ctaText="Modernizar mi Consultorio Ahora"
        ctaLink="#diagnostico"
        backgroundImage="/medical-hero.png"
        backgroundColorClass={isDarkMode ? 'bg-slate-950/80' : 'bg-teal-900/70'}
        ctaButtonClass="bg-teal-500 hover:bg-teal-600 shadow-[0_0_20px_rgba(20,184,166,0.5)] transition-all hover:scale-105"
      />

      {/* El Problema: El Costo del Silencio */}
      <Section
        title="¿Cuántos pacientes pierdes mientras duermes?"
        className={isDarkMode ? 'bg-slate-900' : 'bg-white'}
        titleClassName={isDarkMode ? 'text-teal-400' : 'text-teal-900'}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h3 className={`text-4xl font-extrabold leading-tight ${isDarkMode ? 'text-white' : 'text-teal-800'}`}>
              El 70% de las búsquedas médicas ocurren de noche.
            </h3>
            <p className={`text-lg leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Cuando un paciente siente malestar a las 11 PM y no recibe respuesta, busca a otro especialista. Nuestra IA actúa como tu conserje médico personal, atendiendo, triagiando y agendando citas mientras tú descansas o estás en quirófano.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-6 rounded-2xl border ${isDarkMode ? 'border-red-900/30 bg-red-950/10' : 'border-red-100 bg-red-50'}`}>
                <p className="text-red-500 font-bold mb-2">Clínica Sin Automatizar</p>
                <div className="flex items-center gap-2 text-slate-500">
                  <PhoneIcon className="w-5 h-5" />
                  <span>Paciente perdido</span>
                </div>
              </div>
              <div className={`p-6 rounded-2xl border ${isDarkMode ? 'border-teal-900/30 bg-teal-950/20' : 'border-teal-100 bg-teal-50'}`}>
                <p className="text-teal-500 font-bold mb-2">Tu Clínica con IA</p>
                <div className="flex items-center gap-2 text-teal-600">
                  <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                  <span>Paciente agendado</span>
                </div>
              </div>
            </div>
          </div>
          <div className="relative group overflow-hidden rounded-3xl shadow-2xl">
            <Image
              src="/medical-history.png"
              alt="Optimización de consultorio mediante IA"
              width={800}
              height={600}
              className="transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-linear-to-t from-teal-900/60 to-transparent"></div>
          </div>
        </div>
      </Section>

      {/* Beneficios para el Doctor */}
      <Section
        title="Un Asistente de Alto Nivel para tu Práctica"
        className={isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}
        titleClassName={isDarkMode ? 'text-teal-400' : 'text-teal-900'}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className={`p-8 rounded-3xl transition-all hover:-translate-y-2 ${isDarkMode ? 'bg-slate-900/50' : 'bg-white shadow-xl'}`}>
            <WhatsAppIcon className="w-12 h-12 text-teal-500 mb-6" />
            <h4 className="text-xl font-bold mb-3">Agendado Inteligente</h4>
            <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Sincronización en tiempo real con tu agenda. Evita traslapes y maneja cancelaciones automáticamente.</p>
          </div>
          <div className={`p-8 rounded-3xl transition-all hover:-translate-y-2 ${isDarkMode ? 'bg-slate-900/50' : 'bg-white shadow-xl'}`}>
            <IdentificationIcon className="w-12 h-12 text-teal-500 mb-6" />
            <h4 className="text-xl font-bold mb-3">Triaje Conversacional</h4>
            <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>La IA identifica síntomas críticos y califica la urgencia antes de confirmar el espacio.</p>
          </div>
          <div className={`p-8 rounded-3xl transition-all hover:-translate-y-2 ${isDarkMode ? 'bg-slate-900/50' : 'bg-white shadow-xl'}`}>
            <ShieldCheckIcon className="w-12 h-12 text-teal-500 mb-6" />
            <h4 className="text-xl font-bold mb-3">Dudas Frecuentes</h4>
            <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Libera a tu secretaria de responder precios, seguros y ubicación 100 veces al día.</p>
          </div>
        </div>
      </Section>

      {/* La Consulta del Futuro: Eficiencia Operativa */}
      <Section
        title="Llega Directo al Diagnóstico"
        className={isDarkMode ? 'bg-slate-900' : 'bg-white'}
        titleClassName={isDarkMode ? 'text-teal-400' : 'text-teal-900'}
      >
        <div className="max-w-5xl mx-auto space-y-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <div className={`p-1 rounded-3xl bg-linear-to-br from-teal-400 to-blue-600 ${isDarkMode ? 'opacity-80' : ''}`}>
                <div className={`rounded-[22px] p-6 ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
                  <ClipboardDocumentCheckIcon className="w-10 h-10 text-teal-500 mb-4" />
                  <h4 className="text-2xl font-bold mb-4">Expediente Digital Previo</h4>
                  <ul className={`space-y-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-500 font-bold">✓</span>
                      Historial capturado por la IA antes de la cita.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-500 font-bold">✓</span>
                      Resumen ejecutivo de síntomas para el doctor.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-500 font-bold">✓</span>
                      Consentimientos firmados digitalmente.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h3 className="text-3xl font-black mb-6">Optimiza el flujo de tu sala de espera.</h3>
              <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                Reduce el tiempo administrativo en un 40%. Tus pacientes ya no llegan a llenar formularios; llegan listos para ser atendidos. Tú recibes un resumen con alertas de alergias o síntomas clave antes de que el paciente cruce tu puerta.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ROI & Confianza */}
      <Section
        id="confianza"
        className={isDarkMode ? 'bg-slate-950' : 'bg-teal-50'}
      >
        <div className="text-center mb-12">
          <h2 className={`text-4xl font-black mb-4 ${isDarkMode ? 'text-white' : 'text-teal-900'}`}>Seguridad y Privacidad</h2>
          <p className={`max-w-2xl mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Priorizamos la confidencialidad de la información médica siguiendo los estándares internacionales y nacionales más rigurosos.
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-teal-100 shadow-xl'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <h4 className="text-xl font-bold">Resguardo de Información</h4>
                <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Nuestra arquitectura está alineada con los estándares de seguridad <strong>HIPAA</strong> para el manejo de datos de salud y contempla los lineamientos de la norma mexicana <strong>NOM-024-SSA3-2012</strong> para el intercambio de información en expedientes clínicos electrónicos.
                </p>
              </div>
              <div className="flex justify-center gap-12 text-slate-500 opacity-70">
                <div className="flex flex-col items-center">
                  <ShieldCheckIcon className="w-16 h-16 mb-2 text-teal-500" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">Estándar HIPAA</span>
                </div>
                <div className="flex flex-col items-center">
                  <ClipboardDocumentCheckIcon className="w-16 h-16 mb-2 text-teal-500" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">NOM-024-SSA3</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* FAQ para Doctores */}
      <Section
        title="Dudas Frecuentes para Profesionales"
        className={themeClasses}
        titleClassName={isDarkMode ? 'text-teal-400' : 'text-teal-900'}
      >
        <div className="max-w-3xl mx-auto space-y-4">
          <details className={`p-6 rounded-2xl border transition-all ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
            <summary className="font-bold cursor-pointer list-none flex justify-between items-center">
              ¿Se integra con mi agenda actual (Google/Outlook/EHR)?
              <span className="text-teal-500">+</span>
            </summary>
            <p className={`mt-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Sí, nuestra API se sincroniza con los calendarios más populares y sistemas de expediente clínico electrónico (EHR) vía webhooks o integración directa.
            </p>
          </details>
          <details className={`p-6 rounded-2xl border transition-all ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
            <summary className="font-bold cursor-pointer list-none flex justify-between items-center">
              ¿Qué pasa si mi consultorio tiene necesidades muy específicas?
              <span className="text-teal-500">+</span>
            </summary>
            <p className={`mt-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Personalizamos el flujo de la IA según tu especialidad: desde preguntas de triaje para pediatría hasta preparación pre-operatoria en cirugía estética.
            </p>
          </details>
        </div>
      </Section>

      {/* CTA Final B2B */}
      <Section id="diagnostico" className="pb-24">
        <div className={`relative overflow-hidden rounded-[40px] px-8 py-20 text-center shadow-3xl ${isDarkMode ? 'bg-teal-950' : 'bg-teal-900'}`}>
          <div className="absolute inset-0 bg-linear-to-br from-teal-500/20 to-transparent"></div>
          <div className="relative z-10">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-8">
              No dejes que tu consultorio <br /> <span className="text-teal-400">se quede en el pasado.</span>
            </h2>
            <ActionButton
              text="Solicitar Demo y Análisis de ROI"
              url={`https://wa.me/${phoneNumber}?text=Hola,%20soy%20médico%20y%20quiero%20automatizar%20mi%20consultorio`}
              className="bg-teal-400 text-teal-950 hover:bg-teal-300 font-black text-2xl px-12 py-6 rounded-full transform transition hover:scale-110 shadow-2xl"
              icon={<WhatsAppIcon size={32} />}
            />
            <p className="mt-8 text-teal-200/60 text-sm">Sesión estratégica de 15 min solo para profesionales de la salud.</p>
          </div>
        </div>
      </Section>

      {/* Footer Minimalista 2026 */}
      <footer className={`py-12 border-t px-8 ${isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-teal-100 bg-teal-50'}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center text-white font-black">IQ</div>
            <span className="font-bold tracking-tight">Clínica Inteligente 2026</span>
          </div>
          <div className="text-xs text-slate-500">
            © 2026 IQISSMexico. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
