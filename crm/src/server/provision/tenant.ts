import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { getOrGenerateWebhookToken } from "@/server/whatsapp/webhook-token";
import { getEnv } from "@/lib/env";
import { type PlanLimits, getOrganizationSettings } from "@/server/settings/service";

export const SEED_STAGES: { name: string; kind: "open" | "won" | "lost" }[] = [
  { name: "Nuevo", kind: "open" },
  { name: "En conversación", kind: "open" },
  { name: "Interesado", kind: "open" },
  { name: "Cliente", kind: "won" },
  { name: "Perdido", kind: "lost" },
];

export type ProvisionTenantInput = {
  externalCustomerId: string;
  companyName: string;
  ownerEmail: string;
  ownerName: string;
  password?: string;
  status?: "active" | "trial";
  features?: PlanLimits;
};

export type ProvisionTenantResult = {
  action: "created" | "existing";
  organization: {
    id: string;
    name: string;
    slug: string | null;
    status: "active" | "trial" | "suspended" | "cancelled";
    externalCustomerId: string | null;
  };
  owner: {
    id: string;
    email: string;
    name: string;
  };
  webhook: {
    token: string;
    url: string;
    provisionUrl: string;
  };
  tempPassword?: string;
  mustChangePassword?: boolean;
};

function generateSlug(name: string, fallbackId: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return `${base || "empresa"}-${fallbackId.slice(-6)}`;
}

