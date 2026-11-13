import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireSyncDevice } from "@/services/sync/device-auth";

const heartbeatSchema = z
  .object({
    appVersion: z.string().max(30).optional(),
    modeloIaVersion: z.string().max(50).optional(),
    clientTimeMs: z.number().finite().optional(),
  })
  .optional();

export async function POST(req: Request) {
  const gate = await requireSyncDevice(req, "heartbeat");
  if (!gate.ok) return gate.response;

  const { auth } = gate;
  const rawBody = await req.json().catch(() => undefined);
  const parsed = heartbeatSchema.safeParse(rawBody);
  const payload = parsed.success ? parsed.data : undefined;

  const now = new Date();
  const db = getDb();

  await db
    .update(schema.dispositivos)
    .set({
      ultimoHeartbeatAt: now,
      ...(payload?.appVersion ? { appVersion: payload.appVersion } : {}),
      ...(payload?.modeloIaVersion
        ? { modeloIaVersion: payload.modeloIaVersion }
        : {}),
      updatedAt: now,
    })
    .where(eq(schema.dispositivos.id, auth.device.id));

  const clockSkewSec =
    typeof payload?.clientTimeMs === "number"
      ? Math.round((now.getTime() - payload.clientTimeMs) / 1000)
      : null;

  return NextResponse.json({
    ok: true,
    serverTime: now.toISOString(),
    clockSkewSec,
    organization: {
      estado: auth.org.estado,
      cloudEvidencesEnabled: auth.org.cloudEvidencesEnabled,
      horasSemanalesMax: auth.org.horasSemanalesMax,
      pinAuditoriaHash: auth.org.pinAuditoriaHash,
    },
  });
}
