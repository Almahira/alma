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

      // 1. Kumpulkan seluruh ID event & aggregateId yang masih tertahan di antrean Outbox (Belum terkirim / Pending)
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

      // 2. Kelompokkan event berdasarkan aggregateId untuk mencari state/event terakhir
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
        // PERLINDUNGAN MUTLAK 1: Jika masih ada event dari aggregate ini di Outbox, JANGAN PERNAH DIHAPUS!
        if (pendingAggregateIds.has(aggregateId)) {
          console.log(
            `[PRUNING] Dilewati: ${aggregateId} masih memiliki event pending di Outbox.`,
          );
          continue;
        }

        // Urutkan event berdasarkan versi (Ascending)
        events.sort((a, b) => a.aggregateVersion - b.aggregateVersion);
        const latestEvent = events[events.length - 1];

        // Aturan 1: Hanya periksa Transaction Journal (Bukan System Journal / Master Data)
        if (isTransactionAggregate(latestEvent.aggregateType)) {
          const eventTime =
            new Date(latestEvent.hlc.split("_")[0]).getTime() ||
            latestEvent.createdAt ||
            0;

          // Aturan 2: Apakah ini dari bulan-bulan kemarin (lampau)?
          if (eventTime < startOfMonth) {
            // Aturan 3: Apakah status transaksi sudah final (TERMINAL STATE)?
            if (isTransactionCompleted(latestEvent.payload)) {
              // PERLINDUNGAN MUTLAK 2: Pastikan tidak ada satupun eventId dari aggregate ini yang tertinggal di Outbox
              const hasUnsyncedEvent = events.some((e) =>
                pendingEventIds.has(e.id),
              );
              if (hasUnsyncedEvent) {
                console.log(
                  `[PRUNING] Dilewati: ${aggregateId} memiliki eventId yang belum di-ack oleh server.`,
                );
                continue;
              }

              // HAPUS SEMUA EVENT DARI AGGREGATE INI DARI MEMORI LOKAL
              const docsToDelete = await rxdb.collections.events
                .find({ selector: { aggregateId: aggregateId } })
                .exec();

              for (const doc of docsToDelete) {
                await doc.remove();
                deletedCount++;
              }
              console.log(
                `[PRUNING] Menghapus histori transaksi lama yang sudah lunas & tersinkron: ${aggregateId} (${latestEvent.aggregateType})`,
              );
            }
          }
        }
      }

      console.log(
        `[PRUNING] Pembersihan selesai. ${deletedCount} tiket lama berhasil dibersihkan dari memori.`,
      );
    } catch (error) {
      console.error("[PRUNING] Gagal melakukan pembersihan:", error);
    }
  }
}

export const globalPruningManager = new PruningManager();
