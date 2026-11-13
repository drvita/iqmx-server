import type { Metadata } from "next";
import { AboutPrivacyContent } from "@/components/legal/AboutPrivacyContent";

export const metadata: Metadata = {
  title: "Acerca de y Aviso de Privacidad | Checador Facial IQISSMexico",
};

export default function PrivacidadPublicPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <AboutPrivacyContent showBackToLogin />
      </div>
    </main>
  );
}
