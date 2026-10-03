// File: apps/server_unv/src/worker/syncWorker.ts
import { AckPolicy } from "nats";
import { eq, and, desc, asc, lt } from "drizzle-orm";
import { js, jsm, sc } from "../config/nats.js";
import { db } from "../config/db.js";
import {
  systemEventJournal,
  txEventJournal,
  quarantineEventJournal,
  deviceRegistry,
} from "../../../../packages/db-schema/index.js";
import { threeWayMerge } from "./utils/threeWayMerge.js";
import { Server } from "socket.io";

// Impor murni handler server (Bebas dari dependensi React/CSS UI)
import { organizationHandlers } from "../../../../modules/mdl_organization/src/server/event-handlers.js";
import { itemHandlers } from "../../../../modules/mdl_item/src/server/event-handlers.js";
import { vendorHandlers } from "../../../../modules/mdl_vendor/src/server/event-handlers.js";
import { receivingHandlers } from "../../../../modules/mdl_receiving/src/server/event-handlers.js";
import { plusalesHandlers } from "../../../../modules/mdl_plusales/src/server/event-handlers.js";
import { warehouseHandlers } from "../../../../modules/mdl_warehouse/src/server/event-handlers.js";
import { executivepanelHandlers } from "../../../../modules/mdl_executivepanel/src/server/event-handlers.js";

const serverHandlers: Record<string, Function> = {
  ...executivepanelHandlers,
  ...organizationHandlers,
  ...itemHandlers,
  ...vendorHandlers,
  ...receivingHandlers,
  ...plusalesHandlers,
  ...warehouseHandlers,
};

function broadcastSyncNeeded(
  io: Server,
  event: any,
  spatial: {
    companyId?: string | null;
    regionId?: string | null;
    outletId?: string | null;
    targetVendorId?: string | null;
  },
): void {
  const rooms = [
    spatial.companyId ? `company:${spatial.companyId}` : null,
    spatial.regionId ? `region:${spatial.regionId}` : null,
    spatial.outletId ? `outlet:${spatial.outletId}` : null,
    spatial.targetVendorId ? `region:${spatial.targetVendorId}` : null,
  ].filter((room): room is string => Boolean(room));

  const syncPayload = {
    eventId: event.id,
    isTx:
      event.isTx === true ||
      event.type?.startsWith("RECEIVING_") ||
      event.type?.startsWith("TX_") ||
      event.type?.startsWith("POS_") ||
      event.type?.startsWith("ORDER_") ||
      event.type?.startsWith("ATTENDANCE_") ||
      event.dddMetadata?.aggregateType === "RECEIVING_DOCUMENT" ||
      event.dddMetadata?.aggregateType?.startsWith("TX_") ||
      event.dddMetadata?.aggregateType === "WAREHOUSE_DOCUMENT" ||
      event.dddMetadata?.aggregateType === "PLUSALES_DOCUMENT",
    type: event.type,
    aggregateId: event.aggregateId,
    version: event.aggregateVersion || 1,
    aggregateType:
      event.aggregateType || event.dddMetadata?.aggregateType || "SYSTEM",
    originDeviceId:
      event.nodeMetadata?.originDeviceId || event.originDeviceId || "SERVER",
    companyId: spatial.companyId || null,
    regionId: spatial.regionId || null,
    outletId: spatial.outletId || null,
  };

  if (rooms.length === 0) {
    io.emit("SYNC_NEEDED", syncPayload);
    return;
  }

  io.to(rooms).emit("SYNC_NEEDED", syncPayload);
}

