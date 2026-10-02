// File: apps/server_unv/src/routes/systemHealth.ts
import express, { Router, Request, Response } from "express";
import { sql, desc, eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { db } from "../config/db.js";
import { nc, jsm, publishEvent } from "../config/nats.js";
import {
  systemEventJournal,
  txEventJournal,
  quarantineEventJournal,
  deviceRegistry,
  systemSnapshots,
  telemetryMetrics,
  billingOrders,
  waSessions,
  waContacts,
  waGroups,
  waMessages,
  waItemAliases,
  waOutletAliases,
} from "../../../../packages/db-schema/index.js";
import {
  companies,
  regions,
  outlets,
  documents,
  bankAccounts,
  divisions,
  positions,
  documentTypes,
  employees,
  employmentAssignments,
  employeeDocuments,
  userAccounts,
} from "../../../../modules/mdl_organization/src/server/schema.js";
import {
  itemCategories,
  itemUoms,
  itemProducts,
} from "../../../../modules/mdl_item/src/server/schema.js";
import {
  vendors,
  vendorDocuments,
} from "../../../../modules/mdl_vendor/src/server/schema.js";
import {
  warehouseDistributions,
  warehouseInitialStocks,
  warehouseStockOpnames,
  warehouseStockOpnameItems,
  warehouseSpoilWastes,
  warehouseRecipes,
} from "../../../../modules/mdl_warehouse/src/server/schema.js";
import {
  plusalesDocuments,
  plusalesDynamicItems,
} from "../../../../modules/mdl_plusales/src/server/schema.js";
import {
  receivingDocuments,
  receivingItems,
  receivingPayments,
} from "../../../../modules/mdl_receiving/src/server/schema.js";
import {
  executiveTargets,
  executiveAllocations,
  executiveOwnerLedger,
} from "../../../../modules/mdl_executivepanel/src/server/schema.js";
import {
  SCHEMA_RELATION_DICTIONARY,
  enrichWithSchemaDictionary,
} from "../utils/snapshotEnricher.js";

const router = express.Router();
const SNAPSHOT_SCHEMA_VERSION = 5;

function getSnapshotSchemaVersion(data: unknown): number {
  try {
    const payload = typeof data === "string" ? JSON.parse(data) : data;
    return Number((payload as any)?.__metadata?.schemaVersion) || 0;
  } catch {
    return 0;
  }
}

function getSnapshotEventCounts(
  data: unknown,
): { system: number; tx: number } | null {
  try {
    const payload = typeof data === "string" ? JSON.parse(data) : data;
    const metadata = (payload as any)?.__metadata;
    const system = Number(metadata?.totalSystemEvents);
    const tx = Number(metadata?.totalTxEvents);
    return Number.isFinite(system) && Number.isFinite(tx)
      ? { system, tx }
      : null;
  } catch {
    return null;
  }
}

// =========================================================================
// ENGINE SNAPSHOT SERVER OTOMATIS (CANONICAL SNAPSHOT GENERATOR)
// Merekam seluruh skema dari folder modules dan packages/db-schema
// =========================================================================
export async function generateServerCanonicalSnapshot(
  targetCompanyId?: string,
  forceRefresh = false,
) {
  try {
    // 1. Ambil daftar perusahaan aktif
    const companyList = targetCompanyId
      ? await db
          .select()
          .from(companies)
          .where(eq(companies.id, targetCompanyId))
      : await db.select().from(companies).where(eq(companies.isActive, true));

    if (companyList.length === 0) {
      console.log(
        "[SERVER SNAPSHOT] Tidak ada perusahaan aktif untuk diproses.",
      );
      return null;
    }

    const reportResults: any[] = [];

    for (const comp of companyList) {
      const compId = comp.id;

      // 2. Ambil data snapshot terakhir untuk memeriksa apakah ada event baru
      const existingSnapRows = await db
        .select()
        .from(systemSnapshots)
        .where(eq(systemSnapshots.id, `SNAP_${compId}`))
        .limit(1);

      const existingSnap = existingSnapRows[0];
      const lastSnapTime = existingSnap?.updatedAt
        ? new Date(existingSnap.updatedAt)
        : new Date(0);

      // 3. Cek apakah ada event baru di jurnal sistem atau transaksi sejak snapshot terakhir
      const newSysEventsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(systemEventJournal)
        .where(sql`${systemEventJournal.createdAt} > ${lastSnapTime}`)
        .then((r) => Number(r[0]?.count || 0));

      const newTxEventsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(txEventJournal)
        .where(sql`${txEventJournal.createdAt} > ${lastSnapTime}`)
        .then((r) => Number(r[0]?.count || 0));

      // Jika snapshot sudah ada dan tidak ada event baru, lewati demi efisiensi
      if (
        !forceRefresh &&
        existingSnap &&
        getSnapshotSchemaVersion(existingSnap.data) >=
          SNAPSHOT_SCHEMA_VERSION &&
        newSysEventsCount === 0 &&
        newTxEventsCount === 0
      ) {
        console.log(
          `[SERVER SNAPSHOT] Perusahaan ${comp.name}: Data masih identik dengan snapshot terkini (Seq #${existingSnap.lastSeq}). Melewati pembaruan.`,
        );
        reportResults.push({
          companyId: compId,
          status: "UNCHANGED",
          lastSeq: existingSnap.lastSeq,
        });
        continue;
      }

      console.log(
        `[SERVER SNAPSHOT] Terdeteksi perubahan data pada ${comp.name} (Sys delta: ${newSysEventsCount}, Tx delta: ${newTxEventsCount}). Memperbarui snapshot seluruh skema...`,
      );

      // 4. Tarik data dari seluruh modul bisnis dan skema packages/db-schema dari PostgreSQL secara paralel

      // --- 4.1 Modul Organization (mdl_organization) ---
      const [
        compRegions,
        compOutlets,
        compDivisions,
        compPositions,
        compDocTypes,
        compAssignments,
        allEmployees,
        allEmpDocs,
        allOrgDocs,
        allBankAccounts,
        compUsers,
      ] = await Promise.all([
        db.select().from(regions).where(eq(regions.companyId, compId)),
        db.select().from(outlets).where(eq(outlets.companyId, compId)),
        db.select().from(divisions).where(eq(divisions.companyId, compId)),
        db.select().from(positions).where(eq(positions.companyId, compId)),
        db
          .select()
          .from(documentTypes)
          .where(eq(documentTypes.companyId, compId)),
        db
          .select()
          .from(employmentAssignments)
          .where(eq(employmentAssignments.companyId, compId)),
        db.select().from(employees),
        db.select().from(employeeDocuments),
        db.select().from(documents),
        db.select().from(bankAccounts),
        db.select().from(userAccounts).where(eq(userAccounts.isActive, true)),
      ]);

      // Validasi integritas master data penting
      if (allEmployees.length === 0 || compUsers.length === 0) {
        console.warn(
          `[SERVER SNAPSHOT] Peringatan: Data karyawan/user kosong untuk ${comp.name}. Pembentukan snapshot ditunda demi keamanan login.`,
        );
        continue;
      }

      // --- 4.2 Modul Item (mdl_item) ---
      const [allCategories, allUoms, compProducts] = await Promise.all([
        db.select().from(itemCategories),
        db.select().from(itemUoms),
        db
          .select()
          .from(itemProducts)
          .where(eq(itemProducts.companyId, compId)),
      ]);

      // --- 4.3 Modul Vendor (mdl_vendor) ---
      const [compVendors, allVendorDocs] = await Promise.all([
        db.select().from(vendors).where(eq(vendors.companyId, compId)),
        db.select().from(vendorDocuments),
      ]);

      // ============================================================
      // LOOKUP POOL O(1) UNIVERSAL UNTUK AUTO-ENRICHMENT SNAPSHOT
      // ============================================================
      const lookupTables = new Map<string, Map<string, any>>([
        ["itemProducts", new Map(compProducts.map((p) => [p.id, p]))],
        ["itemCategories", new Map(allCategories.map((c) => [c.id, c]))],
        ["itemUoms", new Map(allUoms.map((u) => [u.id, u]))],
        ["vendors", new Map(compVendors.map((v) => [v.id, v]))],
        ["outlets", new Map(compOutlets.map((o) => [o.id, o]))],
        ["regions", new Map(compRegions.map((r) => [r.id, r]))],
        ["divisions", new Map(compDivisions.map((d) => [d.id, d]))],
        ["employees", new Map(allEmployees.map((e) => [e.id, e]))],
      ]);

      // --- 4.4 Modul Warehouse (mdl_warehouse) ---
      const [
        compDistributions,
        compInitialStocks,
        compOpnames,
        allOpnameItems,
        compSpoilWastes,
        compRecipes,
      ] = await Promise.all([
        db
          .select()
          .from(warehouseDistributions)
          .where(eq(warehouseDistributions.companyId, compId)),
        db
          .select()
          .from(warehouseInitialStocks)
          .where(eq(warehouseInitialStocks.companyId, compId)),
        db
          .select()
          .from(warehouseStockOpnames)
          .where(eq(warehouseStockOpnames.companyId, compId)),
        db.select().from(warehouseStockOpnameItems),
        db
          .select()
          .from(warehouseSpoilWastes)
          .where(eq(warehouseSpoilWastes.companyId, compId)),
        db
          .select()
          .from(warehouseRecipes)
          .where(eq(warehouseRecipes.companyId, compId)),
      ]);

      // Format initialStocks menjadi Record<string, number> (key: `${outletId}_${itemId}`)
      const initialStocksMap: Record<string, number> = {};
      compInitialStocks.forEach((st) => {
        const key = `${st.outletId}_${st.itemId}`;
        initialStocksMap[key] = Number(st.initialQty || 0);
      });

      // Hubungkan opname items dengan dokumen stock opname masing-masing
      const opnameItemsMap = new Map<string, any[]>();
      allOpnameItems.forEach((item) => {
        const list = opnameItemsMap.get(item.opnameId) || [];
        list.push(item);
        opnameItemsMap.set(item.opnameId, list);
      });

      const opnamesFormatted = compOpnames.map((o) => ({
        ...o,
        items: opnameItemsMap.get(o.id) || [],
      }));

      // --- 4.5 Modul Plusales (mdl_plusales) ---
      const [compPlusalesDocs, allPlusalesDynamicItems] = await Promise.all([
        db
          .select()
          .from(plusalesDocuments)
          .where(eq(plusalesDocuments.companyId, compId)),
        db.select().from(plusalesDynamicItems),
      ]);

      const dynamicItemsMap = new Map<string, any[]>();
      allPlusalesDynamicItems.forEach((item) => {
        const list = dynamicItemsMap.get(item.documentId) || [];
        list.push(item);
        dynamicItemsMap.set(item.documentId, list);
      });

      const plusalesDocsFormatted = compPlusalesDocs.map((d) => ({
        ...d,
        date: d.date instanceof Date ? d.date.toISOString() : String(d.date),
        dynamicItems: dynamicItemsMap.get(d.id) || [],
      }));

      // --- 4.6 Modul Receiving (mdl_receiving) ---
      const [compReceivingDocs, allReceivingItems, allReceivingPayments] =
        await Promise.all([
          db
            .select()
            .from(receivingDocuments)
            .where(eq(receivingDocuments.companyId, compId)),
          db.select().from(receivingItems),
          db.select().from(receivingPayments),
        ]);

      const receivingItemsMap = new Map<string, any[]>();
      allReceivingItems.forEach((item) => {
        const list = receivingItemsMap.get(item.documentId) || [];
        list.push(item);
        receivingItemsMap.set(item.documentId, list);
      });

      const receivingPaymentsMap = new Map<string, any[]>();
      allReceivingPayments.forEach((p) => {
        const list = receivingPaymentsMap.get(p.documentId) || [];
        list.push(p);
        receivingPaymentsMap.set(p.documentId, list);
      });

      // 1. Susun dokumen dasar beserta array items & payments
      const rawReceivingDocs = compReceivingDocs.map((d) => ({
        ...d,
        date: d.date instanceof Date ? d.date.toISOString() : String(d.date),
        dueDate:
          d.dueDate instanceof Date ? d.dueDate.toISOString() : d.dueDate,
        items: receivingItemsMap.get(d.id) || [],
        payments: receivingPaymentsMap.get(d.id) || [],
      }));

      // 2. Auto-enrichment dinamis menggunakan Kamus Skema
      // Otomatis menginjeksi name, itemName, categoryName, uomName, dan vendorName
      const receivingDocsFormatted = enrichWithSchemaDictionary(
        rawReceivingDocs,
        lookupTables,
      );

      // --- 4.7 Modul Executive Panel (mdl_executivepanel) ---
      const [
        compExecutiveTargets,
        compExecutiveAllocations,
        compExecutiveOwnerLedgers,
      ] = await Promise.all([
        db
          .select()
          .from(executiveTargets)
          .where(eq(executiveTargets.companyId, compId)),
        db
          .select()
          .from(executiveAllocations)
          .where(eq(executiveAllocations.companyId, compId)),
        db
          .select()
          .from(executiveOwnerLedger)
          .where(eq(executiveOwnerLedger.companyId, compId)),
      ]);

      const targetsMap: Record<string, any> = {};
      compExecutiveTargets.forEach((t) => {
        targetsMap[t.id] = t;
      });

      // --- 4.8 Modul WhatsApp & Integrasi (packages/db-schema & mdl_whatsapp) ---
      const [
        compWaSessions,
        compWaContacts,
        compWaGroups,
        compWaMessages,
        compWaItemAliases,
        compWaOutletAliases,
      ] = await Promise.all([
        db.select().from(waSessions).where(eq(waSessions.companyId, compId)),
        db.select().from(waContacts).where(eq(waContacts.companyId, compId)),
        db.select().from(waGroups).where(eq(waGroups.companyId, compId)),
        db.select().from(waMessages).where(eq(waMessages.companyId, compId)),
        db
          .select()
          .from(waItemAliases)
          .where(eq(waItemAliases.companyId, compId)),
        db
          .select()
          .from(waOutletAliases)
          .where(eq(waOutletAliases.companyId, compId)),
      ]);

      // --- 4.9 Skema Tambahan packages/db-schema (Perangkat, Billing, Telemetry) ---
      const [compDevices, compBillingOrders, recentTelemetry] =
        await Promise.all([
          db
            .select()
            .from(deviceRegistry)
            .where(eq(deviceRegistry.companyId, compId)),
          db
            .select()
            .from(billingOrders)
            .where(eq(billingOrders.companyId, compId)),
          db.select().from(telemetryMetrics).limit(50),
        ]);

      // 5. Susun struktur State yang kompatibel langsung dengan UniversalRegistry dan Projections
      const organizationDomainState = {
        companies: [comp],
        regions: compRegions,
        outlets: compOutlets,
        documents: allOrgDocs,
        bankAccounts: allBankAccounts,
        divisions: compDivisions,
        positions: compPositions,
        documentTypes: compDocTypes,
        employees: allEmployees,
        employmentAssignments: compAssignments,
        employeeDocuments: allEmpDocs,
        userAccounts: compUsers.map((u) => ({
          id: u.id,
          employeeId: u.employeeId,
          username: u.username,
          role: u.role,
          positionId: u.positionId,
          passwordHash: u.passwordHash,
          pin: u.pin,
          allowedOutletIds: Array.isArray(u.allowedOutletIds)
            ? u.allowedOutletIds
            : [],
          isActive: u.isActive,
        })),
      };

      const itemDomainState = {
        categories: allCategories,
        uoms: allUoms,
        products: compProducts.map((p) => ({
          ...p,
          isExpense: Boolean(p.isExpense),
          uomConversions: Array.isArray(p.uomConversions)
            ? p.uomConversions
            : [],
        })),
      };

      const vendorDomainState = {
        vendors: compVendors,
        documents: allVendorDocs,
      };

      const warehouseDomainState = {
        distributions: compDistributions,
        initialStocks: initialStocksMap,
        opnames: opnamesFormatted,
        spoilWastes: compSpoilWastes,
        recipes: compRecipes.map((r) => ({
          ...r,
          rawMaterials: Array.isArray(r.rawMaterials) ? r.rawMaterials : [],
          subRecipes: Array.isArray(r.subRecipes) ? r.subRecipes : [],
        })),
      };

      const plusalesDomainState = {
        documents: plusalesDocsFormatted,
      };

      const receivingDomainState = {
        documents: receivingDocsFormatted,
      };

      const executivePanelDomainState = {
        targets: targetsMap,
        allocations: compExecutiveAllocations,
        ownerLedgers: compExecutiveOwnerLedgers.map((o) => ({
          ...o,
          date: o.date instanceof Date ? o.date.toISOString() : String(o.date),
        })),
      };

      const whatsAppDomainState = {
        sessions: compWaSessions,
        contacts: compWaContacts,
        groups: compWaGroups,
        messages: compWaMessages,
        itemAliases: compWaItemAliases,
        outletAliases: compWaOutletAliases,
      };

      const infrastructureDomainState = {
        devices: compDevices,
        billing: compBillingOrders,
        telemetry: recentTelemetry,
      };

      // 6. Hitung Total Sequence Terkini
      const [totalSysCount, totalTxCount, latestSysEvent] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(systemEventJournal)
          .then((r) => Number(r[0]?.count || 0)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(txEventJournal)
          .then((r) => Number(r[0]?.count || 0)),
        db
          .select({ id: systemEventJournal.id })
          .from(systemEventJournal)
          .orderBy(desc(systemEventJournal.createdAt))
          .limit(1),
      ]);

      const currentTotalSeq = totalSysCount + totalTxCount;

      // 7. Payload snapshot komprehensif: mencakup seluruh domain CQRS dan seluruh tabel skema DB
      const snapshotDataPayload = {
        // Domain CQRS untuk Instant Hydration di Client (UniversalRegistry)
        ORGANIZATION: organizationDomainState,
        ITEM_DOMAIN: itemDomainState,
        VENDOR: vendorDomainState,
        WAREHOUSE_DOCUMENT: warehouseDomainState,
        PLUSALES_DOCUMENT: plusalesDomainState,
        RECEIVING_DOCUMENT: receivingDomainState,
        EXECUTIVE_PANEL: executivePanelDomainState,
        WHATSAPP: whatsAppDomainState,
        DICTIONARY: { items: [] },
        INFRASTRUCTURE: infrastructureDomainState,

        // Rekaman Seluruh Tabel Skema Database (DB Schema Raw Tables)
        DB_SCHEMA: {
          companies: [comp],
          regions: compRegions,
          outlets: compOutlets,
          documents: allOrgDocs,
          bankAccounts: allBankAccounts,
          divisions: compDivisions,
          positions: compPositions,
          documentTypes: compDocTypes,
          employees: allEmployees,
          employmentAssignments: compAssignments,
          employeeDocuments: allEmpDocs,
          userAccounts: compUsers,
          itemCategories: allCategories,
          itemUoms: allUoms,
          itemProducts: compProducts,
          vendors: compVendors,
          vendorDocuments: allVendorDocs,
          warehouseDistributions: compDistributions,
          warehouseInitialStocks: compInitialStocks,
          warehouseStockOpnames: compOpnames,
          warehouseStockOpnameItems: allOpnameItems,
          warehouseSpoilWastes: compSpoilWastes,
          warehouseRecipes: compRecipes,
          plusalesDocuments: compPlusalesDocs,
          plusalesDynamicItems: allPlusalesDynamicItems,
          receivingDocuments: compReceivingDocs,
          receivingItems: allReceivingItems,
          receivingPayments: allReceivingPayments,
          executiveTargets: compExecutiveTargets,
          executiveAllocations: compExecutiveAllocations,
          executiveOwnerLedger: compExecutiveOwnerLedgers,
          waSessions: compWaSessions,
          waContacts: compWaContacts,
          waGroups: compWaGroups,
          waMessages: compWaMessages,
          waItemAliases: compWaItemAliases,
          waOutletAliases: compWaOutletAliases,
          deviceRegistry: compDevices,
          billingOrders: compBillingOrders,
          telemetryMetrics: recentTelemetry,
        },

        // Metadata Snapshot
        __metadata: {
          schemaVersion: SNAPSHOT_SCHEMA_VERSION,
          companyId: compId,
          lastSeq: currentTotalSeq,
          totalSystemEvents: totalSysCount,
          totalTxEvents: totalTxCount,
          generatedAt: Date.now(),
          schemasIncluded: [
            "ORGANIZATION",
            "ITEM_DOMAIN",
            "VENDOR",
            "WAREHOUSE_DOCUMENT",
            "PLUSALES_DOCUMENT",
            "RECEIVING_DOCUMENT",
            "EXECUTIVE_PANEL",
            "WHATSAPP",
            "DICTIONARY",
            "INFRASTRUCTURE",
            "DB_SCHEMA",
          ],
        },
      };

      const snapId = `SNAP_${compId}`;
      const jsonString = JSON.stringify(snapshotDataPayload);

      // 8. Simpan / Perbarui Snapshot di database PostgreSQL
      await db
        .insert(systemSnapshots)
        .values({
          id: snapId,
          companyId: compId,
          lastSeq: currentTotalSeq,
          lastEventId: latestSysEvent[0]?.id || null,
          data: jsonString,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSnapshots.id,
          set: {
            lastSeq: currentTotalSeq,
            lastEventId: latestSysEvent[0]?.id || null,
            data: jsonString,
            updatedAt: new Date(),
          },
        });

      console.log(
        `[SERVER SNAPSHOT] SUKSES: Snapshot resmi komprehensif Sequence #${currentTotalSeq} berhasil dibekukan untuk ${comp.name}.`,
      );

      reportResults.push({
        companyId: compId,
        status: "UPDATED",
        lastSeq: currentTotalSeq,
        counts: {
          employees: allEmployees.length,
          users: compUsers.length,
          regions: compRegions.length,
          outlets: compOutlets.length,
          divisions: compDivisions.length,
          positions: compPositions.length,
          categories: allCategories.length,
          uoms: allUoms.length,
          products: compProducts.length,
          vendors: compVendors.length,
          distributions: compDistributions.length,
          initialStocks: compInitialStocks.length,
          opnames: compOpnames.length,
          spoilWastes: compSpoilWastes.length,
          recipes: compRecipes.length,
          plusalesDocs: compPlusalesDocs.length,
          receivingDocs: compReceivingDocs.length,
          executiveTargets: compExecutiveTargets.length,
          executiveAllocations: compExecutiveAllocations.length,
          executiveOwnerLedgers: compExecutiveOwnerLedgers.length,
          waSessions: compWaSessions.length,
          devices: compDevices.length,
        },
      });
    }

    return reportResults;
  } catch (error) {
    console.error("[SERVER SNAPSHOT GENERATOR ERROR]:", error);
    return null;
  }
}

