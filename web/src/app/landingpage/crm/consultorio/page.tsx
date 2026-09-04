"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDaysIcon,
  ClockIcon,
  BellAlertIcon,
  CheckIcon,
  CreditCardIcon,
  PhoneXMarkIcon,
  ArrowRightIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { saveCheckoutIntent } from "@/utils/checkoutIntent";

type Plan = {
  id: number;
  product_id: number;
  name: string;
  slug: string;
  description: string | null;
  price_mxn: number;
  billing_interval: string;
  features_payload: any;
};

export default function ConsultorioLandingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${apiUrl}/api/public/products/crm/plans?agenda=true`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPlans(data))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, []);

  const handleSelectPlan = (plan: Plan) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("iqmx_portal_token")
        : null;
    saveCheckoutIntent({
      plan_id: plan.id,
      plan_name: plan.name,
      price_mxn: plan.price_mxn,
      product_slug: "crm",
    });

    if (!token) {
      router.push("/portal/login?redirect=checkout");
    } else {
      router.push("/portal/dashboard?pending_checkout=1");
    }
  };

  const scrollToPlans = () => {
    document.getElementById("planes")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-950 via-teal-900 to-teal-800 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-3.5 py-1 text-xs font-semibold text-teal-200 border border-white/15">
                <CalendarDaysIcon className="h-4 w-4 text-teal-300" />
                <span>Agenda Médica Inteligente por WhatsApp</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.1]">
                Tu consultorio <br className="hidden sm:inline" />
                nunca pierde pacientes
              </h1>

              <p className="text-lg text-teal-100 max-w-xl leading-relaxed">
                Automatiza el <strong>agendamiento de citas 24/7</strong> por
                WhatsApp, reduce el <strong>ausentismo hasta un 80%</strong> con
                recordatorios inteligentes y libera a tu recepcionista de las
                llamadas repetitivas.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={scrollToPlans}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-teal-950 shadow-lg hover:bg-teal-50 transition-all hover:shadow-xl"
                >
                  <span>Ver Planes para Consultorios</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Prueba social */}
              <div className="flex items-center gap-3 pt-4 text-xs text-teal-200/80">
                <div className="flex -space-x-2">
                  <div className="h-7 w-7 rounded-full bg-teal-400/30 border-2 border-teal-800 flex items-center justify-center text-[10px] font-bold text-white">
                    D
                  </div>
                  <div className="h-7 w-7 rounded-full bg-emerald-400/30 border-2 border-teal-800 flex items-center justify-center text-[10px] font-bold text-white">
                    C
                  </div>
                  <div className="h-7 w-7 rounded-full bg-amber-400/30 border-2 border-teal-800 flex items-center justify-center text-[10px] font-bold text-white">
                    P
                  </div>
                </div>
                <span>
                  Dentistas, clínicas y consultorios ya optimizaron su agenda
                </span>
              </div>
            </div>

            {/* Mockup de una agenda */}
            <div className="hidden lg:block">
              <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5 shadow-2xl">
                <div className="text-[11px] font-bold text-teal-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <CalendarDaysIcon className="h-4 w-4" />
                  <span>Agenda del Dr. Morales — Hoy</span>
                </div>
                <div className="space-y-2">
                  {[
                    {
                      time: "09:00",
                      patient: "María López",
                      status: "Confirmada ✓",
                      color: "emerald",
                    },
                    {
                      time: "10:30",
                      patient: "Juan Ramírez",
                      status: "Recordatorio enviado",
                      color: "amber",
                    },
                    {
                      time: "12:00",
                      patient: "Ana Martínez",
                      status: "Agendada por IA",
                      color: "blue",
                    },
                    {
                      time: "16:00",
                      patient: "Disponible",
                      status: "Pacientes pueden agendar",
                      color: "gray",
                    },
                  ].map((slot, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 bg-${slot.color}-500/10 p-2.5 rounded-lg border border-${slot.color}-400/20`}
                    >
                      <span className="text-xs font-bold text-white w-12">
                        {slot.time}
                      </span>
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-white">
                          {slot.patient}
                        </p>
                        <p className="text-[9px] text-teal-200">
                          {slot.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PROBLEMA ─── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
              El problema en tu consultorio
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">
              ¿Cuántos pacientes pierdes cada semana sin saberlo?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-white p-6 border border-gray-200 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 mb-4">
                <ClockIcon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">
                70% busca cita fuera de horario
              </h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                La mayoría de los malestares o decisiones de consultar ocurren
                de noche o en fin de semana. Si nadie responde en tu WhatsApp,{" "}
                <strong>el paciente busca a otro doctor</strong>.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 border border-gray-200 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 mb-4">
                <PhoneXMarkIcon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">
                Recepcionistas saturadas
              </h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Tu personal pasa horas al teléfono respondiendo las mismas
                preguntas:{" "}
                <strong>costos, ubicación, horarios disponibles</strong>. Tiempo
                que debería dedicarse a los pacientes en sala.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 border border-gray-200 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 mb-4">
                <BellAlertIcon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">
                30% de citas se pierden
              </h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Los pacientes olvidan su cita, no la cancelan a tiempo y tú
                terminas con
                <strong> espacios vacíos que nadie más puede tomar</strong>.
                Ingresos perdidos cada semana.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SOLUCIÓN PASO A PASO ─── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">
              Cómo funciona
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">
              Del mensaje de WhatsApp a la cita confirmada en 60 segundos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-800 font-extrabold text-lg shrink-0 shadow-xs">
                1
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  El paciente escribe a tu WhatsApp
                </h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  A cualquier hora: 2 AM, domingo, feriado. El asistente de IA
                  lo recibe de inmediato, le hace preguntas sobre su necesidad y
                  le muestra los horarios disponibles en tiempo real.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-800 font-extrabold text-lg shrink-0 shadow-xs">
                2
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Agenda su cita en la conversación
                </h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  El paciente selecciona fecha, horario y especialista directo
                  en el chat. Sin formularios web, sin apps que descargar,{" "}
                  <strong>sin fricción</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-800 font-extrabold text-lg shrink-0 shadow-xs">
                3
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Recordatorio automático con confirmación
                </h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  24 horas y 2 horas antes de la cita, recibe un mensaje con
                  botones:
                  <strong> «Confirmar» o «Reagendar»</strong>. Si cancela, el
                  espacio se libera automáticamente.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-800 font-extrabold text-lg shrink-0 shadow-xs">
                4
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Triaje previo y notas para el doctor
                </h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  Antes de la consulta, la IA recopila motivo de visita,
                  alergias y síntomas. El doctor{" "}
                  <strong>llega preparado</strong> y ahorra hasta 10 minutos por
                  paciente.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <button
              onClick={scrollToPlans}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-teal-700 transition-colors"
            >
              <span>Activar Agenda Inteligente en Mi Consultorio</span>
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── EXTRA: EQUIPO Y SEGURIDAD ─── */}
      <section className="py-16 bg-teal-50 border-y border-teal-100 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-2xl bg-white p-8 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700">
                <UserGroupIcon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">
                Bandeja compartida para tu equipo
              </h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Tanto el doctor como las secretarias pueden ver las
              conversaciones, escribir notas internas privadas y tomar el
              control del chat cuando sea necesario.{" "}
              <strong>Todo desde una sola línea</strong>, sin compartir el
              celular personal de nadie.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-8 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700">
                <ShieldCheckIcon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">
                Datos de pacientes protegidos
              </h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Diseñado contemplando las mejores prácticas de resguardo de
              información clínica (<strong>NOM-024-SSA3</strong> y estándares{" "}
              <strong>HIPAA</strong>). Las conversaciones y datos de tus
              pacientes permanecen cifrados y seguros en todo momento.
            </p>
          </div>
        </div>
      </section>

      {/* ─── CTA PUENTE: CRM GENERAL ─── */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-gray-500 uppercase tracking-wider font-bold">
            ¿No eres del sector salud?
          </p>
          <h3 className="mt-1 text-xl font-bold text-gray-900">
            También funciona para cualquier negocio que vende por WhatsApp
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Pipeline de ventas, bandeja multi-agente, IA 24/7 y más. Conoce la
            versión general del CRM.
          </p>
          <Link
            href="/landingpage/crm"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs"
          >
            <span>Ver CRM para Negocios en General</span>
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* ─── PLANES Y CHECKOUT ─── */}
      <section
        id="planes"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 border-t border-gray-200"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">
              Membresías
            </span>
            <h2 className="mt-2 text-3xl font-extrabold text-gray-900">
              Elige tu plan y activa tu agenda inteligente
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Pagos recurrentes mensuales seguros con Mercado Pago. Cancela
              cuando quieras.
            </p>
          </div>

          {loadingPlans ? (
            <div className="p-16 text-center text-gray-400">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              <p className="mt-3 text-xs">Cargando membresías…</p>
            </div>
          ) : plans.length > 0 ? (
            <div
              className={`grid gap-8 max-w-4xl mx-auto ${plans.length === 1 ? "grid-cols-1 max-w-md" : plans.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"}`}
            >
              {plans.map((p, idx) => {
                const isPopular = idx === plans.length - 1;
                const hasAgenda = p.features_payload?.agenda_enabled;
                return (
                  <div
                    key={p.id}
                    className={`rounded-3xl bg-white p-8 flex flex-col justify-between shadow-sm transition-all hover:shadow-lg relative ${
                      isPopular
                        ? "border-2 border-teal-600 ring-2 ring-teal-100"
                        : "border border-gray-200"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-3 py-1 text-[10px] font-bold text-white uppercase shadow-sm">
                          <StarIcon className="h-3 w-3" /> Recomendado para
                          Consultorios
                        </span>
                      </div>
                    )}

                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {p.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {p.description}
                      </p>

                      <div className="mt-6 flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-gray-900">
                          ${p.price_mxn.toFixed(0)}
                        </span>
                        <span className="text-sm text-gray-500 font-medium">
                          MXN / mes
                        </span>
                      </div>

                      <ul className="mt-6 space-y-3 border-t border-gray-100 pt-6">
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-teal-600 shrink-0" />
                          <span>
                            Hasta{" "}
                            <strong>
                              {p.features_payload?.max_whatsapp_accounts ?? 1}
                            </strong>{" "}
                            {(p.features_payload?.max_whatsapp_accounts ?? 1) === 1
                              ? "línea"
                              : "líneas"}{" "}
                            de WhatsApp
                          </span>
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-teal-600 shrink-0" />
                          <span>
                            {p.features_payload?.max_team_members === null ? (
                              <strong>Miembros de equipo sin límite</strong>
                            ) : (
                              <>
                                Hasta{" "}
                                <strong>
                                  {p.features_payload?.max_team_members ?? 5}
                                </strong>{" "}
                                miembros del equipo
                              </>
                            )}
                          </span>
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-teal-600 shrink-0" />
                          <span>
                            {p.features_payload?.max_contacts === null ? (
                              <strong>Pacientes / contactos sin límite</strong>
                            ) : (
                              <>
                                Hasta{" "}
                                <strong>
                                  {(
                                    p.features_payload?.max_contacts ?? 500
                                  ).toLocaleString()}
                                </strong>{" "}
                                pacientes registrados
                              </>
                            )}
                          </span>
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-teal-600 shrink-0" />
                          <span>Asistente de IA 24/7</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="font-semibold text-emerald-700">
                            Agenda de citas y recordatorios incluida
                          </span>
                        </li>
                        {p.features_payload?.lab_enabled && (
                          <li className="flex items-center gap-2 text-sm text-gray-700">
                            <CheckIcon className="h-4 w-4 text-purple-600 shrink-0" />
                            <span className="font-semibold text-purple-700">
                              Laboratorio de evaluación IA
                            </span>
                          </li>
                        )}
                        {p.features_payload?.attribution_enabled && (
                          <li className="flex items-center gap-2 text-sm text-gray-700">
                            <CheckIcon className="h-4 w-4 text-purple-600 shrink-0" />
                            <span className="font-semibold text-purple-700">
                              Atribución Meta CAPI
                            </span>
                          </li>
                        )}
                      </ul>
                    </div>

                    <button
                      onClick={() => handleSelectPlan(p)}
                      className={`mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold shadow-md transition-all hover:shadow-lg ${
                        isPopular
                          ? "bg-teal-600 text-white hover:bg-teal-700"
                          : "bg-gray-900 text-white hover:bg-gray-800"
                      }`}
                    >
                      <CreditCardIcon className="h-4 w-4" />
                      <span>Contratar Ahora</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center max-w-lg mx-auto shadow-xs">
              <h3 className="text-base font-bold text-gray-900">
                Próximamente
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Estamos preparando los planes para consultorios. Pronto podrás
                contratar directamente aquí.
              </p>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-8">
            Todos los planes incluyen soporte y actualizaciones automáticas.
          </p>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-950 to-teal-800 text-white text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold">
            Moderniza tu consultorio hoy
          </h2>
          <p className="text-teal-200 text-base max-w-xl mx-auto">
            Deja de perder pacientes por falta de respuesta. Activa tu agenda
            inteligente y transforma tu WhatsApp en la recepción que nunca
            cierra.
          </p>
          <button
            onClick={scrollToPlans}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-teal-950 shadow-xl hover:bg-teal-50 transition-all hover:shadow-2xl"
          >
            <span>Ver Planes y Contratar</span>
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
