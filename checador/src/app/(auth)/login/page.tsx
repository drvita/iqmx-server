"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  QrCode,
  Scale,
  ScanFace,
  ShieldCheck,
  Video,
  WifiOff,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo iniciar sesión.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-between bg-[#f8f9ff] text-[#0b1c30] antialiased">
      {/* Header superior institucional */}
      <header className="z-20 flex w-full items-center justify-between border-b border-[#c8c5d0]/70 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e1b4b] text-white shadow-sm">
            <ScanFace className="h-5 w-5" />
          </div>
          <span className="text-base font-semibold tracking-tight text-[#070235]">
            Checador Facial IQISS
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/privacidad"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#4b41e1]/20 bg-[#e5eeff] px-3 py-1.5 text-[11px] font-semibold text-[#1e1b4b] transition hover:border-[#4b41e1]/40 hover:bg-[#d8e5ff]"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#4b41e1]" />
            <span>Cumplimiento LFPDPPP</span>
          </Link>
        </div>
      </header>

      {/* Viewport principal */}
      <main className="relative flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Panel izquierdo: Infraestructura biométrica */}
        <section className="relative flex flex-col justify-between overflow-hidden bg-[#1e1b4b] p-8 text-white sm:p-12 lg:w-[48%] lg:p-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundSize: "32px 32px",
              backgroundImage:
                "linear-gradient(to right, rgba(99, 102, 241, 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(99, 102, 241, 0.12) 1px, transparent 1px)",
            }}
          />
          <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#4b41e1] opacity-30 blur-3xl" />
          <div className="pointer-events-none absolute right-0 bottom-0 h-[28rem] w-[28rem] rounded-full bg-[#645efb] opacity-20 blur-3xl" />

          {/* Contexto superior */}
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-[#85f8c4] shadow-[0_0_8px_#85f8c4]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white">
                  Motor de Inferencia Local
                </span>
              </div>
            </div>

            <div className="mt-7">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                Control de asistencia biométrico offline y cumplimiento laboral
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#c4c1fb] sm:text-base">
                Plataforma institucional de verificación facial en terminales de
                alta concurrencia. Prevención activa de fraude con prueba de
                vida y conciliación de jornada laboral.
              </p>
            </div>
          </div>

          {/* Visor biométrico demostrativo */}
          <div className="relative z-10 my-8 hidden sm:block">
            <div className="mx-auto max-w-md rounded-xl border border-white/15 bg-[#070235]/60 p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 text-[11px] font-semibold text-[#e3dfff]">
                <span className="flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5 text-[#85f8c4]" />
                  <span>Sensor Quiosco Local</span>
                </span>
                <span className="rounded border border-[#85f8c4]/30 bg-[#002819]/80 px-2 py-0.5 font-mono text-[#85f8c4]">
                  100% On-Device
                </span>
              </div>

              <div className="relative mt-4 flex h-40 items-center justify-center overflow-hidden rounded-lg border-2 border-[#4b41e1]/80 bg-[#070235]">
                <div className="absolute top-2 left-2 h-4 w-4 border-t-2 border-l-2 border-[#85f8c4]" />
                <div className="absolute top-2 right-2 h-4 w-4 border-t-2 border-r-2 border-[#85f8c4]" />
                <div className="absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-[#85f8c4]" />
                <div className="absolute right-2 bottom-2 h-4 w-4 border-r-2 border-b-2 border-[#85f8c4]" />

                <svg
                  className="h-24 w-24 text-[#c3c0ff]/75"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  viewBox="0 0 100 100"
                >
                  <circle
                    className="opacity-40"
                    cx="50"
                    cy="50"
                    r="38"
                    strokeDasharray="3 3"
                  />
                  <path
                    className="opacity-85"
                    d="M50 20 C35 20 28 32 28 48 C28 66 38 78 50 82 C62 78 72 66 72 48 C72 32 65 20 50 20 Z"
                  />
                  <circle cx="40" cy="45" fill="#85f8c4" r="2.5" />
                  <circle cx="60" cy="45" fill="#85f8c4" r="2.5" />
                  <path d="M50 45 L50 56 L47 59" stroke="#85f8c4" />
                  <path d="M43 68 Q50 72 57 68" stroke="#85f8c4" />
                </svg>

                <div className="absolute inset-x-3 bottom-2 flex items-center justify-between rounded border border-white/10 bg-[#1e1b4b]/90 px-3 py-1 text-[11px]">
                  <span className="flex items-center gap-1 font-medium text-white">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#85f8c4]" />
                    <span>Prueba de Vida Activa</span>
                  </span>
                  <span className="font-mono text-[#85f8c4]">512d Vector</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tarjetas Bento de valor */}
          <div className="relative z-10 mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:mt-0">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
              <div className="mb-1 flex items-center gap-2 text-[#85f8c4]">
                <WifiOff className="h-4 w-4" />
                <span className="text-xs font-semibold text-white">
                  Modo Offline
                </span>
              </div>
              <p className="text-[11px] leading-snug text-[#c4c1fb]">
                Caché local en dispositivo. Checadas ininterrumpidas sin
                internet.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
              <div className="mb-1 flex items-center gap-2 text-[#e2dfff]">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs font-semibold text-white">
                  Anti-Fraude
                </span>
              </div>
              <p className="text-[11px] leading-snug text-[#c4c1fb]">
                Bloqueo de fotos, videos y pantallas con detección de vida.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3.5 backdrop-blur-md">
              <div className="mb-1 flex items-center gap-2 text-[#85f8c4]">
                <Scale className="h-4 w-4" />
                <span className="text-xs font-semibold text-white">
                  Jornada 40h/48h
                </span>
              </div>
              <p className="text-[11px] leading-snug text-[#c4c1fb]">
                Control de turnos, incidencias y alertas preventivas semanales.
              </p>
            </div>
          </div>

          {/* Pie de confianza */}
          <div className="relative z-10 mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-[11px] font-medium text-[#c4c1fb]">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-white" />
              <span>Privacidad Biométrica LFPDPPP</span>
            </span>
            <span>IQISS México · Plataforma Empresarial</span>
          </div>
        </section>

        {/* Panel derecho: Tarjeta de autenticación */}
        <section className="flex flex-col items-center justify-center bg-[#f8f9ff] px-4 py-10 sm:px-10 lg:w-[52%] lg:px-16">
          <div className="w-full max-w-[460px]">
            <div className="rounded-xl border border-[#c8c5d0]/70 bg-white p-6 shadow-[0_20px_25px_-5px_rgba(30,27,75,0.05),0_8px_10px_-6px_rgba(30,27,75,0.04)] sm:p-9">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#4b41e1]">
                    Consola Central
                  </span>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#0b1c30]">
                    Iniciar sesión
                  </h2>
                  <p className="mt-1 text-sm text-[#47464f]">
                    Accede a la administración, personal y dispositivos de tu
                    organización.
                  </p>
                </div>

                <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#c8c5d0] bg-[#eff4ff] px-2.5 py-1 text-[11px] font-medium text-[#179c6e]">
                  <span className="h-2 w-2 rounded-full bg-[#179c6e]" />
                  <span>En línea</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-[13px] font-medium text-[#0b1c30]"
                  >
                    Correo electrónico institucional
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-[#787680]" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@tuempresa.com"
                      className="w-full rounded-md border border-[#c8c5d0] bg-white py-2.5 pr-3.5 pl-10 text-sm text-[#0b1c30] transition placeholder:text-[#787680] focus:border-[#4b41e1] focus:ring-2 focus:ring-[#4b41e1]/20 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-[13px] font-medium text-[#0b1c30]"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-[#787680]" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full rounded-md border border-[#c8c5d0] bg-white py-2.5 pr-10 pl-10 text-sm text-[#0b1c30] transition placeholder:text-[#787680] focus:border-[#4b41e1] focus:ring-2 focus:ring-[#4b41e1]/20 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#787680] transition hover:text-[#0b1c30]"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-md border border-[#ba1a1a]/25 bg-[#ffdad6] px-3 py-2 text-xs font-medium text-[#93000a]"
                  >
                    {error}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-[#4b41e1] px-4 py-3 text-sm font-semibold tracking-wide text-white shadow-sm transition hover:bg-[#645efb] focus:ring-2 focus:ring-[#4b41e1] focus:ring-offset-2 focus:outline-none disabled:opacity-50"
                  >
                    <span>
                      {loading ? "Verificando acceso..." : "Entrar al panel"}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>

              <div className="mt-6 border-t border-[#c8c5d0]/60 pt-5">
                <a
                  href="/kiosk"
                  className="group flex items-center justify-between rounded-lg border border-[#c8c5d0]/70 bg-[#eff4ff] p-3 transition hover:border-[#4b41e1] hover:bg-indigo-50/70"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#c8c5d0] bg-white text-[#4b41e1]">
                      <QrCode className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#0b1c30] group-hover:text-[#4b41e1]">
                        ¿Eres un dispositivo quiosco?
                      </p>
                      <p className="text-[11px] text-[#47464f]">
                        Abre el modo quiosco y vincula tu tablet con tu PIN de 6
                        dígitos.
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#4b41e1] transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
