// File: apps/server_unv/src/worker/serverScheduler.ts
import fs from "fs";
import path from "path";
import { generateServerCanonicalSnapshot } from "../routes/systemHealth.js";
import { DistributedLock } from "../config/DistributedLock.js";

export interface ServerTask {
  id: string;
  name: string;
  intervalMs?: number;
  runDailyMidnight?: boolean;
  lastRunAt?: number;
  execute: () => Promise<void>;
  enabled: boolean;
  /**
   * ID Unik Kunci Sewa (Distributed Lock).
   * Kosongkan jika task harus berjalan paralel di semua instance server.
   */
  lockId?: number;
  /** Status internal: mencegah task yang sama tumpang-tindih. */
  isRunning?: boolean;
}

export class ServerScheduler {
  private tasks: Map<string, ServerTask> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  // Menggunakan zona waktu Indonesia (WIB) agar pergantian hari presisi pukul 00:00 WIB
  private lastCheckedDate: string = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });

  /**
   * Mendaftarkan task berkala / harian baru.
   * `id` bersifat opsional — jika tidak diisi, akan memakai `name`.
   */
  public register(task: Omit<ServerTask, "isRunning"> & { id?: string }): void {
    const id = task.id ?? task.name;
    this.tasks.set(id, {
      ...task,
      id,
      lastRunAt: task.lastRunAt ?? 0,
      isRunning: false,
    });
    console.log(
      `[SERVER SCHEDULER] Task terdaftar: ${task.name} (${id})` +
        (task.intervalMs
          ? ` — Interval: ${Math.round(task.intervalMs / 1000)} detik.`
          : "") +
        (task.runDailyMidnight
          ? " — Mode: Harian tengah malam (00:00 WIB)."
          : ""),
    );
  }

  /** Alias kompatibilitas untuk versi lama (`registerTask`). */
  public registerTask(task: {
    name: string;
    intervalMs?: number;
    handler?: () => Promise<void>;
    execute?: () => Promise<void>;
    runDailyMidnight?: boolean;
    enabled?: boolean;
    lockId?: number;
    id?: string;
  }): void {
    const execute = task.execute ?? task.handler;
    if (!execute) {
      throw new Error(
        `[SERVER SCHEDULER] Task '${task.name}' tidak memiliki handler/execute.`,
      );
    }
    this.register({
      id: task.id ?? task.name,
      name: task.name,
      intervalMs: task.intervalMs,
      runDailyMidnight: task.runDailyMidnight,
      enabled: task.enabled ?? true,
      lockId: task.lockId,
      execute,
    });
  }

  /**
   * Menjalankan daemon scheduler.
   * @param checkIntervalMs Interval pengecekan loop (default 30 detik untuk akurasi tinggi).
   */
  public start(checkIntervalMs: number = 30000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(
      "[SERVER SCHEDULER] Engine scheduler aktif. Menjalankan pengawasan berkala...",
    );

    this.timer = setInterval(() => {
      void this.tick();
    }, checkIntervalMs);

    // Jalankan siklus perdana saat server boot (Cold-start hydration)
    void this.tick();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log("[SERVER SCHEDULER] Engine scheduler dimatikan.");
  }

  /**
   * Siklus utama scheduler: mengecek interval & pergantian hari (WIB),
   * lalu mengeksekusi task yang sudah waktunya berjalan.
   */
  private async tick(): Promise<void> {
    const now = Date.now();
    const currentDate = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Jakarta",
    });
    const isDateChanged = currentDate !== this.lastCheckedDate;

    if (isDateChanged) {
      this.lastCheckedDate = currentDate;
      console.log(
        `[SERVER SCHEDULER] Terdeteksi pergantian hari (${currentDate} WIB). Memicu tugas harian tengah malam.`,
      );
    }

    for (const task of this.tasks.values()) {
      if (!task.enabled) continue;
      if (task.isRunning) continue; // Hindari tumpang-tindih eksekusi

      let shouldRun = false;

      if (
        task.intervalMs &&
        (!task.lastRunAt || now - task.lastRunAt >= task.intervalMs)
      ) {
        shouldRun = true;
      } else if (task.runDailyMidnight && isDateChanged) {
        shouldRun = true;
      }

      if (!shouldRun) continue;

      // Tandai segera agar tidak di-trigger ganda oleh tick berikutnya
      task.lastRunAt = now;
      task.isRunning = true;

      // === IMPLEMENTASI DISTRIBUTED LOCK ===
      if (task.lockId && typeof DistributedLock?.acquire === "function") {
        const hasLock = await DistributedLock.acquire(task.lockId);
        if (!hasLock) {
          console.log(
            `[SERVER SCHEDULER] Task '${task.name}' dilewati. Instance server lain sedang mengeksekusinya.`,
          );
          task.isRunning = false;
          continue;
        }
      }

      try {
        console.log(`[SERVER SCHEDULER] Menjalankan task: '${task.name}'...`);
        await task.execute();
        console.log(`[SERVER SCHEDULER] Selesai task: '${task.name}'.`);
      } catch (error) {
        console.error(
          `[SERVER SCHEDULER] Gagal menjalankan task '${task.name}':`,
          error,
        );
      } finally {
        // === PASTIKAN KUNCI DILEPAS APAPUN YANG TERJADI ===
        if (task.lockId && typeof DistributedLock?.release === "function") {
          try {
            await DistributedLock.release(task.lockId);
          } catch (releaseErr) {
            console.error(
              `[SERVER SCHEDULER] Gagal melepas lock '${task.name}':`,
              releaseErr,
            );
          }
        }
        task.isRunning = false;
      }
    }
  }

  /**
   * Memicu eksekusi langsung task tertentu tanpa menunggu interval.
   */
  public async runTaskNow(nameOrId: string): Promise<void> {
    const task =
      this.tasks.get(nameOrId) ??
      [...this.tasks.values()].find((t) => t.name === nameOrId);

    if (!task) {
      console.warn(`[SERVER SCHEDULER] Task '${nameOrId}' tidak ditemukan.`);
      return;
    }
    if (task.isRunning) {
      console.warn(`[SERVER SCHEDULER] Task '${task.name}' sedang berjalan.`);
      return;
    }

    task.isRunning = true;
    task.lastRunAt = Date.now();

    if (task.lockId && typeof DistributedLock?.acquire === "function") {
      const hasLock = await DistributedLock.acquire(task.lockId);
      if (!hasLock) {
        console.warn(
          `[SERVER SCHEDULER] Task '${task.name}' dilewati (lock dipegang instance lain).`,
        );
        task.isRunning = false;
        return;
      }
    }

    try {
      console.log(
        `[SERVER SCHEDULER] Menjalankan task manual: '${task.name}'...`,
      );
      await task.execute();
      console.log(`[SERVER SCHEDULER] Selesai task manual: '${task.name}'.`);
    } catch (error) {
      console.error(
        `[SERVER SCHEDULER] Gagal menjalankan task manual '${task.name}':`,
        error,
      );
    } finally {
      if (task.lockId && typeof DistributedLock?.release === "function") {
        try {
          await DistributedLock.release(task.lockId);
        } catch (releaseErr) {
          console.error(
            `[SERVER SCHEDULER] Gagal melepas lock '${task.name}':`,
            releaseErr,
          );
        }
      }
      task.isRunning = false;
    }
  }
}

