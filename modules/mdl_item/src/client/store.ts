// File: modules/mdl_item/src/client/store.ts
import { create } from "zustand";
import { globalRegistry } from "../../../../packages/core_unv/src/cqrs/UniversalRegistry";

interface ItemStoreState {
  categories: any[];
  uoms: any[];
  products: any[];
  refreshData: () => void;
}

export const useItemStore = create<ItemStoreState>((set) => ({
  categories: [],
  uoms: [],
  products: [],
  refreshData: () => {
    const state = globalRegistry.getState("ITEM_DOMAIN");
    if (state) {
      set({
        categories: state.categories || [],
        uoms: state.uoms || [],
        products: state.products || [],
      });
    }
  },
}));

// Mengikat store ke Event Bus Global agar reaktif saat ada event masuk
if (typeof window !== "undefined") {
  window.addEventListener("UNV_STATE_UPDATED", () => {
    useItemStore.getState().refreshData();
  });
  // Inisialisasi data proaktif saat boot
  useItemStore.getState().refreshData();
}
