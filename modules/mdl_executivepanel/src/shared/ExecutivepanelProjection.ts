// File: modules/mdl_executivepanel/src/shared/ExecutivepanelProjection.ts
import { ProjectionHandler } from "../../../../packages/core_unv/src/cqrs/types";
import { LedgerEventDoc } from "../../../../packages/core_unv/src/ledger/schema";

export interface TargetConfigDoc {
  id: string;
  companyId: string;
  outletId: string;
  month: string;
  targetSales: number;
  foodSalesTargetPct: number;
  beverageSalesTargetPct: number;
  cogsBudgetPct: number;
  opexBudgetLimit: number;
  payrollBudgetLimit: number;
  bankFeePct: number;
  isActive: boolean;
}

export interface AllocationDoc {
  id: string;
  companyId: string;
  outletId?: string | null;
  month: string;
  name: string;
  percentage: number;
  nominal: number;
  isActive: boolean;
}

export interface OwnerLedgerDoc {
  id: string;
  companyId: string;
  regionId?: string | null;
  outletId?: string | null;
  date: string;
  documentNumber: string;
  category: "PRIVE" | "GAJI_HOLDING" | "DEVIDEN_MITRA" | "PROYEK";
  recipientName: string;
  percentage: number;
  amount: number;
  sourceFund: string;
  notes?: string | null;
  status: string;
  isActive: boolean;
}

export interface ExecutivePanelState {
  targets: Record<string, TargetConfigDoc>;
  allocations: AllocationDoc[];
  ownerLedgers: OwnerLedgerDoc[];
}

export class ExecutivePanelProjection implements ProjectionHandler<ExecutivePanelState> {
  aggregateType = "EXECUTIVE_PANEL";
  listenTo = [
    "TX_EXECUTIVE_PANEL",
    "ORGANIZATION",
    "RECEIVING_DOCUMENT",
    "PLUSALES_DOCUMENT",
    "WAREHOUSE_DOCUMENT",
  ];

  private targets = new Map<string, TargetConfigDoc>();
  private allocations = new Map<string, AllocationDoc>();
  private ownerLedgers = new Map<string, OwnerLedgerDoc>();

  public applyEvent(event: LedgerEventDoc): void {
    const { type, payload, aggregateId } = event;

    switch (type) {
      // 1. TARGET
      case "EXECUTIVE_TARGET_SET": {
        const outletId = payload.location?.outletId || payload.outletId || "";
        const month = payload.data?.month || payload.month || "";
        const key = `${outletId}_${month}`;
        this.targets.set(key, {
          id: key,
          companyId: payload.organization?.companyId || payload.companyId || "",
          outletId,
          month,
          targetSales: Math.round(
            Number(payload.data?.targetSales ?? payload.targetSales ?? 0),
          ),
          foodSalesTargetPct: Number(
            payload.data?.foodSalesTargetPct ??
              payload.foodSalesTargetPct ??
              85,
          ),
          beverageSalesTargetPct: Number(
            payload.data?.beverageSalesTargetPct ??
              payload.beverageSalesTargetPct ??
              15,
          ),
          cogsBudgetPct: Number(
            payload.data?.cogsBudgetPct ?? payload.cogsBudgetPct ?? 35,
          ),
          opexBudgetLimit: Math.round(
            Number(
              payload.data?.opexBudgetLimit ?? payload.opexBudgetLimit ?? 0,
            ),
          ),
          payrollBudgetLimit: Math.round(
            Number(
              payload.data?.payrollBudgetLimit ??
                payload.payrollBudgetLimit ??
                0,
            ),
          ),
          bankFeePct: Number(
            payload.data?.bankFeePct ?? payload.bankFeePct ?? 0.7,
          ),
          isActive: true,
        });
        break;
      }

      // ALOKASI CADANGAN
      case "EXECUTIVE_ALLOCATION_SET": {
        this.allocations.set(aggregateId, {
          id: aggregateId,
          companyId: payload.organization?.companyId || payload.companyId || "",
          outletId: payload.location?.outletId || payload.outletId || null,
          month:
            payload.data?.month ||
            payload.month ||
            new Date().toISOString().slice(0, 7),
          name: payload.data?.name || payload.name,
          percentage: Number(
            payload.data?.percentage ?? payload.percentage ?? 0,
          ),
          nominal: Math.round(
            Number(payload.data?.nominal ?? payload.nominal ?? 0),
          ),
          isActive: true,
        });
        break;
      }
      case "EXECUTIVE_ALLOCATION_ARCHIVED":
        if (this.allocations.has(aggregateId))
          this.allocations.get(aggregateId)!.isActive = false;
        break;

      // 3. PENARIKAN OWNER & DEVIDEN
      case "TX_OWNER_LEDGER_CREATED": {
        this.ownerLedgers.set(aggregateId, {
          id: aggregateId,
          companyId: payload.organization?.companyId || payload.companyId || "",
          regionId: payload.location?.regionId || payload.regionId || null,
          outletId: payload.location?.outletId || payload.outletId || null,
          date: payload.timestamp || payload.date || new Date().toISOString(),
          documentNumber:
            payload.reference?.documentNumber ||
            payload.documentNumber ||
            `OWN-${Date.now()}`,
          category: payload.data?.category || payload.category || "PRIVE",
          recipientName:
            payload.data?.recipientName || payload.recipientName || "Pemilik",
          percentage: Number(
            payload.data?.percentage ?? payload.percentage ?? 0,
          ),
          amount: Math.round(
            Number(payload.amount?.total ?? payload.amount ?? 0),
          ),
          sourceFund:
            payload.data?.sourceFund || payload.sourceFund || "TRANSFER_BANK",
          notes: payload.data?.notes || payload.notes || null,
          status: "COMPLETED",
          isActive: true,
        });
        break;
      }
      case "TX_OWNER_LEDGER_ARCHIVED":
        if (this.ownerLedgers.has(aggregateId))
          this.ownerLedgers.get(aggregateId)!.isActive = false;
        break;
      case "TX_OWNER_LEDGER_RESTORED":
        if (this.ownerLedgers.has(aggregateId))
          this.ownerLedgers.get(aggregateId)!.isActive = true;
        break;
    }
  }

  public getState(): ExecutivePanelState {
    const targetsObj: Record<string, TargetConfigDoc> = {};
    this.targets.forEach((val, key) => {
      targetsObj[key] = val;
    });

    return {
      targets: targetsObj,
      allocations: Array.from(this.allocations.values()).filter(
        (a) => a.isActive !== false,
      ),
      ownerLedgers: Array.from(this.ownerLedgers.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    };
  }

  public reset(): void {
    this.targets.clear();
    this.allocations.clear();
    this.ownerLedgers.clear();
  }

  public restoreState(state: ExecutivePanelState): void {
    this.reset();
    if (state) {
      if (state.targets) {
        Object.entries(state.targets).forEach(([k, v]) =>
          this.targets.set(k, v),
        );
      }
      state.allocations?.forEach((a) => this.allocations.set(a.id, a));
      state.ownerLedgers?.forEach((o) => this.ownerLedgers.set(o.id, o));
    }
  }
}
