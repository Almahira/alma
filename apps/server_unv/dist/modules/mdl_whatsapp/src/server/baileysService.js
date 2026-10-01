// File: modules/mdl_whatsapp/src/server/baileysService.ts
import makeWASocketRaw, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers, downloadMediaMessage, extractMessageContent, getContentType, } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import pino from "pino";
const makeWASocket = makeWASocketRaw.default || makeWASocketRaw;
export class WhatsAppService {
    static instance;
    sock = null;
    io = null;
    status = "DISCONNECTED";
    qrCode = null;
    phone = null;
    authDir = path.join(process.cwd(), "uploads", "wa_auth");
    mediaDir = path.join(process.cwd(), "uploads", "wa_media");
    isConnecting = false;
    constructor() { }
    static getInstance() {
        if (!this.instance)
            this.instance = new WhatsAppService();
        return this.instance;
    }
    attachSocketIO(io) {
        this.io = io;
    }
    getStatus() {
        return {
            status: this.status,
            qrCode: this.qrCode,
            phoneNumber: this.phone,
        };
    }
    async initIfSessionExists() {
        const credsPath = path.join(this.authDir, "creds.json");
        if (fs.existsSync(credsPath)) {
            console.log("[WA] Sesi ditemukan. Menyambung otomatis...");
            await this.init();
        }
        else {
            this.status = "DISCONNECTED";
            this.broadcastStatus();
        }
    }
    async init() {
        if (this.isConnecting || this.status === "CONNECTED")
            return;
        this.isConnecting = true;
        if (!fs.existsSync(this.mediaDir)) {
            fs.mkdirSync(this.mediaDir, { recursive: true });
        }
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
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
                },
                syncFullHistory: false,
                markOnlineOnConnect: true,
            });
            this.sock.ev.on("creds.update", saveCreds);
            this.sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    this.qrCode = await QRCode.toDataURL(qr);
                    this.status = "SCAN_QR";
                    this.isConnecting = false;
                    console.log("[WA] QR Code siap di-scan.");
                    this.broadcastStatus();
                }
                if (connection === "close") {
                    this.isConnecting = false;
                    const code = lastDisconnect?.error?.output?.statusCode;
                    this.status = "DISCONNECTED";
                    this.qrCode = null;
                    this.broadcastStatus();
                    if (code === DisconnectReason.loggedOut || code === 401) {
                        // Bersihkan sesi auth & berkas media sementara di server
                        if (fs.existsSync(this.authDir))
                            fs.rmSync(this.authDir, { recursive: true, force: true });
                        if (fs.existsSync(this.mediaDir))
                            fs.rmSync(this.mediaDir, { recursive: true, force: true });
                        console.log("[WA] Device Logout / Putus Permanen. Berkas lokal server dibersihkan.");
                        // Beri tahu client agar membersihkan Local Storage
                        if (this.io) {
                            this.io.emit("WA_SESSION_LOGOUT", { reason: "LOGGED_OUT" });
                        }
                    }
                    else {
                        console.log(`[WA] Terputus sementara (Code: ${code}). Reconnecting...`);
                        setTimeout(() => this.init(), 3000);
                    }
                }
                else if (connection === "open") {
                    this.isConnecting = false;
                    this.status = "CONNECTED";
                    this.qrCode = null;
                    const id = this.sock.user?.id || "";
                    this.phone = id.split(":")[0] || id.split("@")[0];
                    console.log(`[WA] Terhubung ke: +${this.phone}`);
                    this.broadcastStatus();
                }
            });
            this.sock.ev.on("messages.upsert", async (m) => {
                if (m.type !== "notify" && m.type !== "append")
                    return;
                for (let idx = 0; idx < m.messages.length; idx++) {
                    const msg = m.messages[idx];
                    if (!msg.message || msg.key.remoteJid === "status@broadcast")
                        continue;
                    const rawContent = extractMessageContent(msg.message);
                    if (!rawContent)
                        continue;
                    const contentType = getContentType(rawContent);
                    const remoteJid = msg.key.remoteJid;
                    const fromMe = msg.key.fromMe || false;
                    const id = msg.key.id || `MSG_${Date.now()}_${idx}`;
                    let mediaType = "text";
                    let text = "";
                    let mediaUrl = null;
                    let mediaFileName = null;
                    let mediaMimeType = null;
                    if (contentType === "conversation") {
                        text = rawContent.conversation || "";
                    }
                    else if (contentType === "extendedTextMessage") {
                        text = rawContent.extendedTextMessage?.text || "";
                    }
                    else if (contentType === "imageMessage") {
                        mediaType = "image";
                        text = rawContent.imageMessage?.caption || "";
                        mediaMimeType = rawContent.imageMessage?.mimetype || "image/jpeg";
                    }
                    else if (contentType === "documentMessage") {
                        mediaType = "document";
                        text = rawContent.documentMessage?.caption || "";
                        mediaFileName = rawContent.documentMessage?.fileName || "dokumen";
                        mediaMimeType =
                            rawContent.documentMessage?.mimetype ||
                                "application/octet-stream";
                    }
                    else if (contentType === "stickerMessage") {
                        mediaType = "sticker";
                        mediaMimeType = "image/webp";
                    }
                    else {
                        // Audio, Video, dsb dilewati sesuai instruksi
                        continue;
                    }
                    // Unduh dan simpan media jika berupa image, sticker, atau document
                    if (mediaType !== "text") {
                        try {
                            const buffer = (await downloadMediaMessage(msg, "buffer", {}, {
                                logger: pino({ level: "silent" }),
                                reuploadRequest: this.sock?.updateMediaMessage,
                            }));
                            if (buffer) {
                                let ext = "bin";
                                if (mediaType === "image")
                                    ext = "jpg";
                                else if (mediaType === "sticker")
                                    ext = "webp";
                                else if (mediaType === "document") {
                                    ext = mediaFileName?.split(".").pop() || "pdf";
                                }
                                const filename = `${id}.${ext}`;
                                const savePath = path.join(this.mediaDir, filename);
                                fs.writeFileSync(savePath, buffer);
                                mediaUrl = `/api/whatsapp/media/${filename}`;
                            }
                        }
                        catch (dlErr) {
                            console.warn(`[WA MEDIA] Gagal mengunduh media ${id}:`, dlErr);
                        }
                    }
                    const baseTimestampMs = (msg.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000;
                    const preciseTimestamp = new Date(baseTimestampMs + idx).toISOString();
                    // Objek pesan sementara (tanpa INSERT database)
                    const messageData = {
                        id,
                        remoteJid,
                        senderJid: fromMe ? this.sock.user?.id || remoteJid : remoteJid,
                        senderName: fromMe ? "Saya" : msg.pushName || "Pengirim",
                        text,
                        fromMe,
                        mediaType,
                        mediaUrl,
                        mediaFileName,
                        mediaMimeType,
                        timestamp: preciseTimestamp,
                    };
                    // Broadcast realtime ke client via Socket.IO
                    if (this.io) {
                        this.io.emit("WA_NEW_MESSAGE", messageData);
                    }
                }
            });
        }
        catch (error) {
            this.isConnecting = false;
            console.error("[WA Init Fatal Error]:", error);
        }
    }
    async sendMessage(targetJid, text) {
        if (!this.sock || this.status !== "CONNECTED")
            throw new Error("WA Offline");
        const jid = targetJid.includes("@")
            ? targetJid
            : `${targetJid}@s.whatsapp.net`;
        const sent = await this.sock.sendMessage(jid, { text });
        return sent;
    }
    broadcastStatus() {
        if (this.io)
            this.io.emit("WA_CONNECTION_STATUS", this.getStatus());
    }
}
export const globalWhatsAppService = WhatsAppService.getInstance();
