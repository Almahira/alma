// File: modules/mdl_organization/src/server/event-handlers.ts
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";

export const organizationHandlers: Record<
  string,
  (tx: any, event: any) => Promise<void>
> = {
  // 1. COMPANY
  COMPANY_CREATED: async (tx, event) => {
    await tx.insert(schema.companies).values({
      id: event.aggregateId,
      code: event.payload.code,
      name: event.payload.name,
      legalName: event.payload.legalName || null,
      description: event.payload.description || null,
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  COMPANY_UPDATED: async (tx, event) => {
    await tx
      .update(schema.companies)
      .set({
        name: event.payload.name,
        legalName: event.payload.legalName || null,
        description: event.payload.description || null,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.companies.id, event.aggregateId));
  },
  COMPANY_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.companies)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.companies.id, event.aggregateId));
  },
  COMPANY_RESTORED: async (tx, event) => {
    await tx
      .update(schema.companies)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.companies.id, event.aggregateId));
  },

  // 2. REGION
  REGION_CREATED: async (tx, event) => {
    await tx.insert(schema.regions).values({
      id: event.aggregateId,
      companyId: event.payload.companyId,
      code: event.payload.code,
      name: event.payload.name,
      timezone: event.payload.timezone || "Asia/Jakarta",
      address: event.payload.address || null,
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  REGION_UPDATED: async (tx, event) => {
    await tx
      .update(schema.regions)
      .set({
        name: event.payload.name,
        timezone: event.payload.timezone || "Asia/Jakarta",
        address: event.payload.address || null,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.regions.id, event.aggregateId));
  },
  REGION_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.regions)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.regions.id, event.aggregateId));
  },
  REGION_RESTORED: async (tx, event) => {
    await tx
      .update(schema.regions)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.regions.id, event.aggregateId));
  },

  // 3. OUTLET
  OUTLET_CREATED: async (tx, event) => {
    await tx.insert(schema.outlets).values({
      id: event.aggregateId,
      companyId: event.payload.companyId,
      regionId: event.payload.regionId,
      code: event.payload.code,
      name: event.payload.name,
      address: event.payload.address,
      industry: event.payload.industry || null,
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  OUTLET_UPDATED: async (tx, event) => {
    await tx
      .update(schema.outlets)
      .set({
        name: event.payload.name,
        address: event.payload.address,
        industry: event.payload.industry || null,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.outlets.id, event.aggregateId));
  },
  OUTLET_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.outlets)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.outlets.id, event.aggregateId));
  },
  OUTLET_RESTORED: async (tx, event) => {
    await tx
      .update(schema.outlets)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.outlets.id, event.aggregateId));
  },

  // 4. DOCUMENTS & BANK ACCOUNTS
  DOCUMENT_ATTACHED: async (tx, event) => {
    await tx
      .insert(schema.documents)
      .values({
        id: event.payload.documentId,
        targetId: event.aggregateId,
        name: event.payload.name,
        fileName: event.payload.fileName,
        fileType: event.payload.fileType || "unknown",
        size: event.payload.size || 0,
      })
      .onConflictDoNothing();
  },
  DOCUMENT_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.documents)
      .set({ isActive: false })
      .where(eq(schema.documents.id, event.payload.documentId));
  },
  DOCUMENT_RESTORED: async (tx, event) => {
    await tx
      .update(schema.documents)
      .set({ isActive: true })
      .where(eq(schema.documents.id, event.payload.documentId));
  },

  BANK_ACCOUNT_ADDED: async (tx, event) => {
    await tx
      .insert(schema.bankAccounts)
      .values({
        id: event.payload.bankAccountId,
        targetId: event.aggregateId,
        bankName: event.payload.bankName,
        accountNumber: event.payload.accountNumber,
        accountName: event.payload.accountName,
        description: event.payload.description || null,
      })
      .onConflictDoNothing();
  },
  BANK_ACCOUNT_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.bankAccounts)
      .set({ isActive: false })
      .where(eq(schema.bankAccounts.id, event.payload.bankAccountId));
  },
  BANK_ACCOUNT_RESTORED: async (tx, event) => {
    await tx
      .update(schema.bankAccounts)
      .set({ isActive: true })
      .where(eq(schema.bankAccounts.id, event.payload.bankAccountId));
  },

  // 5. DIVISIONS & POSITIONS
  DIVISION_CREATED: async (tx, event) => {
    await tx.insert(schema.divisions).values({
      id: event.aggregateId,
      companyId: event.payload.companyId,
      name: event.payload.name,
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  DIVISION_UPDATED: async (tx, event) => {
    await tx
      .update(schema.divisions)
      .set({
        name: event.payload.name,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.divisions.id, event.aggregateId));
  },
  DIVISION_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.divisions)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.divisions.id, event.aggregateId));
  },
  DIVISION_RESTORED: async (tx, event) => {
    await tx
      .update(schema.divisions)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.divisions.id, event.aggregateId));
  },

  POSITION_CREATED: async (tx, event) => {
    await tx.insert(schema.positions).values({
      id: event.aggregateId,
      companyId: event.payload.companyId,
      divisionId: event.payload.divisionId,
      name: event.payload.name,
      sopFileUrl: event.payload.sopFileUrl || null,
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  POSITION_UPDATED: async (tx, event) => {
    await tx
      .update(schema.positions)
      .set({
        name: event.payload.name,
        sopFileUrl: event.payload.sopFileUrl || null,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.positions.id, event.aggregateId));
  },
  POSITION_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.positions)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.positions.id, event.aggregateId));
  },
  POSITION_RESTORED: async (tx, event) => {
    await tx
      .update(schema.positions)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.positions.id, event.aggregateId));
  },

  // 6. DOCUMENT TYPES
  DOCUMENT_TYPE_CREATED: async (tx, event) => {
    await tx.insert(schema.documentTypes).values({
      id: event.aggregateId,
      companyId: event.payload.companyId,
      name: event.payload.name,
      isRequired: event.payload.isRequired || false,
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  DOCUMENT_TYPE_UPDATED: async (tx, event) => {
    await tx
      .update(schema.documentTypes)
      .set({
        name: event.payload.name,
        isRequired: event.payload.isRequired || false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.documentTypes.id, event.aggregateId));
  },

  // 7. EMPLOYEES & ASSIGNMENTS
  EMPLOYEE_CREATED: async (tx, event) => {
    await tx.insert(schema.employees).values({
      id: event.aggregateId,
      employeeNumber: event.payload.employeeNumber,
      fullName: event.payload.fullName,
      gender: event.payload.gender || "LAKI-LAKI",
      phone: event.payload.phone || null,
      email: event.payload.email || null,
      employmentStatus: event.payload.employmentStatus || "PERMANENT",
      systemStatus: event.payload.systemStatus || "REGISTERED",
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },
  EMPLOYEE_UPDATED: async (tx, event) => {
    await tx
      .update(schema.employees)
      .set({
        fullName: event.payload.fullName,
        gender: event.payload.gender,
        phone: event.payload.phone || null,
        email: event.payload.email || null,
        employmentStatus: event.payload.employmentStatus,
        systemStatus: event.payload.systemStatus || "REGISTERED",
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.employees.id, event.aggregateId));
  },
  EMPLOYEE_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.employees)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.employees.id, event.aggregateId));
  },
  EMPLOYEE_RESTORED: async (tx, event) => {
    await tx
      .update(schema.employees)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.employees.id, event.aggregateId));
  },

  EMPLOYMENT_ASSIGNED: async (tx, event) => {
    await tx.insert(schema.employmentAssignments).values({
      id: event.payload.assignmentId,
      employeeId: event.aggregateId,
      companyId: event.payload.companyId,
      regionId: event.payload.regionId,
      outletId: event.payload.outletId,
      divisionId: event.payload.divisionId,
      positionId: event.payload.positionId,
      reportsToEmployeeId: event.payload.reportsToEmployeeId || null,
      startDate: event.payload.startDate,
      endDate: event.payload.endDate || null,
      isPrimary:
        event.payload.isPrimary !== undefined ? event.payload.isPrimary : true,
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },

  DOCUMENT_UPDATED: async (tx, event) => {
    await tx
      .update(schema.documents)
      .set({
        name: event.payload.name,
        fileName: event.payload.fileName,
        fileType: event.payload.fileType || "unknown",
        size: event.payload.size || 0,
      })
      .where(eq(schema.documents.id, event.payload.documentId));
  },
  BANK_ACCOUNT_UPDATED: async (tx, event) => {
    await tx
      .update(schema.bankAccounts)
      .set({
        bankName: event.payload.bankName,
        accountNumber: event.payload.accountNumber,
        accountName: event.payload.accountName,
        description: event.payload.description || null,
      })
      .where(eq(schema.bankAccounts.id, event.payload.bankAccountId));
  },

  EMPLOYEE_DOCUMENT_ATTACHED: async (tx, event) => {
    await tx.insert(schema.employeeDocuments).values({
      id: event.payload.documentId,
      employeeId: event.aggregateId,
      documentTypeId: event.payload.documentTypeId,
      documentNumber: event.payload.documentNumber,
      issueDate: event.payload.issueDate || null,
      expiryDate: event.payload.expiryDate || null,
      attachmentUrl: event.payload.attachmentUrl,
      notes: event.payload.notes || null,
      isActive: true,
      aggregateVersion: event.aggregateVersion,
      lastEventId: event.id,
    });
  },

  // 8. USER ACCOUNTS
  USER_ACCOUNT_CREATED: async (tx, event) => {
    const validRole = event.payload.role || "STAFF";
    await tx
      .insert(schema.userAccounts)
      .values({
        id: event.aggregateId,
        employeeId: event.payload.employeeId,
        username: event.payload.username,
        passwordHash:
          event.payload.passwordHash ||
          event.payload.password ||
          "DEFAULT_HASH",
        pin: event.payload.pin || null,
        role: validRole,
        positionId: event.payload.positionId || null,
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .onConflictDoUpdate({
        target: schema.userAccounts.id,
        set: {
          role: validRole,
          positionId: event.payload.positionId || null,
          passwordHash:
            event.payload.passwordHash || event.payload.password || undefined,
          pin: event.payload.pin || undefined,
          aggregateVersion: event.aggregateVersion,
          lastEventId: event.id,
          updatedAt: new Date(),
        },
      });
  },
  USER_ACCOUNT_UPDATED: async (tx, event) => {
    await tx
      .update(schema.userAccounts)
      .set({
        role: event.payload.role,
        positionId: event.payload.positionId || null,
        passwordHash: event.payload.passwordHash || undefined,
        pin: event.payload.pin !== undefined ? event.payload.pin : undefined, // <-- UPDATE PIN
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.userAccounts.id, event.aggregateId));
  },

  USER_ACCOUNT_ARCHIVED: async (tx, event) => {
    await tx
      .update(schema.userAccounts)
      .set({
        isActive: false,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.userAccounts.id, event.aggregateId));
  },
  USER_ACCOUNT_RESTORED: async (tx, event) => {
    await tx
      .update(schema.userAccounts)
      .set({
        isActive: true,
        aggregateVersion: event.aggregateVersion,
        lastEventId: event.id,
      })
      .where(eq(schema.userAccounts.id, event.aggregateId));
  },
};
