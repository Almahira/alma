// File: packages/core_unv/src/ledger/SnapshotEngine.ts
import { globalLedger } from "./UniversalLedger";
import { globalRegistry } from "../cqrs/UniversalRegistry";
import { getApiUrl } from "../config/env";

export class SnapshotEngine {
  /**
   * Mengambil snapshot kanonikal terbaru dari server pusat.
   * Dipanggil saat aplikasi pertama kali boot atau saat beralih dari mode offline ke online.
   */
  public static async syncFromServer(): Promise<boolean> {
    console.log(
      "[SNAPSHOT ENGINE] Memeriksa snapshot resmi di server pusat...",
    );
    try {
      const rxdb = globalLedger.getRxDatabase();
      if (!rxdb || !rxdb.collections.snapshots) return false;

      const companyId =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("__unv_companyId")
          : "";

      const res = await fetch(
        getApiUrl(
          `/api/system-health/snapshot/system/latest?companyId=${companyId || ""}`,
        ),
      ).catch(() => null);

      if (!res || !res.ok) {
        console.warn(
          "[SNAPSHOT ENGINE] Server belum memiliki snapshot atau koneksi offline. Melanjutkan sinkronisasi reguler.",
        );
        return false;
      }

      const snapJson = await res.json();
      if (!snapJson.hasSnapshot || !snapJson.snapshot) {
        console.log("[SNAPSHOT ENGINE] Tidak ada snapshot baru dari server.");
        return false;
      }

      const s = snapJson.snapshot;
      console.log(
        `[SNAPSHOT ENGINE] Menerima Snapshot Resmi Server (Sequence #${s.lastSeq}). Memulihkan memori lokal...`,
      );

      // Simpan ke RxDB lokal IndexedDB
      await rxdb.collections.snapshots.upsert({
        id: "GLOBAL_SNAPSHOT",
        lastSeq: s.lastSeq,
        data: s.data,
        updatedAt: s.updatedAt,
      });

      // Rehidrasi memori CQRS Read Model seketika
      if (s.data) {
        const payload =
          typeof s.data === "string" ? JSON.parse(s.data) : s.data;
        globalRegistry.restoreAllStates(payload);
      }

      console.log(
        `[SNAPSHOT ENGINE] Rehidrasi memori lokal sukses (Basis Sequence: #${s.lastSeq}).`,
      );
      return true;
    } catch (error) {
      console.error(
        "[SNAPSHOT ENGINE] Gagal memulihkan snapshot server:",
        error,
      );
      return false;
    }
  }

  /**
   * Menyimpan salinan kondisi memori lokal saat ini ke IndexedDB (cache lokal internal perangkat).
   */
  public static async takeSnapshot(): Promise<void> {
    try {
      const rxdb = globalLedger.getRxDatabase();
      if (!rxdb || !rxdb.collections.snapshots) return;

      const currentState = globalRegistry.getAllStates();
      const currentSeq = globalLedger.getCurrentSeq();

      if (currentSeq === 0) return;

      const now = Date.now();
      await rxdb.collections.snapshots.upsert({
        id: "GLOBAL_SNAPSHOT",
        lastSeq: currentSeq,
        data: currentState,
        updatedAt: now,
      });

      console.log(
        `[SNAPSHOT ENGINE] Cache lokal berhasil diperbarui pada Sequence ke-${currentSeq}.`,
      );
    } catch (error) {
      console.error("[SNAPSHOT ENGINE] Gagal memperbarui cache lokal:", error);
    }
  }
}
