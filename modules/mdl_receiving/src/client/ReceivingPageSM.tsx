// File: modules/mdl_receiving/src/client/ReceivingPageSM.tsx
import React, { useState, useMemo, useRef, useEffect } from "react";
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
  X,
} from "lucide-react";
import { useReceivingStore } from "./store";
import { useVendorStore } from "../../../mdl_vendor/src/client/store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayoutSM";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { UniversalCombobox } from "../../../../apps/client_unv/src/shared-ui/UniversalCombobox";

import {
  ReceivingForm,
  PaymentModal,
  InvoiceDetailModal,
} from "./form-receivingSM"; // versi mobile dari form
import {
  printSingleInvoicePdf,
  printSummaryPeriodPdf,
  printDetailedPeriodPdf,
} from "./features/pdf-receiving";
import { exportExcelReceiving } from "./features/excel-receiving";

// =========================================================================
// HALAMAN UTAMA MOBILE: RECEIVING PAGE SM
// =========================================================================
export function ReceivingPageSM() {
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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [actionMenuDocId, setActionMenuDocId] = useState<string | null>(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false); // untuk menu export
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Tutup menu export saat klik di luar
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

    const localOutletId = localStorage.getItem("__unv_outletId");
    const localRegionId = localStorage.getItem("__unv_regionId");

    if (localOutletId) {
      if (doc.outletId && doc.outletId !== localOutletId) return false;
      if (!doc.outletId) return false;
    } else if (localRegionId) {
      if (doc.regionId && doc.regionId !== localRegionId) return false;
    }

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

  // Render aksi untuk dokumen tertentu
  const renderDocActions = (doc: any, groupTitle: string) => {
    const isPaid = doc.totalAmount - doc.paidAmount <= 0;
    const actions = [];

    if (!isPaid && doc.status !== "CANCELLED") {
      actions.push({
        icon: <DollarSign className="w-4 h-4" />,
        label: "Bayar Cicilan",
        color: "text-emerald-600 dark:text-emerald-400",
        onClick: () =>
          openCenterModal({
            title: `BAYAR TAGIHAN: ${doc.invoiceNumber}`,
            content: <PaymentModal document={doc} onClose={closeCenterModal} />,
          }),
      });
    }

    if (doc.status === "DRAFT" && !isPaid) {
      actions.push({
        icon: <Edit2 className="w-4 h-4" />,
        label: "Edit Draft",
        color: "text-orange-600 dark:text-orange-400",
        onClick: () =>
          openSideOver({
            title: `EDIT DOKUMEN ${doc.documentType}`,
            width: "w-full sm:w-[500px]",
            content: (
              <ReceivingForm
                tabType={doc.documentType}
                isEditMode={true}
                initialData={doc}
                onClose={closeSideOver}
              />
            ),
          }),
      });
    }

    if (doc.status === "DRAFT") {
      actions.push({
        icon: <CheckCircle2 className="w-4 h-4" />,
        label: "Selesaikan / Kunci",
        color: "text-blue-600 dark:text-blue-400",
        onClick: () =>
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
          }),
      });
    }

    if (doc.status === "DRAFT") {
      actions.push({
        icon: <Archive className="w-4 h-4" />,
        label: "Arsipkan Nota",
        color: "text-slate-600 dark:text-slate-400",
        onClick: () =>
          openAlert({
            title: "Arsipkan Dokumen",
            message: `Pindahkan nota "${doc.invoiceNumber}" ke tab Data Arsip?`,
            confirmText: "YA, ARSIPKAN",
            onConfirm: () =>
              handleAction("ARCHIVE_RECEIVING", { documentId: doc.id }),
          }),
      });
    }

    if (doc.status === "COMPLETED") {
      actions.push({
        icon: <Ban className="w-4 h-4" />,
        label: "Batalkan (VOID)",
        color: "text-rose-600 dark:text-rose-400",
        onClick: () =>
          openAlert({
            title: "Batalkan Transaksi (VOID)",
            message: `Transaksi "${doc.invoiceNumber}" ini sudah selesai. Apakah Anda yakin ingin membatalkannya (Status menjadi CANCELLED)?`,
            confirmText: "YA, BATALKAN (VOID)",
            onConfirm: () =>
              handleAction("CANCEL_RECEIVING", { documentId: doc.id }),
          }),
      });
    }

    if (doc.status === "CANCELLED") {
      actions.push({
        icon: <RefreshCcw className="w-4 h-4" />,
        label: "Buka Kembali ke Draft",
        color: "text-emerald-600 dark:text-emerald-400",
        onClick: () =>
          openAlert({
            title: "Buka Kembali ke Draft",
            message: `Kembalikan nota "${doc.invoiceNumber}" ke status DRAFT agar dapat diedit kembali tanpa perlu input ulang?`,
            confirmText: "BUKA KE DRAFT",
            onConfirm: () =>
              handleAction("REOPEN_RECEIVING", { documentId: doc.id }),
          }),
      });
      actions.push({
        icon: <Archive className="w-4 h-4" />,
        label: "Arsipkan Dokumen",
        color: "text-slate-600 dark:text-slate-400",
        onClick: () =>
          openAlert({
            title: "Arsipkan Dokumen",
            message: `Pindahkan nota "${doc.invoiceNumber}" ke tab Data Arsip?`,
            confirmText: "YA, ARSIPKAN",
            onConfirm: () =>
              handleAction("ARCHIVE_RECEIVING", { documentId: doc.id }),
          }),
      });
    }

    return actions;
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {/* HEADER */}
      <div className="bg-(--bg-card) border-b border-(--border-color) shrink-0 z-10">
        <div className="p-3 flex items-center justify-between">
          <h2 className="text-base font-black text-(--text-primary) flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-500" /> Penerimaan &
            Tagihan
          </h2>
          <div className="flex items-center gap-1">
            {/* Toggle Aktif/Arsip */}
            <div className="flex bg-(--bg-input) rounded-lg border border-(--border-color) p-0.5">
              <button
                onClick={() => setViewStatus("AKTIF")}
                className={`px-3 py-1 text-[10px] font-black rounded ${
                  viewStatus === "AKTIF"
                    ? "bg-emerald-500 text-white"
                    : "text-(--text-secondary)"
                }`}
              >
                AKTIF
              </button>
              <button
                onClick={() => setViewStatus("ARSIP")}
                className={`px-3 py-1 text-[10px] font-black rounded ${
                  viewStatus === "ARSIP"
                    ? "bg-slate-700 dark:bg-slate-600 text-white"
                    : "text-(--text-secondary)"
                }`}
              >
                ARSIP
              </button>
            </div>

            {/* Export Menu */}
            <div className="relative" ref={actionMenuRef}>
              <button
                onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                className="p-2 rounded-lg border border-(--border-color) flex items-center gap-1"
              >
                <Layers className="w-4 h-4 text-emerald-500" />
              </button>
              {isActionMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-(--bg-card) rounded-xl shadow-2xl border border-(--border-color) py-2 z-50">
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
                    className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-(--surface-hover) flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4 text-emerald-500" /> Cetak
                    Ringkasan
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
                    className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-(--surface-hover) flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-orange-500" /> Cetak
                    Detail
                  </button>
                  <div className="h-px bg-(--border-color) my-1" />
                  <button
                    onClick={() => {
                      exportExcelReceiving(filteredDocs, getEntityName);
                      setIsActionMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-(--surface-hover) flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />{" "}
                    Export Excel
                  </button>
                </div>
              )}
            </div>

            {/* Tombol Buat Dokumen */}
            {viewStatus === "AKTIF" && (
              <button
                onClick={() =>
                  openSideOver({
                    title: `BUAT DOKUMEN ${activeTab}`,
                    width: "w-full sm:w-[500px]",
                    content: (
                      <ReceivingForm
                        tabType={activeTab}
                        onClose={closeSideOver}
                      />
                    ),
                  })
                }
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-emerald-500 rounded-lg"
              >
                <Plus className="w-4 h-4" /> Buat
              </button>
            )}
          </div>
        </div>

        {/* TABS SCROLL HORIZONTAL */}
        <div className="flex overflow-x-auto gap-1 px-2 pb-1">
          <button
            onClick={() => {
              setActiveTab("HUTANG");
              setFilterEntityId("");
            }}
            className={`whitespace-nowrap py-2 px-4 text-xs font-black tracking-wide border-b-2 ${
              activeTab === "HUTANG"
                ? "border-emerald-500 text-emerald-500"
                : "border-transparent text-(--text-secondary)"
            }`}
          >
            HUTANG
          </button>

          {canAccessPiutang && (
            <button
              onClick={() => {
                setActiveTab("PIUTANG");
                setFilterEntityId("");
              }}
              className={`whitespace-nowrap py-2 px-4 text-xs font-black tracking-wide border-b-2 ${
                activeTab === "PIUTANG"
                  ? "border-emerald-500 text-emerald-500"
                  : "border-transparent text-(--text-secondary)"
              }`}
            >
              PIUTANG
            </button>
          )}

          <button
            onClick={() => {
              setActiveTab("PETTYCASH");
              setFilterEntityId("");
            }}
            className={`whitespace-nowrap py-2 px-4 text-xs font-black tracking-wide border-b-2 ${
              activeTab === "PETTYCASH"
                ? "border-emerald-500 text-emerald-500"
                : "border-transparent text-(--text-secondary)"
            }`}
          >
            PETTYCASH
          </button>
        </div>
      </div>

      {/* FILTER BAR (COLLAPSIBLE) */}
      <div className="px-3 py-2 border-b border-(--border-color) flex items-center justify-between bg-(--surface-hover)">
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className="flex items-center gap-2 text-xs font-bold text-(--text-primary)"
        >
          <Filter className="w-4 h-4" /> Filter{" "}
          <ChevronDown
            className={`w-3 h-3 transition-transform ${
              isFilterOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        <div className="flex items-center gap-2">
          {filterEntityId && (
            <span className="text-[10px] bg-(--bg-input) px-2 py-0.5 rounded-full">
              {filterOptions.find((o) => o.value === filterEntityId)?.label ||
                filterEntityId}
            </span>
          )}
          {dateStart && (
            <span className="text-[10px] bg-(--bg-input) px-2 py-0.5 rounded-full">
              {dateStart} → {dateEnd || "..."}
            </span>
          )}
          {filterStatus !== "ALL" && (
            <span className="text-[10px] bg-(--bg-input) px-2 py-0.5 rounded-full">
              {filterStatus}
            </span>
          )}
        </div>
      </div>

      {isFilterOpen && (
        <div className="p-3 bg-(--bg-card) border-b border-(--border-color) space-y-3">
          {activeTab !== "PETTYCASH" && (
            <div>
              <UniversalCombobox
                options={filterOptions}
                value={filterEntityId}
                onChange={setFilterEntityId}
                placeholder={`Semua ${activeTab === "HUTANG" ? "Vendor/Gudang" : "Outlet"}...`}
              />
            </div>
          )}
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="flex-1 text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg"
            />
            <span className="text-(--text-secondary)">-</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="flex-1 text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg"
          >
            <option value="ALL">SEMUA STATUS</option>
            <option value="UNPAID">BELUM LUNAS</option>
            <option value="PAID">LUNAS</option>
          </select>
        </div>
      )}

      {/* DAFTAR DOKUMEN */}
      <div className="flex-1 overflow-auto p-3 custom-scrollbar">
        {Object.keys(groupedData).length === 0 ? (
          <div className="bg-(--bg-card) rounded-xl border border-(--border-color) p-8 text-center text-(--text-secondary) font-semibold text-sm">
            Tidak ada transaksi pada periode ini.
          </div>
        ) : (
          Object.entries(groupedData).map(([key, group]) => {
            const isExpanded = expandedGroups[key] !== false;
            const belumLunas = group.total - group.lunas;

            return (
              <div
                key={key}
                className="mb-3 bg-(--bg-card) border border-(--border-color) rounded-xl overflow-hidden"
              >
                {/* Header Group */}
                <div
                  onClick={() => toggleGroup(key)}
                  className="px-3 py-3 bg-(--surface-hover) border-b border-(--border-color) flex justify-between items-center"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-(--text-primary) text-sm flex items-center gap-2 flex-wrap">
                      {group.title}{" "}
                      <span className="text-[10px] bg-(--bg-input) text-(--text-secondary) px-2 py-0.5 rounded-full">
                        {group.docs.length} Nota
                      </span>
                    </div>
                    {group.bankInfo && (
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                        Rek: {group.bankInfo.bankName} -{" "}
                        {group.bankInfo.bankAccount}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <div className="text-xs font-bold">
                      <span className="text-(--text-secondary)">Sisa: </span>
                      <span className="text-rose-500 font-mono">
                        Rp {belumLunas.toLocaleString()}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-(--text-secondary) transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {/* Kartu Dokumen */}
                {isExpanded && (
                  <div className="p-2 space-y-2">
                    {group.docs.map((doc) => {
                      const sisa = doc.totalAmount - doc.paidAmount;
                      const isPaid = sisa <= 0;
                      const isCancelled = doc.status === "CANCELLED";
                      const actions = renderDocActions(doc, group.title);

                      return (
                        <div
                          key={doc.id}
                          className="border border-(--border-color) rounded-lg p-3 bg-(--bg-card)"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-(--text-primary)">
                                {doc.invoiceNumber}
                              </div>
                              <div className="text-[10px] text-(--text-secondary) mt-0.5">
                                {new Date(doc.date).toLocaleDateString(
                                  "id-ID",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </div>
                              {doc.dueDate && (
                                <div className="text-[10px] text-rose-500 font-bold mt-0.5">
                                  Jatuh tempo:{" "}
                                  {new Date(doc.dueDate).toLocaleDateString(
                                    "id-ID",
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Tombol View & Print */}
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
                                className="p-1.5 text-(--text-secondary) hover:text-blue-500 border border-(--border-color) rounded"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  printSingleInvoicePdf(
                                    doc,
                                    group.title,
                                    getLocationReportName(),
                                    group.bankInfo,
                                  )
                                }
                                className="p-1.5 text-(--text-secondary) hover:text-indigo-500 border border-(--border-color) rounded"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              {/* Tombol Aksi (More) */}
                              <button
                                onClick={() =>
                                  setActionMenuDocId(
                                    actionMenuDocId === doc.id ? null : doc.id,
                                  )
                                }
                                className="p-1.5 text-(--text-secondary) hover:text-(--text-primary) border border-(--border-color) rounded"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Status & Jumlah */}
                          <div className="flex justify-between items-center mt-2 text-xs">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  doc.status === "COMPLETED"
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : doc.status === "CANCELLED"
                                      ? "bg-rose-500/10 text-rose-500"
                                      : "bg-amber-500/10 text-amber-500"
                                }`}
                              >
                                {doc.status}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  isPaid
                                    ? "bg-blue-500/10 text-blue-500"
                                    : "bg-rose-500/10 text-rose-500"
                                }`}
                              >
                                {isPaid ? "LUNAS" : "BELUM LUNAS"}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-(--text-secondary)">
                                Sisa
                              </div>
                              <div className="font-bold text-rose-500 font-mono">
                                Rp {sisa.toLocaleString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-(--text-secondary)">
                                Total
                              </div>
                              <div className="font-bold text-(--text-primary) font-mono">
                                Rp {doc.totalAmount.toLocaleString()}
                              </div>
                            </div>
                          </div>

                          {/* Menu Aksi Inline */}
                          {actionMenuDocId === doc.id && (
                            <div className="mt-2 pt-2 border-t border-(--border-color) space-y-1">
                              {actions.map((action, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setActionMenuDocId(null);
                                    action.onClick();
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg hover:bg-(--surface-hover) flex items-center gap-2 ${action.color}`}
                                >
                                  {action.icon}
                                  {action.label}
                                </button>
                              ))}
                              {viewStatus === "ARSIP" && (
                                <button
                                  onClick={() => {
                                    setActionMenuDocId(null);
                                    handleAction("RESTORE_RECEIVING", {
                                      documentId: doc.id,
                                    });
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs font-bold rounded-lg hover:bg-(--surface-hover) flex items-center gap-2 text-emerald-600"
                                >
                                  <RotateCcw className="w-4 h-4" /> Restore
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
