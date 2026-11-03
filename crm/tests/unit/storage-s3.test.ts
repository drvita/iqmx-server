import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  creds: null as unknown,
}));

vi.mock("@/server/storage/credentials", () => ({
  getBucketConfigForOrg: async () => dbState.creds,
}));

vi.mock("@/lib/storage/objetos", () => ({
  ponerObjeto: vi.fn(),
  obtenerObjeto: vi.fn(),
  borrarObjeto: vi.fn(),
}));

beforeAll(() => {
  process.env.APP_BASE_URL = "http://localhost:3000";
  process.env.DATABASE_URL = "postgresql://t:t@localhost:5432/t";
  process.env.BETTER_AUTH_SECRET = "secret-de-test-suficiente";
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  process.env.META_WEBHOOK_VERIFY_TOKEN = "verify-test";
  process.env.MEDIA_DIR = "/tmp/media-test-dir";
});

describe("almacenamiento en S3 con fallback a disco", () => {
  beforeEach(() => {
    dbState.creds = null;
    vi.clearAllMocks();
  });

  it("sin credenciales S3 escribe en disco local", async () => {
    const { guardarMedio } = await import("@/lib/storage/medios");
    const res = await guardarMedio("org_1", "asset_1", Buffer.from("hello"));
    expect(res.store).toBe("disco");
    expect(res.ruta).toBe("org_1/asset_1");
  });

  it("con credenciales S3 escribe en bucket", async () => {
    dbState.creds = {
      endpoint: "https://s3.example.com",
      bucket: "my-bucket",
      region: "us-east-1",
      accessKeyId: "key",
      secretAccessKey: "secret",
    };
    const { guardarMedio } = await import("@/lib/storage/medios");
    const res = await guardarMedio("org_1", "asset_2", Buffer.from("hello"));
    expect(res.store).toBe("bucket");
  });

  it("si falla el bucket al escribir, hace fallback a disco sin lanzar error", async () => {
    dbState.creds = {
      endpoint: "https://s3.example.com",
      bucket: "my-bucket",
      region: "us-east-1",
      accessKeyId: "key",
      secretAccessKey: "secret",
    };
    const { ponerObjeto } = await import("@/lib/storage/objetos");
    vi.mocked(ponerObjeto).mockRejectedValueOnce(new Error("Network timeout"));

    const { guardarMedio } = await import("@/lib/storage/medios");
    const res = await guardarMedio("org_1", "asset_3", Buffer.from("hello"));
    expect(res.store).toBe("disco");
  });
});
