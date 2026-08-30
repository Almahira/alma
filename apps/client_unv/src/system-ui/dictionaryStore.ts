import { create } from "zustand";
import { globalRegistry } from "../../../../packages/core_unv/src/cqrs/UniversalRegistry";

interface DictionaryStoreState {
  items: any[];
  refreshData: () => void;
  getItemsByCategory: (category: string) => any[];
}

export const useDictionaryStore = create<DictionaryStoreState>((set, get) => ({
  items: [],
  refreshData: () => {
    const state = globalRegistry.getState("DICTIONARY");
    if (state) set({ items: state.items || [] });
  },
  getItemsByCategory: (category: string) => {
    return get().items.filter(
      (item) => item.category === category && item.status === "Aktif",
    );
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("UNV_STATE_UPDATED", () => {
    useDictionaryStore.getState().refreshData();
  });
  useDictionaryStore.getState().refreshData();
}
