// File: packages/core_unv/src/ledger/OutboxDaemon.ts
import { Socket } from "socket.io-client";
import { globalLedger } from "./UniversalLedger";
import { ulid } from "ulidx";
import { globalCircuitBreaker } from "../io/CircuitBreaker";

/**
 * UTILITY: Penerjemah Bahasa Mesin ke Bahasa Manusia
 */
function formatHumanReadableLog(
  type: string,
  payload: any,
  actor: string,
  status: string,
  serverMessage?: string,
): { title: string; message: string } {
  // Proteksi null-safety jika payload kosong / undefined
  const p = payload && typeof payload === "object" ? payload : {};

  // 1. Memisahkan Entitas dan Aksi (Misal: OUTLET_CREATED -> Entitas: OUTLET, Aksi: CREATED)
  const parts = type.split("_");
  const entityRaw = parts[0] || "DATA";
  const actionRaw = parts.slice(1).join("_");

  // Memperbaiki kapitalisasi Entitas (OUTLET -> Outlet)
  const entity =
    entityRaw.charAt(0).toUpperCase() + entityRaw.slice(1).toLowerCase();

  // 2. Mencari identitas/nama dari data yang diedit
  const itemName =
    p.name ||
    p.code ||
    p.documentName ||
    `ID: ${p.id?.substring(0, 6) || "Data"}`;

  // 3. Menangani Respon Konflik/Merge dari Server
  if (status === "MERGED") {
    return {
      title: `Merge Otomatis: ${entity} "${itemName}"`,
      message: `Perubahan Anda berhasil digabungkan dengan perubahan dari pengguna lain secara otomatis.`,
    };
  }
  if (status === "REJECTED" || status === "FAILED") {
    return {
      title: `Gagal Menyimpan: ${entity} "${itemName}"`,
      message: `Data ditolak oleh server. Alasan: ${serverMessage || "Terjadi tabrakan data atau kendala di server"}.`,
    };
  }

  // 4. Membuang ID sistem agar pesan UI terlihat bersih
  const ignoredKeys = ["id", "companyId", "regionId", "documentId", "fileObj"];

  // 5. Mengumpulkan daftar perubahan (Delta / Payload)
  const changedFields = Object.keys(p)
    .filter(
      (key) =>
        !ignoredKeys.includes(key) && p[key] !== undefined && p[key] !== "",
    )
    .map((key) => `${key}: ${p[key]}`)
    .join(", ");

  // 6. Menyusun Kalimat Akhir Berdasarkan Aksi
  let title = "";
  let message = "";

  if (actionRaw === "CREATED") {
    title = `Pembuatan ${entity} Baru`;
    message = `"${itemName}" berhasil ditambahkan oleh ${actor}. Detail: ${changedFields || "Tidak ada detail"}.`;
  } else if (actionRaw === "UPDATED") {
    title = `Pembaruan Data ${entity}`;
    message = `"${itemName}" diupdate oleh ${actor}. Perubahan: ${changedFields || "Tidak ada perubahan spesifik"}.`;
  } else if (actionRaw === "ARCHIVED") {
    title = `Pengarsipan ${entity}`;
    message = `"${itemName}" telah dihapus/diarsipkan oleh ${actor}.`;
  } else if (actionRaw === "RESTORED") {
    title = `Pemulihan ${entity}`;
    message = `"${itemName}" berhasil diaktifkan kembali oleh ${actor}.`;
  } else if (actionRaw === "ATTACHED") {
    title = `Penambahan Dokumen Baru`;
    message = `File "${itemName}" berhasil diunggah dan ditambahkan oleh ${actor}.`;
  } else {
    title = `Aktivitas: ${entity} ${actionRaw}`;
    message = `Aksi dilakukan oleh ${actor}. Detail: ${changedFields}`;
  }

  return { title, message };
}

export class OutboxDaemon {
  private isProcessing = false;
  private socket: Socket | null = null;

