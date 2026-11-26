import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireSyncDevice } from "@/services/sync/device-auth";
import {
  getEmployeeCurrentAcknowledgmentSummary,
  recordEmployeeAcknowledgment,
} from "@/services/reports/weekly-acknowledgment";

export const dynamic = "force-dynamic";

const ackSchema = z.object({
  empleadoId: z.string().uuid(),
  estado: z.enum(["aceptado", "rechazado"]),
});

export async function GET(req: Request) {
  const gate = await requireSyncDevice(req, "acknowledgment");
  if (!gate.ok) return gate.response;

  const { auth } = gate;
  if (!auth.org.acuseSemanalEnabled) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "El acuse de conformidad de asistencia no está habilitado para esta organización.",
      },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const queryEmpId = url.searchParams.get("empleadoId")?.trim() || null;
  const queryCodigo = url.searchParams.get("codigoInterno")?.trim() || null;

  const isPersonalMobile = auth.device.tipo === "dispositivo_personal_movil";
  let targetEmployeeId: string | null = isPersonalMobile
    ? auth.device.empleadoId
    : queryEmpId;

  if (!targetEmployeeId && !isPersonalMobile && queryCodigo) {
    const db = getDb();
    const [found] = await db
      .select({ id: schema.empleados.id })
      .from(schema.empleados)
      .where(
        and(
          eq(schema.empleados.orgId, auth.org.id),
          eq(schema.empleados.activo, true),
          sql`LOWER(TRIM(${schema.empleados.codigoInterno})) = LOWER(${queryCodigo})`
        )
      )
      .limit(1);

    if (!found) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No encontramos un colaborador activo con ese número de nómina.",
        },
        { status: 404 }
      );
    }
    targetEmployeeId = found.id;
  }

  if (!targetEmployeeId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Debes indicar un colaborador o número de nómina para consultar el resumen.",
      },
      { status: 400 }
    );
  }

  const summary = await getEmployeeCurrentAcknowledgmentSummary(
    auth.org.id,
    targetEmployeeId
  );

  if (!summary) {
    return NextResponse.json(
      { ok: false, error: "Colaborador activo no encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    ...summary,
  });
}

export async function POST(req: Request) {
  const gate = await requireSyncDevice(req, "acknowledgment");
  if (!gate.ok) return gate.response;

  const { auth } = gate;
  if (!auth.org.acuseSemanalEnabled) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "El acuse de conformidad de asistencia no está habilitado para esta organización.",
      },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 }
    );
  }

  const parsed = ackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Datos del acuse inválidos." },
      { status: 422 }
    );
  }

  const isPersonalMobile = auth.device.tipo === "dispositivo_personal_movil";
  if (isPersonalMobile && parsed.data.empleadoId !== auth.device.empleadoId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Este dispositivo personal solo puede registrar acuses de su colaborador asignado.",
      },
      { status: 403 }
    );
  }

  try {
    const acknowledgment = await recordEmployeeAcknowledgment({
      orgId: auth.org.id,
      empleadoId: parsed.data.empleadoId,
      dispositivoId: auth.device.id,
      estado: parsed.data.estado,
      origen: isPersonalMobile ? "movil_personal" : "kiosco_touch",
    });

    return NextResponse.json({
      ok: true,
      acknowledgment,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "No se pudo registrar el acuse semanal.",
      },
      { status: 400 }
    );
  }
}
