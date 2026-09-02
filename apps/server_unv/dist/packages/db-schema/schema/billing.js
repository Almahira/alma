// File: packages/db-schema/schema/billing.ts
import { pgTable, text, varchar, timestamp, integer, jsonb, } from "drizzle-orm/pg-core";
export const billingOrders = pgTable("billing_orders", {
    id: text("id").primaryKey(), // Format: ALMA-ORD-ULID
    companyId: text("company_id"), // NULLABLE (Terisi jika transaksi berupa In-App Upgrade)
    companyName: text("company_name").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    tier: varchar("tier", { length: 20 }).notNull(), // "PREMIUM" | "EXCLUSIVE"
    amount: integer("amount").notNull(),
    status: varchar("status", { length: 30 }).notNull().default("PENDING"), // "PENDING" | "PAID" | "EXPIRED" | "FAILED"
    licenseKey: text("license_key"), // Token Ed25519 lengkap (ALMA-LIC-...)
    maxOutlets: integer("max_outlets").notNull().default(20),
    allowedModules: jsonb("allowed_modules").notNull(),
    validUntil: timestamp("valid_until"),
    paymentGateway: varchar("payment_gateway", { length: 50 }).default("MIDTRANS"),
    paymentReference: text("payment_reference"), // Snap Token / Transaction ID Midtrans
    emailDeliveryStatus: varchar("email_delivery_status", { length: 30 })
        .notNull()
        .default("NOT_SENT"), // "NOT_SENT" | "SENT" | "FAILED"
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
