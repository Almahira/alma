// File: packages/core_unv/src/io/CircuitBreaker.ts

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount: number = 0;
  private lastFailureTime: number = 0;

  // Konfigurasi Exponential Backoff & Anti-Thundering Herd
  private readonly failureThreshold = 3;
  private readonly baseTimeoutMs = 5000; // Mulai jeda dari 5 detik
  private readonly maxTimeoutMs = 60000; // Maksimal jeda 60 detik
  private currentTimeoutMs = 5000;

  /**
   * Membungkus eksekusi fungsi jaringan.
   */
  public async fire<T>(action: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.lastFailureTime > this.currentTimeoutMs) {
        console.log(
          "[CIRCUIT BREAKER] Masa jeda selesai. Mencoba kembali terhubung ke server (HALF_OPEN)...",
        );
        this.state = "HALF_OPEN";
      } else {
        const remainingSec = Math.ceil(
          (this.currentTimeoutMs - (now - this.lastFailureTime)) / 1000,
        );
        throw new Error(
          `CIRCUIT_OPEN: Server sedang istirahat (${remainingSec}s tersisa). Klien menunda pengiriman sementara.`,
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
    this.currentTimeoutMs = this.baseTimeoutMs;
    this.state = "CLOSED";
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    // Hitung jeda eksponensial (5s -> 10s -> 20s -> 40s -> maks 60s) + jitter acak 0-3s
    const exponent = Math.max(0, this.failureCount - this.failureThreshold);
    const exponentialDelay = Math.min(
      this.maxTimeoutMs,
      this.baseTimeoutMs * Math.pow(2, exponent),
    );
    const randomJitter = Math.floor(Math.random() * 3000);
    this.currentTimeoutMs = exponentialDelay + randomJitter;

    if (
      this.state === "HALF_OPEN" ||
      this.failureCount >= this.failureThreshold
    ) {
      if (this.state !== "OPEN") {
        console.warn(
          `[CIRCUIT BREAKER] Deteksi ${this.failureCount}x kegagalan berturut-turut. Arus DIPUTUS (OPEN) selama ${Math.round(this.currentTimeoutMs / 1000)}s (Exponential Backoff + Jitter).`,
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
