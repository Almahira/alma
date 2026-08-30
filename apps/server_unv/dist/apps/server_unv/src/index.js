// File: apps/server_unv/src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { eq, sql } from "drizzle-orm";
import { createServer } from "http";
import { Server } from "socket.io";
import { db } from "./config/db.js";
import { initNATS, publishEvent } from "./config/nats.js";
import { startSyncWorker } from "./worker/syncWorker.js";
import { deviceRegistry, systemEventJournal, txEventJournal, } from "../../../packages/db-schema/index.js";
import { isTransactionCompleted, getStartOfCurrentMonth, } from "../../../packages/core_unv/src/utils/pruningUtils.js";
import { storageRouter } from "./routes/storage.js";
import { globalServerScheduler, setupDefaultServerTasks, } from "./worker/serverScheduler.js";
import { CryptoManager } from "../../../packages/core_unv/src/ledger/crypto.js";
import { telemetryMetrics } from "../../../packages/db-schema/schema/telemetry.js";
import { provisionRouter } from "./routes/provision.js";
import { executiveDashboardRouter } from "./routes/executiveDashboard.js";
import { paymentRouter } from "./routes/payment.js";
dotenv.config();
// ============================================================
// 1. DYNAMIC CORS ORIGIN RESOLVER
// ============================================================
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3010", "http://127.0.0.1:3010"];
const corsOptions = {
    origin: (origin, callback) => {
        // Izinkan request tanpa origin (mobile apps, curl, server-to-server) atau yang cocok
        if (!origin ||
            allowedOrigins.includes(origin) ||
            allowedOrigins.includes("*")) {
            callback(null, true);
        }
        else {
            // Izinkan akses dari subnet lokal (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
            const isPrivateIP = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|localhost)/.test(origin);
            if (isPrivateIP) {
                callback(null, true);
            }
            else {
                // Fallback permisif untuk fleksibilitas multi-device outlet
                callback(null, true);
            }
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-device-id"],
};
const rateLimitStore = new Map();
export const serverRateLimiter = (limit, windowMs) => {
    return (req, res, next) => {
        const clientId = req.query.deviceId || req.ip || "unknown_node";
        const now = Date.now();
        if (!rateLimitStore.has(clientId)) {
            rateLimitStore.set(clientId, { count: 1, resetTime: now + windowMs });
            return next();
        }
        const record = rateLimitStore.get(clientId);
        if (now > record.resetTime) {
            record.count = 1;
            record.resetTime = now + windowMs;
            return next();
        }
        record.count++;
        if (record.count > limit) {
            console.warn(`[RATE LIMITER] Terlalu banyak permintaan dari Device: ${clientId} (${record.count}/${limit})`);
            return res.status(429).json({
                error: "TOO_MANY_REQUESTS",
                message: "Server sedang sibuk memproses antrean. Silakan coba beberapa saat lagi.",
                retryAfterMs: record.resetTime - now,
            });
        }
        next();
    };
};
// ============================================================
// 3. STRATEGI SEVERE BACKPRESSURE CONTROLLER
// ============================================================
let globalActiveConnections = 0;
const MAX_CONCURRENT_SYNC = 50;
export const serverBackpressureGuard = (req, res, next) => {
    if (globalActiveConnections >= MAX_CONCURRENT_SYNC) {
        console.warn(`[BACKPRESSURE] Server overload! Koneksi aktif: ${globalActiveConnections}/${MAX_CONCURRENT_SYNC}. Memicu pengereman klien.`);
        return res.status(503).json({
            error: "SERVER_BACKPRESSURE",
            message: "Antrean server penuh, instruksi pengereman lokal diaktifkan.",
            retryAfterMs: 5000,
        });
    }
    globalActiveConnections++;
    const cleanup = () => {
        globalActiveConnections = Math.max(0, globalActiveConnections - 1);
    };
    res.on("finish", cleanup);
    res.on("close", cleanup);
    next();
};
// Helper Verifikasi Status Perangkat (Kill Switch)
async function isDeviceActive(deviceId) {
    if (!deviceId || deviceId === "UNKNOWN" || deviceId === "SERVER") {
        return { active: true };
    }
    const devCheck = await db
        .select()
        .from(deviceRegistry)
        .where(eq(deviceRegistry.id, deviceId))
        .limit(1);
    if (devCheck.length > 0 &&
        (devCheck[0].status === "REPLACED" || devCheck[0].status === "SUSPENDED")) {
        return { active: false, status: devCheck[0].status };
    }
    return { active: true };
}
// ============================================================
// INISIALISASI EXPRESS & SOCKET.IO
// ============================================================
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: corsOptions.origin,
        credentials: true,
        methods: ["GET", "POST"],
    },
    pingInterval: 10000, // Detak jantung setiap 10 detik
    pingTimeout: 5000, // Putus jika 5 detik tidak merespons
});
app.use(cors(corsOptions));
app.use(express.json());
app.use("/api/payment", paymentRouter);
app.use("/api/storage", storageRouter);
app.use("/api/provision", provisionRouter);
app.use("/api/executive", executiveDashboardRouter);
app.set("io", io);
app.get("/api/health", async (_req, res) => {
    try {
        await db.execute(sql `SELECT 1`);
        res.status(200).json({
            status: "ONLINE",
            service: "ALMA ERP Core",
            database: "CONNECTED",
        });
    }
    catch (error) {
        console.error("[HEALTH CHECK ERROR]:", error);
        res.status(500).json({ status: "ERROR", message: error.message });
    }
});
// ============================================================
// JALUR 1: PULL SYSTEM MASTER DATA (100% RECOVERY)
// ============================================================
app.get("/api/events/pull/system", async (req, res) => {
    try {
        const deviceId = req.query.deviceId || "UNKNOWN";
        // Cek status keaktifan perangkat (Kill Switch)
        if (deviceId && deviceId !== "UNKNOWN" && deviceId !== "SERVER") {
            const devCheck = await db
                .select()
                .from(deviceRegistry)
                .where(eq(deviceRegistry.id, deviceId))
                .limit(1);
            if (devCheck.length > 0 &&
                (devCheck[0].status === "REPLACED" ||
                    devCheck[0].status === "SUSPENDED")) {
                console.warn(`[KILL SWITCH] Menolak PULL System dari perangkat ${deviceId} (Status: ${devCheck[0].status})`);
                return res.status(403).json({
                    error: "DEVICE_DEACTIVATED",
                    message: "Perangkat ini telah dinonaktifkan atau digantikan oleh perangkat lain.",
                });
            }
        }
        console.log(`[HTTP] PULL System Events (Master Data) dari device: ${deviceId}`);
        const systemEventsRaw = await db.select().from(systemEventJournal);
        const formattedEvents = systemEventsRaw.map((ev) => ({
            ...ev,
            payload: typeof ev.payload === "string" ? JSON.parse(ev.payload) : ev.payload,
        }));
        res.status(200).json(formattedEvents);
    }
    catch (error) {
        console.error("[HTTP PULL SYSTEM ERROR]:", error);
        res.status(500).json({ error: error.message });
    }
});
// ============================================================
// 2. ENDPOINT PULL TX JOURNAL (TRANSAKSI OPERASIONAL - FILTERED)
// ============================================================
app.get("/api/events/pull/tx", async (req, res) => {
    try {
        const deviceId = req.query.deviceId || "UNKNOWN";
        // Cek status keaktifan perangkat (Kill Switch)
        if (deviceId && deviceId !== "UNKNOWN" && deviceId !== "SERVER") {
            const devCheck = await db
                .select()
                .from(deviceRegistry)
                .where(eq(deviceRegistry.id, deviceId))
                .limit(1);
            if (devCheck.length > 0 &&
                (devCheck[0].status === "REPLACED" ||
                    devCheck[0].status === "SUSPENDED")) {
                console.warn(`[KILL SWITCH] Menolak PULL Tx dari perangkat ${deviceId} (Status: ${devCheck[0].status})`);
                return res.status(403).json({
                    error: "DEVICE_DEACTIVATED",
                    message: "Perangkat ini telah dinonaktifkan atau digantikan oleh perangkat lain.",
                });
            }
        }
        const windowMode = req.query.window; // '24h' untuk Rapid Recovery
        const filterCompanyId = req.query.companyId;
        const filterRegionId = req.query.regionId;
        const filterOutletId = req.query.outletId;
        console.log(`[HTTP] PULL Tx Events dari device: ${deviceId} (Outlet: ${filterOutletId || "ALL"}, Region: ${filterRegionId || "ALL"}, Window: ${windowMode || "MONTHLY"})`);
        const txEventsRaw = await db.select().from(txEventJournal);
        const now = Date.now();
        const startOfCurrentMonth = getStartOfCurrentMonth();
        const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
        const timeThreshold = windowMode === "24h" ? twentyFourHoursAgo : startOfCurrentMonth;
        const validTxEvents = [];
        const txAggregateMap = new Map();
        txEventsRaw.forEach((evt) => {
            // Filter Spasial: Jika level outlet, hanya tarik data outletnya
            if (filterOutletId && evt.outletId && evt.outletId !== filterOutletId) {
                return;
            }
            // Filter Spasial: Jika level region, hanya tarik data regionnya
            if (filterRegionId && evt.regionId && evt.regionId !== filterRegionId) {
                return;
            }
            if (!txAggregateMap.has(evt.aggregateId)) {
                txAggregateMap.set(evt.aggregateId, []);
            }
            txAggregateMap.get(evt.aggregateId).push(evt);
        });
        for (const [aggId, eventsOfAgg] of txAggregateMap.entries()) {
            eventsOfAgg.sort((a, b) => a.aggregateVersion - b.aggregateVersion);
            const latestEvt = eventsOfAgg[eventsOfAgg.length - 1];
            const payloadObj = typeof latestEvt.payload === "string"
                ? JSON.parse(latestEvt.payload)
                : latestEvt.payload;
            const eventTime = new Date(latestEvt.createdAt).getTime();
            const isOld = eventTime < timeThreshold;
            const isDone = isTransactionCompleted(payloadObj);
            // Smart Pruning: buang transaksi lama yang sudah berstatus terminal
            if (isOld && isDone) {
                continue;
            }
            validTxEvents.push(...eventsOfAgg);
        }
        const formattedEvents = validTxEvents.map((ev) => ({
            ...ev,
            payload: typeof ev.payload === "string" ? JSON.parse(ev.payload) : ev.payload,
        }));
        res.status(200).json(formattedEvents);
    }
    catch (error) {
        console.error("[HTTP PULL TX ERROR]:", error);
        res.status(500).json({ error: error.message });
    }
});
// ============================================================
// ENDPOINT BATCH TELEMETRY INGESTION
// ============================================================
app.post("/api/telemetry/metrics/batch", serverRateLimiter(50, 60 * 1000), serverBackpressureGuard, async (req, res) => {
    try {
        const { deviceId, metrics } = req.body;
        if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
            return res.status(400).json({
                status: "BAD_REQUEST",
                message: "Metrics data kosong.",
            });
        }
        const insertPayload = metrics.map((m) => ({
            id: m.id,
            deviceId: deviceId,
            metricName: m.name,
            durationMs: m.duration,
            contextModule: m.module,
            metadata: m.metadata || {},
            createdAt: new Date(m.timestamp),
        }));
        await db.insert(telemetryMetrics).values(insertPayload);
        res.status(200).json({
            status: "SUCCESS",
            message: "Batch metrik berhasil direkam.",
        });
    }
    catch (error) {
        console.error("[TELEMETRY ERROR]:", error);
        res.status(500).json({ error: error.message });
    }
});
// ============================================================
// SOCKET.IO EVENT HANDLER (WRITE PIPELINE, KILL SWITCH, & SPATIAL ROOMS)
// ============================================================
io.on("connection", async (socket) => {
    const queryDeviceId = socket.handshake.query.deviceId;
    if (queryDeviceId &&
        queryDeviceId !== "UNKNOWN" &&
        queryDeviceId !== "SERVER") {
        const devCheck = await db
            .select()
            .from(deviceRegistry)
            .where(eq(deviceRegistry.id, queryDeviceId))
            .limit(1);
        if (devCheck.length > 0 &&
            (devCheck[0].status === "REPLACED" || devCheck[0].status === "SUSPENDED")) {
            console.warn(`[KILL SWITCH] Memutuskan koneksi perangkat ${queryDeviceId} (${devCheck[0].status})`);
            socket.emit("DEVICE_FORCE_LOGOUT", {
                deviceId: queryDeviceId,
                reason: "DEVICE_REPLACED",
            });
            socket.disconnect(true);
            return;
        }
        // GABUNGKAN KE SPATIAL ROOMS SECARA DINAMIS
        if (devCheck.length > 0) {
            const dev = devCheck[0];
            if (dev.companyId) {
                socket.join(`company:${dev.companyId}`);
            }
            if (dev.regionId) {
                socket.join(`region:${dev.regionId}`);
            }
            if (dev.outletId) {
                socket.join(`outlet:${dev.outletId}`);
            }
            console.log(`[SOCKET SPATIAL] Device ${dev.name} (${dev.id}) bergabung ke Room -> Company: ${dev.companyId} | Region: ${dev.regionId || "-"} | Outlet: ${dev.outletId || "-"}`);
        }
    }
    console.log(`[SOCKET] Client terhubung: ${socket.id} (Device: ${queryDeviceId || "N/A"})`);
    socket.on("SYNC_UP_EVENTS", async (event, callback) => {
        console.log(`[SOCKET] Menerima event dari client: ${event.type}`);
        try {
            // 1. Verifikasi Keaslian Hash Data
            const hashData = {
                seq: event.seq,
                prevHash: event.prevHash,
                type: event.type,
                payload: event.payload,
                dddMetadata: event.dddMetadata,
                hlc: event.hlc,
            };
            const computedHash = CryptoManager.hash(hashData);
            if (computedHash !== event.hash) {
                console.error(`[SECURITY] HASH MISMATCH! Event ${event.id} ditolak.`);
                if (typeof callback === "function") {
                    return callback({
                        status: "REJECTED",
                        message: "Canonical Hash tidak valid. Data gagal diverifikasi.",
                    });
                }
                return;
            }
            // 2. Verifikasi Status Perangkat Asal Event
            const originDeviceId = event.nodeMetadata?.originDeviceId;
            if (originDeviceId && originDeviceId !== "SERVER") {
                const devStatus = await isDeviceActive(originDeviceId);
                if (!devStatus.active) {
                    console.warn(`[SECURITY BLOCKED] Event ${event.type} DITOLAK! Perangkat ${originDeviceId} non-aktif.`);
                    if (typeof callback === "function") {
                        return callback({
                            status: "REJECTED",
                            error: "DEVICE_DEACTIVATED",
                            message: "Perangkat ini telah dinonaktifkan atau digantikan oleh perangkat lain.",
                        });
                    }
                    return;
                }
            }
            // 3. Publish ke NATS JetStream
            await publishEvent("events.sync.up", event);
            console.log(`[SOCKET] -> Sukses publish ${event.type} ke NATS`);
            if (typeof callback === "function") {
                callback({ status: "SUCCESS" });
            }
        }
        catch (error) {
            console.error(`[SOCKET] -> Gagal publish ke NATS:`, error);
            if (typeof callback === "function") {
                callback({ status: "FAILED", message: error.message });
            }
        }
    });
    socket.on("disconnect", () => {
        console.log(`[SOCKET] Client terputus: ${socket.id}`);
    });
});
// ============================================================
// INISIALISASI SERVER
// ============================================================
const PORT = process.env.PORT || 5000;
initNATS()
    .then(() => {
    startSyncWorker(io);
    setupDefaultServerTasks();
    globalServerScheduler.start(60000);
    httpServer.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`  ALMA ERP Server berjalan di port ${PORT}`);
        console.log(`  NATS JetStream & Socket.IO Aktif`);
        console.log(`  Server Scheduler Aktif`);
        console.log(`====================================================`);
    });
})
    .catch((error) => {
    console.error("Gagal memulai infrastruktur server:", error);
});
