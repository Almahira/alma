// File: modules/mdl_organization/src/server/schema.ts
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  date,
} from "drizzle-orm/pg-core";

// ==========================================
// 1. STRUKTUR ORGANISASI
// ==========================================
export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const regions = pgTable("regions", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Jakarta"),
  address: text("address"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const outlets = pgTable("outlets", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  regionId: text("region_id")
    .notNull()
    .references(() => regions.id),
  code: varchar("code", { length: 20 }).notNull().unique(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  industry: text("industry"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==========================================
// 2. DOKUMEN & REKENING ORGANISASI
// ==========================================
export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  targetId: text("target_id").notNull(),
  name: text("name").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  size: integer("size").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bankAccounts = pgTable("bank_accounts", {
  id: text("id").primaryKey(),
  targetId: text("target_id").notNull(),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ==========================================
// 3. HR - DIVISI, JABATAN & TIPE DOKUMEN
// ==========================================
export const divisions = pgTable("divisions", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const positions = pgTable("positions", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  divisionId: text("division_id")
    .notNull()
    .references(() => divisions.id),
  name: text("name").notNull(),
  sopFileUrl: text("sop_file_url"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentTypes = pgTable("document_types", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  name: text("name").notNull(), // KTP, SIM, NPWP, BPJS, IJAZAH, KONTRAK KERJA
  isRequired: boolean("is_required").default(false),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==========================================
// 4. HR - KARYAWAN, PENUGASAN, DOKUMEN & USER
// ==========================================
export const employees = pgTable("employees", {
  id: text("id").primaryKey(),
  employeeNumber: varchar("employee_number", { length: 30 }).notNull(),
  fullName: text("full_name").notNull(),
  gender: varchar("gender", { length: 20 }).notNull().default("LAKI-LAKI"),
  phone: text("phone"),
  email: text("email"),
  employmentStatus: varchar("employment_status", { length: 30 })
    .notNull()
    .default("PERMANENT"),
  systemStatus: varchar("system_status", { length: 30 })
    .notNull()
    .default("REGISTERED"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const employmentAssignments = pgTable("employment_assignments", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  regionId: text("region_id")
    .notNull()
    .references(() => regions.id),
  outletId: text("outlet_id")
    .notNull()
    .references(() => outlets.id),
  divisionId: text("division_id")
    .notNull()
    .references(() => divisions.id),
  positionId: text("position_id")
    .notNull()
    .references(() => positions.id),
  reportsToEmployeeId: text("reports_to_employee_id"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  isPrimary: boolean("is_primary").notNull().default(true),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const employeeDocuments = pgTable("employee_documents", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  documentTypeId: text("document_type_id")
    .notNull()
    .references(() => documentTypes.id),
  documentNumber: varchar("document_number", { length: 100 }).notNull(),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  attachmentUrl: text("attachment_url").notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userAccounts = pgTable("user_accounts", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .references(() => employees.id),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  pin: varchar("pin", { length: 10 }),
  role: varchar("role", { length: 50 }).notNull(),
  positionId: text("position_id"),
  lastLogin: timestamp("last_login"),
  isActive: boolean("is_active").default(true),
  aggregateVersion: integer("aggregate_version").notNull().default(1),
  lastEventId: text("last_event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