  public attachSocket(socket: Socket) {
    this.socket = socket;

    // Trigger saat socket berhasil tersambung kembali
    this.socket.on("connect", () => {
      console.log("[OUTBOX] Socket terhubung. Memulai pemrosesan antrean...");
      this.processQueue();
    });

    // Trigger saat browser mendeteksi koneksi internet fisik aktif kembali
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        console.log("[OUTBOX] Jaringan browser kembali online.");
        this.processQueue();
      });
    }

    // Jalankan sweep berkala setiap 3 detik sebagai jaring pengaman
    setInterval(() => {
      this.processQueue();
    }, 3000);
  }

  /**
   * Draining Queue Loop: Terus memproses antrean sampai benar-benar KOSONG
   * Dilengkapi proteksi Head-of-Line Blocking, Circuit Breaker, dan Timeout yang stabil.
   */
  public async processQueue() {
    if (this.isProcessing) return;

    // 1. Validasi Konektivitas Nyata Fisik Browser & Socket
    const isBrowserOnline =
      typeof navigator === "undefined" || navigator.onLine;
    const isSocketConnected = Boolean(this.socket && this.socket.connected);

    if (!isBrowserOnline || !isSocketConnected) {
      return;
    }

    // 2. Validasi Status Circuit Breaker (Jika sedang cooldown, tahan pengiriman)
    if (globalCircuitBreaker.getState() === "OPEN") {
      return;
    }

    this.isProcessing = true;

    try {
      const rxdb = globalLedger.getRxDatabase();
      if (!rxdb || !rxdb.collections.outbox) return;

      outer: while (true) {
        if (
          (typeof navigator !== "undefined" && !navigator.onLine) ||
          !this.socket?.connected ||
          globalCircuitBreaker.getState() === "OPEN"
        ) {
          break outer;
        }

        // Ambil dokumen berstatus PENDING terurut dari yang tertua
        const pendingEvents = await rxdb.collections.outbox
          .find({
            selector: { status: "PENDING" },
            sort: [{ createdAt: "asc" }],
            limit: 10,
          })
          .exec();

        // Jika antrean sudah bersih, hentikan loop
        if (pendingEvents.length === 0) {
          break;
        }

        for (const doc of pendingEvents) {
          const docData = doc.toJSON();
          const retryCount = docData.retryCount || 0;

          // PROTEKSI HEAD-OF-LINE BLOCKING:
          // Jika event gagal lebih dari 10 kali berturut-turut, tandai FAILED agar tidak menghalangi antrean lain
          if (retryCount >= 10) {
            console.error(
              `[OUTBOX DEAD-LETTER] Event ${docData.id} melebihi batas coba ulang (10x). Memindahkan ke status FAILED.`,
            );
            await doc.patch({ status: "FAILED" });
            continue;
          }

          const payload = docData.eventPayload;
          const actorUserId = payload.dddMetadata?.actor?.userId || "Sistem";

          try {
            const response: any = await globalCircuitBreaker.fire(async () => {
              if (!this.socket || !this.socket.connected) {
                throw new Error("Socket terputus saat transmisi.");
              }
              // Timeout 10 detik (stabil untuk jaringan seluler cabang)
              return await this.socket
                .timeout(10000)
                .emitWithAck("SYNC_UP_EVENTS", payload);
            });

            // Handle jika perangkat dinonaktifkan
            if (response.error === "DEVICE_DEACTIVATED") {
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("UNV_SECURITY_ALERT", {
                    detail: {
                      title: "PERANGKAT TIDAK AKTIF",
                      message:
                        "Perangkat ini telah dinonaktifkan atau digantikan oleh perangkat lain.",
                    },
                  }),
                );
              }
              return;
            }

            const { title, message } = formatHumanReadableLog(
              payload.type,
              payload.payload,
              actorUserId,
              response.status,
              response.message,
            );

            // Jika sukses atau di-merge: buang dari antrean outbox
            if (response.status === "SUCCESS" || response.status === "MERGED") {
              await rxdb.collections.sync_logs.insert({
                id: ulid(),
                title,
                message,
                status: response.status === "MERGED" ? "WARNING" : "SUCCESS",
                isRead: false,
                createdAt: Date.now(),
              });
              await doc.remove();
            } else if (response.status === "REJECTED") {
              await rxdb.collections.sync_logs.insert({
                id: ulid(),
                title,
                message,
                status: "FAILED",
                isRead: false,
                createdAt: Date.now(),
              });
              await doc.remove();
            } else if (response.status === "FAILED") {
              // Jika server mengembalikan FAILED, lempar error agar memicu backoff retry
              throw new Error(
                response.message || "Server menolak memproses antrean.",
              );
            }
          } catch (error) {
            console.warn(
              `[OUTBOX] Gagal mengirim event ${docData.id} (Percobaan ke-${retryCount + 1}):`,
              error,
            );
            await doc.patch({
              retryCount: retryCount + 1,
            });

            // Hentikan batch saat jaringan putus / socket timeout, jeda sejenak
            break outer;
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const globalOutbox = new OutboxDaemon();