export const globalServerScheduler = new ServerScheduler();

/**
 * Pendaftaran seluruh task default server.
 */
export function setupDefaultServerTasks(
  uploadsDir: string = path.join(process.cwd(), "uploads"),
): void {
  // =========================================================================
  // TASK 1: PEMBARUAN SNAPSHOT RESMI SERVER SETIAP 5 MENIT SEKALI
  // =========================================================================
  globalServerScheduler.register({
    id: "canonical-snapshot",
    name: "5-Minute Canonical Snapshot Update",
    intervalMs: 5 * 60 * 1000, // 5 Menit (300.000 ms)
    enabled: true,
    lockId: 1002, // Mengunci agar hanya 1 instance server yang memproses snapshot
    execute: async () => {
      await generateServerCanonicalSnapshot();
    },
  });

  // =========================================================================
  // TASK 2: PEMBERSIHAN FILE SEMENTARA / UPLOAD TERPUTUS (>24 JAM)
  // =========================================================================
  globalServerScheduler.register({
    id: "clean-temp-uploads",
    name: "Clean Temporary & Stale Uploads",
    runDailyMidnight: true,
    enabled: true,
    lockId: 1001, // Hanya 1 server yang melakukan pembersihan file
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

  // =========================================================================
  // TASK 3: HEALTH & HEARTBEAT LOG BERKALA (SETIAP 30 MENIT)
  // =========================================================================
  globalServerScheduler.register({
    id: "server-heartbeat",
    name: "Server Heartbeat & Memory Health",
    intervalMs: 30 * 60 * 1000,
    enabled: true,
    // Tanpa lockId: setiap instance server lokal mencetak status RAM-nya masing-masing
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
