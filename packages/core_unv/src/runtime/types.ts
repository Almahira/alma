// File: packages/core_unv/src/runtime/types.ts

export type JobStatus = "idle" | "running" | "completed" | "failed";

export interface Job<T = any> {
  id: string;
  name: string;
  payload?: T;
  execute: () => Promise<void>;
  priority?: number;
  retries?: number;
  maxRetries?: number;
  createdAt: number;
}

export interface ScheduledTask {
  id: string;
  name: string;
  type: "interval" | "daily_midnight" | "date_change";
  intervalMs?: number;
  lastRunAt?: number;
  nextRunAt?: number;
  task: () => Promise<void>;
  enabled: boolean;
}

export interface StorageCleanupReport {
  timestamp: string;
  prunedEventsCount: number;
  prunedBlobsCount: number;
  freedBytes: number;
  skippedSystemCount: number;
  skippedActiveCount: number;
}

// ============================================================================
// TAMBAHAN FASE PEMATANGAN (KELOMPOK 2): KONTRAK UI LIFECYCLE
// ============================================================================
export interface UILifecycle {
  /**
   * Dipanggil otomatis oleh Core Layout sesaat sebelum komponen modul di-mount ke layar browser.
   * Tempat terbaik untuk memuat database lokal (Rehydration) atau menyalakan listener socket.
   */
  onMount: (contextId: string) => Promise<void> | void;

  /**
   * Dipanggil otomatis oleh Core Layout sesaat sebelum komponen modul dihancurkan/ditinggalkan oleh pengguna.
   * Tempat di mana SubscriptionManager.releaseAll(contextId) wajib dipicu untuk membuang sampah memori.
   */
  onUnmount: (contextId: string) => Promise<void> | void;
}
