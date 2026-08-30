// File: modules/mdl_vendor/src/client/store.ts
import { create } from "zustand";
import { globalRegistry } from "../../../../packages/core_unv/src/cqrs/UniversalRegistry";

interface VendorStoreState {
  vendors: any[];
  documents: any[];
  refreshData: () => void;
}

export const useVendorStore = create<VendorStoreState>((set) => ({
  vendors: [],
  documents: [],
  refreshData: () => {
    const state = globalRegistry.getState("VENDOR");
    if (state) {
      set({
        vendors: state.vendors || [],
        documents: state.documents || [],
      });
    }
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("UNV_STATE_UPDATED", () => {
    useVendorStore.getState().refreshData();
  });
  useVendorStore.getState().refreshData();
}
