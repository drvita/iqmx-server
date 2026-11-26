ALTER TABLE "checador"."checadas" DROP CONSTRAINT "checadas_sucursal_id_sucursales_id_fk";
--> statement-breakpoint
ALTER TABLE "checador"."dispositivos" DROP CONSTRAINT "dispositivos_sucursal_id_sucursales_id_fk";
--> statement-breakpoint
ALTER TABLE "checador"."checadas" ALTER COLUMN "sucursal_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "checador"."dispositivos" ALTER COLUMN "sucursal_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "checador"."checadas" ADD CONSTRAINT "checadas_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "checador"."sucursales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checador"."dispositivos" ADD CONSTRAINT "dispositivos_sucursal_id_sucursales_id_fk" FOREIGN KEY ("sucursal_id") REFERENCES "checador"."sucursales"("id") ON DELETE set null ON UPDATE no action;