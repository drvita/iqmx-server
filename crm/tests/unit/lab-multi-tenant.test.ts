import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgendaDisabledForOrgError,
  AssistantHasNoLinesError,
  getLabPersonasForOrg,
  InsufficientConversationsError,
  NoAuditableConversationsError,
  NoConfiguredScenariosError,
  startRun,
} from "@/server/lab/runner";

// Mocks de base de datos
const selectQueue: unknown[][] = [];
const insertedRows: { table: unknown; values: unknown }[] = [];
const updatedRows: { table: unknown; values: unknown }[] = [];

function thenableChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "innerJoin", "where", "orderBy", "limit"]) {
    chain[m] = () => chain;
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    Promise.resolve(rows).then(resolve);
  return chain;
}

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => thenableChain(selectQueue.shift() ?? []),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        insertedRows.push({ table, values });
        const chain = {
          onConflictDoNothing: () => chain,
          onConflictDoUpdate: () => chain,
          returning: () => Promise.resolve(Array.isArray(values) ? values : [values]),
          then: (resolve: (v: unknown) => void) =>
            Promise.resolve(Array.isArray(values) ? values : [values]).then(resolve),
        };
        return chain;
      },
    }),
    update: (table: unknown) => ({
      set: (values: unknown) => {
        updatedRows.push({ table, values });
        return {
          where: () => {
            const chain = {
              returning: () => Promise.resolve([{}]),
              then: (resolve: (v: unknown) => void) => Promise.resolve([{}]).then(resolve),
            };
            return chain;
          },
        };
      },
    }),
  }),
  schema: new Proxy(
    {},
    {
      get: (_t, tableName) =>
        new Proxy(
          {},
          { get: (_t2, col) => `${String(tableName)}.${String(col)}` }
        ),
    }
  ),
}));

vi.mock("@/server/events/bus", () => ({
  publish: vi.fn(),
}));

vi.mock("@/server/agenda/flag", () => ({
  isAgendaEnabled: vi.fn().mockImplementation((orgId?: string) => Promise.resolve(orgId === "org_with_agenda")),
}));

