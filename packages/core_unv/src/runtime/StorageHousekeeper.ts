// File: packages/core_unv/src/runtime/StorageHousekeeper.ts
import { globalPruningManager, PruningManager } from "../ledger/PruningManager";
import { globalLedger, UniversalLedger } from "../ledger/UniversalLedger";
import { globalBlobManager, BlobManager } from "../io/BlobManager";
import { IO_CONFIG } from "../io/config";
import { StorageCleanupReport } from "./types";

export class StorageHousekeeper {
  /**
   * Menjalankan pembersihan berkala sesuai aturan:
   * 1. HANYA hapus transaksi jurnal bulan lalu yang statusnya TERMINAL (via runCleanup).
   * 2. JANGAN PERNAH sentuh System Journal dan transaksi yang masih aktif.
   * 3. Hapus Cache File/Blob lokal dari transaksi yang event-nya sudah terhapus/tidak aktif.
   * 4. Cache SYSTEM (IO_CONFIG.CACHE_NAMES.SYSTEM) DILINDUNGI PENUH (tidak disentuh).
   */
  public static async executeDailyMaintenance(
    ledger: UniversalLedger = globalLedger,
    _blobManager: BlobManager = globalBlobManager,
    pruningManager: PruningManager = globalPruningManager,
  ): Promise<StorageCleanupReport> {
    const report: StorageCleanupReport = {
      timestamp: new Date().toISOString(),
      prunedEventsCount: 0,
      prunedBlobsCount: 0,
      freedBytes: 0,
      skippedSystemCount: 0,
      skippedActiveCount: 0,
    };

    console.log(
      "[StorageHousekeeper] Memulai siklus pembersihan storage harian...",
    );

    try {
      // 1. Eksekusi Pruning Transaksi Jurnal Lama
      await pruningManager.runCleanup();

      // 2. Eksekusi Pembersihan Cache Blob Transaksi yang Sudah Yatim
      if (
        typeof caches !== "undefined" &&
        IO_CONFIG?.CACHE_NAMES?.TRANSACTION
      ) {
        const rxdb = ledger.getRxDatabase();
        if (rxdb && rxdb.collections.events) {
          const remainingEvents = await rxdb.collections.events.find().exec();
          const activeFileIds = new Set<string>();

          // Kumpulkan semua fileId / attachmentId yang masih terhubung ke event yang aktif di lokal
          remainingEvents.forEach((doc) => {
            const evt = doc.toJSON();
            if (evt.payload && typeof evt.payload === "object") {
              const p = evt.payload as Record<string, any>;
              if (p.fileId) activeFileIds.add(p.fileId);
              if (p.attachmentId) activeFileIds.add(p.attachmentId);
              if (Array.isArray(p.attachments)) {
                p.attachments.forEach((att: any) => {
                  if (att && att.id) activeFileIds.add(att.id);
                  if (att && att.fileId) activeFileIds.add(att.fileId);
                });
              }
            }
          });

          // Buka cache khusus TRANSAKSI (Cache SYSTEM tidak disentuh sama sekali)
          const transactionCache = await caches.open(
            IO_CONFIG.CACHE_NAMES.TRANSACTION,
          );
          const cachedRequests = await transactionCache.keys();

          for (const req of cachedRequests) {
            // URL format: ${serverUrl}/api/storage/download/${aggregateType}/${fileId}
            const urlParts = req.url.split("/");
            const fileIdInUrl = urlParts[urlParts.length - 1];

            // Jika file transaksi ini tidak lagi dirujuk oleh event lokal mana pun, hapus dari cache
            if (fileIdInUrl && !activeFileIds.has(fileIdInUrl)) {
              await transactionCache.delete(req);
              report.prunedBlobsCount++;
              console.log(
                `[StorageHousekeeper] Cache file transaksi lama dibersihkan: ${fileIdInUrl}`,
              );
            }
          }
        }
      }

      console.log(
        `[StorageHousekeeper] Siklus pembersihan selesai. ${report.prunedBlobsCount} cache blob transaksi lama dibersihkan.`,
      );
    } catch (error) {
      console.error(
        "[StorageHousekeeper] Gagal menjalankan pembersihan storage:",
        error,
      );
    }

    return report;
  }
}
