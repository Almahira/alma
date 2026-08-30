// File: modules/mdl_plusales/src/shared/PlusalesProjection.ts
import { ProjectionHandler } from "../../../../packages/core_unv/src/cqrs/types";
import { LedgerEventDoc } from "../../../../packages/core_unv/src/ledger/schema";

export interface PlusalesDocState {
  id: string;
  companyId: string;
  regionId: string;
  outletId: string;
  date: string;
  documentNumber: string;
  grossSales: number;
  discount: number;
  tax: number;
  service: number;
  netSales: number;
  totalSettlement: number;
  totalPettycash: number;
  cashOnHand: number;
  balanceDifference: number;
  discrepancyNote?: string | null;
  proofFileId?: string | null;
  status: string;
  isActive: boolean;
  dynamicItems: any[];
}

export interface PlusalesState {
  documents: PlusalesDocState[];
}

export class PlusalesProjection implements ProjectionHandler<PlusalesState> {
  aggregateType = "PLUSALES_DOCUMENT";
  listenTo = ["ORGANIZATION", "RECEIVING_DOCUMENT"];
  private documents = new Map<string, PlusalesDocState>();

  public applyEvent(event: LedgerEventDoc): void {
    const { type, payload, aggregateId } = event;

    switch (type) {
      case "TX_PLUSALES_CREATED": {
        const companyId =
          payload.organization?.companyId || payload.companyId || "";
        const regionId = payload.location?.regionId || payload.regionId || "";
        const outletId = payload.location?.outletId || payload.outletId || "";
        const date =
          payload.timestamp || payload.date || new Date().toISOString();
        const documentNumber =
          payload.reference?.documentNumber ||
          payload.documentNumber ||
          `SLS-${Date.now()}`;

        const grossSales = payload.amount?.subtotal ?? payload.grossSales ?? 0;
        const discount = payload.amount?.discount ?? payload.discount ?? 0;
        const tax = payload.amount?.tax ?? payload.tax ?? 0;
        const service = payload.data?.service ?? payload.service ?? 0;
        const netSales =
          payload.amount?.total ??
          payload.netSales ??
          grossSales - discount - tax - service;

        const totalSettlement = payload.data?.totalSettlement ?? 0;
        const totalPettycash = payload.data?.totalPettycash ?? 0;
        const cashOnHand = payload.data?.cashOnHand ?? 0;
        const balanceDifference =
          payload.amount?.balance ?? payload.balanceDifference ?? 0;
        const discrepancyNote = payload.data?.discrepancyNote || null;
        const proofFileId = payload.data?.proofFileId || null;
        const dynamicItems = payload.data?.dynamicItems || [];

        this.documents.set(aggregateId, {
          id: aggregateId,
          companyId,
          regionId,
          outletId,
          date,
          documentNumber,
          grossSales,
          discount,
          tax,
          service,
          netSales,
          totalSettlement,
          totalPettycash,
          cashOnHand,
          balanceDifference,
          discrepancyNote,
          proofFileId,
          status: payload.status || "COMPLETED",
          isActive: true,
          dynamicItems,
        });
        break;
      }

      case "TX_PLUSALES_UPDATED": {
        if (this.documents.has(aggregateId)) {
          const existing = this.documents.get(aggregateId)!;
          const grossSales =
            payload.amount?.subtotal ??
            payload.grossSales ??
            existing.grossSales;
          const discount =
            payload.amount?.discount ?? payload.discount ?? existing.discount;
          const tax = payload.amount?.tax ?? payload.tax ?? existing.tax;
          const service =
            payload.data?.service ?? payload.service ?? existing.service;
          const netSales =
            payload.amount?.total ??
            payload.netSales ??
            grossSales - discount - tax - service;

          this.documents.set(aggregateId, {
            ...existing,
            grossSales,
            discount,
            tax,
            service,
            netSales,
            totalSettlement:
              payload.data?.totalSettlement ?? existing.totalSettlement,
            totalPettycash:
              payload.data?.totalPettycash ?? existing.totalPettycash,
            cashOnHand: payload.data?.cashOnHand ?? existing.cashOnHand,
            balanceDifference:
              payload.amount?.balance ??
              payload.balanceDifference ??
              existing.balanceDifference,
            discrepancyNote:
              payload.data?.discrepancyNote !== undefined
                ? payload.data.discrepancyNote
                : existing.discrepancyNote,
            proofFileId:
              payload.data?.proofFileId !== undefined
                ? payload.data.proofFileId
                : existing.proofFileId,
            dynamicItems: payload.data?.dynamicItems || existing.dynamicItems,
          });
        }
        break;
      }

      case "TX_PLUSALES_ARCHIVED": {
        if (this.documents.has(aggregateId)) {
          this.documents.get(aggregateId)!.isActive = false;
        }
        break;
      }

      case "TX_PLUSALES_RESTORED": {
        if (this.documents.has(aggregateId)) {
          this.documents.get(aggregateId)!.isActive = true;
        }
        break;
      }
    }
  }

  public getState(): PlusalesState {
    return {
      documents: Array.from(this.documents.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    };
  }

  public reset(): void {
    this.documents.clear();
  }

  public restoreState(state: PlusalesState): void {
    this.documents.clear();
    if (state && state.documents) {
      state.documents.forEach((d) => this.documents.set(d.id, d));
    }
  }
}
