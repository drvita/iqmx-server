# Protocolo del Harness Agéntico y Memoria (`IQISSMexico`)

Este protocolo aplica de forma transversal a todos los servicios del repositorio (`web/`, `crm/`, `api/`, `checador/`).

## 1. Navegación de Memoria por Nodos (`02-docs/`)
- Antes de planificar o modificar un servicio, lee [02-docs/INDEX.md](file:///Users/laclavees12345/code/iqissmexico/main/02-docs/INDEX.md) y navega **únicamente** los nodos relacionados (`servicios/*.md`, `contratos/*.md`) para evitar saturar la ventana de contexto.
- Toda carpeta `02-docs/` está excluida de Git (`.gitignore`) y actúa como memoria operativa local, especificaciones y evidencia.

## 2. Triage Inicial (Sencilla vs. Compleja)
Al recibir un requerimiento, clasifícalo antes de editar código:
- **Tarea Sencilla:** Cambio acotado (1–2 archivos), sin migraciones de BD, sin cambios de contratos M2M/API, sin reglas de seguridad/auth nuevas ni rediseño de flujos UI.
  - *Flujo:* Ejecución directa + verificación técnica obligatoria del servicio (`lint`, `typecheck`, `test`, `build`, `/api/health` según aplique).
- **Tarea Compleja:** Afecta múltiples archivos o servicios, involucra esquema/migraciones, seguridad/autenticación, contratos M2M o flujos UI/UX nuevos.
  - *Flujo:* Activar la skill `iqmx-architecture-reviewer` y seguir el ciclo **Spec → Builder → Revisores → Evaluador (máx. 3 intentos)**.

## 3. Ciclo Completo para Tareas Complejas
1. **Spec (`02-docs/specs/SPEC-XXX-slug/spec.md`):** Usar la plantilla de `02-docs/specs/_TEMPLATE/` para documentar requerimiento, alcance, riesgos y criterios de aceptación verificables.
2. **Builder:** Implementar contra `spec.md`, ejecutar las pruebas y compilación reales del servicio afectado y preparar evidencia.
3. **Revisores Independientes:**
   - **Seguridad y Arquitectura:** Subagente `research` (solo lectura) audita los cambios contra `spec.md` y registra dictamen en `review-seguridad.md`.
   - **UX y UI (si hay interfaz):** Subagente `browser` prueba flujos reales en desktop y móvil/tablet y registra dictamen en `review-ux-ui.md`.
4. **Evaluador (hasta 3 intentos):**
   - Contrasta `spec.md` + `review-seguridad.md` + `review-ux-ui.md` + salidas de pruebas/build en `evaluacion.md`.
   - Si algún revisor rechaza o falta un criterio y `intento < 3`, devuelve los hallazgos al Builder para corregir y re-evaluar.
   - Si en el **intento 3** persisten fallos, detenerse con estado `REQUIERE_INTERVENCION_HUMANA` y presentar el diagnóstico exacto al Ingeniero.
   - Si aprueba, liberar al Ingeniero con resumen, evidencia y guía de verificación manual.
5. **Actualización de Memoria:** Al cerrar una `SPEC` o resolver un incidente relevante, actualizar el nodo correspondiente en `02-docs/servicios/*.md` o `02-docs/contratos/*.md`.
