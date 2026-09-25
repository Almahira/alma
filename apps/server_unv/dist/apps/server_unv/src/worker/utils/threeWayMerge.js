// File: apps/server_unv/src/worker/utils/threeWayMerge.ts
/**
 * Mesin 3-Way Merge Tangguh untuk Delta & Full Payload Event Sourcing
 * @param baseState Data asli sebelum perubahan (Versi N-1)
 * @param serverState Data yang ada di DB server (Versi N dari User A)
 * @param clientState Data delta yang datang terlambat (Versi N dari User B)
 * @returns Object merged payload dan status konflik
 */
export function threeWayMerge(baseState, serverState, clientState) {
    const merged = { ...baseState };
    let hasConflict = false;
    const conflictFields = [];
    const allKeys = new Set([
        ...Object.keys(serverState || {}),
        ...Object.keys(clientState || {}),
    ]);
    allKeys.forEach((key) => {
        const valBase = baseState ? baseState[key] : undefined;
        const valServer = serverState ? serverState[key] : undefined;
        const valClient = clientState ? clientState[key] : undefined;
        // Field hanya dianggap berubah jika didefinisikan secara eksplisit (bukan undefined / delta kosong)
        const serverChanged = valServer !== undefined &&
            JSON.stringify(valBase) !== JSON.stringify(valServer);
        const clientChanged = valClient !== undefined &&
            JSON.stringify(valBase) !== JSON.stringify(valClient);
        if (serverChanged &&
            clientChanged &&
            JSON.stringify(valServer) !== JSON.stringify(valClient)) {
            // 1. Khusus Keputusan Validasi: approvalStatus & validateId dari supervisor WAJIB menang
            if ((key === "approvalStatus" || key === "validateId") &&
                (clientState.approvalStatus === "APPROVED" || valClient !== undefined)) {
                merged[key] = valClient;
            }
            // 2. Khusus Kolom Waktu / Audit: ambil timestamp transaksi terkini tanpa memicu konflik
            else if (key === "updatedAt" ||
                key === "timestamp" ||
                key === "lastUpdatedAt") {
                merged[key] = valClient;
            }
            // 3. Khusus Objek Spasial / Amplop (location, organization, reference): gabungkan isi dalamnya
            else if (typeof valServer === "object" &&
                typeof valClient === "object" &&
                valServer !== null &&
                valClient !== null &&
                !Array.isArray(valServer) &&
                !Array.isArray(valClient)) {
                merged[key] = {
                    ...(typeof valBase === "object" && valBase !== null ? valBase : {}),
                    ...valServer,
                    ...valClient,
                };
            }
            // 4. Tabrakan Keras Riil (Nilai data bisnis berbeda secara nyata, misal nama barang atau harga)
            else {
                hasConflict = true;
                conflictFields.push(key);
            }
        }
        else if (clientChanged) {
            merged[key] = valClient;
        }
        else if (serverChanged) {
            merged[key] = valServer;
        }
        else if (valBase !== undefined) {
            merged[key] = valBase;
        }
    });
    return { merged, hasConflict, conflictFields };
}
