import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { publish } from "@/server/events/bus";
import { runAgentTurn } from "@/server/ai/pipeline";
import { renderKb } from "@/server/ai/prompts";
import { computeScore, judgeCase } from "@/server/lab/judge";
import {
  PERSONAS,
  type Persona,
} from "@/server/lab/personas";

/**
 * Runner del Laboratorio (FR-030/FR-034): corrida en segundo plano DENTRO del
 * proceso (sin cola externa), turnos secuenciales con debounce 0, timeout
 * global de 10 minutos, y lock de concurrencia por índice parcial UNIQUE en
 * BD (máx. 1 corrida `running` por organización).
 *
 * Soporta dos modos:
 * 1. Sandbox (Pre-Producción): Escenarios sintéticos adaptados al negocio por IA o editados por usuario.
 * 2. Live Audit (Post-Producción): Muestreo inteligente de conversaciones reales no juzgadas.
 */

const RUN_TIMEOUT_MS = 10 * 60 * 1000;

export class RunConflictError extends Error {}
export class NoAuditableConversationsError extends Error {}
export class NoConfiguredScenariosError extends Error {}
export class AgendaDisabledForOrgError extends Error {}

export type StartRunOptions = {
  testType?: "sandbox" | "live_audit" | "agenda_flow" | "guardrails";
  sampleSize?: number;
  assistantId?: string;
};

export type StartRunResult = {
  runId: string;
  status: "running" | "queued";
  queuePosition?: number;
};

/**
 * Obtiene los escenarios configurados para la organización en BD según el testType
 * y opcionalmente el assistantId. No genera ni recurre a preguntas predeterminadas.
 */
export async function getLabPersonasForOrg(
  organizationId: string,
  testType: "sandbox" | "agenda_flow" | "guardrails" = "sandbox",
  assistantId?: string
): Promise<Persona[]> {
  const db = getDb();
  const conditions = [
    eq(schema.labScenario.organizationId, organizationId),
    eq(schema.labScenario.testType, testType),
  ];
  if (assistantId) {
    conditions.push(
      or(
        eq(schema.labScenario.assistantId, assistantId),
        isNull(schema.labScenario.assistantId)
      )!
    );
  }

  const rows = await db
    .select()
    .from(schema.labScenario)
    .where(and(...conditions))
    .orderBy(asc(schema.labScenario.createdAt));

  if (rows.length > 0) {
    return rows.map((r) => ({
      key: r.key,
      label: r.label,
      description: r.description ?? "",
      phone: r.syntheticPhone,
      contactName: r.contactName,
      script: r.script,
    }));
  }

  return [];
}

export async function getQueuePosition(runId: string): Promise<number> {
  const db = getDb();
  const target = await db
    .select({ startedAt: schema.agentTestRun.startedAt })
    .from(schema.agentTestRun)
    .where(eq(schema.agentTestRun.id, runId))
    .limit(1);

  if (!target[0]) return 1;

  const ahead = await db
    .select({ id: schema.agentTestRun.id })
    .from(schema.agentTestRun)
    .where(
      and(
        eq(schema.agentTestRun.status, "queued"),
        sql`${schema.agentTestRun.startedAt} <= ${target[0].startedAt}`
      )
    );

  return Math.max(1, ahead.length);
}

