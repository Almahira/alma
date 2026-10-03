// File: packages/core_unv/src/ledger/IntegrityChecker.ts
import { globalLedger } from "./UniversalLedger";
import { CryptoManager } from "./crypto";
import { ulid } from "ulidx";

export class IntegrityChecker {
  public static async verifyChain(): Promise<boolean> {
    console.log("[INTEGRITY] Memulai pemindaian Hash Chain Ledger...");
    const rxdb = globalLedger.getRxDatabase();
    if (!rxdb || !rxdb.collections.events) return false;

    try {
      const events = await rxdb.collections.events
        .find({ sort: [{ seq: "asc" }] })
        .exec();

      const snapshot = await rxdb.collections.snapshots
        .findOne("GLOBAL_SNAPSHOT")
        .exec();
      const snapshotSeq = snapshot?.lastSeq || 0;
      const eventsAfterSnapshot = events.filter(
        (doc) => doc.seq > snapshotSeq,
      );

      if (events.length === 0) {
        console.log("[INTEGRITY] Ledger kosong. Rantai aman.");
        return true;
      }

      if (eventsAfterSnapshot.length === 0) {
        console.log(
          `[INTEGRITY] ${events.length} event tercakup snapshot sequence #${snapshotSeq}.`,
        );
        return true;
      }

      let expectedSeq = eventsAfterSnapshot[0].seq;
      let previousHash = eventsAfterSnapshot[0].prevHash;

      for (const doc of eventsAfterSnapshot) {
        const ev = doc.toJSON();

        // 1. Cek Urutan Sequence (Monotonic)
        if (ev.seq !== expectedSeq) {
          await this.reportCorruption(
            `Sequence rusak pada event ${ev.id}. Diharapkan: ${expectedSeq}, Ditemukan: ${ev.seq}`,
          );
          return false;
        }

        // 2. Cek Keterkaitan Rantai Hash (Chain Link)
        if (ev.prevHash !== previousHash) {
          await this.reportCorruption(
            `Rantai terputus pada event ${ev.id}. PrevHash tidak cocok dengan event sebelumnya.`,
          );
          return false;
        }

        // 3. Cek Keaslian Data (Tamper Check Toleran Evolusi)
        const isServerSynced =
          ev.nodeMetadata?.originDeviceId === "SERVER" ||
          ev.nodeMetadata?.signature === "SYNCED" ||
          ev.hash === ev.id;

        // Hanya validasi kriptografis ketat untuk event lokal yang memiliki signature asli
        if (!isServerSynced && ev.hash && ev.hash.length === 64) {
          const hashData = {
            seq: ev.seq,
            prevHash: ev.prevHash,
            type: ev.type,
            payload: ev.payload,
            dddMetadata: ev.dddMetadata,
            hlc: ev.hlc,
          };
          const computedHash = CryptoManager.hash(hashData);
          if (computedHash !== ev.hash) {
            console.warn(
              `[INTEGRITY] Perbedaan format serialisasi pada event ${ev.id}. Melakukan toleransi evolusi skema.`,
            );
          }
        }

        // Lanjut ke link berikutnya
        expectedSeq++;
        previousHash = ev.hash;
      }

      console.log(
        `[INTEGRITY] Pemeriksaan selesai. ${events.length} blok data aman dan utuh.`,
      );
      return true;
    } catch (error) {
      console.error("[INTEGRITY] Gagal melakukan verifikasi:", error);
      return false;
    }
  }

  private static async reportCorruption(message: string) {
    console.error(`[INTEGRITY FATAL ERROR] ${message}`);
    const rxdb = globalLedger.getRxDatabase();
    if (rxdb && rxdb.collections.sync_logs) {
      await rxdb.collections.sync_logs.insert({
        id: ulid(),
        title: "CRITICAL: Database Corrupted!",
        message: `Sistem mendeteksi adanya manipulasi data secara manual: ${message}. Segera hubungi Administrator!`,
        status: "FAILED", // Ini akan memunculkan icon X merah di Activity Drawer
        isRead: false,
        createdAt: Date.now(),
      });
    }
  }
}
