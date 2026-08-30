// File: modules/mdl_receiving/src/client/ReceivingPage.tsx
import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ShoppingCart,
  Receipt,
  Wallet,
  Plus,
  CheckCircle2,
  FileText,
  Printer,
  DollarSign,
  Calendar,
  ChevronDown,
  Filter,
  Layers,
  FileSpreadsheet,
  Eye,
  Edit2,
  MoreVertical,
  Archive,
  RotateCcw,
  Ban,
  RefreshCcw,
} from "lucide-react";
import { useReceivingStore } from "./store";
import { useVendorStore } from "../../../mdl_vendor/src/client/store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayout";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { UniversalCombobox } from "../../../../apps/client_unv/src/shared-ui/UniversalCombobox";

import {
  ReceivingForm,
  PaymentModal,
  InvoiceDetailModal,
} from "./form-receiving";
import {
  printSingleInvoicePdf,
  printSummaryPeriodPdf,
  printDetailedPeriodPdf,
} from "./features/pdf-receiving";
import { exportExcelReceiving } from "./features/excel-receiving";

// =========================================================================
// 1. KOMPONEN: ROW ACTION MENU (PORTAL-BASED)
// =========================================================================
function RowActionMenu({
  doc,
  onPay,
  onEdit,
  onComplete,
  onArchive,
  onCancel,
  onReopen,
}: {
  doc: any;
  onPay: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onArchive: () => void;
  onCancel: () => void;
  onReopen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isPaid = doc.totalAmount - doc.paidAmount <= 0;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleScroll = () => setOpen(false);
    const handleResize = () => setOpen(false);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  const toggleMenu = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 192;
      const menuHeight = 180;
      let top = rect.bottom + 4;
      let left = rect.right - menuWidth;

      if (top + menuHeight > window.innerHeight) {
        top = rect.top - menuHeight - 4;
      }
      if (left < 8) left = 8;
      if (left + menuWidth > window.innerWidth - 8) {
        left = window.innerWidth - menuWidth - 8;
      }

      setCoords({ top, left });
    }
    setOpen((prev) => !prev);
  };

  const handleAction = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="p-1.5 text-(--text-secondary) hover:text-(--text-primary) bg-(--bg-card) border border-(--border-color) rounded cursor-pointer transition"
        title="Menu Aksi"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              zIndex: 10000,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            className="w-48 bg-(--bg-card) rounded-xl shadow-2xl border border-(--border-color) py-1 animate-in fade-in zoom-in-95 duration-150 text-xs font-bold"
          >
            {/* 1. BAYAR CICILAN (JIKA BELUM LUNAS & BUKAN VOID) */}
            {!isPaid && doc.status !== "CANCELLED" && (
              <button
                onClick={() => handleAction(onPay)}
                className="w-full text-left px-4 py-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2 transition cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5" /> Bayar Cicilan
              </button>
            )}

            {/* 2. EDIT DRAFT */}
            {doc.status === "DRAFT" && !isPaid && (
              <button
                onClick={() => handleAction(onEdit)}
                className="w-full text-left px-4 py-2 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 flex items-center gap-2 transition cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit Draft
              </button>
            )}

            {/* 3. SELESAIKAN & KUNCI DOKUMEN */}
            {doc.status === "DRAFT" && (
              <button
                onClick={() => handleAction(onComplete)}
                className="w-full text-left px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 flex items-center gap-2 transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Selesaikan / Kunci
              </button>
            )}

            {/* 4. ARSIPKAN NOTA DRAFT */}
            {doc.status === "DRAFT" && (
              <button
                onClick={() => handleAction(onArchive)}
                className="w-full text-left px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-500/10 flex items-center gap-2 transition cursor-pointer border-t border-(--border-color)"
              >
                <Archive className="w-3.5 h-3.5" /> Arsipkan Nota
              </button>
            )}

            {/* 5. BATALKAN TRANSAKSI SELESAI (VOID) */}
            {doc.status === "COMPLETED" && (
              <button
                onClick={() => handleAction(onCancel)}
                className="w-full text-left px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" /> Batalkan (VOID)
              </button>
            )}

            {/* 6. SOLUSI ANTI-INPUT ULANG: BUKA KEMBALI NOTA YANG DI-VOID KE DRAFT */}
            {doc.status === "CANCELLED" && (
              <>
                <button
                  onClick={() => handleAction(onReopen)}
                  className="w-full text-left px-4 py-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2 transition cursor-pointer"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Buka Kembali ke Draft
                </button>
                <button
                  onClick={() => handleAction(onArchive)}
                  className="w-full text-left px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-500/10 flex items-center gap-2 transition cursor-pointer border-t border-(--border-color)"
                >
                  <Archive className="w-3.5 h-3.5" /> Arsipkan Dokumen
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

// =========================================================================
// 2. HALAMAN UTAMA: RECEIVING PAGE
// =========================================================================
export function ReceivingPage() {
  const { documents } = useReceivingStore();
  const { vendors } = useVendorStore();
  const { companies, regions, outlets } = useOrgStore();
  const {
    openSideOver,
    closeSideOver,
    openCenterModal,
    closeCenterModal,
    openAlert,
  } = useUniversalModal();

  const deviceScope =
    localStorage.getItem("__unv_deviceScope") ||
    (localStorage.getItem("__unv_outletId") ? "OUTLET" : "COMPANY");
  const canAccessPiutang =
    deviceScope === "COMPANY" || deviceScope === "REGION";

  const [activeTab, setActiveTab] = useState<
    "HUTANG" | "PIUTANG" | "PETTYCASH"
  >("HUTANG");
  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");
  const [filterEntityId, setFilterEntityId] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(e.target as Node)
      ) {
        setIsActionMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleAction = async (type: string, payload: any) => {
    try {
      await globalCommandBus.execute({ type, payload });
      sysToast.success("Berhasil", "Eksekusi berhasil.");
    } catch (e: any) {
      sysToast.error("Gagal", e.message);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    if (doc.documentType !== activeTab) return false;

    // Filter Status Aktif vs Arsip
    const isDocActive = doc.isActive !== false;
    if (viewStatus === "AKTIF" && !isDocActive) return false;
    if (viewStatus === "ARSIP" && isDocActive) return false;

    if (filterEntityId) {
      if (activeTab === "HUTANG" && doc.vendorId !== filterEntityId)
        return false;
      if (activeTab === "PIUTANG" && doc.outletId !== filterEntityId)
        return false;
    }
    if (dateStart && new Date(doc.date) < new Date(dateStart)) return false;
    if (dateEnd && new Date(doc.date) > new Date(dateEnd)) return false;

    const isPaid = doc.totalAmount - doc.paidAmount <= 0;
    if (filterStatus === "PAID" && !isPaid) return false;
    if (filterStatus === "UNPAID" && isPaid) return false;
    return true;
  });

  const groupedData = useMemo(() => {
    const groups: Record<
      string,
      {
        title: string;
        docs: any[];
        lunas: number;
        total: number;
        bankInfo?: any;
      }
    > = {};

    filteredDocs.forEach((doc) => {
      let key = "LAINNYA";
      let title = "Transaksi Umum";
      let bankInfo: any = null;

      if (activeTab === "HUTANG") {
        key = doc.vendorId || "unknown";
        const isRegion = regions.find((r) => r.id === doc.vendorId);
        if (isRegion) {
          title = `[INTERNAL] GUDANG PUSAT [${isRegion.name}]`;
        } else {
          const v = vendors.find((vend) => vend.id === doc.vendorId);
          title = v ? v.name : "Unknown Vendor";
          if (v) {
            bankInfo = {
              bankName: v.bankName,
              bankAccount: v.bankAccount,
              bankAccountName: v.bankAccountName,
            };
          }
        }
      } else if (activeTab === "PIUTANG") {
        key = doc.outletId || "unknown";
        title =
          outlets.find((o) => o.id === doc.outletId)?.name || "Unknown Outlet";
      } else {
        key = "PETTYCASH_GROUP";
        title = "PENGELUARAN PETTYCASH & KAS BON";
      }

      if (!groups[key])
        groups[key] = { title, docs: [], lunas: 0, total: 0, bankInfo };
      groups[key].docs.push(doc);
      groups[key].lunas += doc.paidAmount;
      groups[key].total += doc.totalAmount;
    });
    return groups;
  }, [filteredDocs, activeTab, vendors, outlets, regions]);

  const filterOptions =
    activeTab === "HUTANG"
      ? [
          ...regions
            .filter((r) => r.status === "Aktif")
            .map((r) => ({ value: r.id, label: `[INTERNAL] ${r.name}` })),
          ...vendors
            .filter((v) => v.status === "Aktif")
            .map((v) => ({ value: v.id, label: v.name })),
        ]
      : outlets
          .filter((o) => o.status === "Aktif")
          .map((o) => ({ value: o.id, label: o.name }));

  const getLocationReportName = () => {
    const outId = localStorage.getItem("__unv_outletId");
    const regId = localStorage.getItem("__unv_regionId");
    const compId = localStorage.getItem("__unv_companyId");

    const out = outlets.find((o) => o.id === outId);
    if (out) return `Outlet ${out.name.toUpperCase()}`;
    const reg = regions.find((r) => r.id === regId);
    if (reg) return `Region ${reg.name.toUpperCase()}`;
    const comp = companies.find((c) => c.id === compId);
    if (comp) return `Perusahaan ${comp.name.toUpperCase()}`;
    return "KANTOR PUSAT";
  };

  const getEntityName = (doc: any) => {
    if (doc.documentType === "HUTANG") {
      const reg = regions.find((r) => r.id === doc.vendorId);
      if (reg) return `[INTERNAL] ${reg.name}`;
      return vendors.find((v) => v.id === doc.vendorId)?.name || "-";
    }
    if (doc.documentType === "PIUTANG") {
      return outlets.find((o) => o.id === doc.outletId)?.name || "-";
    }
    return "PETTYCASH";
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {/* HEADER UTAMA: COMPACT & MERGED FILTER BAR */}
      <div className="bg-(--bg-card) border-b border-(--border-color) shrink-0 shadow-xs z-10">
        <div className="h-16 px-6 flex items-center justify-between">
          <h2 className="text-xl font-black text-(--text-primary) tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-500" /> Penerimaan &
            Tagihan Operasional
          </h2>

          <div className="flex items-center gap-3">
            {/* RELOKASI: PILL TOGGLE TAB AKTIF VS ARSIP DI SAMPING TOMBOL EXPORT */}
            <div className="flex items-center bg-(--bg-input) p-1 rounded-xl border border-(--border-color)">
              <button
                onClick={() => setViewStatus("AKTIF")}
                className={`px-3 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer ${
                  viewStatus === "AKTIF"
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "text-(--text-secondary) hover:text-(--text-primary)"
                }`}
              >
                DATA AKTIF
              </button>
              <button
                onClick={() => setViewStatus("ARSIP")}
                className={`px-3 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer ${
                  viewStatus === "ARSIP"
                    ? "bg-slate-800 dark:bg-slate-700 text-white shadow-xs"
                    : "text-(--text-secondary) hover:text-(--text-primary)"
                }`}
              >
                ARSIP
              </button>
            </div>

            {/* MENU AKSI EXPORT & CETAK LAPORAN */}
            <div className="relative" ref={actionMenuRef}>
              <button
                onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-black text-(--text-primary) bg-(--bg-card) border border-(--border-color) rounded-lg hover:bg-(--surface-hover) transition shadow-xs cursor-pointer"
              >
                <Layers className="w-4 h-4 text-emerald-500" /> CETAK & EXPORT
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${isActionMenuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isActionMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-(--bg-card) rounded-xl shadow-2xl border border-(--border-color) py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => {
                      printSummaryPeriodPdf(
                        groupedData,
                        dateStart,
                        dateEnd,
                        getLocationReportName(),
                      );
                      setIsActionMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-(--text-primary) hover:bg-emerald-500/10 hover:text-emerald-600 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-emerald-500" /> Cetak
                    Ringkasan (Finance)
                  </button>
                  <button
                    onClick={() => {
                      printDetailedPeriodPdf(
                        groupedData,
                        dateStart,
                        dateEnd,
                        getLocationReportName(),
                      );
                      setIsActionMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-(--text-primary) hover:bg-orange-500/10 hover:text-orange-600 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-orange-500" /> Cetak
                    Detail (Operasional)
                  </button>
                  <div className="h-px bg-(--border-color) my-1"></div>
                  <button
                    onClick={() => {
                      exportExcelReceiving(filteredDocs, getEntityName);
                      setIsActionMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />{" "}
                    Export Rekap Excel
                  </button>
                </div>
              )}
            </div>

            {viewStatus === "AKTIF" && (
              <button
                onClick={() =>
                  openSideOver({
                    title: `BUAT DOKUMEN ${activeTab}`,
                    width: "w-[500px]",
                    content: (
                      <ReceivingForm
                        tabType={activeTab}
                        onClose={closeSideOver}
                      />
                    ),
                  })
                }
                className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" /> BUAT DOKUMEN
              </button>
            )}
          </div>
        </div>

        {/* TABS HAK AKSES */}
        <div className="flex items-center gap-6 px-6">
          <button
            onClick={() => {
              setActiveTab("HUTANG");
              setFilterEntityId("");
            }}
            className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "HUTANG"
                ? "border-emerald-500 text-emerald-500"
                : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            <Receipt className="w-4 h-4" /> HUTANG (PEMBELIAN)
          </button>

          {canAccessPiutang && (
            <button
              onClick={() => {
                setActiveTab("PIUTANG");
                setFilterEntityId("");
              }}
              className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "PIUTANG"
                  ? "border-emerald-500 text-emerald-500"
                  : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              <FileText className="w-4 h-4" /> PIUTANG (DISTRIBUSI CABANG)
            </button>
          )}

          <button
            onClick={() => {
              setActiveTab("PETTYCASH");
              setFilterEntityId("");
            }}
            className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "PETTYCASH"
                ? "border-emerald-500 text-emerald-500"
                : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            <Wallet className="w-4 h-4" /> PETTYCASH (KAS KECIL)
          </button>
        </div>
      </div>

      {/* FILTER BAR PERIODE */}
      <div className="px-6 py-3 bg-(--bg-card) border-b border-(--border-color) flex items-center gap-3 shrink-0">
        <Filter className="w-4 h-4 text-(--text-secondary)" />
        {activeTab !== "PETTYCASH" && (
          <div className="w-64">
            <UniversalCombobox
              options={filterOptions}
              value={filterEntityId}
              onChange={setFilterEntityId}
              placeholder={`Semua ${activeTab === "HUTANG" ? "Vendor/Gudang" : "Outlet"}...`}
            />
          </div>
        )}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs">
          <Calendar className="w-4 h-4 text-slate-700" />
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-900 outline-none"
            title="Tanggal Mulai Periode"
          />
          <span className="text-slate-400 font-bold">-</span>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-900 outline-none"
            title="Tanggal Akhir Periode"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-(--bg-input) border border-(--border-color) rounded-lg px-3 py-2 text-xs font-bold text-(--text-primary) outline-none"
        >
          <option value="ALL">SEMUA STATUS</option>
          <option value="UNPAID">BELUM LUNAS</option>
          <option value="PAID">LUNAS</option>
        </select>
      </div>

      {/* DAFTAR DOKUMEN TERKELOMPOK */}
      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
        {Object.keys(groupedData).length === 0 ? (
          <div className="bg-(--bg-card) rounded-xl border border-(--border-color) p-10 text-center text-(--text-secondary) font-semibold text-sm">
            Tidak ada transaksi pada periode ini.
          </div>
        ) : (
          Object.entries(groupedData).map(([key, group]) => {
            const isExpanded = expandedGroups[key] !== false;
            const belumLunas = group.total - group.lunas;

            return (
              <div
                key={key}
                className="mb-3 bg-(--bg-card) border border-(--border-color) rounded-xl shadow-xs overflow-hidden"
              >
                <div
                  onClick={() => toggleGroup(key)}
                  className="px-4 py-2.5 bg-(--surface-hover) hover:bg-(--bg-input) border-b border-(--border-color) flex justify-between items-center cursor-pointer select-none transition-colors"
                >
                  <div>
                    <div className="font-black text-(--text-primary) text-sm flex items-center gap-2">
                      {group.title}{" "}
                      <span className="text-[10px] bg-(--bg-input) text-(--text-secondary) px-2 py-0.5 rounded-full border border-(--border-color)">
                        {group.docs.length} Nota
                      </span>
                    </div>
                    {group.bankInfo && (
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Rek: {group.bankInfo.bankName} -{" "}
                        {group.bankInfo.bankAccount} (a.n{" "}
                        {group.bankInfo.bankAccountName})
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold bg-(--bg-input) border border-(--border-color) px-3 py-1 rounded-md">
                      <span className="text-(--text-secondary)">
                        Belum Lunas:
                      </span>{" "}
                      <span className="text-rose-500 font-mono font-bold">
                        Rp {belumLunas.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold bg-(--bg-input) border border-(--border-color) px-3 py-1 rounded-md">
                      <span className="text-(--text-secondary)">Lunas:</span>{" "}
                      <span className="text-emerald-500 font-mono font-bold">
                        Rp {group.lunas.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-black bg-(--text-primary) text-(--bg-card) px-3 py-1 rounded-md">
                      <span>Total:</span>{" "}
                      <span className="font-mono">
                        Rp {group.total.toLocaleString()}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-(--text-secondary) transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-(--bg-card) border-b border-(--border-color) text-[10px] uppercase font-black text-(--text-secondary) tracking-wider">
                        <th className="px-4 py-2">Tgl & Nota</th>
                        <th className="px-4 py-2">Jatuh Tempo</th>
                        <th className="px-4 py-2 text-center">Status</th>
                        <th className="px-4 py-2 text-right text-rose-500">
                          Kekurangan
                        </th>
                        <th className="px-4 py-2 text-right">Nilai Nota</th>
                        <th className="px-4 py-2 text-right w-36">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-(--border-color) text-xs font-semibold text-(--text-primary)">
                      {group.docs.map((doc) => {
                        const sisa = doc.totalAmount - doc.paidAmount;
                        const isPaid = sisa <= 0;
                        const isCancelled = doc.status === "CANCELLED";

                        return (
                          <tr
                            key={doc.id}
                            className="hover:bg-(--surface-hover) transition"
                          >
                            <td className="px-4 py-1.5">
                              <div className="font-bold text-(--text-primary)">
                                {new Date(doc.date).toLocaleDateString(
                                  "id-ID",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </div>
                              <div className="font-mono text-[10px] text-(--text-secondary)">
                                {doc.invoiceNumber}
                              </div>
                            </td>

                            <td className="px-4 py-1.5">
                              {doc.dueDate ? (
                                <div className="text-[10px] text-rose-500 font-bold font-mono">
                                  {new Date(doc.dueDate).toLocaleDateString(
                                    "id-ID",
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-(--text-secondary) italic">
                                  CASH / LUNAS
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-1.5 text-center">
                              {/* 1. STATUS DOKUMEN */}
                              <div
                                className={`inline-block px-2 py-0.5 text-[9px] font-black rounded uppercase border ${
                                  doc.status === "COMPLETED"
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    : doc.status === "CANCELLED"
                                      ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                      : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                }`}
                              >
                                {doc.status}
                              </div>

                              {/* 2. STATUS PEMBAYARAN RESMI DARI DATABASE */}
                              <div
                                className={`inline-block px-2 py-0.5 text-[9px] font-black rounded uppercase ml-1 border ${
                                  doc.paymentStatus === "VOID" ||
                                  doc.status === "CANCELLED"
                                    ? "bg-slate-500/10 text-slate-400 border-slate-500/20"
                                    : doc.paymentStatus === "PAID"
                                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                      : doc.paymentStatus === "PARTIAL"
                                        ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                                        : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                }`}
                              >
                                {doc.paymentStatus === "VOID" ||
                                doc.status === "CANCELLED"
                                  ? "VOID (BATAL)"
                                  : doc.paymentStatus === "PAID"
                                    ? "LUNAS"
                                    : doc.paymentStatus === "PARTIAL"
                                      ? "CICILAN"
                                      : "BELUM LUNAS"}
                              </div>
                            </td>

                            <td className="px-4 py-1.5 text-right font-mono text-rose-500 font-bold">
                              Rp {sisa.toLocaleString()}
                            </td>
                            <td className="px-4 py-1.5 text-right font-mono text-(--text-primary) font-bold">
                              Rp {doc.totalAmount.toLocaleString()}
                            </td>

                            <td className="px-4 py-1.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {/* 1. VIEW DETAIL (MATA) */}
                                <button
                                  onClick={() =>
                                    openCenterModal({
                                      title: `RINCIAN TRANSAKSI: ${doc.invoiceNumber}`,
                                      content: (
                                        <InvoiceDetailModal
                                          document={doc}
                                          vendorName={group.title}
                                          locationName={getLocationReportName()}
                                          onClose={closeCenterModal}
                                        />
                                      ),
                                    })
                                  }
                                  className="p-1.5 text-(--text-secondary) hover:text-blue-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                                  title="Lihat Detail Rincian"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* 2. PRINT FAKTUR SATUAN */}
                                <button
                                  onClick={() =>
                                    printSingleInvoicePdf(
                                      doc,
                                      group.title,
                                      getLocationReportName(),
                                      group.bankInfo,
                                    )
                                  }
                                  className="p-1.5 text-(--text-secondary) hover:text-indigo-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                                  title="Cetak Faktur Nota Ini"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>

                                {viewStatus === "AKTIF" ? (
                                  /* 3. MENU LACI AKSI DENGAN SOLUSI REOPEN ANTI-INPUT ULANG */
                                  <RowActionMenu
                                    doc={doc}
                                    onPay={() =>
                                      openCenterModal({
                                        title: `BAYAR TAGIHAN: ${doc.invoiceNumber}`,
                                        content: (
                                          <PaymentModal
                                            document={doc}
                                            onClose={closeCenterModal}
                                          />
                                        ),
                                      })
                                    }
                                    onEdit={() =>
                                      openSideOver({
                                        title: `EDIT DOKUMEN ${doc.documentType}`,
                                        width: "w-[500px]",
                                        content: (
                                          <ReceivingForm
                                            tabType={doc.documentType}
                                            isEditMode={true}
                                            initialData={doc}
                                            onClose={closeSideOver}
                                          />
                                        ),
                                      })
                                    }
                                    onComplete={() =>
                                      openAlert({
                                        title: "Selesaikan Transaksi",
                                        message:
                                          "Transaksi akan dikunci permanen & harga HPP master item akan diperbarui. Lanjutkan?",
                                        confirmText: "SELESAIKAN",
                                        onConfirm: () =>
                                          handleAction("COMPLETE_RECEIVING", {
                                            documentId: doc.id,
                                            documentType: doc.documentType,
                                            companyId: doc.companyId,
                                            regionId: doc.regionId,
                                            outletId: doc.outletId,
                                          }),
                                      })
                                    }
                                    onArchive={() =>
                                      openAlert({
                                        title: "Arsipkan Dokumen",
                                        message: `Pindahkan nota "${doc.invoiceNumber}" ke tab Data Arsip?`,
                                        confirmText: "YA, ARSIPKAN",
                                        onConfirm: () =>
                                          handleAction("ARCHIVE_RECEIVING", {
                                            documentId: doc.id,
                                          }),
                                      })
                                    }
                                    onCancel={() =>
                                      openAlert({
                                        title: "Batalkan Transaksi (VOID)",
                                        message: `Transaksi "${doc.invoiceNumber}" ini sudah selesai. Apakah Anda yakin ingin membatalkannya (Status menjadi CANCELLED)?`,
                                        confirmText: "YA, BATALKAN (VOID)",
                                        onConfirm: () =>
                                          handleAction("CANCEL_RECEIVING", {
                                            documentId: doc.id,
                                          }),
                                      })
                                    }
                                    onReopen={() =>
                                      openAlert({
                                        title: "Buka Kembali ke Draft",
                                        message: `Kembalikan nota "${doc.invoiceNumber}" ke status DRAFT agar dapat diedit kembali tanpa perlu input ulang?`,
                                        confirmText: "BUKA KE DRAFT",
                                        onConfirm: () =>
                                          handleAction("REOPEN_RECEIVING", {
                                            documentId: doc.id,
                                          }),
                                      })
                                    }
                                  />
                                ) : (
                                  /* 4. TOMBOL RESTORE (JIKA DI TAB ARSIP) */
                                  <button
                                    onClick={() =>
                                      handleAction("RESTORE_RECEIVING", {
                                        documentId: doc.id,
                                      })
                                    }
                                    className="px-2 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded inline-flex items-center gap-1 cursor-pointer"
                                    title="Pulihkan Nota"
                                  >
                                    <RotateCcw className="w-3 h-3" /> RESTORE
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
