import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const checadorSchema = pgSchema("checador");

export const organizaciones = checadorSchema.table(
  "organizaciones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalCustomerId: varchar("external_customer_id", { length: 100 })
      .notNull()
      .unique(),
    nombre: varchar("nombre", { length: 150 }).notNull(),
    razonSocial: varchar("razon_social", { length: 200 }),
    rfc: varchar("rfc", { length: 13 }),
    zonaHoraria: varchar("zona_horaria", { length: 60 })
      .notNull()
      .default("America/Mexico_City"),
    planCodigo: varchar("plan_codigo", { length: 40 })
      .notNull()
      .default("basico"),
    maxEmpleados: integer("max_empleados").notNull().default(15),
    maxDispositivos: integer("max_dispositivos").notNull().default(2),
    maxSucursales: integer("max_sucursales").notNull().default(1),
    cloudEvidencesEnabled: boolean("cloud_evidences_enabled")
      .notNull()
      .default(false),
    extraRolesEnabled: boolean("extra_roles_enabled").notNull().default(false),
    horasSemanalesMax: numeric("horas_semanales_max", {
      precision: 4,
      scale: 1,
    })
      .notNull()
      .default("48.0"),
    logoUrl: text("logo_url"),
    colorPrimario: varchar("color_primario", { length: 7 })
      .notNull()
      .default("#4f46e5"),
    colorSecundario: varchar("color_secundario", { length: 7 })
      .notNull()
      .default("#1e1b4b"),
    mensajeBienvenida: varchar("mensaje_bienvenida", { length: 150 }).default(
      "Bienvenido, registra tu asistencia"
    ),
    brandingUpdatedAt: timestamp("branding_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    pinAuditoriaHash: varchar("pin_auditoria_hash", { length: 128 }),
    estado: varchar("estado", { length: 20 }).notNull().default("activo"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "chk_organizaciones_estado",
      sql`${table.estado} IN ('activo', 'suspendido', 'cancelado', 'prueba')`
    ),
  ]
);

export const sucursales = checadorSchema.table(
  "sucursales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizaciones.id, { onDelete: "cascade" }),
    nombre: varchar("nombre", { length: 120 }).notNull(),
    direccion: text("direccion"),
    zonaHoraria: varchar("zona_horaria", { length: 60 }),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_sucursales_org").on(table.orgId)]
);

export const roles = checadorSchema.table("roles", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 40 }).notNull().unique(),
  descripcion: varchar("descripcion", { length: 150 }).notNull(),
});

export const usuarios = checadorSchema.table(
  "usuarios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizaciones.id, { onDelete: "cascade" }),
    rolId: integer("rol_id")
      .notNull()
      .references(() => roles.id),
    nombre: varchar("nombre", { length: 120 }).notNull(),
    email: varchar("email", { length: 180 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    activo: boolean("activo").notNull().default(true),
    ultimoLoginAt: timestamp("ultimo_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_usuarios_org").on(table.orgId)]
);

export const usuarioSucursales = checadorSchema.table(
  "usuario_sucursales",
  {
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.usuarioId, table.sucursalId] })]
);

export const horarios = checadorSchema.table(
  "horarios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizaciones.id, { onDelete: "cascade" }),
    nombre: varchar("nombre", { length: 100 }).notNull(),
    horaEntrada: time("hora_entrada").notNull(),
    horaSalida: time("hora_salida").notNull(),
    toleranciaMin: integer("tolerancia_min").notNull().default(10),
    minutosComida: integer("minutos_comida").notNull().default(60),
    diasLaborales: smallint("dias_laborales")
      .array()
      .notNull()
      .default(sql`'{1,2,3,4,5}'`),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_horarios_org").on(table.orgId)]
);

export const empleados = checadorSchema.table(
  "empleados",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizaciones.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id").references(() => sucursales.id, {
      onDelete: "set null",
    }),
    horarioId: uuid("horario_id").references(() => horarios.id, {
      onDelete: "set null",
    }),
    codigoInterno: varchar("codigo_interno", { length: 50 }),
    nombreCompleto: varchar("nombre_completo", { length: 150 }).notNull(),
    puesto: varchar("puesto", { length: 100 }),
    departamento: varchar("departamento", { length: 100 }),
    consentimientoBiometrico: boolean("consentimiento_biometrico")
      .notNull()
      .default(false),
    consentimientoAt: timestamp("consentimiento_at", { withTimezone: true }),
    activo: boolean("activo").notNull().default(true),
    syncVersion: bigint("sync_version", { mode: "number" })
      .notNull()
      .default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("uq_empleados_org_codigo").on(table.orgId, table.codigoInterno),
    index("idx_empleados_org_sync").on(table.orgId, table.updatedAt),
  ]
);

