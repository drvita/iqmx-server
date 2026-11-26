CREATE TABLE "checador"."acuses_semanales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"empleado_id" uuid NOT NULL,
	"dispositivo_id" uuid,
	"periodo_clave" varchar(30) NOT NULL,
	"periodo_inicio" timestamp with time zone NOT NULL,
	"periodo_fin" timestamp with time zone NOT NULL,
	"horas_ordinarias" numeric(6, 2) DEFAULT '0.00' NOT NULL,
	"horas_extras_dobles" numeric(6, 2) DEFAULT '0.00' NOT NULL,
	"horas_extras_triples" numeric(6, 2) DEFAULT '0.00' NOT NULL,
	"total_horas" numeric(6, 2) DEFAULT '0.00' NOT NULL,
	"estado" varchar(20) NOT NULL,
	"origen" varchar(30) DEFAULT 'kiosco_touch' NOT NULL,
	"sello_integridad_sha256" varchar(64) NOT NULL,
	"resuelto_por" uuid,
	"resuelto_at" timestamp with time zone,
	"nota_resolucion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_acuses_org_emp_periodo" UNIQUE("org_id","empleado_id","periodo_clave"),
	CONSTRAINT "chk_acuses_estado" CHECK ("checador"."acuses_semanales"."estado" IN ('aceptado', 'rechazado')),
	CONSTRAINT "chk_acuses_origen" CHECK ("checador"."acuses_semanales"."origen" IN ('kiosco_touch', 'movil_personal'))
);
--> statement-breakpoint
ALTER TABLE "checador"."organizaciones" ADD COLUMN "acuse_semanal_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "checador"."acuses_semanales" ADD CONSTRAINT "acuses_semanales_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "checador"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."acuses_semanales" ADD CONSTRAINT "acuses_semanales_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "checador"."empleados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."acuses_semanales" ADD CONSTRAINT "acuses_semanales_dispositivo_id_dispositivos_id_fk" FOREIGN KEY ("dispositivo_id") REFERENCES "checador"."dispositivos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."acuses_semanales" ADD CONSTRAINT "acuses_semanales_resuelto_por_usuarios_id_fk" FOREIGN KEY ("resuelto_por") REFERENCES "checador"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_acuses_org_estado" ON "checador"."acuses_semanales" USING btree ("org_id","estado");