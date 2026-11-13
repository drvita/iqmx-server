# ============================================================
# IQMX Checador Facial SaaS — imagen multi-etapa (Next.js standalone + Node 22)
# ============================================================

# Stage 1: Dependencias
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# Stage 2: Compilación de Next.js y script de migraciones
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm run build
RUN npx esbuild scripts/migrate.mjs --bundle --platform=node \
    --format=esm --outfile=migrate.bundle.mjs \
    --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"

# Stage 3: Runner de producción
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S iqmx && adduser -S iqmx -G iqmx

COPY --from=builder --chown=iqmx:iqmx /app/public ./public
COPY --from=builder --chown=iqmx:iqmx /app/.next/standalone ./
COPY --from=builder --chown=iqmx:iqmx /app/.next/static ./.next/static
COPY --from=builder --chown=iqmx:iqmx /app/migrate.bundle.mjs ./migrate.mjs
COPY --from=builder --chown=iqmx:iqmx /app/drizzle ./drizzle

USER iqmx
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["sh", "-c", "node migrate.mjs && node server.js"]
