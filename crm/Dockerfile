# ============================================================
# IQMX CRM — imagen multi-etapa (Next.js standalone + Node 22)
# Basada en imagen base preinstalada: drvita1982/iqmx-crm-base:latest
# ============================================================

# Stage 1: Dependencias preinstaladas desde imagen base en Docker Hub
FROM drvita1982/iqmx-crm-base:latest AS deps

# Stage 2: Compilación de Next.js y scripts bundleados
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Commit del que sale la imagen, para que la app pueda decir qué está corriendo.
# Coolify lo inyecta solo; con docker compose se pasa con
# `--build-arg SOURCE_COMMIT=$(git rev-parse HEAD)`. Si falta, la app enseña
# solo la versión de package.json — nunca es un error de build.
ARG SOURCE_COMMIT=""
ENV SOURCE_COMMIT=$SOURCE_COMMIT
RUN pnpm build
# migrate.mjs autocontenido (drizzle-orm + postgres bundleados)
RUN pnpm exec esbuild scripts/migrate.mjs --bundle --platform=node \
    --format=esm --outfile=migrate.bundle.mjs \
    --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
RUN pnpm exec esbuild scripts/seed/demo.ts --bundle --platform=node \
    --format=esm --outfile=seed-demo.bundle.mjs --alias:@=./src \
    --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S iqmx && adduser -S iqmx -G iqmx
# Punto de montaje del volumen de adjuntos, propiedad del usuario de la app
RUN mkdir -p /data/media && chown -R iqmx:iqmx /data

COPY --from=builder --chown=iqmx:iqmx /app/.next/standalone ./
COPY --from=builder --chown=iqmx:iqmx /app/.next/static ./.next/static
COPY --from=builder --chown=iqmx:iqmx /app/public ./public
COPY --from=builder --chown=iqmx:iqmx /app/migrate.bundle.mjs ./migrate.mjs
COPY --from=builder --chown=iqmx:iqmx /app/seed-demo.bundle.mjs ./seed-demo.mjs
COPY --from=builder --chown=iqmx:iqmx /app/drizzle ./drizzle

USER iqmx
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# start-period amplio: cubre las migraciones del arranque
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

# Migrar al BOOT del contenedor nuevo y arrancar el server standalone
CMD ["sh", "-c", "node migrate.mjs && node server.js"]