export async function startRun(
  organizationId: string,
  options?: StartRunOptions
): Promise<StartRunResult> {
  const db = getDb();
  const testType = options?.testType ?? "sandbox";
  let runId: string;

  const suiteNames: Record<string, string> = {
    sandbox: "Benchmark de Atención y Ventas",
    live_audit: "Auditoría de Tráfico Real",
    agenda_flow: "Flujo de Citas y Agenda",
    guardrails: "Guardrails y Seguridad Anti-Inyección",
  };

  if (testType === "agenda_flow") {
    const { isAgendaEnabled } = await import("@/server/agenda/flag");
    if (!(await isAgendaEnabled(organizationId))) {
      throw new AgendaDisabledForOrgError(
        "El módulo de agenda no está habilitado para esta organización"
      );
    }
  }

  // 1. REGLA INTRA-TENANT: Un inquilino solo puede tener 1 benchmark activo (running o queued)
  const existingOrgRun = await db
    .select({ id: schema.agentTestRun.id, status: schema.agentTestRun.status })
    .from(schema.agentTestRun)
    .where(
      and(
        eq(schema.agentTestRun.organizationId, organizationId),
        or(
          eq(schema.agentTestRun.status, "running"),
          eq(schema.agentTestRun.status, "queued")
        )
      )
    )
    .limit(1);

  if (existingOrgRun.length > 0) {
    throw new RunConflictError(
      existingOrgRun[0]?.status === "queued"
        ? "Ya tienes un benchmark en cola de espera; espera a que finalice"
        : "Ya tienes una corrida en curso"
    );
  }

  // 2. REGLA CROSS-TENANT: Servidor corre 1 benchmark a la vez para proteger atención de WhatsApp
  const globalRunning = await db
    .select({ id: schema.agentTestRun.id })
    .from(schema.agentTestRun)
    .where(eq(schema.agentTestRun.status, "running"))
    .limit(1);

  const shouldQueue = globalRunning.length > 0;
  const initialStatus = shouldQueue ? ("queued" as const) : ("running" as const);

  if (testType === "live_audit") {
    // MODO AUDITORÍA: Muestreo de conversaciones reales no juzgadas
    const sampleLimit = Math.max(1, Math.min(options?.sampleSize ?? 10, 50));
    const eligibleConversations = await db
      .select({
        id: schema.conversation.id,
        contactId: schema.conversation.contactId,
        contactName: schema.contact.name,
        contactPhone: schema.contact.phone,
      })
      .from(schema.conversation)
      .innerJoin(schema.contact, eq(schema.conversation.contactId, schema.contact.id))
      .where(
        and(
          eq(schema.conversation.organizationId, organizationId),
          eq(schema.conversation.isTest, false),
          options?.assistantId ? eq(schema.conversation.assistantId, options.assistantId) : sql`true`,
          isNull(schema.conversation.lastJudgedAt)
        )
      )
      .orderBy(desc(schema.conversation.lastMessageAt))
      .limit(sampleLimit);

    if (eligibleConversations.length === 0) {
      throw new NoAuditableConversationsError(
        "No hay conversaciones reales pendientes de auditar"
      );
    }

    try {
      const inserted = await db
        .insert(schema.agentTestRun)
        .values({
          id: newId("testRun"),
          organizationId,
          testType,
          suiteName: suiteNames[testType] ?? "Benchmark de Laboratorio",
          assistantId: options?.assistantId ?? null,
          status: initialStatus,
        })
        .returning();
      runId = inserted[0]!.id;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new RunConflictError("Ya hay una corrida en curso");
      }
      throw err;
    }

    await db.insert(schema.agentTestCase).values(
      eligibleConversations.map((c) => ({
        id: newId("testCase"),
        organizationId,
        runId,
        persona: c.contactName || c.contactPhone || `Cliente ${c.id.slice(0, 8)}`,
        conversationId: c.id,
        status: "pending" as const,
      }))
    );

    const suiteTitle = suiteNames[testType] ?? "Benchmark de Laboratorio";

    if (shouldQueue) {
      const queuePosition = await getQueuePosition(runId);
      publishProgress(organizationId, runId, "queued", 0, eligibleConversations.length, undefined, {
        testType,
        suiteName: suiteTitle,
      });
      return { runId, status: "queued", queuePosition };
    }

    void executeLiveAudit(
      runId,
      organizationId,
      eligibleConversations.map((c) => c.id),
      options?.assistantId,
      testType,
      suiteTitle
    ).catch(async (err) => {
      console.error("[lab] auditoría falló:", err);
      await failRun(runId, organizationId, String(err), eligibleConversations.length, { testType, suiteName: suiteTitle });
    });

    return { runId, status: "running" };
  }

  // MODO SIMULACIÓN: Sandbox general, Agenda o Guardrails
  const personas = await getLabPersonasForOrg(
    organizationId,
    testType as "sandbox" | "agenda_flow" | "guardrails",
    options?.assistantId
  );

  if (personas.length === 0) {
    throw new NoConfiguredScenariosError(
      "No hay preguntas configuradas para esta prueba. Configura o genera tus preguntas con IA antes de evaluar."
    );
  }

  try {
    const inserted = await db
      .insert(schema.agentTestRun)
      .values({
        id: newId("testRun"),
        organizationId,
        testType,
        suiteName: suiteNames[testType] ?? "Benchmark de Laboratorio",
        assistantId: options?.assistantId ?? null,
        status: initialStatus,
      })
      .returning();
    runId = inserted[0]!.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new RunConflictError("Ya hay una corrida en curso");
    }
    throw err;
  }

  await db.insert(schema.agentTestCase).values(
    personas.map((p) => ({
      id: newId("testCase"),
      organizationId,
      runId,
      persona: p.key,
      status: "pending" as const,
    }))
  );

  const suiteTitle = suiteNames[testType] ?? "Benchmark de Laboratorio";

  if (shouldQueue) {
    const queuePosition = await getQueuePosition(runId);
    publishProgress(organizationId, runId, "queued", 0, personas.length, undefined, {
      testType,
      suiteName: suiteTitle,
    });
    return { runId, status: "queued", queuePosition };
  }

  // Fire-and-forget in-process: el POST regresa ya; el progreso va por SSE.
  void executeRun(
    runId,
    organizationId,
    personas,
    options?.assistantId,
    testType,
    suiteTitle
  ).catch(async (err) => {
    console.error("[lab] corrida falló:", err);
    await failRun(runId, organizationId, String(err), personas.length, { testType, suiteName: suiteTitle });
  });

  return { runId, status: "running" };
}