async function resolveEventSpatialScope(
  event: any,
  payload: Record<string, any>,
  aggregateId: string,
  targetJournal: typeof systemEventJournal | typeof txEventJournal,
  deviceId?: string,
): Promise<{
  companyId: string | null;
  regionId: string | null;
  outletId: string | null;
}> {
  let companyId =
    payload.organization?.companyId ||
    payload.companyId ||
    payload.company_id ||
    null;
  let regionId =
    payload.location?.regionId ||
    payload.regionId ||
    payload.region_id ||
    null;
  let outletId =
    payload.location?.outletId ||
    payload.outletId ||
    payload.outlet_id ||
    null;

  const aggregateType =
    event.dddMetadata?.aggregateType || event.aggregateType || "";
  if (!companyId && aggregateType === "COMPANY") {
    companyId = aggregateId;
  }
  if (!regionId && aggregateType === "REGION") {
    regionId = aggregateId;
  }
  if (!outletId && aggregateType === "OUTLET") {
    outletId = aggregateId;
  }

  if ((!companyId || !regionId || !outletId) && Number(event.aggregateVersion) > 1) {
    const rootRows = await db
      .select()
      .from(targetJournal)
      .where(
        and(
          eq(targetJournal.aggregateId, aggregateId),
          eq(targetJournal.aggregateVersion, 1),
        ),
      )
      .limit(1);

    const root = rootRows[0];
    if (root) {
      regionId ||= root.regionId;
      outletId ||= root.outletId;
      if (root.payload) {
        const rootPayload =
          typeof root.payload === "string"
            ? JSON.parse(root.payload)
            : root.payload;
        companyId ||=
          rootPayload.organization?.companyId ||
          rootPayload.companyId ||
          rootPayload.company_id ||
          null;
        regionId ||=
          rootPayload.location?.regionId ||
          rootPayload.regionId ||
          rootPayload.region_id ||
          null;
        outletId ||=
          rootPayload.location?.outletId ||
          rootPayload.outletId ||
          rootPayload.outlet_id ||
          null;
      }
    }
  }

  if (deviceId && (!companyId || !regionId || !outletId)) {
    const deviceRows = await db
      .select({
        companyId: deviceRegistry.companyId,
        regionId: deviceRegistry.regionId,
        outletId: deviceRegistry.outletId,
      })
      .from(deviceRegistry)
      .where(eq(deviceRegistry.id, deviceId))
      .limit(1);
    const device = deviceRows[0];
    if (device) {
      companyId ||= device.companyId;
      regionId ||= device.regionId;
      outletId ||= device.outletId;
    }
  }

  return {
    companyId: companyId || null,
    regionId: regionId || null,
    outletId: outletId || null,
  };
}

function confirmOriginDevice(
  io: Server,
  deviceId: string | undefined,
  eventId: string,
  status: "SUCCESS" | "MERGED" | "REJECTED",
  message?: string,
): void {
  if (!deviceId || deviceId === "SERVER") return;
  io.to(`device:${deviceId}`).emit("SYNC_COMMITTED", {
    eventId,
    status,
    message,
  });
}

