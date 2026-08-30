// File: modules/mdl_executivepanel/src/client/store.ts
import { create } from "zustand";
import { globalRegistry } from "../../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { ExecutivePanelState } from "../shared/ExecutivepanelProjection";

export interface ExecutivePanelStoreState extends ExecutivePanelState {
  refreshData: () => void;
}

export const useExecutivePanelStore = create<ExecutivePanelStoreState>(
  (set) => ({
    targets: {},
    allocations: [],
    ownerLedgers: [],
    refreshData: () => {
      const state = globalRegistry.getState(
        "EXECUTIVE_PANEL",
      ) as ExecutivePanelState | null;
      if (state) {
        set({
          targets: state.targets || {},
          allocations: state.allocations || [],
          ownerLedgers: state.ownerLedgers || [],
        });
      }
    },
  }),
);

if (typeof window !== "undefined") {
  window.addEventListener("UNV_STATE_UPDATED", () => {
    useExecutivePanelStore.getState().refreshData();
  });
  useExecutivePanelStore.getState().refreshData();
}
