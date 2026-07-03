# Restaurant Assistant Agent (LangGraph & FastAPI Webhook)

Este proyecto implementa un agente conversacional inteligente para restaurantes utilizando **LangGraph** y expuesto a través de un servicio de webhooks con **FastAPI**. El asistente ayuda a los clientes a consultar el menú, gestionar un carrito de compras interactivo, registrar quejas y realizar pedidos directamente desde plataformas de mensajería (ej. Telegram).

## Características Principales

* **Asistente Virtual Inteligente:** Entrenado con directrices específicas para atención al cliente, amigable, educado y orientado a ventas.
* **Búsqueda Semántica de Menú:** Búsqueda inteligente de platillos usando embeddings (`models/gemini-embedding-001`) y similitud de coseno en Python puro. Los embeddings del menú se cargan en caché al inicio, minimizando latencia y consumo de API.
* **Carrito de Compras Persistente:** Permite ver el carrito, agregar productos con cantidades y registrar notas o personalizaciones de cocina (ej: *"sin cebolla"*).
* **Gestión de Pedidos y Quejas:** Las órdenes se registran en una base de datos relacional y vacían el carrito una vez confirmadas. Las quejas de los usuarios quedan almacenadas para seguimiento.
* **Persistencia Híbrida (SQLite/PostgreSQL):** Utiliza SQLite local (`demo.sqlite`) para desarrollo rápido y soporta el checkpointer `PostgresSaver` de LangGraph para producción en la nube.
* **Estructura Escalable:** Diseño modular basado en routers de FastAPI, permitiendo añadir fácilmente webhooks para otros canales (como WhatsApp o Messenger) en el futuro.

---

## Estructura del Proyecto

```
├── Dockerfile                  # Empaquetado de contenedor para producción
├── docker-compose.yml          # Orquestador del servicio para Coolify/Docker
├── requirements.txt            # Dependencias del proyecto
├── storage/
│   ├── menu.csv                # Menú del restaurante con ID, nombre, descripción y precio
│   └── demo.sqlite             # Base de datos local autogenerada
└── src/
    ├── main.py                 # Punto de entrada del servidor FastAPI
    ├── endpoints/              # Enrutadores de Webhook por canal (ej: Telegram)
    ├── lib/                    # Librerías compartidas (ej: Cliente API de Telegram)
    └── agent/                  # Paquete principal del agente (LangGraph)
        ├── graph.py            # Ensamblado del Grafo y enrutamiento
        ├── state.py            # Definición del Estado del Agente (AgentState)
        ├── nodes/              # Nodos del grafo (chatbot_node)
        ├── utils/              # Utilidades de LLM, embeddings y persistencia de DB
        └── tools/              # Herramientas de negocio (carrito, menú, restaurante)
```

---

## Requisitos Previos

* Python 3.11 o superior.
* Una API Key de Google Gemini.
* Un Bot de Telegram y su respectivo Token (creado con `@BotFather` de Telegram).

---

## Instalación y Configuración

1. **Clonar el repositorio y acceder a la carpeta:**
   ```bash
   cd webhook
   ```

2. **Crear y activar un entorno virtual:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Instalar las dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configurar las variables de entorno:**
   Copie el archivo de ejemplo y configure sus claves:
   ```bash
   cp .env.example .env
   ```
   Ajuste las variables dentro de `.env`:
   * `GOOGLE_API_KEY`: Su API key de Gemini.
   * `TELEGRAM_BOT_TOKEN`: Su token de bot.
   * `DATABASE_TYPE`: Mantener en `sqlite` para local.

---

## Ejecución

### 1. Servidor de Webhooks (FastAPI)
Para levantar el servidor y escuchar peticiones HTTP de Telegram:
```bash
.venv/bin/uvicorn src.main:app --reload
```
La documentación interactiva estará disponible en `http://127.0.0.1:8000/docs`. El endpoint del webhook se localiza en `POST /api/webhooks/telegram`.

### 2. Consola Interactiva (CLI Local)
Si desea chatear con el agente directamente en su terminal sin configurar webhooks:
```bash
python src/agent/run.py
```

---

## Despliegue en Producción (Coolify / Docker)

Este proyecto está preparado para desplegarse de manera directa en **Coolify**.

1. Coolify inyectará de forma automática las variables de entorno (`GOOGLE_API_KEY`, `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`).
2. Al detectar la variable de entorno `DATABASE_TYPE=postgres` e inyectar `DATABASE_URL`, el agente cambiará automáticamente de SQLite a PostgreSQL (`PostgresSaver`) para garantizar escalabilidad.
3. El archivo `docker-compose.yml` construirá la imagen del contenedor basándose en el `Dockerfile` optimizado con dependencias nativas de PostgreSQL.
