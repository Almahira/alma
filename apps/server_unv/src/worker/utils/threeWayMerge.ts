// File: apps/server_unv/src/worker/utils/threeWayMerge.ts

/**
 * Mesin 3-Way Merge untuk Full Payload
 * @param baseState Data asli sebelum perubahan (Versi N-1)
 * @param serverState Data yang menang dan sudah ada di DB (Versi N dari User A)
 * @param clientState Data yang datang terlambat (Versi N dari User B)
 * @returns Object merged payload dan status konflik
 */
export function threeWayMerge(
  baseState: Record<string, any>,
  serverState: Record<string, any>,
  clientState: Record<string, any>,
): {
  merged: Record<string, any>;
  hasConflict: boolean;
  conflictFields: string[];
} {
  const merged = { ...baseState };
  let hasConflict = false;
  const conflictFields: string[] = [];

  const allKeys = new Set([
    ...Object.keys(serverState),
    ...Object.keys(clientState),
  ]);

  allKeys.forEach((key) => {
    const valBase = baseState[key];
    const valServer = serverState[key];
    const valClient = clientState[key];

    const serverChanged = JSON.stringify(valBase) !== JSON.stringify(valServer);
    const clientChanged = JSON.stringify(valBase) !== JSON.stringify(valClient);

    if (
      serverChanged &&
      clientChanged &&
      JSON.stringify(valServer) !== JSON.stringify(valClient)
    ) {
      // Tabrakan keras di field yang sama dengan nilai berbeda
      hasConflict = true;
      conflictFields.push(key);
    } else if (serverChanged) {
      merged[key] = valServer;
    } else if (clientChanged) {
      merged[key] = valClient;
    } else {
      merged[key] = valBase;
    }
  });

  return { merged, hasConflict, conflictFields };
}
