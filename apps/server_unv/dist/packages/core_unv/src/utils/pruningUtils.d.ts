export declare const SYSTEM_AGGREGATES: string[];
export declare function isTransactionAggregate(aggregateType: string): boolean;
export declare function getStartOfCurrentMonth(): number;
/**
 * Mengecek apakah payload transaksi menandakan data tersebut benar-benar sudah selesai.
 * Transaksi yang masih berhutang (UNPAID/PARTIAL) dan Stok Opname TIDAK BOLEH di-pruning!
 */
export declare function isTransactionCompleted(payload: any): boolean;
