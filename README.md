# IQMX Main Server (Orquestación de Microservicios)

Este repositorio contiene la arquitectura de microservicios para el proyecto de IQISS México. Los servicios están estructurados de forma modular e independiente para facilitar el desarrollo local y automatizar la orquestación en producción.

---

## 🛠️ Estructura del Proyecto

```text
main-server/
├── docker-compose.yml        # Orquestador multi-contenedor (PostgreSQL, API Central, CRM, Web)
├── CHANGELOG.md              # Registro cronológico estandarizado de cambios (Keep a Changelog)
├── README.md                 # Documentación general para humanos y agentes AI
├── .gitignore                # Exclusiones de control de versiones raíz
├── web/                      # Portal de Clientes, Administración Central y Landing (Next.js 16)
│   ├── Dockerfile            # Empaquetado optimizado standalone para producción
│   └── package.json
├── crm/                      # Microservicio CRM Autónomo (Next.js 15, Drizzle ORM, WhatsApp, IA)
│   ├── Dockerfile
│   └── package.json
└── api/                      # API Central Unificada (FastAPI, Webhooks de WhatsApp, Auth, Catálogo y M2M)
    ├── app/
    │   ├── api/              # Rutas: Portal Auth, WhatsApp Coexistencia, Webhook Gateway, Admin CRM, Catálogo
    │   ├── db/               # Base de datos, reset y semillas
    │   ├── lib/              # Criptografía AES-GCM, HMAC-SHA256, validador anti-SSRF
    │   └── models/           # Modelos centralizados (Customer, User, Roles, WhatsAppNumber, etc.)
    ├── tests/                # Suite de pruebas automatizadas unitarias y de integración
    ├── run.py                # Script de ejecución del servidor Uvicorn
    └── requirements.txt
```

---

## 🚀 Desarrollo Local con Docker

Para iniciar todo el entorno local (PostgreSQL, API Central, CRM y Web Next.js):

```bash
docker compose up --build -d
```

### Servicios Locales Disponibles
- **API Central y Webhook Gateway**: Accesible en `http://localhost:8000`
- **Next.js Web y Portal de Clientes**: Accesible en `http://localhost:3001`
- **Microservicio CRM**: Accesible en `http://localhost:3000`
- **PostgreSQL (pgvector)**: Accesible en `localhost:5433` (5432 dentro de la red Docker)

---

## 🧪 Pruebas Automatizadas del Backend

Para ejecutar la suite de pruebas de seguridad y lógica de negocio:

```bash
docker exec iqmx-api python tests/run_tests.py
```

---

## 📦 Migraciones de Base de Datos (Alembic)

El proyecto utiliza **Alembic** para el versionado y control de cambios en la base de datos PostgreSQL.

### Comando Post-Deploy en Coolify / Producción:
En la configuración del servicio de la API dentro de Coolify, en la sección **Post-deployment Command**, configure:
```bash
alembic upgrade head
```
*(O desde el host del servidor: `docker exec iqmx-api alembic upgrade head`)*.

### Generar una nueva migración (Desarrollo):
Si añade o modifica columnas o modelos en `api/app/models/`:
```bash
docker exec -w /app iqmx-api alembic revision --autogenerate -m "nombre_de_la_migracion"
```

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
