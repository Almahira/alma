// File: modules/mdl_whatsapp/src/client/utils/waStorage.ts

const WA_MESSAGES_KEY = "unv_wa_messages";
const WA_INBOX_KEY = "unv_wa_inbox";

/**
 * Logika Pruning:
 * Cek apakah ada data di Local Storage. Jika kosong -> skip pruning.
 * Jika ada datanya -> bersihkan kembali ke virgin state.
 */
export const pruneWhatsAppLocalStorage = () => {
  const hasMessages = localStorage.getItem(WA_MESSAGES_KEY);
  const hasInbox = localStorage.getItem(WA_INBOX_KEY);

  if (!hasMessages && !hasInbox) {
    console.log("[WA STORAGE] Local storage kosong, skip pruning.");
    return;
  }

  localStorage.removeItem(WA_MESSAGES_KEY);
  localStorage.removeItem(WA_INBOX_KEY);
  console.log("[WA STORAGE] Berhasil dibersihkan kembali ke kondisi virgin.");
};

export const getStoredMessages = (jid: string): any[] => {
  try {
    const raw = localStorage.getItem(WA_MESSAGES_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    return all[jid] || [];
  } catch {
    return [];
  }
};

export const saveStoredMessage = (msg: any) => {
  try {
    const raw = localStorage.getItem(WA_MESSAGES_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const jid = msg.remoteJid;
    if (!all[jid]) all[jid] = [];

    // Jika pesan resmi dari kita masuk, ganti pesan TEMP_ yang teksnya sama
    if (msg.fromMe && !msg.id.startsWith("TEMP_")) {
      const tempIdx = all[jid].findIndex(
        (m: any) => m.id.startsWith("TEMP_") && m.text === msg.text,
      );
      if (tempIdx !== -1) {
        all[jid][tempIdx] = msg;
        localStorage.setItem(WA_MESSAGES_KEY, JSON.stringify(all));
        updateStoredInbox(msg);
        return;
      }
    }

    // Hindari duplikasi ID
    if (!all[jid].some((m: any) => m.id === msg.id)) {
      all[jid].push(msg);
      localStorage.setItem(WA_MESSAGES_KEY, JSON.stringify(all));
    }

    updateStoredInbox(msg);
  } catch (err) {
    console.error("[WA STORAGE SAVE ERROR]:", err);
  }
};

export const getStoredInbox = (): any[] => {
  try {
    const raw = localStorage.getItem(WA_INBOX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const updateStoredInbox = (msg: any) => {
  try {
    const raw = localStorage.getItem(WA_INBOX_KEY);
    let inbox: any[] = raw ? JSON.parse(raw) : [];
    const existingIdx = inbox.findIndex((i) => i.jid === msg.remoteJid);
    const item = {
      jid: msg.remoteJid,
      name:
        msg.senderName && msg.senderName !== "Pengirim"
          ? msg.senderName
          : msg.remoteJid.split("@")[0],
      lastActivity: msg.timestamp,
      lastText:
        msg.text || (msg.mediaType ? `[${msg.mediaType.toUpperCase()}]` : ""),
    };

    if (existingIdx >= 0) {
      inbox[existingIdx] = item;
    } else {
      inbox.unshift(item);
    }
    localStorage.setItem(WA_INBOX_KEY, JSON.stringify(inbox));
  } catch {}
};