// =========================================================================
// 1. GET /api/system-health/overview
// =========================================================================
router.get("/overview", async (_req: Request, res: Response) => {
  try {
    const startTime = performance.now();

    let dbStatus = "CONNECTED";
    let dbLatencyMs = 0;
    try {
      await db.execute(sql`SELECT 1`);
      dbLatencyMs = Math.round(performance.now() - startTime);
    } catch {
      dbStatus = "DISCONNECTED";
    }

    let natsStatus = "CONNECTED";
    let streamMsgCount = 0;
    try {
      if (!nc || nc.isClosed()) {
        natsStatus = "DISCONNECTED";
      } else {
        const streamInfo = await jsm.streams.info("ERP_STREAM");
        streamMsgCount = streamInfo.state.messages;
      }
    } catch {
      natsStatus = "ERROR";
    }

    const [sysCount, txCount, qCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(systemEventJournal)
        .then((r) => Number(r[0]?.count || 0)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(txEventJournal)
        .then((r) => Number(r[0]?.count || 0)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(quarantineEventJournal)
        .then((r) => Number(r[0]?.count || 0)),
    ]);

    const memory = process.memoryUsage();
    const heapUsedMb = Math.round(memory.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(memory.heapTotal / 1024 / 1024);
    const rssMb = Math.round(memory.rss / 1024 / 1024);
    const uptimeSeconds = Math.floor(process.uptime());

    const allDevices = await db.select().from(deviceRegistry);
    const now = Date.now();
    let activeDevicesCount = 0;
    let offlineDevicesCount = 0;

    allDevices.forEach((d) => {
      const lastSeen = d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : 0;
      const isOnline = now - lastSeen < 3 * 60 * 1000;
      if (d.status === "ACTIVE" && isOnline) {
        activeDevicesCount++;
      } else if (d.status === "ACTIVE") {
        offlineDevicesCount++;
      }
    });

    res.status(200).json({
      status: "SUCCESS",
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          totalSystemEvents: sysCount,
          totalTxEvents: txCount,
        },
        nats: {
          status: natsStatus,
          streamMessages: streamMsgCount,
        },
        quarantine: {
          totalQuarantined: qCount,
          hasAlert: qCount > 0,
        },
      },
      hardware: {
        uptimeSeconds,
        heapUsedMb,
        heapTotalMb,
        rssMb,
        nodeVersion: process.version,
      },
      devices: {
        total: allDevices.length,
        active: activeDevicesCount,
        offline: offlineDevicesCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: "ERROR", error: error.message });
  }
});

// =========================================================================
// 2. GET /api/system-health/urgency
// =========================================================================
router.get("/urgency", async (_req: Request, res: Response) => {
  try {
    const alerts: {
      level: "CRITICAL" | "WARNING";
      title: string;
      message: string;
      timestamp: string;
    }[] = [];

    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      alerts.push({
        level: "CRITICAL",
        title: "PostgreSQL Terputus",
        message: "Koneksi database pusat gagal diakses!",
        timestamp: new Date().toISOString(),
      });
    }

    if (!nc || nc.isClosed()) {
      alerts.push({
        level: "CRITICAL",
        title: "NATS JetStream Mati",
        message:
          "Antrean sinkronisasi transaksi tidak dapat mendistribusikan data.",
        timestamp: new Date().toISOString(),
      });
    }

    const qEvents = await db
      .select()
      .from(quarantineEventJournal)
      .orderBy(desc(quarantineEventJournal.quarantinedAt))
      .limit(10);

    if (qEvents.length > 0) {
      alerts.push({
        level: "CRITICAL",
        title: `${qEvents.length} Event Terkarantina (DLQ)`,
        message: `Terjadi benturan data fatal. Event terakhir: ${qEvents[0].type} (${qEvents[0].errorReason})`,
        timestamp:
          qEvents[0].quarantinedAt?.toISOString() || new Date().toISOString(),
      });
    }

    const memory = process.memoryUsage();
    const heapPercent = Math.round((memory.heapUsed / memory.heapTotal) * 100);
    if (heapPercent > 85) {
      alerts.push({
        level: "WARNING",
        title: "Penggunaan RAM Tinggi",
        message: `Heap Server mencapai ${heapPercent}% (${Math.round(memory.heapUsed / 1024 / 1024)}MB)`,
        timestamp: new Date().toISOString(),
      });
    }

    const recentErrors = await db
      .select()
      .from(telemetryMetrics)
      .where(
        sql`${telemetryMetrics.metricName} LIKE '%ERROR%' OR ${telemetryMetrics.metricName} LIKE '%CRASH%'`,
      )
      .orderBy(desc(telemetryMetrics.createdAt))
      .limit(5);

    let systemStatus: "HEALTHY" | "WARNING" | "CRITICAL" = "HEALTHY";
    if (alerts.some((a) => a.level === "CRITICAL")) {
      systemStatus = "CRITICAL";
    } else if (alerts.length > 0) {
      systemStatus = "WARNING";
    }

    res.status(200).json({
      systemStatus,
      uptimeSeconds: Math.floor(process.uptime()),
      quarantineCount: qEvents.length,
      alerts,
      recentQuarantined: qEvents.slice(0, 3),
      recentCrashes: recentErrors,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ systemStatus: "CRITICAL", error: err.message });
  }
});

