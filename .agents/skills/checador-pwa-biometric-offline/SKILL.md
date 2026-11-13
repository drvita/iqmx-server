---
name: checador-pwa-biometric-offline
description: Guía técnica para la PWA Offline-First (/kiosk) y enrolamiento local de Checador Facial SaaS usando onnxruntime-web (deteción + MiniFASNet liveness + buffalo_s 512d), Dexie.js (IndexedDB), Serwist, Wake Lock y privacidad biométrica LFPDPPP. Usar al desarrollar /kiosk, módulos en src/lib/pwa-ml/, src/lib/pwa-db/ o sw.ts.
---

# PWA Offline-First y Pipeline Biométrico Local (`checador/`)

Esta skill define las reglas de implementación para el motor biométrico en navegador y la terminal `/kiosk`.

## 1. Pipeline IA en el Navegador (`onnxruntime-web`)
- **Ejecución 100% local:** Cero inferencia en servidor. Cargar modelos cuantizados INT8 desde `public/models/` usando `onnxruntime-web` con backend `webgpu` y respaldo automático a `wasm`.
- **Etapas del checado (activación intencional, nunca pasivo):**
  1. Usuario toca uno de los 4 botones explícitos: `entrada`, `salida`, `inicio_comida`, `fin_comida`.
  2. Detección y alineación de rostro (SCRFD / YuNet / BlazeFace).
  3. **Anti-spoofing (Liveness):** MiniFASNet (`Silent-Face-Anti-Spoofing`). Si falla, registrar `rechazado_spoof` sin aceptar asistencia.
  4. **Reconocimiento:** `buffalo_s` → `Float32Array(512)` + similitud coseno contra `vectores_locales` en memoria. Si no supera `umbral_match`, registrar `rechazado_desconocido`.
- **Enrolamiento desde panel web:** Usar el mismo módulo `pwa-ml` en el navegador del administrador para extraer 1–3 vectores 512d y enviar **únicamente los vectores** (previo `consentimiento_biometrico = true`), descartando las fotos crudas.

## 2. Almacenamiento Offline (`Dexie.js` / IndexedDB)
- **Stores:** `config_dispositivo`, `empleados_locales`, `vectores_locales` (`Float32Array`), `checadas_locales` (Outbox Pattern con UUID v4).
- **Retención de miniaturas (Evidencia JPEG ~15–30 KB):**
  - Si `cloud_evidences_enabled = false` (plan básico): conservar `evidencia_blob` en IndexedDB durante **15 días** para auditoría local (accesible en `/kiosk` mediante vista protegida con PIN de administrador) y purgar registros mayores a 15 días.
  - Si `cloud_evidences_enabled = true`: tras recibir `HTTP 200` de `/api/sync/attendance` y confirmar subida al bucket, eliminar `evidencia_blob` inmediatamente y conservar solo 7 días de metadatos para `cooldown` local.
- **Purga LFPDPPP:** Al recibir `deleted_ids` / `inactive_ids` en `GET /api/sync/employees`, eliminar de inmediato esos registros de `empleados_locales` y `vectores_locales`.

## 3. Resiliencia, Hardware y Seguridad Local
- **Service Worker (Serwist):** Cachear app shell `/kiosk`, archivos `.wasm` y modelos `.onnx`.
- **Persistencia y Pantalla:** Solicitar `navigator.storage.persist()` al vincular el dispositivo y `navigator.wakeLock.request('screen')` en modo quiosco activo.
- **Protección contra manipulación de reloj:** Guardar el último `timestamp_local` válido en `config_dispositivo`. Si el reloj del sistema retrocede respecto a la última checada o sync, marcar la checada con bandera de alerta de reloj.
- **Branding Dinámico:** Leer logo (`Blob`), `color_primario`, `color_secundario` y `mensaje_bienvenida` desde `config_dispositivo` e inyectar variables CSS para operar personalizado incluso offline.
- **Bloqueo por suspensión:** Si `/api/sync/*` responde `403 ORG_SUSPENDED`, mostrar pantalla de servicio suspendido y detener nuevas checadas hasta reactivación.
