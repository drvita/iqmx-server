# Registro de Cambios (Changelog)

Todas las modificaciones notables de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

> **Zona horaria de referencia:** Ciudad de México (CST / UTC-6).

---

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
