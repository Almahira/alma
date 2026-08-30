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
        // Drop schema public beserta seluruh isinya, lalu buat ulang
        await db.execute(sql `DROP SCHEMA public CASCADE;`);
        await db.execute(sql `CREATE SCHEMA public;`);
        await db.execute(sql `GRANT ALL ON SCHEMA public TO public;`);
        await db.execute(sql `GRANT ALL ON SCHEMA public TO postgres;`);
        console.log("✅ Database berhasil di-reset ke kondisi kosong (Virgin State)!");
        // Tutup koneksi dengan aman
        await pool.end();
    }
    catch (error) {
        console.error("❌ Gagal mereset database:", error);
    }
    finally {
        process.exit(0);
    }
}
resetDb();
