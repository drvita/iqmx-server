import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { ConfigBucket } from "@/lib/storage/objetos";

export type StorageCredentials = {
  id: string;
  organizationId: string;
  enabled: boolean;
  endpoint: string;
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type Row = typeof schema.storageCredentials.$inferSelect;

function toCredentials(row: Row): StorageCredentials {
  return {
    id: row.id,
    organizationId: row.organizationId,
    enabled: row.enabled,
    endpoint: row.endpoint,
    bucketName: row.bucketName,
    region: row.region,
    accessKeyId: row.accessKeyId,
    secretAccessKey: decryptSecret({
      cipher: row.secretKeyCipher,
      iv: row.secretKeyIv,
      tag: row.secretKeyTag,
    }),
  };
}

export async function getStorageCredentialsByOrg(
  organizationId: string
): Promise<StorageCredentials | null> {
  const rows = await getDb()
    .select()
    .from(schema.storageCredentials)
    .where(eq(schema.storageCredentials.organizationId, organizationId))
    .limit(1);
  return rows[0] ? toCredentials(rows[0]) : null;
}

export async function getBucketConfigForOrg(
  organizationId: string
): Promise<ConfigBucket | null> {
  const creds = await getStorageCredentialsByOrg(organizationId);
  if (!creds || !creds.enabled) return null;
  return {
    endpoint: creds.endpoint.replace(/\/+$/, ""),
    bucket: creds.bucketName,
    region: creds.region,
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
  };
}

export async function saveStorageCredentials(input: {
  organizationId: string;
  enabled?: boolean;
  endpoint: string;
  bucketName: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey?: string;
}): Promise<void> {
  const db = getDb();
  const existing = await getStorageCredentialsByOrg(input.organizationId);

  let secretCipher = existing ? undefined : "";
  let secretIv = existing ? undefined : "";
  let secretTag = existing ? undefined : "";

  if (input.secretAccessKey) {
    const enc = encryptSecret(input.secretAccessKey);
    secretCipher = enc.cipher;
    secretIv = enc.iv;
    secretTag = enc.tag;
  }

  const values: Record<string, unknown> = {
    organizationId: input.organizationId,
    endpoint: input.endpoint.trim(),
    bucketName: input.bucketName.trim(),
    region: (input.region ?? "auto").trim(),
    accessKeyId: input.accessKeyId.trim(),
    enabled: input.enabled ?? true,
    updatedAt: new Date(),
  };

  if (secretCipher !== undefined) {
    values.secretKeyCipher = secretCipher;
    values.secretKeyIv = secretIv;
    values.secretKeyTag = secretTag;
  }

  if (existing) {
    await db
      .update(schema.storageCredentials)
      .set(values)
      .where(eq(schema.storageCredentials.id, existing.id));
    return;
  }

  if (!input.secretAccessKey) {
    throw new Error("Se requiere secretAccessKey para la configuración inicial.");
  }

  await db.insert(schema.storageCredentials).values({
    id: newId("credentials"),
    organizationId: input.organizationId,
    endpoint: input.endpoint.trim(),
    bucketName: input.bucketName.trim(),
    region: (input.region ?? "auto").trim(),
    accessKeyId: input.accessKeyId.trim(),
    secretKeyCipher: secretCipher!,
    secretKeyIv: secretIv!,
    secretKeyTag: secretTag!,
    enabled: input.enabled ?? true,
  });
}
