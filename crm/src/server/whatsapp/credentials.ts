import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { scoped } from "@/lib/db/tenant";
import { unsubscribeAppFromWaba } from "@/server/whatsapp/connect";

export type Credentials = {
  id: string;
  organizationId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  label: string | null;
  isDefault: boolean;
  aiEnabled: boolean;
  assistantId: string | null;
  signupMethod: "manual" | "embedded_signup";
  status: "connected" | "reconnect_required";
  token: string;
};

type Row = typeof schema.metaCredentials.$inferSelect;

function toCredentials(row: Row): Credentials {
  return {
    id: row.id,
    organizationId: row.organizationId,
    wabaId: row.wabaId,
    phoneNumberId: row.phoneNumberId,
    displayPhoneNumber: row.displayPhoneNumber,
    verifiedName: row.verifiedName,
    label: row.label,
    isDefault: row.isDefault,
    aiEnabled: row.aiEnabled,
    assistantId: row.assistantId,
    signupMethod: row.signupMethod as "manual" | "embedded_signup",
    status: row.status,
    token: decryptSecret({
      cipher: row.tokenCipher,
      iv: row.tokenIv,
      tag: row.tokenTag,
    }),
  };
}

/** Resuelve la conexión por phone_number_id (enrutamiento del webhook). */
export async function getCredentialsByPhoneNumberId(
  phoneNumberId: string
): Promise<Credentials | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.metaCredentials)
    .where(eq(schema.metaCredentials.phoneNumberId, phoneNumberId))
    .limit(1);
  return rows[0] ? toCredentials(rows[0]) : null;
}

/** Resuelve la conexión por WABA ID (eventos a nivel WABA, ej. plantillas). */
export async function getCredentialsByWabaId(
  wabaId: string
): Promise<Credentials | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.metaCredentials)
    .where(eq(schema.metaCredentials.wabaId, wabaId))
    .limit(1);
  return rows[0] ? toCredentials(rows[0]) : null;
}

/** Lista todas las líneas / conexiones de WhatsApp de la organización. */
export async function listCredentialsByOrg(
  organizationId: string
): Promise<Credentials[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.metaCredentials)
    .where(scoped(schema.metaCredentials.organizationId, organizationId))
    .orderBy(desc(schema.metaCredentials.isDefault), desc(schema.metaCredentials.createdAt));
  return rows.map(toCredentials);
}

/** Devuelve la línea predeterminada de la organización (o la primera encontrada). */
export async function getDefaultCredentialsByOrg(
  organizationId: string
): Promise<Credentials | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.metaCredentials)
    .where(scoped(schema.metaCredentials.organizationId, organizationId))
    .orderBy(desc(schema.metaCredentials.isDefault), desc(schema.metaCredentials.createdAt))
    .limit(1);
  return rows[0] ? toCredentials(rows[0]) : null;
}

/** Alias para compatibilidad hacia atrás: devuelve la conexión por defecto. */
export async function getCredentialsByOrg(
  organizationId: string
): Promise<Credentials | null> {
  return getDefaultCredentialsByOrg(organizationId);
}

