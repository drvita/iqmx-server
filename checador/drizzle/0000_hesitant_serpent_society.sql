CREATE SCHEMA IF NOT EXISTS "checador";
--> statement-breakpoint
CREATE TABLE "checador"."audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" uuid,
	"usuario_id" uuid,
	"accion" varchar(80) NOT NULL,
	"entidad" varchar(50) NOT NULL,
	"entidad_id" uuid,
	"detalle" jsonb,
	"ip_origen" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checador"."checadas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"dispositivo_id" uuid NOT NULL,
	"empleado_id" uuid,
	"tipo" varchar(20) NOT NULL,
	"estado" varchar(25) DEFAULT 'valido' NOT NULL,
	"timestamp_local" timestamp with time zone NOT NULL,
	"timestamp_servidor" timestamp with time zone DEFAULT now() NOT NULL,
	"desfase_reloj_seg" integer,
	"liveness_score" real,
	"match_confidence" real,
	"foto_evidencia_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_checadas_tipo" CHECK ("checador"."checadas"."tipo" IN ('entrada', 'salida', 'inicio_comida', 'fin_comida')),
	CONSTRAINT "chk_checadas_estado" CHECK ("checador"."checadas"."estado" IN ('valido', 'rechazado_spoof', 'rechazado_desconocido'))
);
--> statement-breakpoint
CREATE TABLE "checador"."dispositivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"token_hash" varchar(64),
	"pairing_code" varchar(12),
	"pairing_expires_at" timestamp with time zone,
	"app_version" varchar(30),
	"modelo_ia_version" varchar(50),
	"plataforma" varchar(40),
	"ultimo_sync_at" timestamp with time zone,
	"ultimo_heartbeat_at" timestamp with time zone,
	"activo" boolean DEFAULT true NOT NULL,
	"revocado_at" timestamp with time zone,
	"motivo_revocacion" varchar(150),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispositivos_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "checador"."empleado_vectores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"empleado_id" uuid NOT NULL,
	"modelo_version" varchar(50) DEFAULT 'buffalo_s_v1' NOT NULL,
	"embedding" vector(512) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checador"."empleados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"sucursal_id" uuid,
	"horario_id" uuid,
	"codigo_interno" varchar(50),
	"nombre_completo" varchar(150) NOT NULL,
	"puesto" varchar(100),
	"departamento" varchar(100),
	"consentimiento_biometrico" boolean DEFAULT false NOT NULL,
	"consentimiento_at" timestamp with time zone,
	"activo" boolean DEFAULT true NOT NULL,
	"sync_version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_empleados_org_codigo" UNIQUE("org_id","codigo_interno")
);
--> statement-breakpoint
CREATE TABLE "checador"."horarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"hora_entrada" time NOT NULL,
	"hora_salida" time NOT NULL,
	"tolerancia_min" integer DEFAULT 10 NOT NULL,
	"minutos_comida" integer DEFAULT 60 NOT NULL,
	"dias_laborales" smallint[] DEFAULT '{1,2,3,4,5}' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checador"."organizaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_customer_id" varchar(100) NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"razon_social" varchar(200),
	"rfc" varchar(13),
	"zona_horaria" varchar(60) DEFAULT 'America/Mexico_City' NOT NULL,
	"plan_codigo" varchar(40) DEFAULT 'basico' NOT NULL,
	"max_empleados" integer DEFAULT 15 NOT NULL,
	"max_dispositivos" integer DEFAULT 2 NOT NULL,
	"max_sucursales" integer DEFAULT 1 NOT NULL,
	"cloud_evidences_enabled" boolean DEFAULT false NOT NULL,
	"extra_roles_enabled" boolean DEFAULT false NOT NULL,
	"horas_semanales_max" numeric(4, 1) DEFAULT '48.0' NOT NULL,
	"logo_url" text,
	"color_primario" varchar(7) DEFAULT '#4f46e5' NOT NULL,
	"color_secundario" varchar(7) DEFAULT '#1e1b4b' NOT NULL,
	"mensaje_bienvenida" varchar(150) DEFAULT 'Bienvenido, registra tu asistencia',
	"branding_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"estado" varchar(20) DEFAULT 'activo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizaciones_external_customer_id_unique" UNIQUE("external_customer_id"),
	CONSTRAINT "chk_organizaciones_estado" CHECK ("checador"."organizaciones"."estado" IN ('activo', 'suspendido', 'cancelado', 'prueba'))
);
--> statement-breakpoint
CREATE TABLE "checador"."roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(40) NOT NULL,
	"descripcion" varchar(150) NOT NULL,
	CONSTRAINT "roles_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "checador"."sucursales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"direccion" text,
	"zona_horaria" varchar(60),
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checador"."usuario_sucursales" (
	"usuario_id" uuid NOT NULL,
	"sucursal_id" uuid NOT NULL,
	CONSTRAINT "usuario_sucursales_usuario_id_sucursal_id_pk" PRIMARY KEY("usuario_id","sucursal_id")
);
--> statement-breakpoint
CREATE TABLE "checador"."usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"rol_id" integer NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"email" varchar(180) NOT NULL,
	"password_hash" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"ultimo_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "checador"."audit_logs" ADD CONSTRAINT "audit_logs_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "checador"."organizaciones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."audit_logs" ADD CONSTRAINT "audit_logs_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "checador"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD CONSTRAINT "checadas_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "checador"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD CONSTRAINT "checadas_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "checador"."sucursales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD CONSTRAINT "checadas_dispositivo_id_dispositivos_id_fk" FOREIGN KEY ("dispositivo_id") REFERENCES "checador"."dispositivos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD CONSTRAINT "checadas_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "checador"."empleados"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."dispositivos" ADD CONSTRAINT "dispositivos_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "checador"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."dispositivos" ADD CONSTRAINT "dispositivos_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "checador"."sucursales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."empleado_vectores" ADD CONSTRAINT "empleado_vectores_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "checador"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."empleado_vectores" ADD CONSTRAINT "empleado_vectores_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "checador"."empleados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."empleados" ADD CONSTRAINT "empleados_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "checador"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."empleados" ADD CONSTRAINT "empleados_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "checador"."sucursales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."empleados" ADD CONSTRAINT "empleados_horario_id_horarios_id_fk" FOREIGN KEY ("horario_id") REFERENCES "checador"."horarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."horarios" ADD CONSTRAINT "horarios_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "checador"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."sucursales" ADD CONSTRAINT "sucursales_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "checador"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."usuario_sucursales" ADD CONSTRAINT "usuario_sucursales_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "checador"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."usuario_sucursales" ADD CONSTRAINT "usuario_sucursales_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "checador"."sucursales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."usuarios" ADD CONSTRAINT "usuarios_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "checador"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."usuarios" ADD CONSTRAINT "usuarios_rol_id_roles_id_fk" FOREIGN KEY ("rol_id") REFERENCES "checador"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_org_fecha" ON "checador"."audit_logs" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_checadas_org_fecha" ON "checador"."checadas" USING btree ("org_id","timestamp_local");--> statement-breakpoint
CREATE INDEX "idx_checadas_empleado_fecha" ON "checador"."checadas" USING btree ("empleado_id","timestamp_local");--> statement-breakpoint
CREATE INDEX "idx_dispositivos_org" ON "checador"."dispositivos" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_vectores_empleado" ON "checador"."empleado_vectores" USING btree ("empleado_id");--> statement-breakpoint
CREATE INDEX "idx_vectores_org_hnsw" ON "checador"."empleado_vectores" USING hnsw ("embedding" vector_cosine_ops) WITH (m=16,ef_construction=64);--> statement-breakpoint
CREATE INDEX "idx_empleados_org_sync" ON "checador"."empleados" USING btree ("org_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_horarios_org" ON "checador"."horarios" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_sucursales_org" ON "checador"."sucursales" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_usuarios_org" ON "checador"."usuarios" USING btree ("org_id");