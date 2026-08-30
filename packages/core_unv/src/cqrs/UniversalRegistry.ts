import { LedgerEventDoc } from "../ledger/schema";
import { ProjectionHandler } from "./types";
import { globalUpcaster } from "./UpcasterRegistry";

export class UniversalRegistry {
  // Map utama: AggregateType -> Handler
  private handlers = new Map<string, ProjectionHandler>();

  // Map untuk Cross-Aggregate Listening: Target Event -> Daftar Handler yang nguping
  private crossListeners = new Map<string, Set<string>>();

  /**
   * Dipanggil oleh PluginManager saat sebuah modul bisnis diaktifkan.
   */
  public register(handler: ProjectionHandler): void {
    if (this.handlers.has(handler.aggregateType)) {
      console.warn(
        `[CQRS REGISTRY] Handler untuk ${handler.aggregateType} sudah ada. Menimpa yang lama...`,
      );
    }

    this.handlers.set(handler.aggregateType, handler);

    // Mendaftarkan telinga (listener) jika modul ini ingin nguping event modul lain
    if (handler.listenTo) {
      handler.listenTo.forEach((targetAggType) => {
        if (!this.crossListeners.has(targetAggType)) {
          this.crossListeners.set(targetAggType, new Set());
        }
        this.crossListeners.get(targetAggType)!.add(handler.aggregateType);
      });
    }

    console.log(
      `[CQRS REGISTRY] Registered Read Model: ${handler.aggregateType}`,
    );
  }

  /**
   * Jantung CQRS: Mengolah 1 event dan mendistribusikannya ke handler yang tepat.
   */
  public processEvent(rawEvent: LedgerEventDoc): void {
    const event = globalUpcaster.process(rawEvent);

    const aggType = event.dddMetadata.aggregateType;

    // 1. Eksekusi ke Handler Utamanya
    const primaryHandler = this.handlers.get(aggType);
    if (primaryHandler) {
      primaryHandler.applyEvent(event);
    }

    // 2. Eksekusi ke Handler lain yang ikut nguping (Cross-Aggregate)
    const listeners = this.crossListeners.get(aggType);
    if (listeners) {
      listeners.forEach((listeningAggType) => {
        const crossHandler = this.handlers.get(listeningAggType);
        if (crossHandler) {
          crossHandler.applyEvent(event);
        }
      });
    }
  }

  /** Mengambil 1 state spesifik untuk UI */
  public getState(aggregateType: string): any {
    const handler = this.handlers.get(aggregateType);
    return handler ? handler.getState() : null;
  }

  /** Mengambil seluruh state aplikasi */
  public getAllStates(): Record<string, any> {
    const states: Record<string, any> = {};
    this.handlers.forEach((handler, key) => {
      states[key] = handler.getState();
    });
    return states;
  }

  public restoreAllStates(states: Record<string, any>): void {
    this.handlers.forEach((handler, key) => {
      if (states[key]) {
        handler.restoreState(states[key]);
      }
    });
  }

  public hardReset(): void {
    this.handlers.forEach((handler) => handler.reset());
  }
}

// Export Singleton Instance
export const globalRegistry = new UniversalRegistry();
