# IQMX Main Server (Orquestación de Microservicios)

Este repositorio contiene la arquitectura de microservicios para el proyecto de IQISS México. Los servicios están estructurados de forma modular e independiente para facilitar el desarrollo local y automatizar la orquestación en producción.

---

## 🛠️ Estructura del Proyecto

```text
main-server/
├── docker-compose.yml        # Orquestador multi-contenedor (PostgreSQL, API Central, Chatbot, Web)
├── CHANGELOG.md              # Registro cronológico estandarizado de cambios (Keep a Changelog)
├── README.md                 # Documentación general para humanos y agentes AI
├── .gitignore                # Exclusiones de control de versiones raíz
├── web/                      # Portal de Clientes y Sitio Web Oficial (Next.js 16)
│   ├── Dockerfile            # Empaquetado optimizado standalone para producción
│   ├── src/app/portal/       # Portal de Clientes con onboarding de WhatsApp y gestión de Webhooks
│   └── package.json
├── chatbot/                  # Servicio de Inteligencia Artificial y Chatbot
│   ├── Dockerfile
│   └── run.py
└── api/                      # API Central Unificada (FastAPI, Webhooks de WhatsApp, Auth y Despacho)
    ├── app/
    │   ├── api/              # Rutas: Portal Auth, WhatsApp Coexistencia, Webhook Gateway, Chatbot
    │   ├── db/               # Base de datos, reset (reset.py) y semillas (seeds.py)
    │   ├── lib/              # Criptografía AES-GCM, HMAC-SHA256, validador anti-SSRF
    │   └── models/           # Modelos centralizados (Customer, User, Roles, WhatsAppNumber, etc.)
    ├── tests/                # Suite de pruebas automatizadas unitarias y de integración
    ├── run.py                # Script de ejecución del servidor Uvicorn
    └── requirements.txt
```

---

## 🚀 Desarrollo Local con Docker

Para iniciar todo el entorno local (PostgreSQL, API Central, Chatbot y Web Next.js):

```bash
docker compose up --build -d
```

### Servicios Locales Disponibles
- **API Central y Webhook Gateway**: Accesible en `http://localhost:8000`
- **Next.js Web y Portal de Clientes**: Accesible en `http://localhost:3000`
- **Chatbot Service**: Accesible en `http://localhost:8002`
- **PostgreSQL (pgvector)**: Accesible en `localhost:5432`

---

## 🧪 Pruebas Automatizadas del Backend

Para ejecutar la suite de pruebas de seguridad y lógica de negocio:

```bash
docker exec iqmx-api python tests/run_tests.py
```

---

## 🐳 Producción

El archivo `docker-compose.yml` en la raíz se encarga de empaquetar y enlazar los servicios.

```bash
docker compose up --build -d
```

### Variables de Entorno Requeridas

#### En `api/.env`:
- `META_APP_ID`: ID de la aplicación de Meta.
- `META_APP_SECRET`: Clave secreta de la aplicación en Meta.
- `META_CONFIG_ID`: ID de configuración del flujo de Embedded Signup.
- `WHATSAPP_VERIFY_TOKEN`: Token de verificación del webhook de WhatsApp.
- `TOKEN_ENCRYPTION_KEY`: Clave AES-256 de 32 bytes para cifrar tokens de WhatsApp en reposo.
- `JWT_SECRET_KEY`: Clave HMAC para la emisión de tokens JWT de sesión del portal.

#### En `web/.env`:
- `API_URL`: URL interna para proxy de Next.js hacia la API (`http://api:8000`).
- `NEXT_PUBLIC_META_APP_ID`: ID público de la aplicación en Meta.
- `NEXT_PUBLIC_META_CONFIG_ID`: ID de configuración pública para Meta Embedded Signup.

---

## 🤖 Guía para Desarrolladores

- **Seguridad**: Todas las peticiones entrantes de Meta en `/api/webhooks/whatsapp` validan la firma `X-Hub-Signature-256`.
- **Despacho Seguro Anti-SSRF**: Todo reenvío de webhooks hacia sistemas o CRMs externos valida las direcciones IP para bloquear accesos hacia redes privadas o locales.
