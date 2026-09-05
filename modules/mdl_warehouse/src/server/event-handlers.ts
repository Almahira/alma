// File: modules/mdl_warehouse/src/server/event-handlers.ts
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";

function safeDate(val: any): Date {
  if (!val || val === "" || val === "null") return new Date();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

export const warehouseHandlers: Record<
  string,
  (tx: any, event: any) => Promise<void>
> = {
  // DISTRIBUSI
  TX_DISTRIBUTION_CREATED: async (tx, event) => {
    const p = event.payload;
    await tx.insert(schema.warehouseDistributions).values({
      id: event.aggregateId,
      companyId: p.organization?.companyId || p.companyId || "",
      regionId: p.location?.regionId || p.regionId || "",
      outletId: p.location?.outletId || p.outletId || "",
      date: safeDate(p.timestamp || p.date),
      documentNumber:
        p.reference?.documentNumber || p.documentNumber || `DST-${Date.now()}`,
      divisionId: p.reference?.divisionId || p.divisionId,
      divisionName: p.reference?.divisionName || p.divisionName || "KITCHEN",
      itemId: p.data?.itemId || p.itemId,
      itemName: p.data?.itemName || p.itemName,
      uomId: p.data?.uomId || p.uomId,
      uomName: p.data?.uomName || p.uomName || "PCS",
      qty: p.quantity?.ordered ?? p.qty ?? 1,
      unitCost: p.data?.unitCost ?? p.unitCost ?? 0,
      totalCost: p.amount?.total ?? p.totalCost ?? 0,
      notes: p.data?.notes || p.notes || null,
      status: p.status || "COMPLETED",
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  TX_DISTRIBUTION_UPDATED: async (tx, event) => {
    const p = event.payload;
    const dateObj = safeDate(p.timestamp || p.date);
    const qty = Number(p.quantity?.ordered ?? p.qty ?? 1);
    const unitCost = Math.round(Number(p.data?.unitCost ?? p.unitCost ?? 0));
    const totalCost = Math.round(
      Number(p.amount?.total ?? p.totalCost ?? qty * unitCost),
    );

    await tx
      .update(schema.warehouseDistributions)
      .set({
        date: dateObj, // <--- UPDATE TANGGAL DI POSTGRESQL
        divisionId: p.reference?.divisionId || p.divisionId,
        divisionName: p.reference?.divisionName || p.divisionName,
        itemId: p.data?.itemId || p.itemId,
        itemName: p.data?.itemName || p.itemName,
        uomId: p.data?.uomId || p.uomId,
        uomName: p.data?.uomName || p.uomName,
        qty,
        unitCost,
        totalCost,
        notes: p.data?.notes || p.notes || null,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.warehouseDistributions.id, event.aggregateId));
  },
  TX_DISTRIBUTION_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.warehouseDistributions)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.warehouseDistributions.id, event.aggregateId));
  },
  TX_DISTRIBUTION_RESTORED: async (tx, event) => {
    await tx
      .update(schema.warehouseDistributions)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.warehouseDistributions.id, event.aggregateId));
  },

  // STOK AWAL & OPNAME
  TX_INITIAL_STOCK_SET: async (tx, event) => {
    const p = event.payload;
    const stockId = `${p.location?.outletId || p.outletId}_${p.data?.itemId || p.itemId}`;
    await tx
      .insert(schema.warehouseInitialStocks)
      .values({
        id: stockId,
        companyId: p.organization?.companyId || p.companyId || "",
        outletId: p.location?.outletId || p.outletId || "",
        itemId: p.data?.itemId || p.itemId,
        initialQty: Number(p.data?.initialQty ?? p.initialQty ?? 0),
        lastAdjustedDate: safeDate(p.timestamp || p.date),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.warehouseInitialStocks.id,
        set: {
          initialQty: Number(p.data?.initialQty ?? p.initialQty ?? 0),
          lastAdjustedDate: safeDate(p.timestamp || p.date),
          updatedAt: new Date(),
        },
      });
  },
  TX_STOCK_OPNAME_COMPLETED: async (tx, event) => {
    const p = event.payload;
    const items = p.data?.items || [];
    const outletId = p.location?.outletId || p.outletId || "";
    const companyId = p.organization?.companyId || p.companyId || "";
    const regionId = p.location?.regionId || p.regionId || "";

    await tx.insert(schema.warehouseStockOpnames).values({
      id: event.aggregateId,
      companyId,
      regionId,
      outletId,
      date: safeDate(p.timestamp || p.date),
      documentNumber:
        p.reference?.documentNumber || p.documentNumber || `OPN-${Date.now()}`,
      totalItemsCounted: items.length,
      totalVarianceQty: p.amount?.balance || p.totalVarianceQty || 0,
      totalVarianceCost: p.amount?.total || p.totalVarianceCost || 0,
      status: "COMPLETED",
      notes: p.data?.notes || null,
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });

    if (items.length > 0) {
      const itemsToInsert = items.map((it: any) => ({
        id:
          it.id ||
          `OPNITM_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        opnameId: event.aggregateId,
        itemId: it.itemId,
        itemName: it.itemName,
        uomName: it.uomName || "PCS",
        initialStock: it.initialStock || 0,
        stockIn: it.stockIn || 0,
        stockOut: it.stockOut || 0,
        systemStock: it.systemStock || 0,
        physicalStock: it.physicalStock || 0,
        varianceQty: it.varianceQty || 0,
        unitCost: it.unitCost || 0,
        previousUnitCost: it.previousUnitCost || 0,
        varianceCost: it.varianceCost || 0,
        notes: it.notes || null,
      }));
      await tx.insert(schema.warehouseStockOpnameItems).values(itemsToInsert);

      for (const it of items) {
        const stockId = `${outletId}_${it.itemId}`;
        await tx
          .insert(schema.warehouseInitialStocks)
          .values({
            id: stockId,
            companyId,
            outletId,
            itemId: it.itemId,
            initialQty: Number(it.physicalStock || 0),
            lastAdjustedDate: safeDate(p.timestamp || p.date),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.warehouseInitialStocks.id,
            set: {
              initialQty: Number(it.physicalStock || 0),
              lastAdjustedDate: safeDate(p.timestamp || p.date),
              updatedAt: new Date(),
            },
          });
      }
    }
  },
  TX_STOCK_OPNAME_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.warehouseStockOpnames)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.warehouseStockOpnames.id, event.aggregateId));
  },
  TX_STOCK_OPNAME_RESTORED: async (tx, event) => {
    await tx
      .update(schema.warehouseStockOpnames)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.warehouseStockOpnames.id, event.aggregateId));
  },

  // SPOIL & WASTE
  TX_SPOIL_WASTE_CREATED: async (tx, event) => {
    const p = event.payload;
    const items = p.data?.spoilItems || [p.data];

    for (const it of items) {
      const rowId =
        it.id ||
        `SPW_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await tx.insert(schema.warehouseSpoilWastes).values({
        id: rowId,
        companyId: p.organization?.companyId || p.companyId || "",
        regionId: p.location?.regionId || p.regionId || "",
        outletId: p.location?.outletId || p.outletId || "",
        date: safeDate(p.timestamp || p.date),
        documentNumber:
          p.reference?.documentNumber ||
          p.documentNumber ||
          `SPW-${Date.now()}`,
        type: p.data?.type || p.type || "SPOIL",
        divisionId: p.reference?.divisionId || p.divisionId || null,
        divisionName: p.reference?.divisionName || p.divisionName || "KITCHEN",
        menuItemId: p.data?.menuItemId || it.menuItemId || null,
        menuItemName: p.data?.menuItemName || it.menuItemName || null,
        menuPortionQty: p.data?.menuPortionQty || it.menuPortionQty || 1,
        itemId: it.itemId,
        itemName: it.itemName,
        inputQty: it.inputQty || 1,
        inputUom: it.inputUom || "PCS",
        convertedBaseQty: it.convertedBaseQty || it.inputQty || 1,
        baseUom: it.baseUom || "PCS",
        unitCost: it.unitCost || 0,
        totalLossCost: it.totalLossCost || 0,
        notes: it.notes || p.data?.notes || null,
        status: "COMPLETED",
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      });
    }
  },
  TX_SPOIL_WASTE_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.warehouseSpoilWastes)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.warehouseSpoilWastes.id, event.aggregateId));
  },
  TX_SPOIL_WASTE_RESTORED: async (tx, event) => {
    await tx
      .update(schema.warehouseSpoilWastes)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.warehouseSpoilWastes.id, event.aggregateId));
  },

  // ================= 5. MASTER RESEP (BOM MULTI-TIER) =================
  TX_RECIPE_CREATED: async (tx, event) => {
    const p = event.payload;
    await tx.insert(schema.warehouseRecipes).values({
      id: event.aggregateId,
      companyId: p.organization?.companyId || p.companyId || "",
      outletId: p.location?.outletId || p.outletId || null,
      name: p.reference?.name || p.data?.name || p.name || "Resep Baru",
      uomName: p.data?.uomName || p.uomName || "PORSI",
      foodCostPercentage: Number(
        p.data?.foodCostPercentage || p.foodCostPercentage || 30,
      ),
      totalHppCost: Number(p.amount?.total || p.totalHppCost || 0),
      idealSellingPrice: Number(
        p.data?.idealSellingPrice || p.idealSellingPrice || 0,
      ),
      rawMaterials: p.data?.rawMaterials || [],
      subRecipes: p.data?.subRecipes || [],
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  TX_RECIPE_UPDATED: async (tx, event) => {
    const p = event.payload;
    await tx
      .update(schema.warehouseRecipes)
      .set({
        name: p.reference?.name || p.data?.name || p.name,
        uomName: p.data?.uomName || p.uomName,
        foodCostPercentage: Number(
          p.data?.foodCostPercentage || p.foodCostPercentage || 30,
        ),
        totalHppCost: Number(p.amount?.total || p.totalHppCost || 0),
        idealSellingPrice: Number(
          p.data?.idealSellingPrice || p.idealSellingPrice || 0,
        ),
        rawMaterials: p.data?.rawMaterials || [],
        subRecipes: p.data?.subRecipes || [],
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.warehouseRecipes.id, event.aggregateId));
  },
  TX_RECIPE_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.warehouseRecipes)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.warehouseRecipes.id, event.aggregateId));
  },
  TX_RECIPE_RESTORED: async (tx, event) => {
    await tx
      .update(schema.warehouseRecipes)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.warehouseRecipes.id, event.aggregateId));
  },
};
