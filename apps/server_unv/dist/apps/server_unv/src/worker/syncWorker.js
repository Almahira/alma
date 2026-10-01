// File: apps/server_unv/src/worker/syncWorker.ts
import { AckPolicy } from "nats";
import { eq, and, desc, asc } from "drizzle-orm";
import { js, jsm, sc } from "../config/nats.js";
import { db } from "../config/db.js";
import { systemEventJournal, txEventJournal, quarantineEventJournal, } from "../../../../packages/db-schema/index.js";
import { threeWayMerge } from "./utils/threeWayMerge.js";
// Impor murni handler server (Bebas dari dependensi React/CSS UI)
import { organizationHandlers } from "../../../../modules/mdl_organization/src/server/event-handlers.js";
import { itemHandlers } from "../../../../modules/mdl_item/src/server/event-handlers.js";
import { vendorHandlers } from "../../../../modules/mdl_vendor/src/server/event-handlers.js";
import { receivingHandlers } from "../../../../modules/mdl_receiving/src/server/event-handlers.js";
import { plusalesHandlers } from "../../../../modules/mdl_plusales/src/server/event-handlers.js";
import { warehouseHandlers } from "../../../../modules/mdl_warehouse/src/server/event-handlers.js";
import { executivepanelHandlers } from "../../../../modules/mdl_executivepanel/src/server/event-handlers.js";
const serverHandlers = {
    ...executivepanelHandlers,
    ...organizationHandlers,
    ...itemHandlers,
    ...vendorHandlers,
    ...receivingHandlers,
    ...plusalesHandlers,
    ...warehouseHandlers,
};
export async function startSyncWorker(io) {
    console.log("[WORKER] Menginisialisasi Consumer NATS Universal...");
    try {
        await jsm.consumers.add("ERP_STREAM", {
            durable_name: "sync_worker_group",
            ack_policy: AckPolicy.Explicit,
        });
        const consumer = await js.consumers.get("ERP_STREAM", "sync_worker_group");
        const iter = await consumer.consume();
        console.log("[WORKER] Sync Worker berjalan dan mendengarkan event...");
        for await (const m of iter) {
            let eventId = "";
            let aggregateId = "";
            let type = "UNKNOWN_EVENT";
            let payload = {};
            let event = {};
            let isTxEvent = false;
            // Deklarasi variabel spasial di level scope iterasi agar dapat diakses di try dan catch
            let effectiveRegionId = null;
            let effectiveOutletId = null;
            let effectiveCompanyId = null;
            try {
                const rawData = sc.decode(m.data);
                event = JSON.parse(rawData);
                type = event.type || "UNKNOWN_EVENT";
                payload = event.payload || {};
                eventId = event.id || `REPAIRED_${Date.now()}`;
                aggregateId = event.aggregateId || payload.id || `ORPHAN_${Date.now()}`;
                const aggregateType = event.dddMetadata?.aggregateType || "SYSTEM";
                isTxEvent =
                    type.startsWith("RECEIVING_") ||
                        type.startsWith("TX_") ||
                        type.startsWith("POS_") ||
                        type.startsWith("ORDER_") ||
                        type.startsWith("ATTENDANCE_") ||
                        aggregateType === "RECEIVING_DOCUMENT" ||
                        aggregateType.startsWith("TX_") ||
                        aggregateType === "WAREHOUSE_DOCUMENT" ||
                        aggregateType === "PLUSALES_DOCUMENT";
                const targetJournal = isTxEvent ? txEventJournal : systemEventJournal;
                // 1. Ekstraksi spasial awal dari payload event
                effectiveRegionId =
                    payload.location?.regionId || payload.regionId || null;
                effectiveOutletId =
                    payload.location?.outletId || payload.outletId || null;
                effectiveCompanyId =
                    payload.organization?.companyId || payload.companyId || null;
                // 2. SMART SPATIAL INHERITANCE:
                // Jika event lanjutan (v > 1) tidak membawa lokasi (misal payload {} saat ARCHIVE/RESTORE),
                // server otomatis mewarisinya dari event versi awal di database
                if ((!effectiveRegionId || !effectiveOutletId || !effectiveCompanyId) &&
                    (event.aggregateVersion || 1) > 1) {
                    try {
                        const rootEvents = await db
                            .select()
                            .from(targetJournal)
                            .where(eq(targetJournal.aggregateId, aggregateId))
                            .orderBy(asc(targetJournal.aggregateVersion))
                            .limit(1);
                        if (rootEvents.length > 0) {
                            const root = rootEvents[0];
                            if (!effectiveRegionId)
                                effectiveRegionId = root.regionId;
                            if (!effectiveOutletId)
                                effectiveOutletId = root.outletId;
                            if (!effectiveCompanyId && root.payload) {
                                const rootP = typeof root.payload === "string"
                                    ? JSON.parse(root.payload)
                                    : root.payload;
                                effectiveCompanyId =
                                    rootP.organization?.companyId || rootP.companyId || null;
                            }
                        }
                    }
                    catch (inhErr) {
                        console.warn("[WORKER] Pewarisan spasial dilewati:", inhErr);
                    }
                }
                // 3. Simpan ke database dengan lokasi dan aggregateType yang lengkap
                await db.transaction(async (tx) => {
                    await tx.insert(targetJournal).values({
                        id: eventId,
                        aggregateId: aggregateId,
                        aggregateType: event.dddMetadata?.aggregateType || "SYSTEM",
                        aggregateVersion: event.aggregateVersion || 1,
                        type: type,
                        regionId: effectiveRegionId,
                        outletId: effectiveOutletId,
                        payload: JSON.stringify(payload),
                        actor: event.dddMetadata?.actor?.userId || "SYSTEM",
                    });
                    const handler = serverHandlers[type];
                    if (handler) {
                        await handler(tx, event);
                    }
                    else if (!type.startsWith("DICTIONARY_")) {
                        console.warn(`[WORKER] Tidak ada server handler untuk event: ${type}`);
                    }
                });
                m.ack();
                // ============================================================
                // TARGETED SPATIAL BROADCAST (SYNC_NEEDED)
                // ============================================================
                const payloadCompanyId = effectiveCompanyId;
                const payloadRegionId = effectiveRegionId;
                const payloadOutletId = effectiveOutletId;
                // EKSTRAK TARGET B2B (Vendor / Gudang Pusat)
                const targetVendorId = payload.reference?.supplierId ||
                    payload.vendorId ||
                    payload.data?.vendorId;
                const syncPayload = {
                    eventId,
                    type,
                    aggregateType: event.dddMetadata?.aggregateType,
                    originDeviceId: event.nodeMetadata?.originDeviceId,
                    companyId: payloadCompanyId,
                    regionId: payloadRegionId,
                    outletId: payloadOutletId,
                    targetVendorId: targetVendorId,
                };
                // Jika event tidak memiliki konteks spasial perusahaan (seperti DICTIONARY), pancarkan broadcast global
                if (!payloadCompanyId && !payloadRegionId && !payloadOutletId) {
                    io.emit("SYNC_NEEDED", syncPayload);
                }
                else if (payloadCompanyId && !payloadRegionId && !payloadOutletId) {
                    io.to(`company:${payloadCompanyId}`).emit("SYNC_NEEDED", syncPayload);
                }
                else {
                    if (payloadRegionId) {
                        io.to(`region:${payloadRegionId}`).emit("SYNC_NEEDED", syncPayload);
                    }
                    if (targetVendorId && targetVendorId !== payloadRegionId) {
                        io.to(`region:${targetVendorId}`).emit("SYNC_NEEDED", syncPayload);
                    }
                    if (payloadOutletId) {
                        io.to(`outlet:${payloadOutletId}`).emit("SYNC_NEEDED", syncPayload);
                    }
                    if (payloadCompanyId) {
                        io.to(`company:${payloadCompanyId}`).emit("SYNC_NEEDED", syncPayload);
                    }
                }
                // Tetap broadcast dashboard refresh secara global
                io.emit("EXECUTIVE_DASHBOARD_REFRESH", {
                    timestamp: Date.now(),
                    triggerEvent: type,
                });
            }
            catch (error) {
                const pgErrorCode = error.code || error?.cause?.code;
                const constraint = error.constraint || error?.cause?.constraint;
                const targetJournal = isTxEvent ? txEventJournal : systemEventJournal;
                if (pgErrorCode === "23505") {
                    if (constraint === "system_event_journal_pkey" ||
                        constraint === "tx_event_journal_pkey") {
                        console.warn(`[WORKER] Idempotent: Event ${eventId} sudah ada di DB. Ack pesan.`);
                        m.ack();
                    }
                    else {
                        console.log(`[WORKER] Terdeteksi Event Konkuren/Offline pada ${aggregateId} (Target v${event.aggregateVersion || 1}). Memulai Sequential Rebase...`);
                        try {
                            // 1. Ambil Versi Dasar sebelum Client B offline (Base Version)
                            const baseVersion = Math.max(1, (event.aggregateVersion || 1) - 1);
                            let basePayload = {};
                            if (baseVersion > 0) {
                                const baseEventData = await db
                                    .select()
                                    .from(targetJournal)
                                    .where(and(eq(targetJournal.aggregateId, aggregateId), eq(targetJournal.aggregateVersion, baseVersion)))
                                    .limit(1);
                                if (baseEventData.length > 0 && baseEventData[0].payload) {
                                    basePayload =
                                        typeof baseEventData[0].payload === "string"
                                            ? JSON.parse(baseEventData[0].payload)
                                            : baseEventData[0].payload;
                                }
                            }
                            // 2. Ambil Event Terakhir yang Berhasil di Server (Current Head di DB)
                            const latestServerEventData = await db
                                .select()
                                .from(targetJournal)
                                .where(eq(targetJournal.aggregateId, aggregateId))
                                .orderBy(desc(targetJournal.aggregateVersion))
                                .limit(1);
                            if (latestServerEventData.length > 0) {
                                const latestServer = latestServerEventData[0];
                                const latestServerPayload = typeof latestServer.payload === "string"
                                    ? JSON.parse(latestServer.payload)
                                    : latestServer.payload;
                                const latestVersion = latestServer.aggregateVersion;
                                // 3. Ekstraksi Timestamp Mikrodetik (Server vs Client Offline)
                                const serverTimestamp = latestServer.createdAt;
                                const clientTimestamp = event.createdAt ||
                                    event.client_timestamp ||
                                    payload.updatedAt ||
                                    payload.timestamp;
                                // 4. Eksekusi 3-Way Merge Bebas Karantina
                                const { merged, conflictFields } = threeWayMerge(basePayload, latestServerPayload, payload, serverTimestamp, clientTimestamp);
                                if (conflictFields.length > 0) {
                                    console.log(`[WORKER] Kolom bertabrakan pada [${conflictFields.join(", ")}] berhasil diselesaikan via TIMESTAMP(6).`);
                                }
                                // 5. Sequential Rebase: Naikkan versi menjadi latestVersion + 1 (misal 3 -> 4)
                                const newVersion = latestVersion + 1;
                                const newEventId = `REBASED_${eventId}`;
                                const newEvent = {
                                    ...event,
                                    id: newEventId,
                                    aggregateVersion: newVersion,
                                    payload: merged,
                                };
                                // Pastikan warisan lokasi spasial tetap sah
                                const mergedRegionId = effectiveRegionId || latestServer.regionId || null;
                                const mergedOutletId = effectiveOutletId || latestServer.outletId || null;
                                // 6. Simpan Event Hasil Rebase ke Jurnal & Tulis ke Tabel Fisik
                                await db.transaction(async (tx) => {
                                    await tx.insert(targetJournal).values({
                                        id: newEventId,
                                        aggregateId: aggregateId,
                                        aggregateType: event.dddMetadata?.aggregateType || "SYSTEM",
                                        aggregateVersion: newVersion,
                                        type: type,
                                        regionId: mergedRegionId,
                                        outletId: mergedOutletId,
                                        payload: JSON.stringify(merged),
                                        actor: event.dddMetadata?.actor?.userId || "SYSTEM_REBASE",
                                    });
                                    // Update tabel fisik lewat server handler modul terkait
                                    const handler = serverHandlers[type];
                                    if (handler) {
                                        await handler(tx, newEvent);
                                    }
                                });
                                console.log(`[WORKER] SUKSES: Rebase ${aggregateId} selesai! Versi dinaikkan menjadi v${newVersion} dan tabel fisik diperbarui.`);
                                // 7. Siarkan SYNC_NEEDED ke Seluruh Cabang dengan Versi Terkini
                                const syncPayload = {
                                    eventId: newEventId,
                                    type,
                                    aggregateId,
                                    version: newVersion,
                                    aggregateType: event.dddMetadata?.aggregateType,
                                    originDeviceId: "SERVER_REBASE",
                                    companyId: effectiveCompanyId,
                                    regionId: mergedRegionId,
                                    outletId: mergedOutletId,
                                };
                                if (mergedOutletId) {
                                    io.to(`outlet:${mergedOutletId}`).emit("SYNC_NEEDED", syncPayload);
                                }
                                else if (mergedRegionId) {
                                    io.to(`region:${mergedRegionId}`).emit("SYNC_NEEDED", syncPayload);
                                }
                                if (effectiveCompanyId) {
                                    io.to(`company:${effectiveCompanyId}`).emit("SYNC_NEEDED", syncPayload);
                                }
                            }
                            // Selesaikan pesan di NATS
                            m.ack();
                        }
                        catch (mergeErr) {
                            console.error("[WORKER] Gagal pada proses Rebase:", mergeErr);
                            // Hanya jika terjadi crash fatal JavaScript/JSON yang tidak terduga, event dicatat ke karantina
                            try {
                                await db.insert(quarantineEventJournal).values({
                                    id: eventId,
                                    aggregateId: aggregateId,
                                    aggregateType: event.dddMetadata?.aggregateType || "SYSTEM",
                                    aggregateVersion: event.aggregateVersion || 1,
                                    type: type,
                                    payload: JSON.stringify(payload),
                                    actor: event.dddMetadata?.actor?.userId || "SYSTEM",
                                    errorReason: `Fatal Crash Rebase: ${mergeErr.message}`,
                                });
                                m.ack();
                            }
                            catch (qErr) {
                                console.error("[WORKER] Gagal mencatat crash:", qErr);
                            }
                        }
                    }
                }
                else {
                    console.error(`[WORKER] Fatal Error pada event ${eventId}:`, error.message);
                    try {
                        console.log(`[WORKER] Memasukkan event ${eventId} ke Jurnal Karantina (DLQ)...`);
                        await db.insert(quarantineEventJournal).values({
                            id: eventId,
                            aggregateId: aggregateId,
                            aggregateType: event.dddMetadata?.aggregateType || "SYSTEM",
                            aggregateVersion: event.aggregateVersion || 1,
                            type: type,
                            payload: JSON.stringify(payload),
                            actor: event.dddMetadata?.actor?.userId || "SYSTEM",
                            errorReason: error.message || error?.cause?.message || "Unknown Fatal Error",
                        });
                        m.ack();
                    }
                    catch (qError) {
                        console.error("[WORKER] GAGAL MENGKARANTINA EVENT! NATS TERHENTI SEMENTARA.", qError);
                    }
                }
            }
        }
    }
    catch (error) {
        console.error("[WORKER] Fatal Error in Sync Worker Setup:", error);
    }
}
