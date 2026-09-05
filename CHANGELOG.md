# Registro de Cambios (Changelog)

Todas las modificaciones notables de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

> **Zona horaria de referencia:** Ciudad de México (CST / UTC-6).

---

## [1.5.0] - 2026-09-05

### Añadido

- **Gestión y Edición de Clientes Corporativos por Soporte Técnico (`/admin/customers`)**:
  - Endpoint `PUT /api/admin/customers/{customer_id}` (con alias `PATCH`): permite al equipo de soporte técnico editar la información integral del cliente corporativo (`company_name`, `contact_name`, `phone`, `tax_id`, `email`, `is_active`).
  - Validación de unicidad de correo: comprobación previa en la tabla `User` antes de la mutación en base de datos, retornando `409 Conflict` estructurado en caso de coincidencia para evitar fallos de integridad referencial.
  - Transacción atómica: actualización coordinada de los datos del cliente en `Customer` y de las credenciales de acceso en `User`.
  - Regla de negocio de suspensión (`is_active = False`): bloqueo inmediato y estricto en `/portal/login` (`403 Forbidden`) y revocación en tiempo real en `/api/portal/*` mediante `get_current_customer`. Se preserva la total independencia operativa del cliente en el CRM u otros servicios satélite si mantiene suscripciones o inquilinos activos.
  - Modal de edición intuitivo en frontend: interfaz limpia sin textos redundantes entre paréntesis, con inputs para todos los datos de contacto y selector de estado (Activo / Suspendido) acompañado de banner informativo sobre el alcance del bloqueo.
- **Editor Raw JSON y Limpieza Visual en Modal de Ajuste de Beneficios (`/admin/crm`)**:
  - Selector de vistas por pestañas: alternancia entre *Formulario Asistido* y *Editor JSON Raw* para permitir la gestión de configuraciones avanzadas o parámetros no contemplados en el formulario estándar.
  - Editor monospace con botón de autoformateo (*Dar Formato*, 2 espacios de indentación) y validación sintáctica JSON en tiempo real sin pérdida de estado.
  - Sincronización bidireccional inteligente: preservación de claves y valores personalizados al conmutar de vista o despachar al backend.
  - Extensibilidad en backend y CRM: soporte de `extra="allow"` en Pydantic (`OverrideLimitsRequest`) y `.passthrough()` en esquemas Zod del CRM, almacenando atributos dinámicos en la columna JSONB `extra` de `crm.organization_settings`.

### Cambiado

- **Optimización Visual y Rediseño de la Tabla de Clientes (`/admin/customers`)**:
  - Remoción de columnas innecesarias: eliminación de la columna redundante *Líneas WA* y de la columna *ID Cliente* que se cortaba al extremo derecho de la pantalla.
  - Integración del ID de cliente: incorporación sutil y estilizada del identificador (`#ID`) como badge compacto junto a la razón social de la empresa.
  - Mejora de espaciado y jerarquía: mayor holgura horizontal en *Empresa y Contacto* y *Correo y Teléfono*, estados explícitos para teléfonos ausentes y formato amigable en la columna de origen (*Registro Web*, *Alta Manual*).
  - Contenedor con desplazamiento horizontal suave (`overflow-x-auto`) y balance natural en 6 columnas principales para evitar saturación visual o truncamientos en cualquier resolución.
- **Limpieza de Flujos de Números WABA Propios (`/admin/crm`)**:
  - Retiro de componentes visuales y estados para el registro manual de números propios en el modal de vinculación WABA, consolidando el onboarding a través del flujo oficial de Embedded Signup.
  - Depuración de endpoints y eliminación de variables de entorno obsoletas de tokens de usuario, minimizando la superficie de exposición y riesgo de seguridad.

---

## [1.4.0] - 2026-09-04

### Añadido

