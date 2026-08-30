// File: modules/mdl_plusales/src/server/event-handlers.ts
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";
function safeDate(val) {
    if (!val || val === "" || val === "null")
        return new Date();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
}
export const plusalesHandlers = {
    TX_PLUSALES_CREATED: async (tx, event) => {
        const p = event.payload;
        const dynamicItems = p.data?.dynamicItems || [];
        const companyId = p.organization?.companyId || p.companyId || "";
        const regionId = p.location?.regionId || p.regionId || "";
        const outletId = p.location?.outletId || p.outletId || "";
        await tx.insert(schema.plusalesDocuments).values({
            id: event.aggregateId,
            companyId,
            regionId,
            outletId,
            date: safeDate(p.timestamp || p.date),
            documentNumber: p.reference?.documentNumber || p.documentNumber || `SLS-${Date.now()}`,
            grossSales: p.amount?.subtotal || p.grossSales || 0,
            discount: p.amount?.discount || p.discount || 0,
            tax: p.amount?.tax || p.tax || 0,
            service: p.data?.service || p.service || 0,
            netSales: p.amount?.total || p.netSales || 0,
            totalSettlement: p.data?.totalSettlement || 0,
            totalPettycash: p.data?.totalPettycash || 0,
            cashOnHand: p.data?.cashOnHand || 0,
            balanceDifference: p.amount?.balance || p.balanceDifference || 0,
            discrepancyNote: p.data?.discrepancyNote || null,
            proofFileId: p.data?.proofFileId || null,
            status: p.status || "COMPLETED",
            isActive: true,
            aggregateVersion: event.aggregateVersion,
            lastEventId: event.id,
        });
        if (dynamicItems.length > 0) {
            const itemsToInsert = dynamicItems.map((item) => ({
                id: item.id ||
                    `PLUITM_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                documentId: event.aggregateId,
                category: item.category || "SETTLEMENT",
                name: item.name,
                amount: item.amount || 0,
            }));
            await tx.insert(schema.plusalesDynamicItems).values(itemsToInsert);
        }
    },
    TX_PLUSALES_UPDATED: async (tx, event) => {
        const p = event.payload;
        const dynamicItems = p.data?.dynamicItems || [];
        await tx
            .update(schema.plusalesDocuments)
            .set({
            grossSales: p.amount?.subtotal || p.grossSales,
            discount: p.amount?.discount || p.discount,
            tax: p.amount?.tax || p.tax,
            service: p.data?.service || p.service,
            netSales: p.amount?.total || p.netSales,
            totalSettlement: p.data?.totalSettlement,
            totalPettycash: p.data?.totalPettycash,
            cashOnHand: p.data?.cashOnHand,
            balanceDifference: p.amount?.balance || p.balanceDifference,
            discrepancyNote: p.data?.discrepancyNote || null,
            proofFileId: p.data?.proofFileId || null,
            aggregateVersion: event.aggregateVersion,
            lastEventId: event.id,
        })
            .where(eq(schema.plusalesDocuments.id, event.aggregateId));
        if (dynamicItems.length > 0) {
            await tx
                .delete(schema.plusalesDynamicItems)
                .where(eq(schema.plusalesDynamicItems.documentId, event.aggregateId));
            const itemsToInsert = dynamicItems.map((item) => ({
                id: item.id ||
                    `PLUITM_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                documentId: event.aggregateId,
                category: item.category || "SETTLEMENT",
                name: item.name,
                amount: item.amount || 0,
            }));
            await tx.insert(schema.plusalesDynamicItems).values(itemsToInsert);
        }
    },
    TX_PLUSALES_ARCHIVED: async (tx, event) => {
        await tx
            .update(schema.plusalesDocuments)
            .set({
            isActive: false,
            aggregateVersion: event.aggregateVersion,
            lastEventId: event.id,
        })
            .where(eq(schema.plusalesDocuments.id, event.aggregateId));
    },
    TX_PLUSALES_RESTORED: async (tx, event) => {
        await tx
            .update(schema.plusalesDocuments)
            .set({
            isActive: true,
            aggregateVersion: event.aggregateVersion,
            lastEventId: event.id,
        })
            .where(eq(schema.plusalesDocuments.id, event.aggregateId));
    },
};
