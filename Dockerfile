# Multi-stage Dockerfile pour application de messagerie privée Next.js + WebSocket
FROM node:24-alpine AS base

# Dépendances système pour better-sqlite3 si recompilation nécessaire
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Étape 1 : Installation des dépendances
FROM base AS dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Étape 2 : Build de Next.js
FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Étape 3 : Image de Production Finale
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/app/data/chat.db
ENV UPLOAD_DIR=/app/uploads

# Création des dossiers de persistance
RUN mkdir -p /app/data /app/uploads

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

CMD ["npm", "run", "start"]
