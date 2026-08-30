/**
 * Mesin 3-Way Merge untuk Full Payload
 * @param baseState Data asli sebelum perubahan (Versi N-1)
 * @param serverState Data yang menang dan sudah ada di DB (Versi N dari User A)
 * @param clientState Data yang datang terlambat (Versi N dari User B)
 * @returns Object merged payload dan status konflik
 */
export declare function threeWayMerge(baseState: Record<string, any>, serverState: Record<string, any>, clientState: Record<string, any>): {
    merged: Record<string, any>;
    hasConflict: boolean;
    conflictFields: string[];
};
