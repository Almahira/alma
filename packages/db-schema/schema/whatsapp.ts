// File: packages/db-schema/schema/whatsapp.ts
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// 1. Tabel Kredensial Sesi WhatsApp Multi-Device (Anti-Scan Ulang)
export const waSessions = pgTable("wa_sessions", {
  id: text("id").primaryKey(), // Misal: "SESSION_DEFAULT" atau "SESSION_{companyId}"
  companyId: text("company_id").notNull(),
  sessionData: text("session_data").notNull(), // Kredensial auth Baileys (JSON terenkripsi)
  status: varchar("status", { length: 30 }).notNull().default("DISCONNECTED"), // "DISCONNECTED" | "SCAN_QR" | "CONNECTED"
  phoneNumber: varchar("phone_number", { length: 50 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 2. Tabel Kontak Whitelist (Ditautkan ke Vendor / Karyawan & Cabang)
export const waContacts = pgTable("wa_contacts", {
  id: text("id").primaryKey(), // Format: WAC_{ulid}
  companyId: text("company_id").notNull(),
  name: text("name").notNull(), // Nama label, misal: "Siti (Koki Outlet A)"
  phoneNumber: varchar("phone_number", { length: 50 }).notNull(), // Format internasional: 62812xxxx
  contactType: varchar("contact_type", { length: 20 }).notNull(), // "VENDOR" | "EMPLOYEE"
  vendorId: text("vendor_id"), // Terisi jika contactType === "VENDOR"
  employeeId: text("employee_id"), // Terisi jika contactType === "EMPLOYEE"
  outletId: text("outlet_id"), // KUNCI UTAMA: Tautan cabang pengirim
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 3. Tabel Grup Whitelist (Grup Vendor Bersama Banyak Outlet)
export const waGroups = pgTable("wa_groups", {
  id: text("id").primaryKey(), // Format: WAG_{ulid}
  companyId: text("company_id").notNull(),
  jid: varchar("jid", { length: 150 }).notNull().unique(), // ID grup WA: 120363xxxx@g.us
  groupName: text("group_name").notNull(), // Nama grup di WA, misal: "VENDOR PT ABC"
  vendorId: text("vendor_id"), // Tautan ke vendor penyedia
  allowedOutletIds: jsonb("allowed_outlet_ids").notNull().default([]), // Daftar outlet yang ikut di grup
  isAutoPoActive: boolean("is_auto_po_active").default(true), // Saklar aktif/non-aktif parser PO
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 4. Tabel Arsip Pesan Terfilter (Hanya Pesan yang Lolos Whitelist)
export const waMessages = pgTable("wa_messages", {
  id: text("id").primaryKey(), // WhatsApp message ID asli
  companyId: text("company_id").notNull(),
  remoteJid: varchar("remote_jid", { length: 150 }).notNull(), // JID Pengirim / Grup
  senderJid: varchar("sender_jid", { length: 150 }).notNull(), // JID Pengirim riil di grup (participant)
  senderName: text("sender_name"),
  text: text("text"), // Bebas null/kosong jika pesan hanya berupa gambar
  fromMe: boolean("from_me").default(false),
  isPoParsed: boolean("is_po_parsed").default(false),
  receivingId: text("receiving_id"),
  mediaType: varchar("media_type", { length: 30 }).default("text"), // "text" | "image" | "document"
  mediaFileId: text("media_file_id"), // ID unik standar ALMA (PRF_...)
  mediaUrl: text("media_url"), // URL unduhan media (/api/storage/download/RECEIVING/...)
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 5. Tabel Kamus Ingatan Alias Item (Self-Learning Item Aliases)
export const waItemAliases = pgTable("wa_item_aliases", {
  id: text("id").primaryKey(), // Format: WAI_{ulid}
  companyId: text("company_id").notNull(),
  rawAlias: text("raw_alias").notNull(), // Contoh: "B MERAH", "SEREH 1KG" (Uppercase)
  itemId: text("item_id").notNull(), // Tautan ke ID master produk (item_products.id)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 6. Tabel Kamus Ingatan Alias Outlet (Self-Learning Outlet Aliases)
export const waOutletAliases = pgTable("wa_outlet_aliases", {
  id: text("id").primaryKey(), // Format: WAO_{ulid}
  companyId: text("company_id").notNull(),
  rawAlias: text("raw_alias").notNull(), // Contoh: "ASSTRO LASWI", "ASTRO CISARUA" (Uppercase)
  outletId: text("outlet_id").notNull(), // Tautan ke ID master cabang (outlets.id)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
