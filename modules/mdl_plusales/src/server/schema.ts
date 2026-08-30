// File: modules/mdl_plusales/src/server/schema.ts
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

// 1. HEADER DOKUMEN REKAPITULASI PENJUALAN HARIAN
export const plusalesDocuments = pgTable("plusales_documents", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  regionId: text("region_id").notNull(),
  outletId: text("outlet_id").notNull(),
  date: timestamp("date").notNull(), // Tanggal Penjualan
  documentNumber: varchar("document_number", { length: 100 }).notNull(), // e.g., SLS-20260825-001

  // DATA STATIS (SISI OMSET / MENU SOLD)
  grossSales: integer("gross_sales").notNull().default(0),
  discount: integer("discount").notNull().default(0),
  tax: integer("tax").notNull().default(0), // PB1
  service: integer("service").notNull().default(0),
  netSales: integer("net_sales").notNull().default(0), // gross - discount - tax - service

  // DATA DINAMIS & KAS
  totalSettlement: integer("total_settlement").notNull().default(0), // Total EDC, QR, Transfer, dll.
  totalPettycash: integer("total_pettycash").notNull().default(0), // Pengeluaran kasir
  cashOnHand: integer("cash_on_hand").notNull().default(0), // Uang fisik di kasir
  balanceDifference: integer("balance_difference").notNull().default(0), // Sisi Dinamis - Sisi Statis (0 = Balance)
  discrepancyNote: text("discrepancy_note"), // Catatan jika ada selisih

  proofFileId: text("proof_file_id"), // Foto struk settlement EDC / closing
  status: varchar("status", { length: 20 }).notNull().default("COMPLETED"), // DRAFT, COMPLETED, CANCELLED
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2. RINCIAN BARIS DATA DINAMIS (EDC, QRIS, TRANSFER, COMPLIMENT)
export const plusalesDynamicItems = pgTable("plusales_dynamic_items", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  category: varchar("category", { length: 30 }).notNull(), // SETTLEMENT, DEDUCTION, CASH
  name: text("name").notNull(), // e.g. "EDC BCA", "QR BRI", "COMPLIMENT"
  amount: integer("amount").notNull(), // Nilai nominal (bisa minus untuk deduction)
  createdAt: timestamp("created_at").defaultNow(),
});
