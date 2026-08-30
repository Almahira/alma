// File: modules/mdl_organization/src/shared/OrganizationProjection.ts
import { ProjectionHandler } from "../../../../packages/core_unv/src/cqrs/types";
import { LedgerEventDoc } from "../../../../packages/core_unv/src/ledger/schema";

export interface OrgState {
  companies: any[];
  regions: any[];
  outlets: any[];
  documents: any[];
  bankAccounts: any[];
  divisions: any[];
  positions: any[];
  documentTypes: any[];
  employees: any[];
  employmentAssignments: any[];
  employeeDocuments: any[];
  userAccounts: any[];
}

export class OrganizationProjection implements ProjectionHandler<OrgState> {
  aggregateType = "ORGANIZATION";
  listenTo = [
    "COMPANY",
    "REGION",
    "OUTLET",
    "DIVISION",
    "POSITION",
    "DOCUMENT_TYPE",
    "EMPLOYEE",
    "USER_ACCOUNT",
    "DICTIONARY",
  ];

  private companies = new Map<string, any>();
  private regions = new Map<string, any>();
  private outlets = new Map<string, any>();
  private documents = new Map<string, any>();
  private bankAccounts = new Map<string, any>();
  private divisions = new Map<string, any>();
  private positions = new Map<string, any>();
  private documentTypes = new Map<string, any>();
  private employees = new Map<string, any>();
  private employmentAssignments = new Map<string, any>();
  private employeeDocuments = new Map<string, any>();
  private userAccounts = new Map<string, any>();