export const empleadoVectores = checadorSchema.table(
  "empleado_vectores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizaciones.id, { onDelete: "cascade" }),
    empleadoId: uuid("empleado_id")
      .notNull()
      .references(() => empleados.id, { onDelete: "cascade" }),
    modeloVersion: varchar("modelo_version", { length: 50 })
      .notNull()
      .default("buffalo_s_v1"),
    embedding: vector("embedding", { dimensions: 512 }).notNull(),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_vectores_empleado").on(table.empleadoId),
    index("idx_vectores_org_hnsw")
      .using("hnsw", table.embedding.op("vector_cosine_ops"))
      .with({ m: 16, ef_construction: 64 }),
  ]
);

export const dispositivos = checadorSchema.table(
  "dispositivos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizaciones.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id, { onDelete: "cascade" }),
    nombre: varchar("nombre", { length: 100 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).unique(),
    pairingCode: varchar("pairing_code", { length: 12 }),
    pairingExpiresAt: timestamp("pairing_expires_at", { withTimezone: true }),
    appVersion: varchar("app_version", { length: 30 }),
    modeloIaVersion: varchar("modelo_ia_version", { length: 50 }),
    plataforma: varchar("plataforma", { length: 40 }),
    ultimoSyncAt: timestamp("ultimo_sync_at", { withTimezone: true }),
    ultimoHeartbeatAt: timestamp("ultimo_heartbeat_at", { withTimezone: true }),
    activo: boolean("activo").notNull().default(true),
    revocadoAt: timestamp("revocado_at", { withTimezone: true }),
    motivoRevocacion: varchar("motivo_revocacion", { length: 150 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_dispositivos_org").on(table.orgId)]
);

export const checadas = checadorSchema.table(
  "checadas",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizaciones.id, { onDelete: "cascade" }),
    sucursalId: uuid("sucursal_id")
      .notNull()
      .references(() => sucursales.id),
    dispositivoId: uuid("dispositivo_id")
      .notNull()
      .references(() => dispositivos.id),
    empleadoId: uuid("empleado_id").references(() => empleados.id, {
      onDelete: "set null",
    }),
    tipo: varchar("tipo", { length: 20 }).notNull(),
    estado: varchar("estado", { length: 25 }).notNull().default("valido"),
    timestampLocal: timestamp("timestamp_local", {
      withTimezone: true,
    }).notNull(),
    timestampServidor: timestamp("timestamp_servidor", { withTimezone: true })
      .notNull()
      .defaultNow(),
    desfaseRelojSeg: integer("desfase_reloj_seg"),
    livenessScore: real("liveness_score"),
    matchConfidence: real("match_confidence"),
    fotoEvidenciaKey: text("foto_evidencia_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_checadas_org_fecha").on(table.orgId, table.timestampLocal),
    index("idx_checadas_empleado_fecha").on(
      table.empleadoId,
      table.timestampLocal
    ),
    check(
      "chk_checadas_tipo",
      sql`${table.tipo} IN ('entrada', 'salida', 'inicio_comida', 'fin_comida')`
    ),
    check(
      "chk_checadas_estado",
      sql`${table.estado} IN ('valido', 'rechazado_spoof', 'rechazado_desconocido')`
    ),
  ]
);

export const auditLogs = checadorSchema.table(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orgId: uuid("org_id").references(() => organizaciones.id, {
      onDelete: "set null",
    }),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    accion: varchar("accion", { length: 80 }).notNull(),
    entidad: varchar("entidad", { length: 50 }).notNull(),
    entidadId: uuid("entidad_id"),
    detalle: jsonb("detalle"),
    ipOrigen: inet("ip_origen"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_audit_org_fecha").on(table.orgId, table.createdAt)]
);
