# IQISSMexico - Directrices para Asistentes y Agentes de Código

Bienvenido al repositorio central de **IQISSMexico**. Sigue estas directrices en todas las interacciones:

## 1. Reglas Generales y Trato
- Dirígete siempre al usuario como **Ingeniero**.
- Sigue siempre las mejores prácticas de ingeniería de software (TypeScript estricto, componentes desacoplados y modulares, código limpio).
- Respuestas en GitHub Markdown con enlaces a archivos locales (`file:///...`).

## 2. Entornos de Ejecución
- **Frontend (`web/`):** Aplicación Next.js. El servidor de desarrollo corre en el puerto local **3001** (`http://localhost:3001`). El puerto 3000 está reservado para el CRM. Comprobaciones de compilación con `npm run build`.
- **Backend (`api/`):** API FastAPI. No ejecutar comandos de Python globalmente en el sistema host. Utilizar Docker (`docker compose exec ...`) o el entorno virtual (`venv`).
- **CRM (`crm/`):** Plataforma multi-inquilino en el puerto 3000.

## 3. Protocolo de Changelog (`CHANGELOG.md`)
- **Regla estricta:** NO modifiques `CHANGELOG.md` a menos que el Ingeniero te lo pida explícitamente.
- **Validación de fecha:** Antes de registrar una nueva versión, valida la fecha actual en la metadata de la sesión (CST / UTC-6).
- Sigue el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y SemVer.

## 4. Estructura de la Plataforma Web
- **`/` (Inicio):** Landing institucional y corporativa para IQISSMexico (Quiénes somos, Qué hacemos, Carrusel compacto de soluciones, Portal y Contacto).
- **`/productos`:** Catálogo oficial completo con todas las soluciones y modalidades (SaaS vs A la medida).
- **`/landingpage/crm`:** Landing especializada para CRM General (Ventas y Atención al Cliente con IA).
- **`/landingpage/crm/consultorio`:** Landing especializada para Salud y Consultorios Médicos.
- **`/admin/...`:** Panel administrativo para gestionar catálogo de productos, planes y clientes.
- **`/portal/...`:** Portal de autogestión para clientes.
