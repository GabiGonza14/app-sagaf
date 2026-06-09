# Dockerfile — SAGAF Next.js 14 + SQLite (better-sqlite3)
# better-sqlite3 requiere compilación nativa, así que necesitamos build tools.

FROM node:20-slim

# Instalar dependencias de compilación para better-sqlite3 y otros módulos nativos
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  sqlite3 \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Instalar pnpm globalmente (el proyecto usa pnpm-lock.yaml)
RUN npm install -g pnpm

WORKDIR /app

# Copiar dependencias primero para aprovechar cache de capas
COPY package.json ./
COPY pnpm-lock.yaml* ./

# Instalar dependencias usando pnpm (respeta pnpm-lock.yaml)
RUN pnpm install --frozen-lockfile

# Copiar todo el código fuente
COPY . .

# Variables de entorno por defecto (sobrescribibles en docker-compose)
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/db-data/sagaf.db
ENV AUTH_SECRET=change-me-in-production

# Crear directorio de la base de datos con permisos correctos
RUN mkdir -p /app/db-data

# Inicializar la BD con schema ANTES del build (Next.js prerenderiza algunas APIs)
RUN pnpm tsx db/init.ts

# Compilar la aplicación Next.js (requerido antes de next start)
RUN pnpm run build

# Exponer el puerto de Next.js
EXPOSE 3000

# Script de inicio: inicializa la BD si no existe y luego arranca
CMD ["sh", "-c", "node_modules/.bin/tsx db/init.ts && node_modules/.bin/tsx db/seed.ts && pnpm run start"]
