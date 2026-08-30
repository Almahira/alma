// File: modules/mdl_vendor/src/client/command-handlers.ts
import {
  Command,
  CommandHandler,
} from "../../../../packages/core_unv/src/cqrs/types";
import { globalLedger } from "../../../../packages/core_unv/src/ledger/UniversalLedger";
import { globalBlobManager } from "../../../../packages/core_unv/src/io/BlobManager";
import { ulid } from "ulidx";
import { useOrgStore } from "../../../mdl_organization/src/client/store";

/**
 * Mengambil Aktor yang sedang aktif dari Master Akun / Sesi
 */
function getActiveActor(): { userId: string; role: string } {
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

export const vendorCommandHandlers: CommandHandler[] = [
  {
    commandType: "CREATE_VENDOR",
    execute: async (cmd: Command) => {
      const newId = cmd.payload.id || `VND_${ulid()}`;
      const { id, ...cleanPayload } = cmd.payload;

      // Konteks Spasial Otomatis dari Perangkat
      const companyId =
        cleanPayload.companyId || localStorage.getItem("__unv_companyId") || "";
      const regionId =
        cleanPayload.regionId || localStorage.getItem("__unv_regionId") || null;
      const outletId =
        cleanPayload.outletId || localStorage.getItem("__unv_outletId") || null;

      const payload = {
        ...cleanPayload,
        companyId,
        regionId,
        outletId,
      };

      await globalLedger.appendEvent(
        "VENDOR_CREATED",
        newId,
        "VENDOR",
        1,
        payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "UPDATE_VENDOR",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      const { id, ...cleanPayload } = cmd.payload;
      await globalLedger.appendEvent(
        "VENDOR_UPDATED",
        cmd.payload.id,
        "VENDOR",
        nextVer,
        cleanPayload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "ARCHIVE_VENDOR",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "VENDOR_ARCHIVED",
        cmd.payload.id,
        "VENDOR",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },
  {
    commandType: "RESTORE_VENDOR",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "VENDOR_RESTORED",
        cmd.payload.id,
        "VENDOR",
        nextVer,
        {},
        getActiveActor(),
      );
    },
  },
  {
    commandType: "ATTACH_VENDOR_DOCUMENT",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.vendorId)) + 1;
      const documentId = `VDOC_${ulid()}`;
      const payload = {
        documentId,
        documentName: cmd.payload.documentName,
        fileName: cmd.payload.fileName,
        fileType: cmd.payload.fileObj?.type || "unknown",
        size: cmd.payload.fileObj?.size || 0,
      };

      if (cmd.payload.fileObj) {
        await globalBlobManager.queueFileForUpload(
          documentId,
          "VENDOR",
          cmd.payload.vendorId,
          cmd.payload.fileObj,
        );
      }

      await globalLedger.appendEvent(
        "VENDOR_DOCUMENT_ATTACHED",
        cmd.payload.vendorId,
        "VENDOR",
        nextVer,
        payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "ARCHIVE_VENDOR_DOCUMENT",
    execute: async (cmd: Command) => {
      const { vendorId, documentId } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(vendorId)) + 1;
      await globalBlobManager.removeFileFromCache(documentId, "VENDOR", true);
      await globalLedger.appendEvent(
        "VENDOR_DOCUMENT_ARCHIVED",
        vendorId,
        "VENDOR",
        nextVer,
        { documentId },
        getActiveActor(),
      );
    },
  },
];
