# Registro de Cambios (Changelog)

Todas las modificaciones notables de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

> **Zona horaria de referencia:** Ciudad de México (CST / UTC-6).

---

## [1.8.0] - 2026-09-10

### Añadido

- **Encolamiento Cross-Tenant y Protección de Servidor en el Laboratorio (`/lab`)**:
  - Implementación de estado `"queued"` y cálculo dinámico de `queuePosition` en el esquema [crm/src/lib/db/schema.ts](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/lib/db/schema.ts) y motor [crm/src/server/lab/runner.ts](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/server/lab/runner.ts).
  - Regla de negocio global: el servidor ejecuta **1 benchmark a la vez** para priorizar los recursos en la atención de WhatsApp en tiempo real.
  - Despachador automático FIFO (`processNextQueuedRun`): al finalizar una corrida (exitosa o fallida), el servidor toma automáticamente el siguiente benchmark en cola y lo inicia.
  - Banner interactivo en la interfaz [crm/src/components/lab/lab-client.tsx](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/components/lab/lab-client.tsx) informando el turno de espera al usuario.
- **Acceso y Visibilidad Condicional al Benchmark de Agenda y Citas (`agenda_flow`)**:
  - Evaluación dinámica de la suscripción y límites de la organización mediante `isAgendaEnabled(organizationId)` de [crm/src/server/agenda/flag.ts](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/server/agenda/flag.ts).
  - La tarjeta de Pruebas de Agenda y Citas en `/lab` solo se renderiza si el inquilino tiene el módulo de agenda habilitado en sus configuraciones o membresía.
  - Blindaje en endpoints de backend ([/api/lab/runs](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/app/api/lab/runs/route.ts), [/api/lab/scenarios](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/app/api/lab/scenarios/route.ts) y [/api/lab/scenarios/generate](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/app/api/lab/scenarios/generate/route.ts)) rechazando peticiones con código `403` si la agenda está deshabilitada.
- **Guías Contextuales y Tips en Configuración de Asistentes (`/agent`)**:
  - Banner informativo visual en [crm/src/components/agent/agent-client.tsx](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/components/agent/agent-client.tsx) orientando al usuario sobre la orquestación automática de agenda, catálogo de productos y escalado a humanos.
  - Helper text aclaratorio en el campo de reglas de escalado a humano para prevenir duplicidad de instrucciones en el System Prompt central.
