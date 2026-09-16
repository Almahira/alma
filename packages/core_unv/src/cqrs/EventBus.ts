// File: packages/core_unv/src/cqrs/EventBus.ts
import { globalLedger } from "../ledger/UniversalLedger";
import { globalRegistry } from "./UniversalRegistry";
import { SnapshotEngine } from "../ledger/SnapshotEngine";

// Microtask Debouncer: Menggabungkan puluhan event sinkronisasi menjadi 1 sinyal UI render
let isNotifyScheduled = false;

export function notifyStateUpdated(): void {
  if (typeof window === "undefined") return;
  if (isNotifyScheduled) return;
  isNotifyScheduled = true;
  queueMicrotask(() => {
    isNotifyScheduled = false;
    window.dispatchEvent(new Event("UNV_STATE_UPDATED"));
  });
}

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
          notifyStateUpdated();
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

    globalRegistry.hardReset();

    // 1. CEK APAKAH ADA FOTO SNAPSHOT TERAKHIR DI DATABASE LOKAL
    let startSeq = 0;
    if (rxdb.collections.snapshots) {
      const snapDoc = await rxdb.collections.snapshots
        .findOne("GLOBAL_SNAPSHOT")
        .exec();

      if (snapDoc) {
        const snap = snapDoc.toJSON();
        if (snap.data && snap.lastSeq > 0) {
          console.log(
            `[EVENT BUS] Snapshot ditemukan (Sequence #${snap.lastSeq}). Memulihkan memori secara instan...`,
          );
          globalRegistry.restoreAllStates(snap.data);
          startSeq = snap.lastSeq;
        }
      }
    }

    // 2. HANYA PUTAR EVENT YANG TERJADI SETELAH SNAPSHOT (DELTA EVENT)
    // Jika startSeq = 0 (belum ada snapshot), sistem memutar dari seq 1
    const querySelector = startSeq > 0 ? { seq: { $gt: startSeq } } : {};

    const deltaEvents = await rxdb.collections.events
      .find({
        selector: querySelector,
        sort: [{ seq: "asc" }],
      })
      .exec();

    for (const doc of deltaEvents) {
      globalRegistry.processEvent(doc.toJSON());
    }

    console.log(
      `[EVENT BUS] Rehidrasi selesai. Snapshot Sequence: #${startSeq} + ${deltaEvents.length} delta event baru.`,
    );

    // 3. Ambil potret baru jika ada event delta yang baru diproses
    if (deltaEvents.length > 0 || startSeq === 0) {
      await SnapshotEngine.takeSnapshot();
    }

    notifyStateUpdated();
  }

  /**
   * =========================================================================
   * PILAR 1 & 2: PEMBERSIHAN PINTAR & PENYELARASAN 100% IDENTIK DENGAN SERVER
   * =========================================================================
   * Aman: Menjaga token perangkat, kredensial login, dan lisensi.
   * Hanya membuang event lokal usang/korup lalu menarik data sah dari server.
   */
  public static async executeSafeLocalResync(): Promise<void> {
    console.log(
      "[RESYNC ENGINE] Memulai penyelarasan bersih total dengan server...",
    );
    const rxdb = globalLedger.getRxDatabase();
    if (!rxdb) return;
    try {
      // 1. Bersihkan antrean Inbox lama agar tidak ada event pending yang tabrakan
      if (rxdb.collections.inbox) {
        const allInbox = await rxdb.collections.inbox.find().exec();
        for (const doc of allInbox) {
          await doc.remove();
        }
      }

      // 2. Bersihkan snapshots lokal usang
      if (rxdb.collections.snapshots) {
        const allSnaps = await rxdb.collections.snapshots.find().exec();
        for (const doc of allSnaps) {
          await doc.remove();
        }
      }

      // 3. Bersihkan event lokal lama
      if (rxdb.collections.events) {
        const allEvents = await rxdb.collections.events.find().exec();
        for (const doc of allEvents) {
          await doc.remove();
        }
      }

      // 4. KUNCI ANTI-KORUP: Reset memori internal sequence & hash di RAM
      globalLedger.resetMemoryChain();

      // 5. Kosongkan state tampilan UI
      globalRegistry.hardReset();

      // 6. Tarik data segar dari Server (Master Data & Transaksi)
      await globalLedger.syncInitial();

      // 7. Putar ulang proyeksi dari sequence 1 yang sah dan urut
      await this.rebuildState();

      console.log(
        "[RESYNC ENGINE] Penyelarasan sukses 100%. Database lokal identik dengan server!",
      );
      notifyStateUpdated();
    } catch (error) {
      console.error("[RESYNC ENGINE] Gagal melakukan safe resync:", error);
      throw error;
    }
  }

  public static async forceFullRebuildAndResync(): Promise<void> {
    await this.executeSafeLocalResync();
  }
}

// Pasang Listener Global untuk Sinyal OTA Remote (Penyelarasan Real-Time)
if (typeof window !== "undefined") {
  window.addEventListener("UNV_REMOTE_RESYNC", async (e: any) => {
    try {
      const serverEpoch = e.detail?.epoch;
      console.log(
        `[OTA SINKRON] Menerima instruksi reset masal seketika (Epoch: ${serverEpoch || "N/A"})...`,
      );
      await EventBus.executeSafeLocalResync();

      // Simpan stempel epoch baru ke saku perangkat
      if (serverEpoch) {
        localStorage.setItem("__unv_sync_epoch", String(serverEpoch));
      }
    } catch (err) {
      console.error("[OTA SINKRON ERROR]:", err);
    }
  });
}
