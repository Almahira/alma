// File: apps/server_unv/src/scripts/reset-nats.ts
import { connect, RetentionPolicy } from "nats"; // ✨ Tambahkan RetentionPolicy
import * as dotenv from "dotenv";
dotenv.config();
async function resetNats() {
    console.log("⚠️ Mereset stream NATS JetStream...");
    try {
        const natsUrl = process.env.NATS_URL || "nats://localhost:4222";
        const nc = await connect({ servers: natsUrl });
        const jsm = await nc.jetstreamManager();
        try {
            await jsm.streams.delete("ERP_STREAM");
            console.log("✅ Stream [ERP_STREAM] lama berhasil dihapus.");
        }
        catch (e) {
            console.log("ℹ️ Stream [ERP_STREAM] tidak ditemukan (mungkin sudah kosong).");
        }
        // Buat ulang stream baru
        await jsm.streams.add({
            name: "ERP_STREAM",
            subjects: ["events.>"],
            retention: RetentionPolicy.Limits, // ✨ Ganti "limits" dengan Enum ini
            max_msgs: 100000,
        });
        console.log("✅ Stream [ERP_STREAM] baru berhasil dibuat.");
        await nc.close();
    }
    catch (error) {
        console.error("❌ Gagal mereset NATS:", error);
    }
    finally {
        process.exit(0);
    }
}
resetNats();
