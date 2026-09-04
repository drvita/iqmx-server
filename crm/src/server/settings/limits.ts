import { count, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getOrganizationSettings } from "./service";

export class QuotaExceededError extends Error {
  public statusCode = 403;
  public quotaType: string;
  public maxLimit: number;
  public currentCount: number;

  constructor(quotaType: string, currentCount: number, maxLimit: number, message?: string) {
    super(
      message ??
        `Límite alcanzado para ${quotaType}. Tu plan actual permite un máximo de ${maxLimit} (actuales: ${currentCount}).`
    );
    this.name = "QuotaExceededError";
    this.quotaType = quotaType;
    this.maxLimit = maxLimit;
    this.currentCount = currentCount;
  }
}

/**
 * Valida si la organización puede conectar una nueva línea de WhatsApp.
 * Si ya alcanzó el límite `maxWhatsappAccounts`, arroja QuotaExceededError.
 */
export async function assertCanAddWhatsappAccount(organizationId: string): Promise<void> {
  const settings = await getOrganizationSettings(organizationId);
  const db = getDb();

  const [row] = await db
    .select({ total: count() })
    .from(schema.metaCredentials)
    .where(eq(schema.metaCredentials.organizationId, organizationId));

  const currentCount = Number(row?.total ?? 0);
  if (currentCount >= settings.maxWhatsappAccounts) {
    throw new QuotaExceededError(
      "líneas de WhatsApp",
      currentCount,
      settings.maxWhatsappAccounts,
      `Has alcanzado el límite de ${settings.maxWhatsappAccounts} línea(s) de WhatsApp permitida(s) por tu membresía.`
    );
  }
}

/**
 * Valida si la organización puede invitar a un nuevo integrante de equipo.
 */
export async function assertCanAddTeamMember(organizationId: string): Promise<void> {
  const settings = await getOrganizationSettings(organizationId);
  const db = getDb();

  const [row] = await db
    .select({ total: count() })
    .from(schema.member)
    .where(eq(schema.member.organizationId, organizationId));

  const currentCount = Number(row?.total ?? 0);
  if (currentCount >= settings.maxTeamMembers) {
    throw new QuotaExceededError(
      "miembros de equipo",
      currentCount,
      settings.maxTeamMembers,
      `Has alcanzado el límite de ${settings.maxTeamMembers} miembros de equipo permitidos por tu membresía.`
    );
  }
}

/**
 * Valida si la organización puede crear o registrar un nuevo contacto.
 */
export async function assertCanAddContact(organizationId: string): Promise<void> {
  const settings = await getOrganizationSettings(organizationId);
  const db = getDb();

  const [row] = await db
    .select({ total: count() })
    .from(schema.contact)
    .where(eq(schema.contact.organizationId, organizationId));

  const currentCount = Number(row?.total ?? 0);
  if (currentCount >= settings.maxContacts) {
    throw new QuotaExceededError(
      "contactos",
      currentCount,
      settings.maxContacts,
      `Has alcanzado el límite de ${settings.maxContacts} contactos permitidos por tu membresía.`
    );
  }
}

/**
 * Consulta si la agenda está habilitada para una organización.
 */
export async function isAgendaEnabledForOrg(organizationId: string): Promise<boolean> {
  const settings = await getOrganizationSettings(organizationId);
  return settings.agendaEnabled;
}

/**
 * Consulta si la atribución / CAPI está habilitada para una organización.
 */
export async function isAttributionEnabledForOrg(organizationId: string): Promise<boolean> {
  const settings = await getOrganizationSettings(organizationId);
  return settings.attributionEnabled;
}

/**
 * Consulta si el laboratorio de IA está habilitado para una organización.
 */
export async function isLabEnabledForOrg(organizationId: string): Promise<boolean> {
  const settings = await getOrganizationSettings(organizationId);
  return settings.labEnabled;
}

/**
 * Consulta si el módulo de tareas está habilitado para una organización.
 */
export async function isTasksEnabledForOrg(organizationId: string): Promise<boolean> {
  const settings = await getOrganizationSettings(organizationId);
  return settings.tasksEnabled;
}
