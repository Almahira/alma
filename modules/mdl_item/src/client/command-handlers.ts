// File: modules/mdl_item/src/client/command-handlers.ts
import {
  Command,
  CommandHandler,
} from "../../../../packages/core_unv/src/cqrs/types";
import { globalLedger } from "../../../../packages/core_unv/src/ledger/UniversalLedger";
import { ulid } from "ulidx";
import { useOrgStore } from "../../../mdl_organization/src/client/store";

export function getActiveActor(): { userId: string; role: string } {
  try {
    const rawUser = localStorage.getItem("__unv_activeUser");
    const orgState = useOrgStore.getState();

    if (rawUser) {
      const user = JSON.parse(rawUser);
      const emp = orgState.employees.find((e) => e.id === user.employeeId);
      const actorName =
        emp?.fullName || user.fullName || user.username || "SUPER ADMIN";
      return {
        userId: actorName,
        role: user.role || "SUPER_ADMIN",
      };
    }

    if (orgState.userAccounts.length > 0) {
      const firstUser = orgState.userAccounts[0];
      const emp = orgState.employees.find((e) => e.id === firstUser.employeeId);
      if (emp) {
        return {
          userId: emp.fullName,
          role: firstUser.role || "SUPER_ADMIN",
        };
      }
    }
  } catch {}

  return { userId: "RENDI FAIZAL", role: "SUPER_ADMIN" };
}

export const itemCommandHandlers: CommandHandler[] = [
  {
    commandType: "CREATE_CATEGORY",
    execute: async (cmd: Command) => {
      const newId = cmd.payload.id || `CAT_${ulid()}`;
      await globalLedger.appendEvent(
        "CATEGORY_CREATED",
        newId,
        "ITEM_CATEGORY",
        1,
        cmd.payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "UPDATE_CATEGORY",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "CATEGORY_UPDATED",
        cmd.payload.id,
        "ITEM_CATEGORY",
        nextVer,
        cmd.payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "CREATE_UOM",
    execute: async (cmd: Command) => {
      const newId = cmd.payload.id || `UOM_${ulid()}`;
      await globalLedger.appendEvent(
        "UOM_CREATED",
        newId,
        "ITEM_UOM",
        1,
        cmd.payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "UPDATE_UOM",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "UOM_UPDATED",
        cmd.payload.id,
        "ITEM_UOM",
        nextVer,
        cmd.payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "CREATE_PRODUCT",
    execute: async (cmd: Command) => {
      const newId = cmd.payload.id || `PRD_${ulid()}`;
      const validateId = cmd.payload.validateId || `VAL_${ulid()}`;

      const companyId =
        cmd.payload.companyId || localStorage.getItem("__unv_companyId") || "";
      const regionId =
        cmd.payload.regionId || localStorage.getItem("__unv_regionId") || null;
      const outletId =
        cmd.payload.outletId || localStorage.getItem("__unv_outletId") || null;

      const payload = {
        categoryId: cmd.payload.categoryId,
        uomId: cmd.payload.uomId,
        companyId,
        regionId,
        outletId,
        name: cmd.payload.name,
        isExpense: Boolean(cmd.payload.isExpense), // <--- EKSPLISIT BOOLEAN
        pricing: cmd.payload.pricing || {},
        approvalStatus: cmd.payload.approvalStatus || "PENDING",
        validateId: validateId,
      };

      await globalLedger.appendEvent(
        "PRODUCT_CREATED",
        newId,
        "ITEM_PRODUCT",
        1,
        payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "UPDATE_PRODUCT",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      const payload = {
        categoryId: cmd.payload.categoryId,
        uomId: cmd.payload.uomId,
        name: cmd.payload.name,
        isExpense: cmd.payload.isExpense,
        pricing: cmd.payload.pricing,
        nameChanged: cmd.payload.nameChanged,
      };
      await globalLedger.appendEvent(
        "PRODUCT_UPDATED",
        cmd.payload.id,
        "ITEM_PRODUCT",
        nextVer,
        payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "VALIDATE_PRODUCT",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      const payload = {
        approvalStatus: cmd.payload.approvalStatus,
        validateId: cmd.payload.validateId || null,
      };
      await globalLedger.appendEvent(
        "PRODUCT_VALIDATED",
        cmd.payload.id,
        "ITEM_PRODUCT",
        nextVer,
        payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "ARCHIVE_PRODUCT",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "PRODUCT_ARCHIVED",
        cmd.payload.id,
        "ITEM_PRODUCT",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },
  {
    commandType: "RESTORE_PRODUCT",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "PRODUCT_RESTORED",
        cmd.payload.id,
        "ITEM_PRODUCT",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },
];
