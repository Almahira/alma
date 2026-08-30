// File: packages/core_unv/src/cqrs/types.ts
import { LedgerEventDoc } from "../ledger/schema";

/**
 * 1. KOSAKATA STATUS UNIVERSAL ALMA
 */
export type AlmaStatus =
  | "DRAFT" // Masih dalam bentuk konsep / rancangan
  | "PENDING" // Menunggu persetujuan / verifikasi
  | "SUCCESS" // Berhasil diproses / Transaksi sah
  | "FAILED" // Gagal sistem / Gagal koneksi
  | "CANCELLED" // Dibatalkan sebelum dieksekusi
  | "VOID" // Transaksi resmi yang dibatalkan (akuntansi)
  | "REJECTED" // Ditolak oleh supervisor / pusat
  | "COMPLETED"; // Selesai tuntas & terkunci

/**
 * 2. KONTRAK AMPLOP TRANSAKSI UNIVERSAL (ALMA TRANSACTION ENVELOPE)
 */
export interface AlmaTransactionEnvelope<TPluginData = any> {
  // A. Identitas Transaksi
  id: string; // ID Unik Transaksi (ULID)
  type: string; // Tipe Domain: "RECEIVING" | "POS_SALE" | "TRANSFER" | "EXPENSE"
  action: string; // Aksi: "CREATE_RECEIVING" | "ADD_PAYMENT" | "COMPLETE_RECEIVING" | "VOID_RECEIVING"
  status: AlmaStatus; // Status Dokumen
  timestamp: string; // ISO 8601 Timestamp

  // B. Konteks Aktor (Siapa yang melakukan?)
  actor: {
    id: string; // ID User / Username
    name: string; // Nama Lengkap Karyawan (e.g. "RENDI FAIZAL")
    role: string; // Role Guard (e.g. "SUPER_ADMIN" | "CASHIER")
  };

  // C. Konteks Spasial (Di mana transaksi terjadi?)
  organization: {
    companyId: string; // ID Holding / Perusahaan
  };
  location: {
    regionId?: string | null; // ID Wilayah / Central Hub (jika ada)
    outletId?: string | null; // ID Cabang / Outlet (jika ada)
    warehouseId?: string | null; // ID Gudang / Titik Simpan Fisik
  };

  // D. Referensi Lintas Entitas (Dokumen / Pihak Terkait)
  reference?: {
    invoiceNumber?: string; // No Nota / No Surat Jalan
    supplierId?: string; // ID Vendor Pemasok (dari mdl_vendor)
    customerId?: string; // ID Pelanggan (jika POS)
    purchaseOrderId?: string; // ID Purchase Order (jika ada)
    dueDate?: string | null; // Tanggal Jatuh Tempo
    documentType?: string; // HUTANG, PIUTANG, PETTYCASH
    [key: string]: any;
  };

  // E. Metrik Fisik Kuantitas (Universal Inventory Tracking)
  quantity?: {
    ordered: number; // Jumlah dipesan / di nota
    received: number; // Jumlah fisik diterima lolos QC
    rejected: number; // Jumlah fisik ditolak / retur
  };

  // F. Metrik Finansial (Universal Financial Tracking)
  amount: {
    subtotal: number; // Total sebelum pajak/diskon
    tax?: number; // Pajak PPN
    discount?: number; // Potongan harga
    total: number; // Nilai grand total transaksi
    paid: number; // Total yang sudah dibayarkan (hanya payment VALID)
    balance: number; // Sisa kekurangan (total - paid)
  };

  // G. Wilayah Kekuasaan Plugin (Custom Private Payload)
  data: TPluginData; // Rincian keranjang belanja, file bukti, catatan khusus modul
}

/**
 * 3. KONTRAK DASAR CQRS & EVENT SOURCING
 */
export interface ProjectionHandler<TState = any> {
  aggregateType: string;
  listenTo?: string[];
  applyEvent(event: LedgerEventDoc): void;
  getState(): TState;
  reset(): void;
  restoreState(state: TState): void;
}

export interface Command<TPayload = any> {
  type: string;
  payload: TPayload;
}

export interface CommandHandler<T extends Command = Command> {
  commandType: string;
  execute(command: T): Promise<void>;
}

export interface EventUpcaster {
  eventType: string;
  fromVersion: number;
  toVersion?: number;
  upcast(payload: any): any;
}
