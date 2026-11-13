---
name: stitch-ui-design
description: Uso automático del servidor MCP de Google Stitch para consultar, revisar, crear o editar diseños UI/UX, pantallas y Design Systems en todos los proyectos del workspace (web/, crm/, checador/). Activar siempre que el usuario pida revisar diseños, crear pantallas, validar UI contra mockups o actualizar estilos visuales.
---

# Diseño UI/UX con MCP Google Stitch

Siempre que la tarea involucre **revisar diseños existentes, crear nuevas pantallas, ajustar flujos visuales o implementar interfaces basadas en mockups**, utiliza proactivamente las herramientas del servidor MCP **`stitch`** sin esperar a que el usuario te lo recuerde.

## 1. Flujo de Trabajo Recomendado con Stitch
1. **Identificar el proyecto y pantallas existentes:**
   - Usa `list_projects` (si no tienes el `projectId`) o `list_screens` / `get_screen` para inspeccionar el diseño actual antes de proponer cambios o programar la UI.
   - Usa `list_design_systems` para conocer los tokens, tipografía y paleta oficial del proyecto.
2. **Proyectos conocidos en `iqissmexico/main`:**
   - **Checador Facial SaaS:** Proyecto ID `9836670553321484837`, Design System `Biometric Precision Enterprise` (`assets/f8cfde4ddb82415d9d2cbed037b98260`). Referencia de pantallas en [DISENO_UI.md](file:///Users/laclavees12345/code/iqissmexico/main/checador/docs/DISENO_UI.md).
3. **Crear o iterar pantallas:**
   - Para nuevas pantallas: `generate_screen_from_text` aplicando el Design System vigente (`apply_design_system`).
   - Para ajustes puntuales: `edit_screens` o `generate_variants`.
   - Para descargar recursos/código de referencia: `download_file`.
4. **Coherencia con el código:**
   - Antes de implementar componentes visuales en `web/`, `crm/` o `checador/`, consulta la pantalla correspondiente en Stitch con `get_screen` para respetar jerarquía, espaciados, paleta de colores y estados vacíos/error, y apóyate en la skill `modern-web-guidance` para accesibilidad y estándares HTML/CSS.
