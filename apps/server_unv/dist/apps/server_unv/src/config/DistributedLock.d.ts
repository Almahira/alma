export declare class DistributedLock {
    /**
     * Berusaha mengambil kunci sewa (Lease) untuk sebuah pekerjaan spesifik.
     * Menggunakan Advisory Lock bawaan PostgreSQL untuk performa instan tanpa Redis.
     * @param lockId Angka unik ID untuk jenis pekerjaan (misal: 9991 untuk PruningJob)
     * @param timeoutMs Batas maksimum aman menahan kunci sewa
     * @returns boolean true jika berhasil mengunci, false jika server lain sedang memegang kunci
     */
    static acquire(lockId: number): Promise<boolean>;
    /**
     * Melepaskan kunci sewa secara resmi agar bisa dipakai oleh server lain
     */
    static release(lockId: number): Promise<void>;
}
