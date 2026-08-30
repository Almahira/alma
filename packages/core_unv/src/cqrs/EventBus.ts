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
   * Menjamin 100% seluruh data modul terisi seketika tanpa jebakan snapshot kosong.
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
   * Sinkronisasi Ulang & Rebuild Manual
   */
  public static async forceFullRebuildAndResync(): Promise<void> {
    console.log("[EVENT BUS] Memulai Full Rebuild & Re-Sync State...");
    const rxdb = globalLedger.getRxDatabase();
    if (!rxdb) return;

    try {
      const snapDoc = await rxdb.collections.snapshots
        .findOne("GLOBAL_SNAPSHOT")
        .exec();
      if (snapDoc) await snapDoc.remove();
    } catch {}

    await globalLedger.syncInitial();
    await this.rebuildState();
  }
}
