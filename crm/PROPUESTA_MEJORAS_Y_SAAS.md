# Arquitectura de Tareas Programadas (Scheduler), Recordatorios y Automatizaciones SaaS

Este documento define la arquitectura y hoja de ruta técnica para el **Módulo de Tareas Programadas (Schedule), Recordatorios Multilínea y Evaluaciones de IA** en IQISS CRM.

---

## 1. Contexto y Soporte Multi-Tenant / Multi-Línea

A diferencia del proyecto base original (diseñado para un solo cliente y un solo número por canal), **IQISS CRM opera como SaaS Multi-Tenant**:
- Cada organización (`organization_id`) puede tener **múltiples líneas y números de WhatsApp oficiales** conectados simultáneamente (`meta_credentials`).
- Cada organización puede contar con múltiples sucursales, doctores o agentes comerciales.
- Por tanto, cualquier tarea programada o recordatorio debe **ejecutarse con aislamiento estricto por tenant** y despacharse a través de la **línea de WhatsApp correcta** (la línea con la que el cliente o paciente inició la conversación o en la que se agendó la cita).

---

## 2. Motor de Tareas Autodescriptivas (Arquitectura Plugin-like)

Para permitir que el sistema crezca sin duplicar formularios ni rehacer interfaces, las tareas residirán en un directorio dedicado del CRM (ej. `src/server/tasks/definitions/`).

### Estructura de una Definición de Tarea (`TaskDefinition`)

Cada script de tarea exporta un contrato autodescriptivo que el sistema lee dinámicamente:

```typescript
export interface TaskDefinition<TConfig = Record<string, any>> {
  /** Identificador único de la tarea en el catálogo */
  id: string; // Ej: "booking_reminder", "inactive_lead_followup", "ai_conversation_audit"
  
  /** Título y descripción presentados al usuario en la UI */
  name: string;
  description: string;
  category: "citas" | "seguimiento_ventas" | "calidad_ia";

  /** Esquema de configuración (Zod / JSON Schema) que genera automáticamente los inputs del formulario en el frontend */
  configSchema: z.ZodType<TConfig>;

  /** Definición de campos UI para renderizado automático de formularios */
  uiFields: {
    key: keyof TConfig;
    label: string;
    type: "number" | "select_template" | "select_channel" | "hours" | "boolean";
    placeholder?: string;
    description?: string;
    defaultValue?: any;
  }[];

  /** Frecuencia de chequeo recomendada o cron */
  defaultCadenceMinutes: number; // Ej: 1, 5, 15, 60

  /** Lógica de ejecución para una organización */
  run(context: TaskExecutionContext<TConfig>): Promise<TaskExecutionResult>;
}
```

---

## 3. Catálogo de Tareas Precargadas Iniciales

### A. Recordatorios de Citas Médicas / Servicios (`booking_reminder`)
- **Propósito:** Notificar al paciente/cliente con anticipación configurable para confirmar su asistencia y reducir el ausentismo.
- **Configuración configurable por el cliente en el panel:**
  - **Tiempo de anticipación:** (Ej. `36` horas, `24` horas, `2` horas, `1` hora antes de la cita).
  - **Plantilla de WhatsApp:** Selector de plantillas aprobadas en Meta (`schema.template`) con botones interactivos (Quick Reply: "Confirmar" / "Reagendar").
  - **Línea de WhatsApp emisora:** La misma línea oficial en la que se reservó la cita o una línea de notificaciones predeterminada de la empresa.
  - **Mapeo de variables:** `{{1}}` Nombre del paciente, `{{2}}` Fecha y hora local, `{{3}}` Especialista / Sucursal.
- **Lógica de ejecución:**
  1. Busca citas en estado `agendada` cuyo `scheduled_at` coincida con la ventana de envío (`scheduled_at - X horas <= NOW()`).
  2. Verifica que no se haya enviado previamente este recordatorio para esa cita (idempotencia en tabla de despachos).
  3. Despacha vía `sendTemplate()` y registra el log de entrega.

