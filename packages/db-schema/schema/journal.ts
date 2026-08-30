import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  unique,
} from "drizzle-orm/pg-core";

const baseJournalColumns = {
  id: text("id").primaryKey(), // eventId
  aggregateId: text("aggregate_id").notNull(),
  aggregateType: varchar("aggregate_type", { length: 50 }).notNull(),
  aggregateVersion: integer("aggregate_version").notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  regionId: text("region_id"), // Kolom Filter Spasial
  outletId: text("outlet_id"), // Kolom Filter Spasial
  payload: text("payload").notNull(), // Disimpan sebagai string JSON
  actor: text("actor").notNull(), // userId
  createdAt: timestamp("created_at").defaultNow(),
};

// Jurnal untuk Konfigurasi & Data Master (Full Sync Recovery)
export const systemEventJournal = pgTable(
  "system_event_journal",
  baseJournalColumns,
  (t) => ({
    unqSystemAggVersion: unique().on(t.aggregateId, t.aggregateVersion),
  }),
);

// Jurnal untuk Transaksi Operasional (Filtered 4-Layer Recovery)
export const txEventJournal = pgTable(
  "tx_event_journal",
  baseJournalColumns,
  (t) => ({
    unqTxAggVersion: unique().on(t.aggregateId, t.aggregateVersion),
  }),
);

// Jurnal Karantina untuk Event yang Gagal/Bentrok Fatal (DLQ)
export const quarantineEventJournal = pgTable("quarantine_event_journal", {
  ...baseJournalColumns,
  errorReason: text("error_reason").notNull(), // Alasan kenapa ditolak (misal: "JSON cacat" atau "Konflik tidak bisa di-merge")
  quarantinedAt: timestamp("quarantined_at").defaultNow(),
});
