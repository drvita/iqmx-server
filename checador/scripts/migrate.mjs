/**
 * Migraciones al ARRANQUE del contenedor (no en pre-deploy: el pre-deploy de
 * plataformas como Coolify corre en el contenedor viejo). Se bundlea con
 * esbuild dentro de la imagen y corre antes de `node server.js`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL no está definida");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const localDrizzle = path.join(here, "drizzle");
const parentDrizzle = path.join(here, "..", "drizzle");
const migrationsFolder =
  process.env.MIGRATIONS_DIR ??
  (fs.existsSync(localDrizzle) ? localDrizzle : parentDrizzle);

const BASE_ROLES = [
  {
    codigo: "ORG_ADMIN",
    descripcion: "Administrador general de la organización cliente",
  },
  {
    codigo: "RH_ASSISTANT",
    descripcion:
      "Asistente de Recursos Humanos (alta/edición de empleados y reportes)",
  },
  {
    codigo: "SUPERVISOR_SUCURSAL",
    descripcion: "Supervisor operativo asignado a sucursales específicas",
  },
  {
    codigo: "AUDITOR_NOMINA",
    descripcion:
      "Auditor de nómina con acceso de solo lectura a asistencias y reportes",
  },
];

const maxAttempts = 15;
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const sql = postgres(url, {
    max: 1,
    onnotice: () => {},
    connection: {
      search_path: "checador, public",
    },
  });
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
    await sql`CREATE SCHEMA IF NOT EXISTS checador;`;
    await migrate(drizzle(sql), {
      migrationsFolder,
      migrationsSchema: "checador",
    });

    for (const rol of BASE_ROLES) {
      await sql`
        INSERT INTO checador.roles (codigo, descripcion)
        VALUES (${rol.codigo}, ${rol.descripcion})
        ON CONFLICT (codigo) DO NOTHING;
      `;
    }

    console.log(
      "[migrate] schema checador verificado, migraciones aplicadas y roles sembrados"
    );
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
