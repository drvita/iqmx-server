import { redirect } from "next/navigation";

/**
 * En IQISSMexico, el alta y aprovisionamiento de organizaciones y cuentas de CRM
 * se realiza exclusivamente desde la plataforma Web (Portal de Clientes / Admin).
 * Se deshabilita el registro público directo en este microservicio.
 */
export default function RegisterPage() {
  redirect("/login");
}
