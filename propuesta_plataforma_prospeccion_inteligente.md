# Propuesta de producto

## Plataforma de prospección inteligente para negocios locales

**Versión:** 0.1\
**Fecha:** noviembre de 2026\
**Proyecto:** Módulo independiente de prospección integrado con el CRM
existente\
**Primer mercado de prueba:** Estéticas y barberías del estado de
Colima, México

------------------------------------------------------------------------

## 1. Resumen ejecutivo

Construir una aplicación que encuentre negocios de forma periódica,
recopile y enriquezca su información, identifique oportunidades
comerciales mediante modelos de lenguaje (LLM) y entregue al CRM
únicamente los negocios que cumplan criterios de calidad.

La plataforma estará orientada inicialmente a generar oportunidades para
vender servicios de desarrollo web, CRM, automatizaciones, integración
con WhatsApp y soluciones basadas en inteligencia artificial.

El objetivo no es crear otro CRM ni sustituir el actual. La aplicación
será un **motor de prospección outbound** que alimentará el CRM
existente mediante su API.

## 2. Objetivos

-   Descubrir negocios potenciales en una zona y sector configurables.
-   Mantener una base propia de negocios, evitando registros duplicados.
-   Enriquecer la ficha de cada negocio con información pública y
    verificable.
-   Detectar problemas o necesidades que puedan resolverse con los
    servicios ofrecidos.
-   Calificar y priorizar oportunidades mediante reglas y análisis con
    LLM.
-   Preparar propuestas comerciales personalizadas.
-   Enviar candidatos aprobados al CRM para gestionar el contacto y
    seguimiento.
-   Medir qué sectores, necesidades y mensajes producen mejores
    resultados.

## 3. Alcance del primer experimento

  -----------------------------------------------------------------------
  Parámetro                           Configuración inicial
  ----------------------------------- -----------------------------------
  País                                México

  Estado                              Colima

  Cobertura                           Todo el estado

  Sector                              Estéticas y barberías

  Tamaño                              Establecimientos de 0 a 30
                                      empleados

  Fuente inicial                      DENUE de INEGI

  Frecuencia                          Configurable; propuesta inicial:
                                      semanal

  Destino de oportunidades            CRM existente

  Canal de contacto                   WhatsApp y correo electrónico,
                                      según disponibilidad y autorización
  -----------------------------------------------------------------------

La configuración deberá poder cambiarse desde la aplicación para probar
otros sectores, municipios, estados, tamaños de establecimiento y
frecuencias sin modificar el código.

## 4. Flujo funcional

### Etapa 1. Configuración de campañas de prospección

El usuario crea una campaña definiendo:

-   Nombre de la campaña.
-   País, estado y municipios o cobertura completa.
-   Sector o actividades económicas (clasificación SCIAN).
-   Tamaño del establecimiento.
-   Fuentes de información habilitadas.
-   Frecuencia de búsqueda y actualización.
-   Criterios de calificación.
-   Servicios que se desean ofrecer.
-   Umbral mínimo para considerar un negocio como candidato.

Cada campaña conserva su configuración, ejecuciones e indicadores.

### Etapa 2. Descubrimiento de negocios

La aplicación consulta el DENUE mediante su API para obtener
establecimientos que coincidan con los filtros.

La integración deberá:

-   Consultar por actividad económica, ubicación y estrato de personal
    ocupado.
-   Manejar paginación, límites y errores de la API.
-   Guardar el identificador del establecimiento y los datos originales.
-   Registrar la fuente y fecha de consulta.
-   Detectar duplicados y actualizar registros existentes.
-   Identificar negocios nuevos desde la última ejecución.

El DENUE será la fuente inicial de descubrimiento, no necesariamente la
única. Se podrán incorporar otras fuentes autorizadas en etapas
posteriores.

### Etapa 3. Enriquecimiento de información

Para cada negocio se buscará información pública adicional, cuando esté
disponible:

-   Sitio web y dominio.
-   Redes sociales y perfiles públicos.
-   Teléfono, correo y canales de contacto publicados.
-   Servicios, horarios y ubicación.
-   Herramientas de reserva o atención digital.
-   Señales observables de actividad y presencia digital.

