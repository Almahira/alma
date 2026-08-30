// File: modules/mdl_warehouse/src/client/WarehousePage.tsx
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Store,
  Plus,
  Trash2,
  RotateCcw,
  Edit2,
  Calendar,
  Filter,
  FileSpreadsheet,
  FileDown,
  Building2,
  Package,
  Layers,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useWarehouseStore } from "./store";
import { useItemStore } from "../../../mdl_item/src/client/store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { UniversalCombobox } from "../../../../apps/client_unv/src/shared-ui/UniversalCombobox";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayout";

import { printDistributionReportPdf } from "./features/pdf-warehouse";
import { exportExcelDistribution } from "./features/excel-warehouse";

export function WarehousePage() {
  const { distributions } = useWarehouseStore();
  const { products, uoms } = useItemStore();
  const { divisions, outlets } = useOrgStore();
  const { openAlert, openSideOver, closeSideOver } = useUniversalModal();

  const localCompanyId = localStorage.getItem("__unv_companyId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";
  const currentOutlet = outlets.find((o) => o.id === localOutletId);
  const outletName = currentOutlet
    ? currentOutlet.name.toUpperCase()
    : "GUDANG OUTLET";

  // State Filter
  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [filterDivisionId, setFilterDivisionId] = useState("");

  // =========================================================================
  // STICKY MEMORY FORM STATE (TIDAK PERNAH RESET TANGGAL & DIVISI)
  // =========================================================================
  const [stickyDate, setStickyDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [stickyDivisionId, setStickyDivisionId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [inputQty, setInputQty] = useState<number | "">(1);
  const [inputNotes, setInputNotes] = useState("");

  const itemInputRef = useRef<HTMLInputElement>(null);

  // Filter Divisi Aktif untuk Perusahaan Ini
  const divisionOptions = useMemo(() => {
    return divisions
      .filter(
        (d) =>
          d.status === "Aktif" &&
          (!localCompanyId || d.companyId === localCompanyId),
      )
      .map((d) => ({ value: d.id, label: d.name }));
  }, [divisions, localCompanyId]);

  // Set default divisi jika belum terpilih
  useEffect(() => {
    if (!stickyDivisionId && divisionOptions.length > 0) {
      setStickyDivisionId(divisionOptions[0].value);
    }
  }, [divisionOptions, stickyDivisionId]);

  // Filter Hanya Produk Barang Fisik (Bukan Jasa/Biaya)
  const productOptions = useMemo(() => {
    return products
      .filter((p) => p.status === "Aktif" && !p.isExpense)
      .map((p) => ({ value: p.id, label: p.name }));
  }, [products]);

  // Otomasi UOM & HPP saat Item Dipilih
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

      // ---> RESET HANYA ITEM & QTY (TANGGAL & DIVISI TETAP TERSIMPAN) <---
      setSelectedItemId("");
      setInputQty(1);
      setInputNotes("");

      // Fokus kembali ke input item untuk entri berikutnya
      setTimeout(() => itemInputRef.current?.focus(), 50);
    } catch (err: any) {
      sysToast.error("Gagal Mencatat", err.message);
    }
  };

  // Filter Ledger Distribusi
  const filteredDistributions = useMemo(() => {
    return distributions.filter((d) => {
      const matchStatus =
        viewStatus === "AKTIF" ? d.isActive !== false : d.isActive === false;
      const matchDivision =
        !filterDivisionId || d.divisionId === filterDivisionId;
      const matchStart = !dateStart || new Date(d.date) >= new Date(dateStart);
      const matchEnd = !dateEnd || new Date(d.date) <= new Date(dateEnd);
      return matchStatus && matchDivision && matchStart && matchEnd;
    });
  }, [distributions, viewStatus, filterDivisionId, dateStart, dateEnd]);

  // Statistik Total Biaya Serapan
  const totalCostPeriod = useMemo(() => {
    return filteredDistributions.reduce(
      (sum, d) => sum + (d.totalCost || 0),
      0,
    );
  }, [filteredDistributions]);

  const totalQtyPeriod = useMemo(() => {
    return filteredDistributions.reduce((sum, d) => sum + (d.qty || 0), 0);
  }, [filteredDistributions]);

  const handleAction = async (type: string, id: string) => {
    try {
      await globalCommandBus.execute({ type, payload: { id } });
      sysToast.success("Berhasil", "Data berhasil diperbarui.");
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
      {/* ========================================================================= */}
      {/* 1. HEADER & FORM QUICK-ADD STICKY MEMORY (ZERO RESET) */}
      {/* ========================================================================= */}
      <div className="p-5 bg-(--surface-hover) border-b border-(--border-color) shrink-0 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-(--text-primary) tracking-tight flex items-center gap-2">
            <Store className="w-5 h-5 text-orange-500" /> Distribusi Barang
            (Outlet &gt; Divisi)
          </h2>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20">
            {outletName}
          </span>
        </div>

        {/* FORM QUICK-ADD BERBARIS CEPAT */}
        <form
          onSubmit={handleQuickSubmit}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
        >
          {/* TANGGAL (STICKY) */}
          <div className="sm:col-span-2">
            <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-1">
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

          {/* DIVISI PENERIMA (STICKY) */}
          <div className="sm:col-span-2">
            <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-1">
              Divisi (Sticky)
            </label>
            <select
              value={stickyDivisionId}
              onChange={(e) => setStickyDivisionId(e.target.value)}
              required
              className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
            >
              {divisionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* DROPDOWN BARANG */}
          <div className="sm:col-span-4">
            <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-1">
              Pilih Barang (Stok Fisik)
            </label>
            <UniversalCombobox
              ref={itemInputRef}
              options={productOptions}
              value={selectedItemId}
              onChange={(v) => setSelectedItemId(v)}
              placeholder="Ketik lalu pilih barang..."
            />
          </div>

          {/* QTY & UOM OTOMATIS */}
          <div className="sm:col-span-2 flex gap-1">
            <div className="w-16">
              <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-1">
                Qty
              </label>
              <input
                type="number"
                required
                min={1}
                value={inputQty}
                onChange={(e) =>
                  setInputQty(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none text-center font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-1">
                UOM
              </label>
              <input
                type="text"
                disabled
                value={autoUomName}
                className="w-full text-xs font-bold p-2 bg-(--surface-hover) text-(--text-secondary) border border-(--border-color) rounded-lg outline-none text-center font-mono"
              />
            </div>
          </div>

          {/* TOMBOL SIMPAN CEPAT */}
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-lg transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> CATAT MUTASI
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 2. FILTER BAR: TANGGAL DARI-SAMPAI | DIVISI | EXPORT */}
      {/* ========================================================================= */}
      <div className="px-6 py-3 bg-(--bg-card) border-b border-(--border-color) flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-(--text-secondary)" />

          {/* RENTANG TANGGAL DARI - SAMPAI */}
          <div className="flex items-center gap-2 bg-(--bg-input) border border-(--border-color) rounded-xl px-3 py-1.5 shadow-xs">
            <Calendar className="w-4 h-4 text-orange-500" />
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="bg-transparent text-xs font-bold text-(--text-primary) outline-none"
              title="Tanggal Mulai"
            />
            <span className="text-(--text-secondary) font-bold">-</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="bg-transparent text-xs font-bold text-(--text-primary) outline-none"
              title="Tanggal Selesai"
            />
          </div>

          {/* FILTER DIVISI */}
          <select
            value={filterDivisionId}
            onChange={(e) => setFilterDivisionId(e.target.value)}
            className="text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-xl outline-none"
          >
            <option value="">-- SEMUA DIVISI --</option>
            {divisionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* TAB AKTIF / ARSIP */}
          <div className="flex items-center bg-(--bg-input) p-1 rounded-xl border border-(--border-color)">
            <button
              onClick={() => setViewStatus("AKTIF")}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition cursor-pointer ${
                viewStatus === "AKTIF"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              DATA AKTIF
            </button>
            <button
              onClick={() => setViewStatus("ARSIP")}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition cursor-pointer ${
                viewStatus === "ARSIP"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              ARSIP
            </button>
          </div>
        </div>

        {/* TOMBOL EXPORT PDF & EXCEL */}
        <div className="flex items-center gap-2">
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
            className="px-3.5 py-2 text-xs font-black text-orange-600 bg-orange-500/10 border border-orange-500/20 rounded-xl hover:bg-orange-500/20 transition cursor-pointer flex items-center gap-1.5"
          >
            <FileDown className="w-4 h-4" /> EXPORT PDF
          </button>
          <button
            onClick={() => exportExcelDistribution(filteredDistributions)}
            className="px-3.5 py-2 text-xs font-black text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition cursor-pointer flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" /> EXPORT EXCEL
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TABEL LEDGER MUTASI DISTRIBUSI */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
        <div className="bg-(--bg-card) border border-(--border-color) rounded-2xl shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black text-(--text-secondary) tracking-wider">
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Divisi Tujuan</th>
                <th className="px-4 py-3">Nama Barang</th>
                <th className="px-4 py-3 text-center">Jumlah (Qty)</th>
                <th className="px-4 py-3 text-right">HPP Beli</th>
                <th className="px-4 py-3 text-right text-rose-500">
                  Serapan Biaya P&amp;L
                </th>
                <th className="px-4 py-3 text-right w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border-color) text-xs font-semibold text-(--text-primary)">
              {filteredDistributions.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-(--surface-hover) transition"
                >
                  <td className="px-4 py-3 font-mono">
                    {new Date(doc.date).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>

                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      {doc.divisionName}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-bold text-(--text-primary)">
                      {doc.itemName}
                    </div>
                    {doc.notes && (
                      <div className="text-[10px] text-(--text-secondary) italic mt-0.5">
                        "{doc.notes}"
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center font-mono font-bold text-orange-500">
                    {doc.qty}{" "}
                    <span className="text-[10px] text-(--text-secondary)">
                      {doc.uomName}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right font-mono text-(--text-secondary)">
                    Rp {(doc.unitCost || 0).toLocaleString()}
                  </td>

                  <td className="px-4 py-3 text-right font-mono font-black text-rose-500">
                    Rp {(doc.totalCost || 0).toLocaleString()}
                  </td>

                  <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                    {viewStatus === "AKTIF" ? (
                      <button
                        onClick={() => confirmArchive(doc.id, doc.itemName)}
                        className="p-1.5 text-(--text-secondary) hover:text-rose-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                        title="Arsipkan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          handleAction("RESTORE_DISTRIBUTION", doc.id)
                        }
                        className="px-2 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> RESTORE
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {filteredDistributions.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-12 text-center text-(--text-secondary) font-bold text-xs italic"
                  >
                    Belum ada riwayat distribusi barang ke divisi pada filter
                    ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* FOOTER TOTAL SERAPAN BIAYA */}
          {filteredDistributions.length > 0 && (
            <div className="p-4 bg-(--surface-hover) border-t border-(--border-color) flex items-center justify-between font-black text-xs">
              <span className="text-(--text-secondary) uppercase tracking-wider">
                TOTAL SERAPAN BIAYA DIVISI (PERIODE INI):
              </span>
              <span className="font-mono text-base text-rose-500">
                Rp {totalCostPeriod.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
