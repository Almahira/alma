// File: packages/core_unv/src/ledger/InboxDaemon.ts
import { globalLedger } from "./UniversalLedger";
import { LedgerEventDoc } from "./schema";
import { Subscription } from "rxjs";

export class InboxDaemon {
  private isProcessing = false;
  private intervalId: any = null;
  private insertSub: Subscription | null = null;
  private isStarted = false;

  /**
   * MEMULAI DAEMON INBOX (Dipanggil saat boot di main.tsx)
   */
  public start(): void {
    if (this.isStarted) return;
    this.isStarted = true;
    console.log("[INBOX DAEMON] Daemon Inbox aktif & mendengarkan antrean...");

    // 1. Jalankan pemrosesan awal antrean
    this.processQueue();

    // 2. Pasang Listener Reaktif RxDB: Setiap ada event baru masuk Inbox, langsung proses
    const db = globalLedger.getRxDatabase();
    if (db && db.collections.inbox) {
      this.insertSub = db.collections.inbox.insert$.subscribe(() => {
        this.processQueue();
      });
    }

    // 3. Fallback Interval setiap 3 detik untuk memastikan tidak ada event yang tertinggal
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, 3000);
  }

  /**
   * MENGHENTIKAN DAEMON
   */
  public stop(): void {
    this.isStarted = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.insertSub) {
      this.insertSub.unsubscribe();
      this.insertSub = null;
    }
    console.log("[INBOX DAEMON] Daemon Inbox dinonaktifkan.");
  }

  /**
   * MEMPROSES SELURUH ANTREAN EVENT DI INBOX SECARA IDEMPOTEN & AMAN
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      const db = globalLedger.getRxDatabase();
      if (!db || !db.collections.inbox) return;

      // Kuras antrean inbox per batch (50 event sekaligus) hingga tuntas
      while (true) {
        const pendingEvents = await db.collections.inbox
          .find({
            selector: { status: "PENDING" },
            sort: [{ createdAt: "asc" }],
            limit: 50,
          })
          .exec();

        if (pendingEvents.length === 0) {
          break;
        }

        const rawDocs = pendingEvents.map((doc) => doc.toJSON());
        const eventPayloads = rawDocs.map((doc) => doc.eventPayload);

        try {
          // 1. Delegasikan pemrosesan batch ke Ledger Utama
          await globalLedger.commitInboxBatch(eventPayloads);

          // 2. Hapus seluruh dokumen inbox yang sudah selesai diproses secara borongan
          const docIds = pendingEvents.map(
            (d) => (d as any).primary || d.id || d.toJSON().id,
          );
          if (db.collections.inbox.bulkRemove) {
            await db.collections.inbox.bulkRemove(docIds);
          } else {
            for (const doc of pendingEvents) {
              await doc.remove().catch(() => {});
            }
          }
        } catch (error: any) {
          console.error(
            "[INBOX DAEMON] Gagal memproses batch inbox:",
            error?.message || error,
          );
          break;
        }
      }
    } catch (err: any) {
      console.error("[INBOX DAEMON] Error pada siklus antrean:", err);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const globalInboxDaemon = new InboxDaemon();
