// File: modules/mdl_plusales/src/client/store.ts
import { create } from "zustand";
import { globalRegistry } from "../../../../packages/core_unv/src/cqrs/UniversalRegistry";
import { PlusalesDocState, PlusalesState } from "../shared/PlusalesProjection";

export interface PlusalesStoreState extends PlusalesState {
  refreshData: () => void;
}

export const usePlusalesStore = create<PlusalesStoreState>((set) => ({
  documents: [],
  refreshData: () => {
    const state = globalRegistry.getState(
      "PLUSALES_DOCUMENT",
    ) as PlusalesState | null;
    if (state) {
      set({ documents: state.documents || [] });
    }
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("UNV_STATE_UPDATED", () => {
    usePlusalesStore.getState().refreshData();
  });
  usePlusalesStore.getState().refreshData();
}
