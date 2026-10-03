// File: packages/core_unv/src/cqrs/EventBus.ts
import { globalLedger } from "../ledger/UniversalLedger";
import { globalRegistry } from "./UniversalRegistry";
import { SnapshotEngine } from "../ledger/SnapshotEngine";
import { RuntimeSession } from "../config/session";
import { LedgerEventDoc } from "../ledger/schema";

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
  private static rebuildPromise: Promise<void> | null = null;
  private static isRebuilding = false;
  private static queuedEvents = new Map<string, LedgerEventDoc>();
  private static eventsListenerAttached = false;

  public static async bootAndReplay(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      // 1. Inisialisasi Database RxDB
      await globalLedger.init();
      const rxdb = globalLedger.getRxDatabase();
      if (
        !this.eventsListenerAttached &&
        rxdb &&
        rxdb.collections.events
      ) {
        rxdb.collections.events.insert$.subscribe((changeEvent) => {
          const event = changeEvent.documentData;
          if (this.isRebuilding) {
            this.queuedEvents.set(event.id, event);
          } else {
            globalRegistry.processEvent(event);
            notifyStateUpdated();
          }
        });
        this.eventsListenerAttached = true;
      }
      // 2. Rehidrasi Pasti: Replay seluruh event lokal dari Sequence 1
      await this.rebuildState();
      // 3. Aktifkan EventBus setelah replay awal selesai.
      this.initialized = true;
      console.log("[EVENT BUS] Active & Listening for new transactions.");
    })();
    return this.initPromise;
  }

  /**
   * MEMBANGUN ULANG STATE DARI SEQUENCE 1 KE SELURUH PROYEKSI
   */
  public static async rebuildState(
    options: { persistSnapshot?: boolean } = {},
  ): Promise<void> {
    if (this.rebuildPromise) return this.rebuildPromise;
    const rebuildPromise = this.rebuildStateInternal(options);
    this.rebuildPromise = rebuildPromise;
    try {
      return await rebuildPromise;
    } finally {
      if (this.rebuildPromise === rebuildPromise) this.rebuildPromise = null;
    }
  }

  private static async rebuildStateInternal(
    options: { persistSnapshot?: boolean },
  ): Promise<void> {
    const rxdb = globalLedger.getRxDatabase();
    if (!rxdb || !rxdb.collections.events) return;

    this.isRebuilding = true;
    try {
      // 1. CEK APAKAH ADA FOTO SNAPSHOT TERAKHIR DI DATABASE LOKAL
      let startSeq = 0;
      let snapshotState: Record<string, any> | null = null;
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
            snapshotState =
              typeof snap.data === "string" ? JSON.parse(snap.data) : snap.data;
            startSeq = snap.lastSeq;
          }
        }
      }

      // 2. HANYA PUTAR EVENT YANG TERJADI SETELAH SNAPSHOT (DELTA EVENT)
      const querySelector = startSeq > 0 ? { seq: { $gt: startSeq } } : {};

      const deltaEvents = await rxdb.collections.events
        .find({
          selector: querySelector,
          sort: [{ seq: "asc" }],
        })
        .exec();

      globalRegistry.hardReset();
      if (snapshotState) globalRegistry.restoreAllStates(snapshotState);
      const replayedIds = new Set<string>();
      for (const doc of deltaEvents) {
        const event = doc.toJSON();
        globalRegistry.processEvent(event);
        replayedIds.add(event.id);
      }

      const applyQueuedEvents = () => {
        for (const [eventId, event] of this.queuedEvents) {
          if (!replayedIds.has(eventId)) {
            globalRegistry.processEvent(event);
            replayedIds.add(eventId);
          }
        }
        this.queuedEvents.clear();
      };
      applyQueuedEvents();

      console.log(
        `[EVENT BUS] Rehidrasi selesai. Snapshot Sequence: #${startSeq} + ${deltaEvents.length} delta event baru.`,
      );

      if (deltaEvents.length > 0 && options.persistSnapshot !== false) {
        await SnapshotEngine.takeSnapshot();
      }

      applyQueuedEvents();
      notifyStateUpdated();
    } finally {
      this.isRebuilding = false;
    }
  }

  /**
   * =========================================================================
   * BROADCAST RE-SYNC RESMI: PEMBERSIHAN BERSIH TOTAL & SNAPSHOT FISIK 1:1
   * =========================================================================
   * Dijalankan pada waktu non-operasional saat Admin Pusat memicu Broadcast Re-Sync.
   */
  public static async executeSafeLocalResync(): Promise<void> {
    console.log(
      "[RESYNC ENGINE] Memulai penyelarasan bersih total non-operasional dengan server...",
    );
    const rxdb = globalLedger.getRxDatabase();
    if (!rxdb) return;

    try {
      // Keep current local data intact unless the canonical server snapshot is available.
      const pendingOutbox = rxdb.collections.outbox
        ? await rxdb.collections.outbox
            .find({ selector: { status: { $in: ["PENDING", "SENT"] } } })
            .exec()
        : [];
      const pendingEventIds = new Set(
        pendingOutbox.map((doc) => doc.eventPayload.id),
      );

      const syncSucceeded = await globalLedger.syncInitial({
        recovery: true,
        exactCursor: true,
        requireSnapshot: true,
        resetChain: true,
      });
      if (!syncSucceeded) {
        throw new Error(
          "Snapshot server tidak tersedia; data lokal dipertahankan dan broadcast sync dibatalkan.",
        );
      }

      const snapshotDoc = await rxdb.collections.snapshots
        .findOne("GLOBAL_SNAPSHOT")
        .exec();
      if (!snapshotDoc) {
        throw new Error(
          "Snapshot fisik tidak ditemukan di penyimpanan lokal setelah sinkronisasi.",
        );
      }
      const snapshotSeq = snapshotDoc.lastSeq;

      // Remove committed journal rows represented by the snapshot; retain delta and unsent events.
      if (rxdb.collections.events) {
        const localEvents = await rxdb.collections.events.find().exec();
        for (const eventDoc of localEvents) {
          if (
            !pendingEventIds.has(eventDoc.id) &&
            eventDoc.seq <= snapshotSeq
          ) {
            await eventDoc.remove();
          }
        }
      }

      // AMBIL DAN SIMPAN STEMPEL EPOCH TERBARU DARI SERVER
      try {
        const { getApiUrl } = await import("../config/env");
        const epochRes = await fetch(
          getApiUrl("/api/system-health/sync-epoch"),
        );
        if (epochRes.ok) {
          const epochData = await epochRes.json();
          if (epochData.epoch) {
            localStorage.setItem("__unv_sync_epoch", String(epochData.epoch));
          }
        }
      } catch {}

      // PASTIKAN READ MODEL SUDAH SESUAI DENGAN SNAPSHOT + DELTA
      await this.rebuildState({ persistSnapshot: false });
      console.log(
        "[RESYNC ENGINE] SUKSES: Database lokal bersih 100% dan identik 1:1 dengan server pusat!",
      );
      notifyStateUpdated();

      // 7. PEMBERSIHAN SESI USER & RELOAD WAJIB KE HALAMAN LOGIN
      this.clearUserSession();
    } catch (error) {
      console.error("[RESYNC ENGINE] Gagal melakukan safe resync:", error);
      throw error;
    }
  }

  /**
   * =========================================================================
   * PEMBERSIHAN SESI USER TERARAH (TARGETED & NON-DESTRUCTIVE)
   * =========================================================================
   * Menghapus sesi login kasir/admin agar kembali bersih ke halaman login.
   * KETAT MELINDUNGI KREDENSIAL PERANGKAT (Mencegah terlempar ke Setup Wizard):
   *  - __unv_deviceToken      (Identitas mesin di server)
   *  - __unv_nodeId           (ID node perangkat unik)
   *  - __unv_secretKey        (Kunci privat kriptografi Ed25519)
   *  - __unv_license_tier     (Paket lisensi resmi)
   *  - __unv_license_token    (Token lisensi sah)
   *  - __unv_allowed_modules  (Daftar modul yang aktif)
   *  - __unv_companyId        (Perusahaan terdaftar)
   *  - __unv_regionId         (Wilayah terdaftar)
   *  - __unv_outletId         (Cabang terdaftar)
   *  - __unv_sync_epoch       (Stempel sinkronisasi server)
   */
  private static clearUserSession(): void {
    if (typeof window === "undefined") return;
    try {
      // 1. Hapus kredensial sesi user aktif
      localStorage.removeItem("__unv_activeUser");
      localStorage.removeItem("__unv_user_allowed_outlets");
      localStorage.removeItem("__unv_recent_logins");

      // 2. Bersihkan token sesi generik
      const GENERIC_SESSION_KEYS = [
        "token",
        "authToken",
        "accessToken",
        "refreshToken",
        "user",
        "userSession",
      ];
      GENERIC_SESSION_KEYS.forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });

      // 3. Segarkan cache RAM sesi
      RuntimeSession.refresh();
      console.log(
        "[RESYNC ENGINE] Sesi user dibersihkan. Memaksa reload ke halaman login...",
      );

      // 4. STANDAR: Reload wajib ke halaman login utama (/)
      if (window.location.pathname === "/") {
        window.location.reload();
      } else {
        window.location.href = "/";
      }
    } catch (e) {
      console.warn("[RESYNC] Gagal membersihkan sesi user:", e);
      window.location.reload();
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
        `[OTA SINKRON] Menerima instruksi reset masal non-operasional (Epoch: ${serverEpoch || "N/A"})...`,
      );

      // Simpan stempel epoch terlebih dahulu sebelum proses resync
      if (serverEpoch) {
        localStorage.setItem("__unv_sync_epoch", String(serverEpoch));
      }

      await EventBus.executeSafeLocalResync();
    } catch (err) {
      console.error("[OTA SINKRON ERROR]:", err);
    }
  });
}
