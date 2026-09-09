// File: modules/mdl_warehouse/src/client/WarehousePageSM.tsx
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Store,
  Plus,
  Trash2,
  RotateCcw,
  Calendar,
  Filter,
  FileSpreadsheet,
  FileDown,
  Layers,
  ChevronDown,
  Clock,
  Package,
} from "lucide-react";
import { useWarehouseStore } from "./store";
import { useItemStore } from "../../../mdl_item/src/client/store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { UniversalCombobox } from "../../../../apps/client_unv/src/shared-ui/UniversalCombobox";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayoutSM";
import { printDistributionReportPdf } from "./features/pdf-warehouse";
import { exportExcelDistribution } from "./features/excel-warehouse";

export function WarehousePageSM() {
  const { distributions } = useWarehouseStore();
  const { products, uoms } = useItemStore();
  const { divisions, outlets } = useOrgStore();
  const { openAlert } = useUniversalModal();

  const localCompanyId = localStorage.getItem("__unv_companyId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";
  const currentOutlet = outlets.find((o) => o.id === localOutletId);
  const outletName = currentOutlet
    ? currentOutlet.name.toUpperCase()
    : "GUDANG OUTLET";

  // State Filter & UI
  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [filterDivisionId, setFilterDivisionId] = useState("");
  const [filterOutletId, setFilterOutletId] = useState(""); // Tambahan filter outlet
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAddFormOpen, setIsAddFormOpen] = useState(true);

  // =========================================================================
  // STICKY MEMORY FORM (TIDAK PERNAH RESET TANGGAL & DIVISI)
  // =========================================================================
  const [stickyDate, setStickyDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [stickyDivisionId, setStickyDivisionId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [inputQty, setInputQty] = useState<number | "">(1);
  const [inputNotes, setInputNotes] = useState("");
  const itemInputRef = useRef<HTMLInputElement>(null);

  // Daftar outlet yang tersedia untuk filter (khusus Region/Holding)
  const availableOutlets = useMemo(() => {
    return outlets.filter((o) => {
      if (o.status !== "Aktif") return false;
      if (localCompanyId && o.companyId && o.companyId !== localCompanyId)
        return false;
      if (localRegionId && o.regionId && o.regionId !== localRegionId)
        return false;
      return true;
    });
  }, [outlets, localCompanyId, localRegionId]);

  const divisionOptions = useMemo(() => {
    return divisions
      .filter((d) => {
        if (d.status !== "Aktif") return false;
        if (localCompanyId && d.companyId && d.companyId !== localCompanyId)
          return false;

        // Cabang Outlet HANYA melihat divisi yang dibuat untuk cabang ini:
        if (localOutletId) {
          return d.outletId === localOutletId || !d.outletId;
        }
        // Region melihat divisi region atau divisi cabang wilayahnya:
        if (localRegionId) {
          return d.regionId === localRegionId || !d.regionId;
        }
        return true;
      })
      .map((d) => ({ value: d.id, label: d.name }));
  }, [divisions, localCompanyId, localOutletId, localRegionId]);

  useEffect(() => {
    if (!stickyDivisionId && divisionOptions.length > 0) {
      setStickyDivisionId(divisionOptions[0].value);
    }
  }, [divisionOptions, stickyDivisionId]);

  const productOptions = useMemo(() => {
    return products
      .filter((p) => p.status === "Aktif" && !p.isExpense)
      .map((p) => ({ value: p.id, label: p.name }));
  }, [products]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedItemId);
  }, [products, selectedItemId]);

  const autoUomName = useMemo(() => {
    if (!selectedProduct) return "PCS";
    return uoms.find((u) => u.id === selectedProduct.uomId)?.name || "PCS";
  }, [selectedProduct, uoms]);

  const autoUnitCost = useMemo(() => {
    if (!selectedProduct || !selectedProduct.pricing) return 0;
    const scopeKey =
      localOutletId || localRegionId || localCompanyId || "DEFAULT";
    const pricing =
      selectedProduct.pricing[scopeKey] ||
      selectedProduct.pricing[Object.keys(selectedProduct.pricing)[0]] ||
      {};
    return pricing.basePrice || 0;
  }, [selectedProduct, localOutletId, localRegionId, localCompanyId]);

  // SUBMIT QUICK-ADD FORM DENGAN STICKY MEMORY
  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stickyDivisionId) {
      return sysToast.error("Error", "Pilih divisi tujuan!");
    }
    if (!selectedItemId) {
      return sysToast.error("Error", "Pilih barang yang diambil!");
    }
    if (Number(inputQty) <= 0) {
      return sysToast.error("Error", "Jumlah Qty harus lebih dari 0!");
    }

    const divisionObj = divisions.find((d) => d.id === stickyDivisionId);
    const divisionName = divisionObj ? divisionObj.name : "KITCHEN";

    try {
      await globalCommandBus.execute({
        type: "CREATE_DISTRIBUTION",
        payload: {
          companyId: localCompanyId,
          regionId: localRegionId,
          outletId: localOutletId,
          date: stickyDate,
          divisionId: stickyDivisionId,
          divisionName,
          itemId: selectedItemId,
          itemName: selectedProduct?.name || "Item",
          uomId: selectedProduct?.uomId || "UOM_PCS",
          uomName: autoUomName,
          qty: Number(inputQty),
          unitCost: autoUnitCost,
          notes: inputNotes.trim() ? inputNotes.toUpperCase().trim() : null,
        },
      });
      sysToast.success(
        "Tercatat",
        `${Number(inputQty)} ${autoUomName} "${selectedProduct?.name}" didistribusikan ke ${divisionName}.`,
      );

      // RESET HANYA ITEM & QTY (TANGGAL & DIVISI TETAP MENETAP DI MEMORI)
      setSelectedItemId("");
      setInputQty(1);
      setInputNotes("");
      // Fokus kembali ke input item untuk entri berikutnya
      setTimeout(() => itemInputRef.current?.focus(), 50);
    } catch (err: any) {
      sysToast.error("Gagal Mencatat", err.message);
    }
  };

  // Filter Ledger Distribusi dengan penyekatan company, region, outlet, status
  const filteredDistributions = useMemo(() => {
    return distributions.filter((d: any) => {
      // 1. Penyekatan Company & Region
      if (localCompanyId && d.companyId && d.companyId !== localCompanyId)
        return false;
      if (localRegionId && d.regionId && d.regionId !== localRegionId)
        return false;

      // 2. Penyekatan Outlet
      if (localOutletId) {
        if (d.outletId && d.outletId !== localOutletId) return false;
      } else if (filterOutletId) {
        if (d.outletId !== filterOutletId) return false;
      }

      // 3. Status Aktif vs Arsip (dukung camelCase dan snake_case)
      const isItemActive = d.isActive !== undefined ? d.isActive : d.is_active;
      const matchStatus =
        viewStatus === "AKTIF"
          ? isItemActive !== false
          : isItemActive === false;

      const matchDivision =
        !filterDivisionId || d.divisionId === filterDivisionId;
      const matchStart = !dateStart || new Date(d.date) >= new Date(dateStart);
      const matchEnd = !dateEnd || new Date(d.date) <= new Date(dateEnd);

      return matchStatus && matchDivision && matchStart && matchEnd;
    });
  }, [
    distributions,
    viewStatus,
    filterDivisionId,
    filterOutletId,
    dateStart,
    dateEnd,
    localOutletId,
    localRegionId,
    localCompanyId,
  ]);

  const totalCostPeriod = useMemo(() => {
    return filteredDistributions.reduce(
      (sum, d) => sum + (d.totalCost || 0),
      0,
    );
  }, [filteredDistributions]);

  const handleAction = async (type: string, id: string) => {
    try {
      await globalCommandBus.execute({ type, payload: { id } });
      sysToast.success("Berhasil", "Data diperbarui.");
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  const confirmArchive = (id: string, name: string) => {
    openAlert({
      title: "Arsipkan Catatan Distribusi",
      message: `Arsipkan mutasi keluar "${name}"?`,
      confirmText: "YA, ARSIPKAN",
      onConfirm: () => handleAction("ARCHIVE_DISTRIBUTION", id),
    });
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {/* HEADER MOBILE */}
      <div className="p-3 bg-(--bg-card) border-b border-(--border-color) shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-sm font-black text-(--text-primary) uppercase tracking-wide">
                Distribusi Divisi
              </h2>
              <span className="text-[10px] text-(--text-secondary) font-bold">
                {outletName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Toggle Form Cepat hanya jika level outlet */}
            {localOutletId && (
              <button
                onClick={() => setIsAddFormOpen(!isAddFormOpen)}
                className={`p-1.5 text-xs font-black rounded-lg border flex items-center gap-1 ${
                  isAddFormOpen
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-(--bg-input) text-(--text-secondary) border-(--border-color)"
                }`}
              >
                <Plus className="w-4 h-4" /> {isAddFormOpen ? "Tutup" : "Catat"}
              </button>
            )}

            {/* Tombol Export */}
            <button
              onClick={() =>
                printDistributionReportPdf(
                  filteredDistributions,
                  dateStart,
                  dateEnd,
                  divisionOptions.find((d) => d.value === filterDivisionId)
                    ?.label || "",
                  outletName,
                )
              }
              className="p-1.5 rounded-lg border border-orange-500/30 text-orange-500 bg-orange-500/10"
              title="Cetak PDF"
            >
              <FileDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => exportExcelDistribution(filteredDistributions)}
              className="p-1.5 rounded-lg border border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
              title="Export Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Total Serapan Biaya Banner */}
        <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-between">
          <span className="text-[10px] font-black uppercase text-(--text-secondary)">
            Total Serapan Biaya:
          </span>
          <span className="font-mono font-black text-rose-500 text-xs">
            Rp {totalCostPeriod.toLocaleString()}
          </span>
        </div>
      </div>

      {/* FORM QUICK-ADD ATAU BANNER MODE MONITORING */}
      {localOutletId ? (
        isAddFormOpen && (
          <form
            onSubmit={handleQuickSubmit}
            className="p-3 bg-(--surface-hover) border-b border-(--border-color) shrink-0 space-y-2.5 animate-in slide-in-from-top-2"
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Tanggal (Sticky)
                </label>
                <input
                  type="date"
                  required
                  value={stickyDate}
                  onChange={(e) => setStickyDate(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Divisi Tujuan (Sticky)
                </label>
                <select
                  value={stickyDivisionId}
                  onChange={(e) => setStickyDivisionId(e.target.value)}
                  required
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
                >
                  {divisionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                Pilih Barang (Stok Fisik)
              </label>
              <UniversalCombobox
                ref={itemInputRef}
                options={productOptions}
                value={selectedItemId}
                onChange={(v) => setSelectedItemId(v)}
                placeholder="Ketik lalu pilih barang..."
                dropdownDirection="bottom"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 items-end">
              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Qty
                </label>
                <input
                  type="number"
                  required
                  min={0.01}
                  step="any"
                  value={inputQty}
                  onChange={(e) =>
                    setInputQty(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none text-center font-mono"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Satuan
                </label>
                <input
                  type="text"
                  disabled
                  value={autoUomName}
                  className="w-full text-xs font-bold p-2 bg-(--surface-hover) text-(--text-secondary) border border-(--border-color) rounded-lg text-center font-mono"
                />
              </div>

              <button
                type="submit"
                className="py-2 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-lg shadow-sm flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Simpan
              </button>
            </div>

            <div>
              <input
                type="text"
                value={inputNotes}
                onChange={(e) => setInputNotes(e.target.value)}
                placeholder="Catatan / keperluan masakan (opsional)..."
                className="w-full text-xs font-bold p-1.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none placeholder:text-[10px]"
              />
            </div>
          </form>
        )
      ) : (
        <div className="p-3 bg-blue-500/10 border-b border-blue-500/20 flex items-center justify-between text-xs font-bold text-blue-600 shrink-0">
          <span>
            Mode Monitoring Wilayah: Menampilkan data mutasi divisi dari seluruh
            cabang di bawah region ini.
          </span>
        </div>
      )}

      {/* FILTER ACCORDION BAR */}
      <div className="px-3 py-2 bg-(--bg-card) border-b border-(--border-color) flex items-center justify-between shrink-0">
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="flex items-center gap-1 text-xs font-bold text-(--text-secondary)"
        >
          <Filter className="w-3.5 h-3.5 text-orange-500" />
          <span>Filter Data</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${isFilterOpen ? "rotate-180" : ""}`}
          />
        </button>

        <div className="flex bg-(--bg-input) rounded-lg border border-(--border-color) p-0.5">
          <button
            onClick={() => setViewStatus("AKTIF")}
            className={`px-2.5 py-0.5 text-[10px] font-black rounded ${
              viewStatus === "AKTIF"
                ? "bg-orange-500 text-white"
                : "text-(--text-secondary)"
            }`}
          >
            AKTIF
          </button>
          <button
            onClick={() => setViewStatus("ARSIP")}
            className={`px-2.5 py-0.5 text-[10px] font-black rounded ${
              viewStatus === "ARSIP"
                ? "bg-slate-700 text-white"
                : "text-(--text-secondary)"
            }`}
          >
            ARSIP
          </button>
        </div>
      </div>

      {isFilterOpen && (
        <div className="p-3 bg-(--surface-hover) border-b border-(--border-color) space-y-2 animate-in fade-in">
          {/* Filter Outlet untuk Region/Holding */}
          {!localOutletId && (
            <select
              value={filterOutletId}
              onChange={(e) => setFilterOutletId(e.target.value)}
              className="w-full text-xs font-bold p-2 bg-(--bg-input) text-orange-500 border border-orange-500/30 rounded-lg outline-none"
            >
              <option value="">-- SEMUA OUTLET CABANG --</option>
              {availableOutlets.map((o) => (
                <option key={o.id} value={o.id}>
                  OUTLET: {o.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={filterDivisionId}
            onChange={(e) => setFilterDivisionId(e.target.value)}
            className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
          >
            <option value="">-- SEMUA DIVISI --</option>
            {divisionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="flex-1 text-xs font-bold p-1.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
            />
            <span className="text-xs text-(--text-secondary)">-</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="flex-1 text-xs font-bold p-1.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
            />
          </div>
        </div>
      )}

      {/* DAFTAR DISTRIBUSI (KARTU MOBILE) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {filteredDistributions.map((doc) => (
          <div
            key={doc.id}
            className="bg-(--bg-card) border border-(--border-color) rounded-xl p-3 shadow-xs space-y-2"
          >
            <div className="flex items-start justify-between">
              <div>
                {/* Menampilkan Outlet Asal jika bukan level outlet */}
                {!localOutletId && (
                  <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mb-1">
                    {outlets.find((o) => o.id === doc.outletId)?.name ||
                      "GUDANG"}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  {doc.divisionName}
                </span>
                <div className="font-bold text-xs text-(--text-primary) mt-1">
                  {doc.itemName}
                </div>
                {doc.notes && (
                  <div className="text-[10px] text-(--text-secondary) italic mt-0.5">
                    "{doc.notes}"
                  </div>
                )}
              </div>

              <span className="text-[10px] font-mono text-(--text-secondary)">
                {new Date(doc.date).toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-(--border-color) text-xs">
              <div>
                <span className="text-[9px] text-(--text-secondary) block">
                  Jumlah Diambil:
                </span>
                <span className="font-mono font-bold text-orange-500 text-xs">
                  {doc.qty} {doc.uomName}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[9px] text-(--text-secondary) block">
                  Serapan HPP:
                </span>
                <span className="font-mono font-black text-rose-500 text-xs">
                  Rp {(doc.totalCost || 0).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-1 ml-2">
                {viewStatus === "AKTIF" ? (
                  <button
                    onClick={() => confirmArchive(doc.id, doc.itemName)}
                    className="p-1.5 text-(--text-secondary) hover:text-rose-500 border border-(--border-color) rounded-lg"
                    title="Arsipkan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction("RESTORE_DISTRIBUTION", doc.id)}
                    className="px-2 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded-lg flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredDistributions.length === 0 && (
          <div className="p-8 text-center text-(--text-secondary) font-bold text-xs italic">
            Belum ada catatan distribusi pada filter ini.
          </div>
        )}
      </div>
    </div>
  );
}
