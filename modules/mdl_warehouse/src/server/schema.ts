// File: modules/mdl_warehouse/src/server/schema.ts
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  jsonb,
  doublePrecision, // <--- TAMBAHKAN TIPE DOUBLE PRECISION
} from "drizzle-orm/pg-core";

// 1. DISTRIBUSI BARANG KE DIVISI
export const warehouseDistributions = pgTable("warehouse_distributions", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  regionId: text("region_id").notNull(),
  outletId: text("outlet_id").notNull(),
  date: timestamp("date").notNull(),
  documentNumber: varchar("document_number", { length: 100 }).notNull(),

  divisionId: text("division_id").notNull(),
  divisionName: text("division_name").notNull(),

  itemId: text("item_id").notNull(),
  itemName: text("item_name").notNull(),
  uomId: text("uom_id").notNull(),
  uomName: varchar("uom_name", { length: 50 }).notNull(),
  qty: doublePrecision("qty").notNull().default(1), // <--- DUKUNG PECAHAN
  unitCost: integer("unit_cost").notNull().default(0),
  totalCost: integer("total_cost").notNull().default(0),
  notes: text("notes"),

  status: varchar("status", { length: 20 }).notNull().default("COMPLETED"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2. SALDO STOK AWAL / BASELINE
export const warehouseInitialStocks = pgTable("warehouse_initial_stocks", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  outletId: text("outlet_id").notNull(),
  itemId: text("item_id").notNull(),
  initialQty: doublePrecision("initial_qty").notNull().default(0), // <--- DUKUNG PECAHAN
  lastAdjustedDate: timestamp("last_adjusted_date").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 3. DOKUMEN STOK OPNAME
export const warehouseStockOpnames = pgTable("warehouse_stock_opnames", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  regionId: text("region_id").notNull(),
  outletId: text("outlet_id").notNull(),
  date: timestamp("date").notNull(),
  documentNumber: varchar("document_number", { length: 100 }).notNull(),
  totalItemsCounted: integer("total_items_counted").notNull().default(0),
  totalVarianceQty: doublePrecision("total_variance_qty").notNull().default(0), // <--- DUKUNG PECAHAN
  totalVarianceCost: integer("total_variance_cost").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("COMPLETED"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const warehouseStockOpnameItems = pgTable(
  "warehouse_stock_opname_items",
  {
    id: text("id").primaryKey(),
    opnameId: text("opname_id").notNull(),
    itemId: text("item_id").notNull(),
    itemName: text("item_name").notNull(),
    uomName: varchar("uom_name", { length: 50 }).notNull(),
    initialStock: doublePrecision("initial_stock").notNull().default(0),
    stockIn: doublePrecision("stock_in").notNull().default(0),
    stockOut: doublePrecision("stock_out").notNull().default(0),
    systemStock: doublePrecision("system_stock").notNull().default(0),
    physicalStock: doublePrecision("physical_stock").notNull().default(0),
    varianceQty: doublePrecision("variance_qty").notNull().default(0),
    unitCost: integer("unit_cost").notNull().default(0),
    previousUnitCost: integer("previous_unit_cost").notNull().default(0),
    varianceCost: integer("variance_cost").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
);

// 4. TABEL SPOIL & WASTE (MENDUKUNG TAKARAN DESIMAL KECIL SEPERTI 0.001 KG)
export const warehouseSpoilWastes = pgTable("warehouse_spoil_wastes", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  regionId: text("region_id").notNull(),
  outletId: text("outlet_id").notNull(),
  date: timestamp("date").notNull(),
  documentNumber: varchar("document_number", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),

  divisionId: text("division_id"),
  divisionName: text("division_name"),

  menuItemId: text("menu_item_id"),
  menuItemName: text("menu_item_name"),
  menuPortionQty: doublePrecision("menu_portion_qty").default(1),

  itemId: text("item_id").notNull(),
  itemName: text("item_name").notNull(),
  inputQty: doublePrecision("input_qty").notNull().default(1), // <--- DUKUNG PECAHAN
  inputUom: varchar("input_uom", { length: 50 }).notNull(),
  convertedBaseQty: doublePrecision("converted_base_qty").notNull().default(1), // <--- DUKUNG PECAHAN DESIMAL 0.001
  baseUom: varchar("base_uom", { length: 50 }).notNull(),
  unitCost: integer("unit_cost").notNull().default(0),
  totalLossCost: integer("total_loss_cost").notNull().default(0),

  notes: text("notes"),
  status: varchar("status", { length: 20 }).notNull().default("COMPLETED"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 5. MASTER RESEP / BOM
export const warehouseRecipes = pgTable("warehouse_recipes", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  outletId: text("outlet_id"),
  name: text("name").notNull(),
  uomName: varchar("uom_name", { length: 50 }).notNull().default("PORSI"),
  foodCostPercentage: integer("food_cost_percentage").notNull().default(30),
  totalHppCost: integer("total_hpp_cost").notNull().default(0),
  idealSellingPrice: integer("ideal_selling_price").notNull().default(0),

  rawMaterials: jsonb("raw_materials").notNull().default([]),
  subRecipes: jsonb("sub_recipes").notNull().default([]),

  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
