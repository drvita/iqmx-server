CREATE TABLE "checador"."empleado_documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"empleado_id" uuid NOT NULL,
	"nombre_archivo" varchar(200) NOT NULL,
	"tipo_documento" varchar(60) DEFAULT 'otro' NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"tamano_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"subido_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD COLUMN "latitud" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD COLUMN "longitud" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD COLUMN "precision_gps" real;--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD COLUMN "is_mock_location" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD COLUMN "incidencia_ubicacion" varchar(30);--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD COLUMN "incidencia_estado" varchar(20);--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD COLUMN "incidencia_motivo" text;--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD COLUMN "incidencia_resuelta_por" uuid;--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD COLUMN "incidencia_resuelta_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "checador"."dispositivos" ADD COLUMN "tipo" varchar(30) DEFAULT 'kiosco_sucursal' NOT NULL;--> statement-breakpoint
ALTER TABLE "checador"."dispositivos" ADD COLUMN "empleado_id" uuid;--> statement-breakpoint
ALTER TABLE "checador"."empleado_documentos" ADD CONSTRAINT "empleado_documentos_org_id_organizaciones_id_fk" FOREIGN KEY ("org_id") REFERENCES "checador"."organizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."empleado_documentos" ADD CONSTRAINT "empleado_documentos_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "checador"."empleados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."empleado_documentos" ADD CONSTRAINT "empleado_documentos_subido_por_usuarios_id_fk" FOREIGN KEY ("subido_por") REFERENCES "checador"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_emp_docs_org_emp" ON "checador"."empleado_documentos" USING btree ("org_id","empleado_id");--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD CONSTRAINT "checadas_incidencia_resuelta_por_usuarios_id_fk" FOREIGN KEY ("incidencia_resuelta_por") REFERENCES "checador"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."dispositivos" ADD CONSTRAINT "dispositivos_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "checador"."empleados"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_checadas_org_incidencia" ON "checador"."checadas" USING btree ("org_id","incidencia_estado");--> statement-breakpoint
CREATE INDEX "idx_dispositivos_org_tipo" ON "checador"."dispositivos" USING btree ("org_id","tipo");--> statement-breakpoint
ALTER TABLE "checador"."dispositivos" ADD CONSTRAINT "chk_dispositivos_tipo" CHECK ("checador"."dispositivos"."tipo" IN ('kiosco_sucursal', 'dispositivo_personal_movil'));