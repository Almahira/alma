// File: apps/server_unv/src/routes/systemHealth.ts
import express, { Router, Request, Response } from "express";
import { sql, desc, eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { nc, jsm, publishEvent } from "../config/nats.js";
import {
  systemEventJournal,
  txEventJournal,
  quarantineEventJournal,
  deviceRegistry,
} from "../../../../packages/db-schema/index.js";
import { telemetryMetrics } from "../../../../packages/db-schema/schema/telemetry.js";

const router = express.Router();

// =========================================================================
// 1. GET /api/system-health/overview (Desktop & Tablet)
// =========================================================================
router.get("/overview", async (_req: Request, res: Response) => {
  try {
    const startTime = performance.now();

    // 1. Cek Koneksi PostgreSQL
    let dbStatus = "CONNECTED";
    let dbLatencyMs = 0;
    try {
      await db.execute(sql`SELECT 1`);
      dbLatencyMs = Math.round(performance.now() - startTime);
    } catch (e: any) {
      dbStatus = "DISCONNECTED";
    }

    // 2. Cek Koneksi NATS JetStream
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

    // 3. Hitung Jumlah Event di Jurnal
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

    // 4. Memory & Uptime Server
    const memory = process.memoryUsage();
    const heapUsedMb = Math.round(memory.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(memory.heapTotal / 1024 / 1024);
    const rssMb = Math.round(memory.rss / 1024 / 1024);
    const uptimeSeconds = Math.floor(process.uptime());

    // 5. Perangkat Aktif vs Offline
    const allDevices = await db.select().from(deviceRegistry);
    const now = Date.now();
    let activeDevicesCount = 0;
    let offlineDevicesCount = 0;

    allDevices.forEach((d) => {
      const lastSeen = d.lastSeenAt ? new Date(d.lastSeenAt).getTime() : 0;
      // Perangkat dianggap online jika ada aktivitas dalam 3 menit terakhir
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
// 2. GET /api/system-health/urgency (Khusus Smartphone: Sangat Ringan & Cepat)
// =========================================================================
router.get("/urgency", async (_req: Request, res: Response) => {
  try {
    const alerts: {
      level: "CRITICAL" | "WARNING";
      title: string;
      message: string;
      timestamp: string;
    }[] = [];

    // 1. Cek DB
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

    // 2. Cek NATS
    if (!nc || nc.isClosed()) {
      alerts.push({
        level: "CRITICAL",
        title: "NATS JetStream Mati",
        message:
          "Antrean sinkronisasi transaksi tidak dapat mendistribusikan data.",
        timestamp: new Date().toISOString(),
      });
    }

    // 3. Cek Karantina DLQ (Paling Krusial)
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

    // 4. Cek Memori Server
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

    // 5. Cek Error Crash Terkini di Telemetri
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
// 3. GET /api/system-health/quarantine (Daftar Lengkap Event DLQ)
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
// 4. POST /api/system-health/quarantine/retry (Coba Eksekusi Ulang Event)
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

    // Masukkan kembali ke antrean NATS agar diproses ulang
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

    // Hapus dari jurnal karantina
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
// 5. POST /api/system-health/quarantine/purge (Hapus Event Rusak)
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
// 6. GET /api/system-health/devices (Daftar & Analisis Diagnosa Mesin)
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
// 7. POST /api/system-health/broadcast-resync
//    Menembakkan sinyal WebSocket ke seluruh klien untuk memicu resync lokal
// =========================================================================
router.post("/broadcast-resync", async (req: Request, res: Response) => {
  try {
    const { reason = "Penyelarasan Skema & Data Server Pusat" } = req.body;
    const io = req.app.get("io");

    if (io) {
      io.emit("REMOTE_RESYNC_TRIGGER", {
        timestamp: Date.now(),
        reason,
      });
      console.log(
        `[OTA BROADCAST] Sinyal penyelarasan ditembakkan ke seluruh perangkat.`,
      );
    }

    res.status(200).json({
      status: "SUCCESS",
      message:
        "Sinyal penyelarasan OTA berhasil dikirim ke seluruh perangkat yang terhubung.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export const systemHealthRouter: Router = router;
