// File: packages/db-schema/schema/telemetry.ts
import {
  pgTable,
  varchar,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

export const telemetryMetrics = pgTable("telemetry_metrics", {
  id: varchar("id", { length: 100 }).primaryKey(),
  deviceId: varchar("device_id", { length: 100 }).notNull(),
  metricName: varchar("metric_name", { length: 100 }).notNull(), // e.g., "UI_RENDER_TIME", "LEDGER_SYNC_TIME"
  durationMs: integer("duration_ms").notNull(),
  contextModule: varchar("context_module", { length: 100 }).notNull(), // e.g., "mdl_organization"
  metadata: jsonb("metadata"), // Menyimpan info tambahan seperti tipe browser, spek ram, dll
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
