import fs from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { pingRedis } from "@/lib/redis";
import { APP_VERSION, SERVICE_NAME } from "@/lib/version";
import {
  REQUIRED_PHASE0_MODELS,
  validateModelManifest,
  type ModelManifest,
} from "@/lib/pwa-ml/model-manifest";

export const dynamic = "force-dynamic";

export interface Phase0StatusSnapshot {
  ready: boolean;
  totalBytes: number;
  ortRuntimeReady: boolean;
  missingModels: string[];
  errors: string[];
  models: Array<{
    id: string;
    filename: string;
    stage: string;
    publicPath: string;
    existsOnDisk: boolean;
    sizeBytes: number;
  }>;
  ortFilesCount: number;
}

export async function inspectPhase0Environment(): Promise<Phase0StatusSnapshot> {
  const publicDir = path.join(process.cwd(), "public");
  const manifestPath = path.join(publicDir, "models", "manifest.json");

  let parsedManifest: ModelManifest | null = null;
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    parsedManifest = JSON.parse(raw) as ModelManifest;
  } catch {
    parsedManifest = null;
  }

  const validation = validateModelManifest(parsedManifest);

  const models = await Promise.all(
    REQUIRED_PHASE0_MODELS.map(async (spec) => {
      const modelPath = path.join(publicDir, "models", spec.filename);
      try {
        const stat = await fs.stat(modelPath);
        return {
          id: spec.id,
          filename: spec.filename,
          stage: spec.stage,
          publicPath: spec.publicPath,
          existsOnDisk: stat.isFile() && stat.size > 0,
          sizeBytes: stat.size,
        };
      } catch {
        return {
          id: spec.id,
          filename: spec.filename,
          stage: spec.stage,
          publicPath: spec.publicPath,
          existsOnDisk: false,
          sizeBytes: 0,
        };
      }
    })
  );

  let ortFilesCount = 0;
  try {
    const ortEntries = await fs.readdir(path.join(publicDir, "ort"));
    ortFilesCount = ortEntries.filter((f) => f.endsWith(".wasm")).length;
  } catch {
    ortFilesCount = 0;
  }

  const allOnDisk = models.every((m) => m.existsOnDisk);
  const totalBytes = models.reduce((acc, m) => acc + m.sizeBytes, 0);

  return {
    ready: validation.ready && allOnDisk && ortFilesCount > 0,
    totalBytes,
    ortRuntimeReady: validation.ortRuntimeReady && ortFilesCount > 0,
    missingModels: validation.missingModels,
    errors: validation.errors,
    models,
    ortFilesCount,
  };
}

export async function GET() {
  const snapshot = await inspectPhase0Environment();

  let dbOk = false;
  let redisOk = false;
  const infraErrors: string[] = [...snapshot.errors];

  try {
    await getDb().execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    infraErrors.push("PostgreSQL no disponible");
  }

  try {
    redisOk = await pingRedis();
    if (!redisOk) infraErrors.push("Redis no respondió PONG");
  } catch {
    infraErrors.push("Redis no disponible");
  }

  const ok = snapshot.ready && dbOk && redisOk;

  return NextResponse.json(
    {
      ok,
      service: SERVICE_NAME,
      version: APP_VERSION,
      phase: ok ? "fase-1-ready" : "degraded",
      checks: {
        database: dbOk,
        redis: redisOk,
        models: snapshot.ready,
      },
      modelsReady: snapshot.ready,
      ortFilesCount: snapshot.ortFilesCount,
      totalModelsMb: Number((snapshot.totalBytes / 1024 / 1024).toFixed(2)),
      models: snapshot.models.map((m) => ({
        id: m.id,
        filename: m.filename,
        existsOnDisk: m.existsOnDisk,
        sizeMb: Number((m.sizeBytes / 1024 / 1024).toFixed(2)),
      })),
      ...(infraErrors.length > 0 ? { errors: infraErrors } : {}),
    },
    { status: ok ? 200 : 503 }
  );
}
