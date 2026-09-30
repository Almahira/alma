// File: modules/mdl_whatsapp/src/client/useWhatsAppImportStore.ts
import { create } from "zustand";

export interface WhatsAppImportMessage {
  id: string;
  text: string;
  senderName?: string;
  timestamp?: string | Date;
}

export interface WhatsAppImportPayload {
  messageIds: string[];
  messages: WhatsAppImportMessage[];
  remoteJid: string;
  senderName: string;
}

interface WhatsAppImportStore extends WhatsAppImportPayload {
  setImportPayload: (payload: WhatsAppImportPayload) => void;
  clearImport: () => void;
}

export const useWhatsAppImportStore = create<WhatsAppImportStore>((set) => ({
  messageIds: [],
  messages: [],
  remoteJid: "",
  senderName: "",
  setImportPayload: (payload) => set({ ...payload }),
  clearImport: () =>
    set({
      messageIds: [],
      messages: [],
      remoteJid: "",
      senderName: "",
    }),
}));
