// File: packages/core_unv/src/io/CircuitBreaker.ts

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount: number = 0;
  private lastFailureTime: number = 0;

  // Konfigurasi
  private readonly failureThreshold = 3; // Putus arus setelah 3x gagal berturut-turut
  private readonly resetTimeoutMs = 30000; // Istirahatkan Klien selama 30 detik jika server down

  /**
   * Membungkus eksekusi fungsi jaringan.
   */
  public async fire<T>(action: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        // Waktu istirahat selesai, coba ketuk pintu server lagi
        console.log(
          "[CIRCUIT BREAKER] Mencoba kembali terhubung ke server (HALF_OPEN)...",
        );
        this.state = "HALF_OPEN";
      } else {
        // Masih dalam masa istirahat, tolak langsung dari Klien
        throw new Error(
          "CIRCUIT_OPEN: Server sedang gangguan, Klien menghentikan pengiriman sementara.",
        );
      }
    }

    try {
      const result = await action();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordSuccess(): void {
    if (this.state !== "CLOSED") {
      console.log(
        "[CIRCUIT BREAKER] Koneksi server stabil. Arus kembali normal (CLOSED).",
      );
    }
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (
      this.state === "HALF_OPEN" ||
      this.failureCount >= this.failureThreshold
    ) {
      if (this.state !== "OPEN") {
        console.warn(
          `[CIRCUIT BREAKER] Deteksi ${this.failureCount}x kegagalan berturut-turut. Arus DIPUTUS (OPEN) selama ${this.resetTimeoutMs / 1000} detik!`,
        );
      }
      this.state = "OPEN";
    }
  }

  public getState(): CircuitState {
    return this.state;
  }
}

export const globalCircuitBreaker = new CircuitBreaker();
