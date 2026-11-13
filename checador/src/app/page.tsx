import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RootRedirectPage() {
  const session = await getSessionOrNull();
  if (session) {
    redirect("/dashboard");
  }
  redirect("/login");
}