### B. Reactivación de Prospectos Desatendidos / Inactivos (`inactive_lead_followup`)
- **Propósito:** Recuperar oportunidades que quedaron pausadas porque el cliente no contestó la última cotización o mensaje.
- **Configuración por el cliente:**
  - **Horas de inactividad:** (Ej. `24` horas, `48` horas, `72` horas sin respuesta).
  - **Etapa del embudo aplicable:** (Ej. Solo en etapa *"Cotización"* o *"Interesado"*).
  - **Plantilla de seguimiento:** Plantilla oficial aprobada por Meta para reabrir ventana de conversación.
- **Lógica de ejecución:**
  1. Identifica conversaciones donde el último mensaje fue saliente (`last_outbound_at > last_inbound_at`) y han transcurrido más de X horas sin respuesta.
  2. Comprueba que no se haya enviado ya una reactivación en los últimos N días.
  3. Envía la plantilla aprobada y registra la nota interna en el historial.

### C. Auditor Nocturno de Calidad y Calificación de la IA (`ai_conversation_audit`)
- **Propósito:** Evaluar cómo está respondiendo el agente de IA en conversaciones reales para asignarle una calificación de 0 a 100 y detectar quejas o desvíos.
- **Configuración por el cliente:**
  - **Hora de ejecución:** (Ej. `23:30` hrs todos los días).
  - **Criterio de muestra:** Últimas 20 conversaciones atendidas por la IA en el día.
- **Lógica de ejecución:**
  1. Extrae las conversaciones del día donde participó la IA.
  2. El modelo Juez de IA analiza el hilo contra la Base de Conocimiento del negocio.
  3. Genera un reporte de calidad en el panel: score promedio, hallazgos de mejora y alertas de clientes insatisfechos.

---

## 4. Despachador Temporal (Scheduler tipo Laravel) vía Coolify

Dado que el CRM está desplegado en **Coolify**:

```
 ┌─────────────────────────────────────────────────────────────┐
 │                      COOLIFY CRON                           │
 │                Ejecución: * * * * * (Cada minuto)           │
 └──────────────────────────────┬──────────────────────────────┘
                                │ curl / POST con CRON_SECRET
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                   API: /api/cron/schedule                   │
 ├─────────────────────────────────────────────────────────────┤
 │ 1. Verifica token seguro (Bearer CRON_SECRET).              │
 │ 2. Obtiene organizaciones activas (status = 'active/trial').│
 │ 3. Lee tareas habilitadas por cada organización.            │
 │ 4. Evalúa condiciones de tiempo y despacha los jobs.        │
 │ 5. Guarda log de auditoría (tiempo de corrida, enviados).   │
 └─────────────────────────────────────────────────────────────┘
```

### Características del Despachador:
1. **Ejecución por Minuto (`* * * * *`):** Coolify dispara una llamada HTTP segura a `POST /api/cron/schedule` o ejecuta `pnpm schedule:run`.
2. **Candados Anti-Colisión (Locking):**
   - Para evitar que dos corridas simultáneas envíen mensajes duplicados si un proceso tarda más de un minuto, se utiliza bloqueo a nivel de base de datos (`pg_try_advisory_lock` o `FOR UPDATE SKIP LOCKED`).
3. **Control de Cuotas y Errores:**
   - Si una línea de WhatsApp tiene el token revocado o saldo insuficiente, registra el fallo sin detener el despacho de las demás organizaciones.

---

## 5. Eventos Internos y Triggers en Tiempo Real (Post-Turno)

Además de las tareas basadas en tiempo (cron), el sistema cuenta con **triggers inmediatos por eventos**:

1. **Post-Interacción del Cliente (Event-Driven):**
   - Al cerrarse un turno de mensajes, se dispara en background la evaluación del clasificador de embudo para mover el contacto a *"Interesado"* o *"Cotizado"*.
2. **Recepción de Botón Interactivo de WhatsApp:**
   - Si el paciente presiona el botón **"Confirmar"** en la plantilla de recordatorio:
     - El webhook actualiza la cita a confirmada en la agenda en tiempo real.
     - Responde un acuse inmediato por WhatsApp: *"¡Muchas gracias! Tu cita ha quedado confirmada. Te esperamos."*
   - Si presiona **"Reagendar"**:
     - Cancela el espacio actual, cancela futuros recordatorios y la IA retoma la conversación ofreciendo los nuevos horarios libres.

---

