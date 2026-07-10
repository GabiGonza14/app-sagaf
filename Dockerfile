# Dockerfile — SAGAF Next.js 14 + SQLite (better-sqlite3)
# better-sqlite3 requiere compilación nativa, así que necesitamos build tools.

FROM node:20-slim

# Crear usuario no-root e instalar dependencias de compilación en un solo RUN
RUN groupadd -r sagaf && useradd -r -g sagaf -m -d /app -s /bin/bash sagaf \
  && apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  sqlite3 \
  curl \
  gosu \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm

WORKDIR /app

# Copiar dependencias primero para aprovechar cache de capas
COPY package.json ./
COPY pnpm-lock.yaml ./

# Instalar dependencias usando pnpm (respeta pnpm-lock.yaml)
RUN pnpm install --frozen-lockfile

# Copiar código fuente explícitamente (evita docker:S6470 — no usar COPY . .)
COPY app/ ./app/
COPY components/ ./components/
COPY db/ ./db/
COPY lib/ ./lib/
COPY types/ ./types/
COPY public/ ./public/
COPY auth.ts ./
COPY auth.config.ts ./
COPY middleware.ts ./
COPY next.config.js ./
COPY next-env.d.ts ./
COPY postcss.config.js ./
COPY tailwind.config.ts ./
COPY tsconfig.json ./
COPY pnpm-workspace.yaml ./
COPY docker-entrypoint.sh ./

# Cambiar propiedad de /app al usuario sagaf
RUN chown -R sagaf:sagaf /app \
  && chmod +x /app/docker-entrypoint.sh

# Variables de entorno por defecto (sobrescribibles en docker-compose)
# NOTA: AUTH_SECRET se pasa via docker-compose, NUNCA hardcodeado aquí.
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/db-data/sagaf.db

# Crear directorio de BD, inicializar schema, y compilar Next.js
RUN mkdir -p /app/db-data \
  && pnpm tsx db/init.ts \
  && pnpm run build

# Exponer el puerto de Next.js
EXPOSE 3000

# Entrypoint: fixes volume permissions, then drops to sagaf user for the CMD
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["sh", "-c", "node_modules/.bin/tsx db/init.ts && node_modules/.bin/tsx db/seed.ts && pnpm run start"]
