// File: modules/mdl_warehouse/src/shared/WarehouseProjection.ts
import { ProjectionHandler } from "../../../../packages/core_unv/src/cqrs/types";
import { LedgerEventDoc } from "../../../../packages/core_unv/src/ledger/schema";

export interface DistributionDoc {
  id: string;
  companyId: string;
  regionId: string;
  outletId: string;
  date: string;
  documentNumber: string;
  divisionId: string;
  divisionName: string;
  itemId: string;
  itemName: string;
  uomId: string;
  uomName: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  notes?: string | null;
  status: string;
  isActive: boolean;
}

export interface StockOpnameDoc {
  id: string;
  companyId: string;
  regionId: string;
  outletId: string;
  date: string;
  documentNumber: string;
  totalItemsCounted: number;
  totalVarianceQty: number;
  totalVarianceCost: number;
  notes?: string | null;
  status: string;
  isActive: boolean;
  items: any[];
}

export interface SpoilWasteDoc {
  id: string;
  companyId: string;
  regionId: string;
  outletId: string;
  date: string;
  documentNumber: string;
  type: "SPOIL" | "WASTE";
  divisionId?: string;
  divisionName?: string;
  menuItemId?: string;
  menuItemName?: string;
  menuPortionQty?: number;
  itemId: string;
  itemName: string;
  inputQty: number;
  inputUom: string;
  convertedBaseQty: number;
  baseUom: string;
  unitCost: number;
  totalLossCost: number;
  notes?: string | null;
  status: string;
  isActive: boolean;
}

export interface RecipeDoc {
  id: string;
  companyId: string;
  outletId?: string | null;
  name: string;
  uomName: string; // e.g. "potong", "porsi", "paket"
  foodCostPercentage: number;
  totalHppCost: number;
  idealSellingPrice: number;
  rawMaterials: any[]; // [{ itemId, itemName, qty, uomName, unitCost, subtotalCost }]
  subRecipes: any[]; // [{ recipeId, recipeName, qty, uomName, unitCost, subtotalCost }]
  isActive: boolean;
}

export interface WarehouseState {
  distributions: DistributionDoc[];
  initialStocks: Record<string, number>;
  opnames: StockOpnameDoc[];
  spoilWastes: SpoilWasteDoc[];
  recipes: RecipeDoc[];
}

export class WarehouseProjection implements ProjectionHandler<WarehouseState> {
  aggregateType = "WAREHOUSE_DOCUMENT";
  listenTo = ["ORGANIZATION", "ITEM_DOMAIN", "RECEIVING_DOCUMENT"];

  private distributions = new Map<string, DistributionDoc>();
  private initialStocks = new Map<string, number>();
  private opnames = new Map<string, StockOpnameDoc>();
  private spoilWastes = new Map<string, SpoilWasteDoc>();
  private recipes = new Map<string, RecipeDoc>();

