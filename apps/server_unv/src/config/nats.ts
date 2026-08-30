// File: apps/server_unv/src/config/nats.ts
import {
  connect,
  NatsConnection,
  JetStreamManager,
  JetStreamClient,
  StringCodec,
  RetentionPolicy,
} from "nats";

export let nc: NatsConnection;
export let jsm: JetStreamManager;
export let js: JetStreamClient;
export const sc = StringCodec();

export async function initNATS() {
  try {
    const natsUrl = process.env.NATS_URL || "nats://localhost:4222";
    nc = await connect({ servers: natsUrl });
    jsm = await nc.jetstreamManager();
    js = nc.jetstream();

    // ✨ PERBAIKAN: Gunakan Enum RetentionPolicy.Limits
    await jsm.streams.add({
      name: "ERP_STREAM",
      subjects: ["events.>"],
      retention: RetentionPolicy.Limits,
      max_msgs: 100000,
    });

    console.log("[NATS] Berhasil terhubung ke NATS JetStream");
  } catch (error) {
    console.error("[NATS] Gagal terhubung:", error);
    throw error;
  }
}

export async function publishEvent(subject: string, payload: any) {
  if (!js) throw new Error("NATS belum diinisialisasi");
  const data = sc.encode(JSON.stringify(payload));
  await js.publish(subject, data);
}
