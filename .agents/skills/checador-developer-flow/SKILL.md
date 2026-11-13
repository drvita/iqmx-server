---
name: checador-developer-flow
description: Guía y flujo de desarrollo, migraciones Drizzle, aprovisionamiento M2M, seguridad multi-tenant y validación de Checador Facial SaaS (Next.js 16, PostgreSQL schema checador + pgvector, Redis). Usar al implementar backend, paneles (admin), endpoints /api/provision/* o /api/sync/* y pruebas en checador/.
---

# Flujo de Desarrollo en Checador Facial SaaS (`checador/`)

Esta skill establece las convenciones técnicas y de validación para el microservicio `checador/` en **IQISSMexico**.

## 1. Entorno, Puertos y Planeación
- **Puerto Local:** `3002` (`http://localhost:3002`).
- **Contenedor Docker:** `iqmx-checador` gestionado vía `docker-compose.yml`, conectado a `iqmx-db`, `iqmx-redis` e `iqmx-network`.
- **Planeación por fases:** Todo plan vive en `checador/docs/`. Antes de codificar, consultar [PLAN_MAESTRO.md](file:///Users/laclavees12345/code/iqissmexico/main/checador/docs/PLAN_MAESTRO.md) y leer el archivo de la fase activa.

## 2. Base de Datos y Migraciones (Patrón `crm/`)
- **Schema aislado:** Todas las tablas viven en el schema `checador` dentro de `iqmx-db` (con extensión `pgvector` para `vector(512)` e índice HNSW).
- **Drizzle Kit:** Configurar `drizzle.config.ts` con `schemaFilter: ["checador"]` y generar migraciones con `npm run db:generate`.
- **Migración al arranque:** Usar `scripts/migrate.mjs` (copiando el patrón de `crm/scripts/migrate.mjs`) con `search_path: "checador, public"`, `CREATE SCHEMA IF NOT EXISTS checador;` y `migrationsSchema: "checador"` antes de iniciar `node server.js`.
- **Seeds iniciales:** Sembrar roles base `ORG_ADMIN` y `RH_ASSISTANT` (dejando `roles` y `usuario_sucursales` listos para `extra_roles_enabled`).

## 3. Aprovisionamiento M2M y Membresías
- `checador/` **no** duplica tablas de planes ni Superadmin (viven en `public` vía `api/` y `web/`).
- Exponer endpoints autenticados con `authenticateProvisionRequest` (HMAC-SHA256 / Bearer / timing-safe):
  - `POST /api/provision/tenant`: idempotente por `external_customer_id`; crea organización, `ORG_ADMIN`, sucursal `"Matriz"` y horario plantilla `"Jornada Estándar L-V"`.
  - `PATCH /api/provision/tenant/[id]/features`: actualiza límites (`max_empleados`, `max_dispositivos`, `max_sucursales`) y flags (`cloud_evidences_enabled`, `extra_roles_enabled`).
  - `PATCH /api/provision/tenant/[id]/status`: sincroniza `activo | prueba | suspended | cancelled`.
  - `POST /api/provision/reset-owner-password`.

## 4. Seguridad Multi-Tenant y `/api/sync/*`
- **Aislamiento estricto:** `org_id` proviene **siempre** de la sesión (panel) o del `device_token` verificado (PWA), nunca del body.
- **Dispositivos y Blacklist:** Guardar solo `SHA-256` del `device_token`. Al revocar un equipo, marcar `revocado_at` en BD y escribir `blacklist:device:<token_hash>` en `iqmx-redis`.
- **Estado de organización:** Todo `/api/sync/*` verifica Redis + estado de la organización; si está suspendida o cancelada, responder `403 ORG_SUSPENDED`.
- **Idempotencia y LFPDPPP:**
  - `POST /api/sync/attendance`: insertar usando `ON CONFLICT (id) DO NOTHING`.
  - `GET /api/sync/employees?since=...`: devolver activos/modificados + `deleted_ids` / `inactive_ids` para purgar vectores en IndexedDB.
- **Lógica pura desacoplada:** Mantener cálculos de jornada (`48h` → `40h`), retardos y reglas de negocio en `src/services/` independiente de Next.js.

## 5. Ciclo de Verificación Obligatorio
Antes de reportar una fase como lista para revisión del Ingeniero:
```bash
npm run typecheck
npm test
npm run build
docker compose restart checador
curl -s http://localhost:3002/api/health
```
