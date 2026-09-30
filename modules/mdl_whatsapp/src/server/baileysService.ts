import makeWASocketRaw, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import pino from "pino";
import { Server } from "socket.io";
import { db } from "../../../../apps/server_unv/src/config/db.js";
import { waMessages } from "./schema.js";

// ESM / CJS Guard
const makeWASocket: any = (makeWASocketRaw as any).default || makeWASocketRaw;

export class WhatsAppService {
  private static instance: WhatsAppService;
  private sock: any = null;
  private io: Server | null = null;
  private status: "DISCONNECTED" | "SCAN_QR" | "CONNECTED" = "DISCONNECTED";
  private qrCode: string | null = null;
  private phone: string | null = null;
  private authDir = path.join(process.cwd(), "uploads", "wa_auth");
  private isConnecting = false; // Penjaga agar tidak dobel inisialisasi

  private constructor() {}

  public static getInstance(): WhatsAppService {
    if (!this.instance) this.instance = new WhatsAppService();
    return this.instance;
  }

  public attachSocketIO(io: Server) {
    this.io = io;
  }

  public getStatus() {
    return {
      status: this.status,
      qrCode: this.qrCode,
      phoneNumber: this.phone,
    };
  }

  public async initIfSessionExists() {
    const credsPath = path.join(this.authDir, "creds.json");
    if (fs.existsSync(credsPath)) {
      console.log("[WA] Sesi ditemukan. Menyambung otomatis...");
      await this.init();
    } else {
      this.status = "DISCONNECTED";
      this.broadcastStatus();
    }
  }

  public async init() {
    // Mencegah penumpukan request jika sedang proses konek
    if (this.isConnecting || this.status === "CONNECTED") return;
    this.isConnecting = true;

    try {
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 0],
      }));
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      this.sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: Browsers.macOS("Chrome"),
        auth: {
          creds: state.creds,
          // Ini WAJIB untuk versi Baileys terbaru agar koneksi stabil
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: "silent" }),
          ),
        },
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      this.sock.ev.on("creds.update", saveCreds);

      // 1. HANDLER KONEKSI
      this.sock.ev.on("connection.update", async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCode = await QRCode.toDataURL(qr);
          this.status = "SCAN_QR";
          this.isConnecting = false; // Buka kunci setelah QR siap
          console.log("[WA] QR Code siap di-scan.");
          this.broadcastStatus();
        }

        if (connection === "close") {
          this.isConnecting = false;
          const code = (lastDisconnect?.error as any)?.output?.statusCode;
          this.status = "DISCONNECTED";
          this.qrCode = null;
          this.broadcastStatus();

          if (code === DisconnectReason.loggedOut || code === 401) {
            fs.rmSync(this.authDir, { recursive: true, force: true });
            console.log("[WA] Device Logout. Hapus sesi.");
          } else {
            console.log(`[WA] Terputus (Code: ${code}). Reconnecting...`);
            setTimeout(() => this.init(), 3000);
          }
        } else if (connection === "open") {
          this.isConnecting = false;
          this.status = "CONNECTED";
          this.qrCode = null;
          const id = this.sock.user?.id || "";
          this.phone = id.split(":")[0] || id.split("@")[0];
          console.log(`[WA] Terhubung ke: +${this.phone}`);
          this.broadcastStatus();
        }
      });

      // 2. HANDLER PESAN MASUK
      this.sock.ev.on("messages.upsert", async (m: any) => {
        if (m.type !== "notify" && m.type !== "append") return;

        for (const msg of m.messages) {
          if (!msg.message || msg.key.remoteJid === "status@broadcast")
            continue;

          const remoteJid = msg.key.remoteJid;
          const fromMe = msg.key.fromMe;
          const id = msg.key.id;

          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";
          if (!text) continue;

          const senderName = msg.pushName || "User";

          const messageData = {
            id: id,
            companyId: "DEFAULT",
            remoteJid: remoteJid,
            senderJid: fromMe ? this.sock.user?.id || remoteJid : remoteJid,
            senderName: fromMe ? "Saya" : senderName,
            text: text,
            fromMe: fromMe,
            timestamp: new Date(
              (msg.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000,
            ),
          };

          try {
            await db
              .insert(waMessages)
              .values(messageData)
              .onConflictDoNothing();
            if (this.io) {
              this.io.emit("WA_NEW_MESSAGE", messageData);
            }
          } catch (err) {
            console.error("[WA DB Error]:", err);
          }
        }
      });
    } catch (error) {
      this.isConnecting = false;
      console.error("[WA Init Fatal Error]:", error);
    }
  }

  public async sendMessage(targetJid: string, text: string) {
    if (!this.sock || this.status !== "CONNECTED")
      throw new Error("WA Offline");
    const jid = targetJid.includes("@")
      ? targetJid
      : `${targetJid}@s.whatsapp.net`;
    const sent = await this.sock.sendMessage(jid, { text });
    return sent;
  }

  private broadcastStatus() {
    if (this.io) this.io.emit("WA_CONNECTION_STATUS", this.getStatus());
  }
}

export const globalWhatsAppService = WhatsAppService.getInstance();
