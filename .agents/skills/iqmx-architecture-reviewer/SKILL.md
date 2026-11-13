---
name: iqmx-architecture-reviewer
description: Orquestador del Harness IQISSMexico (web/, crm/, api/, checador/): Triage Sencilla vs Compleja, Spec-Driven en 02-docs/specs/, Revisores independientes (Seguridad/Arquitectura y UX/UI) y Evaluador con ciclo de hasta 3 intentos antes de liberar al Ingeniero.
---

# Harness de Calidad, Revisión y Evaluación (`IQISSMexico`)

Esta skill implementa el ciclo **Spec → Builder → Revisores → Evaluador (máx. 3 intentos)** para evitar que el agente constructor sea juez y parte y para dejar evidencia trazable en `02-docs/`.

## 1. Paso 0: Memoria y Triage
1. Leer [02-docs/INDEX.md](file:///Users/laclavees12345/code/iqissmexico/main/02-docs/INDEX.md) y abrir solo el nodo del servicio (`web.md`, `crm.md`, `api.md`, `checador.md`) y contratos afectados.
2. Clasificar la tarea:
   - **Sencilla:** Ejecutar directamente, validar técnicamente el servicio y responder al Ingeniero.
   - **Compleja:** Continuar con la Sección 2.

## 2. Paso 1: Especificación (`spec.md`)
Crear `02-docs/specs/SPEC-XXX-titulo/spec.md` (copiando la estructura de `02-docs/specs/_TEMPLATE/spec.md`) con:
- Requerimiento exacto del Ingeniero y restricciones.
- Archivos, migraciones y contratos M2M/API involucrados.
- Criterios de aceptación verificables y regresiones a evitar.

## 3. Paso 2: Builder + Verificación Técnica por Servicio
Implementar el cambio y ejecutar la validación real del servicio afectado:
- **`web/`:** `docker compose exec -T web npm run build` (o `npm --prefix web run build`) + `docker compose restart web`
- **`crm/`:** `npm --prefix crm run typecheck && npm --prefix crm test` + `docker compose restart crm` + `curl -s http://localhost:3000/api/health`
- **`api/`:** pruebas/lint dentro de `docker compose exec api ...` + `docker compose restart api`
- **`checador/`:** `npm --prefix checador run lint && npm --prefix checador run typecheck && npm --prefix checador test -- --no-file-parallelism && npm --prefix checador run build` + `docker compose restart checador`

## 4. Paso 3: Revisores Independientes
1. **Revisor de Seguridad y Arquitectura (siempre):**
   - Invocar al subagente **`research`** (solo lectura) con el rol `"Auditor de Seguridad y Arquitectura"`.
   - Entregarle `spec.md`, los archivos modificados y la Checklist (Sección 6) para emitir `APROBADO` o `RECHAZADO` con hallazgos concretos. Registrar en `review-seguridad.md`.
2. **Revisor de UX y UI (cuando hay cambios de interfaz):**
   - Invocar al subagente **`browser`** con el rol `"Auditor UX/UI"`.
   - Probar los flujos reales en el puerto correspondiente (`3000`, `3001` o `3002`) en viewport **Desktop** y **Móvil/Tablet**, validando visibilidad sobre el pliegue, estados vacíos/error y copy limpio (`CRM WhatsApp` / `Checador Facial`). Registrar en `review-ux-ui.md`.

## 5. Paso 4: Evaluador (Máximo 3 Intentos)
Invocar un subagente **`research`** (rol `"Evaluador Final de SPEC"`) o evaluar estrictamente contra `spec.md`, `review-seguridad.md`, `review-ux-ui.md` y la evidencia de pruebas/build, registrando cada ronda en `evaluacion.md`:
- **Si todos aprueban y cumplen `spec.md`:** Marcar `APROBADO`, actualizar el nodo de memoria en `02-docs/servicios/*.md` con lo aprendido y entregar al Ingeniero con guía de revisión manual.
- **Si hay fallos y `intento < 3`:** Marcar `DEVUELTO_A_BUILDER`, devolver la lista exacta de fallos al Builder, corregir, re-validar y volver a pasar por Revisores y Evaluador.
- **Si `intento == 3` y persisten fallos:** Marcar `REQUIERE_INTERVENCION_HUMANA`, detener el ciclo y reportar al Ingeniero los bloqueos exactos encontrados en los 3 intentos.

## 6. Checklist de Seguridad y Arquitectura (Todos los Servicios)
- [ ] **TypeScript / Python estricto y modularidad:** Sin duplicación de lógica; reglas de negocio en `services/` desacopladas de Route Handlers/UI.
- [ ] **Aislamiento Multi-Tenant:** Toda tabla de dominio incluye `org_id` / `organization_id NOT NULL`; toda consulta filtra por identidad derivada de sesión/token, nunca del body.
- [ ] **Validación de entradas y secretos:** Payloads validados con Zod/Pydantic; sin secretos hardcodeados; tokens/PINs hasheados; migraciones seguras al arranque del contenedor.
- [ ] **Contratos y no-regresión:** Respeta contratos en `02-docs/contratos/` y no rompe flujos previos documentados en `02-docs/servicios/*.md`.
