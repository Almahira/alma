/**
 * Mesin 3-Way Merge Tangguh Berbasis Resolusi Waktu Presisi Tinggi (TIMESTAMP 6)
 * @param baseState Data asli sebelum perubahan (Versi N-1)
 * @param serverState Data yang ada di DB server (Versi N dari User A)
 * @param clientState Data delta yang datang terlambat (Versi N dari User B)
 * @param serverTimestamp Stempel waktu commit server User A (opsional, fallback ke payload)
 * @param clientTimestamp Stempel waktu mutasi lokal User B (opsional, fallback ke payload)
 * @returns Object merged payload dan status konflik (hasConflict selalu false untuk data bisnis)
 */
export declare function threeWayMerge(baseState: Record<string, any>, serverState: Record<string, any>, clientState: Record<string, any>, serverTimestamp?: string | number | Date | null, clientTimestamp?: string | number | Date | null): {
    merged: Record<string, any>;
    hasConflict: boolean;
    conflictFields: string[];
};
