// File: modules/mdl_vendor/src/server/event-handlers.ts
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";

export const vendorHandlers: Record<
  string,
  (tx: any, event: any) => Promise<void>
> = {
  VENDOR_CREATED: async (tx, event) => {
    await tx.insert(schema.vendors).values({
      id: event.aggregateId,
      companyId: event.payload.companyId,
      regionId: event.payload.regionId || null,
      outletId: event.payload.outletId || null,
      name: event.payload.name,
      contactNumber: event.payload.contactNumber || null,
      bankName: event.payload.bankName || null,
      bankAccount: event.payload.bankAccount || null,
      bankAccountName: event.payload.bankAccountName || null,
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  VENDOR_UPDATED: async (tx, event) => {
    await tx
      .update(schema.vendors)
      .set({
        name: event.payload.name,
        contactNumber: event.payload.contactNumber || null,
        bankName: event.payload.bankName || null,
        bankAccount: event.payload.bankAccount || null,
        bankAccountName: event.payload.bankAccountName || null,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.vendors.id, event.aggregateId));
  },
  VENDOR_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.vendors)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.vendors.id, event.aggregateId));
  },
  VENDOR_RESTORED: async (tx, event) => {
    await tx
      .update(schema.vendors)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.vendors.id, event.aggregateId));
  },

  // LOGIKA DOKUMEN VENDOR
  VENDOR_DOCUMENT_ATTACHED: async (tx, event) => {
    await tx
      .insert(schema.vendorDocuments)
      .values({
        id: event.payload.documentId,
        vendorId: event.aggregateId,
        name: event.payload.documentName,
        fileName: event.payload.fileName,
        fileType: event.payload.fileType || "unknown",
        size: event.payload.size || 0,
      })
      .onConflictDoNothing();
  },
  VENDOR_DOCUMENT_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.vendorDocuments)
      .set({ isActive: false })
      .where(eq(schema.vendorDocuments.id, event.payload.documentId));
  },
};