// =========================================================================
// 3. GET /api/system-health/quarantine
// =========================================================================
router.get("/quarantine", async (_req: Request, res: Response) => {
  try {
    const list = await db
      .select()
      .from(quarantineEventJournal)
      .orderBy(desc(quarantineEventJournal.quarantinedAt))
      .limit(50);

    const formatted = list.map((ev) => ({
      ...ev,
      payload:
        typeof ev.payload === "string" ? JSON.parse(ev.payload) : ev.payload,
    }));

    res
      .status(200)
      .json({ status: "SUCCESS", count: formatted.length, events: formatted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 4. POST /api/system-health/quarantine/retry
// =========================================================================
router.post("/quarantine/retry", async (req: Request, res: Response) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ error: "eventId wajib diisi." });
    }

    const rows = await db
      .select()
      .from(quarantineEventJournal)
      .where(eq(quarantineEventJournal.id, eventId))
      .limit(1);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Event karantina tidak ditemukan." });
    }

    const qEvent = rows[0];
    const rawPayload =
      typeof qEvent.payload === "string"
        ? JSON.parse(qEvent.payload)
        : qEvent.payload;

    const retryPayload = {
      id: qEvent.id,
      aggregateId: qEvent.aggregateId,
      aggregateVersion: qEvent.aggregateVersion,
      type: qEvent.type,
      payload: rawPayload,
      dddMetadata: {
        aggregateType: qEvent.aggregateType,
        actor: { userId: qEvent.actor, role: "SYSTEM_RETRY" },
      },
    };

    await publishEvent("events.sync.up", retryPayload);

    await db
      .delete(quarantineEventJournal)
      .where(eq(quarantineEventJournal.id, eventId));

    res.status(200).json({
      status: "SUCCESS",
      message: `Event ${eventId} berhasil dikeluarkan dari karantina dan dikirim ulang ke NATS.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 5. POST /api/system-health/quarantine/purge
// =========================================================================
router.post("/quarantine/purge", async (req: Request, res: Response) => {
  try {
    const { eventId, purgeAll } = req.body;

    if (purgeAll) {
      await db.delete(quarantineEventJournal);
      return res.status(200).json({
        status: "SUCCESS",
        message: "Seluruh event karantina berhasil dibersihkan.",
      });
    }

    if (!eventId) {
      return res
        .status(400)
        .json({ error: "eventId atau purgeAll wajib diisi." });
    }

    await db
      .delete(quarantineEventJournal)
      .where(eq(quarantineEventJournal.id, eventId));
    res.status(200).json({
      status: "SUCCESS",
      message: `Event ${eventId} berhasil dihapus dari karantina.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 6. GET /api/system-health/devices
// =========================================================================
router.get("/devices", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(deviceRegistry)
      .orderBy(desc(deviceRegistry.lastSeenAt));
    const now = Date.now();

    const enriched = rows.map((d) => {
      const lastSeen = d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : 0;
      const minutesAgo = Math.floor((now - lastSeen) / (60 * 1000));
      const isOnline = minutesAgo <= 3 && d.status === "ACTIVE";

      let offlineReason = "NORMAL";
      if (!isOnline) {
        if (d.status === "REPLACED") {
          offlineReason =
            "Perangkat telah digantikan (Takeover) oleh tablet baru";
        } else if (d.status === "SUSPENDED") {
          offlineReason = "Perangkat dibekukan sementara oleh admin";
        } else if (
          d.licenseExpiresAt &&
          new Date(d.licenseExpiresAt).getTime() < now
        ) {
          offlineReason = "Lisensi paket telah kedaluwarsa";
        } else if (minutesAgo > 60 * 24) {
          offlineReason = `Tidak terhubung selama ${Math.floor(minutesAgo / 1440)} hari (Mati total / Browser ditutup)`;
        } else if (minutesAgo > 15) {
          offlineReason = `Terputus ${minutesAgo} menit yang lalu (Kemungkinan WiFi/Listrik Cabang Mati)`;
        } else {
          offlineReason = "Jaringan idle sementara";
        }
      }

      return {
        ...d,
        isOnline,
        minutesAgo,
        offlineReason,
      };
    });

    res.status(200).json({ status: "SUCCESS", devices: enriched });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 7. STEMPEL UNIVERSAL: EPOCH & BROADCAST RESYNC
// =========================================================================
const EPOCH_FILE_PATH = path.join(process.cwd(), ".server_sync_epoch");

function getStoredEpoch(): number {
  try {
    if (fs.existsSync(EPOCH_FILE_PATH)) {
      const content = fs.readFileSync(EPOCH_FILE_PATH, "utf-8").trim();
      const num = Number(content);
      if (!isNaN(num) && num > 0) return num;
    }
  } catch {}
  const initial = Date.now();
  try {
    fs.writeFileSync(EPOCH_FILE_PATH, String(initial));
  } catch {}
  return initial;
}

let serverSyncEpoch = getStoredEpoch();

router.get("/sync-epoch", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "SUCCESS",
    epoch: serverSyncEpoch,
    timestamp: new Date().toISOString(),
  });
});

router.post("/broadcast-resync", async (req: Request, res: Response) => {
  try {
    const { reason = "Penyelarasan Masal & Reset Data Pusat" } = req.body;

    serverSyncEpoch = Date.now();
    try {
      fs.writeFileSync(EPOCH_FILE_PATH, String(serverSyncEpoch));
    } catch (fsErr) {
      console.error("[EPOCH SAVE ERROR]:", fsErr);
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("REMOTE_RESYNC_TRIGGER", {
        epoch: serverSyncEpoch,
        timestamp: serverSyncEpoch,
        forceLogout: true,
        reason,
      });
      console.log(
        `[STEMPEL UNIVERSAL] Epoch baru diterbitkan: ${serverSyncEpoch}. Menembakkan sinyal reset masal & logout ke seluruh cabang...`,
      );
    }

    res.status(200).json({
      status: "SUCCESS",
      epoch: serverSyncEpoch,
      message: `Sinyal reset masal (Epoch: ${serverSyncEpoch}) berhasil diterbitkan ke seluruh cabang.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 8. BRANKAS SNAPSHOT MASTER DATA PUSAT (PHYSICAL TABLE MATERIALIZED VIEWS)
// =========================================================================

/**
 * 8.1 SNAPSHOT SISTEM GLOBAL (Self-Healing Just-In-Time)
 * Mengembalikan snapshot fisik lengkap. Jika belum ada atau out-of-date,
 * langsung dibuatkan dari tabel fisik secara instan.
 */
router.get("/snapshot/system/latest", async (req: Request, res: Response) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  try {
    const companyId = req.query.companyId as string | undefined;

    const whereClause = companyId
      ? eq(systemSnapshots.companyId, String(companyId))
      : undefined;

    let rows = await db
      .select()
      .from(systemSnapshots)
      .where(whereClause)
      .orderBy(desc(systemSnapshots.updatedAt))
      .limit(1);

    const [systemEventCount, txEventCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(systemEventJournal)
        .then((result) => Number(result[0]?.count || 0)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(txEventJournal)
        .then((result) => Number(result[0]?.count || 0)),
    ]);

    const currentSnapshot = rows[0];
    const snapshotEventCounts = currentSnapshot
      ? getSnapshotEventCounts(currentSnapshot.data)
      : null;
    const journalChanged =
      !snapshotEventCounts ||
      snapshotEventCounts.system !== systemEventCount ||
      snapshotEventCounts.tx !== txEventCount;

    // Refresh the physical-table snapshot when its journal watermark is stale.
    if (
      !currentSnapshot ||
      getSnapshotSchemaVersion(currentSnapshot.data) < SNAPSHOT_SCHEMA_VERSION ||
      journalChanged
    ) {
      console.log(
        "[SNAPSHOT ROUTE] Snapshot belum ada, usang, atau tertinggal dari jurnal. Membentuk ulang dari tabel fisik...",
      );
      await generateServerCanonicalSnapshot(companyId, true);
      rows = await db
        .select()
        .from(systemSnapshots)
        .where(whereClause)
        .orderBy(desc(systemSnapshots.updatedAt))
        .limit(1);
    }

    if (rows.length === 0) {
      return res.status(200).json({
        hasSnapshot: false,
        message: "Belum ada data perusahaan aktif.",
      });
    }

    const snap = rows[0];
    res.status(200).json({
      hasSnapshot: true,
      snapshot: {
        id: snap.id,
        companyId: snap.companyId,
        lastSeq: snap.lastSeq,
        lastEventId: snap.lastEventId,
        data: typeof snap.data === "string" ? JSON.parse(snap.data) : snap.data,
        updatedAt: snap.updatedAt
          ? new Date(snap.updatedAt).getTime()
          : Date.now(),
      },
    });
  } catch (err: any) {
    console.error("[SNAPSHOT SERVER ERROR]:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 8.2 SNAPSHOT MODULAR ULTRA CEPAT (Murni Baca Tabel Fisik PostgreSQL < 5ms)
 * Contoh rute: GET /api/system-health/snapshot/module/item?companyId=AGG_...
 */
router.get(
  "/snapshot/module/:moduleName",
  async (req: Request, res: Response) => {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    try {
      const { moduleName } = req.params;
      const companyId = req.query.companyId as string;

      if (!companyId) {
        return res
          .status(400)
          .json({ error: "companyId wajib disertakan pada query parameter" });
      }

      const normalizedModule = moduleName.toLowerCase().replace(/^mdl_/, "");

      // Ambil nomor sequence mutasi terakhir di server sebagai stempel koordinat
      const [totalSysCount, totalTxCount, latestSysEvent] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(systemEventJournal)
          .then((r) => Number(r[0]?.count || 0)),
        db
          .select({ count: sql<number>`count(*)` })
          .from(txEventJournal)
          .then((r) => Number(r[0]?.count || 0)),
        db
          .select({ id: systemEventJournal.id })
          .from(systemEventJournal)
          .orderBy(desc(systemEventJournal.createdAt))
          .limit(1),
      ]);

      const latestSeq = totalSysCount + totalTxCount;
      const latestEventId = latestSysEvent[0]?.id || null;

      // --- MODUL ITEM (mdl_item) ---
      if (normalizedModule === "item") {
        const [categories, uoms, products] = await Promise.all([
          db.select().from(itemCategories),
          db.select().from(itemUoms),
          db
            .select()
            .from(itemProducts)
            .where(eq(itemProducts.companyId, companyId)),
        ]);

        return res.status(200).json({
          status: "SUCCESS",
          module: "ITEM_DOMAIN",
          lastSeq: latestSeq,
          lastEventId: latestEventId,
          generatedAt: Date.now(),
          data: {
            categories,
            uoms,
            products: products.map((p) => ({
              ...p,
              isExpense: Boolean(p.isExpense),
              uomConversions: Array.isArray(p.uomConversions)
                ? p.uomConversions
                : [],
            })),
          },
        });
      }

      // --- MODUL ORGANISASI (mdl_organization) ---
      if (normalizedModule === "organization") {
        const [
          comp,
          compRegions,
          compOutlets,
          compDivisions,
          compPositions,
          compEmployees,
          compUsers,
        ] = await Promise.all([
          db
            .select()
            .from(companies)
            .where(eq(companies.id, companyId))
            .limit(1),
          db.select().from(regions).where(eq(regions.companyId, companyId)),
          db.select().from(outlets).where(eq(outlets.companyId, companyId)),
          db.select().from(divisions).where(eq(divisions.companyId, companyId)),
          db.select().from(positions).where(eq(positions.companyId, companyId)),
          db.select().from(employees),
          db.select().from(userAccounts).where(eq(userAccounts.isActive, true)),
        ]);

        return res.status(200).json({
          status: "SUCCESS",
          module: "ORGANIZATION",
          lastSeq: latestSeq,
          lastEventId: latestEventId,
          generatedAt: Date.now(),
          data: {
            companies: comp,
            regions: compRegions,
            outlets: compOutlets,
            divisions: compDivisions,
            positions: compPositions,
            employees: compEmployees,
            userAccounts: compUsers,
          },
        });
      }

      // --- MODUL GUDANG (mdl_warehouse) ---
      if (normalizedModule === "warehouse") {
        const [
          distributions,
          initialStocks,
          opnames,
          opnameItems,
          spoilWastes,
          recipes,
        ] = await Promise.all([
          db
            .select()
            .from(warehouseDistributions)
            .where(eq(warehouseDistributions.companyId, companyId)),
          db
            .select()
            .from(warehouseInitialStocks)
            .where(eq(warehouseInitialStocks.companyId, companyId)),
          db
            .select()
            .from(warehouseStockOpnames)
            .where(eq(warehouseStockOpnames.companyId, companyId)),
          db.select().from(warehouseStockOpnameItems),
          db
            .select()
            .from(warehouseSpoilWastes)
            .where(eq(warehouseSpoilWastes.companyId, companyId)),
          db
            .select()
            .from(warehouseRecipes)
            .where(eq(warehouseRecipes.companyId, companyId)),
        ]);

        const initialStocksMap: Record<string, number> = {};
        initialStocks.forEach((st) => {
          initialStocksMap[`${st.outletId}_${st.itemId}`] = Number(
            st.initialQty || 0,
          );
        });

        const opnameItemsMap = new Map<string, any[]>();
        opnameItems.forEach((item) => {
          const list = opnameItemsMap.get(item.opnameId) || [];
          list.push(item);
          opnameItemsMap.set(item.opnameId, list);
        });

        return res.status(200).json({
          status: "SUCCESS",
          module: "WAREHOUSE_DOCUMENT",
          lastSeq: latestSeq,
          lastEventId: latestEventId,
          generatedAt: Date.now(),
          data: {
            distributions,
            initialStocks: initialStocksMap,
            opnames: opnames.map((o) => ({
              ...o,
              items: opnameItemsMap.get(o.id) || [],
            })),
            spoilWastes,
            recipes,
          },
        });
      }

      // --- MODUL VENDOR (mdl_vendor) ---
      if (normalizedModule === "vendor") {
        const [compVendors, docs] = await Promise.all([
          db.select().from(vendors).where(eq(vendors.companyId, companyId)),
          db.select().from(vendorDocuments),
        ]);

        return res.status(200).json({
          status: "SUCCESS",
          module: "VENDOR",
          lastSeq: latestSeq,
          lastEventId: latestEventId,
          generatedAt: Date.now(),
          data: {
            vendors: compVendors,
            documents: docs,
          },
        });
      }

      // --- MODUL PLUSALES (mdl_plusales) ---
      if (normalizedModule === "plusales") {
        const [compPlusalesDocs, allDynamicItems] = await Promise.all([
          db
            .select()
            .from(plusalesDocuments)
            .where(eq(plusalesDocuments.companyId, companyId)),
          db.select().from(plusalesDynamicItems),
        ]);

        const dynamicItemsMap = new Map<string, any[]>();
        allDynamicItems.forEach((item) => {
          const list = dynamicItemsMap.get(item.documentId) || [];
          list.push(item);
          dynamicItemsMap.set(item.documentId, list);
        });

        return res.status(200).json({
          status: "SUCCESS",
          module: "PLUSALES_DOCUMENT",
          lastSeq: latestSeq,
          lastEventId: latestEventId,
          generatedAt: Date.now(),
          data: {
            documents: compPlusalesDocs.map((d) => ({
              ...d,
              date:
                d.date instanceof Date ? d.date.toISOString() : String(d.date),
              dynamicItems: dynamicItemsMap.get(d.id) || [],
            })),
          },
        });
      }

      // --- MODUL RECEIVING (mdl_receiving) ---
      if (normalizedModule === "receiving") {
        // Ambil dokumen transaksi sekaligus master data produk & vendor terkait secara paralel
        const [
          compReceivingDocs,
          allReceivingItems,
          allReceivingPayments,
          compProducts,
          allCategories,
          allUoms,
          compVendors,
        ] = await Promise.all([
          db
            .select()
            .from(receivingDocuments)
            .where(eq(receivingDocuments.companyId, companyId)),
          db.select().from(receivingItems),
          db.select().from(receivingPayments),
          db
            .select()
            .from(itemProducts)
            .where(eq(itemProducts.companyId, companyId)),
          db.select().from(itemCategories),
          db.select().from(itemUoms),
          db.select().from(vendors).where(eq(vendors.companyId, companyId)),
        ]);

        const receivingItemsMap = new Map<string, any[]>();
        allReceivingItems.forEach((item) => {
          const list = receivingItemsMap.get(item.documentId) || [];
          list.push(item);
          receivingItemsMap.set(item.documentId, list);
        });

        const receivingPaymentsMap = new Map<string, any[]>();
        allReceivingPayments.forEach((p) => {
          const list = receivingPaymentsMap.get(p.documentId) || [];
          list.push(p);
          receivingPaymentsMap.set(p.documentId, list);
        });

        // Bangun lookup map modular O(1)
        const modularLookups = new Map<string, Map<string, any>>([
          ["itemProducts", new Map(compProducts.map((p) => [p.id, p]))],
          ["itemCategories", new Map(allCategories.map((c) => [c.id, c]))],
          ["itemUoms", new Map(allUoms.map((u) => [u.id, u]))],
          ["vendors", new Map(compVendors.map((v) => [v.id, v]))],
        ]);

        const rawDocs = compReceivingDocs.map((d) => ({
          ...d,
          date: d.date instanceof Date ? d.date.toISOString() : String(d.date),
          dueDate:
            d.dueDate instanceof Date ? d.dueDate.toISOString() : d.dueDate,
          items: receivingItemsMap.get(d.id) || [],
          payments: receivingPaymentsMap.get(d.id) || [],
        }));

        // Terapkan auto-enrichment dinamis menggunakan Kamus Skema
        const enrichedDocs = enrichWithSchemaDictionary(
          rawDocs,
          modularLookups,
        );

        return res.status(200).json({
          status: "SUCCESS",
          module: "RECEIVING_DOCUMENT",
          lastSeq: latestSeq,
          lastEventId: latestEventId,
          generatedAt: Date.now(),
          data: {
            documents: enrichedDocs,
          },
        });
      }

      // --- MODUL EXECUTIVE PANEL (mdl_executivepanel) ---
      if (normalizedModule === "executivepanel") {
        const [targets, allocations, ownerLedgers] = await Promise.all([
          db
            .select()
            .from(executiveTargets)
            .where(eq(executiveTargets.companyId, companyId)),
          db
            .select()
            .from(executiveAllocations)
            .where(eq(executiveAllocations.companyId, companyId)),
          db
            .select()
            .from(executiveOwnerLedger)
            .where(eq(executiveOwnerLedger.companyId, companyId)),
        ]);

        const targetsMap: Record<string, any> = {};
        targets.forEach((t) => {
          targetsMap[t.id] = t;
        });

        return res.status(200).json({
          status: "SUCCESS",
          module: "EXECUTIVE_PANEL",
          lastSeq: latestSeq,
          lastEventId: latestEventId,
          generatedAt: Date.now(),
          data: {
            targets: targetsMap,
            allocations,
            ownerLedgers: ownerLedgers.map((o) => ({
              ...o,
              date:
                o.date instanceof Date ? o.date.toISOString() : String(o.date),
            })),
          },
        });
      }

      return res.status(404).json({
        status: "FAILED",
        message: `Modul '${moduleName}' tidak ditemukan atau belum mendukung physical snapshot.`,
      });
    } catch (err: any) {
      console.error("[MODULAR SNAPSHOT ERROR]:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

// Endpoint untuk Memicu Pembuatan Snapshot Langsung di Server (On-Demand / Manual)
router.post(
  "/snapshot/server/generate",
  async (req: Request, res: Response) => {
    try {
      const { companyId } = req.body;
      const result = await generateServerCanonicalSnapshot(companyId);

      if (!result || result.length === 0) {
        return res.status(404).json({
          status: "FAILED",
          message:
            "Gagal membuat snapshot: Data perusahaan tidak ditemukan atau belum ada data aktif.",
        });
      }

      res.status(200).json({
        status: "SUCCESS",
        message:
          "Snapshot resmi server berhasil diperbarui secara instan dari tabel fisik.",
        snapshots: result,
      });
    } catch (err: any) {
      console.error("[SNAPSHOT SERVER GENERATION ERROR]:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

export const systemHealthRouter: Router = router;
