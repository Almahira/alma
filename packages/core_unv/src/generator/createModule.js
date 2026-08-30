// File: packages/core_unv/src/generator/createModule.js
import fs from "fs";
import path from "path";
import readline from "readline";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

function promptQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function pascalCase(str) {
  return str.replace(/(^\w|-\w|_\w|\s\w)/g, (clear) =>
    clear.replace(/[-_\s]/, "").toUpperCase(),
  );
}

async function runInteractiveCLI() {
  console.clear();
  console.log(`
${c.cyan}${c.bold}===================================================================
   ALMA ERP MODULE GENERATOR CLI v2.0.0
   Standard Gold Enterprise Module Scaffolding Tool
===================================================================${c.reset}
  `);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const rawName = await promptQuestion(
    rl,
    `${c.bold}? Nama Modul Bisnis (e.g. Point of Sale, Kitchen Display, Stock Transfer):${c.reset} `,
  );
  const displayName = rawName.trim() || "Modul Baru";
  const defaultSlug = displayName.toLowerCase().replace(/[^a-z0-9]/g, "");

  const rawSlug = await promptQuestion(
    rl,
    `${c.bold}? Nama Identifier / Folder Modul [mdl_${defaultSlug}]:${c.reset} `,
  );
  const slug = (rawSlug.trim() || defaultSlug)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/^mdl_/, "");

  console.log(`\n${c.bold}? Pilih Tipe Arketipe Modul:${c.reset}`);
  console.log(
    `  ${c.cyan}1. Modul Transaksi (tx_event_journal | Prefiks: TX_${slug.toUpperCase()}_*)${c.reset}`,
  );
  console.log(
    `  ${c.yellow}2. Modul Master Data (system_event_journal | Master Domain)${c.reset}`,
  );

  const rawType = await promptQuestion(
    rl,
    `${c.bold}Pilihan [1/2, default 1]:${c.reset} `,
  );
  const archetype = rawType.trim() === "2" ? "MASTER_DATA" : "TRANSACTION";

  const rawIcon = await promptQuestion(
    rl,
    `\n${c.bold}? Nama Ikon Lucide (e.g. ShoppingCart, Package, Tags, Store, ChartPie) [Package]:${c.reset} `,
  );
  const cleanIconInput = rawIcon.trim() || "Package";
  const icon = pascalCase(cleanIconInput);

  const modulesPath = path.join(process.cwd(), "modules");
  let calculatedOrder = 5;
  if (fs.existsSync(modulesPath)) {
    const existingMdlCount = fs
      .readdirSync(modulesPath)
      .filter((dir) => dir.startsWith("mdl_")).length;
    calculatedOrder = existingMdlCount + 1;
  }

  const rawOrder = await promptQuestion(
    rl,
    `${c.bold}? Urutan Posisi Menu di Sidebar [${calculatedOrder}]:${c.reset} `,
  );
  const order = parseInt(rawOrder.trim(), 10) || calculatedOrder;

  rl.close();

  return {
    displayName,
    slug,
    archetype,
    icon,
    order,
  };
}

