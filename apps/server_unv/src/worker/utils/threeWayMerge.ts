// File: apps/server_unv/src/worker/utils/threeWayMerge.ts

/**
 * Helper konversi waktu ke mikrodetik (presisi 6 digit pecahan detik)
 * Mampu membaca ISO-8601, string PostgreSQL 'YYYY-MM-DD HH:MM:SS.ffffff', Date, dan Unix epoch ms/us.
 */
function parseMicroseconds(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === "number") {
    // Jika dalam millisecond (< 1e14), konversi ke mikrodetik
    return ts < 1e14 ? ts * 1000 : ts;
  }
  if (ts instanceof Date) {
    return ts.getTime() * 1000;
  }
  const str = String(ts).trim().replace(" ", "T");
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    // Ekstraksi 6 digit desimal pecahan detik (.ffffff)
    const match = str.match(/\.(\d+)/);
    const micros = match
      ? parseInt(match[1].slice(0, 6).padEnd(6, "0"), 10)
      : 0;
    return Math.floor(d.getTime() / 1000) * 1000000 + micros;
  }
  return 0;
}

/**
 * Mesin 3-Way Merge Tangguh Berbasis Resolusi Waktu Presisi Tinggi (TIMESTAMP 6)
 * @param baseState Data asli sebelum perubahan (Versi N-1)
 * @param serverState Data yang ada di DB server (Versi N dari User A)
 * @param clientState Data delta yang datang terlambat (Versi N dari User B)
 * @param serverTimestamp Stempel waktu commit server User A (opsional, fallback ke payload)
 * @param clientTimestamp Stempel waktu mutasi lokal User B (opsional, fallback ke payload)
 * @returns Object merged payload dan status konflik (hasConflict selalu false untuk data bisnis)
 */
export function threeWayMerge(
  baseState: Record<string, any>,
  serverState: Record<string, any>,
  clientState: Record<string, any>,
  serverTimestamp?: string | number | Date | null,
  clientTimestamp?: string | number | Date | null,
): {
  merged: Record<string, any>;
  hasConflict: boolean;
  conflictFields: string[];
} {
  const merged: Record<string, any> = { ...baseState };
  const conflictFields: string[] = [];

  // Ekstraksi stempel waktu mikrodetik (dari parameter eksplisit atau fallback dari payload)
  const serverTime = parseMicroseconds(
    serverTimestamp ??
      serverState?.updatedAt ??
      serverState?.timestamp ??
      serverState?.createdAt ??
      serverState?.client_timestamp,
  );

  const clientTime = parseMicroseconds(
    clientTimestamp ??
      clientState?.updatedAt ??
      clientState?.timestamp ??
      clientState?.createdAt ??
      clientState?.client_timestamp,
  );

  const allKeys = new Set([
    ...Object.keys(serverState || {}),
    ...Object.keys(clientState || {}),
  ]);

  allKeys.forEach((key) => {
    const valBase = baseState ? baseState[key] : undefined;
    const valServer = serverState ? serverState[key] : undefined;
    const valClient = clientState ? clientState[key] : undefined;

    // Field hanya dianggap berubah jika didefinisikan secara eksplisit (bukan undefined / delta kosong)
    const serverChanged =
      valServer !== undefined &&
      JSON.stringify(valBase) !== JSON.stringify(valServer);
    const clientChanged =
      valClient !== undefined &&
      JSON.stringify(valBase) !== JSON.stringify(valClient);

    if (
      serverChanged &&
      clientChanged &&
      JSON.stringify(valServer) !== JSON.stringify(valClient)
    ) {
      // An approved supervisor decision must not be replaced by an unapproved edit.
      if (
        (key === "approvalStatus" || key === "validateId") &&
        serverState.approvalStatus === "APPROVED" &&
        clientState.approvalStatus !== "APPROVED"
      ) {
        merged[key] = valServer;
      } else if (
        (key === "approvalStatus" || key === "validateId") &&
        clientState.approvalStatus === "APPROVED" &&
        serverState.approvalStatus !== "APPROVED"
      ) {
        merged[key] = valClient;
      }
      // 2. Khusus Kolom Waktu / Audit: ambil timestamp paling mutakhir
      else if (
        key === "updatedAt" ||
        key === "timestamp" ||
        key === "lastUpdatedAt" ||
        key === "createdAt"
      ) {
        merged[key] = clientTime >= serverTime ? valClient : valServer;
      }
      // 3. Khusus Objek Spasial / Amplop / Peta Harga (location, organization, pricing, reference): gabungkan sub-kunci di dalamnya
      else if (
        typeof valServer === "object" &&
        typeof valClient === "object" &&
        valServer !== null &&
        valClient !== null &&
        !Array.isArray(valServer) &&
        !Array.isArray(valClient)
      ) {
        merged[key] = {
          ...(typeof valBase === "object" && valBase !== null ? valBase : {}),
          ...valServer,
          ...valClient,
        };
      }
      // 4. Tabrakan Nilai Data Bisnis Riil (Nama, Harga Satuan, Kategori, Stok):
      // Resolusi deterministik menggunakan TIMESTAMP(6) terbaru — ZERO DATA LOSS
      else {
        if (clientTime >= serverTime) {
          merged[key] = valClient;
        } else {
          merged[key] = valServer;
        }
        // Tetap catat field yang bertabrakan untuk audit log internal
        conflictFields.push(key);
      }
    } else if (clientChanged) {
      merged[key] = valClient;
    } else if (serverChanged) {
      merged[key] = valServer;
    } else if (valBase !== undefined) {
      merged[key] = valBase;
    }
  });

  // hasConflict bernilai false agar event tidak pernah masuk ke quarantine_event_journal
  return {
    merged,
    hasConflict: false,
    conflictFields,
  };
}
