// File: packages/core_unv/src/cqrs/EventBus.ts
import { globalLedger } from "../ledger/UniversalLedger";
import { globalRegistry } from "./UniversalRegistry";
import { SnapshotEngine } from "../ledger/SnapshotEngine";

export class EventBus {
  private static initialized = false;
  private static initPromise: Promise<void> | null = null;

  public static async bootAndReplay(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      // 1. Inisialisasi Database RxDB
      await globalLedger.init();
      // 2. Rehidrasi Pasti: Replay seluruh event lokal dari Sequence 1
      await this.rebuildState();
      // 3. Pasang listener reaktif untuk transaksi baru yang masuk
      const rxdb = globalLedger.getRxDatabase();
      if (rxdb && rxdb.collections.events) {
        rxdb.collections.events.insert$.subscribe((changeEvent) => {
          globalRegistry.processEvent(changeEvent.documentData);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("UNV_STATE_UPDATED"));
          }
        });
      }
      this.initialized = true;
      console.log("[EVENT BUS] Active & Listening for new transactions.");
    })();
    return this.initPromise;
  }

  /**
   * MEMBANGUN ULANG STATE DARI SEQUENCE 1 KE SELURUH PROYEKSI
   */
  public static async rebuildState(): Promise<void> {
    const rxdb = globalLedger.getRxDatabase();
    if (!rxdb || !rxdb.collections.events) return;
    console.log("[EVENT BUS] Memulai Rehidrasi State dari Sequence 1...");
    globalRegistry.hardReset();
    const allEvents = await rxdb.collections.events
      .find({ sort: [{ seq: "asc" }] })
      .exec();
    for (const doc of allEvents) {
      globalRegistry.processEvent(doc.toJSON());
    }
    console.log(
      `[EVENT BUS] Sukses merehidrasi ${allEvents.length} event ke dalam memori UI.`,
    );
    if (allEvents.length > 0) {
      await SnapshotEngine.takeSnapshot();
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("UNV_STATE_UPDATED"));
    }
  }

  /**
   * =========================================================================
   * PILAR 1 & 2: PEMBERSIHAN PINTAR & PENYELARASAN 100% IDENTIK DENGAN SERVER
   * =========================================================================
   * Aman: Menjaga token perangkat, kredensial login, dan lisensi.
   * Hanya membuang event lokal usang/korup lalu menarik data sah dari server.
   */
  public static async executeSafeLocalResync(): Promise<void> {
    console.log("[RESYNC ENGINE] Memulai penyelarasan bersih dengan server...");
    const rxdb = globalLedger.getRxDatabase();
    if (!rxdb) return;

    try {
      // 1. Bersihkan snapshots lokal usang
      if (rxdb.collections.snapshots) {
        const allSnaps = await rxdb.collections.snapshots.find().exec();
        for (const doc of allSnaps) {
          await doc.remove();
        }
      }

      // 2. Bersihkan event lokal usang
      if (rxdb.collections.events) {
        const allEvents = await rxdb.collections.events.find().exec();
        for (const doc of allEvents) {
          await doc.remove();
        }
      }

      // 3. Reset state memori UI
      globalRegistry.hardReset();

      // 4. Tarik data segar dari Server PostgreSQL (Master Data & Transaksi)
      await globalLedger.syncInitial();

      // 5. Putar ulang proyeksi dengan data server yang valid
      await this.rebuildState();

      console.log(
        "[RESYNC ENGINE] Penyelarasan sukses. Database lokal 100% sinkron!",
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("UNV_STATE_UPDATED"));
      }
    } catch (error) {
      console.error("[RESYNC ENGINE] Gagal melakukan safe resync:", error);
      throw error;
    }
  }

  public static async forceFullRebuildAndResync(): Promise<void> {
    await this.executeSafeLocalResync();
  }
}

// Pasang Listener Global untuk Sinyal OTA Remote
if (typeof window !== "undefined") {
  window.addEventListener("UNV_REMOTE_RESYNC", async (e: any) => {
    try {
      console.log("[OTA SINKRON] Menjalankan penyelarasan otomatis...");
      await EventBus.executeSafeLocalResync();
    } catch (err) {
      console.error("[OTA SINKRON ERROR]:", err);
    }
  });
}
