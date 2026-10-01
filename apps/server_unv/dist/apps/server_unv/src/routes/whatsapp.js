// File: apps/server_unv/src/routes/whatsappRoutes.ts
import express from "express";
import path from "path";
import fs from "fs";
import { globalWhatsAppService } from "../../../../modules/mdl_whatsapp/src/server/baileysService.js";
import { db } from "../config/db.js";
import { desc, eq, inArray, and, lt } from "drizzle-orm";
import { ulid } from "ulidx";
import { waMessages, waItemAliases, waOutletAliases, } from "../../../../packages/db-schema/index.js";
const router = express.Router();
router.get("/status", (req, res) => {
    res.json(globalWhatsAppService.getStatus());
});
router.post("/connect", async (req, res) => {
    await globalWhatsAppService.init();
    res.json({ message: "Connecting..." });
});
// AMBIL DAFTAR INBOX (Daftar orang yang pernah chat)
router.get("/inbox", async (req, res) => {
    try {
        const msgs = await db
            .select({
            jid: waMessages.remoteJid,
            name: waMessages.senderName,
            timestamp: waMessages.timestamp,
        })
            .from(waMessages)
            .orderBy(desc(waMessages.timestamp))
            .limit(1000);
        const inboxMap = new Map();
        for (const msg of msgs) {
            if (!inboxMap.has(msg.jid)) {
                inboxMap.set(msg.jid, {
                    jid: msg.jid,
                    name: msg.name && msg.name !== "Pengirim"
                        ? msg.name
                        : msg.jid.split("@")[0],
                    lastActivity: msg.timestamp,
                });
            }
        }
        res.json(Array.from(inboxMap.values()));
    }
    catch (err) {
        console.error("[WA INBOX ERROR]:", err.message);
        res.status(500).json({ error: err.message });
    }
});
// AMBIL HISTORY CHAT DENGAN PAGINASI (CURSOR / INFINITE SCROLL)
// PENGURUTAN DETERMINISTIK 3 TINGKAT: timestamp -> createdAt -> id
router.get("/messages", async (req, res) => {
    const { jid, before, limit = "30" } = req.query;
    if (!jid)
        return res.status(400).json({ error: "jid dibutuhkan" });
    try {
        const limitNum = Math.min(Math.max(parseInt(limit) || 30, 1), 100);
        const conditions = [eq(waMessages.remoteJid, jid)];
        if (before) {
            const beforeDate = new Date(before);
            if (!isNaN(beforeDate.getTime())) {
                conditions.push(lt(waMessages.timestamp, beforeDate));
            }
        }
        const msgs = await db
            .select()
            .from(waMessages)
            .where(and(...conditions))
            .orderBy(desc(waMessages.timestamp), desc(waMessages.createdAt), desc(waMessages.id))
            .limit(limitNum);
        res.json(msgs.reverse());
    }
    catch (err) {
        console.error("[WA MESSAGES ERROR]:", err.message);
        res.status(500).json({ error: err.message });
    }
});
// KIRIM PESAN DARI UI
router.post("/send", async (req, res) => {
    try {
        const { targetJid, text } = req.body;
        await globalWhatsAppService.sendMessage(targetJid, text);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// SERVE MEDIA LOKAL SEMENTARA
router.get("/media/:filename", (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(process.cwd(), "uploads", "wa_media", filename);
    if (!fs.existsSync(filePath)) {
        return res
            .status(404)
            .json({ error: "Media telah kedaluwarsa atau tidak ditemukan" });
    }
    res.sendFile(filePath);
});
// TANDAI PESAN TELAH DIPROSES MENJADI PO (Menghindari Duplikasi PO)
router.post("/mark-parsed", async (req, res) => {
    const { messageIds, receivingId } = req.body;
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        return res
            .status(400)
            .json({ error: "messageIds tidak valid atau kosong" });
    }
    try {
        await db
            .update(waMessages)
            .set({
            isPoParsed: true,
            receivingId: receivingId || null,
        })
            .where(inArray(waMessages.id, messageIds));
        res.json({ success: true });
    }
    catch (err) {
        console.error("[WA MARK PARSED ERROR]:", err.message);
        res.status(500).json({ error: err.message });
    }
});
// ALIAS ENDPOINT: /messages/link-receiving (kompatibel dengan WhatsAppPage)
router.post("/messages/link-receiving", async (req, res) => {
    const { messageIds, receivingId } = req.body;
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        return res
            .status(400)
            .json({ error: "messageIds tidak valid atau kosong" });
    }
    try {
        await db
            .update(waMessages)
            .set({
            isPoParsed: true,
            receivingId: receivingId || null,
        })
            .where(inArray(waMessages.id, messageIds));
        res.json({ success: true });
    }
    catch (err) {
        console.error("[WA LINK RECEIVING ERROR]:", err.message);
        res.status(500).json({ error: err.message });
    }
});
// BERSIHKAN CHAT (Hapus seluruh riwayat kontak ATAU pesan tertentu)
router.post("/messages/clear", async (req, res) => {
    try {
        const { jid, messageIds, clearAll } = req.body;
        if (clearAll && jid) {
            await db.delete(waMessages).where(eq(waMessages.remoteJid, String(jid)));
            return res.json({
                success: true,
                message: "Seluruh chat berhasil dibersihkan.",
            });
        }
        if (Array.isArray(messageIds) && messageIds.length > 0) {
            await db.delete(waMessages).where(inArray(waMessages.id, messageIds));
            return res.json({
                success: true,
                message: `${messageIds.length} pesan berhasil dihapus.`,
            });
        }
        return res
            .status(400)
            .json({ error: "Parameter jid atau messageIds wajib diisi." });
    }
    catch (err) {
        console.error("[WA CLEAR MESSAGES ERROR]:", err.message);
        res.status(500).json({ error: err.message });
    }
});
// AMBIL DAFTAR KAMUS ALIAS (ITEM & OUTLET) UNTUK HOLDING
router.get("/aliases", async (req, res) => {
    const { companyId = "DEFAULT" } = req.query;
    try {
        const itemAliases = await db
            .select()
            .from(waItemAliases)
            .where(eq(waItemAliases.companyId, companyId));
        const outletAliases = await db
            .select()
            .from(waOutletAliases)
            .where(eq(waOutletAliases.companyId, companyId));
        res.json({
            itemAliases,
            outletAliases,
        });
    }
    catch (err) {
        console.error("[WA ALIASES GET ERROR]:", err.message);
        res.status(500).json({ error: err.message });
    }
});
// SIMPAN / PERBARUI ALIAS ITEM (SELF-LEARNING)
router.post("/aliases/item", async (req, res) => {
    const { companyId = "DEFAULT", rawAlias, itemId } = req.body;
    if (!rawAlias || !itemId) {
        return res.status(400).json({ error: "rawAlias dan itemId wajib diisi" });
    }
    const cleanAlias = String(rawAlias).trim().toUpperCase();
    try {
        const existing = await db
            .select()
            .from(waItemAliases)
            .where(and(eq(waItemAliases.companyId, companyId), eq(waItemAliases.rawAlias, cleanAlias)))
            .limit(1);
        if (existing.length > 0) {
            await db
                .update(waItemAliases)
                .set({ itemId, updatedAt: new Date() })
                .where(eq(waItemAliases.id, existing[0].id));
        }
        else {
            await db.insert(waItemAliases).values({
                id: `WAI_${ulid()}`,
                companyId,
                rawAlias: cleanAlias,
                itemId,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }
        res.json({ success: true, rawAlias: cleanAlias, itemId });
    }
    catch (err) {
        console.error("[WA ITEM ALIAS SAVE ERROR]:", err.message);
        res.status(500).json({ error: err.message });
    }
});
// SIMPAN / PERBARUI ALIAS OUTLET (SELF-LEARNING)
router.post("/aliases/outlet", async (req, res) => {
    const { companyId = "DEFAULT", rawAlias, outletId } = req.body;
    if (!rawAlias || !outletId) {
        return res.status(400).json({ error: "rawAlias dan outletId wajib diisi" });
    }
    const cleanAlias = String(rawAlias).trim().toUpperCase();
    try {
        const existing = await db
            .select()
            .from(waOutletAliases)
            .where(and(eq(waOutletAliases.companyId, companyId), eq(waOutletAliases.rawAlias, cleanAlias)))
            .limit(1);
        if (existing.length > 0) {
            await db
                .update(waOutletAliases)
                .set({ outletId, updatedAt: new Date() })
                .where(eq(waOutletAliases.id, existing[0].id));
        }
        else {
            await db.insert(waOutletAliases).values({
                id: `WAO_${ulid()}`,
                companyId,
                rawAlias: cleanAlias,
                outletId,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }
        res.json({ success: true, rawAlias: cleanAlias, outletId });
    }
    catch (err) {
        console.error("[WA OUTLET ALIAS SAVE ERROR]:", err.message);
        res.status(500).json({ error: err.message });
    }
});
export const whatsappRouter = router;
