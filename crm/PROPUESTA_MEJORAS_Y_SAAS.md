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
