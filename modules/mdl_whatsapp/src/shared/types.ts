// File: modules/mdl_whatsapp/src/shared/types.ts

export type WAContactType = "VENDOR" | "EMPLOYEE";
export type WASessionStatus = "DISCONNECTED" | "SCAN_QR" | "CONNECTED";

export interface WAContactItem {
  id: string;
  companyId: string;
  name: string;
  phoneNumber: string; // Format: 628xxx
  contactType: WAContactType;
  vendorId?: string | null;
  employeeId?: string | null;
  outletId?: string | null; // Kunci penting: Mengikat nomor ke outlet cabang
  isActive: boolean;
}

export interface WAGroupItem {
  id: string;
  companyId: string;
  jid: string; // misal: 120363xxxx@g.us
  groupName: string;
  vendorId?: string | null; // Vendor pemilik grup
  allowedOutletIds: string[]; // Daftar cabang yang boleh bertransaksi di grup ini
  isAutoPoActive: boolean;
  isActive: boolean;
}

export interface WAMessageItem {
  id: string;
  companyId: string;
  remoteJid: string;
  senderJid: string;
  senderName?: string | null;
  text: string;
  fromMe: boolean;
  isPoParsed: boolean;
  receivingId?: string | null;
  mediaType?: "text" | "image" | "document" | string | null;
  mediaFileId?: string | null;
  mediaUrl?: string | null;
  timestamp: string;
}

export interface WhatsAppState {
  status: WASessionStatus;
  qrCode: string | null;
  phoneNumber: string | null;
  contacts: WAContactItem[];
  groups: WAGroupItem[];
  messages: WAMessageItem[];
}
