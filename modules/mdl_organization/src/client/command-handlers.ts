// File: modules/mdl_organization/src/client/command-handlers.ts
import {
  Command,
  CommandHandler,
} from "../../../../packages/core_unv/src/cqrs/types";
import { globalLedger } from "../../../../packages/core_unv/src/ledger/UniversalLedger";
import { globalBlobManager } from "../../../../packages/core_unv/src/io/BlobManager";
import { ulid } from "ulidx";
import { useOrgStore } from "./store";

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

export const organizationCommandHandlers: CommandHandler[] = [
  {
    commandType: "ATTACH_EMPLOYEE_DOCUMENT",
    execute: async (cmd: Command) => {
      const employeeId = cmd.payload.employeeId;
      const nextVer = (await globalLedger.getAggregateVersion(employeeId)) + 1;
      const documentId = `EDOC_${ulid()}`;

      let attachmentUrl = cmd.payload.fileName || "";
      if (cmd.payload.fileObj) {
        attachmentUrl = documentId;
        await globalBlobManager.queueFileForUpload(
          documentId,
          "ORGANIZATION",
          employeeId,
          cmd.payload.fileObj,
        );
      }

      const payload = {
        documentId,
        documentTypeId: cmd.payload.documentTypeId,
        documentNumber: cmd.payload.documentNumber || "-",
        issueDate: cmd.payload.issueDate || null,
        expiryDate: cmd.payload.expiryDate || null,
        attachmentUrl,
        notes: cmd.payload.notes || null,
      };

      await globalLedger.appendEvent(
        "EMPLOYEE_DOCUMENT_ATTACHED",
        employeeId,
        "EMPLOYEE",
        nextVer,
        payload,
        getActiveActor(),
      );
    },
  },
  // ==========================================
  // 1. COMPANY
  // ==========================================
  {
    commandType: "CREATE_COMPANY",
    execute: async (cmd: Command) => {
      const companyId = `AGG_${ulid()}`;
      const code =
        cmd.payload.code ||
        cmd.payload.name.substring(0, 3).toUpperCase() +
          Math.floor(Math.random() * 100);
      const companyPayload = {
        code,
        name: cmd.payload.name,
        legalName: cmd.payload.legalName || null,
        description: cmd.payload.description || null,
      };
      await globalLedger.appendEvent(
        "COMPANY_CREATED",
        companyId,
        "COMPANY",
        1,
        companyPayload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "UPDATE_COMPANY",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "COMPANY_UPDATED",
        cmd.payload.id,
        "COMPANY",
        nextVer,
        cmd.payload,
        getActiveActor(),
      );
    },
  },

  // ==========================================
  // 2. REGION & OUTLET
  // ==========================================
  {
    commandType: "CREATE_REGION",
    execute: async (cmd: Command) => {
      const newId = `AGG_${ulid()}`;
      const payload = {
        companyId: cmd.payload.companyId,
        code:
          cmd.payload.code ||
          cmd.payload.name.substring(0, 3).toUpperCase() +
            Math.floor(Math.random() * 100),
        name: cmd.payload.name,
        timezone: cmd.payload.timezone || "Asia/Jakarta",
        address: cmd.payload.address,
      };
      await globalLedger.appendEvent(
        "REGION_CREATED",
        newId,
        "REGION",
        1,
        payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "UPDATE_REGION",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "REGION_UPDATED",
        cmd.payload.id,
        "REGION",
        nextVer,
        cmd.payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "CREATE_OUTLET",
    execute: async (cmd: Command) => {
      const newId = `AGG_${ulid()}`;
      const payload = {
        companyId: cmd.payload.companyId,
        regionId: cmd.payload.regionId,
        code:
          cmd.payload.code ||
          cmd.payload.name.substring(0, 3).toUpperCase() +
            Math.floor(Math.random() * 100),
        name: cmd.payload.name,
        address: cmd.payload.address,
        industry: cmd.payload.industry,
      };
      await globalLedger.appendEvent(
        "OUTLET_CREATED",
        newId,
        "OUTLET",
        1,
        payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "UPDATE_OUTLET",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "OUTLET_UPDATED",
        cmd.payload.id,
        "OUTLET",
        nextVer,
        cmd.payload,
        getActiveActor(),
      );
    },
  },

  // ==========================================
  // 3. DOKUMEN & LEGALITAS ORGANISASI (FIX UTAMA)
  // ==========================================
  {
    commandType: "ATTACH_DOCUMENT",
    execute: async (cmd: Command) => {
      const targetId = cmd.payload.targetId;
      const nextVer = (await globalLedger.getAggregateVersion(targetId)) + 1;
      const documentId = `DOC_${ulid()}`;

      const payload = {
        documentId,
        name: cmd.payload.documentName || cmd.payload.name,
        fileName: cmd.payload.fileName,
        fileType: cmd.payload.fileObj?.type || "unknown",
        size: cmd.payload.fileObj?.size || 0,
      };

      // 1. Serahkan berkas fisik ke antrean upload BlobManager (Background Task)
      if (cmd.payload.fileObj) {
        await globalBlobManager.queueFileForUpload(
          documentId,
          "ORGANIZATION",
          targetId,
          cmd.payload.fileObj,
        );
      }

      // 2. Terbitkan event fakta metadata ke Ledger Utama (Ringan & Cepat)
      await globalLedger.appendEvent(
        "DOCUMENT_ATTACHED",
        targetId,
        "ORGANIZATION",
        nextVer,
        payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "UPDATE_DOCUMENT",
    execute: async (cmd: Command) => {
      const targetId = cmd.payload.targetId;
      const documentId = cmd.payload.documentId;
      const nextVer = (await globalLedger.getAggregateVersion(targetId)) + 1;

      const payload = {
        documentId,
        name: cmd.payload.documentName || cmd.payload.name,
        fileName: cmd.payload.fileName,
        fileType:
          cmd.payload.fileObj?.type || cmd.payload.fileType || "unknown",
        size: cmd.payload.fileObj?.size || cmd.payload.size || 0,
      };

      if (cmd.payload.fileObj) {
        await globalBlobManager.queueFileForUpload(
          documentId,
          "ORGANIZATION",
          targetId,
          cmd.payload.fileObj,
        );
      }

      await globalLedger.appendEvent(
        "DOCUMENT_UPDATED",
        targetId,
        "ORGANIZATION",
        nextVer,
        payload,
        getActiveActor(),
      );
    },
  },

  // ==========================================
  // 4. REKENING BANK ORGANISASI
  // ==========================================
  {
    commandType: "ADD_BANK_ACCOUNT",
    execute: async (cmd: Command) => {
      const targetId = cmd.payload.targetId;
      const nextVer = (await globalLedger.getAggregateVersion(targetId)) + 1;
      const bankAccountId = `BNK_${ulid()}`;

      const payload = {
        bankAccountId,
        bankName: cmd.payload.bankName,
        accountNumber: cmd.payload.accountNumber,
        accountName: cmd.payload.accountName,
        description: cmd.payload.description || null,
      };

      await globalLedger.appendEvent(
        "BANK_ACCOUNT_ADDED",
        targetId,
        "ORGANIZATION",
        nextVer,
        payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "UPDATE_BANK_ACCOUNT",
    execute: async (cmd: Command) => {
      const targetId = cmd.payload.targetId;
      const nextVer = (await globalLedger.getAggregateVersion(targetId)) + 1;

      const payload = {
        bankAccountId: cmd.payload.bankAccountId,
        bankName: cmd.payload.bankName,
        accountNumber: cmd.payload.accountNumber,
        accountName: cmd.payload.accountName,
        description: cmd.payload.description || null,
      };

      await globalLedger.appendEvent(
        "BANK_ACCOUNT_UPDATED",
        targetId,
        "ORGANIZATION",
        nextVer,
        payload,
        getActiveActor(),
      );
    },
  },

  // ==========================================
  // 5. DIVISI & JABATAN
  // ==========================================
  {
    commandType: "CREATE_DIVISION",
    execute: async (cmd: Command) => {
      const newId = `AGG_${ulid()}`;
      await globalLedger.appendEvent(
        "DIVISION_CREATED",
        newId,
        "DIVISION",
        1,
        cmd.payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "UPDATE_DIVISION",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "DIVISION_UPDATED",
        cmd.payload.id,
        "DIVISION",
        nextVer,
        cmd.payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "CREATE_POSITION",
    execute: async (cmd: Command) => {
      const newId = `AGG_${ulid()}`;
      await globalLedger.appendEvent(
        "POSITION_CREATED",
        newId,
        "POSITION",
        1,
        cmd.payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "UPDATE_POSITION",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "POSITION_UPDATED",
        cmd.payload.id,
        "POSITION",
        nextVer,
        cmd.payload,
        getActiveActor(),
      );
    },
  },

  // ==========================================
  // 6. TIPE DOKUMEN
  // ==========================================
  {
    commandType: "CREATE_DOCUMENT_TYPE",
    execute: async (cmd: Command) => {
      const newId = `AGG_${ulid()}`;
      await globalLedger.appendEvent(
        "DOCUMENT_TYPE_CREATED",
        newId,
        "DOCUMENT_TYPE",
        1,
        cmd.payload,
        getActiveActor(),
      );
    },
  },

  // ==========================================
  // 7. EMPLOYEE & PENUGASAN
  // ==========================================
  {
    commandType: "CREATE_EMPLOYEE",
    execute: async (cmd: Command) => {
      const employeeId = `AGG_${ulid()}`;
      const empNumber =
        cmd.payload.employeeNumber ||
        `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
      const empPayload = {
        employeeNumber: empNumber,
        fullName: cmd.payload.fullName,
        gender: cmd.payload.gender || "LAKI-LAKI",
        phone: cmd.payload.phone || null,
        email: cmd.payload.email || null,
        employmentStatus: cmd.payload.employmentStatus || "PERMANENT",
        systemStatus: "REGISTERED",
      };
      await globalLedger.appendEvent(
        "EMPLOYEE_CREATED",
        employeeId,
        "EMPLOYEE",
        1,
        empPayload,
        getActiveActor(),
      );

      if (cmd.payload.assignment) {
        const assignmentId = `ASN_${ulid()}`;
        const assignPayload = {
          assignmentId,
          companyId: cmd.payload.assignment.companyId,
          regionId: cmd.payload.assignment.regionId,
          outletId: cmd.payload.assignment.outletId,
          divisionId: cmd.payload.assignment.divisionId,
          positionId: cmd.payload.assignment.positionId,
          reportsToEmployeeId:
            cmd.payload.assignment.reportsToEmployeeId || null,
          startDate:
            cmd.payload.assignment.startDate ||
            new Date().toISOString().slice(0, 10),
          isPrimary: true,
        };
        await globalLedger.appendEvent(
          "EMPLOYMENT_ASSIGNED",
          employeeId,
          "EMPLOYEE",
          2,
          assignPayload,
          getActiveActor(),
        );
      }
    },
  },
  {
    commandType: "UPDATE_EMPLOYEE",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "EMPLOYEE_UPDATED",
        cmd.payload.id,
        "EMPLOYEE",
        nextVer,
        cmd.payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "ASSIGN_EMPLOYMENT",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.employeeId)) + 1;
      const assignmentId = `ASN_${ulid()}`;
      const payload = {
        assignmentId,
        ...cmd.payload,
      };
      await globalLedger.appendEvent(
        "EMPLOYMENT_ASSIGNED",
        cmd.payload.employeeId,
        "EMPLOYEE",
        nextVer,
        payload,
        getActiveActor(),
      );
    },
  },

  // ==========================================
  // 8. USER ACCOUNT (AKUN SISTEM)
  // ==========================================
  {
    commandType: "CREATE_USER_ACCOUNT",
    execute: async (cmd: Command) => {
      const userId = `AGG_${ulid()}`;
      await globalLedger.appendEvent(
        "USER_ACCOUNT_CREATED",
        userId,
        "USER_ACCOUNT",
        1,
        cmd.payload,
        getActiveActor(),
      );
    },
  },
  {
    commandType: "UPDATE_USER_ACCOUNT",
    execute: async (cmd: Command) => {
      const nextVer =
        (await globalLedger.getAggregateVersion(cmd.payload.id)) + 1;
      await globalLedger.appendEvent(
        "USER_ACCOUNT_UPDATED",
        cmd.payload.id,
        "USER_ACCOUNT",
        nextVer,
        cmd.payload,
        getActiveActor(),
      );
    },
  },

  // ==========================================
  // 9. GLOBAL ARCHIVE & RESTORE
  // ==========================================
  {
    commandType: "ARCHIVE_DATA",
    execute: async (cmd: Command) => {
      const { id, type, documentId, bankAccountId, assignmentId } = cmd.payload;
      const nextVer = (await globalLedger.getAggregateVersion(id)) + 1;
      if (type === "DOCUMENT") {
        await globalBlobManager.removeFileFromCache(
          documentId,
          "ORGANIZATION",
          true,
        );
        await globalLedger.appendEvent(
          "DOCUMENT_ARCHIVED",
          id,
          "ORGANIZATION",
          nextVer,
          { documentId },
          getActiveActor(),
        );
      } else if (type === "BANK_ACCOUNT") {
        await globalLedger.appendEvent(
          "BANK_ACCOUNT_ARCHIVED",
          id,
          "ORGANIZATION",
          nextVer,
          { bankAccountId },
          getActiveActor(),
        );
      } else if (type === "EMPLOYMENT_ASSIGNMENT") {
        await globalLedger.appendEvent(
          "EMPLOYMENT_ASSIGNMENT_ARCHIVED",
          id,
          "EMPLOYEE",
          nextVer,
          { assignmentId },
          getActiveActor(),
        );
      } else {
        await globalLedger.appendEvent(
          `${type}_ARCHIVED`,
          id,
          type,
          nextVer,
          {},
          getActiveActor(),
        );
      }
    },
  },
  {
    commandType: "RESTORE_DATA",
    execute: async (cmd: Command) => {
      const { id, type, targetId } = cmd.payload;
      const aggregateId =
        type === "DOCUMENT" || type === "BANK_ACCOUNT" ? targetId : id;
      const nextVer = (await globalLedger.getAggregateVersion(aggregateId)) + 1;
      if (type === "DOCUMENT") {
        await globalLedger.appendEvent(
          "DOCUMENT_RESTORED",
          aggregateId,
          "ORGANIZATION",
          nextVer,
          { documentId: id },
          getActiveActor(),
        );
      } else if (type === "BANK_ACCOUNT") {
        await globalLedger.appendEvent(
          "BANK_ACCOUNT_RESTORED",
          aggregateId,
          "ORGANIZATION",
          nextVer,
          { bankAccountId: id },
          getActiveActor(),
        );
      } else {
        await globalLedger.appendEvent(
          `${type}_RESTORED`,
          aggregateId,
          type,
          nextVer,
          {},
          getActiveActor(),
        );
      }
    },
  },
];
