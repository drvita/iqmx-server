import type { Metadata } from "next";
import { ResetPasswordClient } from "@/components/auth/ResetPasswordClient";

export const metadata: Metadata = {
  title: "Restablecer Contraseña",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <ResetPasswordClient token={params.token ?? ""} />;
}
