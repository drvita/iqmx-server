ALTER TABLE "checador"."checadas" ADD COLUMN "sello_integridad_sha256" varchar(64);--> statement-breakpoint
ALTER TABLE "checador"."horarios" ADD COLUMN "tipo_jornada" varchar(20) DEFAULT 'diurna' NOT NULL;--> statement-breakpoint
ALTER TABLE "checador"."horarios" ADD COLUMN "horas_semanales_limite" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "checador"."organizaciones" ADD COLUMN "horas_semanales_mixta" numeric(4, 1) DEFAULT '45.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "checador"."organizaciones" ADD COLUMN "horas_semanales_nocturna" numeric(4, 1) DEFAULT '42.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "checador"."organizaciones" ADD COLUMN "registro_patronal_imss" varchar(30);--> statement-breakpoint
ALTER TABLE "checador"."horarios" ADD CONSTRAINT "chk_horarios_tipo_jornada" CHECK ("checador"."horarios"."tipo_jornada" IN ('diurna', 'mixta', 'nocturna'));