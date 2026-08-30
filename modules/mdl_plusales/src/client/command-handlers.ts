// File: modules/mdl_plusales/src/client/command-handlers.ts
import {
  Command,
  CommandHandler,
  AlmaTransactionEnvelope,
} from "../../../../packages/core_unv/src/cqrs/types";
import { globalLedger } from "../../../../packages/core_unv/src/ledger/UniversalLedger";
import { globalBlobManager } from "../../../../packages/core_unv/src/io/BlobManager";
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

export const plusalesCommandHandlers: CommandHandler[] = [
  {
    commandType: "CREATE_PLUSALES",
    execute: async (cmd: Command) => {
      const id = `SLS_${ulid()}`;
      const activeActor = getActiveActor();
      const p = cmd.payload;

      let proofFileId: string | null = null;
      if (p.proofFileObj) {
        proofFileId = `PRF_${ulid()}`;
        await globalBlobManager.queueFileForUpload(
          proofFileId,
          "PLUSALES",
          id,
          p.proofFileObj,
        );
      }

      const netSales = Number(p.netSales) || 0;
      const discount = Number(p.discount) || 0;
      const tax = Number(p.tax) || 0;
      const service = Number(p.service) || 0;
      // Rumus: Gross = Net - Diskon + PB1 + Service
      const grossSales = Math.max(0, netSales - discount + tax + service);

      const totalSettlement = Number(p.totalSettlement) || 0;
      const totalPettycash = Number(p.totalPettycash) || 0;
      const cashOnHand = Number(p.cashOnHand) || 0;
      const totalRealization = totalSettlement + totalPettycash + cashOnHand;
      const balanceDifference = totalRealization - grossSales;

      const companyId =
        p.companyId || localStorage.getItem("__unv_companyId") || "";
      const regionId =
        p.regionId || localStorage.getItem("__unv_regionId") || null;
      const outletId =
        p.outletId || localStorage.getItem("__unv_outletId") || null;

      const canonicalPayload: AlmaTransactionEnvelope = {
        id,
        type: "PLUSALES",
        action: "CREATE_PLUSALES",
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
        location: { regionId, outletId, warehouseId: regionId },
        reference: {
          documentNumber:
            p.documentNumber ||
            `SLS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`,
        },
        amount: {
          subtotal: netSales,
          tax: tax,
          discount: discount,
          total: grossSales,
          paid: totalRealization,
          balance: balanceDifference,
        },
        data: {
          service,
          totalSettlement,
          totalPettycash,
          cashOnHand,
          balanceDifference,
          discrepancyNote: p.discrepancyNote || null,
          proofFileId,
          dynamicItems: p.dynamicItems || [],
        },
      };

      await globalLedger.appendEvent(
        "TX_PLUSALES_CREATED",
        id,
        "PLUSALES_DOCUMENT",
        1,
        canonicalPayload,
        activeActor,
      );
    },
  },

  {
    commandType: "UPDATE_PLUSALES",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      const activeActor = getActiveActor();
      const p = cmd.payload;

      let proofFileId = p.proofFileId || null;
      if (p.proofFileObj) {
        proofFileId = `PRF_${ulid()}`;
        await globalBlobManager.queueFileForUpload(
          proofFileId,
          "PLUSALES",
          id,
          p.proofFileObj,
        );
      }

      const netSales = Number(p.netSales) || 0;
      const discount = Number(p.discount) || 0;
      const tax = Number(p.tax) || 0;
      const service = Number(p.service) || 0;
      const grossSales = Math.max(0, netSales - discount + tax + service);

      const totalSettlement = Number(p.totalSettlement) || 0;
      const totalPettycash = Number(p.totalPettycash) || 0;
      const cashOnHand = Number(p.cashOnHand) || 0;
      const totalRealization = totalSettlement + totalPettycash + cashOnHand;
      const balanceDifference = totalRealization - grossSales;

      const canonicalPayload: AlmaTransactionEnvelope = {
        id,
        type: "PLUSALES",
        action: "UPDATE_PLUSALES",
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
        amount: {
          subtotal: netSales,
          tax: tax,
          discount: discount,
          total: grossSales,
          paid: totalRealization,
          balance: balanceDifference,
        },
        data: {
          service,
          totalSettlement,
          totalPettycash,
          cashOnHand,
          balanceDifference,
          discrepancyNote: p.discrepancyNote || null,
          proofFileId,
          dynamicItems: p.dynamicItems || [],
        },
      };

      await globalLedger.appendEvent(
        "TX_PLUSALES_UPDATED",
        id,
        "PLUSALES_DOCUMENT",
        nextVer,
        canonicalPayload,
        activeActor,
      );
    },
  },

  {
    commandType: "ARCHIVE_PLUSALES",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      await globalLedger.appendEvent(
        "TX_PLUSALES_ARCHIVED",
        id,
        "PLUSALES_DOCUMENT",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },

  {
    commandType: "RESTORE_PLUSALES",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      await globalLedger.appendEvent(
        "TX_PLUSALES_RESTORED",
        id,
        "PLUSALES_DOCUMENT",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },
];