## 6. Modelo de Base de Datos Propuesto

### Tabla: `organization_task_config`
Configuraciones personalizadas de cada empresa para cada tarea del catálogo:
- `id`: string (`tsk_...`).
- `organization_id`: relación con la organización.
- `task_id`: identificador de la tarea (`"booking_reminder"`, `"inactive_lead_followup"`, etc.).
- `is_enabled`: booleano (encendida/apagada).
- `config_payload`: JSON con los valores de los inputs (horas de anticipación, `template_id`, `line_id`).
- `last_run_at`: timestamp de última ejecución.

### Tabla: `task_execution_log`
Historial y trazabilidad para el cliente y el administrador:
- `id`: string (`log_...`).
- `organization_id`: empresa.
- `task_id`: tarea ejecutada.
- `status`: `"success" | "warning" | "error"`.
- `items_processed`: cantidad de recordatorios o mensajes despachados.
- `details`: resumen o errores reportados por Meta Graph API.
- `created_at`: fecha y hora del evento.

---

## 7. Arquitectura para Entendimiento y Procesamiento Multimedia (Audios e Imágenes) por la IA

### 7.1 Diagnóstico del Estado Actual
En la versión actual del CRM:
1. **Filtro excluyente en el pipeline de IA:** En `src/server/ai/pipeline.ts`, el historial se construye con `history.filter((m) => m.text)`. Si un cliente envía una nota de voz o una fotografía sin caption, su campo `text` es `null`, quedando **completamente invisible para el LLM**.
2. **Cliente de IA mono-modal:** `ChatMessage` en `src/lib/ai/index.ts` solo admite `{ role, content: string }`, careciendo de soporte para contenido estructurado o bloques de imágenes (`image_url`).
3. **Ausencia de pipeline de transcripción:** No existe integración con motores de Speech-to-Text (STT) para notas de voz.

---

### 7.2 Procesamiento de Audios / Notas de Voz (Pipeline STT)

WhatsApp envía todas las notas de voz en contenedor OGG con códec Opus (`audio/ogg; codecs=opus`).

```
  ┌────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
  │  Webhook WhatsApp In   │       │ Descarga a Disco Local │       │  Servicio STT Ultrarrápido │
  │ (Mensaje tipo 'audio') │ ────► │  /data/media/{org}/{id}│ ────► │ (Groq Whisper / OpenAI)│
  └────────────────────────┘       └────────────────────────┘       └───────────┬────────────┘
                                                                                │
                                                                                ▼ Transcripción
  ┌────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
  │   Turno de IA Agente   │ ◄──── │ Inyección en Contexto  │ ◄──── │ Guardar en media_asset │
  │ (Conoce qué dijo el cl)│       │ [Nota de voz]: "..."   │       │    columna transcription│
  └────────────────────────┘       └────────────────────────┘       └────────────────────────┘
```

#### Requisitos y Reglas de Implementación:
1. **Motor STT con soporte nativo Opus:** Utilizar APIs que acepten directamente `audio/ogg` sin requerir transcodificación previa en el servidor (ej. **Groq Whisper**, con tiempos de respuesta < 400 ms, o la API de OpenAI Whisper). Esto evita instalar binarios pesados como `ffmpeg` en el contenedor de producción.
2. **Sincronización con la ventana de coalescencia (`AGENT_COALESCE_MS`):**
   - El CRM agrupa mensajes entrantes durante 6 segundos antes de disparar el LLM (`src/server/ai/trigger.ts`).
   - La transcripción debe ejecutarse en segundo plano al llegar el mensaje. Si la transcripción aún no concluye al expirar la ventana de coalescencia, el inicio del turno de IA debe retrasarse hasta que el audio esté transcrito o se alcance un timeout máximo (ej. 4 segundos).
3. **Manejo de audio inaudible o ruido:** Si el audio contiene solo silencio, ruido de fondo o no se detecta voz, el STT inyectará la etiqueta controlada `[Nota de voz del cliente inaudible o vacía]`, permitiendo que el LLM responda amablemente: *"Disculpa, no alcancé a escuchar bien tu audio, ¿me lo podrías repetir o escribir?"*.

---

### 7.3 Procesamiento de Imágenes (Visión Multimodal)

