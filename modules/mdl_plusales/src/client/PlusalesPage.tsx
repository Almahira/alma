// File: modules/mdl_plusales/src/client/PlusalesPage.tsx
import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { usePlusalesStore } from "./store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { useExecutivePanelStore } from "../../../mdl_executivepanel/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayout";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";

import { PlusalesFormModal } from "./form-plusales";
import {
  printModReportPdf,
  printMonthlyRevenuePdf,
} from "./features/pdf-plusales";
import { exportExcelPlusales } from "./features/excel-plusales";

// =========================================================================
// 1. KOMPONEN MODAL VIEW DETAIL TIMBANGAN
// =========================================================================
const PlusalesDetailModal: React.FC<{
  doc: any;
  onClose: () => void;
}> = ({ doc, onClose }) => {
  const isBalanced = (doc.balanceDifference || 0) === 0;

  return (
    <div className="p-6 space-y-4 max-w-2xl bg-(--bg-card) text-(--text-primary)">
      {/* HEADER RINGKASAN OMSET & TANGGAL */}
      <div className="grid grid-cols-2 gap-4 bg-(--surface-hover) p-4 rounded-xl text-xs font-bold border border-(--border-color)">
        <div>
          <span className="text-[10px] text-(--text-secondary) uppercase font-black block">
            TANGGAL REKONSILIASI:
          </span>
          <span className="text-(--text-primary) text-sm font-bold block mt-0.5">
            {new Date(doc.date).toLocaleDateString("id-ID", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </span>
          <span className="text-[10px] font-mono text-(--text-secondary) block mt-1">
            {doc.documentNumber}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-(--text-secondary) uppercase font-black block">
            GROSS SALES (TAGIHAN):
          </span>
          <span className="text-orange-500 font-mono font-black text-sm block mt-0.5">
            Rp {(doc.grossSales || 0).toLocaleString()}
          </span>
          <span className="text-[10px] text-(--text-secondary) font-semibold block mt-1">
            Net: Rp {(doc.netSales || 0).toLocaleString()} | Diskon: Rp{" "}
            {(doc.discount || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* RINCIAN REALISASI PEMBAYARAN */}
      <div className="space-y-2">
        <div className="text-[11px] font-black text-(--text-secondary) uppercase tracking-wider flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5 text-emerald-500" /> RINCIAN REALISASI
          PEMBAYARAN &amp; KAS:
        </div>

        {/* Dynamic Items (Non-Tunai / Compliment) */}
        {(doc.dynamicItems || []).map((it: any, i: number) => (
          <div
            key={i}
            className="flex justify-between items-center text-xs p-2.5 bg-(--bg-input) rounded-lg border border-(--border-color)"
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                  it.category === "DEDUCTION"
                    ? "bg-rose-500/10 text-rose-500"
                    : "bg-emerald-500/10 text-emerald-500"
                }`}
              >
                {it.category === "DEDUCTION" ? "PENGURANG" : "NON-TUNAI"}
              </span>
              <span className="font-bold text-(--text-primary)">{it.name}</span>
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

        {/* Pettycash Kasir Keluar */}
        <div className="flex justify-between items-center text-xs p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-500 font-bold">
          <span>PENGELUARAN KAS KASIR (PETTYCASH)</span>
          <span className="font-mono font-black">
            + Rp {(doc.totalPettycash || 0).toLocaleString()}
          </span>
        </div>

        {/* Cash on Hand */}
        <div className="flex justify-between items-center text-xs p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 font-bold">
          <span>UANG FISIK KASIR (CASH ON HAND)</span>
          <span className="font-mono font-black">
            Rp {(doc.cashOnHand || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* STATUS KESEIMBANGAN TIMBANGAN */}
      <div className="p-3.5 bg-(--surface-hover) rounded-xl border border-(--border-color) flex items-center justify-between">
        <div>
          <span className="text-[10px] font-black uppercase text-(--text-secondary) block">
            STATUS TIMBANGAN:
          </span>
          <span className="text-xs font-black uppercase tracking-wider text-(--text-primary) block mt-0.5">
            {isBalanced
              ? "SEIMBANG (BALANCE)"
              : doc.balanceDifference < 0
                ? "KAS KURANG (SHORTAGE)"
                : "KAS LEBIH (OVERAGE)"}
          </span>
        </div>
        <div
          className={`text-base font-mono font-black ${
            isBalanced ? "text-emerald-500" : "text-rose-500"
          }`}
        >
          Selisih: Rp {(doc.balanceDifference || 0).toLocaleString()}
        </div>
      </div>

      {/* Catatan Selisih */}
      {doc.discrepancyNote && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-500 font-medium">
          <strong className="font-black uppercase">Catatan Selisih:</strong> "
          {doc.discrepancyNote}"
        </div>
      )}

      {/* Footer Tombol */}
      <div className="flex justify-end pt-3 border-t border-(--border-color)">
        <button
          onClick={onClose}
          className="px-5 py-2 bg-(--surface-hover) hover:bg-(--border-color) text-(--text-primary) text-xs font-bold rounded-lg transition cursor-pointer"
        >
          TUTUP
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// 2. HALAMAN UTAMA: PLUSALES PAGE
// =========================================================================
export function PlusalesPage() {
  const { documents } = usePlusalesStore();
  const { allocations } = useExecutivePanelStore(); // <-- MEMBACA ALOKASI RESMI DARI EXECUTIVE PANEL
  const { outlets } = useOrgStore();
  const { openCenterModal, closeCenterModal, openAlert } = useUniversalModal();

  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");

  // State Form Inline Budgeting
  const [budgetInputName, setBudgetInputName] = useState("");
  const [budgetInputPct, setBudgetInputPct] = useState<number | "">("");

  // Filter Bulan (Default: Bulan Berjalan YYYY-MM)
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  const localCompanyId = localStorage.getItem("__unv_companyId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";
  const currentOutlet = outlets.find((o) => o.id === localOutletId);
  const outletName = currentOutlet
    ? currentOutlet.name.toUpperCase()
    : "SEMUA OUTLET";

  // Filter Dokumen Berdasarkan Bulan & Status
  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      // ---> PENYEKATAN OUTLET MUTLAK <---
      if (localOutletId && d.outletId && d.outletId !== localOutletId) {
        return false;
      }
      if (localCompanyId && d.companyId && d.companyId !== localCompanyId) {
        return false;
      }

      const matchMonth = d.date && d.date.startsWith(selectedMonth);
      const matchStatus =
        viewStatus === "AKTIF" ? d.isActive !== false : d.isActive === false;
      return matchMonth && matchStatus;
    });
  }, [documents, selectedMonth, viewStatus, localOutletId, localCompanyId]);

  // Akumulasi Statistik Bulan Terpilih
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

  // Filter Alokasi Cadangan Resmi Bulan Ini
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

  // Simpan Alokasi via Event Sourcing CQRS (Bebas localStorage)
  const handleSaveBudgetInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetInputName.trim() || Number(budgetInputPct) <= 0) {
      return sysToast.error(
        "Error",
        "Nama alokasi dan persentase harus diisi!",
      );
    }

    try {
      await globalCommandBus.execute({
        type: "SET_EXECUTIVE_ALLOCATION",
        payload: {
          companyId: localCompanyId,
          outletId: localOutletId || null,
          month: selectedMonth,
          name: budgetInputName.toUpperCase().trim(),
          percentage: Number(budgetInputPct),
          nominal: Math.round(
            monthlyStats.totalNet * (Number(budgetInputPct) / 100),
          ),
        },
      });

      sysToast.success(
        "Alokasi Disimpan",
        `Alokasi ${budgetInputName.toUpperCase()} (${budgetInputPct}%) berhasil dicatat di Ledger.`,
      );
      setBudgetInputName("");
      setBudgetInputPct("");
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
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
      {/* ========================================================================= */}
      {/* HEADER 2 PANEL */}
      {/* ========================================================================= */}
      <div className="p-6 bg-(--surface-hover) border-b border-(--border-color) shrink-0 grid grid-cols-1 lg:grid-cols-12 gap-6 shadow-xs">
        {/* PANEL KIRI: REVENUE SALES */}
        <div className="lg:col-span-7 bg-(--bg-card) p-5 rounded-2xl border border-(--border-color) shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-(--border-color) pb-3">
            <div>
              <h2 className="text-base font-black text-(--text-primary) tracking-tight flex items-center gap-2">
                <Wallet className="w-5 h-5 text-orange-500" /> REVENUE SALES
                &amp; KAS
              </h2>
              <p className="text-[11px] text-(--text-secondary) font-bold mt-0.5">
                {outletName} • Periode: {currentMonthLabel}
              </p>
            </div>
            <button
              onClick={() =>
                printMonthlyRevenuePdf(
                  filteredDocs,
                  currentMonthLabel,
                  outletName,
                  currentMonthAllocations,
                )
              }
              className="px-3.5 py-1.5 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileDown className="w-4 h-4" /> EXPORT PDF REKAP
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <div className="p-3 bg-(--bg-input) rounded-xl border border-(--border-color)">
              <span className="text-[9px] font-black uppercase text-(--text-secondary) block">
                TOTAL GROSS SALES
              </span>
              <span className="text-xs font-black font-mono text-(--text-primary) block mt-1">
                Rp {monthlyStats.totalGross.toLocaleString()}
              </span>
            </div>

            <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
              <span className="text-[9px] font-black uppercase text-orange-500 block">
                TOTAL NET SALES
              </span>
              <span className="text-xs font-black font-mono text-orange-500 block mt-1">
                Rp {monthlyStats.totalNet.toLocaleString()}
              </span>
            </div>

            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <span className="text-[9px] font-black uppercase text-emerald-500 block">
                CASH ON HAND
              </span>
              <span className="text-xs font-black font-mono text-emerald-500 block mt-1">
                Rp {monthlyStats.totalCash.toLocaleString()}
              </span>
            </div>

            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <span className="text-[9px] font-black uppercase text-blue-500 block">
                TOTAL EDC / QR
              </span>
              <span className="text-xs font-black font-mono text-blue-500 block mt-1">
                Rp {monthlyStats.totalEDC.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* PANEL KANAN: BUDGETING DARI EXECUTIVE PANEL */}
        <div className="lg:col-span-5 bg-(--bg-card) p-5 rounded-2xl border border-(--border-color) shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-(--border-color) pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-(--text-primary)">
                  BUDGETING (% NET SALES)
                </h3>
              </div>
            </div>

            <form
              onSubmit={handleSaveBudgetInline}
              className="flex items-center gap-2 mb-2"
            >
              <input
                type="text"
                value={budgetInputName}
                onChange={(e) =>
                  setBudgetInputName(e.target.value.toUpperCase())
                }
                placeholder="Alokasi (e.g. GAJI)..."
                className="flex-1 text-xs font-bold p-1.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none text-(--text-primary)"
              />
              <input
                type="number"
                value={budgetInputPct}
                onChange={(e) =>
                  setBudgetInputPct(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                placeholder="%"
                className="w-14 text-xs font-mono font-black text-center p-1.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none text-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-black hover:bg-emerald-600 transition cursor-pointer"
              >
                SIMPAN
              </button>
            </form>
          </div>

          <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-1">
            {currentMonthAllocations.map((b) => {
              const nominal =
                b.percentage > 0
                  ? Math.round(monthlyStats.totalNet * (b.percentage / 100))
                  : b.nominal || 0;
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-1.5 bg-(--bg-input) rounded-lg text-xs font-bold border border-(--border-color) group"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-(--text-primary) text-[11px]">
                      {b.name}
                    </span>
                    <span className="text-[9px] bg-(--surface-hover) text-emerald-500 px-1 py-0.2 rounded font-black font-mono">
                      [{b.percentage}%]
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-500 font-bold text-[11px]">
                      Rp {nominal.toLocaleString()}
                    </span>
                    <button
                      onClick={async () => {
                        await globalCommandBus.execute({
                          type: "ARCHIVE_EXECUTIVE_ALLOCATION",
                          payload: { id: b.id },
                        });
                        sysToast.success(
                          "Berhasil",
                          `Alokasi ${b.name} dinonaktifkan.`,
                        );
                      }}
                      className="text-(--text-secondary) hover:text-rose-500 opacity-0 group-hover:opacity-100 transition cursor-pointer p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            {currentMonthAllocations.length === 0 && (
              <div className="text-center py-2 text-[11px] text-(--text-secondary) italic">
                Belum ada alokasi budget untuk bulan ini.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FILTER BULAN & TOMBOL INPUT */}
      {/* ========================================================================= */}
      <div className="px-6 py-3 bg-(--bg-card) border-b border-(--border-color) flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-(--bg-input) border border-(--border-color) rounded-xl px-3 py-1.5 shadow-xs">
            <Calendar className="w-4 h-4 text-orange-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-black text-(--text-primary) outline-none cursor-pointer"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

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

        <div className="flex items-center gap-3">
          <button
            onClick={() => exportExcelPlusales(filteredDocs)}
            className="px-3.5 py-2 text-xs font-black text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition cursor-pointer flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" /> EXPORT EXCEL
          </button>

          {viewStatus === "AKTIF" && (
            <button
              onClick={() =>
                openCenterModal({
                  title: "Formulir Timbangan Penjualan Harian",
                  content: (
                    <PlusalesFormModal
                      isEditMode={false}
                      initialData={{}}
                      onClose={closeCenterModal}
                    />
                  ),
                })
              }
              className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" /> INPUT REKAP PENJUALAN
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TABEL DATA REKAPAN HARIAN */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
        <div className="bg-(--bg-card) border border-(--border-color) rounded-2xl shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black text-(--text-secondary) tracking-wider">
                <th className="px-4 py-3">Tanggal &amp; Hari</th>
                <th className="px-4 py-3 text-right text-orange-500">
                  Gross Sales
                </th>
                <th className="px-4 py-3 text-right">Net Sales</th>
                <th className="px-4 py-3 text-right">Diskon</th>
                <th className="px-4 py-3 text-right">Tax (PB1)</th>
                <th className="px-4 py-3 text-right">Service</th>
                <th className="px-4 py-3 text-right text-emerald-500">
                  Cash on Hand
                </th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border-color) text-xs font-semibold text-(--text-primary)">
              {filteredDocs.map((doc) => {
                const diff = doc.balanceDifference || 0;
                return (
                  <tr
                    key={doc.id}
                    className="hover:bg-(--surface-hover) transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-bold text-(--text-primary)">
                        {new Date(doc.date).toLocaleDateString("id-ID", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-[10px] font-mono text-(--text-secondary)">
                        {doc.documentNumber}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-black text-orange-500">
                      Rp {(doc.grossSales || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-(--text-primary)">
                      Rp {(doc.netSales || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-(--text-secondary)">
                      Rp {(doc.discount || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-(--text-secondary)">
                      Rp {(doc.tax || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-(--text-secondary)">
                      Rp {(doc.service || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-500">
                      Rp {(doc.cashOnHand || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 text-[9px] font-black rounded uppercase border ${
                          diff === 0
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        }`}
                      >
                        {diff === 0
                          ? "BALANCE"
                          : `SELISIH (${diff > 0 ? "+" : ""}${diff.toLocaleString()})`}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() =>
                          openCenterModal({
                            title: `DETAIL TIMBANGAN: ${doc.documentNumber}`,
                            content: (
                              <PlusalesDetailModal
                                doc={doc}
                                onClose={closeCenterModal}
                              />
                            ),
                          })
                        }
                        className="p-1.5 text-(--text-secondary) hover:text-blue-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                        title="Lihat Detail Timbangan"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => printModReportPdf(doc, outletName)}
                        className="p-1.5 text-(--text-secondary) hover:text-indigo-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                        title="Cetak Laporan MOD (PDF)"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {viewStatus === "AKTIF" ? (
                        <>
                          <button
                            onClick={() =>
                              openCenterModal({
                                title: "Formulir Timbangan Penjualan Harian",
                                content: (
                                  <PlusalesFormModal
                                    isEditMode={true}
                                    initialData={doc}
                                    onClose={closeCenterModal}
                                  />
                                ),
                              })
                            }
                            className="p-1.5 text-(--text-secondary) hover:text-orange-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                            title="Edit Rekap"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() =>
                              confirmArchive(doc.id, doc.documentNumber)
                            }
                            className="p-1.5 text-(--text-secondary) hover:text-rose-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                            title="Arsipkan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() =>
                            handleAction("RESTORE_PLUSALES", doc.id)
                          }
                          className="px-2 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> RESTORE
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredDocs.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="p-12 text-center text-(--text-secondary) font-bold text-xs italic"
                  >
                    Belum ada rekapitulasi penjualan pada bulan{" "}
                    {currentMonthLabel}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
