// File: apps/client_unv/src/system-ui/DataManagerSM.tsx
import React, { useState, useEffect } from "react";
import { Settings2, Trash2, GitMerge, X, Plus } from "lucide-react";
import { manager } from "../pluginRegistry";
import { useDictionaryStore } from "./dictionaryStore";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../shared-ui/useToastStore";
import { ulid } from "ulidx";

export function DataManagerSM() {
  const [categories, setCategories] = useState<
    { id: string; label: string; moduleName: string }[]
  >([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [mergeTarget, setMergeTarget] = useState<{
    id: string;
    value: string;
  } | null>(null);
  const [mergeInput, setMergeInput] = useState("");

  const items = useDictionaryStore((state) =>
    state.getItemsByCategory(activeCategory || ""),
  );

  useEffect(() => {
    const plugins = manager.getActivePlugins();
    const discovered: { id: string; label: string; moduleName: string }[] = [];
    plugins.forEach((plugin) => {
      if (plugin.registerDictionaries) {
        plugin
          .registerDictionaries()
          .forEach((d) => discovered.push({ ...d, moduleName: plugin.name }));
      }
    });
    setCategories(discovered);
    if (discovered.length > 0) setActiveCategory(discovered[0].id);
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && activeCategory) {
      globalCommandBus.execute({
        type: "CREATE_DICTIONARY",
        payload: {
          category: activeCategory,
          value: inputValue.toUpperCase().trim(),
        },
      });
      sysToast.success("Berhasil", `Nilai "${inputValue.toUpperCase()}" ditambahkan.`);
      setInputValue("");
    }
  };

  const handleArchive = (id: string, val: string) => {
    if (window.confirm(`Hapus kata "${val}" dari kamus data?`)) {
      globalCommandBus.execute({ type: "ARCHIVE_DICTIONARY", payload: { id } });
      sysToast.success("Berhasil", "Data kamus dihapus.");
    }
  };

  const executeMerge = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      mergeTarget &&
      mergeInput.trim() &&
      mergeInput.toUpperCase() !== mergeTarget.value
    ) {
      const targetValue = mergeInput.toUpperCase().trim();
      const existingTarget = items.find((i) => i.value === targetValue);
      const targetId = existingTarget ? existingTarget.id : `AGG_${ulid()}`;
      globalCommandBus.execute({
        type: "MERGE_DICTIONARY",
        payload: {
          category: activeCategory,
          sourceId: mergeTarget.id,
          targetId: targetId,
          sourceValue: mergeTarget.value,
          targetValue: targetValue,
        },
      });
      sysToast.success("Berhasil", `Data "${mergeTarget.value}" digabungkan ke "${targetValue}".`);
      setMergeTarget(null);
      setMergeInput("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-(--bg-card) overflow-hidden relative">
      {/* HEADER MOBILE */}
      <div className="p-3 bg-(--bg-card) border-b border-(--border-color) shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-orange-500" />
          <div>
            <h2 className="text-sm font-black text-(--text-primary) uppercase tracking-wide">
              Data Manager
            </h2>
            <span className="text-[10px] text-(--text-secondary) font-bold">
              Master Kamus &amp; Normalisasi Kata
            </span>
          </div>
        </div>

        {/* Category Selector (Horizontal Scroll) */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition ${
                activeCategory === cat.id
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-(--text-secondary) bg-(--bg-input)"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Quick Add Form */}
        <form onSubmit={handleAdd} className="flex gap-1.5 pt-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            placeholder="Ketik nilai kamus baru..."
            className="flex-1 text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none text-(--text-primary)"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="px-3 py-2 bg-orange-500 text-white font-black text-xs rounded-lg shadow-sm disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* LIST KAMUS DATA (CARD LIST MOBILE) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-3 bg-(--surface-hover) rounded-xl border border-(--border-color) flex items-center justify-between text-xs"
          >
            <div>
              <span className="font-bold text-sm text-(--text-primary) block">{item.value}</span>
              <span className="text-[9px] text-emerald-600 font-black uppercase font-mono">
                AKTIF
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setMergeTarget({ id: item.id, value: item.value });
                  setMergeInput("");
                }}
                className="p-1.5 text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg"
                title="Normalisasi / Merge Kata"
              >
                <GitMerge className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleArchive(item.id, item.value)}
                className="p-1.5 text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg"
                title="Hapus"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="p-8 text-center text-(--text-secondary) font-bold text-xs italic">
            Kamus data kosong. Ketik di atas lalu simpan.
          </div>
        )}
      </div>

      {/* OVERLAY MODAL MERGE KATA */}
      {mergeTarget && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-(--bg-card) border border-(--border-color) rounded-2xl w-full max-w-sm p-4 space-y-3 text-(--text-primary)">
            <div className="flex justify-between items-center border-b border-(--border-color) pb-2">
              <span className="font-black text-xs uppercase text-amber-500 flex items-center gap-1.5">
                <GitMerge className="w-4 h-4" /> Normalisasi Kata
              </span>
              <button onClick={() => setMergeTarget(null)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <span className="text-[9px] font-black text-(--text-secondary) uppercase block mb-1">
                Kata Lama:
              </span>
              <div className="p-2 bg-(--bg-input) rounded-lg font-mono text-xs font-bold text-(--text-primary)">
                {mergeTarget.value}
              </div>
            </div>

            <div>
              <span className="text-[9px] font-black text-(--text-secondary) uppercase block mb-1">
                Ubah Menjadi Kata Baku:
              </span>
              <input
                type="text"
                autoFocus
                value={mergeInput}
                onChange={(e) => setMergeInput(e.target.value.toUpperCase())}
                placeholder="CONTOH: OPERASIONAL"
                className="w-full text-xs font-bold p-2.5 bg-(--bg-input) border border-amber-500/40 rounded-lg outline-none text-(--text-primary)"
              />
            </div>

            <p className="text-[10px] text-slate-400 leading-snug">
              Semua data transaksi historis yang menggunakan kata lama akan diselaraskan otomatis.
            </p>

            <div className="flex gap-2 pt-2 border-t border-(--border-color)">
              <button
                type="button"
                onClick={() => setMergeTarget(null)}
                className="flex-1 py-2 text-xs font-bold text-(--text-secondary) rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeMerge}
                disabled={!mergeInput.trim()}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase rounded-lg shadow-md disabled:opacity-40"
              >
                Merge Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
