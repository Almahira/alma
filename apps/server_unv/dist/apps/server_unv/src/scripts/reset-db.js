// File: apps/server_unv/src/scripts/reset-db.ts
import * as dotenv from "dotenv";
import { sql } from "drizzle-orm";
// 1. Load .env dari root DAN dari folder server (menjamin pasti terbaca)
dotenv.config({ path: "../../.env" });
dotenv.config();
async function resetDb() {
    console.log("⚠️ Mengosongkan seluruh tabel di database PostgreSQL...");
    try {
        // 2. DYNAMIC IMPORT: Memanggil DB *setelah* dotenv berhasil dijalankan
        const { db, pool } = await import("../config/db.js");
        // 1. Putus paksa seluruh koneksi lain yang sedang menggantung di database ini
        await db.execute(sql `
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid();
    `);
        // 2. Drop schema public beserta seluruh isinya dengan aman, lalu buat ulang
        await db.execute(sql `DROP SCHEMA IF EXISTS public CASCADE;`);
        await db.execute(sql `CREATE SCHEMA public;`);
        await db.execute(sql `GRANT ALL ON SCHEMA public TO public;`);
        await db.execute(sql `GRANT ALL ON SCHEMA public TO postgres;`);
        console.log("✅ Database berhasil di-reset ke kondisi kosong (Virgin State)!");
        // Tutup koneksi dengan aman
        await pool.end();
        process.exit(0);
    }
    catch (error) {
        console.error("❌ Gagal mereset database:", error);
        process.exit(1);
    }
}
resetDb();
