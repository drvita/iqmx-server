# Propuesta de Mejoras, Evolución a SaaS y Automatizacion

Este documento consolida el análisis técnico y la hoja de ruta para evolucionar el CRM hacia una arquitectura SaaS Multi-Tenant centralizada, controlada directamente desde el servidor principal (**iqissmexico.com**), así como las mejoras operativas del asistente de IA y el módulo de tareas.

---

## 1. Arquitectura SaaS Multi-Tenant y Aprovisionamiento Centralizado

### Objetivo

Permitir que los clientes que se registren en la web principal (`iqissmexico.com`) puedan aprovisionar automáticamente su espacio en el CRM sin intervención manual, vinculando su cuenta, sus líneas de WhatsApp, su equipo de trabajo y su token de webhook a su organización.

### Lo que ya tenemos listo para reutilizar (Sin romper el sistema)

- **Aislamiento en Base de Datos:** Todas las tablas (`conversation`, `contact`, `message`, `meta_credentials`, `agent_profile`, `kb_entry`, `pipeline_stage`, `booking`, etc.) ya cuentan con la columna `organization_id` e índices de partición.
- **Consultas Seguras (`scoped`):** Toda consulta SQL en el CRM ya pasa obligatoriamente por `scoped(columna, session.organizationId)`, impidiendo por diseño la fuga de datos entre empresas.
- **Webhooks Multi-Tenant:** Cada organización ya genera y almacena su propio `webhookToken` en la base de datos (`/api/webhooks/wa/[webhookToken]`).
- **Aprovisionamiento Idempotente de Líneas:** Ya existe el endpoint `/api/settings/whatsapp/provision` para conectar números de Meta a una organización sin duplicados.

---

### Nuevos Endpoints a Desarrollar en el CRM

#### A. Creación de Empresa y Usuario Propietario (`POST /api/provision/tenant`)

Permite que el servidor central cree una cuenta nueva en el CRM en cuanto el usuario se registra o adquiere el servicio en `iqissmexico.com`.

- **Autenticación:** `x-api-key: <PROVISION_SECRET_KEY>`
- **Payload recibido desde el servidor central:**
  ```json
  {
    "externalCustomerId": "iqmx_usr_98124",
    "companyName": "Ferretería El Martillo",
    "ownerEmail": "admin@elmartillo.com",
    "ownerName": "Carlos Mendoza",
    "password": "PasswordSeguro123!"
  }
  ```
- **Lógica interna en el CRM:**
  1. Inserta la nueva `organization` guardando en metadata su `externalCustomerId`.
  2. Crea el `user` y la relación `member` con rol `owner`.
  3. Siembra automáticamente las etapas base del embudo (`pipeline_stage`).
  4. Crea el perfil predeterminado de Asistente IA (`agent_profile`).
  5. Genera el `webhookToken` persistente para la organización.
- **Respuesta devuelta al servidor central:**
  ```json
  {
    "ok": true,
    "organizationId": "org_abc123",
    "ownerUserId": "usr_xyz789",
    "webhookToken": "whtk_4a781b99c0d12e...",
    "webhookUrl": "https://crm.iqissmexico.com/api/webhooks/wa/whtk_4a781b99c0d12e..."
  }
  ```
  _Con esta respuesta, el servidor central autoconfigura el reenvío de Meta Webhooks de forma 100% transparente._

---

## 2. Control de Ciclo de Vida, Cobros y Suspensión de la Organización

### Objetivo

Permitir que el servidor principal suspenda o reactive el acceso al CRM según el estado de la suscripción, pagos o periodos de prueba.

### Mecanismo de Control (`PATCH /api/provision/tenant/:organizationId/status`)

- **Estados posibles de la organización:**
  - `trial`: Periodo de prueba activo.
  - `active`: Suscripción de pago al corriente.
  - `suspended`: Pago vencido, prueba finalizada o suspendido voluntariamente.
  - `cancelled`: Cuenta dada de baja definitiva.

- **Payload del servidor central:**
  ```json
  {
    "status": "suspended",
    "reason": "trial_expired"
  }
  ```

### Impacto de la Suspensión en el CRM:

1. **En el Inicio de Sesión (Login / Navegación):**
   - El middleware y la sesión (`requireSession`) verifican el estado de la organización del usuario.
   - Si está `suspended` o `cancelled`, bloquea la entrada al panel y muestra una pantalla clara:
     > _"El periodo de prueba o suscripción de tu empresa ha finalizado. Actualiza tu plan en iqissmexico.com para reactivar tu acceso."_
2. **En la Ingesta de Mensajes (Webhooks):**
   - Cuando el webhook recibe un mensaje de WhatsApp para una organización suspendida:
     - Responde inmediatamente `HTTP 200 OK` (para que Meta considere entregado el webhook y no genere reintentos en bucle).
     - **Descarta el procesamiento:** No guarda nuevos mensajes, no activa el motor de IA y **no gasta tokens de inferencia en OpenRouter**.

