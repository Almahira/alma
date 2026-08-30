// File: modules/mdl_item/src/server/event-handlers.ts
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";

export const itemHandlers: Record<
  string,
  (tx: any, event: any) => Promise<void>
> = {
  CATEGORY_CREATED: async (tx, event) => {
    await tx.insert(schema.itemCategories).values({
      id: event.aggregateId,
      name: event.payload.name,
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  CATEGORY_UPDATED: async (tx, event) => {
    await tx
      .update(schema.itemCategories)
      .set({
        name: event.payload.name,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.itemCategories.id, event.aggregateId));
  },

  UOM_CREATED: async (tx, event) => {
    await tx.insert(schema.itemUoms).values({
      id: event.aggregateId,
      name: event.payload.name,
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  UOM_UPDATED: async (tx, event) => {
    await tx
      .update(schema.itemUoms)
      .set({
        name: event.payload.name,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.itemUoms.id, event.aggregateId));
  },

  PRODUCT_CREATED: async (tx, event) => {
    await tx.insert(schema.itemProducts).values({
      id: event.aggregateId,
      categoryId: event.payload.categoryId,
      uomId: event.payload.uomId,
      companyId: event.payload.companyId,
      regionId: event.payload.regionId || null,
      outletId: event.payload.outletId || null,
      name: event.payload.name,
      isExpense: Boolean(event.payload.isExpense), // <--- SIMPAN EKSPLISIT
      pricing: event.payload.pricing || {},
      approvalStatus: event.payload.approvalStatus || "PENDING",
      validateId: event.payload.validateId || null,
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  PRODUCT_UPDATED: async (tx, event) => {
    await tx
      .update(schema.itemProducts)
      .set({
        categoryId: event.payload.categoryId,
        uomId: event.payload.uomId,
        name: event.payload.name,
        isExpense:
          event.payload.isExpense !== undefined
            ? Boolean(event.payload.isExpense)
            : undefined,
        pricing: event.payload.pricing,
        approvalStatus: event.payload.nameChanged ? "PENDING" : undefined,
        validateId: event.payload.nameChanged ? null : undefined,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.itemProducts.id, event.aggregateId));
  },
  PRODUCT_VALIDATED: async (tx, event) => {
    await tx
      .update(schema.itemProducts)
      .set({
        approvalStatus: event.payload.approvalStatus,
        validateId: event.payload.validateId || null,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.itemProducts.id, event.aggregateId));
  },
  PRODUCT_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.itemProducts)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.itemProducts.id, event.aggregateId));
  },
  PRODUCT_RESTORED: async (tx, event) => {
    await tx
      .update(schema.itemProducts)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.itemProducts.id, event.aggregateId));
  },
};
