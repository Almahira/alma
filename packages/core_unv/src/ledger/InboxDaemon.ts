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

      const pendingEvents = await db.collections.inbox
        .find({
          selector: { status: "PENDING" },
          sort: [{ createdAt: "asc" }],
        })
        .exec();

      for (const doc of pendingEvents) {
        const rawDoc = doc.toJSON();
        const eventData = rawDoc.eventPayload as unknown as LedgerEventDoc;

        try {
          // 1. Delegasikan pemrosesan rantai event ke Ledger Utama
          await globalLedger.commitInboxEvent(eventData);

          // 2. Hapus dokumen dari Inbox secara aman (Conflict-Safe)
          try {
            if (doc.incrementalRemove) {
              await doc.incrementalRemove();
            } else {
              await doc.remove();
            }
          } catch (delErr: any) {
            const freshDoc = await db.collections.inbox
              .findOne(rawDoc.id)
              .exec();
            if (freshDoc) {
              await freshDoc.remove();
            }
          }
        } catch (error: any) {
          console.error(
            `[INBOX] Gagal memproses event ${eventData.id || "Unknown"}:`,
            error?.message || error,
          );
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
