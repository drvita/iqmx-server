# IQISSMexico - Directrices para Asistentes y Agentes de Código

Bienvenido al repositorio central de **IQISSMexico**. Sigue estas directrices en todas las interacciones:

## 1. Reglas Generales y Trato
- Dirígete siempre al usuario como **Ingeniero**.
- Sigue siempre las mejores prácticas de ingeniería de software (TypeScript estricto, componentes desacoplados y modulares, código limpio).
- Respuestas en GitHub Markdown con enlaces a archivos locales (`file:///...`).

## 2. Entornos de Ejecución
- **Frontend (`web/`):** Aplicación Next.js institucional y comercial. Corre en el puerto local **3001** (`http://localhost:3001`). El puerto 3000 está reservado para el CRM. Comprobaciones con `npm run build`.
- **Backend (`api/`):** API FastAPI. No ejecutar comandos de Python globalmente en el host. Utilizar Docker (`docker compose exec ...`) o el entorno virtual (`venv`).
- **CRM (`crm/`):** Plataforma multi-inquilino (Next.js 15, Drizzle ORM, PostgreSQL) en el puerto local **3000** (`http://localhost:3000`).
  - Validación técnica obligatoria: `npm run typecheck` y `npm test` (430+ tests unitarios) antes de dar por terminada una tarea.
  - Ciclo de reinicio en desarrollo Docker: tras modificar o compilar (`npm run build`), reiniciar el contenedor con `docker compose restart crm` y verificar respuesta con `curl -s http://localhost:3000/api/health`.

## 3. Arquitectura y Reglas del CRM Multi-Inquilino (`crm/`)
- **Aislamiento Multi-Tenant Estricto:** Toda tabla de dominio incluye `organization_id NOT NULL`. Toda consulta debe filtrar mediante `scoped(schema.tabla.organizationId, orgId)`.
- **Laboratorio de Calidad (`/lab`):**
  - **Encolamiento Cross-Tenant:** El servidor corre **1 benchmark global a la vez** para salvaguardar la prioridad principal del negocio (atención en tiempo real de WhatsApp). Si otro inquilino lanza una prueba mientras una está en curso, se encola con `status: "queued"` y se despacha automáticamente en orden FIFO al finalizar la anterior.
  - **Límite Intra-Tenant:** Ningún inquilino puede correr más de 1 benchmark a la vez.
  - **Concurrencia Controlada (2 en 2):** Dentro de una suite, los personajes se procesan de 2 en 2 para balancear latencia y cuota externa sin saturar.
  - **Salvaguarda de Timeout:** Timeout de seguridad inmutable de 10 minutos con `Promise.race` para abortar pruebas si las APIs de IA no responden.
  - **Cero Datos Mock Ajenos:** No usar preguntas predeterminadas de negocios inventados (ej. ferreterías). Si una suite no tiene preguntas configuradas por el inquilino, bloquear la corrida solicitando que primero las configure o genere con IA.
  - **Permiso de Agenda:** La suite de Pruebas de Agenda y Citas (`agenda_flow`) solo es visible y ejecutable si el inquilino tiene `agendaEnabled` activo.
- **Configuración del Asistente (`/agent`):**
  - El **System Prompt Central** del CRM ya orquesta automáticamente la agenda, horarios, base de conocimiento, pipeline y transferencias a humanos. Las instrucciones del usuario NO deben redactar horarios ni reglas de calendario para evitar contradicciones con el motor determinista.
- **Experiencia de Usuario y Estética:**
  - Sin tecnicismos, sin UUIDs ni prefijos técnicos, y sin guiones bajos (`_`) en etiquetas visibles.
  - No usar paréntesis explicativos innecesarios en títulos o botones.
  - Switches y controles deben usar componentes accesibles con tokens de Tailwind/shadcn (`inline-flex`, `border-2 border-transparent`, thumb blanco con `shadow-md`).

## 4. Protocolo de Changelog (`CHANGELOG.md`)
- **Regla estricta:** NO modifiques `CHANGELOG.md` a menos que el Ingeniero te lo pida explícitamente.
- **Validación de fecha:** Antes de registrar una nueva versión, valida la fecha actual en la metadata de la sesión (CST / UTC-6) y confirma si la fecha ya existe previamente.
- Sigue el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y SemVer.

## 5. Estructura de la Plataforma Web
- **`/` (Inicio):** Landing institucional y corporativa para IQISSMexico (Quiénes somos, Qué hacemos, Carrusel compacto de soluciones, Portal y Contacto).
- **`/productos`:** Catálogo oficial completo con todas las soluciones y modalidades (SaaS vs A la medida).
- **`/landingpage/crm`:** Landing especializada para CRM General (Ventas y Atención al Cliente con IA).
- **`/landingpage/crm/consultorio`:** Landing especializada para Salud y Consultorios Médicos.
- **`/admin/...`:** Panel administrativo para gestionar catálogo de productos, planes y clientes.
- **`/portal/...`:** Portal de autogestión para clientes.
