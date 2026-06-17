# IQMX Main Server (Orquestación de Microservicios)

Este repositorio contiene la arquitectura de microservicios para el proyecto de IQISS México. Los servicios están estructurados de forma modular e independiente para facilitar el desarrollo local y automatizar la orquestación en producción.

---

## 🛠️ Estructura del Proyecto

```text
main-server/
├── docker-compose.yml        # Orquestador multi-contenedor para producción (Coolify)
├── docker-compose.local.yml  # Orquestador local de desarrollo (con PostgreSQL pgvector y volumen SQLite)
├── README.md                 # Documentación general para humanos y agentes AI
├── .gitignore                # Exclusiones de control de versiones raíz
├── web/                      # Sitio web principal de la empresa (Next.js)
│   ├── Dockerfile            # Empaquetado optimizado standalone para producción
│   └── package.json
├── webhook/                  # Microservicio receptor de Webhooks (Stateless)
│   ├── app/                  # Código de FastAPI
│   │   ├── api/              # Endpoints (whatsapp.py)
│   │   └── lib/              # Librerías (seguridad y validación de firma)
│   ├── run.py                # Script para ejecución local
│   └── requirements.txt
└── api/                      # Microservicio API Central (Privado / Base de datos)
    ├── app/                  # Código de FastAPI
    │   ├── api/              # Endpoints (events.py)
    │   ├── db/               # Base de datos, reset (reset.py) y semillas (seeds.py)
    │   ├── lib/              # Helpers de utilidades (security.py)
    │   └── models/           # Modelos centralizados (un archivo por modelo)
    ├── run.py                # Script para ejecución local
    └── requirements.txt
```

---

## 🚀 Desarrollo Local con Docker

Para iniciar todo el entorno de desarrollo local (incluyendo base de datos PostgreSQL, API, Webhook y Web) ejecute:

```bash
docker compose -f docker-compose.local.yml up --build
```

### Servicios Locales Disponibles
- **Webhook**: Accessible at `http://localhost:8000`
- **Central API**: Accessible at `http://localhost:8001`
- **Next.js Web**: Accessible at `http://localhost:3000`
- **PostgreSQL (pgvector)**: Accessible at `localhost:5432`

*Nota: La persistencia de datos local está configurada con volúmenes nombrados para evitar la pérdida de información al destruir contenedores:*
* `postgres_data` para el contenedor de PostgreSQL.
* `sqlite_data` (mapeado a `/app/data` en la API) para persistir la base de datos de SQLite en caso de utilizar dicho motor localmente.

---

## 🔄 Reset de Base de Datos en Desarrollo

Si agrega nuevos campos o modelos durante el desarrollo local y desea recrear la base de datos desde cero sin utilizar migraciones de Alembic por el momento:

```bash
# Entre al directorio de api
cd api

# Ejecute el script de restauración
.venv/bin/python -m app.db.reset
```

*Nota: Este comando eliminará todas las tablas, las recreará con la estructura de modelos actual y volverá a aplicar las semillas (seeds). En producción (`production`), este comando pedirá confirmación manual escribiendo `RESET` y no podrá ejecutarse en entornos no interactivos.*

---

## 🐳 Producción (Coolify / Docker Compose)

El archivo `docker-compose.yml` en la raíz se encarga de empaquetar y enlazar los servicios de manera nativa para producción. Las redes están configuradas para usar la red externa de Coolify (`coolify`).

```bash
docker compose up --build -d
```

### Variables de Entorno Requeridas en Producción

| Variable | Descripción | Requerido en Prod |
| :--- | :--- | :---: |
| `ENVIRONMENT` | Tipo de entorno (debe ser `production`) | Sí |
| `ALLOWED_ORIGINS` | Orígenes CORS separados por coma (no se permite `*` en prod) | Sí |
| `WHATSAPP_VERIFY_TOKEN` | Token de verificación usado por Meta (handshake GET) | Sí |
| `META_APP_SECRET` | Clave secreta de la app en Meta para validar la cabecera `X-Hub-Signature-256` | Sí |
| `DATABASE_TYPE` | Selector de base de datos (`sqlite` o `postgresql`) | No (Default: `sqlite`) |

---

## 🤖 Guía para Agentes AI y Desarrolladores

- **Language Standard**: Todos los mensajes de consola, logs y comentarios de código nuevos deben escribirse en **inglés** por estándar del proyecto.
- **Configuración de Variables**: Si crea nuevas configuraciones, actualice obligatoriamente `config.py` usando Pydantic Settings y documente la variable en `.env.example`.
- **Base de Datos**: La lógica de base de datos utiliza SQLAlchemy. Evite escribir SQL nativo; utilice las sesiones inyectadas por dependencias `Depends(get_db)`.
- **Seguridad**: Todas las peticiones POST externas en `webhook/api/whatsapp.py` deben validar la cabecera `X-Hub-Signature-256` usando la dependencia `verify_whatsapp_signature`. No retire esta dependencia.