Cada dato enriquecido debe conservar su fuente, URL, fecha de consulta y
nivel de confianza. La aplicación debe distinguir entre información
confirmada, inferida y no encontrada.

No se debe asumir que la ausencia de un dato en una fuente significa que
el negocio carece de él.

### Etapa 4. Análisis y detección de oportunidades

Un LLM analiza la información recopilada y busca necesidades
relacionadas con los servicios ofrecidos.

Ejemplos de hipótesis para estéticas y barberías:

-   No se observa un mecanismo sencillo de reservación.
-   La atención depende de respuestas manuales por WhatsApp.
-   No se identifican recordatorios automatizados de citas.
-   No se observa un proceso de seguimiento o reactivación de clientes.
-   La presencia web podría mejorarse.
-   No se identifica una forma clara de captar solicitudes fuera del
    horario de atención.

El análisis debe producir resultados estructurados:

-   Problema u oportunidad detectada.
-   Evidencia que respalda la hipótesis y su fuente.
-   Servicio que podría resolverla.
-   Beneficio comercial esperado.
-   Nivel de confianza.
-   Puntuación de oportunidad.
-   Información faltante y recomendación de validación.

El LLM no debe inventar problemas ni presentar suposiciones como hechos.
Una oportunidad sin evidencia suficiente deberá marcarse para revisión,
no aprobarse automáticamente.

### Etapa 5. Calificación y revisión

La plataforma calcula una puntuación combinando criterios configurables,
por ejemplo:

-   Coincidencia con el sector y tamaño objetivo.
-   Evidencia de una necesidad relevante.
-   Viabilidad de contacto.
-   Afinidad con los servicios ofrecidos.
-   Calidad y actualidad de la información.

Se propone manejar estados como:

1.  Descubierto.
2.  Pendiente de enriquecimiento.
3.  En análisis.
4.  Pendiente de revisión.
5.  Candidato aprobado.
6.  Enviado al CRM.
7.  Descartado.

El usuario podrá revisar la ficha, las evidencias y la oportunidad antes
de aprobar el envío. Durante el MVP se recomienda mantener aprobación
humana antes del primer contacto.

### Etapa 6. Generación de propuestas

Para los candidatos aprobados, un LLM puede generar:

-   Resumen del negocio.
-   Oportunidad detectada.
-   Propuesta de solución.
-   Beneficios esperados.
-   Mensaje inicial personalizado para WhatsApp.
-   Correo de presentación.
-   Borrador de una presentación comercial.

Las propuestas deben ser breves, específicas y basadas en información
comprobable. La generación de una propuesta no implica autorización para
enviarla.

### Etapa 7. Integración con el CRM y seguimiento

La plataforma enviará al CRM los candidatos aprobados mediante su API.

Datos sugeridos para transferir:

-   Identificador de origen y campaña.
-   Nombre y datos de contacto disponibles.
-   Dirección y ubicación.
-   Sector y tamaño del establecimiento.
-   Fuentes de información.
-   Oportunidad detectada y evidencias.
-   Puntuación y nivel de confianza.
-   Propuesta y mensajes preparados.
-   Fecha de aprobación y envío.

El CRM continuará siendo responsable de gestionar conversaciones,
respuestas, tareas, etapas comerciales y resultados.

La integración deberá ser idempotente: una misma oportunidad no debe
crear leads duplicados ante reintentos o ejecuciones repetidas.

## 5. Canales de contacto

### WhatsApp

El CRM ya dispone de integración con WhatsApp. La plataforma de
prospección deberá reutilizar esa capacidad mediante la API del CRM, sin
implementar un segundo sistema de mensajería.

Se recomienda utilizar mecanismos oficiales y autorizados de WhatsApp,
respetando sus políticas, consentimiento y reglas aplicables a mensajes
iniciados por empresas. No se recomienda depender de scripts que
controlen WhatsApp Web como mecanismo de producción.

### Correo electrónico

Se podrá integrar un proveedor de envío de correo. Mailtrap puede
evaluarse para esta función, verificando el producto contratado, sus
límites y condiciones de envío.

Antes de enviar campañas reales se deberán configurar dominio,
autenticación SPF/DKIM/DMARC, gestión de rebotes, bajas y supresión de
contactos.

