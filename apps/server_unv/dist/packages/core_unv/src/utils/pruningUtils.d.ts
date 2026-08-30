export declare const SYSTEM_AGGREGATES: string[];
export declare function isTransactionAggregate(aggregateType: string): boolean;
export declare function getStartOfCurrentMonth(): number;
/**
 * Mengecek apakah payload transaksi menandakan data tersebut sudah berada di "Terminal State" (Status Akhir).
 * Terminal State berarti transaksi sudah tamat (entah sukses, lunas, dibatalkan, atau ditolak),
 * sehingga aman untuk di-pruning (dihapus dari RAM) jika sudah melewati bulan berjalan.
 */
export declare function isTransactionCompleted(payload: any): boolean;
