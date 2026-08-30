// File: modules/mdl_item/src/server/schema.ts
import { pgTable, text, varchar, boolean, timestamp, integer, jsonb, } from "drizzle-orm/pg-core";
export const itemCategories = pgTable("item_categories", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    isActive: boolean("is_active").default(true),
    aggregateVersion: integer("aggregate_version").notNull().default(1),
    lastEventId: text("last_event_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});
export const itemUoms = pgTable("item_uoms", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    isActive: boolean("is_active").default(true),
    aggregateVersion: integer("aggregate_version").notNull().default(1),
    lastEventId: text("last_event_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});
export const itemProducts = pgTable("item_products", {
    id: text("id").primaryKey(),
    categoryId: text("category_id").notNull(),
    uomId: text("uom_id").notNull(),
    companyId: text("company_id").notNull(),
    regionId: text("region_id"), // Null jika item level Perusahaan
    outletId: text("outlet_id"), // Null jika item level Regional/Perusahaan
    name: text("name").notNull(),
    isExpense: boolean("is_expense").notNull().default(false), // <--- KOLOM EKSPLISIT
    pricing: jsonb("pricing").notNull().default({}), // Harga berjenjang (Key: regionId/outletId)
    approvalStatus: varchar("approval_status", { length: 20 })
        .notNull()
        .default("PENDING"),
    validateId: text("validate_id"),
    isActive: boolean("is_active").default(true),
    aggregateVersion: integer("aggregate_version").notNull().default(1),
    lastEventId: text("last_event_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});
