import { inspectPhase0Environment } from "@/app/api/health/route";
import { BiometricPhase0Lab } from "@/components/BiometricPhase0Lab";
import { EnvironmentDiagnostics } from "@/components/EnvironmentDiagnostics";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

export default async function LabPage() {
  const snapshot = await inspectPhase0Environment();
  const totalMb = (snapshot.totalBytes / 1024 / 1024).toFixed(2);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-5 md:max-w-3xl md:px-6 lg:max-w-6xl lg:py-8">
      <header className="rounded-2xl bg-[#1e1b4b] p-5 text-white shadow-sm md:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
          IQISS México · Checador Facial SaaS v{APP_VERSION}
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">
          Laboratorio Biométrico Local
        </h1>
        <p className="mt-1 text-xs text-indigo-100 md:text-sm">
          Modelos ONNX locales: {totalMb} MB · Binarios WASM: {snapshot.ortFilesCount}
        </p>
      </header>
      <section className="mt-5">
        <EnvironmentDiagnostics />
      </section>
      <BiometricPhase0Lab />
    </main>
  );
}