  public applyEvent(event: LedgerEventDoc): void {
    const { type, payload, aggregateId } = event;

    switch (type) {
      // 1. COMPANY
      case "COMPANY_CREATED":
        if (!this.companies.has(aggregateId)) {
          this.companies.set(aggregateId, {
            id: aggregateId,
            ...payload,
            status: "Aktif",
          });
        }
        break;
      case "COMPANY_UPDATED":
        if (this.companies.has(aggregateId)) {
          this.companies.set(aggregateId, {
            ...this.companies.get(aggregateId),
            ...payload,
          });
        }
        break;
      case "COMPANY_ARCHIVED":
        if (this.companies.has(aggregateId))
          this.companies.get(aggregateId).status = "Arsip";
        break;
      case "COMPANY_RESTORED":
        if (this.companies.has(aggregateId))
          this.companies.get(aggregateId).status = "Aktif";
        break;

      // 2. REGION
      case "REGION_CREATED":
        if (!this.regions.has(aggregateId)) {
          this.regions.set(aggregateId, {
            id: aggregateId,
            ...payload,
            status: "Aktif",
          });
        }
        break;
      case "REGION_UPDATED":
        if (this.regions.has(aggregateId)) {
          this.regions.set(aggregateId, {
            ...this.regions.get(aggregateId),
            ...payload,
          });
        }
        break;
      case "REGION_ARCHIVED":
        if (this.regions.has(aggregateId))
          this.regions.get(aggregateId).status = "Arsip";
        break;
      case "REGION_RESTORED":
        if (this.regions.has(aggregateId))
          this.regions.get(aggregateId).status = "Aktif";
        break;

      // 3. OUTLET
      case "OUTLET_CREATED":
        if (!this.outlets.has(aggregateId)) {
          this.outlets.set(aggregateId, {
            id: aggregateId,
            ...payload,
            status: "Aktif",
          });
        }
        break;
      case "OUTLET_UPDATED":
        if (this.outlets.has(aggregateId)) {
          this.outlets.set(aggregateId, {
            ...this.outlets.get(aggregateId),
            ...payload,
          });
        }
        break;
      case "OUTLET_ARCHIVED":
        if (this.outlets.has(aggregateId))
          this.outlets.get(aggregateId).status = "Arsip";
        break;
      case "OUTLET_RESTORED":
        if (this.outlets.has(aggregateId))
          this.outlets.get(aggregateId).status = "Aktif";
        break;

      // 4. DOCUMENTS & BANK ACCOUNTS (SUB-ENTITIES)
      case "DOCUMENT_ATTACHED":
        this.documents.set(payload.documentId, {
          ...payload,
          id: aggregateId,
          status: "Aktif",
        });
        break;
      case "DOCUMENT_UPDATED":
        if (this.documents.has(payload.documentId)) {
          this.documents.set(payload.documentId, {
            ...this.documents.get(payload.documentId),
            ...payload,
          });
        }
        break;
      case "DOCUMENT_ARCHIVED":
        if (this.documents.has(payload.documentId))
          this.documents.get(payload.documentId).status = "Arsip";
        break;
      case "DOCUMENT_RESTORED":
        if (this.documents.has(payload.documentId))
          this.documents.get(payload.documentId).status = "Aktif";
        break;

      case "BANK_ACCOUNT_ADDED":
        this.bankAccounts.set(payload.bankAccountId, {
          ...payload,
          id: aggregateId,
          status: "Aktif",
        });
        break;
      case "BANK_ACCOUNT_UPDATED":
        if (this.bankAccounts.has(payload.bankAccountId)) {
          this.bankAccounts.set(payload.bankAccountId, {
            ...this.bankAccounts.get(payload.bankAccountId),
            ...payload,
          });
        }
        break;
      case "BANK_ACCOUNT_ARCHIVED":
        if (this.bankAccounts.has(payload.bankAccountId))
          this.bankAccounts.get(payload.bankAccountId).status = "Arsip";
        break;
      case "BANK_ACCOUNT_RESTORED":
        if (this.bankAccounts.has(payload.bankAccountId))
          this.bankAccounts.get(payload.bankAccountId).status = "Aktif";
        break;

      // 5. DIVISION & POSITION
      case "DIVISION_CREATED":
        this.divisions.set(aggregateId, {
          id: aggregateId,
          ...payload,
          status: "Aktif",
        });
        break;
      case "DIVISION_UPDATED":
        if (this.divisions.has(aggregateId)) {
          this.divisions.set(aggregateId, {
            ...this.divisions.get(aggregateId),
            ...payload,
          });
        }
        break;
      case "DIVISION_ARCHIVED":
        if (this.divisions.has(aggregateId))
          this.divisions.get(aggregateId).status = "Arsip";
        break;
      case "DIVISION_RESTORED":
        if (this.divisions.has(aggregateId))
          this.divisions.get(aggregateId).status = "Aktif";
        break;

      case "POSITION_CREATED":
        this.positions.set(aggregateId, {
          id: aggregateId,
          ...payload,
          status: "Aktif",
        });
        break;
      case "POSITION_UPDATED":
        if (this.positions.has(aggregateId)) {
          this.positions.set(aggregateId, {
            ...this.positions.get(aggregateId),
            ...payload,
          });
        }
        break;
      case "POSITION_ARCHIVED":
        if (this.positions.has(aggregateId))
          this.positions.get(aggregateId).status = "Arsip";
        break;
      case "POSITION_RESTORED":
        if (this.positions.has(aggregateId))
          this.positions.get(aggregateId).status = "Aktif";
        break;

      // 6. DOCUMENT TYPES
      case "DOCUMENT_TYPE_CREATED":
        this.documentTypes.set(aggregateId, {
          id: aggregateId,
          ...payload,
          status: "Aktif",
        });
        break;
      case "DOCUMENT_TYPE_UPDATED":
        if (this.documentTypes.has(aggregateId)) {
          this.documentTypes.set(aggregateId, {
            ...this.documentTypes.get(aggregateId),
            ...payload,
          });
        }
        break;
      case "DOCUMENT_TYPE_ARCHIVED":
        if (this.documentTypes.has(aggregateId))
          this.documentTypes.get(aggregateId).status = "Arsip";
        break;
      case "DOCUMENT_TYPE_RESTORED":
        if (this.documentTypes.has(aggregateId))
          this.documentTypes.get(aggregateId).status = "Aktif";
        break;

      // 7. EMPLOYEES & ASSIGNMENTS
      case "EMPLOYEE_CREATED":
        this.employees.set(aggregateId, {
          id: aggregateId,
          ...payload,
          status: "Aktif",
        });
        break;
      case "EMPLOYEE_UPDATED":
        if (this.employees.has(aggregateId)) {
          this.employees.set(aggregateId, {
            ...this.employees.get(aggregateId),
            ...payload,
          });
        }
        break;
      case "EMPLOYEE_ARCHIVED":
        if (this.employees.has(aggregateId))
          this.employees.get(aggregateId).status = "Arsip";
        break;
      case "EMPLOYEE_RESTORED":
        if (this.employees.has(aggregateId))
          this.employees.get(aggregateId).status = "Aktif";
        break;

      case "EMPLOYMENT_ASSIGNED":
        this.employmentAssignments.set(payload.assignmentId, {
          ...payload,
          id: payload.assignmentId,
          employeeId: aggregateId,
          status: "Aktif",
        });
        break;
      case "EMPLOYMENT_ASSIGNMENT_UPDATED":
        if (this.employmentAssignments.has(payload.assignmentId)) {
          this.employmentAssignments.set(payload.assignmentId, {
            ...this.employmentAssignments.get(payload.assignmentId),
            ...payload,
          });
        }
        break;
      case "EMPLOYMENT_ASSIGNMENT_ARCHIVED":
        if (this.employmentAssignments.has(payload.assignmentId)) {
          this.employmentAssignments.get(payload.assignmentId).status = "Arsip";
        }
        break;

      // 8. EMPLOYEE DOCUMENTS
      case "EMPLOYEE_DOCUMENT_ATTACHED":
        this.employeeDocuments.set(payload.documentId, {
          ...payload,
          id: payload.documentId,
          employeeId: aggregateId,
          status: "Aktif",
        });
        break;
      case "EMPLOYEE_DOCUMENT_ARCHIVED":
        if (this.employeeDocuments.has(payload.documentId)) {
          this.employeeDocuments.get(payload.documentId).status = "Arsip";
        }
        break;

      // 9. USER ACCOUNTS
      case "USER_ACCOUNT_CREATED":
        this.userAccounts.set(aggregateId, {
          id: aggregateId,
          ...payload,
          status: "Aktif",
        });
        break;
      case "USER_ACCOUNT_UPDATED":
        if (this.userAccounts.has(aggregateId)) {
          this.userAccounts.set(aggregateId, {
            ...this.userAccounts.get(aggregateId),
            ...payload,
          });
        }
        break;
      case "USER_ACCOUNT_ARCHIVED":
        if (this.userAccounts.has(aggregateId))
          this.userAccounts.get(aggregateId).status = "Arsip";
        break;
      case "USER_ACCOUNT_RESTORED":
        if (this.userAccounts.has(aggregateId))
          this.userAccounts.get(aggregateId).status = "Aktif";
        break;
    }
  }

