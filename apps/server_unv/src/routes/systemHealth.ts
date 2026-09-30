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
} from "../../../../packages/db-schema/index.js";
import {
  companies,
  regions,
  outlets,
  employees,
  userAccounts,
} from "../../../../modules/mdl_organization/src/server/schema.js";
import { telemetryMetrics } from "../../../../packages/db-schema/schema/telemetry.js";

const router = express.Router();

// =========================================================================
// ENGINE SNAPSHOT SERVER OTOMATIS (CANONICAL SNAPSHOT GENERATOR)
// =========================================================================
export async function generateServerCanonicalSnapshot(
  targetCompanyId?: string,
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

      // Jika snapshot sudah ada dan tidak ada event baru dalam 5 menit terakhir, lewati demi efisiensi
      if (existingSnap && newSysEventsCount === 0 && newTxEventsCount === 0) {
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
        `[SERVER SNAPSHOT] Terdeteksi perubahan data pada ${comp.name} (Sys delta: ${newSysEventsCount}, Tx delta: ${newTxEventsCount}). Memperbarui snapshot...`,
      );

      // 4. Tarik master data organisasi resmi dari PostgreSQL
      const [compRegions, compOutlets, compEmployees, compUsers] =
        await Promise.all([
          db.select().from(regions).where(eq(regions.companyId, compId)),
          db.select().from(outlets).where(eq(outlets.companyId, compId)),
          db.select().from(employees),
          db.select().from(userAccounts).where(eq(userAccounts.isActive, true)),
        ]);

      // Validasi integritas master data penting
      if (compEmployees.length === 0 || compUsers.length === 0) {
        console.warn(
          `[SERVER SNAPSHOT] Peringatan: Data karyawan/user kosong untuk ${comp.name}. Pembentukan snapshot ditunda demi keamanan login.`,
        );
        continue;
      }

      // 5. Susun struktur State yang kompatibel langsung dengan UniversalRegistry
      const organizationDomainState = {
        companies: [comp],
        regions: compRegions,
        outlets: compOutlets,
        documents: [],
        bankAccounts: [],
        divisions: [],
        positions: [],
        documentTypes: [],
        employees: compEmployees,
        employmentAssignments: [],
        employeeDocuments: [],
        userAccounts: compUsers.map((u) => ({
          id: u.id,
          employeeId: u.employeeId,
          username: u.username,
          role: u.role,
          allowedOutletIds: [],
          isActive: u.isActive,
        })),
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

      // Payload snapshot flat di level root agar terbaca langsung oleh projection handlers
      const snapshotDataPayload = {
        ORGANIZATION: organizationDomainState,
        ITEM_DOMAIN: { items: [], categories: [], units: [] },
        VENDOR: { vendors: [] },
        DICTIONARY: {},
        __metadata: {
          schemaVersion: 2,
          companyId: compId,
          lastSeq: currentTotalSeq,
          totalSystemEvents: totalSysCount,
          totalTxEvents: totalTxCount,
          generatedAt: Date.now(),
        },
      };

      const snapId = `SNAP_${compId}`;
      const jsonString = JSON.stringify(snapshotDataPayload);

      // 7. Simpan / Perbarui Snapshot di database PostgreSQL
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
        `[SERVER SNAPSHOT] SUKSES: Snapshot resmi Sequence #${currentTotalSeq} berhasil dibekukan untuk ${comp.name}.`,
      );

      reportResults.push({
        companyId: compId,
        status: "UPDATED",
        lastSeq: currentTotalSeq,
        employeesCount: compEmployees.length,
        usersCount: compUsers.length,
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
// 8. BRANKAS SNAPSHOT MASTER DATA PUSAT
// =========================================================================

// Endpoint untuk Klien Baru / Klien Resync menarik data jadi (Instant Hydration)
router.get("/snapshot/system/latest", async (req: Request, res: Response) => {
  try {
    const companyId = req.query.companyId as string | undefined;

    const whereClause = companyId
      ? eq(systemSnapshots.companyId, String(companyId))
      : undefined;

    const query = db
      .select()
      .from(systemSnapshots)
      .where(whereClause)
      .orderBy(desc(systemSnapshots.updatedAt))
      .limit(1);

    const rows = await query;

    if (rows.length === 0) {
      return res.status(200).json({ hasSnapshot: false });
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
        message: "Snapshot resmi server berhasil diperbarui secara instan.",
        snapshots: result,
      });
    } catch (err: any) {
      console.error("[SNAPSHOT SERVER GENERATION ERROR]:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

export const systemHealthRouter: Router = router;