- **Estandarización de Agentes y Skills Multi-Arnés**:
  - Actualización de directrices maestras en [AGENTS.md](file:///Users/laclavees12345/code/iqissmexico/main/AGENTS.md) y [.agents/rules/iqmx-rules.md](file:///Users/laclavees12345/code/iqissmexico/main/.agents/rules/iqmx-rules.md) con el ciclo de vida del CRM multi-tenant, puertos reservados y estándares visuales.
  - Creación de la skill [.agents/skills/crm-developer-flow/SKILL.md](file:///Users/laclavees12345/code/iqissmexico/main/.agents/skills/crm-developer-flow/SKILL.md) para desarrollo, testing unitario, compilación y Docker.
  - Migración y disponibilidad general de las skills [.agents/skills/whatsapp-saas-meta-infra](file:///Users/laclavees12345/code/iqissmexico/main/.agents/skills/whatsapp-saas-meta-infra/SKILL.md) y [.agents/skills/whatsapp-meta-app-review](file:///Users/laclavees12345/code/iqissmexico/main/.agents/skills/whatsapp-meta-app-review/SKILL.md).

### Modificado

- **Concurrencia Controlada (2 en 2) en Simulaciones de Laboratorio**:
  - Procesamiento de personajes en lotes controlados de 2 (`CONCURRENCY_LIMIT = 2`) en [crm/src/server/lab/runner.ts](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/server/lab/runner.ts), optimizando tiempos de respuesta iniciales y emitiendo progreso en vivo inmediato por SSE.
  - Preservación de la salvaguarda de seguridad inmutable de 10 minutos con `Promise.race` para evitar bloqueos por indisponibilidad de APIs externas.
- **Sanitización Estética de Nombres de Perfiles**:
  - Supresión de prefijos de asistente (`${assistantId}:`) y reemplazo de guiones bajos (`_`) por espacios con capitalización limpia tanto en la API como en las tarjetas de resultados de [crm/src/components/lab/lab-client.tsx](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/components/lab/lab-client.tsx).
- **Aislamiento Intra-Tenant y Detección de Preguntas sin Configurar**:
  - Restricción estricta de 1 benchmark activo a la vez por inquilino (`RunConflictError`).
  - Rechazo anticipado (`NoConfiguredScenariosError`) si el inquilino no ha personalizado ni generado preguntas, eliminando el uso de datos mock de negocios ajenos.
- **Limpieza de Estado en Modal de Preguntas**:
  - Implementación de `resetFormState()` y sincronización reactiva en [crm/src/components/lab/scenario-editor.tsx](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/components/lab/scenario-editor.tsx) para evitar que persistan preguntas de benchmarks previamente abiertos.

### Corregido

- **Componente Switch de Activación de Asistentes en `/agent`**:
  - Corrección de maquetación en [crm/src/components/agent/agent-client.tsx](file:///Users/laclavees12345/code/iqissmexico/main/crm/src/components/agent/agent-client.tsx) estandarizando con el patrón shadcn/ui y Tailwind (`inline-flex`, `border-2 border-transparent`, thumb blanco `shadow-md` y traslación matemática `translate-x-0` a `translate-x-5`), eliminando el corte en el borde del switch.

---

## [1.7.0] - 2026-09-07

### Añadido

- **Edición Integral de Planes de Membresía (`/admin/products`)**:
  - Modal interactivo para modificar planes existentes: nombre comercial, descripción, precio en MXN, intervalo de facturación (`billing_interval`), visibilidad en catálogo (`is_public`) y estado (`is_active`).
  - El identificador único (`slug`) se presenta protegido en solo lectura para salvaguardar la coherencia de suscripciones activas y webhooks.
  - Soporte en backend: endpoint `PATCH /api/admin/catalog/plans/{plan_id}` ampliado en [api/app/api/admin_catalog.py](file:///Users/laclavees12345/code/iqissmexico/main/api/app/api/admin_catalog.py) con soporte para mutar `billing_interval`.
- **Componente Reutilizable `RawJsonEditor` (`RawJsonEditor.tsx`)**:
  - Nuevo componente modular en [web/src/components/admin/RawJsonEditor.tsx](file:///Users/laclavees12345/code/iqissmexico/main/web/src/components/admin/RawJsonEditor.tsx).
  - Incluye botón de auto-formateo instantáneo (*"Dar Formato"* / *Prettify*), área de texto monoespaciada estilo terminal oscuro (`bg-gray-950 text-emerald-400 font-mono`) y banner reactivo con validación de sintaxis JSON.
  - Reutilizado tanto en la creación y edición de planes de `/admin/products` como en el modal de sobreescritura de cuotas en `/admin/crm`.
- **Configuración de `landing_path` en Catálogo de Productos**:
  - Exposición y persistencia de la columna `landing_path` en el backend administrativo (`ProductResponse`, `CreateProductRequest`, `UpdateProductRequest`).
  - Incorporación del input correspondiente en el modal *"Configurar Producto y URLs"* de `/admin/products` para vincular dinámicamente cualquier producto a su landing page pública.
- **Página Dedicada de Catálogo Completo (`/productos`)**:
  - Nueva ruta accesible en [web/src/app/productos/page.tsx](file:///Users/laclavees12345/code/iqissmexico/main/web/src/app/productos/page.tsx) para consultar el portafolio completo de plataformas SaaS y desarrollos a la medida sin saturar la página de inicio.
  - Sección inferior de asesoría técnica para cotizaciones personalizadas vía WhatsApp Business y acceso directo al portal de clientes.
- **Componente Modular `ProductCatalogGrid` (`ProductCatalogGrid.tsx`)**:
  - Componente adaptable en [web/src/components/landing/ProductCatalogGrid.tsx](file:///Users/laclavees12345/code/iqissmexico/main/web/src/components/landing/ProductCatalogGrid.tsx) con soporte para dos modos de visualización:
    - Modo `carousel`: carrusel horizontal interactivo con tarjetas compactas y flechas de navegación para la Home (`/`).
    - Modo `grid`: cuadrícula de 2 columnas con tarjetas detalladas y botones de acción directos para `/productos`.
  - Detección inteligente de destino: si el producto cuenta con `landing_path`, ofrece acceso a su solución y planes; si es nulo, ofrece botón de cotización por WhatsApp con mensaje prellenado.
- **Sección de Preguntas Frecuentes y Transparencia Comercial (`LandingFaqSection.tsx`)**:
  - Componente en [web/src/components/landing/LandingFaqSection.tsx](file:///Users/laclavees12345/code/iqissmexico/main/web/src/components/landing/LandingFaqSection.tsx) abordando la reapertura de la ventana de 24h, gestión de plantillas oficiales de Meta y esquema transparente de IA con Bring Your Own Key (BYOK).

### Modificado

- **Rediseño Institucional y Neutral de la Página Principal (`/`)**:
  - Reestructuración de [web/src/app/page.tsx](file:///Users/laclavees12345/code/iqissmexico/main/web/src/app/page.tsx) hacia un enfoque corporativo e institucional para IQISSMexico.
  - Eliminación de secciones estáticas redundantes, consolidando la presentación del portafolio en el nuevo carrusel horizontal dinámico.
  - Tarjetas del carrusel simplificadas sin botones internos para evitar sobrecargar la vista vertical.
  - Botón directo hacia el catálogo completo con texto claro y sin paréntesis: *"Ver todas las soluciones y productos →"*.
  - Incorporación de sección *"Quiénes Somos"* destacando trayectoria (+15 años desde 2008 en Colima) con enlace a `/aboutus`.
  - Canales de contacto directo: WhatsApp oficial (`+52 314 156 0219`), correo (`info@iqissmexico.com`) y enlaces discretos a políticas en el footer.
- **Especialización y Coherencia en Landings del CRM (`/landingpage/crm` y `/landingpage/crm/consultorio`)**:
  - Componente unificado [MembershipPlans.tsx](file:///Users/laclavees12345/code/iqissmexico/main/web/src/components/landing/MembershipPlans.tsx) con cálculo unívoco del badge *"MÁS POPULAR"* (Plan Basic+ para CRM General, Plan Pro para Consultorios).
  - Eliminación de menciones erróneas de citas médicas en CRM general, reservándolas para la landing de salud con aviso de recordatorios automáticos *(Próximamente)*.
  - Tratamiento independiente para el plan de prueba gratuita (Trial).
- **Navegación Global (`Navbar.tsx` y `Footer.tsx`)**:
  - Incorporación del enlace a `/productos` en la barra superior y pie de página.
  - Corrección de la ruta de consultorios hacia `/landingpage/crm/consultorio`.

---

## [1.6.0] - 2026-09-06

### Añadido

- **Catálogo Completo y Estandarización de Automatizaciones (`manage.py`)**:
  - Unificación de todas las tareas cron del sistema bajo la interfaz de comandos de [api/manage.py](file:///Users/laclavees12345/code/iqissmexico/main/api/manage.py), preparadas para su programación en los Schedules de Coolify:
    - `python manage.py subscriptions:cron` (Job 1: Bajas y expiración de suscripciones).
    - `python manage.py subscriptions:alerts` (Job 2: Alertas preventivas inteligentes anti-spam).
    - `python manage.py digest:morning` (Job 3: Resumen ejecutivo matutino a administradores).
    - `python manage.py system:cleanup` (Job 4: Mantenimiento de claves efímeras y purga de BD).
  - Soporte de simulación `--dry-run` transversal en todos los comandos para auditoría previa sin impacto en producción.
- **Trazabilidad de Pagos y Renovaciones Recurrentes (`Payment` / `payments`)**:
  - Modelo `Payment` y migración de base de datos Alembic `d9f1a2b3c4e5_create_payments_table`.
  - Trazabilidad idempotente de pagos de Mercado Pago (`record_subscription_payment`).
  - Renovación de membresías recurrentes sin pérdida de días ni cortes en el servicio (`renewed_active`).
  - Detección y tratamiento de cobros rechazados (`past_due`) con alerta inmediata por Telegram a administradores y correo urgente al cliente.
- **Job 1: Conciliación Diaria y Suspensión de Membresías Vencidas**:
  - Plantilla transaccional oficial en Mailtrap API (`MAILTRAP_TEMPLATE_EXPIRED`, UUID: `03312624-4bca-4944-b63b-f3f39cc5d6b4`, ID: `76187`) con diseño institucional responsivo.
  - Bloque visual de feedback con botón directo a WhatsApp oficial (`5213141560219`) para conocer el motivo de no renovación.
  - Suspensión automática del inquilino en CRM (`crm.organization.status = 'suspended'`) y pausa de bots en WhatsApp.
- **Job 2: Alertas Preventivas Selectivas (Estrategia Anti-Spam)**:
  - Filtro inteligente que omite notificaciones a usuarios con cobro automático activo en Mercado Pago (`mp_preapproval_id`), previniendo spam innecesario.
  - Alerta selectiva a cancelaciones próximas (-3 días), término de Free Trial (-24 horas) y pagos rebotados (`past_due`).
  - Nuevas plantillas oficiales de Mailtrap integradas: `MAILTRAP_TEMPLATE_PAYMENT_FAILED`, `MAILTRAP_TEMPLATE_CANCELLED_EXPIRING` y `MAILTRAP_TEMPLATE_TRIAL_EXPIRING`.
- **Job 3: Resumen Ejecutivo Matutino (Morning Digest)**:
  - Extracción y compilación diaria de métricas de las últimas 24 horas: leads con email validado, pagos y renovaciones cobradas en `payments` (total MXN), cobros rechazados y cuentas suspendidas.
  - Detección anticipada de pruebas gratuitas o cancelaciones que concluyen en las siguientes 24–48 horas.
  - Despacho consolidado en formato Markdown a todos los administradores configurados vía Telegram (`NotificationManager.notify_admins`).
- **Job 4: Limpieza de Claves Efímeras y Mantenimiento de BD/Redis (`system:cleanup`)**:
  - Servicio `maintenance_service.py` para escaneo y purga en Redis de tokens huérfanos, desincronizados o de usuarios ya validados en PostgreSQL (`email_verified_at is not None`).
  - Depuración de eventos históricos en la tabla `events` de PostgreSQL (>30 días para entregados, >60 días para fallidos).
  - Operación silenciosa hacia Telegram generando únicamente logs estructurados de auditoría.
- **Sistema Centralizado de Notificaciones Multi-Canal (`NotificationManager`)**:
  - **Canal Telegram Bot para Administradores (`IQMX Admin` / `TELEGRAM_BOT_TOKEN`)**:
    - Notificación operativa en tiempo real a todos los usuarios con rol `admin` y `telegram_chat_id` configurado cuando un cliente confirma exitosamente su correo electrónico en el portal web.
    - Inclusión estructurada de datos de contacto: ID de usuario/cliente, nombre de contacto, correo electrónico, teléfono y razón social.
    - Despacho desacoplado y asíncrono con `BackgroundTasks` de FastAPI tolerante a fallos para no añadir latencia ni bloquear la experiencia del cliente.
    - Soporte multi-admin dinámico: cada administrador recibe individualmente la alerta sin exponer números o IDs en código duro.
  - **Canal Mailtrap Send API con Plantillas Oficiales**:
    - Soporte nativo para entorno Sandbox y Producción mediante la variable configurable `MAILTRAP_API_URL` (por defecto `https://send.api.mailtrap.io`).
    - Plantilla HTML de bienvenida y verificación de cuenta (`MAILTRAP_TEMPLATE_WELCOME`) con diseño de marca IQISSMexico: logo oficial PNG, paleta institucional navy (`#0f2a4a`), azul (`#2563eb`), contenedor contrastante y pie de página corporativo.
    - Script sincronizador idempotente de plantillas (`api/scripts/sync_mailtrap_templates.py`).
- **Módulo de Perfil Administrativo (`/admin/profile`)**:
  - Nueva página dedicada para que cada administrador gestione sus datos de cuenta y contraseña.
  - Sección interactiva para vincular su **Telegram Chat ID** con guía amigable de 3 pasos para usuarios no técnicos y enlace directo de 1 clic a `@userinfobot`.
  - Botón de prueba inmediata (*"Probar Notificación"*) con retroalimentación visual que envía un mensaje directo a su Telegram para validar la conexión en segundos.
  - Enlace directo a *"Mi Perfil"* incorporado en la barra lateral de navegación y en la tarjeta de sesión de usuario.
- **Gestión Asistida de Telegram en Lista de Usuarios (`/admin/users`)**:
  - Modal de configuración rápida de Telegram para que un administrador pueda asistir a un colega asignando su `telegram_chat_id` con botón de prueba integrado.
  - Validación de seguridad estricta en API: restricción absoluta del `telegram_chat_id` exclusivamente para usuarios con rol `admin` (bloqueo para roles `partner` o `contact`).
- **Gestión de Suscripciones Pendientes de Pago (`pending_payment`) y Autogestión**:
  - **Detección y Visualización en Portal del Cliente**: Detección automática de borradores de suscripción `pending_payment` en Dashboard (`/portal/dashboard`) y Facturación (`/portal/billing`), alertando al cliente de manera destacada con las opciones inmediatas de *"Pagar con Mercado Pago"* o *"Cancelar Solicitud"*.
  - **Reutilización Idempotente de Checkouts**: En `create_checkout_preference`, si el cliente ya cuenta con una suscripción en estado `pending_payment` para el mismo plan, se actualiza y reutiliza el registro existente en lugar de generar registros duplicados o fantasmas.
  - **Persistencia de URL de Checkout Directo**: Almacenamiento seguro del enlace de pago (`init_point` de Mercado Pago) en `custom_features_override.checkout_url` y exposición en `GET /api/portal/subscriptions/my`, permitiendo al usuario reanudar el pago en cualquier momento si abandonó la pasarela.
  - **Descarte Seguro y Depuración**: Endpoint `DELETE /api/portal/subscriptions/{subscription_id}/cancel-pending` (con alias `POST`) con validación de titularidad de cuenta, cancelación del preapproval en Mercado Pago y eliminación del borrador en base de datos para mantener limpio el panel de administración.
- **Resolución Dinámica de Dominio Frontend y Flujo de Agradecimiento de Mercado Pago**:
  - **Resolución Dinámica de Dominio (`PORTAL_BASE_URL`)**:
    - Reutilización de `PORTAL_BASE_URL` en variables de entorno y helper `resolve_frontend_base_url(request, for_external_gateway)`.
    - Detección inteligente mediante encabezados `Origin` / `Referer` con validación de dominios permitidos (`iqissmexico.com`, subdominios, túneles ngrok/cloudflare).
    - Compatibilidad estricta con Mercado Pago: fallback automático a FQDN HTTPS válido en entornos locales donde la pasarela rechaza `localhost` o `testserver` con `400 Bad Request`.
  - **Página de Retorno y Agradecimiento en Frontend (`/portal/checkout/status`)**:
    - Nueva vista pública dedicada con diseño responsivo institucional para recibir al cliente tras su interacción con Mercado Pago.
    - **Agradecimiento y Éxito**: Despliega confirmación de compra ("¡Gracias por tu compra!"), resumen de plan y costo, y cuenta regresiva de 5 segundos con botón directo para redirigir a `/portal/dashboard`.
    - **Pago Pendiente / Interrumpido**: Explicación clara del estado, botón para completar el pago con Mercado Pago si se cerró la ventana (`checkout_url`), o regresar a gestionar desde el panel de control.
    - Endpoint público no confidencial `GET /api/public/checkout/status?sub_id={sub_id}` para consultar el estado del plan sin requerir sesión activa ni exponer datos sensibles.
- **Secuenciamiento en Cola de Suscripciones Programadas (`scheduled` pipeline)**:
  - **Cálculo Encadenado de Fechas**: Al contratar membresías de menor o igual valor (downgrades o renovaciones anticipadas) teniendo una suscripción activa previa u otras programadas en espera, cada nueva suscripción se calcula secuencialmente a partir del término de la última programada (`current_period_end`), garantizando continuidad estricta y eliminando traslapes de fechas.
  - **Protección de Activación Única**: En `activate_due_scheduled_subscriptions`, se valida que la suscripción activa unifique su término y nunca se active más de una suscripción simultáneamente para el mismo cliente y producto al cumplirse el plazo.
  - **Auto-reparación de Colas (`realign_customer_scheduled_queues`)**: Algoritmo de detección y corrección automática de fechas que realinea registros programados preexistentes con fechas idénticas al ser consultados desde el portal (`GET /api/portal/subscriptions/my`).
- **Homologación de Rutas para Webhook de Mercado Pago**:
  - Estandarización a exactamente dos rutas homologadas idénticas a las de WhatsApp:
    - `/api/webhooks/mercadopago` (ruta canónica)
    - `/mercadopago` (ruta simplificada sin prefijo)
  - Ambas rutas operan con el mismo controlador y soportan cobros recurrentes (`authorized_payment`) y altas de suscripción (`preapproval`).
- **Resolución Dinámica de URL en Checkout de Planes Gratuitos (`/admin/subscriptions`)**:
  - Reemplazo de la URL fija de producción en el flujo de asignación manual de planes gratuitos por la URL dinámica resuelta (`f"{frontend_base}/portal/dashboard?plan=free_activated"`), garantizando redirecciones correctas en entornos de desarrollo, staging o túneles de prueba.
- **Suite de Pruebas Automatizadas**:
  - Nuevas suites de pruebas en `test_notifications.py`, `test_email_verification.py`, `test_payments.py`, `test_maintenance.py`, `test_webhooks.py` y `test_subscription_conflicts.py`.
  - 82/82 pruebas unitarias aprobadas al 100% en contenedor Docker.

### Cambiado

- **Optimización de Notificaciones en Job 1**:
  - Eliminado el envío de alertas individuales a Telegram en la madrugada por cada usuario expirado, consolidando el total de bajas operativas en el reporte matutino del Job 3 para mantener silencioso el canal administrativo fuera de horario laboral.
- **Optimización de Acciones y Layout en Panel Administrativo (`/admin`)**:
  - **Barra Lateral Fija (Sticky Viewport)**: Corrección del navbar/sidebar en `admin/layout.tsx` para permanecer anclado al viewport (`h-screen`, `overflow-hidden`) con desplazamiento vertical independiente en el área principal de contenido (`overflow-y-auto`), evitando que el menú crezca o se estire cuando hay tablas extensas.
  - **Columna de Acciones Compacta en `/admin/users`**: Reemplazo de botones voluminosos por botones tipo píldora compactos y armónicos (`✕ / + Cliente` y `+ / ✈️ Telegram`), permitiendo la convivencia limpia de múltiples acciones sin provocar desplazamiento horizontal.
- **Experiencia de Usuario en Formularios de Inicio de Sesión (`/admin/login` y `/portal/login`)**:
  - Soporte nativo de envío de formulario al presionar la tecla `Enter` en el campo de contraseña en ambos portales.
  - Corrección del botón de acción en `/portal/login` a `type="submit"` y adición de escuchador `onKeyDown` explícito en los campos de contraseña para garantizar el despacho inmediato.
- **Claridad Visual en Fechas de Inicio de Membresías Programadas (`/portal/billing` y `/portal/dashboard`)**:
  - Implementación del formateador inteligente `formatScheduledDate`: cuando la fecha técnica de inicio en base de datos coincide con el límite de la medianoche previa (`23:59:59`), el portal presenta el día natural exacto en que entra en vigor para el cliente (ej. *"Inicia el: 8 de noviembre"* en lugar de repetir *"7 de noviembre"*), eliminando dudas visuales y consultas de soporte.
- **Acceso Público a Verificación de Correo (`/portal/verify-email`)**:
  - Corrección de la guardia de autenticación en `portal/layout.tsx` para incluir `/portal/verify-email` como ruta de acceso público y onboarding sin sesión requerida.
  - Eliminación de redirecciones erróneas y parpadeos al iniciar sesión, permitiendo que cualquier usuario verifique su cuenta con un solo clic desde cualquier dispositivo, navegador o ventana de incógnito.

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
