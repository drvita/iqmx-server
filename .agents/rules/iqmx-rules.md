# Reglas de Proyecto: IQISSMexico (IQMX)

Estas reglas deben ser aplicadas rigurosamente por cualquier agente en este espacio de trabajo:

## 1. Trato y Comunicación
- Dirigirse siempre al usuario como **Ingeniero**.
- Mantener respuestas concisas, estructuradas y profesionales con formato GitHub Markdown y enlaces a archivos (`file:///...`).
- Apegarse a las mejores prácticas de desarrollo (TypeScript estricto, SOLID, componentes reutilizables, sin duplicidad de código).

## 2. Gestión del Changelog (`CHANGELOG.md`)
- **Regla estricta:** NO actualizar `CHANGELOG.md` de manera automática ni proactiva; únicamente actualizarlo cuando el Ingeniero lo solicite explícitamente.
- **Validación de fecha:** Antes de registrar cualquier cambio o versión en el changelog, validar la fecha y hora local del sistema (CST / UTC-6) para no asumir fechas incorrectas.
- **Formato:** Seguir el estándar [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [Semantic Versioning](https://semver.org/).

## 3. Entorno de Ejecución y Servicios
- **Backend (`api/`):**
  - No ejecutar comandos de Python globalmente en el sistema host (ej. evitar `python3 manage.py` directo).
  - Usar los contenedores Docker (`docker compose exec ...`) o el entorno virtual (`venv`) correspondiente.
- **Frontend (`web/`):**
  - La aplicación web de Next.js corre en el puerto local **3001** (el puerto **3000** está reservado para el CRM).
  - Comandos de verificación: `npm run build` en el directorio `web/`.
- **CRM (`crm/`):**
  - Microservicio independiente multi-tenant y multi-agente en el puerto local **3000** (`http://localhost:3000`).
  - Validación obligatoria: `npm run typecheck` y `npm test` antes de culminar tareas.
  - Ciclo Docker: tras compilar o modificar el CRM, reiniciar con `docker compose restart crm` y comprobar con `curl -s http://localhost:3000/api/health`.

## 4. Reglas del CRM Multi-Inquilino (`crm/`)
- **Aislamiento Multi-Tenant:** `organization_id NOT NULL` en toda tabla de dominio y queries con `scoped(schema.tabla.organizationId, orgId)`.
- **Laboratorio (`/lab`):**
  - Encolamiento cross-tenant: 1 benchmark global a la vez en el servidor (prioridad máxima para atención de WhatsApp).
  - Límite por inquilino: 1 benchmark a la vez por organización.
  - Concurrencia controlada: procesamiento de personajes de 2 en 2.
  - Timeout de seguridad: 10 minutos inmutables con `Promise.race`.
  - Sin datos mock de negocios ajenos: exigir preguntas configuradas antes de correr.
  - Restricción de agenda: suite `agenda_flow` condicionada a `agendaEnabled`.
- **Asistentes (`/agent`):** System prompt general coordina agenda, base de conocimiento y pipeline. No redactar horarios en instrucciones del asistente.
- **Estética y UI:** Nombres limpios sin UUIDs ni guiones bajos, sin paréntesis innecesarios en labels, controles accesibles estándar (shadcn/Tailwind).

## 5. Arquitectura de Rutas y Navegación
- **Home (`/`):** Portal corporativo e institucional para IQISSMexico (Quiénes somos, Qué hacemos, Carrusel compacto de soluciones, Portal de clientes y Contacto). No debe saturarse con cuadrículas grandes de productos.
- **Catálogo Completo (`/productos`):** Ruta oficial donde se lista la totalidad de soluciones de la base de datos con tarjetas detalladas y llamadas a la acción.
- **Landings de Producto (`/landingpage/...`):** Páginas comerciales de conversión para productos específicos (ej. `/landingpage/crm` para CRM General y `/landingpage/crm/consultorio` para Salud y Consultorios).
- **Admin (`/admin/...`):** Panel administrativo centralizado (`/admin/products`, `/admin/crm`, `/admin/subscriptions`, `/admin/customers`).
- **Portal (`/portal/...`):** Portal de autoservicio para clientes registrados (membresías, facturación, checkout).
