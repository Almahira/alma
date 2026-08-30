// File: modules/mdl_executivepanel/src/client/command-handlers.ts
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

export const executivepanelCommandHandlers: CommandHandler[] = [
  // 1. SET TARGET & JATAH KUOTA (SYSTEM EVENT)
  {
    commandType: "SET_EXECUTIVE_TARGET",
    execute: async (cmd: Command) => {
      const id = `TRG_${ulid()}`;
      const activeActor = getActiveActor();
      const p = cmd.payload;

      const canonicalPayload: AlmaTransactionEnvelope = {
        id,
        type: "EXECUTIVE_TARGET",
        action: "SET_TARGET",
        status: "COMPLETED",
        timestamp: new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: {
          companyId:
            p.companyId || localStorage.getItem("__unv_companyId") || "",
        },
        location: { outletId: p.outletId },
        amount: { subtotal: 0, total: 0, paid: 0, balance: 0 },
        data: { ...p },
      };

      await globalLedger.appendEvent(
        "EXECUTIVE_TARGET_SET",
        id,
        "EXECUTIVE_PANEL",
        1,
        canonicalPayload,
        activeActor,
      );
    },
  },

  // 2. SET ALOKASI CADANGAN OPSIONAL (SYSTEM EVENT)
  {
    commandType: "SET_EXECUTIVE_ALLOCATION",
    execute: async (cmd: Command) => {
      const id = `ALC_${ulid()}`;
      const activeActor = getActiveActor();
      const p = cmd.payload;

      const canonicalPayload: AlmaTransactionEnvelope = {
        id,
        type: "EXECUTIVE_ALLOCATION",
        action: "SET_ALLOCATION",
        status: "COMPLETED",
        timestamp: new Date().toISOString(),
        actor: {
          id: activeActor.userId,
          name: activeActor.userId,
          role: activeActor.role,
        },
        organization: {
          companyId:
            p.companyId || localStorage.getItem("__unv_companyId") || "",
        },
        location: { outletId: p.outletId || null },
        amount: { subtotal: 0, total: 0, paid: 0, balance: 0 },
        data: { ...p },
      };

      await globalLedger.appendEvent(
        "EXECUTIVE_ALLOCATION_SET",
        id,
        "EXECUTIVE_PANEL",
        1,
        canonicalPayload,
        activeActor,
      );
    },
  },
  {
    commandType: "ARCHIVE_EXECUTIVE_ALLOCATION",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      await globalLedger.appendEvent(
        "EXECUTIVE_ALLOCATION_ARCHIVED",
        id,
        "EXECUTIVE_PANEL",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },

  // 3. CATAT PENARIKAN OWNER & DEVIDEN (TRANSACTION EVENT)
  {
    commandType: "CREATE_OWNER_LEDGER",
    execute: async (cmd: Command) => {
      const id = `OWN_${ulid()}`;
      const activeActor = getActiveActor();
      const p = cmd.payload;
      const amount = Number(p.amount) || 0;

      const canonicalPayload: AlmaTransactionEnvelope = {
        id,
        type: "OWNER_LEDGER",
        action: "WITHDRAW_OWNER_FUND",
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
          companyId:
            p.companyId || localStorage.getItem("__unv_companyId") || "",
        },
        location: {
          regionId:
            p.regionId || localStorage.getItem("__unv_regionId") || null,
          outletId:
            p.outletId || localStorage.getItem("__unv_outletId") || null,
        },
        reference: {
          documentNumber:
            p.documentNumber ||
            `OWN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`,
        },
        amount: { subtotal: amount, total: amount, paid: amount, balance: 0 },
        data: { ...p },
      };

      // ---> PERBAIKAN: Gunakan aggregateType "EXECUTIVE_PANEL" agar ditangkap proyeksi <---
      await globalLedger.appendEvent(
        "TX_OWNER_LEDGER_CREATED",
        id,
        "EXECUTIVE_PANEL",
        1,
        canonicalPayload,
        activeActor,
      );
    },
  },
  {
    commandType: "ARCHIVE_OWNER_LEDGER",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      await globalLedger.appendEvent(
        "TX_OWNER_LEDGER_ARCHIVED",
        id,
        "EXECUTIVE_PANEL",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },
  {
    commandType: "RESTORE_OWNER_LEDGER",
    execute: async (cmd: Command) => {
      const { id } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      await globalLedger.appendEvent(
        "TX_OWNER_LEDGER_RESTORED",
        id,
        "EXECUTIVE_PANEL",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },
];
