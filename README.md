# ALMA Engine - Enterprise ERP System

A robust, local-first Progressive Web Application (PWA) built on an event-driven, CQRS (Command Query Responsibility Segregation) architecture [cite: 1]. Engineered for high reliability, this system provides seamless offline capabilities, resilient data synchronization, and scalable modularity tailored for enterprise resource planning (ERP).

## 🏗 Architecture Overview

The repository is structured as a monorepo utilizing `pnpm` workspaces, isolating the frontend client, backend server, core logic, and business modules into discrete packages [cite: 1].

At its core, the backend relies on an **Event-Sourced Ledger** (`UniversalLedger`) combined with **Inbox and Outbox Daemons** [cite: 1]. This guarantees that all transactions are recorded immutably as a sequence of events. The outbox pattern ensures reliable message delivery and state consistency across distributed clients, even when operating in intermittent network conditions.

### Key Architectural Patterns
* **CQRS & Event Sourcing:** Strict separation of read and write operations (`CommandBus`, `EventBus`, `CommandGuard`, `UpcasterRegistry`) [cite: 1]. 
* **Local-First PWA:** The client is a fully installable PWA (`manifest.json`, `sw.js`) designed to function completely offline [cite: 1]. Local mutations are queued and processed when connectivity is restored.
* **Resilient Synchronization:** Dedicated synchronization workers (`syncWorker.ts`) and a sophisticated conflict resolution strategy (`threeWayMerge.ts`) reconcile state between the edge devices and the central server [cite: 1].
* **Distributed Locking & Telemetry:** Built-in distributed locks (`DistributedLock.ts`) prevent race conditions, while the `TelemetryEngine` monitors system health and background job queues (`JobQueue`, `Scheduler`) [cite: 1].

## 📦 Tech Stack

* **Frontend:** React, Vite (PWA configured), HTML2Canvas (for PDF/Export rendering) [cite: 1].
* **Backend:** Node.js, Drizzle ORM for type-safe database schema management [cite: 1].
* **Message Broker:** NATS JetStream integration (`nats.ts`) for high-throughput, guaranteed event delivery [cite: 1].
* **Infrastructure:** Docker & Docker Compose (`docker-compose.yml`, `docker-compose.prod.yml`) for containerized orchestration [cite: 1].

## 📂 Project Structure

```text
alma/
├── apps/
│   ├── client_unv/      # React/Vite PWA Frontend (Dashboards, UI, Service Workers)
│   └── server_unv/      # Node.js Backend Server (Routes, Config, Daemons)
├── modules/             # Isolated Business Domain Modules
│   ├── mdl_executivepanel/  # Executive Dashboard & Target Config
│   ├── mdl_item/            # Item & Inventory Management
│   ├── mdl_organization/    # Organization & Employee Management
│   ├── mdl_plusales/        # Sales & POS Operations
│   ├── mdl_receiving/       # Receiving & Inbound Logistics
│   ├── mdl_vendor/          # Vendor & Supplier Management
│   └── mdl_warehouse/       # Warehouse, Stock Opname & Spoil/Waste
├── packages/            # Shared Core Libraries
│   ├── core_unv/        # CQRS, UniversalLedger, Sync Engines, IO Managers
│   └── db-schema/       # Drizzle ORM Schemas (Billing, Device, Journal, Telemetry)
├── pnpm-workspace.yaml  # Monorepo configuration
└── docker-compose.yml   # Container orchestration
```

## 🧩 Business Modules

The system is highly modular. Each domain inside the `modules/` directory contains its own Client Pages, Server Event Handlers, Schemas, and Projections [cite: 1]:

* **Item Management:** Handles product catalogs, item variants, and pricing structures (`ItemPage.tsx`, `ItemProjection.ts`) [cite: 1].
* **Warehouse Operations:** Manages complex logistics including Recipes, Stock Opname (audits), and Spoil/Waste tracking (`StockOpnamePage.tsx`, `SpoilWastePage.tsx`) [cite: 1].
* **Receiving:** Processes inbound shipments and vendor deliveries (`ReceivingPage.tsx`) [cite: 1].
* **Organization:** Manages employee accounts, access roles, and organizational hierarchies (`EmployeePage.tsx`, `AccountPage.tsx`) [cite: 1].
* **Executive Panel:** High-level analytics, owner ledgers, and target configurations (`ExecutiveDashboard.tsx`, `OwnerLedgerPage.tsx`) [cite: 1].

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18+ recommended)
* **PNPM** package manager
* **Docker** & Docker Compose
* **PostgreSQL** (configured via Drizzle)
* **NATS Server** (with JetStream enabled)

### Installation & Setup

1. **Install Dependencies:**
   Navigate to the root directory and run:
   ```bash
   pnpm install
   ```

2. **Database & Environment Setup:**
   Ensure your `.env` files are configured for both `apps/client_unv` and `apps/server_unv` [cite: 1]. Run the Drizzle migrations to set up the database schemas.

3. **Start Infrastructure:**
   Spin up the required backend services (Database, NATS) using Docker:
   ```bash
   docker-compose up -d
   ```

4. **Initialize System (Scripts):**
   The server includes several utility scripts for initial setup (`apps/server_unv/src/scripts/`):
   ```bash
   # Reset and seed database
   pnpm --filter server_unv run reset-db
   pnpm --filter server_unv run seed
   # Reset NATS streams
   pnpm --filter server_unv run reset-nats
   ```

5. **Run Development Servers:**
   Start the frontend and backend concurrently:
   ```bash
   pnpm dev
   ```

## 🛠 Advanced Deployment

For production environments, the system is designed to be self-hosted. The backend API can be securely exposed using reverse proxy tunnels (e.g., Cloudflare Tunnels), and the server application can be managed via process managers like PM2 on a Debian-based Linux server. Frontend assets can be deployed to edge networks like Vercel (indicated by `vercel.json`) or served statically [cite: 1]. 
