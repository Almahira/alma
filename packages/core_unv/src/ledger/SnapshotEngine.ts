// File: packages/core_unv/src/ledger/SnapshotEngine.ts
import { globalLedger } from "./UniversalLedger";
import { globalRegistry } from "../cqrs/UniversalRegistry";

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

      await rxdb.collections.snapshots.upsert({
        id: "GLOBAL_SNAPSHOT",
        lastSeq: currentSeq,
        data: currentState,
        updatedAt: Date.now(),
      });

      console.log(
        `[SNAPSHOT] Berhasil menyimpan potret pada Sequence ke-${currentSeq}.`,
      );
    } catch (error) {
      console.error("[SNAPSHOT] Gagal menyimpan potret:", error);
    }
  }
}