  public getState(): OrgState {
    return {
      companies: Array.from(this.companies.values()),
      regions: Array.from(this.regions.values()),
      outlets: Array.from(this.outlets.values()),
      documents: Array.from(this.documents.values()),
      bankAccounts: Array.from(this.bankAccounts.values()),
      divisions: Array.from(this.divisions.values()),
      positions: Array.from(this.positions.values()),
      documentTypes: Array.from(this.documentTypes.values()),
      employees: Array.from(this.employees.values()),
      employmentAssignments: Array.from(this.employmentAssignments.values()),
      employeeDocuments: Array.from(this.employeeDocuments.values()),
      userAccounts: Array.from(this.userAccounts.values()),
    };
  }

  public reset(): void {
    this.companies.clear();
    this.regions.clear();
    this.outlets.clear();
    this.documents.clear();
    this.bankAccounts.clear();
    this.divisions.clear();
    this.positions.clear();
    this.documentTypes.clear();
    this.employees.clear();
    this.employmentAssignments.clear();
    this.employeeDocuments.clear();
    this.userAccounts.clear();
  }

  public restoreState(state: OrgState): void {
    this.reset();
    state.companies?.forEach((c) => this.companies.set(c.id, c));
    state.regions?.forEach((r) => this.regions.set(r.id, r));
    state.outlets?.forEach((o) => this.outlets.set(o.id, o));
    state.documents?.forEach((d) =>
      this.documents.set(d.documentId || d.id, d),
    );
    state.bankAccounts?.forEach((b) =>
      this.bankAccounts.set(b.bankAccountId || b.id, b),
    );
    state.divisions?.forEach((d) => this.divisions.set(d.id, d));
    state.positions?.forEach((p) => this.positions.set(p.id, p));
    state.documentTypes?.forEach((dt) => this.documentTypes.set(dt.id, dt));
    state.employees?.forEach((e) => this.employees.set(e.id, e));
    state.employmentAssignments?.forEach((ea) =>
      this.employmentAssignments.set(ea.id || ea.assignmentId, ea),
    );
    state.employeeDocuments?.forEach((ed) =>
      this.employeeDocuments.set(ed.id || ed.documentId, ed),
    );
    state.userAccounts?.forEach((u) => this.userAccounts.set(u.id, u));
  }
}
