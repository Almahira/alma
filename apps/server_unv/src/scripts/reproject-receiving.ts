// File: apps/server_unv/src/scripts/reproject-receiving.ts
import * as dotenv from "dotenv";
import path from "path";
import { sql } from "drizzle-orm";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

async function main() {
  console.log("====================================================");
  console.log("  RE-PROJECTING TRANSAKSI DARI TX_EVENT_JOURNAL     ");
  console.log("====================================================");

  // 1. Import DB, Jurnal, dan Handler setelah dotenv siap
  const { db, pool } = await import("../config/db.js");
  const { txEventJournal } =
    await import("../../../../packages/db-schema/index.js");
  const { receivingHandlers } =
    await import("../../../../modules/mdl_receiving/src/server/event-handlers.js");

  try {
    // 2. Ambil semua event RECEIVING dari jurnal transaksi terurut dari yang tertua
    const events = await db
      .select()
      .from(txEventJournal)
      .where(sql`${txEventJournal.type} LIKE 'RECEIVING_%'`)
      .orderBy(txEventJournal.aggregateVersion);

    console.log(`Menemukan ${events.length} event receiving di jurnal...`);

    let reprojectedCount = 0;

    // 3. Putar ulang setiap event ke handler resmi
    for (const rawEvt of events) {
      const payload =
        typeof rawEvt.payload === "string"
          ? JSON.parse(rawEvt.payload)
          : rawEvt.payload;
      const eventObj = {
        id: rawEvt.id,
        aggregateId: rawEvt.aggregateId,
        aggregateType: rawEvt.aggregateType,
        aggregateVersion: rawEvt.aggregateVersion,
        type: rawEvt.type,
        payload,
      };

      const handler = (receivingHandlers as any)[rawEvt.type];
      if (handler) {
        await db.transaction(async (tx) => {
          try {
            await handler(tx, eventObj);
            reprojectedCount++;
            console.log(
              `  ✓ Diproyeksikan ulang: [${rawEvt.type}] ${rawEvt.aggregateId} (v${rawEvt.aggregateVersion})`,
            );
          } catch (err: any) {
            console.warn(
              `  - Dilewati / Sudah ada: ${rawEvt.aggregateId} (${err.message})`,
            );
          }
        });
      }
    }

    console.log("====================================================");
    console.log(
      `  SUKSES! ${reprojectedCount} event berhasil diproyeksikan ke tabel receiving.`,
    );
    console.log("====================================================");
  } catch (error: any) {
    console.error("Gagal menjalankan reproject:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