async function executeRun(
  runId: string,
  organizationId: string,
  personas: Persona[],
  assistantId?: string,
  testType?: string,
  suiteName?: string
): Promise<void> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("timeout de 10 minutos superado")),
      RUN_TIMEOUT_MS
    )
  );
  try {
    await Promise.race([
      runAllCases(runId, organizationId, personas, assistantId, testType, suiteName),
      timeout,
    ]);
  } catch (err) {
    await failRun(runId, organizationId, String(err), personas.length, { testType, suiteName });
  }
}

async function runAllCases(
  runId: string,
  organizationId: string,
  personas: Persona[],
  assistantId?: string,
  testType?: string,
  suiteName?: string
): Promise<void> {
  const db = getDb();
  const cases = await db
    .select()
    .from(schema.agentTestCase)
    .where(eq(schema.agentTestCase.runId, runId))
    .orderBy(asc(schema.agentTestCase.createdAt));

  // Cargar el perfil del asistente especificado o el predeterminado de la org
  let profile: typeof schema.agentProfile.$inferSelect | null = null;
  if (assistantId) {
    const profileRows = await db
      .select()
      .from(schema.agentProfile)
      .where(
        and(
          eq(schema.agentProfile.organizationId, organizationId),
          eq(schema.agentProfile.id, assistantId)
        )
      )
      .limit(1);
    profile = profileRows[0] ?? null;
  }
  if (!profile) {
    const profileRows = await db
      .select()
      .from(schema.agentProfile)
      .where(
        and(
          eq(schema.agentProfile.organizationId, organizationId),
          eq(schema.agentProfile.type, "conversational")
        )
      )
      .orderBy(desc(schema.agentProfile.isDefault), desc(schema.agentProfile.createdAt))
      .limit(1);
    profile = profileRows[0] ?? null;
  }

  // Filtrar base de conocimiento asignada a este asistente (o huérfana de la org)
  const kbEntries = await db
    .select()
    .from(schema.kbEntry)
    .where(
      and(
        eq(schema.kbEntry.organizationId, organizationId),
        profile
          ? or(
              eq(schema.kbEntry.assistantId, profile.id),
              isNull(schema.kbEntry.assistantId)
            )
          : sql`true`
      )
    );
  const kbText = renderKb(kbEntries);

  const behaviorText = profile
    ? [
        `Nombre: ${profile.name}`,
        profile.tone ? `Tono: ${profile.tone}` : null,
        profile.instructions ? `Instrucciones: ${profile.instructions}` : null,
        profile.escalationRules ? `Escalado: ${profile.escalationRules}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  let done = 0;
  const total = cases.length;
  publishProgress(organizationId, runId, "running", done, total, undefined, {
    testType,
    suiteName,
  });

  const CONCURRENCY_LIMIT = 2;

  async function processCase(testCase: (typeof cases)[number]) {
    const persona =
      personas.find((p) => p.key === testCase.persona) ??
      PERSONAS.find((p) => p.key === testCase.persona);
    if (!persona) return;

    // 1. Marcar inmediatamente running y notificar a la UI
    await db
      .update(schema.agentTestCase)
      .set({ status: "running" })
      .where(eq(schema.agentTestCase.id, testCase.id));

    publishProgress(organizationId, runId, "running", done, total, undefined, {
      testType,
      suiteName,
    });

    // 2. Ejecutar conversación turno a turno
    const { transcript, conversationId } = await runConversation(
      organizationId,
      persona,
      profile?.id ?? assistantId
    );

    // 3. Evaluar con Juez de IA
    const outcome = await judgeCase({
      personaKey: persona.key,
      transcript,
      kbText,
      behaviorText,
      organizationId,
    });

    // 4. Guardar resultados
    await db
      .update(schema.agentTestCase)
      .set({
        conversationId,
        transcript,
        status: outcome.status,
        veredicto: outcome.status === "done" ? outcome.verdict.veredicto : null,
        hallazgos: outcome.status === "done" ? outcome.verdict.hallazgos : null,
      })
      .where(eq(schema.agentTestCase.id, testCase.id));

    done += 1;
    publishProgress(organizationId, runId, "running", done, total, undefined, {
      testType,
      suiteName,
    });
  }

  // Ejecutar personajes en lotes controlados de 2 en 2
  for (let i = 0; i < cases.length; i += CONCURRENCY_LIMIT) {
    const batch = cases.slice(i, i + CONCURRENCY_LIMIT);
    await Promise.all(batch.map((c) => processCase(c)));
  }

  const finalCases = await db
    .select({
      status: schema.agentTestCase.status,
      veredicto: schema.agentTestCase.veredicto,
    })
    .from(schema.agentTestCase)
    .where(eq(schema.agentTestCase.runId, runId));
  const score = computeScore(finalCases);

  await getDb()
    .update(schema.agentTestRun)
    .set({ status: "done", score, finishedAt: new Date() })
    .where(eq(schema.agentTestRun.id, runId));
  publishProgress(organizationId, runId, "done", done, total, score, {
    testType,
    suiteName,
  });

  void processNextQueuedRun().catch((err) =>
    console.error("[lab] error despachando siguiente en cola:", err)
  );
}

/**
 * Ejecuta la auditoría en lote sobre conversaciones reales ya existentes.
 */
async function executeLiveAudit(
  runId: string,
  organizationId: string,
  conversationIds: string[],
  assistantId?: string,
  testType?: string,
  suiteName?: string
): Promise<void> {
  const db = getDb();

  let profile: typeof schema.agentProfile.$inferSelect | null = null;
  if (assistantId) {
    const profileRows = await db
      .select()
      .from(schema.agentProfile)
      .where(
        and(
          eq(schema.agentProfile.organizationId, organizationId),
          eq(schema.agentProfile.id, assistantId)
        )
      )
      .limit(1);
    profile = profileRows[0] ?? null;
  }
  if (!profile) {
    const profileRows = await db
      .select()
      .from(schema.agentProfile)
      .where(
        and(
          eq(schema.agentProfile.organizationId, organizationId),
          eq(schema.agentProfile.type, "conversational")
        )
      )
      .orderBy(desc(schema.agentProfile.isDefault), desc(schema.agentProfile.createdAt))
      .limit(1);
    profile = profileRows[0] ?? null;
  }

  const kbEntries = await db
    .select()
    .from(schema.kbEntry)
    .where(
      and(
        eq(schema.kbEntry.organizationId, organizationId),
        profile
          ? or(
              eq(schema.kbEntry.assistantId, profile.id),
              isNull(schema.kbEntry.assistantId)
            )
          : sql`true`
      )
    );
  const kbText = renderKb(kbEntries);

  const behaviorText = profile
    ? [
        `Nombre: ${profile.name}`,
        profile.tone ? `Tono: ${profile.tone}` : null,
        profile.instructions ? `Instrucciones: ${profile.instructions}` : null,
        profile.escalationRules ? `Escalado: ${profile.escalationRules}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const cases = await db
    .select()
    .from(schema.agentTestCase)
    .where(eq(schema.agentTestCase.runId, runId))
    .orderBy(asc(schema.agentTestCase.createdAt));

  let done = 0;
  const total = cases.length;
  publishProgress(organizationId, runId, "running", done, total, undefined, {
    testType,
    suiteName,
  });

  const CONCURRENCY_LIMIT = 2;

  async function processAuditCase(testCase: (typeof cases)[number]) {
    if (!testCase.conversationId) return;

    await db
      .update(schema.agentTestCase)
      .set({ status: "running" })
      .where(eq(schema.agentTestCase.id, testCase.id));

    publishProgress(organizationId, runId, "running", done, total, undefined, {
      testType,
      suiteName,
    });

    // Cargar mensajes de la conversación real
    const messages = await db
      .select()
      .from(schema.message)
      .where(eq(schema.message.conversationId, testCase.conversationId))
      .orderBy(asc(schema.message.createdAt));

    const transcript = messages
      .filter((m) => m.text)
      .map((m) => ({
        role: m.direction === "in" ? ("cliente" as const) : ("agente" as const),
        text: m.text!,
      }));

    const outcome = await judgeCase({
      personaKey: testCase.persona,
      transcript,
      kbText,
      behaviorText,
      organizationId,
    });

    await db
      .update(schema.agentTestCase)
      .set({
        transcript,
        status: outcome.status,
        veredicto: outcome.status === "done" ? outcome.verdict.veredicto : null,
        hallazgos: outcome.status === "done" ? outcome.verdict.hallazgos : null,
      })
      .where(eq(schema.agentTestCase.id, testCase.id));

    // Sellar la conversación para idempotencia en futuras auditorías
    await db
      .update(schema.conversation)
      .set({ lastJudgedAt: new Date() })
      .where(eq(schema.conversation.id, testCase.conversationId));

    done += 1;
    publishProgress(organizationId, runId, "running", done, total, undefined, {
      testType,
      suiteName,
    });
  }

  // Ejecutar auditoría en lotes controlados de 2 en 2
  for (let i = 0; i < cases.length; i += CONCURRENCY_LIMIT) {
    const batch = cases.slice(i, i + CONCURRENCY_LIMIT);
    await Promise.all(batch.map((c) => processAuditCase(c)));
  }

  const finalCases = await db
    .select({
      status: schema.agentTestCase.status,
      veredicto: schema.agentTestCase.veredicto,
    })
    .from(schema.agentTestCase)
    .where(eq(schema.agentTestCase.runId, runId));
  const score = computeScore(finalCases);

  await db
    .update(schema.agentTestRun)
    .set({ status: "done", score, finishedAt: new Date() })
    .where(eq(schema.agentTestRun.id, runId));
  publishProgress(organizationId, runId, "done", done, total, score, {
    testType,
    suiteName,
  });

  void processNextQueuedRun().catch((err) =>
    console.error("[lab] error despachando siguiente en cola tras auditoría:", err)
  );
}

/** Conversa el guion completo contra el agente real; corta al primer handoff. */
async function runConversation(
  organizationId: string,
  persona: Persona,
  assistantId?: string
): Promise<{
  transcript: { role: "cliente" | "agente"; text: string }[];
  conversationId: string;
}> {
  const db = getDb();

  // Contacto sintético ARCHIVADO (no aparece en la lista ni genera leads).
  const contactId = await upsertTestContact(organizationId, persona);

  const convId = newId("conversation");
  await db.insert(schema.conversation).values({
    id: convId,
    organizationId,
    contactId,
    isTest: true,
    aiEnabled: true,
    assistantId: assistantId ?? null,
  });

  for (const line of persona.script) {
    const now = new Date();
    await db.insert(schema.message).values({
      id: newId("message"),
      organizationId,
      conversationId: convId,
      direction: "in",
      type: "text",
      text: line,
      status: "delivered",
      waTimestamp: now,
    });
    await db
      .update(schema.conversation)
      .set({ lastInboundAt: now, lastMessageAt: now, updatedAt: now })
      .where(eq(schema.conversation.id, convId));

    // Turno REAL del agente, secuencial y sin debounce (FR-030).
    await runAgentTurn(convId);

    const convRows = await db
      .select({ handoffAt: schema.conversation.handoffAt })
      .from(schema.conversation)
      .where(eq(schema.conversation.id, convId))
      .limit(1);
    if (convRows[0]?.handoffAt) break; // primer handoff → fin del guion
  }

  const messages = await db
    .select()
    .from(schema.message)
    .where(eq(schema.message.conversationId, convId))
    .orderBy(asc(schema.message.createdAt));

  return {
    conversationId: convId,
    transcript: messages
      .filter((m) => m.text)
      .map((m) => ({
        role: m.direction === "in" ? ("cliente" as const) : ("agente" as const),
        text: m.text!,
      })),
  };
}

async function upsertTestContact(
  organizationId: string,
  persona: Persona
): Promise<string> {
  const db = getDb();
  const inserted = await db
    .insert(schema.contact)
    .values({
      id: newId("contact"),
      organizationId,
      phone: persona.phone,
      waIdentity: persona.phone,
      name: persona.contactName,
      archivedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [
        schema.contact.organizationId,
        schema.contact.channel,
        schema.contact.waIdentity,
      ],
    })
    .returning();
  if (inserted[0]) return inserted[0].id;
  const rows = await db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(
      and(
        eq(schema.contact.organizationId, organizationId),
        eq(schema.contact.phone, persona.phone)
      )
    )
    .limit(1);
  return rows[0]!.id;
}

async function failRun(
  runId: string,
  organizationId: string,
  error: string,
  totalCases: number = 6,
  extra?: { testType?: string; suiteName?: string }
): Promise<void> {
  const db = getDb();
  await db
    .update(schema.agentTestRun)
    .set({ status: "failed", error, finishedAt: new Date() })
    .where(eq(schema.agentTestRun.id, runId));
  publishProgress(organizationId, runId, "failed", 0, totalCases, undefined, extra);

  void processNextQueuedRun().catch((err) =>
    console.error("[lab] error despachando siguiente en cola tras fallo:", err)
  );
}

export async function processNextQueuedRun(): Promise<void> {
  const db = getDb();

  // 1. Verificar si hay alguna corrida corriendo actualmente en el servidor
  const running = await db
    .select({ id: schema.agentTestRun.id })
    .from(schema.agentTestRun)
    .where(eq(schema.agentTestRun.status, "running"))
    .limit(1);

  if (running.length > 0) return; // Servidor ocupado con otra corrida

  // 2. Buscar la corrida en cola más antigua
  const queuedRuns = await db
    .select()
    .from(schema.agentTestRun)
    .where(eq(schema.agentTestRun.status, "queued"))
    .orderBy(asc(schema.agentTestRun.startedAt))
    .limit(1);

  const nextRun = queuedRuns[0];
  if (!nextRun) return; // Cola vacía

  // 3. Promover a running
  await db
    .update(schema.agentTestRun)
    .set({ status: "running" })
    .where(eq(schema.agentTestRun.id, nextRun.id));

  const suiteType = (nextRun.testType ?? "sandbox") as
    | "sandbox"
    | "live_audit"
    | "agenda_flow"
    | "guardrails";
  const suiteTitle = nextRun.suiteName ?? "Benchmark de Laboratorio";

  if (suiteType === "live_audit") {
    const testCases = await db
      .select({ conversationId: schema.agentTestCase.conversationId })
      .from(schema.agentTestCase)
      .where(eq(schema.agentTestCase.runId, nextRun.id));

    const conversationIds = testCases
      .map((c) => c.conversationId)
      .filter(Boolean) as string[];

    void executeLiveAudit(
      nextRun.id,
      nextRun.organizationId,
      conversationIds,
      nextRun.assistantId ?? undefined,
      suiteType,
      suiteTitle
    ).catch(async (err) => {
      console.error("[lab] error en despachador de cola (live_audit):", err);
      await failRun(
        nextRun.id,
        nextRun.organizationId,
        String(err),
        conversationIds.length,
        {
          testType: suiteType,
          suiteName: suiteTitle,
        }
      );
    });
  } else {
    const personas = await getLabPersonasForOrg(
      nextRun.organizationId,
      suiteType,
      nextRun.assistantId ?? undefined
    );

    void executeRun(
      nextRun.id,
      nextRun.organizationId,
      personas,
      nextRun.assistantId ?? undefined,
      suiteType,
      suiteTitle
    ).catch(async (err) => {
      console.error("[lab] error en despachador de cola (sintético):", err);
      await failRun(
        nextRun.id,
        nextRun.organizationId,
        String(err),
        personas.length,
        {
          testType: suiteType,
          suiteName: suiteTitle,
        }
      );
    });
  }
}

function publishProgress(
  organizationId: string,
  runId: string,
  status: string,
  done: number,
  total: number,
  score?: number | null,
  extra?: { testType?: string; suiteName?: string }
): void {
  publish(organizationId, {
    type: "lab.run",
    data: {
      runId,
      status,
      progress: { done, total },
      score,
      testType: extra?.testType,
      suiteName: extra?.suiteName,
    },
  });
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === "23505" || e.cause?.code === "23505";
}