describe("Laboratorio Multi-Tenant & Auditoría en Vivo", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    insertedRows.length = 0;
    updatedRows.length = 0;
  });

  describe("getLabPersonasForOrg", () => {
    it("retorna arreglo vacío si la organización no tiene escenarios configurados en BD", async () => {
      selectQueue.push([]); // select vacío en lab_scenario
      const result = await getLabPersonasForOrg("org_empty");
      expect(result).toEqual([]);
    });

    it("retorna los escenarios personalizados si existen en BD", async () => {
      const customRows = [
        {
          key: "comprador_decidido",
          label: "Comprador de Pulpa de Mango",
          description: "Pide pulpas al mayoreo",
          syntheticPhone: "5210000000001",
          contactName: "[Prueba] Icefrut Comprador",
          script: ["Hola", "¿Tienen pulpa de mango 5L?", "¿Cuánto cuesta?"],
        },
      ];
      selectQueue.push(customRows);
      const result = await getLabPersonasForOrg("org_icefrut");
      expect(result).toHaveLength(1);
      expect(result[0]!.label).toBe("Comprador de Pulpa de Mango");
      expect(result[0]!.script).toEqual(["Hola", "¿Tienen pulpa de mango 5L?", "¿Cuánto cuesta?"]);
    });
  });

  describe("startRun con modo live_audit", () => {
    it("lanza AssistantHasNoLinesError si el asistente no tiene líneas asignadas", async () => {
      selectQueue.push([]); // 1. existingOrgRun -> []
      selectQueue.push([]); // 2. globalRunning -> []
      selectQueue.push([]); // 3. metaLines -> [] (sin líneas)

      await expect(
        startRun("org_1", {
          testType: "live_audit",
          assistantId: "agp_no_lines",
          sampleSize: 10,
        })
      ).rejects.toThrow(AssistantHasNoLinesError);
    });

    it("lanza NoAuditableConversationsError si tiene líneas pero 0 conversaciones", async () => {
      selectQueue.push([]); // 1. existingOrgRun -> []
      selectQueue.push([]); // 2. globalRunning -> []
      selectQueue.push([{ phoneNumberId: "phone_123" }]); // 3. metaLines
      selectQueue.push([]); // 4. eligibleConversations -> []

      await expect(
        startRun("org_1", {
          testType: "live_audit",
          assistantId: "agp_1",
          sampleSize: 10,
        })
      ).rejects.toThrow(NoAuditableConversationsError);
    });

    it("lanza InsufficientConversationsError si el asistente tiene menos de 10 conversaciones reales", async () => {
      selectQueue.push([]); // 1. existingOrgRun -> []
      selectQueue.push([]); // 2. globalRunning -> []
      selectQueue.push([{ phoneNumberId: "phone_123" }]); // 3. metaLines
      // 5 conversaciones (menos de 10)
      const fewConversations = Array.from({ length: 5 }, (_, i) => ({
        id: `cv_real_${i}`,
        contactId: `ct_${i}`,
        contactName: `Cliente ${i}`,
        contactPhone: `521550000000${i}`,
      }));
      selectQueue.push(fewConversations); // 4. eligibleConversations

      await expect(
        startRun("org_1", {
          testType: "live_audit",
          assistantId: "agp_1",
          sampleSize: 10,
        })
      ).rejects.toThrow(InsufficientConversationsError);
    });

    it("inicia la auditoría si encuentra al menos 10 conversaciones reales asociadas", async () => {
      selectQueue.push([]); // 1. existingOrgRun -> []
      selectQueue.push([]); // 2. globalRunning -> []
      selectQueue.push([{ phoneNumberId: "phone_123" }]); // 3. metaLines
      const twelveConversations = Array.from({ length: 12 }, (_, i) => ({
        id: `cv_real_${i}`,
        contactId: `ct_${i}`,
        contactName: `Cliente ${i}`,
        contactPhone: `521550000000${i}`,
      }));
      selectQueue.push(twelveConversations); // 4. eligibleConversations

      const result = await startRun("org_1", {
        testType: "live_audit",
        assistantId: "agp_1",
        sampleSize: 10,
      });
      expect(result.runId).toBeDefined();
      expect(result.status).toBe("running");

      const testRunInsert = insertedRows.find(
        (i) => (i.values as { testType?: string }).testType === "live_audit"
      );
      expect(testRunInsert).toBeDefined();

      const testCaseInsert = insertedRows.find(
        (i) =>
          Array.isArray(i.values) &&
          i.values.some((v) => v.conversationId === "cv_real_0")
      );
      expect(testCaseInsert).toBeDefined();
      expect((testCaseInsert!.values as unknown[]).length).toBe(10); // Muestra acotada a 10
    });

    it("encola el benchmark en estado 'queued' si otra organización está corriendo en el servidor", async () => {
      selectQueue.push([]); // 1. existingOrgRun -> []
      selectQueue.push([{ id: "run_active_org1" }]); // 2. globalRunning (servidor ocupado)
      selectQueue.push([{ phoneNumberId: "phone_123" }]); // 3. metaLines
      const tenConversations = Array.from({ length: 10 }, (_, i) => ({
        id: `cv_real_${i}`,
        contactId: `ct_${i}`,
        contactName: `Cliente ${i}`,
        contactPhone: `521550000000${i}`,
      }));
      selectQueue.push(tenConversations); // 4. eligibleConversations
      selectQueue.push([{ startedAt: new Date() }]); // 5. getQueuePosition target
      selectQueue.push([{ id: "run_q1" }]); // 6. getQueuePosition ahead

      const result = await startRun("org_2", {
        testType: "live_audit",
        assistantId: "agp_1",
        sampleSize: 10,
      });
      expect(result.runId).toBeDefined();
      expect(result.status).toBe("queued");
      expect(result.queuePosition).toBe(1);
    });
  });

  describe("startRun con modo sintético (sin preguntas configuradas)", () => {
    it("lanza NoConfiguredScenariosError sin iniciar la corrida si no hay preguntas", async () => {
      selectQueue.push([]); // 1. existingOrgRun -> []
      selectQueue.push([]); // 2. globalRunning -> []
      selectQueue.push([]); // 3. getLabPersonasForOrg -> []

      await expect(
        startRun("org_1", { testType: "sandbox" })
      ).rejects.toThrow(NoConfiguredScenariosError);
    });
  });

  describe("startRun con testType agenda_flow", () => {
    it("lanza AgendaDisabledForOrgError si la organización no tiene la agenda habilitada", async () => {
      await expect(
        startRun("org_without_agenda", { testType: "agenda_flow" })
      ).rejects.toThrow(AgendaDisabledForOrgError);
    });

    it("continúa el flujo si la organización tiene la agenda habilitada", async () => {
      selectQueue.push([]); // 1. existingOrgRun -> []
      selectQueue.push([]); // 2. globalRunning -> []
      selectQueue.push([]); // 3. getLabPersonasForOrg -> []

      // Como no tiene escenarios configurados, debe pasar la verificación de agenda y fallar por escenarios
      await expect(
        startRun("org_with_agenda", { testType: "agenda_flow" })
      ).rejects.toThrow(NoConfiguredScenariosError);
    });
  });
});