export async function saveCredentials(input: {
  organizationId: string;
  wabaId: string;
  phoneNumberId: string;
  token: string;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
  label?: string | null;
  isDefault?: boolean;
  aiEnabled?: boolean;
  assistantId?: string | null;
  signupMethod?: "manual" | "embedded_signup";
}): Promise<void> {
  const db = getDb();
  const enc = encryptSecret(input.token);

  // Si no hay ninguna línea previa en la org, esta será la default
  const existingCount = await listCredentialsByOrg(input.organizationId);
  const shouldBeDefault = input.isDefault ?? existingCount.length === 0;

  // Si se marca como default, desmarcar las otras
  if (shouldBeDefault) {
    await db
      .update(schema.metaCredentials)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(scoped(schema.metaCredentials.organizationId, input.organizationId));
  }

  await db
    .insert(schema.metaCredentials)
    .values({
      id: newId("credentials"),
      organizationId: input.organizationId,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      displayPhoneNumber: input.displayPhoneNumber ?? null,
      verifiedName: input.verifiedName ?? null,
      label: input.label ?? null,
      isDefault: shouldBeDefault,
      aiEnabled: input.aiEnabled ?? true,
      assistantId: input.assistantId ?? null,
      signupMethod: input.signupMethod ?? "manual",
      tokenCipher: enc.cipher,
      tokenIv: enc.iv,
      tokenTag: enc.tag,
      status: "connected",
    })
    .onConflictDoUpdate({
      target: [schema.metaCredentials.phoneNumberId],
      set: {
        organizationId: input.organizationId,
        wabaId: input.wabaId,
        displayPhoneNumber: input.displayPhoneNumber ?? null,
        verifiedName: input.verifiedName ?? null,
        label: input.label ?? null,
        isDefault: shouldBeDefault,
        aiEnabled: input.aiEnabled ?? true,
        assistantId: input.assistantId ?? null,
        signupMethod: input.signupMethod ?? "manual",
        tokenCipher: enc.cipher,
        tokenIv: enc.iv,
        tokenTag: enc.tag,
        status: "connected",
        updatedAt: new Date(),
      },
    });
}

/** Actualiza el Asistente IA asignado y el estado de IA en una línea. */
export async function updateLineAssistant(
  organizationId: string,
  phoneNumberId: string,
  input: { assistantId?: string | null; aiEnabled?: boolean; label?: string | null }
): Promise<void> {
  const db = getDb();
  await db
    .update(schema.metaCredentials)
    .set({
      ...(input.assistantId !== undefined ? { assistantId: input.assistantId } : {}),
      ...(input.aiEnabled !== undefined ? { aiEnabled: input.aiEnabled } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        scoped(schema.metaCredentials.organizationId, organizationId),
        eq(schema.metaCredentials.phoneNumberId, phoneNumberId)
      )
    );
}

/** Elimina una conexión telefónica específica y desuscribe la WABA si no quedan más números. */
export async function deleteCredentials(
  organizationId: string,
  phoneNumberId: string
): Promise<void> {
  const db = getDb();

  // 1. Obtener la credencial antes de borrar para tener WABA y token
  const creds = await getCredentialsByPhoneNumberId(phoneNumberId);

  // 2. Eliminar la línea de meta_credentials
  await db
    .delete(schema.metaCredentials)
    .where(
      and(
        scoped(schema.metaCredentials.organizationId, organizationId),
        eq(schema.metaCredentials.phoneNumberId, phoneNumberId)
      )
    );

  // 3. Limpiar los accesos de operadores asociados a esta línea
  await db
    .delete(schema.memberPhoneAccess)
    .where(
      and(
        scoped(schema.memberPhoneAccess.organizationId, organizationId),
        eq(schema.memberPhoneAccess.phoneNumberId, phoneNumberId)
      )
    );

  // 4. Si era el último número de esta WABA, desuscribir la app en Meta
  if (creds) {
    const remaining = await db
      .select({ id: schema.metaCredentials.id })
      .from(schema.metaCredentials)
      .where(eq(schema.metaCredentials.wabaId, creds.wabaId))
      .limit(1);

    if (remaining.length === 0) {
      await unsubscribeAppFromWaba(creds.wabaId, creds.token);
    }
  }
}

/** Marca la conexión como vencida (token inválido detectado en runtime). */
export async function markReconnectRequired(
  organizationId: string,
  phoneNumberId?: string
): Promise<void> {
  const db = getDb();
  if (phoneNumberId) {
    await db
      .update(schema.metaCredentials)
      .set({ status: "reconnect_required", updatedAt: new Date() })
      .where(
        and(
          scoped(schema.metaCredentials.organizationId, organizationId),
          eq(schema.metaCredentials.phoneNumberId, phoneNumberId)
        )
      );
  } else {
    await db
      .update(schema.metaCredentials)
      .set({ status: "reconnect_required", updatedAt: new Date() })
      .where(scoped(schema.metaCredentials.organizationId, organizationId));
  }
}

/** Últimos 4 caracteres del token para mostrar en UI (jamás el token). */
export function tokenLast4(token: string): string {
  return token.slice(-4);
}