export async function provisionTenant(
  input: ProvisionTenantInput
): Promise<ProvisionTenantResult> {
  const db = getDb();
  const env = getEnv();

  // 1. Idempotencia: Verificar si ya existe una organización con este externalCustomerId
  const existingOrg = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.externalCustomerId, input.externalCustomerId))
    .limit(1);

  if (existingOrg[0]) {
    const org = existingOrg[0];
    await getOrganizationSettings(org.id);
    const webhookToken = await getOrGenerateWebhookToken(org.id);
    const webhookUrl = `${env.APP_BASE_URL}/api/webhooks/wa/${webhookToken}`;

    // Buscar el owner de la organización
    const members = await db
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

    const ownerUser = members[0]?.user ?? {
      id: "unknown",
      email: input.ownerEmail,
      name: input.ownerName,
    };

    // Si se envió contraseña temporal, actualizar o crear credencial en account y guardar flag en metadata
    let hasUpdatedPassword = false;
    if (input.password && input.password.length >= 8 && ownerUser.id !== "unknown") {
      const hash = await hashPassword(input.password);
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

      let parsedMeta: Record<string, unknown> = {};
      if (org.metadata) {
        try {
          parsedMeta = JSON.parse(org.metadata);
        } catch {}
      }

      await db
        .update(schema.organization)
        .set({
          metadata: JSON.stringify({
            ...parsedMeta,
            webhookToken,
            tempPassword: input.password,
            mustChangePassword: true,
          }),
        })
        .where(eq(schema.organization.id, org.id));

      hasUpdatedPassword = true;
    }

    return {
      action: "existing",
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status as "active" | "trial" | "suspended" | "cancelled",
        externalCustomerId: org.externalCustomerId,
      },
      owner: {
        id: ownerUser.id,
        email: ownerUser.email,
        name: ownerUser.name,
      },
      webhook: {
        token: webhookToken,
        url: webhookUrl,
        provisionUrl: `${env.APP_BASE_URL}/api/settings/whatsapp/provision`,
      },
      ...(hasUpdatedPassword && {
        tempPassword: input.password,
        mustChangePassword: true,
      }),
    };
  }

  // 2. Transacción de alta de nuevo tenant
  const orgId = newId("organization");
  const slug = generateSlug(input.companyName, orgId);
  const status = input.status ?? "trial";

  const result = await db.transaction(async (tx) => {
    // A. Crear la Organización con metadatos de contraseña temporal
    const [org] = await tx
      .insert(schema.organization)
      .values({
        id: orgId,
        name: input.companyName.trim(),
        slug,
        status,
        externalCustomerId: input.externalCustomerId.trim(),
        metadata: JSON.stringify({
          tempPassword: input.password || null,
          mustChangePassword: Boolean(input.password),
        }),
      })
      .returning();

    if (!org) {
      throw new Error("No se pudo insertar la organización");
    }

    // B. Crear o vincular el usuario propietario
    const normalizedEmail = input.ownerEmail.trim().toLowerCase();
    const existingUsers = await tx
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, normalizedEmail))
      .limit(1);

    let userId = existingUsers[0]?.id;
    let userName = existingUsers[0]?.name ?? input.ownerName.trim();

    if (!userId) {
      userId = newId("user");
      userName = input.ownerName.trim();
      await tx.insert(schema.user).values({
        id: userId,
        email: normalizedEmail,
        name: userName,
        emailVerified: true,
      });
    }

    // Registrar o actualizar cuenta de credenciales con la contraseña (temporal)
    if (input.password && input.password.length >= 8) {
      const hash = await hashPassword(input.password);
      const existingAccount = await tx
        .select()
        .from(schema.account)
        .where(
          and(
            eq(schema.account.userId, userId),
            eq(schema.account.providerId, "credential")
          )
        )
        .limit(1);

      if (existingAccount[0]) {
        await tx
          .update(schema.account)
          .set({ password: hash, updatedAt: new Date() })
          .where(eq(schema.account.id, existingAccount[0].id));
      } else {
        await tx.insert(schema.account).values({
          id: newId("account"),
          accountId: userId,
          providerId: "credential",
          userId,
          password: hash,
        });
      }
    }

    // C. Membresía de Owner en la nueva organización
    await tx.insert(schema.member).values({
      id: newId("member"),
      organizationId: orgId,
      userId,
      role: "owner",
    });

    // D. Sembrar etapas del Pipeline
    await tx.insert(schema.pipelineStage).values(
      SEED_STAGES.map((s, i) => ({
        id: newId("stage"),
        organizationId: orgId,
        name: s.name,
        position: i,
        kind: s.kind,
      }))
    );

    // E. Sembrar Asistente IA Conversacional por defecto
    await tx.insert(schema.agentProfile).values({
      id: newId("agentProfile"),
      organizationId: orgId,
      name: "Asistente Principal",
      type: "conversational",
      isDefault: true,
      description: "Asistente principal de atención y ventas",
      instructions:
        "Atiende con amabilidad y precisión. Resuelve dudas del catálogo y califica el interés del cliente.",
      tone: "cercano y profesional",
      enabled: true,
    });

    // F. Sembrar Configuración SaaS del Tenant (usando defaults de la tabla y features opcionales)
    const settingsId = newId("settings");
    const features = input.features || {};
    await tx.insert(schema.organizationSettings).values({
      id: settingsId,
      organizationId: orgId,
      ...(features.agendaEnabled !== undefined && { agendaEnabled: features.agendaEnabled }),
      ...(features.attributionEnabled !== undefined && { attributionEnabled: features.attributionEnabled }),
      ...(features.channels !== undefined && { channels: features.channels }),
      ...(features.maxWhatsappAccounts !== undefined && { maxWhatsappAccounts: features.maxWhatsappAccounts }),
      ...(features.maxTeamMembers !== undefined && { maxTeamMembers: features.maxTeamMembers }),
      ...(features.maxContacts !== undefined && { maxContacts: features.maxContacts }),
      ...(features.maxTokensIn !== undefined && { maxTokensIn: features.maxTokensIn }),
      ...(features.maxTokensOut !== undefined && { maxTokensOut: features.maxTokensOut }),
      ...(features.aiEnabled !== undefined && { aiEnabled: features.aiEnabled }),
      ...(features.labEnabled !== undefined && { labEnabled: features.labEnabled }),
      ...(features.tasksEnabled !== undefined && { tasksEnabled: features.tasksEnabled }),
      ...(features.extra !== undefined && { extra: features.extra }),
    });

    return { org, userId, userName, normalizedEmail };
  });

  // Generar token de webhook para la nueva organización
  const webhookToken = await getOrGenerateWebhookToken(orgId);
  const webhookUrl = `${env.APP_BASE_URL}/api/webhooks/wa/${webhookToken}`;

  return {
    action: "created",
    organization: {
      id: result.org.id,
      name: result.org.name,
      slug: result.org.slug,
      status: result.org.status as "active" | "trial" | "suspended" | "cancelled",
      externalCustomerId: result.org.externalCustomerId,
    },
    owner: {
      id: result.userId,
      email: result.normalizedEmail,
      name: result.userName,
    },
    webhook: {
      token: webhookToken,
      url: webhookUrl,
      provisionUrl: `${env.APP_BASE_URL}/api/settings/whatsapp/provision`,
    },
    ...(input.password && {
      tempPassword: input.password,
      mustChangePassword: true,
    }),
  };
}

export type SetTenantStatusResult = {
  ok: boolean;
  organizationId: string;
  previousStatus: string;
  newStatus: string;
};

export async function setTenantStatus(
  organizationId: string,
  newStatus: "active" | "trial" | "suspended" | "cancelled",
  reason?: string
): Promise<SetTenantStatusResult | null> {
  const db = getDb();

  const orgs = await db
    .select()
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);

  const org = orgs[0];
  if (!org) return null;

  const previousStatus = org.status;

  // Actualizar metadata si hay reason
  let metadataObj: Record<string, unknown> = {};
  if (org.metadata) {
    try {
      metadataObj = JSON.parse(org.metadata);
    } catch {
      metadataObj = {};
    }
  }

  metadataObj.statusReason = reason ?? null;
  metadataObj.statusUpdatedAt = new Date().toISOString();

  await db
    .update(schema.organization)
    .set({
      status: newStatus,
      metadata: JSON.stringify(metadataObj),
    })
    .where(eq(schema.organization.id, organizationId));

  return {
    ok: true,
    organizationId,
    previousStatus,
    newStatus,
  };
}
