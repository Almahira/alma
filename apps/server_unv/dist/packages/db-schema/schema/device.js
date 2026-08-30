// File: packages/db-schema/schema/device.ts
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
export const deviceRegistry = pgTable("device_registry", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    companyId: text("company_id").notNull(),
    regionId: text("region_id"), // NULLABLE (Opsional untuk Level Holding)
    outletId: text("outlet_id"), // NULLABLE (Opsional untuk Level Region / Gudang Pusat)
    nodePublicKey: text("node_public_key").notNull(),
    allowedModules: jsonb("allowed_modules").notNull(),
    lat: text("lat"),
    lng: text("lng"),
    status: varchar("status", { length: 30 }).notNull().default("ACTIVE"),
    lastSeenAt: timestamp("last_seen_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
