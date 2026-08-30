export interface ServerTask {
    id: string;
    name: string;
    intervalMs?: number;
    runDailyMidnight?: boolean;
    lastRunAt?: number;
    execute: () => Promise<void>;
    enabled: boolean;
    lockId?: number;
}
export declare class ServerScheduler {
    private tasks;
    private timer;
    private isRunning;
    private lastCheckedDate;
    register(task: ServerTask): void;
    start(checkIntervalMs?: number): void;
    stop(): void;
    private tick;
}
export declare const globalServerScheduler: ServerScheduler;
/**
 * Pendaftaran tugas-tugas default pemeliharaan server
 */
export declare function setupDefaultServerTasks(uploadsDir?: string): void;
