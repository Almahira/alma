// File: modules/mdl_warehouse/src/client/store.ts
import { create } from "zustand";
import { globalRegistry } from "../../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { WarehouseState } from "../shared/WarehouseProjection";

export interface WarehouseStoreState extends WarehouseState {
  refreshData: () => void;
}

export const useWarehouseStore = create<WarehouseStoreState>((set) => ({
  distributions: [],
  initialStocks: {},
  opnames: [],
  spoilWastes: [],
  recipes: [],
  refreshData: () => {
    const state = globalRegistry.getState(
      "WAREHOUSE_DOCUMENT",
    ) as WarehouseState | null;
    if (state) {
      set({
        distributions: state.distributions || [],
        initialStocks: state.initialStocks || {},
        opnames: state.opnames || [],
        spoilWastes: state.spoilWastes || [],
        recipes: state.recipes || [],
      });
    }
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("UNV_STATE_UPDATED", () => {
    useWarehouseStore.getState().refreshData();
  });
  useWarehouseStore.getState().refreshData();
}
