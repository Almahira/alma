// File: modules/mdl_organization/src/client/store.ts
import { create } from "zustand";
import { globalRegistry } from "../../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { OrgState } from "../shared/OrganizationProjection";

interface OrgStoreState extends OrgState {
  refreshData: () => void;
  // Helper Selectors
  getEmployeesByOutlet: (outletId: string) => any[];
  getAssignmentsByEmployee: (employeeId: string) => any[];
  getUserByEmployeeId: (employeeId: string) => any | null;
  getPositionsByDivision: (divisionId: string) => any[];
}

export const useOrgStore = create<OrgStoreState>((set, get) => ({
  companies: [],
  regions: [],
  outlets: [],
  documents: [],
  bankAccounts: [],
  divisions: [],
  positions: [],
  documentTypes: [],
  employees: [],
  employmentAssignments: [],
  employeeDocuments: [],
  userAccounts: [],

  refreshData: () => {
    const state = globalRegistry.getState("ORGANIZATION") as OrgState | null;
    if (state) {
      set({
        companies: state.companies || [],
        regions: state.regions || [],
        outlets: state.outlets || [],
        documents: state.documents || [],
        bankAccounts: state.bankAccounts || [],
        divisions: state.divisions || [],
        positions: state.positions || [],
        documentTypes: state.documentTypes || [],
        employees: state.employees || [],
        employmentAssignments: state.employmentAssignments || [],
        employeeDocuments: state.employeeDocuments || [],
        userAccounts: state.userAccounts || [],
      });
    }
  },

  getEmployeesByOutlet: (outletId: string) => {
    const activeAssignments = get().employmentAssignments.filter(
      (a) => a.outletId === outletId && a.status === "Aktif",
    );
    const employeeIds = new Set(activeAssignments.map((a) => a.employeeId));
    return get().employees.filter(
      (e) => employeeIds.has(e.id) && e.status === "Aktif",
    );
  },

  getAssignmentsByEmployee: (employeeId: string) => {
    return get().employmentAssignments.filter(
      (a) => a.employeeId === employeeId && a.status === "Aktif",
    );
  },

  getUserByEmployeeId: (employeeId: string) => {
    return (
      get().userAccounts.find(
        (u) => u.employeeId === employeeId && u.status === "Aktif",
      ) || null
    );
  },

  getPositionsByDivision: (divisionId: string) => {
    return get().positions.filter(
      (p) => p.divisionId === divisionId && p.status === "Aktif",
    );
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("UNV_STATE_UPDATED", () => {
    useOrgStore.getState().refreshData();
  });
  useOrgStore.getState().refreshData();
}
