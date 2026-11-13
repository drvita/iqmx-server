import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __iqmxChecadorSql?: ReturnType<typeof postgres>;
};

function createClient() {
  const env = getEnv();
  return postgres(env.DATABASE_URL, {
    max: 10,
    onnotice: () => {},
    connection: {
      search_path: "checador, public",
      timezone: "UTC",
    },
  });
}

export function getSql() {
  if (!globalForDb.__iqmxChecadorSql) {
    globalForDb.__iqmxChecadorSql = createClient();
  }
  return globalForDb.__iqmxChecadorSql;
}

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!cachedDb) {
    cachedDb = drizzle(getSql(), { schema });
  }
  return cachedDb;
}

export { schema };