- **Edición Manual de Periodos, Estados y Badges Cromáticos en Membresías (`/admin/subscriptions`)**:
  - Endpoint `PATCH /api/admin/subscriptions/{subscription_id}`: permite al administrador ajustar el estado (`trial`, `active`, `past_due`, `paused`, `cancelled`) y el rango de fechas de inicio y fin del periodo (`current_period_start` y `current_period_end`).
  - Sincronización automática de acceso CRM: si la suscripción tiene un inquilino asociado (`external_tenant_id`), el cambio de estado se propaga inmediatamente a `crm.organization.status` (`active`, `trial`, `suspended`, `cancelled`).
  - Sistema de colores semánticos por estado en la tabla: verde esmeralda para *Activa*, azul cielo para *Prueba*, ámbar para *Atrasada*, morado para *Pausada* y rojo para *Cancelada*.
  - Modal interactivo de edición con campos de fecha nativos, selectores intuitivos y retroalimentación inmediata sin recarga de página.
- **Base de Conocimiento Aislada por Asistente IA (`crm.kb_entry`)**:
  - Separación multi-asistente a nivel de base de datos: adición de la columna `assistant_id` con clave foránea a `crm.agent_profile(id)` e índice `kb_assistant_idx`.
  - Migración SQL preservativa (`0015_kb_entry_assistant.sql`): asocia automáticamente entradas huérfanas existentes al asistente conversacional predeterminado de cada organización, garantizando cero pérdida de información ya cargada.
  - Endpoints `/api/kb` y `/api/kb/size`: soporte para el parámetro de consulta `?assistantId=...` para listar, computar métricas de caracteres e insertar conocimiento exclusivamente asignado al asistente en edición.
  - Interfaz de Gestión (`/agent`): al alternar entre asistentes en el selector, el panel actualiza dinámicamente el título contextual (*Base de Conocimiento · {Nombre}*), sus entradas asociadas y el conteo de volumen.
  - Pipeline LLM (`pipeline.ts`): inyección estricta en el System Prompt de la base de conocimiento exclusiva del asistente conversacional asignado a la línea telefónica receptora, evitando cruces de información entre múltiples negocios/marcas de una misma organización.
- **Identificación Visual de Líneas Telefónicas en Bandeja de Entrada (`/inbox`)**:
  - Componente determinista `LineBadge`: asigna colores armónicos y contrastantes (esmeralda, índigo, ámbar, púrpura, cielo, rosa, teal) basados en el identificador o nombre de la línea receptora.
  - Lista de Conversaciones (`conversation-list.tsx`): renderizado de una insignia de color con el nombre comercial asignado a la línea (ej. `ice frut`, `iqiss mexico`) en cada tarjeta de chat.
  - Panel de Detalles de Contacto (`contact-panel.tsx`): visualización de la insignia y nombre de la línea junto al número de teléfono formateado en la sección "Línea receptora".
- **Diagnóstico y Trazabilidad en Pipeline de Respuestas IA**:
  - Corrección en la llamada `chatJson` de `pipeline.ts` pasando `{ organizationId }` para asegurar la lectura de la API Key de OpenRouter configurada en la BD por organización.
  - Inclusión de registros estructurados (`console.log`, `console.warn`, `console.error`) para monitorear en tiempo real la resolución de líneas, asistentes y generación de respuestas del bot.
- **Indicador de Fortaleza y Validación de Contraseñas en Registro de Clientes (`/portal/register`)**:
  - Medidor de seguridad dinámico en tiempo real con barra de progreso de 4 niveles cromáticos (*Débil*, *Regular*, *Buena*, *Segura*).
  - Checklist interactivo con validación instantánea de 4 criterios obligatorios: mínimo 8 caracteres, al menos 1 mayúscula, al menos 1 minúscula y al menos 1 número.
  - Bloqueo preventivo del botón de envío en frontend hasta que la contraseña cumpla los 4 criterios de seguridad.
  - Validación espejo en backend mediante validador estricto Pydantic (`validate_password_strength`) en `CustomerRegisterRequest` (`portal_auth.py`), rechazando con `HTTP 422` contraseñas no conformes.
  - Preservación de la experiencia de login en `/portal/login` sin alterar el ingreso habitual de los usuarios.
