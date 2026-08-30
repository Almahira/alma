import React, { useState, useEffect } from "react";
import { Settings2, Trash2, GitMerge, X } from "lucide-react";
import { manager } from "../pluginRegistry";
import { useDictionaryStore } from "./dictionaryStore";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { motion, AnimatePresence } from "framer-motion";
import { ulid } from "ulidx";

export function DataManager() {
  const [categories, setCategories] = useState<
    { id: string; label: string; moduleName: string }[]
  >([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // State untuk Inline Form (Tambah)
  const [inputValue, setInputValue] = useState("");

  // State untuk Custom Merge Modal
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
      setInputValue(""); // Kosongkan input setelah sukses
    }
  };

  const handleArchive = (id: string) => {
    if (
      window.confirm(
        "Arsipkan data ini? Data yang dihapus tidak akan muncul di dropdown baru.",
      )
    ) {
      globalCommandBus.execute({ type: "ARCHIVE_DICTIONARY", payload: { id } });
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

      // ---> PERBAIKAN DI SINI: Gunakan ulid() standar <---
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

      setMergeTarget(null);
      setMergeInput("");
    }
  };

  return (
    <div className="flex h-full bg-(--bg-card) border border-(--border-color) rounded-xl shadow-sm overflow-hidden relative">
      {/* SIDEBAR */}
      <div className="w-64 border-r border-(--border-color) bg-(--surface-hover) flex flex-col">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-(--border-color) shrink-0 bg-(--bg-header)">
          <Settings2 className="w-5 h-5 text-orange-500" />
          <h2 className="font-bold text-(--text-primary) text-sm tracking-wide">
            MASTER DATA
          </h2>
        </div>
        <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                activeCategory === cat.id
                  ? "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                  : "text-(--text-secondary) hover:bg-(--border-color) hover:text-(--text-primary)"
              }`}
            >
              <div className="truncate">{cat.label}</div>
              <div className="text-[9px] font-mono opacity-60 uppercase">
                {cat.moduleName}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* KONTEN KANAN */}
      <div className="flex-1 flex flex-col bg-(--bg-app)">
        {/* HEADER DENGAN INLINE FORM */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-(--border-color) shrink-0 bg-(--bg-header)">
          <h3 className="font-black text-(--text-primary) uppercase tracking-wider text-sm">
            {categories.find((c) => c.id === activeCategory)?.label ||
              "Pilih Kategori"}
          </h3>

          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              placeholder="Ketik nilai baru..."
              className="text-xs font-bold text-(--text-primary) px-3 py-1.5 bg-(--bg-input) border border-(--border-color) rounded-md outline-none focus:border-orange-500 w-56 placeholder:text-slate-400 placeholder:font-normal"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="px-4 py-1.5 text-xs font-black text-white bg-slate-800 rounded-md hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              + TAMBAH
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
          <table className="w-full text-left border-collapse bg-(--bg-card) rounded-lg shadow-sm border border-(--border-color) overflow-hidden">
            <thead>
              <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black tracking-widest text-(--text-secondary)">
                <th className="px-6 py-4">Nilai / Value</th>
                <th className="px-6 py-4 w-32">Status</th>
                <th className="px-6 py-4 text-right w-40">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border-color) text-xs">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-(--surface-hover) transition group"
                >
                  <td className="px-6 py-4 font-bold text-(--text-primary)">
                    {item.value}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black tracking-wide">
                      AKTIF
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setMergeTarget({ id: item.id, value: item.value });
                        setMergeInput("");
                      }}
                      className="p-1.5 text-slate-400 hover:text-amber-500 rounded bg-white shadow-sm border border-slate-200 cursor-pointer"
                      title="Normalisasi Bahasa (Merge)"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleArchive(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded bg-white shadow-sm border border-slate-200 cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="p-10 text-center text-(--text-secondary) font-semibold text-xs"
                  >
                    Kamus data kosong. Ketik di atas lalu tekan Tambah.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OVERLAY CUSTOM MODAL UNTUK MERGE */}
      <AnimatePresence>
        {mergeTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2 text-amber-600">
                  <GitMerge className="w-5 h-5" />
                  <h3 className="font-bold text-sm">
                    Normalisasi (Merge) Kata
                  </h3>
                </div>
                <button
                  onClick={() => setMergeTarget(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={executeMerge} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Kata Asal (Yang Salah / Lama)
                  </label>
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono text-sm font-semibold">
                    {mergeTarget.value}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ubah Menjadi Kata Baru
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={mergeInput}
                    onChange={(e) =>
                      setMergeInput(e.target.value.toUpperCase())
                    }
                    placeholder="Contoh: PERIKLANAN"
                    className="w-full text-sm font-bold text-slate-800 p-3 bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                  />
                  <p className="text-[10px] text-slate-500 mt-2 font-medium">
                    *Tindakan ini akan{" "}
                    <span className="font-bold text-amber-600">
                      secara diam-diam
                    </span>{" "}
                    mengubah semua data transaksi historis yang menggunakan kata
                    lama menjadi kata baru.
                  </p>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMergeTarget(null)}
                    className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    BATAL
                  </button>
                  <button
                    type="submit"
                    disabled={!mergeInput.trim()}
                    className="flex-1 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50 transition-colors cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    MERGE DATA
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