  public applyEvent(event: LedgerEventDoc): void {
    const { type, payload, aggregateId } = event;

    switch (type) {
      // DISTRIBUSI
      case "TX_DISTRIBUTION_CREATED": {
        this.distributions.set(aggregateId, {
          id: aggregateId,
          companyId: payload.organization?.companyId || payload.companyId || "",
          regionId: payload.location?.regionId || payload.regionId || "",
          outletId: payload.location?.outletId || payload.outletId || "",
          date: payload.timestamp || payload.date || new Date().toISOString(),
          documentNumber:
            payload.reference?.documentNumber ||
            payload.documentNumber ||
            `DST-${Date.now()}`,
          divisionId: payload.reference?.divisionId || payload.divisionId || "",
          divisionName:
            payload.reference?.divisionName ||
            payload.divisionName ||
            "KITCHEN",
          itemId: payload.data?.itemId || payload.itemId || "",
          itemName: payload.data?.itemName || payload.itemName || "Item",
          uomId: payload.data?.uomId || payload.uomId || "",
          uomName: payload.data?.uomName || payload.uomName || "PCS",
          qty: payload.quantity?.ordered ?? payload.qty ?? 1,
          unitCost: payload.data?.unitCost ?? payload.unitCost ?? 0,
          totalCost: payload.amount?.total ?? payload.totalCost ?? 0,
          notes: payload.data?.notes || payload.notes || null,
          status: payload.status || "COMPLETED",
          isActive: true,
        });
        break;
      }
      case "TX_DISTRIBUTION_UPDATED": {
        if (this.distributions.has(aggregateId)) {
          const existing = this.distributions.get(aggregateId)!;
          this.distributions.set(aggregateId, {
            ...existing,
            divisionId: payload.reference?.divisionId || existing.divisionId,
            divisionName:
              payload.reference?.divisionName || existing.divisionName,
            itemId: payload.data?.itemId || existing.itemId,
            itemName: payload.data?.itemName || existing.itemName,
            uomId: payload.data?.uomId || existing.uomId,
            uomName: payload.data?.uomName || existing.uomName,
            qty: payload.quantity?.ordered ?? existing.qty,
            unitCost: payload.data?.unitCost ?? existing.unitCost,
            totalCost: payload.amount?.total ?? existing.totalCost,
            notes:
              payload.data?.notes !== undefined
                ? payload.data.notes
                : existing.notes,
          });
        }
        break;
      }
      case "TX_DISTRIBUTION_ARCHIVED":
        if (this.distributions.has(aggregateId))
          this.distributions.get(aggregateId)!.isActive = false;
        break;
      case "TX_DISTRIBUTION_RESTORED":
        if (this.distributions.has(aggregateId))
          this.distributions.get(aggregateId)!.isActive = true;
        break;

      // SALDO AWAL
      case "TX_INITIAL_STOCK_SET": {
        const outletId = payload.location?.outletId || payload.outletId || "";
        const itemId = payload.data?.itemId || payload.itemId || "";
        const key = `${outletId}_${itemId}`;
        const qty = Number(payload.data?.initialQty ?? payload.initialQty ?? 0);
        this.initialStocks.set(key, qty);
        break;
      }

      // OPNAME
      case "TX_STOCK_OPNAME_COMPLETED": {
        const outletId = payload.location?.outletId || payload.outletId || "";
        const items = payload.data?.items || [];
        this.opnames.set(aggregateId, {
          id: aggregateId,
          companyId: payload.organization?.companyId || payload.companyId || "",
          regionId: payload.location?.regionId || payload.regionId || "",
          outletId,
          date: payload.timestamp || payload.date || new Date().toISOString(),
          documentNumber:
            payload.reference?.documentNumber ||
            payload.documentNumber ||
            `OPN-${Date.now()}`,
          totalItemsCounted: items.length,
          totalVarianceQty:
            payload.amount?.balance ?? payload.totalVarianceQty ?? 0,
          totalVarianceCost:
            payload.amount?.total ?? payload.totalVarianceCost ?? 0,
          notes: payload.data?.notes || null,
          status: "COMPLETED",
          isActive: true,
          items,
        });

        items.forEach((it: any) => {
          const key = `${outletId}_${it.itemId}`;
          this.initialStocks.set(key, Number(it.physicalStock || 0));
        });
        break;
      }
      case "TX_STOCK_OPNAME_ARCHIVED":
        if (this.opnames.has(aggregateId))
          this.opnames.get(aggregateId)!.isActive = false;
        break;
      case "TX_STOCK_OPNAME_RESTORED":
        if (this.opnames.has(aggregateId))
          this.opnames.get(aggregateId)!.isActive = true;
        break;

      // SPOIL & WASTE
      case "TX_SPOIL_WASTE_CREATED": {
        const items = payload.data?.spoilItems || [payload.data];
        items.forEach((it: any) => {
          const rowId = it.id || aggregateId;
          this.spoilWastes.set(rowId, {
            id: rowId,
            companyId:
              payload.organization?.companyId || payload.companyId || "",
            regionId: payload.location?.regionId || payload.regionId || "",
            outletId: payload.location?.outletId || payload.outletId || "",
            date: payload.timestamp || payload.date || new Date().toISOString(),
            documentNumber:
              payload.reference?.documentNumber ||
              payload.documentNumber ||
              `SPW-${Date.now()}`,
            type: payload.data?.type || "SPOIL",
            divisionId: payload.reference?.divisionId || null,
            divisionName: payload.reference?.divisionName || "KITCHEN",
            menuItemId: payload.data?.menuItemId || it.menuItemId || null,
            menuItemName: payload.data?.menuItemName || it.menuItemName || null,
            menuPortionQty:
              payload.data?.menuPortionQty || it.menuPortionQty || 1,
            itemId: it.itemId,
            itemName: it.itemName,
            inputQty: it.inputQty,
            inputUom: it.inputUom,
            convertedBaseQty: it.convertedBaseQty,
            baseUom: it.baseUom,
            unitCost: it.unitCost,
            totalLossCost: it.totalLossCost,
            notes: it.notes || payload.data?.notes || null,
            status: "COMPLETED",
            isActive: true,
          });
        });
        break;
      }
      case "TX_SPOIL_WASTE_ARCHIVED":
        if (this.spoilWastes.has(aggregateId))
          this.spoilWastes.get(aggregateId)!.isActive = false;
        break;
      case "TX_SPOIL_WASTE_RESTORED":
        if (this.spoilWastes.has(aggregateId))
          this.spoilWastes.get(aggregateId)!.isActive = true;
        break;

      // ================= RESEP (BOM BERJENJANG) =================
      case "TX_RECIPE_CREATED":
      case "TX_RECIPE_UPDATED": {
        this.recipes.set(aggregateId, {
          id: aggregateId,
          companyId: payload.organization?.companyId || payload.companyId || "",
          outletId: payload.location?.outletId || payload.outletId || null,
          name:
            payload.reference?.name ||
            payload.data?.name ||
            payload.name ||
            "Resep Baru",
          uomName: payload.data?.uomName || payload.uomName || "PORSI",
          foodCostPercentage: Number(
            payload.data?.foodCostPercentage ||
              payload.foodCostPercentage ||
              30,
          ),
          totalHppCost: Number(
            payload.amount?.total || payload.totalHppCost || 0,
          ),
          idealSellingPrice: Number(
            payload.data?.idealSellingPrice || payload.idealSellingPrice || 0,
          ),
          rawMaterials: payload.data?.rawMaterials || [],
          subRecipes: payload.data?.subRecipes || [],
          isActive: true,
        });
        break;
      }
      case "TX_RECIPE_ARCHIVED":
        if (this.recipes.has(aggregateId))
          this.recipes.get(aggregateId)!.isActive = false;
        break;
      case "TX_RECIPE_RESTORED":
        if (this.recipes.has(aggregateId))
          this.recipes.get(aggregateId)!.isActive = true;
        break;
    }
  }

  public getState(): WarehouseState {
    const initialStocksObj: Record<string, number> = {};
    this.initialStocks.forEach((val, key) => {
      initialStocksObj[key] = val;
    });

    return {
      distributions: Array.from(this.distributions.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
      initialStocks: initialStocksObj,
      opnames: Array.from(this.opnames.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
      spoilWastes: Array.from(this.spoilWastes.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
      recipes: Array.from(this.recipes.values()),
    };
  }

  public reset(): void {
    this.distributions.clear();
    this.initialStocks.clear();
    this.opnames.clear();
    this.spoilWastes.clear();
    this.recipes.clear();
  }

  public restoreState(state: WarehouseState): void {
    this.reset();
    if (state) {
      state.distributions?.forEach((d) => this.distributions.set(d.id, d));
      if (state.initialStocks) {
        Object.entries(state.initialStocks).forEach(([k, v]) =>
          this.initialStocks.set(k, v),
        );
      }
      state.opnames?.forEach((o) => this.opnames.set(o.id, o));
      state.spoilWastes?.forEach((sw) => this.spoilWastes.set(sw.id, sw));
      state.recipes?.forEach((r) => this.recipes.set(r.id, r));
    }
  }
}