function generateModule(opt) {
  const rootDir = process.cwd();
  const moduleDirName = `mdl_${opt.slug}`;
  const targetDir = path.join(rootDir, "modules", moduleDirName);
  const PascalName = pascalCase(opt.slug);
  const UpperSlug = opt.slug.toUpperCase();
  const eventPrefix =
    opt.archetype === "TRANSACTION" ? `TX_${UpperSlug}` : UpperSlug;
  const isTx = opt.archetype === "TRANSACTION";

  console.log(
    `\n${c.cyan}  Membangkitkan Modul '${moduleDirName}' dengan Standar Emas Alma...${c.reset}`,
  );

  fs.mkdirSync(path.join(targetDir, "src", "shared"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "src", "server"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "src", "client", "features"), {
    recursive: true,
  });

  // 1. package.json
  fs.writeFileSync(
    path.join(targetDir, "package.json"),
    JSON.stringify(
      {
        name: `@ALMA/${moduleDirName}`,
        version: "1.0.0",
        description: `Modul ${opt.displayName} Standar Emas Enterprise`,
        main: "src/index.ts",
        type: "module",
      },
      null,
      2,
    ),
  );

  // 2. tsconfig.json
  fs.writeFileSync(
    path.join(targetDir, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "../../tsconfig.json",
        include: ["src/**/*"],
      },
      null,
      2,
    ),
  );

  // 3. server/schema.ts (Drizzle PostgreSQL)
  const schemaContent = `// File: modules/${moduleDirName}/src/server/schema.ts
import { pgTable, text, varchar, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const ${opt.slug}Documents = pgTable("${opt.slug}_documents", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  regionId: text("region_id").notNull(),
  outletId: text("outlet_id"),
  name: varchar("name", { length: 150 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
`;
  fs.writeFileSync(
    path.join(targetDir, "src", "server", "schema.ts"),
    schemaContent,
  );

  // 4. shared/Projection.ts (CQRS In-Memory Read Model)
  const projectionContent = `// File: modules/${moduleDirName}/src/shared/${PascalName}Projection.ts
import { ProjectionHandler } from "../../../../packages/core_unv/src/cqrs/types";
import { LedgerEventDoc } from "../../../../packages/core_unv/src/ledger/schema";

export interface ${PascalName}State {
  items: any[];
}

export class ${PascalName}Projection implements ProjectionHandler<${PascalName}State> {
  aggregateType = "${isTx ? `${UpperSlug}_DOCUMENT` : UpperSlug}";
  listenTo = ["ORGANIZATION"];

  private items = new Map<string, any>();

  public applyEvent(event: LedgerEventDoc): void {
    const { type, payload, aggregateId } = event;
    switch (type) {
      case "${eventPrefix}_CREATED":
        this.items.set(aggregateId, {
          id: aggregateId,
          name: payload.reference?.name || payload.name || "Item Baru",
          companyId: payload.organization?.companyId || payload.companyId || "",
          regionId: payload.location?.regionId || payload.regionId || "",
          outletId: payload.location?.outletId || payload.outletId || null,
          status: payload.status || "DRAFT",
          isActive: true,
        });
        break;
      case "${eventPrefix}_UPDATED":
        if (this.items.has(aggregateId)) {
          const existing = this.items.get(aggregateId);
          this.items.set(aggregateId, {
            ...existing,
            ...payload,
            name: payload.reference?.name || payload.name || existing.name,
          });
        }
        break;
      case "${eventPrefix}_ARCHIVED":
        if (this.items.has(aggregateId)) {
          this.items.get(aggregateId).isActive = false;
        }
        break;
      case "${eventPrefix}_RESTORED":
        if (this.items.has(aggregateId)) {
          this.items.get(aggregateId).isActive = true;
        }
        break;
    }
  }

  public getState(): ${PascalName}State {
    return {
      items: Array.from(this.items.values()),
    };
  }

  public reset(): void {
    this.items.clear();
  }

  public restoreState(state: ${PascalName}State): void {
    this.items.clear();
    if (state && state.items) {
      state.items.forEach((item) => this.items.set(item.id, item));
    }
  }
}
`;
  fs.writeFileSync(
    path.join(targetDir, "src", "shared", `${PascalName}Projection.ts`),
    projectionContent,
  );

  // 5. server/event-handlers.ts
  const serverHandlersContent = `// File: modules/${moduleDirName}/src/server/event-handlers.ts
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";

export const ${opt.slug}Handlers: Record<string, (tx: any, event: any) => Promise<void>> = {
  ${eventPrefix}_CREATED: async (tx, event) => {
    const p = event.payload;
    await tx.insert(schema.${opt.slug}Documents).values({
      id: event.aggregateId,
      companyId: p.organization?.companyId || p.companyId || "",
      regionId: p.location?.regionId || p.regionId || "",
      outletId: p.location?.outletId || p.outletId || null,
      name: p.reference?.name || p.name || "Item Baru",
      status: p.status || "DRAFT",
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  ${eventPrefix}_UPDATED: async (tx, event) => {
    const p = event.payload;
    await tx
      .update(schema.${opt.slug}Documents)
      .set({
        name: p.reference?.name || p.name,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.${opt.slug}Documents.id, event.aggregateId));
  },
  ${eventPrefix}_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.${opt.slug}Documents)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.${opt.slug}Documents.id, event.aggregateId));
  },
  ${eventPrefix}_RESTORED: async (tx, event) => {
    await tx
      .update(schema.${opt.slug}Documents)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.${opt.slug}Documents.id, event.aggregateId));
  },
};
`;
  fs.writeFileSync(
    path.join(targetDir, "src", "server", "event-handlers.ts"),
    serverHandlersContent,
  );

  // 6. client/command-handlers.ts
  const commandHandlersContent = `// File: modules/${moduleDirName}/src/client/command-handlers.ts
import { Command, CommandHandler, AlmaTransactionEnvelope } from "../../../../packages/core_unv/src/cqrs/types";
import { globalLedger } from "../../../../packages/core_unv/src/ledger/UniversalLedger";
import { ulid } from "ulidx";
import { useOrgStore } from "../../../mdl_organization/src/client/store";

function getActiveActor(): { userId: string; role: string } {
  try {
    const rawUser = localStorage.getItem("__unv_activeUser");
    const orgState = useOrgStore.getState();
    if (rawUser) {
      const user = JSON.parse(rawUser);
      const emp = orgState.employees.find((e) => e.id === user.employeeId);
      return { userId: emp?.fullName || user.username || "SUPER ADMIN", role: user.role || "SUPER_ADMIN" };
    }
  } catch {}
  return { userId: "RENDI FAIZAL", role: "SUPER_ADMIN" };
}

export const ${opt.slug}CommandHandlers: CommandHandler[] = [
  {
    commandType: "CREATE_${UpperSlug}",
    execute: async (cmd: Command) => {
      const id = \`${UpperSlug.slice(0, 3)}_\${ulid()}\`;
      const activeActor = getActiveActor();
      const canonicalPayload: AlmaTransactionEnvelope = {
        id,
        type: "${UpperSlug}",
        action: "CREATE",
        status: "SUCCESS",
        timestamp: new Date().toISOString(),
        actor: { id: activeActor.userId, name: activeActor.userId, role: activeActor.role },
        organization: { companyId: cmd.payload.companyId || localStorage.getItem("__unv_companyId") || "" },
        location: {
          regionId: cmd.payload.regionId || localStorage.getItem("__unv_regionId") || null,
          outletId: cmd.payload.outletId || localStorage.getItem("__unv_outletId") || null,
        },
        reference: { name: cmd.payload.name },
        amount: { subtotal: 0, total: 0, paid: 0, balance: 0 },
        data: { ...cmd.payload },
      };
      await globalLedger.appendEvent(
        "${eventPrefix}_CREATED",
        id,
        "${isTx ? `${UpperSlug}_DOCUMENT` : UpperSlug}",
        1,
        canonicalPayload,
        activeActor,
      );
    },
  },
  {
    commandType: "ARCHIVE_${UpperSlug}",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      await globalLedger.appendEvent(
        "${eventPrefix}_ARCHIVED",
        id,
        "${isTx ? `${UpperSlug}_DOCUMENT` : UpperSlug}",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },
  {
    commandType: "RESTORE_${UpperSlug}",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      await globalLedger.appendEvent(
        "${eventPrefix}_RESTORED",
        id,
        "${isTx ? `${UpperSlug}_DOCUMENT` : UpperSlug}",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },
];
`;
  fs.writeFileSync(
    path.join(targetDir, "src", "client", "command-handlers.ts"),
    commandHandlersContent,
  );

  // 7. client/store.ts
  const storeContent = `// File: modules/${moduleDirName}/src/client/store.ts
import { create } from "zustand";
import { globalRegistry } from "../../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { ${PascalName}State } from "../shared/${PascalName}Projection";

export interface ${PascalName}StoreState extends ${PascalName}State {
  refreshData: () => void;
}

export const use${PascalName}Store = create<${PascalName}StoreState>((set) => ({
  items: [],
  refreshData: () => {
    const state = globalRegistry.getState("${isTx ? `${UpperSlug}_DOCUMENT` : UpperSlug}") as ${PascalName}State | null;
    if (state) {
      set({ items: state.items || [] });
    }
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("UNV_STATE_UPDATED", () => {
    use${PascalName}Store.getState().refreshData();
  });
  use${PascalName}Store.getState().refreshData();
}
`;
  fs.writeFileSync(
    path.join(targetDir, "src", "client", "store.ts"),
    storeContent,
  );

  // 8. client/Page.tsx
  const pageContent = `// File: modules/${moduleDirName}/src/client/${PascalName}Page.tsx
import React, { useState } from "react";
import { ${opt.icon}, Plus, Trash2, RotateCcw } from "lucide-react";
import { use${PascalName}Store } from "./store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayout";

export function ${PascalName}Page() {
  const { items } = use${PascalName}Store();
  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");
  const { openAlert } = useUniversalModal();

  const filteredItems = (items || []).filter((it: any) =>
    viewStatus === "AKTIF" ? it.isActive !== false : it.isActive === false,
  );

  const handleCreate = async () => {
    const name = prompt("Masukkan nama baru:");
    if (!name) return;
    try {
      await globalCommandBus.execute({
        type: "CREATE_${UpperSlug}",
        payload: { name: name.toUpperCase() },
      });
      sysToast.success("Berhasil", "Data berhasil ditambahkan.");
    } catch (e: any) {
      sysToast.error("Gagal", e.message);
    }
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      <div className="h-16 px-6 border-b border-(--border-color) flex items-center justify-between shrink-0 shadow-xs">
        <h2 className="text-xl font-black text-(--text-primary) tracking-tight flex items-center gap-2">
          <${opt.icon} className="w-5 h-5 text-orange-500" /> ${opt.displayName}
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-(--bg-input) p-1 rounded-xl border border-(--border-color)">
            <button
              onClick={() => setViewStatus("AKTIF")}
              className={\`px-3 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer \${
                viewStatus === "AKTIF"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }\`}
            >
              DATA AKTIF
            </button>
            <button
              onClick={() => setViewStatus("ARSIP")}
              className={\`px-3 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer \${
                viewStatus === "ARSIP"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }\`}
            >
              ARSIP
            </button>
          </div>
          {viewStatus === "AKTIF" && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" /> TAMBAH DATA
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
        <div className="bg-(--bg-card) border border-(--border-color) rounded-xl shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black text-(--text-secondary) tracking-wider">
                <th className="px-5 py-3">Nama Entitas</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border-color) text-xs font-semibold text-(--text-primary)">
              {filteredItems.map((it: any) => (
                <tr key={it.id} className="hover:bg-(--surface-hover) transition">
                  <td className="px-5 py-3 font-bold">{it.name}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="px-2 py-0.5 text-[9px] font-black rounded uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {it.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right space-x-1">
                    {viewStatus === "AKTIF" ? (
                      <button
                        onClick={() =>
                          openAlert({
                            title: "Arsipkan Data",
                            message: \`Arsipkan "\${it.name}"?\`,
                            confirmText: "ARSIPKAN",
                            onConfirm: () =>
                              globalCommandBus.execute({
                                type: "ARCHIVE_${UpperSlug}",
                                payload: { id: it.id },
                              }),
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                        title="Arsipkan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          globalCommandBus.execute({
                            type: "RESTORE_${UpperSlug}",
                            payload: { id: it.id },
                          })
                        }
                        className="px-2 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3 inline mr-1" /> RESTORE
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="p-8 text-center text-(--text-secondary) italic"
                  >
                    Belum ada data pada tab ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`;
  fs.writeFileSync(
    path.join(targetDir, "src", "client", `${PascalName}Page.tsx`),
    pageContent,
  );

  // 9. index.ts (Plugin Manifest)
  const indexContent = `// File: modules/${moduleDirName}/src/index.ts
import React from "react";
import { ${opt.icon} } from "lucide-react";
import { ClientPlugin, ServerPlugin } from "../../../packages/core_unv/src/plugin/types";
import { globalRegistry } from "../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { ${PascalName}Projection } from "./shared/${PascalName}Projection";
import { ${opt.slug}Handlers } from "./server/event-handlers";
import { ${opt.slug}CommandHandlers } from "./client/command-handlers";
import { ${PascalName}Page } from "./client/${PascalName}Page";

export const ${PascalName}Plugin: ClientPlugin & ServerPlugin = {
  name: "${moduleDirName}",
  version: "1.0.0",
  displayName: "${opt.displayName}",
  description: "Modul ${opt.displayName} Standar Emas Enterprise",
  icon: React.createElement(${opt.icon}, { className: "w-5 h-5 text-orange-500" }),
  isCore: false,
  onRegister: () => {
    globalRegistry.register(new ${PascalName}Projection());
    console.log("[${moduleDirName.toUpperCase()}] Proyeksi terdaftar.");
  },
  registerProjections: () => [new ${PascalName}Projection()],
  registerUIMenu: () => [
    {
      id: "${moduleDirName}",
      label: "${opt.displayName}",
      icon: React.createElement(${opt.icon}),
      order: ${opt.order},
      children: [
        {
          id: "${opt.slug}_main",
          label: "Master ${opt.displayName}",
          path: "/master/${opt.slug}",
        },
      ],
    },
  ],
  registerUIRoutes: () => [
    {
      path: "/master/${opt.slug}",
      element: React.createElement(${PascalName}Page),
      contextId: "${moduleDirName}",
    },
  ],
  registerCommandHandlers: () => ${opt.slug}CommandHandlers,
  registerEventHandlers: () => ${opt.slug}Handlers,
  onEnable: () => console.log("[${moduleDirName.toUpperCase()}] Aktif."),
  onDisable: () => console.log("[${moduleDirName.toUpperCase()}] Non-aktif."),
};
`;
  fs.writeFileSync(path.join(targetDir, "src", "index.ts"), indexContent);

  autoRegisterToPluginRegistry(rootDir, opt, PascalName, moduleDirName);
  autoRegisterToServerSyncWorker(rootDir, opt, PascalName, moduleDirName);
}

