import { AlertTriangle, ExternalLink, ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionOrNull } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SuspendedPage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");

  // Si la cuenta vuelve a estar activa o en prueba, redirigir al CRM
  if (
    session.organizationStatus === "active" ||
    session.organizationStatus === "trial"
  ) {
    redirect("/inbox");
  }

  const isCancelled = session.organizationStatus === "cancelled";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md border-warning-soft bg-card shadow-xl text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-warning-tint text-warning">
            {isCancelled ? (
              <ShieldAlert className="h-8 w-8 text-destructive" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-warning" />
            )}
          </div>
          <CardTitle className="text-xl font-bold">
            {isCancelled
              ? "Cuenta Cancelada"
              : "Suscripción o Prueba Pausada"}
          </CardTitle>
          <CardDescription className="text-sm mt-1.5">
            {isCancelled
              ? "Esta empresa ha sido cancelada en la plataforma."
              : "El periodo de prueba o la membresía de tu empresa en el CRM ha finalizado o requiere actualización de pago."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p className="rounded-md bg-subtle/80 p-3.5 text-xs leading-relaxed text-foreground/90 border">
            Para reactivar el acceso a tu bandeja, asistente de IA y líneas de WhatsApp, por favor accede a tu panel de administración en{" "}
            <strong className="text-primary font-semibold">iqissmexico.com</strong> o contacta a tu asesor para reactivar tu plan.
          </p>

          <div className="pt-2 flex flex-col gap-2">
            <a
              href="https://iqissmexico.com"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "default", className: "w-full flex items-center justify-center gap-2" })}
            >
              <span>Administrar Plan en iqissmexico.com</span>
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href="/login"
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-full text-xs" })}
            >
              Cerrar Sesión / Cambiar de Cuenta
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