**Importante:** el envío de mensajes debe estar sujeto a revisión,
autorización y cumplimiento de la normativa aplicable. La disponibilidad
pública de un teléfono o correo no equivale por sí sola a consentimiento
para recibir publicidad.

## 6. Seguimiento y resultados

El CRM gestionará las respuestas y el ciclo comercial. La plataforma de
prospección podrá consultar el estado mediante API o recibir
eventos/webhooks.

Estados de referencia:

-   Pendiente de contacto.
-   Contactado.
-   Respondió.
-   Interesado.
-   Reunión o demostración.
-   Propuesta enviada.
-   Ganado.
-   Perdido.
-   No contactar.

Las reglas de seguimiento deben ser configurables. No se recomienda
marcar automáticamente como perdido un negocio únicamente porque no
respondió después de cierto tiempo: conviene definir intentos,
intervalos, fecha de última interacción y una política de cierre.
También debe existir una lista de exclusión para solicitudes de no
contacto.

## 7. Arquitectura tecnológica propuesta

Se propone mantener la aplicación desacoplada del CRM, con integración
mediante API.

  -----------------------------------------------------------------------
  Componente              Tecnología propuesta    Responsabilidad
  ----------------------- ----------------------- -----------------------
  Interfaz web            Next.js                 Configuración,
                                                  campañas, fichas y
                                                  revisión

  Backend de aplicación   Next.js API o servicio  Usuarios, campañas y
                          dedicado                operaciones

  Base de datos           PostgreSQL              Negocios, fuentes,
                                                  campañas y
                                                  oportunidades

  ORM                     Drizzle                 Acceso y migraciones de
                                                  datos

  Recolección e           Python                  DENUE, fuentes externas
  integración                                     y normalización

  Orquestación de agentes LangGraph               Flujos de
                                                  enriquecimiento y
                                                  análisis

  Automatizaciones        n8n                     Integraciones y tareas
  auxiliares                                      operativas cuando
                                                  convenga

  Modelos LLM             OpenRouter              Análisis, clasificación
                                                  y generación de
                                                  propuestas

  CRM existente           API propia              Leads, conversaciones y
                                                  seguimiento

  Correo                  Mailtrap u otro         Envío transaccional o
                          proveedor evaluado      comercial autorizado
  -----------------------------------------------------------------------

No es necesario incorporar LangChain, LangGraph y n8n en todos los
procesos. Cada herramienta debe resolver una necesidad concreta. Se
recomienda que las tareas programadas y de larga duración se ejecuten en
workers independientes, con reintentos, trazabilidad y control de
errores.

## 8. Modelo de datos inicial

Entidades sugeridas:

-   `prospecting_campaigns`: configuración de cada experimento.
-   `businesses`: registro principal de establecimientos.
-   `business_sources`: fuentes y evidencias de información.
-   `business_contacts`: teléfonos, correos y canales de contacto.
-   `enrichment_runs`: ejecuciones de enriquecimiento.
-   `opportunity_analyses`: análisis y resultados del LLM.
-   `opportunities`: oportunidades detectadas y su estado.
-   `proposals`: propuestas y mensajes generados.
-   `crm_sync_logs`: sincronización con el CRM.
-   `contact_suppressions`: negocios o contactos excluidos de
    comunicaciones.
-   `prospecting_runs`: historial de ejecuciones de campañas.

El identificador de DENUE y otros identificadores de origen deben
conservarse para facilitar actualizaciones y deduplicación.

## 9. Panel principal e indicadores

La aplicación deberá permitir consultar:

-   Negocios encontrados.
-   Negocios nuevos y actualizados.
-   Negocios enriquecidos.
-   Candidatos aprobados y descartados.
-   Oportunidades por tipo de problema.
-   Candidatos enviados al CRM.
-   Contactos con respuesta.
-   Reuniones o demostraciones generadas.
-   Clientes ganados y perdidos.
-   Coste estimado por oportunidad y por cliente.

Los indicadores deben poder filtrarse por campaña, sector, ubicación y
periodo.

## 10. MVP: orden de implementación

### Fase 1 --- Descubrimiento

-   Configuración de campañas.
-   Integración con API DENUE.
-   Descarga y normalización de establecimientos.
-   Deduplicación y almacenamiento.
-   Listado de negocios con filtros.