- **Gestión Multi-rol y Concesión de Acceso a Clientes desde Usuarios del Sistema (`/admin/users`)**:
  - Soporte multi-rol en la API Central: extensión de `SystemUserResponse` con campos `roles: List[str]`, `has_customer_role: bool` y `customer_id`.
  - Nuevo endpoint `PUT /api/admin/users/{user_id}/customer-role`: permite a un administrador conceder acceso al Portal de Clientes a cualquier usuario interno (admin, partner, contact), creando o reactivando su perfil de `Customer` y sus credenciales de webhook con sus mismas credenciales de inicio de sesión.
  - Nuevo endpoint `DELETE /api/admin/users/{user_id}/customer-role`: revoca el rol de cliente y desactiva el perfil empresarial (`is_active = False`) preservando el historial de membresías, transacciones e integridad referencial sin eliminar datos.
  - Actualización de `/admin/users` en frontend:
    - Badges visuales independientes por cada rol asignado (*Admin*, *Partner*, *Contacto*, *Cliente*).
    - Botón contextual interactivo por fila: `+ Acceso Cliente` (abre modal para capturar razón social, contacto, teléfono y RFC) y `✕ Revocar Cliente` (abre modal de confirmación con detalle preventivo).
- **Integración y Normalización de Pruebas con Mercado Pago Suscripciones**:
  - Control de entorno desacoplado mediante la variable `ENVIRONMENT`: en entornos que no sean producción (`ENVIRONMENT != "production"`), se activa el modo de pruebas permitiendo sustituir el pagador por un usuario de pruebas oficial de Mercado Pago sin afectar la base de datos de clientes local.
  - Normalizador inteligente de cuentas de prueba (`mercadopago_resolved_test_payer_email`): convierte automáticamente tanto nicknames o IDs numéricos (`TESTUSER1968490994194015693`) como correos directos al formato oficial exigido por la API de Mercado Pago (`test_user_...xyz@testuser.com`), evitando el error `400 Both payer and collector must be real or test users`.
  - Mensajes de diagnóstico pedagógicos en la API ante respuestas no exitosas de la pasarela.