function autoRegisterToPluginRegistry(rootDir, opt, PascalName, moduleDirName) {
  const registryPath = path.join(
    rootDir,
    "apps",
    "client_unv",
    "src",
    "pluginRegistry.ts",
  );
  if (!fs.existsSync(registryPath)) return;

  let content = fs.readFileSync(registryPath, "utf-8");
  const importPlugin = `import { ${PascalName}Plugin } from "../../../modules/${moduleDirName}/src/index";\n`;
  const registerLine = `manager.register(${PascalName}Plugin);\n`;

  if (!content.includes(importPlugin)) {
    const lastImportIdx = content.lastIndexOf("import { ");
    if (lastImportIdx !== -1) {
      const endOfLine = content.indexOf("\n", lastImportIdx);
      content =
        content.slice(0, endOfLine + 1) +
        importPlugin +
        content.slice(endOfLine + 1);
    } else {
      content = importPlugin + content;
    }
  }

  if (!content.includes(registerLine)) {
    content += registerLine;
  }

  fs.writeFileSync(registryPath, content);
  console.log(
    `  ${c.green}✓ Otomatis terdaftar di Plugin Registry (apps/client_unv/src/pluginRegistry.ts).${c.reset}`,
  );
}

function autoRegisterToServerSyncWorker(
  rootDir,
  opt,
  PascalName,
  moduleDirName,
) {
  const syncWorkerPath = path.join(
    rootDir,
    "apps",
    "server_unv",
    "src",
    "worker",
    "syncWorker.ts",
  );
  if (!fs.existsSync(syncWorkerPath)) return;

  let content = fs.readFileSync(syncWorkerPath, "utf-8");
  const importStatement = `import { ${opt.slug}Handlers } from "../../../../modules/${moduleDirName}/src/server/event-handlers.js";\n`;
  const handlerSpread = `  ...${opt.slug}Handlers,\n`;

  if (!content.includes(importStatement)) {
    const lastImportIndex = content.lastIndexOf("import { ");
    if (lastImportIndex !== -1) {
      const endOfLine = content.indexOf("\n", lastImportIndex);
      content =
        content.slice(0, endOfLine + 1) +
        importStatement +
        content.slice(endOfLine + 1);
    } else {
      content = importStatement + content;
    }
  }

  if (!content.includes(`...${opt.slug}Handlers`)) {
    if (
      content.includes("const serverHandlers: Record<string, Function> = {")
    ) {
      content = content.replace(
        "const serverHandlers: Record<string, Function> = {",
        `const serverHandlers: Record<string, Function> = {\n${handlerSpread}`,
      );
    }
  }

  fs.writeFileSync(syncWorkerPath, content);
  console.log(
    `  ${c.green}✓ Otomatis terdaftar di Server Sync Worker (apps/server_unv/src/worker/syncWorker.ts).${c.reset}`,
  );
}

async function main() {
  try {
    const options = await runInteractiveCLI();
    generateModule(options);
    console.log(
      `\n${c.green}${c.bold}🎉 SUKSES BESAR! Modul '${options.displayName}' siap digunakan tanpa perlu menyentuh Core Engine!${c.reset}\n`,
    );
  } catch (err) {
    console.error(
      `\n${c.red}✖ Gagal membangkitkan modul:${c.reset}`,
      err.message,
    );
  }
}

main();
