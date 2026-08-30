// File: modules/mdl_receiving/src/client/store.ts
import { create } from "zustand";
import { globalRegistry } from "../../../../packages/core_unv/src/cqrs/UniversalRegistry";

interface ReceivingStoreState {
  documents: any[];
  refreshData: () => void;
}

export const useReceivingStore = create<ReceivingStoreState>((set) => ({
  documents: [],
  refreshData: () => {
    const state = globalRegistry.getState("RECEIVING_DOCUMENT");
    if (state) {
      set({ documents: state.documents || [] });
    }
  },
}));

// Mendengarkan trigger pembaruan UI Global
if (typeof window !== "undefined") {
  window.addEventListener("UNV_STATE_UPDATED", () => {
    useReceivingStore.getState().refreshData();
  });
  useReceivingStore.getState().refreshData();
}
