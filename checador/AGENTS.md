# Checador Facial SaaS (`checador/`) — Contexto para Agentes

Bienvenido al microservicio **`checador/`** dentro de `iqissmexico/main`. Antes de escribir código o modificar arquitectura en esta carpeta, sigue estrictamente estas instrucciones:

## 1. Flujo de Planeación y Fases
- **Todo plan, diseño y documento de fase debe almacenarse en `checador/docs/`** (carpeta ignorada en `.gitignore`). No crear planes fuera de `checador/docs/`.
- **Punto de entrada obligatorio:** lee [PLAN_MAESTRO.md](file:///Users/laclavees12345/code/iqissmexico/main/checador/docs/PLAN_MAESTRO.md) para ver qué fases ya están validadas (`[x]`) y cuál es la fase activa.
- Lee únicamente el archivo de la fase que te corresponde desarrollar en `checador/docs/fases/` y consulta los documentos base ([ARQUITECTURA_TECNICA.md](file:///Users/laclavees12345/code/iqissmexico/main/checador/docs/ARQUITECTURA_TECNICA.md), [BASE_DE_DATOS.md](file:///Users/laclavees12345/code/iqissmexico/main/checador/docs/BASE_DE_DATOS.md), [DISENO_UI.md](file:///Users/laclavees12345/code/iqissmexico/main/checador/docs/DISENO_UI.md)) solo cuando necesites verificar un esquema, endpoint o pantalla.
- Al finalizar una fase, ejecuta el **Quality Gate híbrido** definido en la skill `iqmx-architecture-reviewer`:
  1. Verificación local (`npm run typecheck`, `npm test`, `npm run build`, healthcheck Docker).
  2. Validación independiente de **Seguridad y Arquitectura** usando el sub-agente `research` (en todas las fases con código: Fases 1–5).
  3. Validación independiente de **UX y UI** usando el sub-agente `browser` en desktop y tablet `8–10"` (solo en fases con interfaz: Fases 2–5).
  4. Corregir cualquier rechazo internamente y entregar al **Ingeniero** un resumen + **guía paso a paso de revisión manual** antes de marcar `[x]` o avanzar de fase.

## 2. Arquitectura y Entorno (Docker Compose Local → Coolify Producción)
- **Infraestructura simulada a producción:** El entorno de desarrollo local corre sobre `docker-compose.yml` replicando la topología de **Coolify** en producción:
  - Contenedores en la red compartida `iqmx-network`: `iqmx-db` (`pgvector/pgvector:pg15`), `iqmx-redis` (`redis:7.2-alpine`), `iqmx-api` (`8000`), `crm` (`3000`), `web` (`3001`) y `checador` (**`3002`**).
  - **Regla de despliegue/migraciones:** En Coolify, el pre-deploy corre sobre el contenedor viejo; por ello, las migraciones Drizzle **deben ejecutarse al arranque del contenedor** (`scripts/migrate.mjs` antes de `node server.js`), nunca en pre-deploy.
  - **Healthcheck obligatorio:** Todo cambio compilado debe verificarse reiniciando el servicio en Docker y consultando `http://localhost:3002/api/health`.
- **Stack:** Monolito modular en **Next.js 16** (App Router, TypeScript estricto) + **PWA Offline-First** (`/kiosk` con Serwist, Dexie.js y `onnxruntime-web`).
- **Base de datos y Migraciones (patrón `crm/`):**
  - PostgreSQL (`iqmx-db`) con schema dedicado **`checador`** y extensión `pgvector`.
  - Drizzle ORM con `schemaFilter: ["checador"]` en `drizzle.config.ts` y generación con `npm run db:generate`.
- **Separación de responsabilidades:**
  - `checador/` **NO** tiene consola Superadmin ni tablas propias de planes/facturación (viven en `public` vía `api/` y `web/`).
  - Las membresías, límites y *feature flags* llegan vía M2M en `/api/provision/tenant`, `/api/provision/tenant/[id]/features` y `/api/provision/tenant/[id]/status`.
  - Toda lógica de negocio pura (cálculo 48h→40h, retardos, reglas de sync) debe vivir en `src/services/` desacoplada de Next.js.

## 3. Reglas Críticas de Negocio y Seguridad
- **Aislamiento Multi-Tenant:** `org_id` se obtiene **siempre** de la sesión autenticada (panel) o del `device_token` verificado (PWA), nunca del body del request.
- **Privacidad Biométrica (LFPDPPP):**
  - El enrolamiento extrae el vector 512d localmente en el navegador; no subir fotos crudas innecesarias.
  - Exigir `consentimiento_biometrico = true` antes de guardar vectores.
  - `GET /api/sync/employees` debe devolver `deleted_ids` / `inactive_ids` para que la PWA purgue vectores de IndexedDB cuando un empleado es dado de baja.
- **Evidencias (Miniaturas):**
  - Plan básico (`cloud_evidences_enabled = false`): retención **local de 15 días** en IndexedDB (consultable desde Auditoría Local en `/kiosk` con PIN de admin).
  - Plan superior (`cloud_evidences_enabled = true`): subir a bucket (`/data/media` o R2) al sincronizar y purgar de IndexedDB.
- **Roles iniciales:** `ORG_ADMIN` y `RH_ASSISTANT` (PyMEs < 15 empleados), manteniendo `roles` y `usuario_sucursales` listos para `extra_roles_enabled`.
- **Dispositivos y Suspensión:** tokens de dispositivo guardados como hash SHA-256; revocación instantánea vía blacklist en `iqmx-redis`; todo `/api/sync/*` valida que la organización no esté suspendida/cancelada (`403 ORG_SUSPENDED`).

## 4. Skills Aplicables
- `iqmx-architecture-reviewer`: auditoría obligatoria de planes y cumplimiento de arquitectura/buenas prácticas al cierre de cada fase.
- `checador-developer-flow`: desarrollo backend, BD, migraciones, M2M y panel `(admin)`.
- `checador-pwa-biometric-offline`: `onnxruntime-web`, Dexie.js, Serwist y modo quiosco `/kiosk`.
- `stitch-ui-design`: consulta y edición de pantallas en Google Stitch (Proyecto ID `9836670553321484837`).
- `modern-web-guidance`: estándares modernos de HTML/CSS, accesibilidad y PWA.
