// File: modules/mdl_plusales/src/server/schema.ts
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  doublePrecision, // <--- Import doublePrecision
} from "drizzle-orm/pg-core";

export const plusalesDocuments = pgTable("plusales_documents", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  regionId: text("region_id").notNull(),
  outletId: text("outlet_id").notNull(),
  date: timestamp("date").notNull(),
  documentNumber: varchar("document_number", { length: 100 }).notNull(),
  // DATA OMSET (Gunakan doublePrecision agar potongan pajak 10% tidak crash)
  grossSales: doublePrecision("gross_sales").notNull().default(0),
  discount: doublePrecision("discount").notNull().default(0),
  tax: doublePrecision("tax").notNull().default(0),
  service: doublePrecision("service").notNull().default(0),
  netSales: doublePrecision("net_sales").notNull().default(0),
  // DATA KAS
  totalSettlement: doublePrecision("total_settlement").notNull().default(0),
  totalPettycash: doublePrecision("total_pettycash").notNull().default(0),
  cashOnHand: doublePrecision("cash_on_hand").notNull().default(0),
  balanceDifference: doublePrecision("balance_difference").notNull().default(0),
  discrepancyNote: text("discrepancy_note"),
  proofFileId: text("proof_file_id"),
  status: varchar("status", { length: 20 }).notNull().default("COMPLETED"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const plusalesDynamicItems = pgTable("plusales_dynamic_items", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  category: varchar("category", { length: 30 }).notNull(),
  name: text("name").notNull(),
  amount: doublePrecision("amount").notNull().default(0), // <--- doublePrecision
  createdAt: timestamp("created_at").defaultNow(),
});
