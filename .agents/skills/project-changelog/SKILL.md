---
name: project-changelog
description: Procedimiento guiado para registrar cambios y nuevas versiones en CHANGELOG.md de IQISSMexico. Se ejecuta ÚNICAMENTE cuando el Ingeniero lo solicita de forma explícita.
---

# Procedimiento de Actualización de Changelog (IQISSMexico)

Esta skill define el protocolo estricto para documentar versiones en `CHANGELOG.md`.

## ⚠️ Regla Cardinal
**NUNCA** actualices `CHANGELOG.md` por iniciativa propia o como parte rutinaria de un commit/tarea técnica. Solo debes abrir o editar este archivo cuando el Ingeniero lo indique textualmente (ej. *"actualiza el changelog"*, *"terminemos con el changelog"*).

---

## Flujo de Trabajo

### Paso 1: Validación Obligatoria de Fecha
1. Revisa la fecha actual en los metadatos de la conversación (`The current local time is: YYYY-MM-DD...`).
2. Verifica que la fecha a escribir corresponda exactamente al día local del sistema (Zona Horaria: CST / UTC-6).
3. Nunca asumas una fecha inventada o pasada.

### Paso 2: Determinación de la Versión Semántica (SemVer)
Lee la última versión registrada en `CHANGELOG.md`:
- **PATCH (`x.y.Z+1`)**: Corrección de bugs retrocompatibles o ajustes menores de estilo/texto.
- **MINOR (`x.Y+1.0`)**: Nuevas características, nuevas rutas, componentes o endpoints que no rompen compatibilidad.
- **MAJOR (`X+1.0.0`)**: Cambios de arquitectura o breaking changes que alteran contratos previos.

### Paso 3: Categorización Estándar (Keep a Changelog)
Clasifica los cambios realizados en las secciones oficiales en español:
- `### Añadido`: Nuevas funciones, páginas, componentes, endpoints o migraciones.
- `### Modificado`: Cambios a funcionalidades o interfaces existentes.
- `### Mejorado` / `### Optimizado`: Mejoras de rendimiento o refactorizaciones.
- `### Corregido`: Solución de errores (bug fixes).
- `### Deprecado`: Elementos que serán retirados en versiones futuras.
- `### Eliminado`: Código, rutas o componentes eliminados.
- `### Seguridad`: Mejoras de protección o parches de vulnerabilidades.

### Paso 4: Redacción Concisa y Enlaces a Archivos
- Incluye viñetas claras que expliquen el *qué* y el *porqué*.
- Agrega enlaces de markdown tipo `file:///` a los archivos clave modificados.
- Coloca la nueva entrada en la parte superior del archivo, debajo del encabezado institucional y de la línea divisoria (`---`).
