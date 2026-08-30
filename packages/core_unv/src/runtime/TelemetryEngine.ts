// File: packages/core_unv/src/runtime/TelemetryEngine.ts
import { ulid } from "ulidx";
import { getApiUrl } from "../config/env";

interface LocalMetric {
  id: string;
  name: string;
  duration: number;
  module: string;
  metadata: Record<string, any>;
  timestamp: number;
}

export class TelemetryEngine {
  private static buffer: LocalMetric[] = [];
  private static maxBufferSize = 50; // Kirim paksa jika isi buffer menyentuh 50 data
  private static flushIntervalMs = 5 * 60 * 1000; // Kirim otomatis berkala setiap 5 menit
  private static timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Menginisialisasi daemon pengiriman berkala telemetri
   */
  public static startDaemon() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
    console.log("[TELEMETRY ENGINE] Batch Telemetry Daemon aktif.");
  }

  /**
   * Mencatat dan mengukur performa eksekusi sebuah fungsi / render UI (Tracing)
   * @param name Nama metrik (contoh: "UI_RENDER_TIME", "DB_QUERY_SPEED")
   * @param contextModule Nama modul tempat fungsi dijalankan
   * @param executeFn Fungsi yang ingin diukur performanya
   * @param metadata Data tambahan (opsional)
   */
  public static async trace<T>(
    name: string,
    contextModule: string,
    executeFn: () => Promise<T> | T,
    metadata: Record<string, any> = {},
  ): Promise<T> {
    const startTime = performance.now();
    try {
      return await executeFn();
    } finally {
      const duration = Math.round(performance.now() - startTime);
      this.pushToBuffer({
        id: `METRIC_${ulid()}`,
        name,
        duration,
        module: contextModule,
        metadata,
        timestamp: Date.now(),
      });
    }
  }

  private static pushToBuffer(metric: LocalMetric) {
    this.buffer.push(metric);
    // Jika tumpukan buffer lokal penuh, langsung panggil proses flush paksa tanpa menunggu 5 menit
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Mengirim seluruh data buffer lokal ke server pusat
   */
  public static async flush() {
    if (this.buffer.length === 0) return;

    const metricsToSend = [...this.buffer];
    this.buffer = []; // Kosongkan segera untuk menghindari duplikasi data (Race condition)

    const deviceId = localStorage.getItem("__unv_nodeId") || "UNKNOWN";
    console.log(
      `[TELEMETRY ENGINE] Memulai pengiriman massal ${metricsToSend.length} data metrik ke server...`,
    );

    try {
      const res = await fetch(getApiUrl("/api/telemetry/metrics/batch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, metrics: metricsToSend }),
      });

      if (!res.ok) {
        throw new Error(`Server merespons dengan status ${res.status}`);
      }
      console.log(
        "[TELEMETRY ENGINE] Sukses menyinkronkan batch data telemetri ke server pusat.",
      );
    } catch (error) {
      console.error(
        "[TELEMETRY ENGINE] Gagal mengirim data metrik. Mengembalikan data ke buffer lokal...",
        error,
      );
      // Jika jaringan gagal, kembalikan metrik ke buffer agar dicoba lagi pada siklus berikutnya
      this.buffer = [...metricsToSend, ...this.buffer];
    }
  }
}
