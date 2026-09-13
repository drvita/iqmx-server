# Guía de Integración Externa: Envío de Plantillas de WhatsApp

Esta guía está diseñada para equipos de desarrollo, integradores externos y plataformas de automatización (Make, n8n, Zapier, microservicios backend) que necesiten enviar **Plantillas de WhatsApp (Templates)** a través de la API del CRM.

---

## 1. Autenticación

Todas las solicitudes a los endpoints de servicio deben incluir la cabecera `X-API-Key` con la clave de API autorizada de la instancia o del inquilino:

```http
X-API-Key: TU_API_KEY_DE_BOT
Content-Type: application/json
```

> **Nota de Seguridad:** La API de servicio protege tus credenciales de Meta WhatsApp Cloud API. Tu aplicación externa nunca maneja tokens de Meta ni interactúa directamente con Graph API; el CRM gestiona el cifrado, la persistencia, la línea autorizada y el cumplimiento de políticas de entrega.

---

## 2. Dónde obtener el ID o Nombre de la Plantilla

En el panel del CRM, navega a **Configuración → Plantillas** (`/settings/templates`).
Debajo de cada tarjeta de plantilla aprobada encontrarás dos botones de copiado rápido:
- **`Copiar ID`**: Obtiene el identificador interno del CRM (ej. `tpl_01J8...`).
- **`Copiar Nombre`**: Obtiene el nombre oficial en Meta (ej. `confirmacion_cita`).

Cualquiera de los dos datos puede ser usado en tus llamadas API.

---

## 3. Endpoints Disponibles

### Opción A: Endpoint Especializado de Plantillas (Recomendado)
- **Método:** `POST`
- **Ruta:** `/api/bot/messages/template`

### Opción B: Endpoint General de Mensajes (Polimórfico)
- **Método:** `POST`
- **Ruta:** `/api/bot/messages`
*(Soporta tanto `{ text }` para mensaje libre como los campos de plantilla descritos a continuación).*

---

## 4. Estructura del Payload

El payload requiere definir **el destino**, **la plantilla** y **las variables** (si aplica).

### A. Especificación del Destino (Usa una de las 3 alternativas)
1. **`conversationId`**: ID del hilo en el CRM si ya interactúas sobre una conversación activa.
2. **`contactId`**: ID del contacto en el CRM.
3. **`phone`** (o `to`): Teléfono internacional con código de país (ej. `+5215512345678`). Si el contacto o la conversación no existen, el CRM los da de alta automáticamente bajo la línea de la plantilla.

### B. Especificación de la Plantilla (Usa una de las 2 alternativas)
1. **`templateId`**: ID interno del CRM (ej. `"tpl_01J8K..."`).
2. **`templateName`**: Nombre oficial de la plantilla en Meta (ej. `"recordatorio_cita"`).
   - Opcionalmente puedes incluir `"language"` (por defecto es `"es_MX"`).
   - Opcionalmente puedes incluir `"phoneNumberId"` si tu organización tiene múltiples números y la plantilla homónima vive en distintas WABAs.

### C. Variables Dinámicas
- **`variables`**: Array de cadenas en orden para `{{1}}`, `{{2}}`, `{{3}}`...
- **`variable`**: Alternativa de cadena simple si la plantilla únicamente usa una variable `{{1}}`.

### D. Salto de Pausa Humana (Opcional)
- **`force`**: Booleano (`true` / `false`, por defecto `false`).
  - Si un operador humano tomó el control de la conversación, el bot no interfiere por defecto (`409 ai_paused`).
  - Si la plantilla es una notificación transaccional crítica del sistema (ej. confirmación de compra, código OTP, alerta de seguridad), envía `"force": true` para asegurar la entrega.

---

## 5. Ejemplos de Solicitud

### Ejemplo 1: Enviar por Teléfono usando el Nombre de la Plantilla
Ideal para automatizaciones en Make, n8n o triggers de base de datos donde solo se conoce el teléfono del cliente:

```bash
curl -X POST https://crm.tudominio.com/api/bot/messages/template \
  -H "Content-Type: application/json" \
  -H "X-API-Key: TU_API_KEY_DE_BOT" \
  -d '{
    "phone": "+5215512345678",
    "templateName": "recordatorio_cita",
    "language": "es_MX",
    "variables": ["Carlos Pérez", "15 de Octubre a las 11:00 AM"]
  }'
```

### Ejemplo 2: Enviar por `conversationId` usando el ID de la Plantilla
Ideal para bots conversacionales que gestionan un hilo activo:

```bash
curl -X POST https://crm.tudominio.com/api/bot/messages/template \
  -H "Content-Type: application/json" \
  -H "X-API-Key: TU_API_KEY_DE_BOT" \
  -d '{
    "conversationId": "conv_01J8M4NPQR...",
    "templateId": "tpl_01J8K9XYZ...",
    "variables": ["Carlos", "12345"]
  }'
```

### Ejemplo 3: Enviar con `POST /api/bot/messages` (Polimórfico)
```bash
curl -X POST https://crm.tudominio.com/api/bot/messages \
  -H "Content-Type: application/json" \
  -H "X-API-Key: TU_API_KEY_DE_BOT" \
  -d '{
    "conversationId": "conv_01J8M4NPQR...",
    "templateName": "seguimiento_cotizacion",
    "variables": ["Ana"],
    "force": true
  }'
```

---

## 6. Respuestas del Servidor

### Respuesta Exitosa (`200 OK`)
```json
{
  "ok": true,
  "messageId": "msg_01J8M8...",
  "conversationId": "conv_01J8M4...",
  "templateId": "tpl_01J8K9...",
  "phoneNumberId": "phone_1029384756"
}
```

### Respuestas de Error
- **`401 Unauthorized`**:
  ```json
  { "error": { "code": "unauthorized", "message": "No autorizado" } }
  ```
- **`404 Not Found`**:
  ```json
  { "error": { "code": "not_found", "message": "No se encontró una plantilla aprobada con nombre 'recordatorio' e idioma 'es_MX'" } }
  ```
- **`409 AI Paused`**:
  ```json
  { "error": { "code": "ai_paused", "message": "La IA está en pausa en esta conversación (un humano tomó el control)" } }
  ```
  *(Se resuelve enviando `"force": true` si la plantilla es transaccional obligatoria).*
- **`422 Unprocessable Entity`**:
  ```json
  { "error": { "code": "invalid", "message": "La plantilla requiere 2 valores: falta {{2}}" } }
  ```
- **`502 Bad Gateway`**:
  ```json
  { "error": { "code": "meta_error", "message": "Mensaje de rechazo devuelto por Meta Graph API" } }
  ```
