// File: packages/core_unv/src/cqrs/EventBus.ts
import { globalLedger } from "../ledger/UniversalLedger";
import { globalRegistry } from "./UniversalRegistry";
import { SnapshotEngine } from "../ledger/SnapshotEngine";
import { RuntimeSession } from "../config/session";

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
    if (deltaEvents.length > 0) {
      await SnapshotEngine.takeSnapshot();
    }

    notifyStateUpdated();
  }

  /**
   * =========================================================================
   * PILAR 1 & 2: PEMBERSIHAN PINTAR & PENYELARASAN 100% IDENTIK DENGAN SERVER
   * =========================================================================
   * Aman: Menjaga identitas perangkat, token lisensi, dan konfigurasi mesin.
   * Hanya membuang event lokal usang lalu menarik data sah dari server.
   */
  public static async executeSafeLocalResync(): Promise<void> {
    console.log(
      "[RESYNC ENGINE] Memulai penyelarasan bersih total dengan server...",
    );
    const rxdb = globalLedger.getRxDatabase();
    if (!rxdb) return;
    try {
      // 1. Bersihkan antrean Inbox & Outbox lama secara instan (1 batch transaction)
      if (rxdb.collections.inbox) {
        await rxdb.collections.inbox.find().remove();
      }
      if (rxdb.collections.outbox) {
        await rxdb.collections.outbox.find().remove();
      }

      // 2. Bersihkan snapshots & events lokal usang secara instan
      if (rxdb.collections.snapshots) {
        await rxdb.collections.snapshots.find().remove();
      }
      if (rxdb.collections.events) {
        await rxdb.collections.events.find().remove();
      }

      // 3. KUNCI ANTI-KORUP: Reset memori sequence & hash chain di RAM
      globalLedger.resetMemoryChain();
      localStorage.removeItem("__unv_cursor_system");
      localStorage.removeItem("__unv_cursor_tx");

      // 4. Perbarui stempel epoch lokal agar tidak memicu reload ganda saat boot
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

      // 5. Kosongkan state tampilan UI
      globalRegistry.hardReset();

      // 6. Tarik data segar dari Server (Master Data & Transaksi)
      await globalLedger.syncInitial();

      // 7. Putar ulang proyeksi dari sequence 1 yang sah
      await this.rebuildState();

      console.log(
        "[RESYNC ENGINE] Penyelarasan sukses 100%. Database lokal identik dengan server!",
      );
      notifyStateUpdated();

      // 8. PEMBERSIHAN SESI USER & LEMPAR KE HALAMAN LOGIN
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
   * Menghapus sesi user aktif agar aplikasi kembali ke halaman login.
   * Tetap MELINDUNGI:
   *  - __unv_deviceToken      (Identitas mesin di server)
   *  - __unv_nodeId           (ID node perangkat)
   *  - __unv_secretKey        (Kunci privat kriptografi Ed25519)
   *  - __unv_license_tier     (Paket lisensi)
   *  - __unv_license_token    (Kunci lisensi sah Ed25519)
   *  - __unv_allowed_modules  (Daftar modul yang diaktifkan)
   *  - __unv_companyId/regionId/outletId (Hierarki spasial mesin)
   */
  private static clearUserSession(): void {
    if (typeof window === "undefined") return;
    try {
      // 1. Hapus kredensial sesi user spesifik ALMA
      localStorage.removeItem("__unv_activeUser");
      localStorage.removeItem("__unv_user_allowed_outlets");
      localStorage.removeItem("__unv_recent_logins");

      // 2. Bersihkan token generik dari localStorage & sessionStorage
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
        "[RESYNC ENGINE] Sesi user dibersihkan. Memaksa kembali ke halaman login...",
      );

      // 4. Arahkan URL ke rute utama dan pastikan aplikasi reload bersih
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
        `[OTA SINKRON] Menerima instruksi reset masal seketika (Epoch: ${serverEpoch || "N/A"})...`,
      );

      // Simpan stempel epoch TERLEBIH DAHULU sebelum resync & reload
      // agar saat reload tidak terjadi resync ganda
      if (serverEpoch) {
        localStorage.setItem("__unv_sync_epoch", String(serverEpoch));
      }

      await EventBus.executeSafeLocalResync();
    } catch (err) {
      console.error("[OTA SINKRON ERROR]:", err);
    }
  });
}
