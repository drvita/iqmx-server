# Backlog de Mejoras — Plataforma Web (`web/`)

> Requerimientos futuros identificados durante el cierre del MVP de Checador Facial para planificarse e implementarse en iteraciones posteriores usando el harness de `02-docs/`.

---

## 1. Landing Comercial `/landingpage/checador` [IMPLEMENTADO - 2026-11-13]
- **Origen:** Cierre del MVP de Checador Facial (2026-11-13).
- **Problema:** Actualmente `CRM WhatsApp` cuenta con su landing especializada (`/landingpage/crm`), mientras que `Checador Facial` solo aparece en el catálogo general (`/productos`) y en el portal (`/portal/checador`).
- **Alcance propuesto:**
  - Crear `/landingpage/checador` en `web/` siguiendo la línea visual institucional de IQISSMexico.
  - Destacar beneficios clave (control de asistencia con prueba de vida, operación sin internet, cumplimiento LFPDPPP, prueba gratuita de 1 mes y Plan Básico de \$520 MXN/mes) sin tecnicismos como "SaaS" u "offline-first".
  - Conectar llamadas a la acción hacia `/portal/checador` y contacto comercial.

---

## 2. Membresías Dinámicas desde Base de Datos en `/landingpage/checador` y `/portal/checador` [IMPLEMENTADO - 2026-11-14]
- **Origen:** Revisión previa a lanzamiento comercial (2026-11-14).
- **Problema:** Los precios y límites mostrados en `/landingpage/checador` y en el banner de activación de `/portal/checador` estaban fijos en el código fuente (`$520 MXN/mes`, `15 colaboradores`), por lo que cualquier ajuste desde `/admin/products` no se reflejaba sin recompilar y desplegar el frontend.
- **Alcance propuesto:**
  - Consumir el endpoint público `GET /api/public/products/checador/plans?include_free=true` en `/landingpage/checador` y `/portal/checador`.
  - Renderizar tarjetas dinámicas de acuerdo con los planes activos y públicos en base de datos, mostrando estado de actualización cuando aún no existan planes configurados.
  - Eliminar precios fijos del HTML estático (`layout.tsx`).