---

## 3. Optimización del Flujo de IA y Handoff (Corrección Detectada)

### Causa Raíz Detectada:

En la prueba donde el bot contestó _"lo revisaré con el equipo"_ pero nunca se pausó, el fallo radicó en la directriz del System Prompt ([`src/server/ai/prompts.ts`](file:///Users/laclavees12345/code/wa_crm/web/src/server/ai/prompts.ts)):

- El prompt indicaba: _"Si la pregunta NO está cubierta por el conocimiento → responde que lo confirmarás **o** escala"_.
- El modelo LLM eligió la acción `{"action":"reply"}` con un texto prometiendo revisar, en lugar de emitir la acción `{"action":"handoff"}`.
- Como la acción fue un `reply`, el código no activó el handoff ni pausó la IA.

### Solución a Implementar:

1. **Modificación de la Regla en el Prompt:**
   - Hacer obligatorio el handoff: _"Si no conoces la respuesta, no la encuentras en la Base de Conocimiento o mencionas que consultarás con un compañero/equipo, DEBES emitir obligatoriamente `action: "handoff"`"_.
2. **Detector de Texto Saliente (Doble Seguridad):**
   - Si el texto de respuesta generado por el bot contiene frases como _"lo consulto con el equipo"_, _"un asesor te contactará"_ o _"lo reviso"_, el pipeline forzará automáticamente `applyHandoff(conversationId, organizationId, "modelo")` para garantizar la pausa inmediata.

---

## 4. Módulo de Tareas (Tasks) con Asistentes "Tool"

Aprovechando el campo `type: "tool"` ya existente en la tabla `agent_profile`, se propone la creación de un orquestador de tareas internas:

```
┌─────────────────────────────────────────────────────────────┐
│                    MÓDULO DE TAREAS (TASKS)                 │
├──────────────────────────────┬──────────────────────────────┤
│      POR EVENTOS (Background)│     PROGRAMADAS (Schedules)  │
│  - Clasificación de pipeline │  - Auditor nocturno (00:00)  │
│  - Detector de frustración   │  - Alerta leads desatendidos │
│  - Extracción de datos lead  │  - Reactivación leads fríos  │
└──────────────────────────────┴──────────────────────────────┘
```

### A. Tareas Disparadas por Eventos (Post-Turno)

- **Clasificador Automático de Pipeline:**
  - Corre de fondo cuando termina la interacción del cliente.
  - Evalúa si el prospecto confirmó interés, pidió cotización o cerró compra, y ejecuta `move_stage` en la base de datos sin sobrecargar al bot conversacional.
- **Auditor de Escalado / Sentimiento:**
  - Revisa si el bot no pudo resolver la duda para forzar el apagado de la IA y notificar al equipo de ventas.

### B. Tareas Programadas (Schedules / Cron)

- **Auditor Nocturno de Desatendidos (00:00 hrs):**
  - Revisa conversaciones donde el cliente envió el último mensaje y nadie respondió (`lastInboundAt > lastOutboundAt`).
  - Genera un reporte interno en el CRM con los leads prioritarios que quedaron esperando.
- **Reactivación de Cotizaciones Frías:**
  - Identifica leads con más de 48 horas sin actividad en la etapa "Cotización" para sugerir plantillas de seguimiento.

---

## 5. Nuevas Aplicaciones para el Laboratorio

Actualmente el Laboratorio evalúa conversaciones sintéticas con jueces de IA. Se proponen 3 extensiones de alto valor:

1. **Playground Interactivo en Vivo:**
   - Un simulador de chat en el panel para conversar con el bot en tiempo real antes de publicarlo a WhatsApp.
   - Panel lateral de depuración que muestra el JSON generado, la Base de Conocimiento consultada y las variables del lead extraídas.
2. **Generador Automático de Base de Conocimiento:**
   - Permite pegar catálogos, listas de precios o textos largos de la empresa.
   - Un agente tipo "tool" extrae automáticamente las mejores preguntas y respuestas estructuradas para nutrirlas a la BD con un solo clic.
3. **Auditor de Calidad de Conversaciones Reales:**
   - Permite seleccionar un rango de fechas y auditar conversaciones reales de WhatsApp mediante el modelo juez para detectar posibles fallas, respuestas lentas o quejas de clientes.

---

## Conclusión

La arquitectura actual del CRM está extraordinariamente bien posicionada para dar el salto a SaaS:

- No requiere migración destructiva de tablas.
- Los webhooks ya son independientes por empresa.
- El control de acceso, cobros y aprovisionamiento se gestiona limpiamente mediante endpoints dedicados conectados a **iqissmexico.com**.
