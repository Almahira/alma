// File: modules/mdl_warehouse/src/client/command-handlers.ts
import {
  Command,
  CommandHandler,
  AlmaTransactionEnvelope,
} from "../../../../packages/core_unv/src/cqrs/types";
import { globalLedger } from "../../../../packages/core_unv/src/ledger/UniversalLedger";
import { ulid } from "ulidx";
import { useOrgStore } from "../../../mdl_organization/src/client/store";

function getActiveActor(): { userId: string; role: string } {
  try {
    const rawUser = localStorage.getItem("__unv_activeUser");
    const orgState = useOrgStore.getState();
    if (rawUser) {
      const user = JSON.parse(rawUser);
      const emp = orgState.employees.find((e) => e.id === user.employeeId);
      return {
        userId: emp?.fullName || user.username || "SUPER ADMIN",
        role: user.role || "SUPER_ADMIN",
      };
    }
  } catch {}
  return { userId: "RENDI FAIZAL", role: "SUPER_ADMIN" };
}

export const warehouseCommandHandlers: CommandHandler[] = [
  // 1. DISTRIBUSI
  {
    commandType: "CREATE_DISTRIBUTION",
    execute: async (cmd: Command) => {
      const id = `DST_${ulid()}`;
      const activeActor = getActiveActor();
      const p = cmd.payload;

      const companyId =
        p.companyId || localStorage.getItem("__unv_companyId") || "";
      const regionId =
        p.regionId || localStorage.getItem("__unv_regionId") || null;
      const outletId =
        p.outletId || localStorage.getItem("__unv_outletId") || null;
      const qty = Number(p.qty) || 1;
      const unitCost = Number(p.unitCost) || 0;
      const totalCost = qty * unitCost;

      const canonicalPayload: AlmaTransactionEnvelope = {
        id,
        type: "WAREHOUSE_DISTRIBUTION",
        action: "CREATE_DISTRIBUTION",
        status: "COMPLETED",
        timestamp: p.date
          ? new Date(p.date).toISOString()
          : new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: { companyId },
        location: { regionId, outletId, warehouseId: outletId || regionId },
        reference: {
          documentNumber:
            p.documentNumber ||
            `DST-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`,
          divisionId: p.divisionId,
          divisionName: p.divisionName,
        },
        quantity: { ordered: qty, received: qty, rejected: 0 },
        amount: {
          subtotal: totalCost,
          tax: 0,
          discount: 0,
          total: totalCost,
          paid: totalCost,
          balance: 0,
        },
        data: {
          itemId: p.itemId,
          itemName: p.itemName,
          uomId: p.uomId,
          uomName: p.uomName,
          unitCost,
          totalCost,
          notes: p.notes || null,
        },
      };

      await globalLedger.appendEvent(
        "TX_DISTRIBUTION_CREATED",
        id,
        "WAREHOUSE_DOCUMENT",
        1,
        canonicalPayload,
        activeActor,
      );
    },
  },
  {
    commandType: "UPDATE_DISTRIBUTION",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      const activeActor = getActiveActor();
      const p = cmd.payload;
      const qty = Number(p.qty) || 1;
      const unitCost = Number(p.unitCost) || 0;
      const totalCost = qty * unitCost;

      const canonicalPayload: AlmaTransactionEnvelope = {
        id,
        type: "WAREHOUSE_DISTRIBUTION",
        action: "UPDATE_DISTRIBUTION",
        status: "COMPLETED",
        timestamp: p.date
          ? new Date(p.date).toISOString()
          : new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: {
          companyId: localStorage.getItem("__unv_companyId") || "",
        },
        location: {
          regionId: localStorage.getItem("__unv_regionId") || null,
          outletId: localStorage.getItem("__unv_outletId") || null,
        },
        reference: { divisionId: p.divisionId, divisionName: p.divisionName },
        quantity: { ordered: qty, received: qty, rejected: 0 },
        amount: {
          subtotal: totalCost,
          total: totalCost,
          paid: totalCost,
          balance: 0,
        },
        data: {
          itemId: p.itemId,
          itemName: p.itemName,
          uomId: p.uomId,
          uomName: p.uomName,
          unitCost,
          totalCost,
          notes: p.notes || null,
        },
      };

      await globalLedger.appendEvent(
        "TX_DISTRIBUTION_UPDATED",
        id,
        "WAREHOUSE_DOCUMENT",
        nextVer,
        canonicalPayload,
        activeActor,
      );
    },
  },
  {
    commandType: "ARCHIVE_DISTRIBUTION",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      await globalLedger.appendEvent(
        "TX_DISTRIBUTION_ARCHIVED",
        id,
        "WAREHOUSE_DOCUMENT",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },
  {
    commandType: "RESTORE_DISTRIBUTION",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      await globalLedger.appendEvent(
        "TX_DISTRIBUTION_RESTORED",
        id,
        "WAREHOUSE_DOCUMENT",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },

  // 2. STOK AWAL
  {
    commandType: "SET_INITIAL_STOCK",
    execute: async (cmd: Command) => {
      const activeActor = getActiveActor();
      const p = cmd.payload;
      const id = `INI_${ulid()}`;
      const companyId =
        p.companyId || localStorage.getItem("__unv_companyId") || "";
      const outletId =
        p.outletId || localStorage.getItem("__unv_outletId") || "";

      const canonicalPayload: AlmaTransactionEnvelope = {
        id,
        type: "INITIAL_STOCK",
        action: "SET_INITIAL_STOCK",
        status: "COMPLETED",
        timestamp: new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: { companyId },
        location: { outletId },
        amount: { subtotal: 0, total: 0, paid: 0, balance: 0 },
        data: { itemId: p.itemId, initialQty: Number(p.initialQty) || 0 },
      };

      await globalLedger.appendEvent(
        "TX_INITIAL_STOCK_SET",
        id,
        "WAREHOUSE_DOCUMENT",
        1,
        canonicalPayload,
        activeActor,
      );
    },
  },

  // 3. STOK OPNAME
  {
    commandType: "COMPLETE_STOCK_OPNAME",
    execute: async (cmd: Command) => {
      const id = `OPN_${ulid()}`;
      const activeActor = getActiveActor();
      const p = cmd.payload;
      const companyId =
        p.companyId || localStorage.getItem("__unv_companyId") || "";
      const regionId =
        p.regionId || localStorage.getItem("__unv_regionId") || null;
      const outletId =
        p.outletId || localStorage.getItem("__unv_outletId") || null;
      const items = p.items || [];
      const totalVarianceCost = Number(p.totalVarianceCost) || 0;
      const totalVarianceQty = Number(p.totalVarianceQty) || 0;

      const canonicalPayload: AlmaTransactionEnvelope = {
        id,
        type: "STOCK_OPNAME",
        action: "COMPLETE_STOCK_OPNAME",
        status: "COMPLETED",
        timestamp: p.date
          ? new Date(p.date).toISOString()
          : new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: { companyId },
        location: { regionId, outletId, warehouseId: outletId || regionId },
        reference: {
          documentNumber:
            p.documentNumber ||
            `OPN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`,
        },
        amount: {
          subtotal: totalVarianceCost,
          total: totalVarianceCost,
          paid: 0,
          balance: totalVarianceQty,
        },
        data: { items, notes: p.notes || null },
      };

      await globalLedger.appendEvent(
        "TX_STOCK_OPNAME_COMPLETED",
        id,
        "WAREHOUSE_DOCUMENT",
        1,
        canonicalPayload,
        activeActor,
      );
    },
  },

  // 4. SPOIL & WASTE
  {
    commandType: "CREATE_SPOIL_WASTE",
    execute: async (cmd: Command) => {
      const id = `SPW_${ulid()}`;
      const activeActor = getActiveActor();
      const p = cmd.payload;
      const companyId =
        p.companyId || localStorage.getItem("__unv_companyId") || "";
      const regionId =
        p.regionId || localStorage.getItem("__unv_regionId") || null;
      const outletId =
        p.outletId || localStorage.getItem("__unv_outletId") || null;
      const totalLoss = Number(p.totalLossCost) || 0;

      const canonicalPayload: AlmaTransactionEnvelope = {
        id,
        type: "SPOIL_WASTE",
        action: p.type === "WASTE" ? "CREATE_MENU_WASTE" : "CREATE_ITEM_SPOIL",
        status: "COMPLETED",
        timestamp: p.date
          ? new Date(p.date).toISOString()
          : new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: { companyId },
        location: { regionId, outletId, warehouseId: outletId || regionId },
        reference: {
          documentNumber:
            p.documentNumber ||
            `SPW-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`,
          divisionId: p.divisionId || null,
          divisionName: p.divisionName || "KITCHEN",
        },
        amount: { subtotal: totalLoss, total: totalLoss, paid: 0, balance: 0 },
        data: { ...p },
      };

      await globalLedger.appendEvent(
        "TX_SPOIL_WASTE_CREATED",
        id,
        "WAREHOUSE_DOCUMENT",
        1,
        canonicalPayload,
        activeActor,
      );
    },
  },

  // 5. MASTER RESEP (BOM)
  {
    commandType: "CREATE_RECIPE",
    execute: async (cmd: Command) => {
      const id = `RCP_${ulid()}`;
      const activeActor = getActiveActor();
      const p = cmd.payload;

      const companyId =
        p.companyId || localStorage.getItem("__unv_companyId") || "";
      const outletId =
        p.outletId || localStorage.getItem("__unv_outletId") || null;
      const totalCost = Number(p.totalHppCost) || 0;

      const canonicalPayload: AlmaTransactionEnvelope = {
        id,
        type: "RECIPE_BOM",
        action: "CREATE_RECIPE",
        status: "COMPLETED",
        timestamp: new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: { companyId },
        location: { outletId },
        reference: { name: p.name },
        amount: { subtotal: totalCost, total: totalCost, paid: 0, balance: 0 },
        data: { ...p },
      };

      await globalLedger.appendEvent(
        "TX_RECIPE_CREATED",
        id,
        "WAREHOUSE_DOCUMENT",
        1,
        canonicalPayload,
        activeActor,
      );
    },
  },
  {
    commandType: "UPDATE_RECIPE",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      const activeActor = getActiveActor();
      const p = cmd.payload;
      const totalCost = Number(p.totalHppCost) || 0;

      const canonicalPayload: AlmaTransactionEnvelope = {
        id,
        type: "RECIPE_BOM",
        action: "UPDATE_RECIPE",
        status: "COMPLETED",
        timestamp: new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: {
          companyId: localStorage.getItem("__unv_companyId") || "",
        },
        location: { outletId: localStorage.getItem("__unv_outletId") || null },
        reference: { name: p.name },
        amount: { subtotal: totalCost, total: totalCost, paid: 0, balance: 0 },
        data: { ...p },
      };

      await globalLedger.appendEvent(
        "TX_RECIPE_UPDATED",
        id,
        "WAREHOUSE_DOCUMENT",
        nextVer,
        canonicalPayload,
        activeActor,
      );
    },
  },
  {
    commandType: "ARCHIVE_RECIPE",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      await globalLedger.appendEvent(
        "TX_RECIPE_ARCHIVED",
        id,
        "WAREHOUSE_DOCUMENT",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },
  {
    commandType: "RESTORE_RECIPE",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      await globalLedger.appendEvent(
        "TX_RECIPE_RESTORED",
        id,
        "WAREHOUSE_DOCUMENT",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },
];
