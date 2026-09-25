// File: packages/core_unv/src/ledger/PruningManager.ts
import { globalLedger } from "./UniversalLedger";
import {
  isTransactionAggregate,
  getStartOfCurrentMonth,
  isTransactionCompleted,
} from "../utils/pruningUtils";

export class PruningManager {
  public async runCleanup() {
    console.log(
      "[PRUNING] Memulai proses pembersihan memori lokal (Background Task)...",
    );
    try {
      const rxdb = globalLedger.getRxDatabase();
      if (!rxdb || !rxdb.collections.events || !rxdb.collections.outbox) return;

      // 1. Kumpulkan seluruh ID event & aggregateId yang masih tertahan di antrean Outbox
      const pendingOutboxDocs = await rxdb.collections.outbox.find().exec();
      const pendingEventIds = new Set<string>();
      const pendingAggregateIds = new Set<string>();

      pendingOutboxDocs.forEach((doc) => {
        const outboxData = doc.toJSON();
        pendingEventIds.add(outboxData.id);
        const aggId =
          outboxData.eventPayload?.aggregateId ||
          outboxData.eventPayload?.dddMetadata?.aggregateId;
        if (aggId) {
          pendingAggregateIds.add(aggId);
        }
      });

      const allEvents = await rxdb.collections.events.find().exec();
      const startOfMonth = getStartOfCurrentMonth();

      // 2. Kelompokkan event berdasarkan aggregateId
      const aggregateMap = new Map<string, any[]>();
      allEvents.forEach((doc) => {
        const evt = doc.toJSON();
        if (!aggregateMap.has(evt.aggregateId)) {
          aggregateMap.set(evt.aggregateId, []);
        }
        aggregateMap.get(evt.aggregateId)!.push(evt);
      });

      let deletedCount = 0;

      // 3. Evaluasi setiap Aggregate
      for (const [aggregateId, events] of aggregateMap.entries()) {
        // PERLINDUNGAN 1: Jika ada event di Outbox, jangan hapus!
        if (pendingAggregateIds.has(aggregateId)) {
          continue;
        }

        // Urutkan event berdasarkan versi (Ascending)
        events.sort((a, b) => a.aggregateVersion - b.aggregateVersion);
        const latestEvent = events[events.length - 1];

        // Hanya evaluasi dokumen transaksi operasional (bukan Master Data)
        if (isTransactionAggregate(latestEvent.aggregateType)) {
          // PARSER WAKTU PRESISI: Hindari bug NaN yang membuat waktu menjadi 0 (tahun 1970)
          let eventTime = 0;
          if (latestEvent.dddMetadata?.businessDate) {
            eventTime = new Date(
              latestEvent.dddMetadata.businessDate,
            ).getTime();
          }
          if (!eventTime || isNaN(eventTime)) {
            const parsedHlcNum = Number(latestEvent.hlc?.split("_")[0]);
            if (!isNaN(parsedHlcNum) && parsedHlcNum > 0) {
              eventTime = parsedHlcNum;
            }
          }
          if (!eventTime || isNaN(eventTime)) {
            eventTime = Number(latestEvent.createdAt) || 0;
          }

          // Jika waktu event tidak dapat ditentukan, JANGAN PERNAH DIHAPUS (Demi keamanan data)
          if (eventTime <= 0) {
            continue;
          }

          // Aturan 2: Hanya hapus jika transaksi terjadi SEBELUM awal bulan ini
          if (eventTime < startOfMonth) {
            // Aturan 3: Pastikan status transaksi benar-benar lunas / selesai (bukan hutang aktif)
            if (isTransactionCompleted(latestEvent.payload)) {
              // PERLINDUNGAN 2: Pastikan tidak ada eventId yang tertinggal di Outbox
              const hasUnsyncedEvent = events.some((e) =>
                pendingEventIds.has(e.id),
              );
              if (hasUnsyncedEvent) {
                continue;
              }

              // Hapus seluruh event dari agregat ini secara instan
              const docsToDelete = await rxdb.collections.events
                .find({ selector: { aggregateId: aggregateId } })
                .exec();

              const idsToDelete = docsToDelete.map((d) => d.id);
              if (rxdb.collections.events.bulkRemove) {
                await rxdb.collections.events.bulkRemove(idsToDelete);
              } else {
                for (const doc of docsToDelete) {
                  await doc.remove().catch(() => {});
                }
              }
              deletedCount += docsToDelete.length;

              console.log(
                `[PRUNING] Menghapus transaksi lampau yang sudah lunas & tersinkron: ${aggregateId}`,
              );
            }
          }
        }
      }

      if (deletedCount > 0) {
        console.log(
          `[PRUNING] Pembersihan selesai. ${deletedCount} event lampau yang lunas dibersihkan dari memori.`,
        );
      }
    } catch (error) {
      console.error("[PRUNING] Gagal melakukan pembersihan:", error);
    }
  }
}

export const globalPruningManager = new PruningManager();
