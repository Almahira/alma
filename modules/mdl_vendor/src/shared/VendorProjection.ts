// File: modules/mdl_vendor/src/shared/VendorProjection.ts
import { ProjectionHandler } from "../../../../packages/core_unv/src/cqrs/types";
import { LedgerEventDoc } from "../../../../packages/core_unv/src/ledger/schema";

export interface VendorState {
  vendors: any[];
  documents: any[];
}

export class VendorProjection implements ProjectionHandler<VendorState> {
  aggregateType = "VENDOR";
  private vendors = new Map<string, any>();
  private documents = new Map<string, any>();

  public applyEvent(event: LedgerEventDoc): void {
    const { type, payload, aggregateId } = event;

    switch (type) {
      case "VENDOR_CREATED":
        this.vendors.set(aggregateId, {
          ...payload, // <-- PERBAIKAN: Payload diurai terlebih dahulu
          id: aggregateId, // <-- Barulah ID mengunci agar tidak tergantikan
          status: "Aktif",
        });
        break;
      case "VENDOR_UPDATED":
        if (this.vendors.has(aggregateId)) {
          const existing = this.vendors.get(aggregateId);
          this.vendors.set(aggregateId, { ...existing, ...payload });
        }
        break;
      case "VENDOR_ARCHIVED":
        if (this.vendors.has(aggregateId))
          this.vendors.get(aggregateId).status = "Arsip";
        break;
      case "VENDOR_RESTORED":
        if (this.vendors.has(aggregateId))
          this.vendors.get(aggregateId).status = "Aktif";
        break;
      case "VENDOR_DOCUMENT_ATTACHED":
        this.documents.set(payload.documentId, {
          ...payload,
          vendorId: aggregateId,
          status: "Aktif",
        });
        break;
      case "VENDOR_DOCUMENT_ARCHIVED":
        if (this.documents.has(payload.documentId)) {
          this.documents.get(payload.documentId).status = "Arsip";
        }
        break;
    }
  }

  public getState(): VendorState {
    return {
      vendors: Array.from(this.vendors.values()),
      documents: Array.from(this.documents.values()),
    };
  }

  public reset(): void {
    this.vendors.clear();
    this.documents.clear();
  }

  public restoreState(state: VendorState): void {
    this.vendors.clear();
    this.documents.clear();
    if (state) {
      state.vendors?.forEach((v) => this.vendors.set(v.id, v));
      state.documents?.forEach((d) => this.documents.set(d.documentId, d));
    }
  }
}
