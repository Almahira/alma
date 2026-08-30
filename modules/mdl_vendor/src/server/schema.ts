// File: modules/mdl_vendor/src/server/schema.ts
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

export const vendors = pgTable("vendors", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  regionId: text("region_id"), // Null jika vendor pusat
  outletId: text("outlet_id"), // Null jika vendor regional
  name: text("name").notNull(),
  contactNumber: varchar("contact_number", { length: 50 }),
  bankName: varchar("bank_name", { length: 100 }),
  bankAccount: varchar("bank_account", { length: 100 }),
  bankAccountName: varchar("bank_account_name", { length: 255 }),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendorDocuments = pgTable("vendor_documents", {
  id: text("id").primaryKey(),
  vendorId: text("vendor_id").notNull(),
  name: text("name").notNull(), // Misal: "Sertifikat Halal", "NPWP"
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  size: integer("size").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
