// File: modules/mdl_item/src/shared/ItemProjection.ts
import { ProjectionHandler } from "../../../../packages/core_unv/src/cqrs/types";
import { LedgerEventDoc } from "../../../../packages/core_unv/src/ledger/schema";

export interface ItemState {
  categories: any[];
  uoms: any[];
  products: any[];
}

export class ItemProjection implements ProjectionHandler<ItemState> {
  aggregateType = "ITEM_DOMAIN";
  listenTo = ["ITEM_CATEGORY", "ITEM_UOM", "ITEM_PRODUCT"];

  private categories = new Map<string, any>();
  private uoms = new Map<string, any>();
  private products = new Map<string, any>();

  public applyEvent(event: LedgerEventDoc): void {
    const { type, payload, aggregateId } = event;

    switch (type) {
      case "CATEGORY_CREATED":
      case "CATEGORY_UPDATED":
        this.categories.set(aggregateId, {
          id: aggregateId,
          ...payload,
          status: "Aktif",
        });
        break;

      case "UOM_CREATED":
      case "UOM_UPDATED":
        this.uoms.set(aggregateId, {
          id: aggregateId,
          ...payload,
          status: "Aktif",
        });
        break;

      case "PRODUCT_CREATED":
        this.products.set(aggregateId, {
          id: aggregateId,
          ...payload,
          isExpense: Boolean(payload.isExpense),
          status: "Aktif",
        });
        break;

      case "PRODUCT_UPDATED":
        if (this.products.has(aggregateId)) {
          const existing = this.products.get(aggregateId);
          this.products.set(aggregateId, {
            ...existing,
            ...payload,
            isExpense:
              payload.isExpense !== undefined
                ? Boolean(payload.isExpense)
                : existing.isExpense,
            approvalStatus: payload.nameChanged
              ? "PENDING"
              : existing.approvalStatus,
            validateId: payload.nameChanged ? null : existing.validateId,
          });
        }
        break;

      case "PRODUCT_VALIDATED":
        if (this.products.has(aggregateId)) {
          const existing = this.products.get(aggregateId);
          this.products.set(aggregateId, {
            ...existing,
            approvalStatus: payload.approvalStatus,
            validateId: payload.validateId || null,
          });
        }
        break;

      case "PRODUCT_ARCHIVED":
        if (this.products.has(aggregateId)) {
          this.products.get(aggregateId).status = "Arsip";
        }
        break;

      case "PRODUCT_RESTORED":
        if (this.products.has(aggregateId)) {
          this.products.get(aggregateId).status = "Aktif";
        }
        break;
    }
  }

  public getState(): ItemState {
    return {
      categories: Array.from(this.categories.values()),
      uoms: Array.from(this.uoms.values()),
      products: Array.from(this.products.values()),
    };
  }

  public reset(): void {
    this.categories.clear();
    this.uoms.clear();
    this.products.clear();
  }

  public restoreState(state: ItemState): void {
    this.categories.clear();
    this.uoms.clear();
    this.products.clear();

    if (state) {
      state.categories?.forEach((c) => this.categories.set(c.id, c));
      state.uoms?.forEach((u) => this.uoms.set(u.id, u));
      state.products?.forEach((p) => {
        this.products.set(p.id, {
          ...p,
          isExpense: Boolean(p.isExpense ?? p.is_expense),
        });
      });
    }
  }
}
