// File: modules/mdl_plusales/src/client/PlusalesPageSM.tsx
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Wallet,
  Scale,
  Plus,
  Printer,
  FileSpreadsheet,
  FileDown,
  Eye,
  Edit2,
  Trash2,
  RotateCcw,
  Calendar,
  Percent,
  Receipt,
  Layers,
  ChevronDown,
  X,
  Building2,
} from "lucide-react";
import { usePlusalesStore } from "./store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { useExecutivePanelStore } from "../../../mdl_executivepanel/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayoutSM";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { PlusalesFormModalSM } from "./form-plusalesSM";
import {
  printModReportPdf,
  printMonthlyRevenuePdf,
} from "./features/pdf-plusales";
import { exportExcelPlusales } from "./features/excel-plusales";

// =========================================================================
// 1. MODAL DETAIL TIMBANGAN (MOBILE)
// =========================================================================
const PlusalesDetailModalSM: React.FC<{
  doc: any;
  onClose: () => void;
}> = ({ doc, onClose }) => {
  const isBalanced = (doc.balanceDifference || 0) === 0;

  return (
    <div className="p-4 space-y-3 max-w-md bg-(--bg-card) text-(--text-primary)">
      {/* Header Info */}
      <div className="p-3 bg-(--surface-hover) rounded-xl border border-(--border-color) space-y-1">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[9px] text-(--text-secondary) uppercase font-black block">
              Tanggal Rekonsiliasi:
            </span>
            <span className="text-xs font-bold text-(--text-primary)">
              {new Date(doc.date).toLocaleDateString("id-ID", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <span className="text-[9px] font-mono text-(--text-secondary)">
            {doc.documentNumber}
          </span>
        </div>

        <div className="pt-2 border-t border-(--border-color) flex justify-between items-center">
          <span className="text-[10px] text-(--text-secondary) uppercase font-bold">
            Gross Sales:
          </span>
          <span className="font-mono font-black text-orange-500 text-sm">
            Rp {(doc.grossSales || 0).toLocaleString()}
          </span>
        </div>
        <div className="text-[10px] text-(--text-secondary) flex justify-between">
          <span>Net: Rp {(doc.netSales || 0).toLocaleString()}</span>
          <span>Diskon: Rp {(doc.discount || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Rincian Realisasi */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-black text-(--text-secondary) uppercase tracking-wider flex items-center gap-1">
          <Receipt className="w-3.5 h-3.5 text-emerald-500" /> Rincian Realisasi
          Kas & Non-Tunai:
        </span>

        {/* Dynamic Items */}
        {(doc.dynamicItems || []).map((it: any, i: number) => (
          <div
            key={i}
            className="flex justify-between items-center text-xs p-2 bg-(--bg-input) rounded-lg border border-(--border-color)"
          >
            <div className="flex items-center gap-1.5 truncate">
              <span
                className={`text-[8px] font-black px-1 py-0.2 rounded uppercase ${
                  it.category === "DEDUCTION"
                    ? "bg-rose-500/10 text-rose-500"
                    : "bg-emerald-500/10 text-emerald-500"
                }`}
              >
                {it.category === "DEDUCTION" ? "[-] POT" : "[+] EDC"}
              </span>
              <span className="font-bold text-(--text-primary) truncate">
                {it.name}
              </span>
            </div>
            <span
              className={`font-mono font-black ${
                it.category === "DEDUCTION"
                  ? "text-rose-500"
                  : "text-emerald-500"
              }`}
            >
              {it.category === "DEDUCTION" ? "-" : ""} Rp{" "}
              {(it.amount || 0).toLocaleString()}
            </span>
          </div>
        ))}

        {/* Kas Kecil Kasir */}
        <div className="flex justify-between items-center text-xs p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-500 font-bold">
          <span>Kas Kecil (Pettycash):</span>
          <span className="font-mono font-black">
            + Rp {(doc.totalPettycash || 0).toLocaleString()}
          </span>
        </div>

        {/* Cash on Hand */}
        <div className="flex justify-between items-center text-xs p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 font-bold">
          <span>Uang Fisik Kasir (Laci):</span>
          <span className="font-mono font-black">
            Rp {(doc.cashOnHand || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Status Timbangan */}
      <div className="p-3 bg-(--surface-hover) rounded-xl border border-(--border-color) flex items-center justify-between">
        <div>
          <span className="text-[9px] font-black uppercase text-(--text-secondary) block">
            Status Timbangan:
          </span>
          <span className="text-xs font-black uppercase tracking-wider text-(--text-primary)">
            {isBalanced
              ? "SEIMBANG (BALANCE)"
              : doc.balanceDifference < 0
                ? "KAS KURANG (SHORTAGE)"
                : "KAS LEBIH (OVERAGE)"}
          </span>
        </div>
        <div
          className={`text-sm font-mono font-black ${
            isBalanced ? "text-emerald-500" : "text-rose-500"
          }`}
        >
          Selisih: Rp {(doc.balanceDifference || 0).toLocaleString()}
        </div>
      </div>

      {doc.discrepancyNote && (
        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-500">
          <strong className="font-black uppercase text-[10px] block">
            Alasan Selisih:
          </strong>
          <span>"{doc.discrepancyNote}"</span>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-(--border-color)">
        <button
          onClick={onClose}
          className="w-full py-2 bg-(--surface-hover) text-xs font-bold rounded-lg"
        >
          TUTUP
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// 2. HALAMAN UTAMA MOBILE: PLUSALES PAGE SM
// =========================================================================
export function PlusalesPageSM() {
  const { documents } = usePlusalesStore();
  const { allocations } = useExecutivePanelStore();
  const { outlets, regions } = useOrgStore();
  const { openCenterModal, closeCenterModal, openAlert } = useUniversalModal();

  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  const localCompanyId = localStorage.getItem("__unv_companyId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";
  const [filterOutletId, setFilterOutletId] = useState("");

  const currentOutlet = outlets.find(
    (o) => o.id === (localOutletId || filterOutletId),
  );
  const currentRegion = regions.find((r) => r.id === localRegionId);
  const outletName = currentOutlet
    ? currentOutlet.name.toUpperCase()
    : currentRegion
      ? `WILAYAH: ${currentRegion.name.toUpperCase()}`
      : "SEMUA OUTLET";

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter Dokumen
  const filteredDocs = useMemo(() => {
    return documents.filter((d: any) => {
      if (localCompanyId && d.companyId && d.companyId !== localCompanyId)
        return false;
      if (localRegionId && d.regionId && d.regionId !== localRegionId)
        return false;

      if (localOutletId) {
        if (d.outletId && d.outletId !== localOutletId) return false;
      } else if (filterOutletId) {
        if (d.outletId !== filterOutletId) return false;
      }

      const isItemActive = d.isActive !== undefined ? d.isActive : d.is_active;
      const matchMonth = d.date && d.date.startsWith(selectedMonth);
      const matchStatus =
        viewStatus === "AKTIF"
          ? isItemActive !== false
          : isItemActive === false;
      return matchMonth && matchStatus;
    });
  }, [
    documents,
    selectedMonth,
    viewStatus,
    localOutletId,
    localRegionId,
    localCompanyId,
    filterOutletId,
  ]);

  // Akumulasi Statistik
  const monthlyStats = useMemo(() => {
    const totalGross = filteredDocs.reduce(
      (sum, d) => sum + (d.grossSales || 0),
      0,
    );
    const totalNet = filteredDocs.reduce(
      (sum, d) => sum + (d.netSales || 0),
      0,
    );
    const totalCash = filteredDocs.reduce(
      (sum, d) => sum + (d.cashOnHand || 0),
      0,
    );
    const totalEDC = filteredDocs.reduce(
      (sum, d) => sum + (d.totalSettlement || 0),
      0,
    );
    return { totalGross, totalNet, totalCash, totalEDC };
  }, [filteredDocs]);

  const currentMonthAllocations = useMemo(() => {
    return allocations.filter((a) => a.month === selectedMonth);
  }, [allocations, selectedMonth]);

  const handleAction = async (type: string, id: string) => {
    try {
      await globalCommandBus.execute({ type, payload: { id } });
      sysToast.success("Berhasil", "Data berhasil diperbarui.");
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  const confirmArchive = (id: string, docNum: string) => {
    openAlert({
      title: "Arsipkan Rekap Penjualan",
      message: `Arsipkan dokumen rekap "${docNum}"?`,
      confirmText: "YA, ARSIPKAN",
      onConfirm: () => handleAction("ARCHIVE_PLUSALES", id),
    });
  };

  const monthOptions = useMemo(() => {
    const opts = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const value = `${year}-${month}`;
      const label = d.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
      opts.push({ value, label });
      d.setMonth(d.getMonth() - 1);
    }
    return opts;
  }, []);

  const currentMonthLabel =
    monthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {/* MODAL FORM REKAP */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-(--bg-card) w-full max-w-lg h-[90vh] rounded-2xl shadow-2xl border border-(--border-color) overflow-hidden flex flex-col">
            <PlusalesFormModalSM
              isEditMode={Boolean(editFormData)}
              initialData={editFormData}
              onClose={() => {
                setIsFormModalOpen(false);
                setEditFormData(null);
              }}
            />
          </div>
        </div>
      )}

      {/* HEADER UTAMA MOBILE */}
      <div className="p-3 bg-(--bg-card) border-b border-(--border-color) shrink-0 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-sm font-black text-(--text-primary) uppercase tracking-wide">
                Rekap Penjualan POS
              </h2>
              <span className="text-[10px] text-(--text-secondary) font-bold">
                {outletName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Export Menu */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="p-2 rounded-lg border border-(--border-color) flex items-center gap-1 text-(--text-secondary) hover:text-(--text-primary)"
              >
                <Layers className="w-4 h-4 text-orange-500" />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-(--bg-card) rounded-xl shadow-2xl border border-(--border-color) py-2 z-50 animate-in fade-in">
                  <button
                    onClick={() => {
                      printMonthlyRevenuePdf(
                        filteredDocs,
                        currentMonthLabel,
                        outletName,
                        currentMonthAllocations,
                      );
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-(--surface-hover) flex items-center gap-2 text-orange-500"
                  >
                    <FileDown className="w-4 h-4" /> Cetak PDF Rekap Bulan Ini
                  </button>
                  <div className="h-px bg-(--border-color) my-1" />
                  <button
                    onClick={() => {
                      exportExcelPlusales(filteredDocs);
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-(--surface-hover) flex items-center gap-2 text-emerald-500"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Export ke Excel
                  </button>
                </div>
              )}
            </div>

            {/* Tombol Buat Rekap Baru hanya muncul di level Outlet */}
            {viewStatus === "AKTIF" && localOutletId && (
              <button
                onClick={() => {
                  setEditFormData(null);
                  setIsFormModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm"
              >
                <Plus className="w-4 h-4" /> Input
              </button>
            )}
          </div>
        </div>

        {/* 4 KARTU STATISTIK RINGKAS (2x2 GRID) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 bg-orange-500/10 rounded-xl border border-orange-500/20">
            <span className="text-[8px] font-black uppercase text-orange-500 block">
              Total Net Sales
            </span>
            <span className="text-xs font-black font-mono text-orange-500 block mt-0.5">
              Rp {monthlyStats.totalNet.toLocaleString()}
            </span>
          </div>
          <div className="p-2.5 bg-(--bg-input) rounded-xl border border-(--border-color)">
            <span className="text-[8px] font-black uppercase text-(--text-secondary) block">
              Total Gross Sales
            </span>
            <span className="text-xs font-black font-mono text-(--text-primary) block mt-0.5">
              Rp {monthlyStats.totalGross.toLocaleString()}
            </span>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <span className="text-[8px] font-black uppercase text-emerald-500 block">
              Cash on Hand (Laci)
            </span>
            <span className="text-xs font-black font-mono text-emerald-500 block mt-0.5">
              Rp {monthlyStats.totalCash.toLocaleString()}
            </span>
          </div>
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <span className="text-[8px] font-black uppercase text-blue-500 block">
              Total EDC / QR
            </span>
            <span className="text-xs font-black font-mono text-blue-500 block mt-0.5">
              Rp {monthlyStats.totalEDC.toLocaleString()}
            </span>
          </div>
        </div>

        {/* BARIS FILTER BULAN & STATUS */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 bg-(--bg-input) border border-(--border-color) rounded-lg px-2 py-1 flex-1">
            <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-black text-(--text-primary) outline-none w-full cursor-pointer"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* SELECTOR OUTLET UNTUK REGION */}
          {!localOutletId && (
            <div className="flex items-center gap-1.5 bg-(--bg-input) border border-orange-500/30 rounded-lg px-2 py-1 flex-1">
              <Building2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <select
                value={filterOutletId}
                onChange={(e) => setFilterOutletId(e.target.value)}
                className="bg-transparent text-xs font-black text-orange-500 outline-none w-full cursor-pointer"
              >
                <option value="">SEMUA OUTLET</option>
                {availableOutlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex bg-(--bg-input) rounded-lg border border-(--border-color) p-0.5 shrink-0">
            <button
              onClick={() => setViewStatus("AKTIF")}
              className={`px-2.5 py-1 text-[10px] font-black rounded ${
                viewStatus === "AKTIF"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-(--text-secondary)"
              }`}
            >
              AKTIF
            </button>
            <button
              onClick={() => setViewStatus("ARSIP")}
              className={`px-2.5 py-1 text-[10px] font-black rounded ${
                viewStatus === "ARSIP"
                  ? "bg-slate-700 text-white shadow-xs"
                  : "text-(--text-secondary)"
              }`}
            >
              ARSIP
            </button>
          </div>
        </div>
      </div>

      {/* DAFTAR REKAPAN HARIAN (CARD LIST MOBILE) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {filteredDocs.map((doc) => {
          const diff = doc.balanceDifference || 0;
          return (
            <div
              key={doc.id}
              className="bg-(--bg-card) border border-(--border-color) rounded-xl p-3 shadow-xs space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-xs text-(--text-primary)">
                    {new Date(doc.date).toLocaleDateString("id-ID", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  {!localOutletId && (
                    <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {outlets.find((o) => o.id === doc.outletId)?.name ||
                        "OUTLET"}
                    </span>
                  )}
                  <div className="text-[9px] font-mono text-(--text-secondary) mt-0.5">
                    {doc.documentNumber}
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 text-[8px] font-black rounded uppercase border ${
                    diff === 0
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                  }`}
                >
                  {diff === 0
                    ? "BALANCE"
                    : `SELISIH (${diff > 0 ? "+" : ""}${diff.toLocaleString()})`}
                </span>
              </div>

              {/* Rincian Angka Card */}
              <div className="grid grid-cols-3 gap-2 py-1 border-t border-(--border-color) text-xs">
                <div>
                  <span className="text-[9px] text-(--text-secondary) block">
                    Gross
                  </span>
                  <span className="font-mono font-black text-orange-500 text-[11px]">
                    Rp {(doc.grossSales || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-(--text-secondary) block">
                    Net Sales
                  </span>
                  <span className="font-mono font-bold text-(--text-primary) text-[11px]">
                    Rp {(doc.netSales || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-(--text-secondary) block">
                    Laci Kasir
                  </span>
                  <span className="font-mono font-bold text-emerald-500 text-[11px]">
                    Rp {(doc.cashOnHand || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Tombol Aksi */}
              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-(--border-color)">
                <button
                  onClick={() =>
                    openCenterModal({
                      title: `DETAIL TIMBANGAN: ${doc.documentNumber}`,
                      content: (
                        <PlusalesDetailModalSM
                          doc={doc}
                          onClose={closeCenterModal}
                        />
                      ),
                    })
                  }
                  className="p-1.5 text-(--text-secondary) hover:text-blue-500 border border-(--border-color) rounded-lg"
                  title="Lihat Detail"
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  onClick={() => printModReportPdf(doc, outletName)}
                  className="p-1.5 text-(--text-secondary) hover:text-indigo-500 border border-(--border-color) rounded-lg"
                  title="Cetak MOD (PDF)"
                >
                  <Printer className="w-4 h-4" />
                </button>

                {viewStatus === "AKTIF" ? (
                  <>
                    <button
                      onClick={() => {
                        setEditFormData(doc);
                        setIsFormModalOpen(true);
                      }}
                      className="p-1.5 text-(--text-secondary) hover:text-orange-500 border border-(--border-color) rounded-lg"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => confirmArchive(doc.id, doc.documentNumber)}
                      className="p-1.5 text-(--text-secondary) hover:text-rose-500 border border-(--border-color) rounded-lg"
                      title="Arsipkan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleAction("RESTORE_PLUSALES", doc.id)}
                    className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded-lg flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredDocs.length === 0 && (
          <div className="p-8 text-center text-(--text-secondary) font-bold text-xs italic">
            Belum ada rekapitulasi penjualan untuk {currentMonthLabel}.
          </div>
        )}
      </div>
    </div>
  );
}
