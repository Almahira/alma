// File: apps/server_unv/src/worker/serverScheduler.ts
import fs from "fs";
import path from "path";
import { DistributedLock } from "../config/DistributedLock.js";

export interface ServerTask {
  id: string;
  name: string;
  intervalMs?: number;
  runDailyMidnight?: boolean;
  lastRunAt?: number;
  execute: () => Promise<void>;
  enabled: boolean;
  // Tambahan: ID Unik Kunci Sewa (Kosongkan jika task harus berjalan paralel di semua instance)
  lockId?: number;
}

export class ServerScheduler {
  private tasks: Map<string, ServerTask> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastCheckedDate: string = new Date().toISOString().slice(0, 10);

  public register(task: ServerTask): void {
    this.tasks.set(task.id, task);
    console.log(`[SERVER SCHEDULER] Task terdaftar: ${task.name} (${task.id})`);
  }

  public start(checkIntervalMs: number = 60000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(() => {
      this.tick();
    }, checkIntervalMs);

    console.log("[SERVER SCHEDULER] Daemon scheduler server aktif.");
    // Jalankan satu siklus saat boot
    this.tick();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("[SERVER SCHEDULER] Daemon scheduler server dimatikan.");
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    const currentDate = new Date().toISOString().slice(0, 10);
    const isDateChanged = currentDate !== this.lastCheckedDate;

    if (isDateChanged) {
      this.lastCheckedDate = currentDate;
      console.log(
        `[SERVER SCHEDULER] Terdeteksi pergantian hari (${currentDate}). Memicu tugas tengah malam.`,
      );
    }

    for (const [id, task] of this.tasks.entries()) {
      if (!task.enabled) continue;

      let shouldRun = false;

      if (
        task.intervalMs &&
        (!task.lastRunAt || now - task.lastRunAt >= task.intervalMs)
      ) {
        shouldRun = true;
      } else if (task.runDailyMidnight && isDateChanged) {
        shouldRun = true;
      }

      if (shouldRun) {
        task.lastRunAt = now; // Segera tandai waktu jalan agar tidak di-trigger ganda oleh siklus tick berikutnya

        // === IMPLEMENTASI DISTRIBUTED LOCK ===
        if (task.lockId) {
          const hasLock = await DistributedLock.acquire(task.lockId);
          if (!hasLock) {
            console.log(
              `[SERVER SCHEDULER] Task '${task.name}' dilewati. Instance server lain sedang mengeksekusinya.`,
            );
            continue; // Langsung lompat ke task berikutnya tanpa menjalankan execute()
          }
        }

        try {
          console.log(`[SERVER SCHEDULER] Menjalankan task: ${task.name}`);
          await task.execute();
          console.log(`[SERVER SCHEDULER] Task selesai: ${task.name}`);
        } catch (error) {
          console.error(
            `[SERVER SCHEDULER] Gagal menjalankan task ${task.name}:`,
            error,
          );
        } finally {
          // === PASTIKAN KUNCI DILEPAS APAPUN YANG TERJADI (SUKSES/ERROR) ===
          if (task.lockId) {
            await DistributedLock.release(task.lockId);
          }
        }
      }
    }
  }
}

export const globalServerScheduler = new ServerScheduler();

/**
 * Pendaftaran tugas-tugas default pemeliharaan server
 */
export function setupDefaultServerTasks(
  uploadsDir: string = path.join(process.cwd(), "uploads"),
): void {
  // 1. Pembersihan File Sementara / Upload Terputus yang Berumur > 24 Jam
  globalServerScheduler.register({
    id: "clean-temp-uploads",
    name: "Clean Temporary & Stale Uploads",
    runDailyMidnight: true,
    enabled: true,
    lockId: 1001, // <--- KUNCI ID 1001: Hanya 1 server yang boleh melakukan hapus file
    execute: async () => {
      if (!fs.existsSync(uploadsDir)) return;
      const files = fs.readdirSync(uploadsDir);
      const now = Date.now();
      const maxAgeMs = 24 * 60 * 60 * 1000; // 24 jam

      let cleanedCount = 0;
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (file.startsWith("temp_") && now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
            cleanedCount++;
          }
        } catch (err) {
          console.error(
            `[SERVER SCHEDULER] Gagal memeriksa file ${file}:`,
            err,
          );
        }
      }
      if (cleanedCount > 0) {
        console.log(
          `[SERVER SCHEDULER] Berhasil menghapus ${cleanedCount} file sementara yang kedaluwarsa.`,
        );
      }
    },
  });

  // 2. Health & Heartbeat Log Berkala (Setiap 30 Menit)
  globalServerScheduler.register({
    id: "server-heartbeat",
    name: "Server Heartbeat & Memory Health",
    intervalMs: 30 * 60 * 1000,
    enabled: true,
    // TIDAK ADA lockId: Karena ini mencetak RAM process.memoryUsage(),
    // semua instance server di klaster wajib mencetak ini di log terminalnya masing-masing.
    execute: async () => {
      const memoryUsage = process.memoryUsage();
      const heapUsedMb = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
      const rssMb = (memoryUsage.rss / 1024 / 1024).toFixed(2);
      console.log(
        `[SERVER HEALTH] Uptime: ${Math.floor(process.uptime())}s | Heap: ${heapUsedMb}MB | RSS: ${rssMb}MB`,
      );
    },
  });
}
