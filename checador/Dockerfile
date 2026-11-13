# ============================================================
# IQMX Checador Facial SaaS — imagen multi-etapa (Next.js standalone + Node 22)
# Basada en imagen base preinstalada: drvita1982/iqmx-checador-base:latest
# ============================================================

# Stage 1: Dependencias preinstaladas desde imagen base en Docker Hub
FROM drvita1982/iqmx-checador-base:latest AS deps

# Stage 2: Compilación de Next.js y script de migraciones
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Descargar los 3 modelos ONNX (~17 MB) y copiar binarios WASM a public/
RUN npm run models:download

# Compilar la aplicación Next.js en modo standalone
RUN npm run build

# Empaquetar migrate.mjs autocontenido para ejecutar migraciones al arranque
RUN npx esbuild scripts/migrate.mjs --bundle --platform=node \
    --format=esm --outfile=migrate.bundle.mjs \
    --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"

# Empaquetar script de descarga de modelos y runtime WASM
RUN npx esbuild scripts/download-models.mjs --bundle --platform=node \
    --format=esm --outfile=download-models.bundle.mjs \
    --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"

# Stage 3: Runner de producción
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S iqmx && adduser -S iqmx -G iqmx

# Directorio para volumen persistente de media (/data/media)
RUN mkdir -p /data/media && chown -R iqmx:iqmx /data

# Copiar artefactos construidos
COPY --from=builder --chown=iqmx:iqmx /app/public ./public
COPY --from=builder --chown=iqmx:iqmx /app/.next/standalone ./
COPY --from=builder --chown=iqmx:iqmx /app/.next/static ./.next/static
COPY --from=builder --chown=iqmx:iqmx /app/migrate.bundle.mjs ./migrate.mjs
COPY --from=builder --chown=iqmx:iqmx /app/download-models.bundle.mjs ./download-models.mjs
COPY --from=builder --chown=iqmx:iqmx /app/drizzle ./drizzle

USER iqmx
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Healthcheck con start-period amplio para dar tiempo a la inicialización y migraciones
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

# Migraciones al boot del contenedor y arranque del servidor standalone
CMD ["sh", "-c", "node migrate.mjs && node server.js"]
