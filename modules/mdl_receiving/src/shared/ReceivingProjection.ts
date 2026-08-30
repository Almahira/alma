// File: modules/mdl_receiving/src/shared/ReceivingProjection.ts
import { ProjectionHandler } from "../../../../packages/core_unv/src/cqrs/types";
import { LedgerEventDoc } from "../../../../packages/core_unv/src/ledger/schema";

export interface ReceivingState {
  documents: any[];
}

export class ReceivingProjection implements ProjectionHandler<ReceivingState> {
  aggregateType = "RECEIVING_DOCUMENT";
  private documents = new Map<string, any>();

  public applyEvent(event: LedgerEventDoc): void {
    const { type, payload, aggregateId } = event;

    switch (type) {
      case "RECEIVING_CREATED": {
        const invoiceNumber =
          payload.reference?.invoiceNumber || payload.invoiceNumber || "";
        const dueDate =
          payload.reference?.dueDate !== undefined
            ? payload.reference?.dueDate
            : payload.dueDate;
        const vendorId =
          payload.reference?.supplierId || payload.vendorId || null;
        const documentType =
          payload.reference?.documentType || payload.documentType || "HUTANG";
        const companyId =
          payload.organization?.companyId || payload.companyId || "";
        const regionId = payload.location?.regionId || payload.regionId || null;
        const outletId = payload.location?.outletId || payload.outletId || null;
        const totalAmount = payload.amount?.total ?? payload.totalAmount ?? 0;
        const paidAmount = payload.amount?.paid ?? payload.paidAmount ?? 0;
        const items = payload.data?.items || payload.items || [];
        const isTempo = payload.data?.isTempo ?? Boolean(dueDate);

        // ---> PERBAIKAN KRUSIAL: Ambil paymentMethod secara eksplisit <---
        const paymentMethod =
          payload.data?.paymentMethod || payload.paymentMethod || "KASIR";

        this.documents.set(aggregateId, {
          id: aggregateId,
          companyId,
          regionId,
          outletId,
          vendorId,
          documentType,
          invoiceNumber,
          paymentMethod, // <--- TERSIMPAN KE IN-MEMORY PROJECTION
          date: payload.timestamp || payload.date || new Date().toISOString(),
          dueDate,
          totalAmount,
          paidAmount,
          status: payload.status || "DRAFT",
          paymentStatus:
            !isTempo || paidAmount >= totalAmount ? "PAID" : "UNPAID",
          isActive: true,
          items,
          payments: [],
        });
        break;
      }

      case "RECEIVING_UPDATED": {
        if (this.documents.has(aggregateId)) {
          const existing = this.documents.get(aggregateId);
          const invoiceNumber =
            payload.reference?.invoiceNumber ||
            payload.invoiceNumber ||
            existing.invoiceNumber;
          const dueDate =
            payload.reference?.dueDate !== undefined
              ? payload.reference?.dueDate
              : payload.dueDate;
          const vendorId =
            payload.reference?.supplierId ||
            payload.vendorId ||
            existing.vendorId;
          const totalAmount =
            payload.amount?.total ??
            payload.totalAmount ??
            existing.totalAmount;
          const items = payload.data?.items || payload.items || existing.items;
          const paymentMethod =
            payload.data?.paymentMethod ||
            payload.paymentMethod ||
            existing.paymentMethod ||
            "KASIR";

          this.documents.set(aggregateId, {
            ...existing,
            invoiceNumber,
            dueDate,
            vendorId,
            totalAmount,
            paymentMethod,
            items,
            paymentStatus: dueDate
              ? existing.paidAmount > 0
                ? "PARTIAL"
                : "UNPAID"
              : "PAID",
          });
        }
        break;
      }

      case "RECEIVING_PAYMENT_ADDED": {
        if (this.documents.has(aggregateId)) {
          const doc = this.documents.get(aggregateId);
          if (!doc.payments) doc.payments = [];

          const paymentId = payload.data?.paymentId || payload.paymentId;
          const amount = payload.data?.amount ?? payload.amount ?? 0;
          const paymentMethod =
            payload.data?.paymentMethod || payload.paymentMethod || "TRANSFER";
          const paymentDate =
            payload.data?.paymentDate ||
            payload.paymentDate ||
            new Date().toISOString();
          const proofFileId =
            payload.data?.proofFileId ?? payload.proofFileId ?? null;

          doc.payments.push({
            id: paymentId,
            amount,
            paymentMethod,
            paymentDate,
            proofFileId,
            status: "SUCCESS",
          });

          doc.paidAmount = doc.payments
            .filter((p: any) => p.status === "SUCCESS")
            .reduce((sum: number, p: any) => sum + p.amount, 0);

          doc.paymentStatus =
            doc.paidAmount >= doc.totalAmount ? "PAID" : "PARTIAL";
        }
        break;
      }

      case "RECEIVING_COMPLETED": {
        if (this.documents.has(aggregateId)) {
          const doc = this.documents.get(aggregateId);
          doc.status = "COMPLETED";
        }
        break;
      }

      case "RECEIVING_CANCELLED": {
        if (this.documents.has(aggregateId)) {
          const doc = this.documents.get(aggregateId);
          doc.status = "CANCELLED";
          doc.paymentStatus = "VOID";
          doc.paidAmount = 0;
          doc.cancelReason =
            payload.data?.cancelReason ||
            payload.cancelReason ||
            "Pembatalan Transaksi (VOID)";
          if (doc.payments) {
            doc.payments.forEach((p: any) => (p.status = "VOID"));
          }
        }
        break;
      }

      case "RECEIVING_REOPENED": {
        if (this.documents.has(aggregateId)) {
          const doc = this.documents.get(aggregateId);
          doc.status = "DRAFT";
          doc.paymentStatus = "UNPAID";
          doc.paidAmount = 0;
          doc.isActive = true;
          doc.cancelReason = null;
        }
        break;
      }

      case "RECEIVING_ARCHIVED": {
        if (this.documents.has(aggregateId)) {
          this.documents.get(aggregateId).isActive = false;
        }
        break;
      }

      case "RECEIVING_RESTORED": {
        if (this.documents.has(aggregateId)) {
          this.documents.get(aggregateId).isActive = true;
        }
        break;
      }

      case "RECEIVING_PAYMENT_VOIDED": {
        if (this.documents.has(aggregateId)) {
          const doc = this.documents.get(aggregateId);
          const paymentId = payload.data?.paymentId || payload.paymentId;
          const voidReason =
            payload.data?.voidReason ||
            payload.voidReason ||
            "Pembatalan Cicilan (VOID)";

          if (doc.payments) {
            const targetPay = doc.payments.find((p: any) => p.id === paymentId);
            if (targetPay) {
              targetPay.status = "VOID";
              targetPay.voidReason = voidReason;
            }

            doc.paidAmount = doc.payments
              .filter((p: any) => p.status !== "VOID")
              .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

            doc.paymentStatus =
              doc.paidAmount >= doc.totalAmount
                ? "PAID"
                : doc.paidAmount > 0
                  ? "PARTIAL"
                  : "UNPAID";
          }
        }
        break;
      }
    }
  }

  public getState(): ReceivingState {
    return {
      documents: Array.from(this.documents.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    };
  }

  public reset(): void {
    this.documents.clear();
  }

  public restoreState(state: ReceivingState): void {
    this.documents.clear();
    if (state && state.documents) {
      state.documents.forEach((d) => this.documents.set(d.id, d));
    }
  }
}
