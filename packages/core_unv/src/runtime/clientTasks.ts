// File: packages/core_unv/src/runtime/clientTasks.ts
import { globalScheduler } from "./Scheduler";
import { IntegrityChecker } from "../ledger/IntegrityChecker";
import { StorageHousekeeper } from "./StorageHousekeeper";
import { SnapshotEngine } from "../ledger/SnapshotEngine";

export function setupClientTasks() {
  // 1. Task: Integrity Check (Berjalan setiap jam)
  globalScheduler.register({
    id: "ledger-integrity-check",
    name: "Ledger Hash Chain Validation",
    type: "interval",
    intervalMs: 60 * 60 * 1000, // 1 Jam
    enabled: true,
    task: async () => {
      await IntegrityChecker.verifyChain();
    },
  });

  // 2. Task: Storage Housekeeper & Pruning (Berjalan setiap pergantian hari)
  globalScheduler.register({
    id: "storage-housekeeper",
    name: "Storage Housekeeper & Data Pruning",
    type: "date_change", // Otomatis trigger saat hari berganti
    enabled: true,
    task: async () => {
      await StorageHousekeeper.executeDailyMaintenance();
    },
  });

  globalScheduler.register({
    id: "take-memory-snapshot",
    name: "Take UI State Snapshot",
    type: "interval",
    intervalMs: 15 * 60 * 1000,
    enabled: true,
    task: async () => {
      await SnapshotEngine.takeSnapshot();
    },
  });

  // Mulai scheduler (Mengecek jadwal setiap 1 menit)
  // Catatan: Karena task interval baru didaftarkan, ia akan berjalan 1x secara instan saat boot.
  globalScheduler.start(60000);
}
