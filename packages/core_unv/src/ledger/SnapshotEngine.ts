// File: packages/core_unv/src/ledger/SnapshotEngine.ts
import { globalLedger } from "./UniversalLedger";
import { globalRegistry } from "../cqrs/UniversalRegistry";
import { getApiUrl } from "../config/env";

export class SnapshotEngine {
  public static async takeSnapshot(): Promise<void> {
    console.log("[SNAPSHOT] Mengambil potret memori (Read Model) saat ini...");
    try {
      const rxdb = globalLedger.getRxDatabase();
      if (!rxdb || !rxdb.collections.snapshots) return;

      const currentState = globalRegistry.getAllStates();
      const currentSeq = globalLedger.getCurrentSeq();

      if (currentSeq === 0) {
        console.log("[SNAPSHOT] Diabaikan. Belum ada event yang diproses.");
        return;
      }

      const now = Date.now();
      const snapshotPayload = {
        id: "GLOBAL_SNAPSHOT",
        lastSeq: currentSeq,
        data: currentState,
        updatedAt: now,
      };

      // 1. Simpan potret di database lokal browser
      await rxdb.collections.snapshots.upsert(snapshotPayload);
      console.log(
        `[SNAPSHOT] Berhasil menyimpan potret lokal pada Sequence ke-${currentSeq}.`,
      );

      // 2. Titipkan salinan ke Server secara senyap di latar belakang (Fire-and-Forget)
      if (typeof navigator !== "undefined" && navigator.onLine) {
        const companyId = localStorage.getItem("__unv_companyId") || null;
        fetch(getApiUrl("/api/system-health/snapshot/system/save"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            lastSeq: currentSeq,
            data: currentState,
            updatedAt: now,
          }),
        }).catch(() => {}); // Abaikan jika server sibuk, tidak mengganggu klien
      }
    } catch (error) {
      console.error("[SNAPSHOT] Gagal menyimpan potret:", error);
    }
  }
}
