# Plan de Portado — Etapa 3 (Características Directas sin Impacto Arquitectónico)
**Origen:** `wa_crm` (`v2.1.0` → `v2.7.0`, Specs `044` a `065`)  
**Destino:** `iqissmexico/main/crm` (Multi-Inquilino y Multi-Número)

---

## 1. Alcance y Reglas de Validación

Este plan agrupa **únicamente las mejoras de Vocero `2.1.0`–`2.6.0` que son 100% compatibles** con las personalizaciones de nuestro CRM multi-inquilino y que no entran en conflicto con:
- Nuestro aislamiento multi-tenant (`organization_id` + `scoped()`).
- Nuestro soporte multi-línea de WhatsApp (`phoneNumberId` por conversación y selector de línea en bandeja).
- Nuestro motor interno de IA, enriquecimiento multimedia (`aiTranscript`, visión) y control de cuota mensual (`handoffReason: "cuota"`).

> **Exclusiones acordadas con el Ingeniero:**
> - **Spec 066 (Conectar con Meta — Embedded Signup v4):** Se descarta definitivamente porque ese flujo ya existe en nuestro sitio principal y en `crm/src/server/whatsapp/embedded-signup.ts`.
> - **Specs 047, 048, 061–062 y 065:** Se separan en [`PLAN-SEGUNDO-CHECK.md`](file:///Users/laclavees12345/code/iqissmexico/main/PLAN-SEGUNDO-CHECK.md) para una segunda revisión antes de tocar flujos críticos de enrutamiento multi-número o diseño global.

---

## 2. Fases de Implementación

### Fase 1: Productividad del Equipo en la Bandeja (Specs `049`, `050`, `051`)
Mejoras aditivas para que los operadores respondan más rápido y colaboren dentro del mismo hilo sin exponer información interna al cliente ni a la IA.

1. **Respuestas Rápidas con `/` (Spec `049`):**
   - **Base de datos:** Nueva tabla `quick_reply` (`id`, `organization_id`, `atajo`, `texto`, `created_at`, `updated_at`) con índice único `(organization_id, atajo)` y prefijo `qr_` en `crm/src/lib/db/ids.ts`.
   - **Backend:** Servicio `crm/src/server/quick-replies.ts`, helper puro `crm/src/lib/respuestas-rapidas.ts` y rutas `GET/POST /api/quick-replies` + `PATCH/DELETE /api/quick-replies/[id]`.
   - **UI:**
     - Nueva sección `Ajustes → Respuestas rápidas` (`crm/src/app/(app)/settings/quick-replies/page.tsx`) para crear, editar y eliminar atajos.
     - Menú flotante en `crm/src/components/inbox/composer.tsx` al escribir `/` al inicio del mensaje (filtrable por atajo o texto, navegable con flechas y `Enter`/`Tab`).

2. **Notas Internas Amarillas en el Hilo (Spec `050`):**
   - **Base de datos:** Nueva tabla `conversation_note` (`id`, `organization_id`, `conversation_id`, `author_user_id`, `texto`, `created_at`) con prefijo `cn_`. Al vivir en su propia tabla, **jamás viaja a Meta ni al contexto del asistente de IA**.
   - **Backend:** Servicio `crm/src/server/notas.ts`, DTO e intercalación cronológica en `crm/src/lib/notas.ts`, rutas `GET/POST /api/conversations/[id]/notes` y `DELETE /api/conversations/[id]/notes/[noteId]`, más eventos SSE `note.new` y `note.deleted`.
   - **UI:**
     - Conmutador **«Responder | Nota interna»** en el compositor (`composer.tsx`). En modo nota, la caja se tiñe de ámbar y está siempre habilitada aunque la ventana de 24 h de WhatsApp esté cerrada.
     - Tarjetas ámbar intercaladas por fecha en `crm/src/components/inbox/message-thread.tsx` con iniciales del autor, hora y botón de borrado (autor o dueño/admin).

3. **Borradores Automáticos por Conversación (Spec `051`):**
   - **Lógica cliente:** Helper `crm/src/lib/borradores.ts` en `localStorage` con claves separadas para respuesta (`vocero.borrador.responder.<conversationId>`) y nota interna (`vocero.borrador.nota.<conversationId>`), caducidad de 7 días y limpieza automática al cerrar sesión.
   - **UI:** Al cambiar entre conversaciones se conserva lo escrito sin enviar, y en la lista izquierda (`conversation-list.tsx`) se muestra el indicador ámbar `Borrador: …` cuando hay texto pendiente.

---

### Fase 2: Notas de Voz Nativas y Reenvío Universal (Specs `044`, `059`)
Mejora completa de experiencia multimedia en el chat cuidando nuestras personalizaciones de transcripción con IA y soporte multi-número.

1. **Grabación de Notas de Voz y Reproductor con Onda (Spec `044`):**
   - **Conversión de audio sin dependencias externas:** Portar `crm/src/lib/audio/webm-ogg.ts` para re-empaquetar Opus de WebM a Ogg en memoria si el navegador graba en `audio/webm` (Chrome/Firefox), asegurando compatibilidad nativa con WhatsApp Cloud API.
   - **Grabador en compositor:** Botón de micrófono en `composer.tsx` (cuando el campo de texto está vacío) con barra de grabación en vivo, ondas, contador `m:ss`, `Cancelar` y `Enviar`.
   - **Reproductor mejorado y evento `message.media`:**
     - Emitir evento SSE `message.media` en `crm/src/server/inbox/ingest.ts` cuando termina de descargarse un archivo multimedia en segundo plano.
     - Nuevo reproductor con botón circular Play/Pausa, 32 barras de onda interactivas (`Web Audio API`) y selector de velocidad `1x` / `1.5x` / `2x`.
     - **Validación con nuestro CRM:** Mantener intacto debajo del reproductor el bloque de **Transcripción de IA (`msg.aiTranscript`)** que ya tenemos en `crm/src/components/inbox/message-thread.tsx`.

2. **Reenvío de Cualquier Mensaje y Gesto de Deslizar para Responder (Spec `059`):**
   - **Generalización de reenvío (`crm/src/lib/reenvio.ts`):** Ampliar nuestro reenvío actual (que solo reenviaba imágenes de la Spec `042`) para permitir reenviar **texto, audio, video, documento e imagen** a otra conversación con ventana abierta.
   - **Validación multi-línea:** En `POST /api/conversations/[id]/messages`, conservar nuestra resolución de `phoneNumberId` de la conversación destino al reenviar medios o textos entre clientes.
   - **Gesto táctil en móvil:** Deslizar una burbuja hacia la derecha (`>= 56 px`) en pantallas táctiles cita el mensaje en el compositor igual que el botón «Responder».

---

### Fase 3: Contexto en el Hilo, Filtros, Atajos y Avisos (Specs `045`, `052`, `054`, `055`, `056`)
Herramientas de supervisión rápida y navegación por teclado para equipos de atención.

1. **Eventos de Etapa y Traspaso Dentro del Hilo (Spec `054`):**
   - **Backend y helper:** Crear `crm/src/lib/eventos-hilo.ts` y `GET /api/conversations/[id]/eventos` leyendo `lead_stage_event` y `conversation.handoffAt` / `handoffReason`.
   - **Adaptación a nuestro CRM:** Incluir en el catálogo de motivos de pausa nuestras razones propias: `"cuota"` (*"Límite mensual de tokens de IA alcanzado"*), `"manual_reply"`, `"keyword"`, etc.
   - **UI:** Píldoras discretas centradas en el hilo (*"Pasó a Calificado · por Juan · 14:20"*, *"La IA pasó la conversación a una persona: Límite mensual de IA alcanzado"*).

2. **Filtro Unificado «Filtrar» y Aviso «Vence en…» (Spec `052`):**
   - **Lógica:** Portar `crm/src/lib/filtros-bandeja.ts` con cálculo de ventana próxima a vencer (`<= 2 h`).
   - **UI en `conversation-list.tsx`:**
     - Pestañas rápidas **«Todas | No leídas»** + botón desplegable **«Filtrar»** (Etapa del pipeline, *Por vencer*, *De anuncios*).
     - Chip ámbar `Vence en X h` / `Vence en X min` en cada tarjeta de conversación cuya ventana de servicio esté por expirar.
     - **Validación multi-línea:** Conservar nuestro selector de línea de WhatsApp (`showLineFilter`) cuando la organización tiene más de un número conectado.

3. **Barra de Comandos `Ctrl+K` / `⌘K` y Atajos de Teclado (Spec `055`):**
   - **Lógica y UI:** Portar `crm/src/lib/atajos.ts` y `crm/src/components/command-palette.tsx` montado en `app-shell.tsx`.
   - Permite saltar a cualquier pantalla o buscar conversaciones con `Ctrl+K` / `⌘K`, ver la ayuda de atajos con `?`, y en la bandeja navegar conversaciones con `Alt+J` / `Alt+K`, enfocar respuesta con `Alt+R` o abrir nota interna con `Alt+N`.

4. **Avisos Sonoros, Contador en Pestaña, Notificaciones del Sistema y Banda «Sin conexión» (Specs `045`, `056`):**
   - **Sonido y título (`045`):** Tono suave sintetizado con `Web Audio API` al recibir mensaje en otra conversación, botón de silencio en barra lateral, contador `(n) Bandeja` en el título del navegador y `ResizeObserver` en el hilo para mantener el scroll al fondo cuando cargan imágenes/videos.
   - **Notificaciones del navegador y reconexión SSE (`056`):** Portar `crm/src/lib/avisos-sistema.ts`, notificación nativa `Notification` cuando la pestaña está en segundo plano y banda superior ámbar *«Sin conexión en tiempo real · Reconectando…»* si el stream `/api/events` se cae por más de 5 segundos.

---

### Fase 4: Pulido Visual de Chat y Rendimiento de Bandeja (Specs `063`, `064`)

1. **Fondo del Chat con Dibujos Sutiles (Spec `063`):**
   - Actualizar `.thread-bg` en `crm/src/app/globals.css` con el tapiz SVG de iconos sutiles (adaptado a modo claro y modo oscuro) detrás de las burbujas de mensaje.

2. **Rendimiento y Coalescing en Lista de Conversaciones (Spec `064`):**
   - Unificar y agrupar (coalesce de 250 ms) las recargas de `/api/conversations` disparadas por SSE en `inbox-client.tsx` para evitar ráfagas de peticiones cuando entran varios mensajes seguidos.
   - Añadir índice compuesto `(organization_id, is_test, last_message_at DESC)` en `conversation` y optimizar la consulta conservando el retorno de `lines` de nuestro soporte multi-número.

---

### Fase 5: Homologación de Versión y Validación Técnica

1. **Generación y aplicación de migraciones Drizzle:**
   - Generar la migración unificada con `quick_reply`, `conversation_note` y el índice de `conversation`.
2. **Homologación de versión con Vocero:**
   - Actualizar `"version": "2.7.0"` en [`crm/package.json`](file:///Users/laclavees12345/code/iqissmexico/main/crm/package.json) y `crm/src/lib/version.ts`.
3. **Validación obligatoria:**
   - Ejecutar `npm --prefix crm run typecheck` (0 errores).
   - Ejecutar `npm --prefix crm test` (todos los tests unitarios existentes + nuevos tests de las specs portadas en verde).
   - Compilar y reiniciar contenedor `crm` validando `/api/health`.
