/**
 * Migraciones al ARRANQUE del contenedor (no en pre-deploy: el pre-deploy de
 * plataformas como Coolify corre en el contenedor viejo). Se bundlea con
 * esbuild dentro de la imagen y corre antes de `node server.js`.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL no está definida");
  process.exit(1);
}

import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const localDrizzle = path.join(here, "drizzle");
const parentDrizzle = path.join(here, "..", "drizzle");
const migrationsFolder =
  process.env.MIGRATIONS_DIR ?? (fs.existsSync(localDrizzle) ? localDrizzle : parentDrizzle);

const maxAttempts = 15;
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const sql = postgres(url, {
    max: 1,
    onnotice: () => {},
    connection: {
      search_path: "crm, public",
    },
  });
  try {
    // Garantiza que el schema 'crm' exista automáticamente en cualquier entorno o despliegue
    await sql`CREATE SCHEMA IF NOT EXISTS crm;`;
    await migrate(drizzle(sql), { migrationsFolder, migrationsSchema: "crm" });
    console.log("[migrate] schema crm verificado y migraciones aplicadas");
    await sql.end();
    process.exit(0);
  } catch (err) {
    await sql.end().catch(() => {});
    if (attempt === maxAttempts) {
      console.error("[migrate] falló tras varios intentos:", err);
      process.exit(1);
    }
    console.log(
      `[migrate] BD no lista (intento ${attempt}/${maxAttempts}), reintento en 2s…`
    );
    await new Promise((r) => setTimeout(r, 2000));
  }
}
