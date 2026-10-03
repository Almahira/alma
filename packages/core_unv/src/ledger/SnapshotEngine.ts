// File: packages/core_unv/src/ledger/SnapshotEngine.ts
import { globalLedger } from "./UniversalLedger";
import { globalRegistry } from "../cqrs/UniversalRegistry";
import { getApiUrl } from "../config/env";
import { notifyStateUpdated } from "../cqrs/EventBus";

export class SnapshotEngine {
  /**
   * Mengambil snapshot kanonikal lengkap dari server pusat (Instant Hydration).
   * Murni membaca tabel fisik yang telah dimaterialisasi oleh server.
   */
  public static async syncFromServer(): Promise<boolean> {
    console.log(
      "[SNAPSHOT ENGINE] Memeriksa snapshot fisik resmi di server pusat...",
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
        { cache: "no-store" },
      ).catch(() => null);

      if (!res || !res.ok) {
        console.warn(
          "[SNAPSHOT ENGINE] Gagal menghubungi server snapshot. Melanjutkan mode offline/lokal.",
        );
        return false;
      }

      const snapJson = await res.json();
      if (!snapJson.hasSnapshot || !snapJson.snapshot) {
        console.log(
          "[SNAPSHOT ENGINE] Belum ada snapshot data aktif dari server.",
        );
        return false;
      }

      const s = snapJson.snapshot;
      console.log(
        `[SNAPSHOT ENGINE] Menerima Snapshot Fisik Server (Sequence #${s.lastSeq}). Memulihkan memori lokal...`,
      );

      // 1. Simpan salinan ke RxDB lokal IndexedDB
      await rxdb.collections.snapshots.upsert({
        id: "GLOBAL_SNAPSHOT",
        lastSeq: s.lastSeq,
        data: s.data,
        updatedAt: s.updatedAt,
      });
      globalLedger.setSnapshotBaseSequence(s.lastSeq);

      if (s.updatedAt) {
        const snapshotCursor = String(new Date(s.updatedAt).getTime());
        localStorage.setItem("__unv_cursor_system", snapshotCursor);
        localStorage.setItem("__unv_cursor_tx", snapshotCursor);
      }

      // 2. Rehidrasi memori CQRS Read Model seketika
      if (s.data) {
        const payload =
          typeof s.data === "string" ? JSON.parse(s.data) : s.data;
        globalRegistry.restoreAllStates(payload);

        // 3. Seeding versi agregat ke UniversalLedger agar client mengenali versi terkini
        globalLedger.seedAggregateVersions(payload);
      }

      // 4. Picu re-render UI secara reaktif
      notifyStateUpdated();

      console.log(
        `[SNAPSHOT ENGINE] Rehidrasi memori lokal sukses 1:1 dengan server (Basis Sequence: #${s.lastSeq}).`,
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
   * Menarik snapshot khusus untuk 1 modul bisnis (Sangat cepat < 5ms).
   * Contoh: SnapshotEngine.syncModuleFromServer("item")
   */
  public static async syncModuleFromServer(
    moduleName: string,
  ): Promise<boolean> {
    try {
      const companyId =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("__unv_companyId")
          : "";

      if (!companyId) return false;

      const normalized = moduleName.toLowerCase().replace(/^mdl_/, "");
      const res = await fetch(
        getApiUrl(
          `/api/system-health/snapshot/module/${normalized}?companyId=${companyId}`,
        ),
        { cache: "no-store" },
      ).catch(() => null);

      if (!res || !res.ok) return false;

      const result = await res.json();
      if (result.status !== "SUCCESS" || !result.data) return false;

      const aggType = result.module; // misal: ITEM_DOMAIN
      const handler = (globalRegistry as any).handlers?.get(aggType);
      if (handler) {
        handler.restoreState(result.data);
      }

      globalLedger.seedAggregateVersions(result.data);

      notifyStateUpdated();
      console.log(
        `[SNAPSHOT ENGINE] Modul '${normalized}' berhasil disinkronkan secara modular.`,
      );
      return true;
    } catch (error) {
      console.error(
        `[SNAPSHOT ENGINE] Gagal sinkronisasi modul ${moduleName}:`,
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
