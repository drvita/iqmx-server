import Image from "next/image";
import { isVoceroName } from "@/lib/brand";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { getBranding } from "@/server/branding";
import { BrandLogo } from "@/components/brand-mark";

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const branding = await getBranding().catch(() => DEFAULT_BRANDING);
  const isDefaultBrand = isVoceroName(branding.name);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-subtle p-4">
      <div className="brand-grid absolute inset-0" aria-hidden />
      <div className="brand-glow brand-glow-a" aria-hidden />
      <div className="brand-glow brand-glow-b" aria-hidden />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {isDefaultBrand ? (
            <div className="flex flex-col items-center gap-2">
              <Image
                src="/logo.png"
                alt="IQISSMexico Logo"
                width={180}
                height={50}
                className="h-11 w-auto object-contain mx-auto"
                priority
              />
              <h1 className="text-[20px] font-bold leading-tight tracking-[-0.03em] text-foreground mt-1">
                CRM WhatsApp Omnicanal
              </h1>
              <p className="text-xs text-text-3">
                Plataforma de comunicación, ventas y agentes con IA
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <BrandLogo branding={branding} size="lg" />
              <div>
                <h1 className="sr-only">{branding.name}</h1>
                <p className="text-sm text-text-3">CRM de WhatsApp con agente de IA</p>
              </div>
            </div>
          )}
        </div>
        {children}
      </div>
    </main>
  );
}

