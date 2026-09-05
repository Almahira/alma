// File: modules/mdl_receiving/src/server/event-handlers.ts
import { eq, and } from "drizzle-orm";
import * as schema from "./schema.js";
import { itemProducts } from "../../../mdl_item/src/server/schema.js";

/**
 * DEFENSIVE PARSER: Mencegah 'Invalid time value' secara total
 */
function safeDate(val: any): Date | null {
  if (!val || val === "" || val === "null" || val === "undefined") return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * HELPER: Memperbarui harga HPP (basePrice) & harga jual master item
 * secara dinamis di region / outlet tempat transaksi receiving terjadi.
 */
async function updateProductPricingFromReceiving(
  tx: any,
  p: any,
  items: any[],
) {
  const scopeKey =
    p.location?.outletId ||
    p.outletId ||
    p.location?.regionId ||
    p.regionId ||
    p.organization?.companyId ||
    p.companyId ||
    "DEFAULT";

  for (const item of items) {
    if (item.isExpense) continue; // Abaikan jika ini jasa / biaya operasional

    const currentItem = await tx
      .select()
      .from(itemProducts)
      .where(eq(itemProducts.id, item.itemId))
      .limit(1);

    if (currentItem.length > 0) {
      const currentPricing = currentItem[0].pricing || {};
      const scopePricing = currentPricing[scopeKey] ||
        currentPricing["DEFAULT"] || {
          basePrice: 0,
          marginPercentage: 0,
          sellingPrice: 0,
        };

      const newBasePrice = Math.round(Number(item.price) || 0);
      const margin = Number(scopePricing.marginPercentage) || 0;

      // Hitung ulang harga jual berdasarkan margin produk
      const newSellingPrice =
        margin > 0
          ? Math.round(newBasePrice + newBasePrice * (margin / 100))
          : scopePricing.sellingPrice &&
              scopePricing.sellingPrice > newBasePrice
            ? scopePricing.sellingPrice
            : newBasePrice;

      currentPricing[scopeKey] = {
        basePrice: newBasePrice,
        marginPercentage: margin,
        sellingPrice: newSellingPrice,
      };

      // Set default jika belum pernah ada
      if (!currentPricing["DEFAULT"]) {
        currentPricing["DEFAULT"] = currentPricing[scopeKey];
      }

      await tx
        .update(itemProducts)
        .set({ pricing: currentPricing })
        .where(eq(itemProducts.id, item.itemId));
    }
  }
}

export const receivingHandlers: Record<
  string,
  (tx: any, event: any) => Promise<void>
> = {
  RECEIVING_CREATED: async (tx, event) => {
    const p = event.payload;
    const companyId = p.organization?.companyId || p.companyId;
    const regionId = p.location?.regionId || p.regionId;
    const outletId = p.location?.outletId || p.outletId || null;
    const vendorId = p.reference?.supplierId || p.vendorId || null;
    const documentType =
      p.reference?.documentType || p.documentType || "HUTANG";
    const invoiceNumber = p.reference?.invoiceNumber || p.invoiceNumber;
    const dateVal = p.data?.date || p.date || p.timestamp;
    const dateObj = safeDate(dateVal) || new Date();
    const dueDateObj = safeDate(p.reference?.dueDate) || safeDate(p.dueDate);

    // ---> BULATKAN ANGKA INTEGER RUPIAH <---
    const totalAmount = Math.round(
      Number(p.amount?.total ?? p.totalAmount ?? 0),
    );
    const paidAmount = Math.round(Number(p.amount?.paid ?? p.paidAmount ?? 0));
    const items = p.data?.items || p.items || [];

    await tx.insert(schema.receivingDocuments).values({
      id: event.aggregateId,
      companyId,
      regionId,
      outletId,
      vendorId,
      documentType,
      invoiceNumber,
      date: dateObj,
      dueDate: dueDateObj,
      totalAmount,
      paidAmount,
      status: "DRAFT",
      paymentStatus: dueDateObj ? "UNPAID" : "PAID",
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });

    if (items.length > 0) {
      const itemsToInsert = items.map((item: any) => ({
        id: item.id,
        documentId: event.aggregateId,
        itemId: item.itemId,
        isExpense: item.isExpense || false,
        qty: Number(item.qty) || 1, // Mendukung float desimal (132.2 kg)
        receivedQty: Number(item.receivedQty ?? item.qty) || 1,
        returnedQty: Number(item.returnedQty) || 0,
        price: Math.round(Number(item.price) || 0),
        subtotal: Math.round(
          Number(item.subtotal || Number(item.qty) * Number(item.price)) || 0,
        ),
        itemStatus: item.itemStatus || "RECEIVED",
      }));
      await tx.insert(schema.receivingItems).values(itemsToInsert);

      // ---> PEMBARUAN HARGA MASTER ITEM DINAMIS DI POSTGRESQL <---
      await updateProductPricingFromReceiving(tx, p, items);
    }
  },

  RECEIVING_UPDATED: async (tx, event) => {
    const p = event.payload;
    const invoiceNumber = p.reference?.invoiceNumber || p.invoiceNumber;
    const vendorId = p.reference?.supplierId || p.vendorId || null;
    const dateVal = p.data?.date || p.date || p.timestamp;
    const dateObj = safeDate(dateVal) || new Date();
    const dueDateObj = safeDate(p.reference?.dueDate) || safeDate(p.dueDate);
    const totalAmount = Math.round(
      Number(p.amount?.total ?? p.totalAmount ?? 0),
    );
    const items = p.data?.items || p.items || [];

    await tx
      .update(schema.receivingDocuments)
      .set({
        invoiceNumber,
        vendorId,
        date: dateObj,
        dueDate: dueDateObj,
        totalAmount,
        paymentStatus: dueDateObj ? "UNPAID" : "PAID",
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.receivingDocuments.id, event.aggregateId));

    if (items.length > 0) {
      await tx
        .delete(schema.receivingItems)
        .where(eq(schema.receivingItems.documentId, event.aggregateId));

      const itemsToInsert = items.map((item: any) => ({
        id: item.id,
        documentId: event.aggregateId,
        itemId: item.itemId,
        isExpense: item.isExpense || false,
        qty: Number(item.qty) || 1,
        receivedQty: Number(item.receivedQty ?? item.qty) || 1,
        returnedQty: Number(item.returnedQty) || 0,
        price: Math.round(Number(item.price) || 0),
        subtotal: Math.round(
          Number(item.subtotal || Number(item.qty) * Number(item.price)) || 0,
        ),
        itemStatus: "RECEIVED",
      }));
      await tx.insert(schema.receivingItems).values(itemsToInsert);

      // ---> PEMBARUAN HARGA MASTER ITEM DINAMIS DI POSTGRESQL SAAT UPDATE <---
      await updateProductPricingFromReceiving(tx, p, items);
    }
  },

  RECEIVING_PAYMENT_ADDED: async (tx, event) => {
    const p = event.payload;

    const paymentAmount = Math.round(
      Number(
        p.data?.amount ??
          (typeof p.amount === "number"
            ? p.amount
            : (p.amount?.total ?? p.amount?.paid ?? 0)),
      ),
    );

    const docId = p.data?.documentId || p.reference?.documentId || p.documentId;
    const paymentId = p.data?.paymentId || event.aggregateId;

    // 1. Simpan riwayat pembayaran
    await tx.insert(schema.receivingPayments).values({
      id: paymentId,
      documentId: docId,
      amount: paymentAmount,
      paymentMethod: p.data?.paymentMethod || p.paymentMethod || "CASH",
      paymentDate: safeDate(
        p.timestamp || p.data?.paymentDate || p.paymentDate,
      ),
      proofFileId: p.data?.proofFileId || p.proofFileId || null,
      status: "SUCCESS",
    });

    // 2. Perbarui status pembayaran & paidAmount pada dokumen induk
    if (docId) {
      const existingDocs = await tx
        .select()
        .from(schema.receivingDocuments)
        .where(eq(schema.receivingDocuments.id, docId))
        .limit(1);

      if (existingDocs.length > 0) {
        const doc = existingDocs[0];
        const currentPaid = Number(doc.paidAmount || 0);
        const totalAmount = Number(doc.totalAmount || 0);
        const newPaid = currentPaid + paymentAmount;
        const newStatus = newPaid >= totalAmount ? "PAID" : "PARTIAL";

        await tx
          .update(schema.receivingDocuments)
          .set({
            paidAmount: newPaid,
            paymentStatus: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(schema.receivingDocuments.id, docId));
      }
    }
  },

  RECEIVING_PAYMENT_VOIDED: async (tx, event) => {
    const paymentId = event.payload.data?.paymentId || event.payload.paymentId;
    const voidReason =
      event.payload.data?.voidReason ||
      event.payload.voidReason ||
      "Pembatalan Cicilan (VOID)";

    await tx
      .update(schema.receivingPayments)
      .set({
        status: "VOID",
        voidReason,
      })
      .where(eq(schema.receivingPayments.id, paymentId));

    const validPayments = await tx
      .select()
      .from(schema.receivingPayments)
      .where(
        and(
          eq(schema.receivingPayments.documentId, event.aggregateId),
          eq(schema.receivingPayments.status, "SUCCESS"),
        ),
      );

    const newPaidAmount = validPayments.reduce(
      (sum: number, p: any) => sum + Math.round(Number(p.amount || 0)),
      0,
    );

    const currentDoc = await tx
      .select()
      .from(schema.receivingDocuments)
      .where(eq(schema.receivingDocuments.id, event.aggregateId))
      .limit(1);

    if (currentDoc.length > 0) {
      const paymentStatus =
        newPaidAmount >= currentDoc[0].totalAmount
          ? "PAID"
          : newPaidAmount > 0
            ? "PARTIAL"
            : "UNPAID";

      await tx
        .update(schema.receivingDocuments)
        .set({
          paidAmount: newPaidAmount,
          paymentStatus,
          aggregateVersion: event.aggregateVersion,
          lastEventId: event.id,
        })
        .where(eq(schema.receivingDocuments.id, event.aggregateId));
    }
  },

  RECEIVING_COMPLETED: async (tx, event) => {
    await tx
      .update(schema.receivingDocuments)
      .set({
        status: "COMPLETED",
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.receivingDocuments.id, event.aggregateId));

    const p = event.payload;
    const documentType = p.reference?.documentType || p.documentType;

    if (documentType !== "PIUTANG") {
      const docItems = await tx
        .select()
        .from(schema.receivingItems)
        .where(eq(schema.receivingItems.documentId, event.aggregateId));

      if (docItems.length > 0) {
        await updateProductPricingFromReceiving(tx, p, docItems);
      }
    }
  },

  RECEIVING_CANCELLED: async (tx, event) => {
    const cancelReason =
      event.payload.data?.cancelReason ||
      event.payload.cancelReason ||
      "Pembatalan Transaksi (VOID)";

    await tx
      .update(schema.receivingDocuments)
      .set({
        status: "CANCELLED",
        paymentStatus: "VOID",
        paidAmount: 0,
        cancelReason,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.receivingDocuments.id, event.aggregateId));

    await tx
      .update(schema.receivingPayments)
      .set({
        status: "VOID",
        voidReason: "Dokumen transaksi dibatalkan (VOID)",
      })
      .where(eq(schema.receivingPayments.documentId, event.aggregateId));
  },

  RECEIVING_REOPENED: async (tx, event) => {
    await tx
      .update(schema.receivingDocuments)
      .set({
        status: "DRAFT",
        paymentStatus: "UNPAID",
        paidAmount: 0,
        cancelReason: null,
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.receivingDocuments.id, event.aggregateId));
  },

  RECEIVING_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.receivingDocuments)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.receivingDocuments.id, event.aggregateId));
  },

  RECEIVING_RESTORED: async (tx, event) => {
    await tx
      .update(schema.receivingDocuments)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.receivingDocuments.id, event.aggregateId));
  },
};
