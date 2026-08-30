# File: apps/server_unv/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Salin konfigurasi workspace
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY packages/ ./packages/
COPY modules/ ./modules/
COPY apps/server_unv/ ./apps/server_unv/

# Install dependencies & build server
RUN pnpm install --frozen-lockfile
RUN pnpm --filter server build

# Stage 2: Runtime Image (Ringan & Cepat)
FROM node:20-alpine AS runner

WORKDIR /app
RUN npm install -g pnpm

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/modules/ ./modules/
COPY --from=builder /app/apps/server_unv/package.json ./apps/server_unv/package.json
COPY --from=builder /app/apps/server_unv/dist/ ./apps/server_unv/dist/

RUN pnpm install --prod --frozen-lockfile

EXPOSE 5000
ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "apps/server_unv/dist/apps/server_unv/src/index.js"]