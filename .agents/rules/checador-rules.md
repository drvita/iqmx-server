# Reglas de Proyecto: Checador Facial SaaS (`checador/`)

Estas reglas aplican a cualquier agente que trabaje dentro de `checador/`:

1. **Planeación en `checador/docs/`:** Todo plan, diseño o documento de fase debe guardarse en `checador/docs/` (ignorado en `.gitignore`). Seguir el orden de [PLAN_MAESTRO.md](file:///Users/laclavees12345/code/iqissmexico/main/checador/docs/PLAN_MAESTRO.md) y esperar validación del Ingeniero al cierre de cada fase.
2. **Puerto y Docker:** `checador/` corre en el puerto local **`3002`** (`http://localhost:3002`). Antes de dar por terminada una fase de código, validar `npm run typecheck`, `npm test`, `npm run build` y `curl -s http://localhost:3002/api/health`.
3. **Aislamiento Multi-Tenant:** Toda tabla de dominio en el schema `checador` lleva `org_id NOT NULL`. Nunca confiar en un `org_id` enviado desde el body; derivarlo siempre de la sesión o del `device_token`.
4. **Migraciones Drizzle:** Seguir el patrón de `crm/` (`schemaFilter: ["checador"]` en `drizzle.config.ts` y `scripts/migrate.mjs` al arranque del contenedor).
5. **Membresías M2M:** No duplicar tablas de planes ni Superadmin en `checador/`. Recibir límites y flags (`cloud_evidences_enabled`, `extra_roles_enabled`) vía `/api/provision/tenant/*`.
6. **Seguridad de Dispositivos y LFPDPPP:**
   - Guardar solo el hash SHA-256 de `device_token`. Revocar inmediatamente en PostgreSQL + `iqmx-redis` (`blacklist:device:<token_hash>`).
   - Validar estado de organización en `/api/sync/*` (`403 ORG_SUSPENDED` si está suspendida/cancelada).
   - Propagar `deleted_ids` / `inactive_ids` en `GET /api/sync/employees` para purgar vectores en IndexedDB.
   - Mantener miniaturas 15 días en IndexedDB cuando `cloud_evidences_enabled = false`; subir a bucket y purgar local cuando sea `true`.
