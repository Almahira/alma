// File: apps/server_unv/src/config/DistributedLock.ts
import { sql } from "drizzle-orm";
import { db } from "./db"; // Menggunakan konfigurasi DB yang sudah ada

export class DistributedLock {
  /**
   * Berusaha mengambil kunci sewa (Lease) untuk sebuah pekerjaan spesifik.
   * Menggunakan Advisory Lock bawaan PostgreSQL untuk performa instan tanpa Redis.
   * @param lockId Angka unik ID untuk jenis pekerjaan (misal: 9991 untuk PruningJob)
   * @param timeoutMs Batas maksimum aman menahan kunci sewa
   * @returns boolean true jika berhasil mengunci, false jika server lain sedang memegang kunci
   */
  public static async acquire(lockId: number): Promise<boolean> {
    try {
      // pg_try_advisory_lock akan mengembalikan true jika kunci belum diambil server manapun
      const result = await db.execute(
        sql`SELECT pg_try_advisory_lock(${lockId}) as acquired`,
      );
      const rows = result.rows as any[];
      return (
        rows.length > 0 &&
        (rows[0].acquired === true || rows[0].acquired === "true")
      );
    } catch (error) {
      console.error(
        `[DISTRIBUTED LOCK] Gagal memverifikasi status sewa kunci pada ID ${lockId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Melepaskan kunci sewa secara resmi agar bisa dipakai oleh server lain
   */
  public static async release(lockId: number): Promise<void> {
    try {
      await db.execute(sql`SELECT pg_advisory_unlock(${lockId})`);
      console.log(`[DISTRIBUTED LOCK] Sukses melepas sewa kunci ID: ${lockId}`);
    } catch (error) {
      console.error(
        `[DISTRIBUTED LOCK] Gagal melepas sewa kunci ID ${lockId}:`,
        error,
      );
    }
  }
}
