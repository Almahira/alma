// File: packages/core_unv/src/dictionary/DictionaryProjection.ts
import { ProjectionHandler } from "../cqrs/types";
import { LedgerEventDoc } from "../ledger/schema";

export class DictionaryProjection implements ProjectionHandler {
  aggregateType = "DICTIONARY";
  private items = new Map<string, any>();

  public applyEvent(event: LedgerEventDoc): void {
    const { type, payload, aggregateId } = event;
    switch (type) {
      case "DICTIONARY_CREATED":
      case "DICTIONARY_UPDATED":
        this.items.set(aggregateId, {
          id: aggregateId,
          ...payload,
          status: "Aktif",
        });
        break;
      case "DICTIONARY_ARCHIVED":
        if (this.items.has(aggregateId))
          this.items.get(aggregateId).status = "Arsip";
        break;
      case "DICTIONARY_RESTORED":
        if (this.items.has(aggregateId))
          this.items.get(aggregateId).status = "Aktif";
        break;
      case "DICTIONARY_MERGED":
        if (this.items.has(payload.sourceId)) {
          this.items.get(payload.sourceId).status = "Arsip";
        }
        if (!this.items.has(payload.targetId)) {
          this.items.set(payload.targetId, {
            id: payload.targetId,
            category: payload.category,
            value: payload.targetValue,
            status: "Aktif",
          });
        }
        break;
    }
  }

  public getState() {
    return { items: Array.from(this.items.values()) };
  }

  public reset() {
    this.items.clear();
  }

  public restoreState(state: { items: any[] }): void {
    this.items.clear();
    if (state && state.items) {
      state.items.forEach((i) => this.items.set(i.id, i));
    }
  }
}