Para que el asistente de IA comprenda imágenes (fotos de productos, recetas, fallas mecánicas, comprobantes):

#### Opción A: Multimodalidad Directa al LLM (Recomendada)
Aprovechar las capacidades multimodales nativas de los modelos en OpenRouter (Claude 3.5 Sonnet, GPT-4o, Gemini 2.0 Flash):
- **Extensión del adaptador `ChatMessage`:** Permitir que `content` acepte tanto `string` como un arreglo de partes (`{ type: "text", text: "..." } | { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }`).
- **Inyección condicional:** Si el mensaje del cliente contiene una imagen en `/data/media`, se lee el archivo y se envía codificado en base64 en el último turno del usuario.
- **Ventaja:** Máxima precisión y comprensión de contexto sin pérdida de información por pre-resúmenes.

#### Opción B: Pre-análisis / OCR Intermedio (Fallback)
- Un modelo ligero de visión analiza la imagen en la ingesta y genera una descripción: `[Imagen adjunta: Foto de taladro Truper inalámbrico modelo 20V con batería dañada]`.
- Se almacena en la columna `ai_description` y se pasa al LLM como texto plano.
- **Ventaja:** Menor consumo de tokens si el historial es extenso; compatibilidad con modelos LLM sin visión.

---

### 7.4 Persistencia y Eficiencia (No pagar dos veces)

Para evitar duplicidad de costos y latencia:
1. **Nuevos campos en `crm.media_asset`:**
   - `transcription: text("transcription")`: Texto transcrito de la nota de voz.
   - `ai_description: text("ai_description")`: Análisis o descripción de la imagen.
   - `processed_at: timestamp("processed_at")`: Fecha y hora de procesamiento.
2. **Idempotencia:** Si una conversación es reabierta o el agente reintenta su respuesta tras un error, lee directamente el texto ya persistido en `media_asset` sin volver a consultar los servicios de STT o Visión.

---

### 7.5 Control de Cuotas y Costos SaaS por Organización

En un entorno SaaS multi-tenant:
- **Configuración por Organización:** Cada organización podrá habilitar/deshabilitar el entendimiento de notas de voz e imágenes desde la configuración de su Asistente IA (`agent_profile.ai_voice_enabled`, `agent_profile.ai_vision_enabled`).
- **Protección contra abuso:** Limitar la duración máxima de notas de voz procesables (ej. máx. 90 segundos) y el tamaño de imágenes enviadas al modelo para prevenir consumos excesivos de créditos de API.

---

## 8. Arquitectura para Evaluación Dinámica y Benchmarking Multi-Tenant en el Laboratorio (`/lab`)

### 8.1 Diagnóstico del Problema: Guiones Fijos vs Realidad SaaS
El módulo del Laboratorio fue originalmente diseñado con 6 personas de prueba cuyos guiones están **estáticos y cableados en código (`src/server/lab/personas.ts`)** con productos de una ferretería (taladros inalámbricos, martillos, lijadoras, tiner).

En un CRM SaaS multi-empresa:
- Si una empresa de jugos y pulpas congeladas (**Icefrut**) corre el Laboratorio, el cliente simulado pregunta: *"¿Tienen taladros inalámbricos disponibles?"*.
- El agente responde con total precisión: *"Lamento no poder ayudarte con taladros; somos un taller de jugos naturales... ¿te conecto con un asesor?"*.
- **El problema:** El Juez de IA evalúa que el agente "no logró cerrar la venta" y califica la prueba con semáforo rojo/amarillo. El benchmark queda falseado y pierde utilidad para cualquier negocio que no sea una ferretería.

---

### 8.2 Análisis Comparativo de Alternativas

