// File: packages/core_unv/src/utils/pruningUtils.ts

export const SYSTEM_AGGREGATES = [
  "COMPANY",
  "REGION",
  "OUTLET",
  "DICTIONARY",
  "USER",
  "USER_ACCOUNT",
  "ROLE",
  "EMPLOYEE",
  "DIVISION",
  "POSITION",
  "DOCUMENT_TYPE",
  "VENDOR",
  "ITEM_DOMAIN",
  "ITEM_CATEGORY",
  "ITEM_UOM",
  "ITEM_PRODUCT",
  "EXECUTIVE_PANEL",
  "EXECUTIVE_TARGET",
];

export function isTransactionAggregate(aggregateType: string): boolean {
  return !SYSTEM_AGGREGATES.includes(aggregateType);
}

export function getStartOfCurrentMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

/**
 * Mengecek apakah payload transaksi menandakan data tersebut benar-benar sudah selesai.
 * Transaksi yang masih berhutang (UNPAID/PARTIAL) dan Stok Opname TIDAK BOLEH di-pruning!
 */
export function isTransactionCompleted(payload: any): boolean {
  if (!payload) return false;

  // 1. JANGAN PERNAH PRUNE STOCK OPNAME, INITIAL STOCK, ATAU RESEP:
  // Ini adalah data dasar acuan saldo stok fisik gudang yang wajib selalu ada
  if (
    payload.realQty !== undefined ||
    payload.recipeItems !== undefined ||
    payload.type === "STOCK_OPNAME" ||
    payload.type === "INITIAL_STOCK" ||
    payload.type === "RECIPE"
  ) {
    return false;
  }

  // 2. CEK STATUS PEMBAYARAN: Jika nota masih berhutang (UNPAID/PARTIAL/TEMPO), JANGAN DIHAPUS!
  const paymentStatus = String(payload.paymentStatus || "").toUpperCase();
  if (
    paymentStatus === "UNPAID" ||
    paymentStatus === "PARTIAL" ||
    paymentStatus === "TEMPO"
  ) {
    return false;
  }

  // 3. DAFTAR UNIVERSAL STATUS AKHIR (TERMINAL STATES)
  const status =
    payload.status ||
    payload.docStatus ||
    payload.transactionStatus ||
    payload.paymentStatus;
  if (!status) return false;

  const terminalStatuses = [
    // Rumpun Sukses & Lunas Sempurna
    "PAID",
    "COMPLETED",
    "VALIDATED",
    "DONE",
    "CLOSED",
    "SETTLED",
    "DELIVERED",
    // Rumpun Batal / Void
    "CANCELLED",
    "REJECTED",
    "FAILED",
    "VOID",
    "REFUNDED",
    "RETURNED",
  ];

  return terminalStatuses.includes(String(status).toUpperCase());
}
