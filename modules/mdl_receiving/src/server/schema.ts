// File: modules/mdl_receiving/src/server/schema.ts
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  doublePrecision, // <--- Gunakan doublePrecision
} from "drizzle-orm/pg-core";

export const receivingDocuments = pgTable("receiving_documents", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  regionId: text("region_id").notNull(),
  outletId: text("outlet_id"),
  vendorId: text("vendor_id"),
  documentType: varchar("document_type", { length: 20 }).notNull(),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
  date: timestamp("date").notNull(),
  dueDate: timestamp("due_date"),
  totalAmount: doublePrecision("total_amount").notNull().default(0), // <--- doublePrecision
  paidAmount: doublePrecision("paid_amount").notNull().default(0), // <--- doublePrecision
  status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
  paymentStatus: varchar("payment_status", { length: 20 })
    .notNull()
    .default("UNPAID"),
  cancelReason: text("cancel_reason"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: doublePrecision("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const receivingItems = pgTable("receiving_items", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  itemId: text("item_id").notNull(),
  isExpense: boolean("is_expense").default(false),
  qty: doublePrecision("qty").notNull().default(1), // <--- doublePrecision
  receivedQty: doublePrecision("received_qty").notNull().default(1), // <--- doublePrecision
  returnedQty: doublePrecision("returned_qty").notNull().default(0), // <--- doublePrecision
  price: doublePrecision("price").notNull().default(0), // <--- doublePrecision
  subtotal: doublePrecision("subtotal").notNull().default(0), // <--- doublePrecision
  itemStatus: varchar("item_status", { length: 20 })
    .notNull()
    .default("RECEIVED"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const receivingPayments = pgTable("receiving_payments", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  amount: doublePrecision("amount").notNull().default(0),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  proofFileId: text("proof_file_id"),
  status: varchar("status", { length: 20 }).notNull().default("SUCCESS"),
  voidReason: text("void_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});
