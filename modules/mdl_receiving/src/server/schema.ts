// File: modules/mdl_receiving/src/server/schema.ts
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

// 1. TABEL HEADER DOKUMEN (INVOICE / NOTA PENERIMAAN)
export const receivingDocuments = pgTable("receiving_documents", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  regionId: text("region_id").notNull(),
  outletId: text("outlet_id"),
  vendorId: text("vendor_id"),
  documentType: varchar("document_type", { length: 20 }).notNull(), // HUTANG, PIUTANG, PETTYCASH
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
  date: timestamp("date").notNull(),
  dueDate: timestamp("due_date"),
  totalAmount: integer("total_amount").notNull().default(0),
  paidAmount: integer("paid_amount").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("DRAFT"), // DRAFT, COMPLETED, CANCELLED
  paymentStatus: varchar("payment_status", { length: 20 })
    .notNull()
    .default("UNPAID"), // UNPAID, PARTIAL, PAID, VOID
  cancelReason: text("cancel_reason"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2. TABEL DETAIL BARANG & RETUR (PHYSICAL FULFILLMENT)
export const receivingItems = pgTable("receiving_items", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  itemId: text("item_id").notNull(),
  isExpense: boolean("is_expense").default(false),
  qty: integer("qty").notNull().default(1), // Kuantitas nota awal
  receivedQty: integer("received_qty").notNull().default(1), // Kuantitas fisik diterima
  returnedQty: integer("returned_qty").notNull().default(0), // Kuantitas retur/rusak
  price: integer("price").notNull(),
  subtotal: integer("subtotal").notNull(),
  itemStatus: varchar("item_status", { length: 20 })
    .notNull()
    .default("RECEIVED"), // PENDING, RECEIVED, RETURNED, CANCELLED
  createdAt: timestamp("created_at").defaultNow(),
});

// 3. TABEL HISTORI CICILAN & AUDIT KAS
export const receivingPayments = pgTable("receiving_payments", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  amount: integer("amount").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // KASIR, KAS_BESAR, TRANSFER
  paymentDate: timestamp("payment_date").notNull(),
  proofFileId: text("proof_file_id"),
  status: varchar("status", { length: 20 }).notNull().default("SUCCESS"), // SUCCESS, VOID
  voidReason: text("void_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});