export async function startSyncWorker(io: Server) {
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
      let payload: Record<string, any> = {};
      let event: any = {};
      let isTxEvent = false;

      // Deklarasi variabel spasial di level scope iterasi agar dapat diakses di try dan catch
      let effectiveRegionId: string | null = null;
      let effectiveOutletId: string | null = null;
      let effectiveCompanyId: string | null = null;

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

        // Scope comes from the event/aggregate, falling back to the registered origin device.
        const spatialScope = await resolveEventSpatialScope(
          event,
          payload,
          aggregateId,
          targetJournal,
          event.nodeMetadata?.originDeviceId,
        );
        effectiveCompanyId = spatialScope.companyId;
        effectiveRegionId = spatialScope.regionId;
        effectiveOutletId = spatialScope.outletId;

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
          } else if (!type.startsWith("DICTIONARY_")) {
            console.warn(
              `[WORKER] Tidak ada server handler untuk event: ${type}`,
            );
          }
        });

        // ============================================================
        // TARGETED SPATIAL BROADCAST (SYNC_NEEDED)
        // ============================================================
        const payloadCompanyId = effectiveCompanyId;
        const payloadRegionId = effectiveRegionId;
        const payloadOutletId = effectiveOutletId;

        // EKSTRAK TARGET B2B (Vendor / Gudang Pusat)
        const targetVendorId =
          payload.reference?.supplierId ||
          payload.vendorId ||
          payload.data?.vendorId;

        broadcastSyncNeeded(
          io,
          {
            ...event,
            id: eventId,
            aggregateId,
            type,
            payload,
            aggregateType: event.dddMetadata?.aggregateType || "SYSTEM",
            actor: event.dddMetadata?.actor?.userId || "SYSTEM",
          },
          {
            companyId: payloadCompanyId,
            regionId: payloadRegionId,
            outletId: payloadOutletId,
            targetVendorId,
          },
        );
        confirmOriginDevice(
          io,
          event.nodeMetadata?.originDeviceId,
          eventId,
          "SUCCESS",
        );
        m.ack();

        // Tetap broadcast dashboard refresh secara global
        io.emit("EXECUTIVE_DASHBOARD_REFRESH", {
          timestamp: Date.now(),
          triggerEvent: type,
        });
      } catch (error: any) {
        const pgErrorCode = error.code || error?.cause?.code;
        const constraint = error.constraint || error?.cause?.constraint;
        const targetJournal = isTxEvent ? txEventJournal : systemEventJournal;

        if (pgErrorCode === "23505") {
          if (
            constraint === "system_event_journal_pkey" ||
            constraint === "tx_event_journal_pkey"
          ) {
            const committedRows = await db
              .select()
              .from(targetJournal)
              .where(eq(targetJournal.id, eventId))
              .limit(1);
            if (committedRows.length > 0) {
              const committed = committedRows[0];
              const committedPayload =
                typeof committed.payload === "string"
                  ? JSON.parse(committed.payload)
                  : committed.payload;
              broadcastSyncNeeded(
                io,
                {
                  ...event,
                  id: committed.id,
                  aggregateId: committed.aggregateId,
                  aggregateVersion: committed.aggregateVersion,
                  aggregateType: committed.aggregateType,
                  type: committed.type,
                  payload: committedPayload,
                  actor: committed.actor,
                  createdAt: committed.createdAt,
                },
                {
                  companyId: effectiveCompanyId,
                  regionId: committed.regionId,
                  outletId: committed.outletId,
                  targetVendorId:
                    committedPayload.reference?.supplierId ||
                    committedPayload.vendorId ||
                    committedPayload.data?.vendorId,
                },
              );
            }
            console.warn(
              `[WORKER] Idempotent: Event ${eventId} sudah ada di DB. Ack pesan.`,
            );
            confirmOriginDevice(
              io,
              event.nodeMetadata?.originDeviceId,
              eventId,
              "SUCCESS",
            );
            m.ack();
          } else {
            const existingRebaseId = `REBASED_${eventId}`;
            const existingRebaseRows = await db
              .select()
              .from(targetJournal)
              .where(eq(targetJournal.id, existingRebaseId))
              .limit(1);

            if (existingRebaseRows.length > 0) {
              const rebased = existingRebaseRows[0];
              const rebasedPayload =
                typeof rebased.payload === "string"
                  ? JSON.parse(rebased.payload)
                  : rebased.payload;
              broadcastSyncNeeded(
                io,
                {
                  ...event,
                  id: rebased.id,
                  aggregateId: rebased.aggregateId,
                  aggregateVersion: rebased.aggregateVersion,
                  aggregateType: rebased.aggregateType,
                  type: rebased.type,
                  payload: rebasedPayload,
                  actor: rebased.actor,
                  nodeMetadata: {
                    originDeviceId: "SERVER_REBASE",
                    signature: "SERVER_COMMITTED",
                  },
                  dddMetadata: {
                    ...event.dddMetadata,
                    eventId: rebased.id,
                    aggregateId: rebased.aggregateId,
                    aggregateType: rebased.aggregateType,
                    aggregateVersion: rebased.aggregateVersion,
                  },
                },
                {
                  companyId: effectiveCompanyId,
                  regionId: rebased.regionId,
                  outletId: rebased.outletId,
                },
              );
              confirmOriginDevice(
                io,
                event.nodeMetadata?.originDeviceId,
                eventId,
                "MERGED",
              );
              m.ack();
              continue;
            }

            const versionCollisionRows = await db
              .select({ id: targetJournal.id })
              .from(targetJournal)
              .where(
                and(
                  eq(targetJournal.aggregateId, aggregateId),
                  eq(
                    targetJournal.aggregateVersion,
                    event.aggregateVersion || 1,
                  ),
                ),
              )
              .limit(1);
            if (versionCollisionRows.length === 0) {
              const reason =
                `Unique business constraint violation${constraint ? ` (${constraint})` : ""}`;
              await db.insert(quarantineEventJournal).values({
                id: eventId,
                aggregateId,
                aggregateType: event.dddMetadata?.aggregateType || "SYSTEM",
                aggregateVersion: event.aggregateVersion || 1,
                type,
                payload: JSON.stringify(payload),
                actor: event.dddMetadata?.actor?.userId || "SYSTEM",
                errorReason: reason,
              });
              confirmOriginDevice(
                io,
                event.nodeMetadata?.originDeviceId,
                eventId,
                "REJECTED",
                reason,
              );
              m.ack();
              continue;
            }

            if (type.endsWith("_CREATED")) {
              const reason =
                "Aggregate creation conflicts with an existing aggregate; creation events cannot be rebased.";
              await db.insert(quarantineEventJournal).values({
                id: eventId,
                aggregateId,
                aggregateType: event.dddMetadata?.aggregateType || "SYSTEM",
                aggregateVersion: event.aggregateVersion || 1,
                type,
                payload: JSON.stringify(payload),
                actor: event.dddMetadata?.actor?.userId || "SYSTEM",
                errorReason: reason,
              });
              confirmOriginDevice(
                io,
                event.nodeMetadata?.originDeviceId,
                eventId,
                "REJECTED",
                reason,
              );
              m.ack();
              continue;
            }

            console.log(
              `[WORKER] Terdeteksi Event Konkuren/Offline pada ${aggregateId} (Target v${event.aggregateVersion || 1}). Memulai Sequential Rebase...`,
            );
            try {
              // 1. Ambil Versi Dasar sebelum Client B offline (Base Version)
              const baseVersion = Math.max(
                1,
                (event.aggregateVersion || 1) - 1,
              );
              let basePayload: Record<string, any> = {};

              if (baseVersion > 0) {
                const baseEventData = await db
                  .select()
                  .from(targetJournal)
                  .where(
                    and(
                      eq(targetJournal.aggregateId, aggregateId),
                      eq(targetJournal.aggregateVersion, baseVersion),
                    ),
                  )
                  .limit(1);
                let baseEvent = baseEventData[0];
                if (!baseEvent) {
                  const nearestBaseEvent = await db
                    .select()
                    .from(targetJournal)
                    .where(
                      and(
                        eq(targetJournal.aggregateId, aggregateId),
                        lt(targetJournal.aggregateVersion, baseVersion),
                      ),
                    )
                    .orderBy(desc(targetJournal.aggregateVersion))
                    .limit(1);
                  baseEvent = nearestBaseEvent[0];
                }
                if (baseEvent?.payload) {
                  basePayload =
                    typeof baseEvent.payload === "string"
                      ? JSON.parse(baseEvent.payload)
                      : baseEvent.payload;
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
                const latestServerPayload =
                  typeof latestServer.payload === "string"
                    ? JSON.parse(latestServer.payload)
                    : latestServer.payload;
                const latestVersion = latestServer.aggregateVersion;

                // 3. Ekstraksi Timestamp Mikrodetik (Server vs Client Offline)
                const serverTimestamp = latestServer.createdAt;
                const clientTimestamp =
                  event.createdAt ||
                  event.client_timestamp ||
                  payload.updatedAt ||
                  payload.timestamp;

                // 4. Eksekusi 3-Way Merge Bebas Karantina
                const { merged, conflictFields } = threeWayMerge(
                  basePayload,
                  latestServerPayload,
                  payload,
                  serverTimestamp,
                  clientTimestamp,
                );

                if (conflictFields.length > 0) {
                  console.log(
                    `[WORKER] Kolom bertabrakan pada [${conflictFields.join(", ")}] berhasil diselesaikan via TIMESTAMP(6).`,
                  );
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
                const mergedRegionId =
                  effectiveRegionId || latestServer.regionId || null;
                const mergedOutletId =
                  effectiveOutletId || latestServer.outletId || null;

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

                console.log(
                  `[WORKER] SUKSES: Rebase ${aggregateId} selesai! Versi dinaikkan menjadi v${newVersion} dan tabel fisik diperbarui.`,
                );

                broadcastSyncNeeded(
                  io,
                  {
                    ...newEvent,
                    aggregateType:
                      event.dddMetadata?.aggregateType || "SYSTEM",
                    actor:
                      event.dddMetadata?.actor?.userId || "SYSTEM_REBASE",
                    nodeMetadata: {
                      originDeviceId: "SERVER_REBASE",
                      signature: "SERVER_COMMITTED",
                    },
                    dddMetadata: {
                      ...event.dddMetadata,
                      eventId: newEventId,
                      aggregateId,
                      aggregateVersion: newVersion,
                    },
                  },
                  {
                    companyId: effectiveCompanyId,
                    regionId: mergedRegionId,
                    outletId: mergedOutletId,
                  },
                );
                confirmOriginDevice(
                  io,
                  event.nodeMetadata?.originDeviceId,
                  eventId,
                  "MERGED",
                );
              }

              // Selesaikan pesan di NATS
              m.ack();
            } catch (mergeErr: any) {
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
                confirmOriginDevice(
                  io,
                  event.nodeMetadata?.originDeviceId,
                  eventId,
                  "REJECTED",
                  mergeErr.message,
                );
                m.ack();
              } catch (qErr) {
                console.error("[WORKER] Gagal mencatat crash:", qErr);
              }
            }
          }
        } else {
          console.error(
            `[WORKER] Fatal Error pada event ${eventId}:`,
            error.message,
          );
          try {
            console.log(
              `[WORKER] Memasukkan event ${eventId} ke Jurnal Karantina (DLQ)...`,
            );
            await db.insert(quarantineEventJournal).values({
              id: eventId,
              aggregateId: aggregateId,
              aggregateType: event.dddMetadata?.aggregateType || "SYSTEM",
              aggregateVersion: event.aggregateVersion || 1,
              type: type,
              payload: JSON.stringify(payload),
              actor: event.dddMetadata?.actor?.userId || "SYSTEM",
              errorReason:
                error.message || error?.cause?.message || "Unknown Fatal Error",
            });
            confirmOriginDevice(
              io,
              event.nodeMetadata?.originDeviceId,
              eventId,
              "REJECTED",
              error.message || error?.cause?.message || "Unknown Fatal Error",
            );
            m.ack();
          } catch (qError) {
            console.error(
              "[WORKER] GAGAL MENGKARANTINA EVENT! NATS TERHENTI SEMENTARA.",
              qError,
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("[WORKER] Fatal Error in Sync Worker Setup:", error);
  }
}
