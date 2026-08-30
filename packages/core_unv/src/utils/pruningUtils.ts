// File: packages/core_unv/src/utils/pruningUtils.ts

export const SYSTEM_AGGREGATES = [
  "COMPANY",
  "REGION",
  "OUTLET",
  "DICTIONARY",
  "USER",
  "ROLE",
];

export function isTransactionAggregate(aggregateType: string): boolean {
  return !SYSTEM_AGGREGATES.includes(aggregateType);
}

export function getStartOfCurrentMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

/**
 * Mengecek apakah payload transaksi menandakan data tersebut sudah berada di "Terminal State" (Status Akhir).
 * Terminal State berarti transaksi sudah tamat (entah sukses, lunas, dibatalkan, atau ditolak),
 * sehingga aman untuk di-pruning (dihapus dari RAM) jika sudah melewati bulan berjalan.
 */
export function isTransactionCompleted(payload: any): boolean {
  if (!payload) return false;

  // Deteksi berbagai key yang mungkin dipakai oleh modul bisnis di masa depan
  const status =
    payload.status ||
    payload.paymentStatus ||
    payload.docStatus ||
    payload.transactionStatus;
  if (!status) return false;

  // DAFTAR UNIVERSAL TERMINAL STATES (STATUS AKHIR)
  const terminalStatuses = [
    // 1. Rumpun Sukses / Lunas / Selesai
    "PAID",
    "COMPLETED",
    "VALIDATED",
    "DONE",
    "CLOSED",
    "SETTLED",
    "DELIVERED",
    "RECEIVED",
    "APPROVED",

    // 2. Rumpun Batal / Gagal (Sudah tutup buku, aman untuk dihapus)
    "CANCELLED",
    "REJECTED",
    "FAILED",
    "VOID",
    "REFUNDED",
    "RETURNED",
  ];

  return terminalStatuses.includes(String(status).toUpperCase());
}
