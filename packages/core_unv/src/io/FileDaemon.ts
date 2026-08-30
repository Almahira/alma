// File: packages/core_unv/src/io/FileDaemon.ts
import { globalBlobManager } from "./BlobManager";
import { IO_CONFIG } from "./config";
import { globalCircuitBreaker } from "./CircuitBreaker";
import { getServerUrl } from "../config/env";

export class FileDaemon {
  private isProcessing = false;

  private getServerBaseUrl(): string {
    return getServerUrl();
  }

  public start() {
    setInterval(() => this.processQueue(), 5000);
    window.addEventListener("online", () => this.processQueue());
  }

  public async processQueue() {
    if (this.isProcessing || !navigator.onLine) return;
    this.isProcessing = true;
    try {
      if (globalCircuitBreaker.getState() === "OPEN") {
        try {
          await globalCircuitBreaker.fire(async () => {
            /* test */
          });
        } catch (e) {
          return;
        }
      }
      const pending = await globalBlobManager.getPendingUploads();
      if (pending.length === 0) return;
      console.log(
        `[FILE DAEMON] Menemukan ${pending.length} file di antrean lokal.`,
      );
      const concurrencyLimit = IO_CONFIG.NETWORK.CONCURRENT_UPLOADS;
      for (let i = 0; i < pending.length; i += concurrencyLimit) {
        const batch = pending.slice(i, i + concurrencyLimit);
        await Promise.all(batch.map((item) => this.uploadFile(item)));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async uploadFile(item: any) {
    try {
      const formData = new FormData();
      formData.append("fileId", item.fileId);
      formData.append("aggregateType", item.aggregateType);
      formData.append("aggregateId", item.aggregateId);
      formData.append("file", item.file);
      const res = await globalCircuitBreaker.fire(async () => {
        const response = await fetch(
          `${this.getServerBaseUrl()}/api/storage/upload`,
          {
            method: "POST",
            body: formData,
          },
        );
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        return response;
      });
      await globalBlobManager.removeQueuedFile(item.fileId);
      console.log(`[FILE DAEMON] File ${item.fileId} berhasil diunggah.`);
    } catch (error) {
      console.error(`[FILE DAEMON] Error upload ${item.fileId}:`, error);
    }
  }
}

export const globalFileDaemon = new FileDaemon();
