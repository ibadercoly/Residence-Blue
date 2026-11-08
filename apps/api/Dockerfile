FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

# Copie des fichiers de configuration et dépendances
COPY package*.json ./
COPY tsconfig*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

RUN npm install

# Copie du code source
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Génération Prisma et build
RUN npm run build --workspace=@residence-blue/shared
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api ./apps/api

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/main.js"]
