export interface ServerTask {
    id: string;
    name: string;
    intervalMs?: number;
    runDailyMidnight?: boolean;
    lastRunAt?: number;
    execute: () => Promise<void>;
    enabled: boolean;
    /**
     * ID Unik Kunci Sewa (Distributed Lock).
     * Kosongkan jika task harus berjalan paralel di semua instance server.
     */
    lockId?: number;
    /** Status internal: mencegah task yang sama tumpang-tindih. */
    isRunning?: boolean;
}
export declare class ServerScheduler {
    private tasks;
    private timer;
    private isRunning;
    private lastCheckedDate;
    /**
     * Mendaftarkan task berkala / harian baru.
     * `id` bersifat opsional — jika tidak diisi, akan memakai `name`.
     */
    register(task: Omit<ServerTask, "isRunning"> & {
        id?: string;
    }): void;
    /** Alias kompatibilitas untuk versi lama (`registerTask`). */
    registerTask(task: {
        name: string;
        intervalMs?: number;
        handler?: () => Promise<void>;
        execute?: () => Promise<void>;
        runDailyMidnight?: boolean;
        enabled?: boolean;
        lockId?: number;
        id?: string;
    }): void;
    /**
     * Menjalankan daemon scheduler.
     * @param checkIntervalMs Interval pengecekan loop (default 30 detik untuk akurasi tinggi).
     */
    start(checkIntervalMs?: number): void;
    stop(): void;
    /**
     * Siklus utama scheduler: mengecek interval & pergantian hari (WIB),
     * lalu mengeksekusi task yang sudah waktunya berjalan.
     */
    private tick;
    /**
     * Memicu eksekusi langsung task tertentu tanpa menunggu interval.
     */
    runTaskNow(nameOrId: string): Promise<void>;
}
export declare const globalServerScheduler: ServerScheduler;
/**
 * Pendaftaran seluruh task default server.
 */
export declare function setupDefaultServerTasks(uploadsDir?: string): void;
