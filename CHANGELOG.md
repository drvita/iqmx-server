# Registro de Cambios (Changelog)

Todas las modificaciones notables de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
  - Despacho asíncrono hacia la URL del CRM del cliente con firmas criptográficas `X-Signature: sha256=...`.
  - Política de reintentos automáticos ante errores 4xx o 5xx en intervalos escalonados de 15, 30 y 60 segundos (máximo 3 intentos).
  - Marcado automático de estado como `sent` cuando el cliente no tiene una URL configurada.
- **Modelos de Datos y Base de Datos**:
  - Modelo `Customer` vinculado a la tabla `User`.
  - Tabla pivote `user_has_role` y tabla `Role` con soporte de roles granulares (`customer`, `admin`, etc.).
  - Modelo `WhatsAppNumber` para el inventario de líneas vinculadas y tokens cifrados.
  - Modelo `CustomerWebhook` para registrar la URL de destino, clave secreta y métricas de entrega.
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
