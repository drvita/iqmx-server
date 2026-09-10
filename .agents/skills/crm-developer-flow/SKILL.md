---
name: crm-developer-flow
description: Guía y flujo de trabajo para el desarrollo, modificación, testing y despliegue de Vocero CRM Multi-Inquilino (Next.js 15, Drizzle ORM, PostgreSQL). Usar al implementar features, corregir bugs, refactorizar componentes o validar servicios en crm/.
---

# Flujo de Desarrollo en Vocero CRM Multi-Inquilino

Esta skill establece el flujo estándar de desarrollo, validación y buenas prácticas para el microservicio `crm/` en **IQISSMexico**.

## 1. Entorno y Puertos
- **Puerto Local**: `3000` (`http://localhost:3000`).
- **Contenedor Docker**: `iqmx-crm` gestionado vía `docker-compose.yml`.
- **Servicios Vecinos**: Portal Web (`web/`) en puerto `3001` y Backend FastAPI (`api/`) en puerto `8000`.

## 2. Reglas Arquitectónicas Multi-Inquilino
1. **Aislamiento de Datos Estricto:**
   - Toda tabla de dominio incluye `organization_id NOT NULL`.
   - Toda consulta con Drizzle ORM debe aplicar el helper de tenant:
     ```ts
     import { scoped } from "@/lib/db/tenant";
     scoped(schema.tabla.organizationId, session.organizationId)
     ```
2. **Laboratorio de Calidad (`/lab`):**
   - **Encolamiento Cross-Tenant:** El servidor corre solo 1 benchmark a la vez para proteger la atención de WhatsApp. Las solicitudes concurrentes de otros inquilinos se registran con `status: "queued"` y se despachan en orden FIFO.
   - **Límite Intra-Tenant:** Una organización no puede correr más de un benchmark simultáneamente.
   - **Concurrencia Controlada (2 en 2):** Los personajes se ejecutan en lotes de 2 para optimizar tiempo sin saturar cuotas de IA.
   - **Salvaguarda de Timeout:** Timeout inmutable de 10 minutos con `Promise.race` para evitar corridas atoradas.
   - **Cero Datos Mock:** No usar datos predeterminados de negocios ajenos; exigir que el inquilino configure o genere sus preguntas con IA.
   - **Acceso a Agenda:** La suite `agenda_flow` solo es visible y ejecutable si `isAgendaEnabled(organizationId)` es verdadero.
3. **Orquestación de Prompts e IA (`/agent`):**
   - El System Prompt central (`buildAgentSystemPrompt` en `src/server/ai/prompts.ts`) ya orquesta la agenda, horarios, base de conocimiento, pipeline y transferencias a humanos.
   - Las instrucciones del usuario en `/agent` **no deben redactar horarios ni reglas de calendario** para no contradecir el motor determinista.

## 3. Ciclo de Verificación Obligatorio
Antes de dar por completada cualquier tarea en `crm/`, ejecutar rigurosamente:

```bash
# 1. Comprobación de tipos estricta (TypeScript)
npm run typecheck

# 2. Batería de pruebas unitarias (Vitest)
npm test

# 3. Compilación de producción (Next.js)
npm run build

# 4. Reinicio de contenedor Docker (entorno local)
docker compose restart crm

# 5. Comprobación de salud HTTP
curl -s http://localhost:3000/api/health
```

## 4. Estándares de Diseño y UI
- **Lenguaje Claro:** Evitar tecnicismos, prefijos técnicos, UUIDs y guiones bajos (`_`) en elementos visibles al usuario.
- **Sin Paréntesis Innecesarios:** Mantener labels, títulos y botones directos y concisos.
- **Componentes Accesibles:** Switches con `inline-flex`, `border-2 border-transparent`, thumb blanco con `shadow-md` y traslación matemática (`translate-x-5` / `translate-x-0`).
