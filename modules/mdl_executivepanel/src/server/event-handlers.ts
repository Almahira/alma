// File: modules/mdl_executivepanel/src/server/event-handlers.ts
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";

function safeDate(val: any): Date {
  if (!val || val === "" || val === "null") return new Date();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

export const executivepanelHandlers: Record<
  string,
  (tx: any, event: any) => Promise<void>
> = {
  // 1. TARGET & KUOTA
  EXECUTIVE_TARGET_SET: async (tx, event) => {
    const p = event.payload;
    const targetId = `${p.location?.outletId || p.outletId}_${p.data?.month || p.month}`;
    await tx
      .insert(schema.executiveTargets)
      .values({
        id: targetId,
        companyId: p.organization?.companyId || p.companyId || "",
        outletId: p.location?.outletId || p.outletId || "",
        month: p.data?.month || p.month,
        targetSales: Math.round(
          Number(p.data?.targetSales ?? p.targetSales ?? 0),
        ),
        foodSalesTargetPct: Number(
          p.data?.foodSalesTargetPct ?? p.foodSalesTargetPct ?? 85,
        ),
        beverageSalesTargetPct: Number(
          p.data?.beverageSalesTargetPct ?? p.beverageSalesTargetPct ?? 15,
        ),
        cogsBudgetPct: Number(p.data?.cogsBudgetPct ?? p.cogsBudgetPct ?? 35),
        opexBudgetLimit: Math.round(
          Number(p.data?.opexBudgetLimit ?? p.opexBudgetLimit ?? 0),
        ),
        payrollBudgetLimit: Math.round(
          Number(p.data?.payrollBudgetLimit ?? p.payrollBudgetLimit ?? 0),
        ),
        bankFeePct: Number(p.data?.bankFeePct ?? p.bankFeePct ?? 0.7),
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .onConflictDoUpdate({
        target: schema.executiveTargets.id,
        set: {
          targetSales: Math.round(
            Number(p.data?.targetSales ?? p.targetSales ?? 0),
          ),
          foodSalesTargetPct: Number(
            p.data?.foodSalesTargetPct ?? p.foodSalesTargetPct ?? 85,
          ),
          beverageSalesTargetPct: Number(
            p.data?.beverageSalesTargetPct ?? p.beverageSalesTargetPct ?? 15,
          ),
          cogsBudgetPct: Number(p.data?.cogsBudgetPct ?? p.cogsBudgetPct ?? 35),
          opexBudgetLimit: Math.round(
            Number(p.data?.opexBudgetLimit ?? p.opexBudgetLimit ?? 0),
          ),
          payrollBudgetLimit: Math.round(
            Number(p.data?.payrollBudgetLimit ?? p.payrollBudgetLimit ?? 0),
          ),
          bankFeePct: Number(p.data?.bankFeePct ?? p.bankFeePct ?? 0.7),
          aggregateVersion: event.aggregateVersion,
          lastEventId: event.id,
          updatedAt: new Date(),
        },
      });
  },

  EXECUTIVE_ALLOCATION_SET: async (tx, event) => {
    const p = event.payload;
    await tx.insert(schema.executiveAllocations).values({
      id: event.aggregateId,
      companyId: p.organization?.companyId || p.companyId || "",
      outletId: p.location?.outletId || p.outletId || null,
      month: p.data?.month || p.month || new Date().toISOString().slice(0, 7),
      name: p.data?.name || p.name,
      percentage: Number(p.data?.percentage ?? p.percentage ?? 0),
      nominal: Math.round(Number(p.data?.nominal ?? p.nominal ?? 0)),
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },

  EXECUTIVE_ALLOCATION_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.executiveAllocations)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.executiveAllocations.id, event.aggregateId));
  },

  // 3. PENARIKAN OWNER & DEVIDEN
  TX_OWNER_LEDGER_CREATED: async (tx, event) => {
    const p = event.payload;
    await tx.insert(schema.executiveOwnerLedger).values({
      id: event.aggregateId,
      companyId: p.organization?.companyId || p.companyId || "",
      regionId: p.location?.regionId || p.regionId || null,
      outletId: p.location?.outletId || p.outletId || null,
      date: safeDate(p.timestamp || p.date),
      documentNumber:
        p.reference?.documentNumber || p.documentNumber || `OWN-${Date.now()}`,
      category: p.data?.category || p.category || "PRIVE",
      recipientName: p.data?.recipientName || p.recipientName || "Pemilik",
      percentage: Number(p.data?.percentage ?? p.percentage ?? 0),
      amount: Math.round(Number(p.amount?.total ?? p.amount ?? 0)),
      sourceFund: p.data?.sourceFund || p.sourceFund || "TRANSFER_BANK",
      notes: p.data?.notes || p.notes || null,
      status: "COMPLETED",
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },

  TX_OWNER_LEDGER_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.executiveOwnerLedger)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.executiveOwnerLedger.id, event.aggregateId));
  },

  TX_OWNER_LEDGER_RESTORED: async (tx, event) => {
    await tx
      .update(schema.executiveOwnerLedger)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.executiveOwnerLedger.id, event.aggregateId));
  },
};
