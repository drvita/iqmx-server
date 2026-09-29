import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";

export type ResetOwnerPasswordInput = {
  externalCustomerId?: string;
  ownerEmail?: string;
  password: string;
};

export type ResetOwnerPasswordResult = {
  ok: true;
  message: string;
  organization: {
    id: string;
    name: string;
    externalCustomerId: string | null;
  };
  owner: {
    id: string;
    email: string;
    name: string;
  };
  mustChangePassword: boolean;
};

/**
 * Restablece la contraseña temporal para el usuario propietario de una organización existente.
 * NO crea nuevas organizaciones ni nuevos usuarios.
 */
export async function resetOwnerPassword(
  input: ResetOwnerPasswordInput
): Promise<ResetOwnerPasswordResult> {
  const db = getDb();

  let org: typeof schema.organization.$inferSelect | undefined;

  // 1. Intentar buscar por externalCustomerId si fue proporcionado
  if (input.externalCustomerId) {
    const orgs = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.externalCustomerId, input.externalCustomerId.trim()))
      .limit(1);
    org = orgs[0];
  }

  // 2. Si no se encontró por externalCustomerId y se proporcionó ownerEmail, buscar por el usuario y su membresía
  let ownerUser: typeof schema.user.$inferSelect | undefined;

  if (!org && input.ownerEmail) {
    const normalizedEmail = input.ownerEmail.trim().toLowerCase();
    const users = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, normalizedEmail))
      .limit(1);

    if (users[0]) {
      ownerUser = users[0];
      const memberships = await db
        .select({
          org: schema.organization,
        })
        .from(schema.member)
        .innerJoin(schema.organization, eq(schema.member.organizationId, schema.organization.id))
        .where(eq(schema.member.userId, ownerUser.id))
        .limit(1);

      org = memberships[0]?.org;
    }
  }

  if (!org) {
    const idHint = input.externalCustomerId || input.ownerEmail || "desconocido";
    throw new Error(
      `No se encontró ninguna organización asociada a ${idHint}.`
    );
  }

  // 3. Si no tenemos ownerUser aún (porque encontramos la org por externalCustomerId), localizar al usuario propietario
  if (!ownerUser) {
    const ownerMembers = await db
      .select({
        user: schema.user,
      })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
      .where(
        and(
          eq(schema.member.organizationId, org.id),
          eq(schema.member.role, "owner")
        )
      )
      .limit(1);

    if (ownerMembers[0]?.user) {
      ownerUser = ownerMembers[0].user;
    } else {
      // Respaldo: si no hay rol owner explícito, tomar el miembro principal
      const anyMembers = await db
        .select({
          user: schema.user,
        })
        .from(schema.member)
        .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
        .where(eq(schema.member.organizationId, org.id))
        .limit(1);
      ownerUser = anyMembers[0]?.user;
    }
  }

  if (!ownerUser) {
    throw new Error(
      `La organización "${org.name}" no tiene un usuario propietario asignado.`
    );
  }

  // 4. Hashear la nueva contraseña con el algoritmo de Better Auth (salt:hash)
  const hash = await hashPassword(input.password);

  // 5. Actualizar o insertar credencial en crm.account
  const existingAccount = await db
    .select()
    .from(schema.account)
    .where(
      and(
        eq(schema.account.userId, ownerUser.id),
        eq(schema.account.providerId, "credential")
      )
    )
    .limit(1);

  if (existingAccount[0]) {
    await db
      .update(schema.account)
      .set({ password: hash, updatedAt: new Date() })
      .where(eq(schema.account.id, existingAccount[0].id));
  } else {
    await db.insert(schema.account).values({
      id: newId("account"),
      accountId: ownerUser.id,
      providerId: "credential",
      userId: ownerUser.id,
      password: hash,
    });
  }

  // 6. Actualizar metadatos de la organización marcando mustChangePassword y tempPassword
  let parsedMeta: Record<string, unknown> = {};
  if (org.metadata) {
    try {
      parsedMeta = JSON.parse(org.metadata);
    } catch {
      parsedMeta = {};
    }
  }

  await db
    .update(schema.organization)
    .set({
      metadata: JSON.stringify({
        ...parsedMeta,
        tempPassword: input.password,
        mustChangePassword: true,
      }),
    })
    .where(eq(schema.organization.id, org.id));

  return {
    ok: true,
    message: "Contraseña temporal restablecida exitosamente.",
    organization: {
      id: org.id,
      name: org.name,
      externalCustomerId: org.externalCustomerId,
    },
    owner: {
      id: ownerUser.id,
      email: ownerUser.email,
      name: ownerUser.name,
    },
    mustChangePassword: true,
  };
}