- **Componente Centralizado y Escalable de Autenticación y Carga (`AuthGuard.tsx`)**:
  - Creación de [AuthGuard.tsx](file:///Users/laclavees12345/code/iqissmexico/main/web/src/components/AuthGuard.tsx), centralizando la lógica de verificación de sesión, endpoints de validación (`/api/admin/auth/me`, `/api/portal/auth/me`), limpieza automática de tokens caducados y redirección contextual (incluyendo intención de checkout pendiente `getCheckoutIntent()`).
  - Provisión de subcomponentes modulares:
    - `<GuestGuard>`: Protege rutas de solo visitantes (login y registro tanto de admin como de cliente), encapsulando la comprobación y evitando renderizado innecesario o duplicación de estados locales.
    - `<AuthRedirect>`: Despachador para rutas raíz (`/admin` y `/portal`), dirigiendo transparentemente al usuario a su dashboard o al login correspondiente.
    - `<FullScreenLoader>`: Componente visual unificado para pantallas de carga a pantalla completa con spinner animado y mensaje configurable.
  - Refactorización y eliminación de código duplicado en:
    - [portal/page.tsx](file:///Users/laclavees12345/code/iqissmexico/main/web/src/app/%28customers%29/portal/page.tsx)
    - [portal/login/page.tsx](file:///Users/laclavees12345/code/iqissmexico/main/web/src/app/%28customers%29/portal/login/page.tsx)
    - [portal/register/page.tsx](file:///Users/laclavees12345/code/iqissmexico/main/web/src/app/%28customers%29/portal/register/page.tsx)
    - [admin/page.tsx](file:///Users/laclavees12345/code/iqissmexico/main/web/src/app/%28admin%29/admin/page.tsx)
    - [admin/login/page.tsx](file:///Users/laclavees12345/code/iqissmexico/main/web/src/app/%28admin%29/admin/login/page.tsx)
- **Validación M2M Centralizada mediante Introspección (Single Source of Truth)**:
  - Creación del endpoint [internal_products.py](file:///Users/laclavees12345/code/iqissmexico/main/api/app/api/internal_products.py) (`POST /api/internal/products/verify-secret`) en la API Central para permitir que los microservicios satélite (como el CRM) validen en tiempo real si un token M2M recibido es legítimo.
  - Soporte nativo paraPeriodo de Gracia: la API valida tanto la clave activa (`Product.api_secret_encrypted` o variable de entorno) como la clave anterior (`Product.api_secret_previous`) mediante comparaciones seguras timing-safe (`secrets.compare_digest`).
  - Creación del helper reutilizable [api-verifier.ts](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/server/provision/api-verifier.ts) en el microservicio CRM con caché en memoria (TTL 30s) y fallback local secundario.
  - Desacoplamiento total del CRM: el CRM ya no depende de tener llaves maestras estáticas duplicadas en sus archivos `.env`; consulta directamente a la API central.
  - Integración en `authenticateProvisionRequest` ([auth.ts](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/server/provision/auth.ts)) y `resolveAuthorizedOrg` ([provision/route.ts](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/app/api/settings/whatsapp/provision/route.ts)).
  - Pruebas unitarias añadidas en `test_provisioning.py` (47/47 tests OK) y pruebas E2E en vivo validadas con códigos `401 Unauthorized` ante tokens falsos y `201 Created` ante tokens legítimos.
- **Comando CLI de Inicialización de Catálogo**:
  - Incorporación del comando `catalog:seed` en `manage.py` de la API para desplegar de forma automatizada productos y membresías base en entornos locales o de producción.
- **Comando CLI de Rotación Automatizada de Llaves M2M (`security:rotate-keys`)**:
  - Nuevo comando en [manage.py](file:///Users/laclavees12345/code/iqissmexico/main/api/manage.py) respaldado por [rotate_m2m_keys.py](file:///Users/laclavees12345/code/iqissmexico/main/api/scripts/rotate_m2m_keys.py) para tareas programadas (Coolify Cron `10 0 * * *` a las 00:10 horas).
  - Rota las claves secretas de todos los productos en la base de datos generando llaves criptográficas de 256 bits (`secrets.token_hex(32)`), cifrándolas con AES-256-GCM y aplicando automáticamente el periodo de gracia en `api_secret_previous` para evitar interrupciones de servicio. Admite `--slug <producto>` y flag `--dry-run`.

## [1.3.0] - 2026-09-03

### Añadido

- **Vinculación Directa de Cuentas WABA Propias (Tech Provider / System User Token)**:
  - Soporte nativo para cuentas empresariales propias ("Owned WABA") mediante token permanente de Usuario del Sistema configurado de forma segura en el backend (`META_SYSTEM_USER_TOKEN` y `META_BUSINESS_ID`).
  - Cero exposición de credenciales: el token reside exclusivamente en el entorno del servidor API y jamás viaja por red ni se manipula en formularios web del frontend.
  - Montaje de volumen seguro `./api/.env:/app/.env:ro` en el contenedor `api` de Docker Compose para persistencia y lectura en tiempo real por Pydantic, garantizando disponibilidad inmediata tras reinicios.
- **Detección Automatizada en Meta Graph API v26.0**:
  - Endpoint `GET /api/admin/crm/waba-accounts`: Consulta y lista automática de cuentas empresariales WABA del Business Manager de Meta (*ice frut*, *Diana Iqmx*, etc.).
  - Endpoint `GET /api/admin/crm/waba-accounts/{waba_id}/phone-numbers`: Consulta y detección en tiempo real de líneas telefónicas con estado operativo (`CONNECTED`), calidad de línea (`GREEN`) y plataforma (`CLOUD_API`).
  - Endpoint `POST /api/admin/crm/connect-waba-number`: Ejecuta la suscripción de la WABA en Meta (`POST /{waba_id}/subscribed_apps`), cifra el token en `public.whatsapp_numbers` con AES-256-GCM y despacha el aprovisionamiento M2M directo al CRM asignando el `organizationId` correspondiente.
- **Validación Estricta de Unicidad de Líneas entre Clientes e Inquilinos**:
  - Protección preventiva en API Central (`admin_crm.py` y `portal_whatsapp.py`) contra duplicación de `phone_number_id` y coincidencias de dígitos telefónicos normalizados (`display_phone_number`).
  - Rechazo con código `HTTP 409 Conflict` e identificación explícita de la empresa si se intenta registrar una línea que ya pertenece a otro cliente, garantizando la privacidad y el enrutamiento correcto de webhooks.
- **Rediseño Ergonómico de la Tabla de Gestión CRM (`/admin/crm`)**:
  - Consolidación de 9 columnas desbordadas a 5 columnas estratégicas: *Organización y Cliente*, *Plan y Capacidad*, *Servicios (IA y Módulos)*, *Estado* y *Acciones M2M*.
  - Acciones con espaciado holgado y botones claros (`+ Línea`, `Sync`, `Ajustar Límites`, `Suspender/Activar`) visibles sin scroll horizontal forzado.
- **Búsqueda y Paginación Escalable**:
  - Filtro reactivo en tiempo real por nombre de organización, ID de inquilino, cliente corporativo o correo electrónico.
  - Selector de tamaño de página (10, 25, 50 registros) y controles de navegación de página (*Anterior / Siguiente*).
- **Asignación Contextual Automática en Modal**:
  - Detección automática del inquilino destino al pulsar `+ Línea` desde su fila correspondiente en la tabla, bloqueando la selección e identificando la organización con una tarjeta visual para eliminar selecciones redundantes.
- **Descentralización de Inteligencia Artificial Multi-tenant (OpenRouter)**:
  - Cada organización ahora gestiona sus propias credenciales de Inteligencia Artificial desde el microservicio CRM en `/settings/ai`.
  - Cifrado en reposo AES-256-GCM para la API Key de OpenRouter (`ai_api_key_encrypted`), garantizando que las credenciales nunca viajen en texto plano al navegador.
  - Soporte de modelo conversacional principal y modelo evaluador/juez (`aiJudgeModel`) para las evaluaciones automatizadas del Laboratorio.
  - Base URL editable (con valor predeterminado `https://openrouter.ai/api`) y ventana de agrupación de mensajes entrantes (`agentCoalesceMs`).
  - Endpoint de prueba en dos pasos (`POST /api/settings/ai/test`): valida la clave de API contra `/v1/auth/key` y realiza una prueba en vivo con reporte de latencia y detección precisa de saturación (Rate Limit 429).
- **Catálogo Dinámico de Modelos de OpenRouter**:
  - Endpoints con caché en memoria en CRM (`/api/settings/ai/models`) y en la API Central (`/api/admin/crm/ai-models`) conectados a la API oficial de OpenRouter.
  - Autocompletador interactivo (`datalist`) en CRM y Portal de Administración Central que permite buscar entre más de 420 modelos o escribir manualmente cualquier identificador.
  - Accesos directos y precarga por defecto de modelos gratuitos de OpenRouter (sin costo por token) como `minimax/minimax-m2.7:free` y `liquid/lfm-2.5-2.6b:free`.
- **Supervisión y Asistencia Administrativa Centralizada (`/admin/crm`)**:
  - Extensión del pipeline M2M (`PATCH /api/admin/crm/tenants/{org_id}/override` hacia `PATCH /api/provision/tenant/{id}/features`) para permitir que el administrador asista o configure las credenciales de IA de cualquier cliente sin endpoints paralelos.
  - Normalizador automático de nomenclatura en el CRM (`toCamel`), aceptando indistintamente cargas útiles en `snake_case` o `camelCase`.
  - Nueva columna de estado de Inteligencia Artificial en la tabla de organizaciones y controles en el modal de ajustes manuales.
- **Laboratorio Desacoplado**:
  - `judgeCase` y el pipeline del agente ahora resuelven dinámicamente las credenciales y modelos directamente desde la base de datos por `organizationId`.

### Modificado

- **Alineación de Fuente Única de Verdad en el CRM**:
  - Sustitución del formulario manual desalineado en `/settings/whatsapp` por una guía informativa orientativa hacia el Portal Central, garantizando que toda línea cuente con webhooks suscritos en Meta.
- **Corrección de Estilos en Switch de Atención con IA (`whatsapp-wizard.tsx`)**:
  - Reemplazo de clases CSS inexistentes (`bg-knob`) por el diseño estándar de Tailwind CSS (`bg-white shadow-sm` y `bg-primary`), resolviendo la distorsión visual del selector de activación de IA.
- **Limpieza de Variables de Entorno Globales**:
  - Eliminadas las dependencias globales `OPENROUTER_API_TOKEN` y `OPENROUTER_MODEL` de `crm/.env`, logrando un desacoplamiento multi-tenant completo.
- **Red de Comunicación M2M en Docker**:
  - Priorización de `settings.CRM_SERVICE_URL` (`http://crm:3000`) para llamadas de backend a backend, resolviendo conflictos de resolución cuando la URL pública de navegación apunta a `localhost`.
- **Refinamiento de Textos y UI**:
  - Eliminación de paréntesis innecesarios en menciones de OpenRouter en el CRM y en el Panel Web de Administración.
  - Actualización del mapa de arquitectura y comandos en `README.md`.

### Eliminado

- **Microservicio Legado de Chatbot**:
  - Eliminación completa del contenedor y directorio `chatbot/` (LangGraph) en favor de la arquitectura unificada y autónoma provista por el CRM.
  - Retiro de la definición del servicio `chatbot` en `docker-compose.yml` y de sus dependencias en `requirements-dev.txt`.
  - Desregistro del enrutador de chatbot en la API Central (`api/app/main.py`).

---

## [1.1.0] - 2026-09-02

### Añadido

- **Portal de Clientes WhatsApp**:
  - Registro de clientes (`/portal/register`) con captura de datos fiscales, contacto y consentimiento legal explícito del Aviso de Privacidad y Términos de Servicio.
  - Autenticación y control de acceso (`/portal/login`) mediante JWT seguro almacenado en sesión local.
  - Panel de Control modular (`/portal/dashboard`) estructurado en 5 componentes autónomos:
    - `DashboardHeader`: Identidad corporativa y métricas de conexión.
    - `FeedbackAlert`: Notificaciones y avisos de estado.
    - `WhatsAppAccountsSection`: Gestión de líneas comerciales oficiales.
    - `WebhookConfigSection`: Enlace de conexión al CRM del cliente, gestión de clave secreta y pruebas de conectividad en tiempo real.
    - `DeliveryDiagnosticSection`: Monitoreo y auditoría de sincronización de eventos.
    - `PortalLoader`: Componente global para estados de carga y transiciones de pantalla completa.
- **Onboarding de WhatsApp Meta (Coexistencia)**:
  - Integración completa con Meta Embedded Signup sobre Meta Graph API y Facebook SDK `v26.0`.
  - Soporte de coexistencia para que el cliente continúe usando la aplicación de WhatsApp Business en su celular en paralelo con la API.
  - Mecanismo dual de autenticación: ejecución nativa con `FB.login` sobre HTTPS y ventana emergente directa oficial OAuth `v26.0` como respaldo.
- **Gateway Despachador de Webhooks a CRMs Externos**:
  - Recepción unificada de eventos de WhatsApp con soporte de doble ruta para máxima compatibilidad: `/api/webhooks/whatsapp` y ruta directa `/whatsapp`.
  - Identificación automática de clientes por número telefónico (`phone_number_id`).
  - Almacenamiento persistente en base de datos (`events`) para depuración y trazabilidad.
  - Soporte de clave secreta flexible: editable manualmente por el usuario, generable aleatoriamente desde la interfaz, u opcional (vacía) para pruebas de integración rápidas sin firma criptográfica.
  - Firma condicional HMAC-SHA256 (`X-Signature: sha256=...`) y cabecera estándar `Authorization: Bearer <token>` cuando se define una clave secreta.
  - Handshake de verificación de Webhooks con método GET estilo Meta (`hub.mode=subscribe`, `hub.challenge`, `hub.verify_token`) en el botón "Probar Conexión", con fallback a POST.
  - Prefijo visual descriptivo `POST` en el campo de dirección web del portal de clientes.
  - Despacho asíncrono hacia la URL del CRM del cliente con firmas criptográficas `X-Signature: sha256=...`.
  - Política de reintentos automáticos ante errores 4xx o 5xx en intervalos escalonados de 15, 30 y 60 segundos (máximo 3 intentos).
  - Marcado automático de estado como `sent` cuando el cliente no tiene una URL configurada.
- **Modelos de Datos y Base de Datos**:
  - Modelo `Customer` vinculado a la tabla `User`.
  - Tabla pivote `user_has_role` y tabla `Role` con soporte de roles granulares (`customer`, `admin`, etc.).
  - Modelo `WhatsAppNumber` para el inventario de líneas vinculadas y tokens cifrados.
  - Modelo `CustomerWebhook` para registrar la URL de destino, clave secreta y métricas de entrega.
  - **Sistema de Migraciones con Alembic**:
    - Inicialización de `alembic` integrado con `settings.db_url` y `Base.metadata`.
    - Primera migración versionada (`3cc3ae5bc5c3_create_portal_models_and_events_tracking.py`) para crear tablas del portal y extender la tabla `events` de forma segura.
    - Soporte de ejecución automatizada mediante post-deploy en Coolify (`alembic upgrade head`).
- **Suite de Pruebas Automatizadas del Backend**:
  - 14 pruebas unitarias y de integración en `api/tests/`: criptografía AES-GCM, HMAC-SHA256, validador anti-SSRF, registro y login del portal, handshake de Meta y flujo de entrega de webhooks.

### Modificado

- **Unificación de Servicios Webhook y API**:
  - Integración completa de las rutas del Webhook de WhatsApp dentro de la API Central de FastAPI en el puerto 8000, reduciendo el consumo de memoria y la latencia inter-servicios.
- **Arquitectura de Proxy Rewrites en Next.js**:
  - Configuración de `rewrites` en `next.config.ts` para reenviar internamente `/api/:path*` al contenedor de FastAPI (`http://api:8000`).
  - Conversión de peticiones del frontend a rutas relativas (`/api/...`), eliminando problemas de Contenido Mixto (Mixed Content) y CORS al operar bajo túneles ngrok o dominios externos.
- **Rediseño Visual del Portal**:
  - Armonización estética completa con la paleta de colores corporativa de IQISSMexico (fondo claro `bg-gray-50`, tarjetas blancas limpias y botones en azul institucional `bg-blue-600`).
  - Redacción empresarial profesional en toda la interfaz sin tecnicismos ni aclaraciones entre paréntesis.

### Eliminado

- Microservicio independiente y directorio `webhook/`.
- Dependencia redundante de `webhook/requirements.txt` en `requirements-dev.txt`.
- Variable de entorno `NEXT_PUBLIC_API_URL` por ser innecesaria tras la implementación de proxy rewrites.
- Envíos nativos de formularios HTML que provocaban recargas involuntarias de página en el login.

### Seguridad

- **Cifrado en Reposo**: Almacenamiento de tokens de acceso permanente de WhatsApp mediante cifrado simétrico AES-256-GCM.
- **Protección Anti-SSRF**: Bloqueo de peticiones dirigidas a direcciones IP privadas, de loopback (`localhost`, `127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`) y validación obligatoria de protocolo HTTPS para las URLs de destino de los clientes.
- **Validación Criptográfica de Meta**: Verificación obligatoria de la cabecera `X-Hub-Signature-256` utilizando `META_APP_SECRET`.
- **Aislamiento de Credenciales**: `META_APP_SECRET` confinado de forma estricta al backend (`api/.env`), inaccesible para el navegador.

---

## [1.0.0] - 2026-08-30

### Añadido

- Arquitectura inicial de microservicios con orquestación mediante Docker Compose.
- Sitio web principal de IQISSMexico en Next.js.
- Microservicio de Chatbot con soporte de inteligencia artificial y embeddings vectoriales (pgvector).
- API Central en FastAPI conectada a PostgreSQL.
