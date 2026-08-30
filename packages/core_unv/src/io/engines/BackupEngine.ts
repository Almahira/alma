// File: packages/core_unv/src/io/engines/BackupEngine.ts
import * as fileSaver from "file-saver";
const saveAs = fileSaver.saveAs || (fileSaver as any).default || fileSaver;
import { globalLedger } from "../../ledger/UniversalLedger";

export class BackupEngine {
  /**
   * Menarik seluruh data dari Ledger Lokal (Events & Outbox) menjadi 1 file .bak
   */
  public static async exportDatabase(
    filename: string = `Backup_ALMA_${Date.now()}.bak`,
  ): Promise<void> {
    const rxdb = globalLedger.getRxDatabase();
    if (!rxdb) throw new Error("Database belum siap.");

    const dumpData: Record<string, any[]> = {};

    // Ambil semua collection yang ada (events, outbox, sync_logs)
    for (const [name, collection] of Object.entries(rxdb.collections)) {
      const docs = await collection.find().exec();
      dumpData[name] = docs.map((d) => d.toJSON());
    }

    const jsonString = JSON.stringify(dumpData);
    const blob = new Blob([jsonString], { type: "application/json" });
    saveAs(blob, filename);
  }

  /**
   * Membaca file .bak, menghapus database lokal lama, dan memasukkan data baru
   */
  public static async restoreDatabase(file: File): Promise<void> {
    const rxdb = globalLedger.getRxDatabase();
    if (!rxdb) throw new Error("Database belum siap.");

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const dumpData = JSON.parse(content);

          for (const [name, collection] of Object.entries(rxdb.collections)) {
            if (dumpData[name] && Array.isArray(dumpData[name])) {
              // 1. Bersihkan tabel lokal
              const allDocs = await collection.find().exec();
              for (const doc of allDocs) {
                await doc.remove();
              }

              // 2. Suntik data baru (Bulk Upsert untuk performa)
              await collection.bulkUpsert(dumpData[name]);
            }
          }
          resolve();
        } catch (error) {
          reject(new Error("File backup korup atau format tidak sesuai."));
        }
      };

      reader.onerror = () => reject(new Error("Gagal membaca file backup."));
      reader.readAsText(file);
    });
  }
}
