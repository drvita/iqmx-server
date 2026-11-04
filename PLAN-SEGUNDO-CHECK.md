# Planeación Separada — Características que Requieren Segundo Check
**Origen:** `wa_crm` (`v2.1.0` → `v2.7.0`)  
**Destino:** `iqissmexico/main/crm`

Este documento separa las **4 características** de los últimos cambios de Vocero que **sí tocan piezas sensibles** de nuestra arquitectura multi-inquilino / multi-número o de la identidad visual de IQISSMexico, por lo que no se incluyen en la ejecución directa de [`PLAN-PORTADO-ETAPA-3.md`](file:///Users/laclavees12345/code/iqissmexico/main/PLAN-PORTADO-ETAPA-3.md) y quedan sujetas a una segunda revisión con el Ingeniero.

> **Nota sobre Spec 066 (`Conectar con Meta` — Embedded Signup v4):**  
> Queda **descartada por completo** según la instrucción del Ingeniero, dado que nuestro sitio principal y el CRM ya cuentan con su propia integración multi-tenant de alta embebida.

---

## 1. Spec `047` — Webhook a Prueba de Fallos (`webhook_event` + Worker de Reintentos)

### ¿Qué hace en Vocero?
Guarda el payload crudo de cada webhook entrante (WhatsApp, Instagram, Messenger, Zernio) en una tabla `webhook_event` antes de procesarlo, responde `200 OK` de inmediato (`503` si la base de datos no pudo guardar para que Meta reintente), ejecuta la ingesta en segundo plano con `after()` y añade un worker con backoff exponencial (`30 s` → `6 h`, hasta 6 intentos).

### ¿Por qué requiere un segundo check en nuestro CRM?
1. **Resolución de organización multi-número:** En Vocero (`src/server/webhooks/organizacion.ts`), se asume 1 número por organización o un único token global. En nuestro CRM:
   - Soportamos tokens de webhook por organización (`webhook-token.ts`) y también el token global.
   - Una misma organización puede tener **múltiples números de WhatsApp (`meta_credentials`)**, y la sincronización también consulta `public.whatsapp_numbers`.
2. **Efectos secundarios durante la ingesta:** Nuestro `ingest.ts` dispara la transcripción de audio (`enrichAudioMedia`), descripción de imágenes (`enrichImageMedia`), control de cuota de tokens (`quota.ts`) y el turno del agente interno (`maybeRunAgentTurn`). Si un evento falla a mitad del proceso y el worker de `047` lo reintenta, debemos garantizar idempotencia estricta para no descontar tokens dos veces ni enviar doble respuesta de IA.

### Propuesta para cuando decidamos abordarlo
- Diseñar un `resolverOrganizacionYLinea()` específico para nuestro esquema multi-número y asegurar que el reintento del webhook solo ejecute `maybeRunAgentTurn` si el mensaje entrante no generó ya una respuesta o encolamiento previo.

---

## 2. Spec `048` — Vocero en el Celular (PWA Instalable, `manifest.ts` y `sw.js`)

### ¿Qué hace en Vocero?
Agrega `/manifest.webmanifest` dinámico, un service worker mínimo (`public/sw.js`) que muestra «Sin conexión» cuando no hay red, y `/api/branding/app-icon` que dibuja el ícono PNG (`192x192` y `512x512`) tomando el nombre, color e iniciales de la **primera organización de la base de datos**.

### ¿Por qué requiere un segundo check en nuestro CRM?
1. **Fuga de marca entre inquilinos (Multi-Tenant):** Los navegadores descargan `/manifest.webmanifest` y los íconos de la PWA en peticiones que a menudo no envían contexto de organización activa o ocurren en la pantalla de login. Tomar `db.select().from(organization).limit(1)` como hace Vocero haría que todos los clientes que instalen la PWA en su celular vean el nombre y color del primer inquilino registrado en la base de datos.
2. **Identidad institucional IQISSMexico:** En la versión `1.18.0` configuramos el favicon institucional de IQISSMexico (`crm/public/icon.svg`).

### Propuesta para cuando decidamos abordarlo
- Definir si la PWA instalable debe llevar siempre la marca institucional **IQISSMexico CRM** (nombre e íconos fijos de IQISSMexico para todos los inquilinos) o si el manifest debe leer la sesión del usuario autenticado con fallback a IQISSMexico cuando no hay sesión.

---

## 3. Specs `061` y `062` — Nuevo Diseño «Menta» y `Ajustes → Apariencia`

### ¿Qué hace en Vocero?
- **Spec `061`:** Cambia toda la paleta de colores en `src/app/globals.css` (reemplaza el verde esmeralda `#00a884` tipo WhatsApp por un verde menta `#10b981` sobre pizarra fría `#0b1215`, cambia radios de bordes, tarjetas y barra lateral).
- **Spec `062`:** Añade la pantalla `Ajustes → Apariencia` con 6 temas predefinidos (*Menta, WhatsApp, Océano, Grafito, Terracota, Violeta*), editor de tema propio, selector de tipografía (*Plus Jakarta Sans, Inter, Sistema, Serif*), tamaño de letra y densidad (*Compacta, Normal, Cómoda*), guardando defaults en `organization.appearance` y preferencias individuales en `localStorage`.

### ¿Por qué requiere un segundo check en nuestro CRM?
1. **Impacto visual global:** Reemplaza por completo `globals.css` y `app-nav.tsx`, donde ya integramos vistas personalizadas (Almacenamiento S3, barra de progreso de cuota de IA, tarjetas de ROI, switches accesibles).
2. **Convivencia con `Ajustes → Marca`:** Debe definirse si queremos mantener la estética actual por defecto o migrar al tema Menta permitiendo que cada inquilino personalice tipografía y densidad.

---

## 4. Spec `065` — Cuenta de Mensajes del Split de Meta (`messaging_account_id`) e Importación de Plantillas

### ¿Qué hace en Vocero?
Agrega la columna opcional `messaging_account_id` en `meta_credentials` para el nuevo modelo 2026 de Meta (`WHATSAPP_BUSINESS_MESSAGING_ACCOUNT` separado del `WABA`), y modifica `templates.ts` para importar automáticamente a la base local las plantillas que el cliente haya creado directamente en Meta Business Suite.

### ¿Por qué requiere un segundo check en nuestro CRM?
1. **Arquitectura multi-número en `meta_credentials`:** En Vocero solo existe una fila en `meta_credentials` por organización. En nuestro CRM, una organización puede tener varias filas en `meta_credentials` (una por cada número de WhatsApp conectado), vinculadas además con `public.whatsapp_numbers` y con asistentes específicos (`assistantId`).
2. **Sincronización de plantillas por WABA / línea:** En nuestro CRM, `whatsapp/templates.ts` y `whatsapp/connect.ts` operan resolviendo la credencial activa entre múltiples líneas. Portar la importación automática de plantillas de `065` requiere verificar cómo se asocian las plantillas importadas cuando un inquilino tiene dos números en el mismo WABA o en WABAs distintos.