| Enfoque | Pros | Contras | Veredicto |
| :--- | :--- | :--- | :--- |
| **Opción 1: Preguntas estáticas por negocio** | Fácil de implementar para un solo cliente. | Rompe la arquitectura multi-tenant; requiere tocar código cada vez que se registra una empresa nueva. | ❌ Inviable para SaaS. |
| **Opción 2: Simulación dinámica Modelo contra Modelo (LLM-as-User)** | Conversaciones muy fluidas y orgánicas. | **No determinista:** El examen cambia en cada corrida, impidiendo comparar si el score subió o bajó por mérito del agente. Multiplica por 2 o 3 el costo de API y latencia por corrida. Riesgo de bucles de cortesía. | 🟡 Costosa e inestable como métrica. |
| **Opción 3 (Recomendada): Banco de Pruebas Adaptado al Dominio (Domain-Adapted Synthetic Personas)** | **Determinista:** Permite comparar deltas de score de forma científica. **Económica:** Se genera una sola vez. **100% personalizada** a los productos de la empresa. | Requiere un paso inicial de generación / seeding al configurar el KB. | 🟢 **Solución Óptima de Ingeniería.** |

---

### 8.3 Solución Recomendada: Arquetipos Abstractos + Generación Determinista

```
 ┌────────────────────────────────────────────────────────┐
 │   Base de Conocimiento (KB) & Catálogo de la Empresa   │
 │        (Pulpas congeladas, envíos a Colima, etc.)      │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼ Generador de Escenarios (LLM rápido: Gemini Flash)
 ┌────────────────────────────────────────────────────────┐
 │        6 Guiones Personalizados para la Empresa        │
 ├────────────────────────────────────────────────────────┤
 │ 1. Comprador decidido ──► Compra 5L de pulpa de mango. │
 │ 2. Preguntón precios  ──► Pregunta piña, fresa, limón. │
 │ 3. Cliente molesto    ──► Paquete llegó descongelado.  │
 │ 4. Fuera de KB        ──► Pregunta por refacciones.    │
 │ 5. Pide humano        ──► Asunto urgente con pedido.   │
 │ 6. Errores/modismos   ──► Jerga informal mexicana.     │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼ Persistidos en BD (crm.agent_test_persona)
 ┌────────────────────────────────────────────────────────┐
 │               Corridas del Laboratorio                 │
 │       (Mismo examen determinista en cada corrida)      │
 └────────────────────────────────────────────────────────┘
```

#### Reglas de Diseño de la Solución:

1. **Arquetipos Semánticos Abstractos:**
   Las 6 personas conservan su perfil psicológico, pero sus intenciones se definen de forma abstracta:
   - `comprador_decidido`: Pregunta por disponibilidad del producto estrella, confirma precio y solicita datos para pago inmediato.
   - `pregunton_precios`: Pide precios de 3 productos del catálogo sucesivamente, busca promociones y no concreta.
   - `cliente_enojado`: Reporta una incidencia grave verosímil para el giro comercial (ej. producto derramado o retraso de entrega) exigiendo solución.
   - `fuera_de_kb`: Plantea una duda ajena a la oferta del negocio para evaluar que el agente admita no saberlo sin inventar (anti-alucinación).
   - `pide_humano`: Solicita explícitamente hablar con un agente humano tras el primer intercambio.
   - `errores_modismos`: Formula preguntas con ortografía descuidada y modismos locales sobre productos del negocio.

2. **Acción de Generación y Sincronización en la UI:**
   - En la vista del Laboratorio (`/lab`) o en Configuración de IA, se incorpora la acción:
     > 🪄 **"Generar escenarios de prueba para mi empresa"**
   - El sistema analiza las entradas de `crm.kb_entry` de esa organización y utiliza un modelo rápido (ej. `google/gemini-2.0-flash-001`) para sintetizar los 6 guiones en formato JSON.
   - Los guiones se guardan en la base de datos vinculados al `organization_id`.

3. **Ejecución del Runner del Laboratorio:**
   - Al ejecutar `startRun(organizationId)` en `src/server/lab/runner.ts`, el motor consulta primero si existen guiones personalizados en la BD para esa organización.
   - Si existen, corre el simulador con las preguntas adaptadas de esa empresa.
   - Si aún no se han generado, utiliza el arquetipo base como fallback.

4. **Beneficio para el Benchmark (Deltas Científicos):**
   - Al ser guiones persistentes y fijos para esa empresa, cuando el Ingeniero o el usuario edita el prompt del agente, añade preguntas a su Base de Conocimiento o ajusta las instrucciones, la siguiente corrida evalúa exactamente las mismas situaciones. El puntaje (Score de 0 a 100) y el indicador de mejora (+5%, -10%) son **100% confiables y representativos**.


