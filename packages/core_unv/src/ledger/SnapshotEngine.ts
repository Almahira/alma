// File: packages/core_unv/src/ledger/SnapshotEngine.ts
import { globalLedger } from "./UniversalLedger";
import { globalRegistry } from "../cqrs/UniversalRegistry";

export class SnapshotEngine {
  public static async takeSnapshot(): Promise<void> {
    console.log("[SNAPSHOT] Mengambil potret memori lokal (Read Model)...");
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

      // Simpan potret HANYA di database lokal browser perangkat ini
      // Mencegah kontaminasi snapshot antar-cabang di server pusat
      await rxdb.collections.snapshots.upsert(snapshotPayload);
      console.log(
        `[SNAPSHOT] Berhasil menyimpan potret lokal pada Sequence ke-${currentSeq}.`,
      );
    } catch (error) {
      console.error("[SNAPSHOT] Gagal menyimpan potret lokal:", error);
    }
  }
}
