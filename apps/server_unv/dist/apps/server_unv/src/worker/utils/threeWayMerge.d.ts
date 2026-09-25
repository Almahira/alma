/**
 * Mesin 3-Way Merge Tangguh untuk Delta & Full Payload Event Sourcing
 * @param baseState Data asli sebelum perubahan (Versi N-1)
 * @param serverState Data yang ada di DB server (Versi N dari User A)
 * @param clientState Data delta yang datang terlambat (Versi N dari User B)
 * @returns Object merged payload dan status konflik
 */
export declare function threeWayMerge(baseState: Record<string, any>, serverState: Record<string, any>, clientState: Record<string, any>): {
    merged: Record<string, any>;
    hasConflict: boolean;
    conflictFields: string[];
};