**Resultado:** base de negocios de Colima para estéticas y barberías de
0 a 30 empleados.

### Fase 2 --- Enriquecimiento

-   Búsqueda de presencia web y perfiles públicos.
-   Extracción de información permitida.
-   Registro de fuentes, fechas y confianza.
-   Reintentos y control de errores.

**Resultado:** fichas de negocio con información ampliada y trazable.

### Fase 3 --- Inteligencia de oportunidades

-   Configuración de servicios y problemas objetivo.
-   Prompts y salidas estructuradas con OpenRouter.
-   Puntuación de candidatos.
-   Revisión y aprobación humana.

**Resultado:** listado priorizado de oportunidades justificadas.

### Fase 4 --- Propuestas e integración

-   Generación de mensajes y propuestas.
-   Sincronización de candidatos con el CRM.
-   Registro de resultados de sincronización.
-   Consulta de estados y respuestas.

**Resultado:** oportunidades listas para trabajarse desde el CRM.

### Fase 5 --- Optimización

-   Comparación semanal entre sectores.
-   Análisis de conversión.
-   Ajuste de criterios y modelos.
-   Nuevas fuentes y regiones.
-   Configuración multiusuario y multiempresa si se decide comercializar
    la plataforma.

## 11. Criterios de éxito del primer experimento

El primer experimento no debe evaluarse por la cantidad de registros
descargados, sino por su capacidad para producir oportunidades
comerciales reales.

Se medirán:

1.  Cantidad de negocios únicos encontrados.
2.  Porcentaje con información de contacto verificable.
3.  Porcentaje con oportunidades respaldadas por evidencia.
4.  Candidatos aprobados por revisión humana.
5.  Mensajes entregados y respuestas obtenidas.
6.  Conversaciones con interés real.
7.  Reuniones, propuestas y ventas generadas.
8.  Tiempo y coste invertidos por oportunidad.

Después de la primera campaña se compararán los resultados con los de
otros sectores para identificar el nicho más rentable.

## 12. Consideraciones de seguridad, calidad y cumplimiento

-   Respetar los términos de uso y límites de cada fuente y API.
-   Guardar procedencia, fecha y nivel de confianza de los datos.
-   Evitar scraping que incumpla condiciones de servicio o controles de
    acceso.
-   No recolectar datos personales innecesarios.
-   Proteger credenciales y API keys mediante almacenamiento seguro.
-   Registrar las llamadas a LLM, costes, errores y versiones de
    prompts.
-   Validar las salidas del LLM antes de utilizarlas comercialmente.
-   Incorporar exclusiones, bajas y mecanismos para no volver a
    contactar.
-   Cumplir las disposiciones aplicables en México sobre protección de
    datos personales, comunicaciones comerciales y plataformas de
    mensajería.
-   Mantener revisión humana para aprobar candidatos y mensajes durante
    el MVP.

## 13. Decisiones propuestas

  Decisión         Propuesta inicial
  ---------------- -----------------------------------------------------
  Producto         Motor de prospección independiente
  CRM              Reutilizar el CRM existente
  Fuente inicial   API DENUE
  Primer sector    Estéticas y barberías
  Cobertura        Todo el estado de Colima
  Tamaño           0 a 30 empleados
  Periodicidad     Configurable; semanal inicialmente
  Análisis         LLM mediante OpenRouter
  Automatización   Workers Python y LangGraph; n8n cuando aporte valor
  Contacto         Integración con API del CRM
  Aprobación       Humana antes de enviar al CRM y contactar
  Evaluación       Conversión comercial y coste por oportunidad

------------------------------------------------------------------------

## Conclusión

La propuesta consiste en construir una plataforma configurable de
inteligencia comercial que transforme directorios de negocios y fuentes
públicas en oportunidades de venta calificadas.

El primer MVP debe concentrarse en descubrir, enriquecer y analizar
negocios de estéticas y barberías en Colima. Una vez validado el flujo y
medidos sus resultados, se podrán probar otros sectores, ampliar la
cobertura geográfica y convertir la solución en un producto configurable
para otros profesionales.

**Principio rector:** encontrar menos negocios, pero mejor investigados,
con oportunidades concretas y evidencia suficiente para iniciar una
conversación comercial relevante.
