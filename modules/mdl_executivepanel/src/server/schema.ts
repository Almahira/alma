// File: modules/mdl_executivepanel/src/server/schema.ts
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  doublePrecision,
} from "drizzle-orm/pg-core";

// 1. TARGET PENJUALAN & JATAH KUOTA (SYSTEM JOURNAL)
export const executiveTargets = pgTable("executive_targets", {
  id: text("id").primaryKey(), // `${outletId}_${month}`
  companyId: text("company_id").notNull(),
  outletId: text("outlet_id").notNull(),
  month: varchar("month", { length: 10 }).notNull(), // "YYYY-MM"

  targetSales: doublePrecision("target_sales").notNull().default(0),
  foodSalesTargetPct: doublePrecision("food_sales_target_pct")
    .notNull()
    .default(85), // Target % Makanan
  beverageSalesTargetPct: doublePrecision("beverage_sales_target_pct")
    .notNull()
    .default(15), // Target % Minuman
  cogsBudgetPct: doublePrecision("cogs_budget_pct").notNull().default(35),
  opexBudgetLimit: doublePrecision("opex_budget_limit").notNull().default(0),
  payrollBudgetLimit: doublePrecision("payroll_budget_limit")
    .notNull()
    .default(0),
  bankFeePct: doublePrecision("bank_fee_pct").notNull().default(0.7), // Biaya EDC/MDR %

  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 2. ALOKASI CADANGAN OPSIONAL OWNER (UMROH, KURBAN, DLL) (SYSTEM JOURNAL)
export const executiveAllocations = pgTable("executive_allocations", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  outletId: text("outlet_id"),
  month: varchar("month", { length: 10 }).notNull(), // "YYYY-MM"
  name: text("name").notNull(), // e.g. "ALOKASI UMROH", "ALOKASI KURBAN"
  percentage: doublePrecision("percentage").notNull().default(0),
  nominal: doublePrecision("nominal").notNull().default(0),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 3. BUKU BESAR PENARIKAN OWNER & DEVIDEN RIIL (TRANSACTION JOURNAL)
export const executiveOwnerLedger = pgTable("executive_owner_ledger", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  regionId: text("region_id"),
  outletId: text("outlet_id"),
  date: timestamp("date").notNull(),
  documentNumber: varchar("document_number", { length: 100 }).notNull(),

  category: varchar("category", { length: 50 }).notNull(), // PRIVE, GAJI_HOLDING, DEVIDEN_MITRA, PROYEK
  recipientName: text("recipient_name").notNull(),
  percentage: doublePrecision("percentage").default(0),
  amount: doublePrecision("amount").notNull().default(0), // <--- doublePrecision
  sourceFund: varchar("source_fund", { length: 50 })
    .notNull()
    .default("TRANSFER_BANK"),
  notes: text("notes"),

  status: varchar("status", { length: 20 }).notNull().default("COMPLETED"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
