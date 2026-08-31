# File: Dockerfile (Root Monorepo)
FROM node:22-slim

# Install curl, ca-certificates & NATS Server binary
RUN apt-get update && apt-get install -y curl ca-certificates procps && rm -rf /var/lib/apt/lists/*

RUN curl -L https://github.com/nats-io/nats-server/releases/download/v2.10.14/nats-server-v2.10.14-linux-amd64.tar.gz -o /tmp/nats.tar.gz && \
    tar -xzf /tmp/nats.tar.gz -C /tmp && \
    mv /tmp/nats-server-v2.10.14-linux-amd64/nats-server /usr/local/bin/nats-server && \
    rm -rf /tmp/nats*

# Enable Corepack & pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Salin seluruh Monorepo
COPY . .

# Install dependencies monorepo
RUN pnpm install

# Setup folder uploads
RUN mkdir -p apps/server_unv/uploads

EXPOSE 5000

# Jalankan NATS JetStream di latar belakang, lalu jalankan Server Backend ALMA
CMD ["sh", "-c", "nats-server -js & cd apps/server_unv && npx tsx src/index.ts"]
