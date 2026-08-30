// File: apps/client_unv/src/executive-dashboard/components/DebtReceivableView.tsx
import React, { useState, useMemo } from "react";
import {
  CreditCard,
  ChevronDown,
  ChevronRight,
  Eye,
  Building2,
  Truck,
  ArrowUpDown,
  Store,
  Layers,
  ArrowRightLeft,
} from "lucide-react";
import { InvoiceDetailModal } from "./InvoiceDetailModal";

interface DebtReceivableViewProps {
  receivingDocs: any[];
  regions: any[];
  outlets: any[];
  vendors: any[];
  filters?: {
    regionId?: string;
    outletId?: string;
    month?: string;
  };
  isDark?: boolean;
}

export const DebtReceivableView: React.FC<DebtReceivableViewProps> = ({
  receivingDocs,
  regions,
  outlets,
  vendors,
  filters = { regionId: "", outletId: "", month: "" },
  isDark = true,
}) => {
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [expandedRegions, setExpandedRegions] = useState<
    Record<string, boolean>
  >({});
  const [expandedEntities, setExpandedEntities] = useState<
    Record<string, boolean>
  >({});
  const [sortBy, setSortBy] = useState<"TERBESAR" | "TERLAMA">("TERBESAR");

  const toggleRegion = (id: string) =>
    setExpandedRegions((p) => ({ ...p, [id]: !p[id] }));
  const toggleEntity = (id: string) =>
    setExpandedEntities((p) => ({ ...p, [id]: !p[id] }));

  // Helper: Deteksi apakah transaksi berasal dari Gudang Pusat (Internal Supply)
  const isInternalSupply = (doc: any) =>
    regions.some((r) => r.id === doc.vendorId);

  const isHoldingLevel = !filters.regionId && !filters.outletId;
  const isRegionLevel = Boolean(filters.regionId) && !filters.outletId;

  // =========================================================================
  // 1. STRUKTUR DATA HUTANG (DENGAN ELIMINASI TRANSAKSI INTERNAL)
  // =========================================================================
  const debtGrouped = useMemo(() => {
    const regionMap: Record<
      string,
      {
        regionName: string;
        totalHutangEksternal: number;
        sisaHutangEksternal: number;
        totalHutangInternal: number;
        sisaHutangInternal: number;
        externalVendors: Record<string, any>;
        internalWarehouses: Record<string, any>;
      }
    > = {};

    receivingDocs
      .filter((d) => {
        if (d.status === "CANCELLED" || d.isActive === false) return false;
        if (d.documentType !== "HUTANG") return false;

        if (filters.outletId && d.outletId !== filters.outletId) return false;
        if (filters.regionId && d.regionId !== filters.regionId) return false;
        if (filters.month && d.date && !d.date.startsWith(filters.month))
          return false;

        return true;
      })
      .forEach((doc) => {
        const regId = doc.regionId || "HEAD_OFFICE";
        const regName =
          regions.find((r) => r.id === regId)?.name || "KANTOR PUSAT";

        if (!regionMap[regId]) {
          regionMap[regId] = {
            regionName: regName,
            totalHutangEksternal: 0,
            sisaHutangEksternal: 0,
            totalHutangInternal: 0,
            sisaHutangInternal: 0,
            externalVendors: {},
            internalWarehouses: {},
          };
        }

        const sisa = (doc.totalAmount || 0) - (doc.paidAmount || 0);
        const internal = isInternalSupply(doc);

        if (internal) {
          regionMap[regId].totalHutangInternal += doc.totalAmount || 0;
          regionMap[regId].sisaHutangInternal += sisa;

          const sourceReg = regions.find((r) => r.id === doc.vendorId);
          const sourceName = sourceReg
            ? `Gudang Pusat [${sourceReg.name}]`
            : "Gudang Pusat (Internal)";

          const wKey = doc.vendorId || "INT_WAREHOUSE";
          if (!regionMap[regId].internalWarehouses[wKey]) {
            regionMap[regId].internalWarehouses[wKey] = {
              warehouseName: sourceName,
              sisaHutang: 0,
              invoices: [],
            };
          }
          regionMap[regId].internalWarehouses[wKey].sisaHutang += sisa;
          regionMap[regId].internalWarehouses[wKey].invoices.push(doc);
        } else {
          regionMap[regId].totalHutangEksternal += doc.totalAmount || 0;
          regionMap[regId].sisaHutangEksternal += sisa;

          const vendId = doc.vendorId || "VND_UNKNOWN";
          const vendName =
            vendors.find((v) => v.id === vendId)?.name || "Vendor Pemasok Luar";

          if (!regionMap[regId].externalVendors[vendId]) {
            regionMap[regId].externalVendors[vendId] = {
              vendorName: vendName,
              sisaHutang: 0,
              invoices: [],
            };
          }
          regionMap[regId].externalVendors[vendId].sisaHutang += sisa;
          regionMap[regId].externalVendors[vendId].invoices.push(doc);
        }
      });

    return regionMap;
  }, [receivingDocs, regions, vendors, filters]);

  // =========================================================================
  // 2. STRUKTUR DATA PIUTANG (DISTRIBUSI GUDANG PUSAT KE CABANG)
  // =========================================================================
  const receivableGrouped = useMemo(() => {
    const regionMap: Record<
      string,
      {
        regionName: string;
        totalPiutang: number;
        totalLunas: number;
        sisaPiutang: number;
        outlets: Record<string, any>;
      }
    > = {};

    receivingDocs
      .filter((d) => {
        if (d.status === "CANCELLED" || d.isActive === false) return false;

        const isReceivableDoc =
          d.documentType === "PIUTANG" ||
          (d.documentType === "HUTANG" && isInternalSupply(d));

        if (!isReceivableDoc) return false;

        if (filters.regionId && d.regionId !== filters.regionId) return false;
        if (filters.outletId && d.outletId !== filters.outletId) return false;
        if (filters.month && d.date && !d.date.startsWith(filters.month))
          return false;

        return true;
      })
      .forEach((doc) => {
        const regId = doc.regionId || "HEAD_OFFICE";
        const regName =
          regions.find((r) => r.id === regId)?.name || "KANTOR PUSAT";

        if (!regionMap[regId]) {
          regionMap[regId] = {
            regionName: regName,
            totalPiutang: 0,
            totalLunas: 0,
            sisaPiutang: 0,
            outlets: {},
          };
        }

        const sisa = (doc.totalAmount || 0) - (doc.paidAmount || 0);
        regionMap[regId].totalPiutang += doc.totalAmount || 0;
        regionMap[regId].totalLunas += doc.paidAmount || 0;
        regionMap[regId].sisaPiutang += sisa;

        const outId = doc.outletId || "OUT_UNKNOWN";
        const outName =
          outlets.find((o) => o.id === outId)?.name || "Cabang Outlet";

        if (!regionMap[regId].outlets[outId]) {
          regionMap[regId].outlets[outId] = {
            outletName: outName,
            sisaPiutang: 0,
            invoices: [],
          };
        }
        regionMap[regId].outlets[outId].sisaPiutang += sisa;
        regionMap[regId].outlets[outId].invoices.push(doc);
      });

    return regionMap;
  }, [receivingDocs, regions, outlets, filters]);

  // Akumulasi Total Global
  const totalExternalDebtGlobal = useMemo(() => {
    return Object.values(debtGrouped).reduce(
      (sum, r) => sum + r.sisaHutangEksternal,
      0,
    );
  }, [debtGrouped]);

  const totalInternalDebtGlobal = useMemo(() => {
    return Object.values(debtGrouped).reduce(
      (sum, r) => sum + r.sisaHutangInternal,
      0,
    );
  }, [debtGrouped]);

  const totalReceivableGlobal = useMemo(() => {
    return Object.values(receivableGrouped).reduce(
      (sum, r) => sum + r.sisaPiutang,
      0,
    );
  }, [receivableGrouped]);

  // =========================================================================
  // TEMA BARU: Light mode = gaya B (phone dark saat ini), Dark mode = D (tetap)
  // =========================================================================
  const theme = isDark
    ? {
        // Dark mode (D) - tidak diubah
        toolbarBg: "bg-slate-900/80 border-slate-800",
        cardBg: "bg-slate-900/90 border-slate-800",
        regionHeaderBg: "bg-slate-800/50 hover:bg-slate-800/80",
        entityHeaderBg: "bg-slate-800/20 hover:bg-slate-800/40",
        subCardBg: "bg-slate-950/70",
        vendorCardBg: "bg-slate-900/60",
        textPrimary: "text-white",
        textSecondary: "text-slate-400",
        textMuted: "text-slate-500",
        borderDivider: "border-slate-800",
        borderSubtle: "border-slate-800/80",
        selectBg: "bg-slate-950 border-slate-800 text-white",
        hoverBg: "hover:bg-slate-800/30",
        eyeBtn: "text-slate-400 hover:text-white bg-slate-800",
        internalBg: "border-blue-950/40 bg-blue-950/20",
        internalText: "text-blue-300",
      }
    : {
        // Light mode (B) - diambil dari phone dark mode yang nyaman
        toolbarBg: "bg-black/40 border-white/10",
        cardBg: "bg-black/40 border-white/10",
        regionHeaderBg: "bg-white/10 hover:bg-white/20",
        entityHeaderBg: "bg-white/5 hover:bg-white/10",
        subCardBg: "bg-black/20",
        vendorCardBg: "bg-black/30",
        textPrimary: "text-white",
        textSecondary: "text-white/60",
        textMuted: "text-white/40",
        borderDivider: "border-white/10",
        borderSubtle: "border-white/10",
        selectBg: "bg-black/40 border-white/10 text-white",
        hoverBg: "hover:bg-white/10",
        eyeBtn: "text-white/60 hover:text-white bg-white/10",
        internalBg: "border-white/10 bg-white/5",
        internalText: "text-blue-300",
      };

  return (
    <div className="space-y-5">
      {selectedInvoice && (
        <InvoiceDetailModal
          doc={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {/* TOOLBAR FILTER & STATUS SCOPING */}
      <div
        className={`flex items-center justify-between p-4 rounded-2xl border flex-wrap gap-3 ${theme.toolbarBg}`}
      >
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 font-bold text-xs flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>
              MODE KONSOLIDASI:{" "}
              {isHoldingLevel
                ? "HOLDING (ELIMINASI INTERN AKTIF)"
                : isRegionLevel
                  ? "AREA REGIONAL"
                  : "STANDALONE CABANG"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-orange-500" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={`${theme.selectBg} border text-xs font-bold rounded-lg p-1.5 outline-none`}
          >
            <option value="TERBESAR">Urutkan Sisa Terbesar</option>
            <option value="TERLAMA">Urutkan Jatuh Tempo Terlama</option>
          </select>
        </div>
      </div>

      {/* 2 PANEL UTAMA: HUTANG & PIUTANG */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* PANEL KIRI: HUTANG USAHA */}
        <div
          className={`p-5 rounded-3xl border space-y-4 shadow-xl ${theme.cardBg}`}
        >
          <div
            className={`flex items-center justify-between border-b pb-3 ${theme.borderDivider}`}
          >
            <div>
              <span className="font-black text-sm uppercase tracking-wide text-rose-400 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> 1. POSISI KEWAJIBAN & HUTANG
              </span>
              <p className={`text-[10px] mt-0.5 ${theme.textSecondary}`}>
                {isHoldingLevel
                  ? "Murni Tagihan Vendor Pihak Ke-3 (Hutang Antar-Unit Dieliminasi)"
                  : "Kewajiban Tagihan ke Vendor & Internal"}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`text-[9px] font-black uppercase ${theme.textMuted} block`}
              >
                Total Sisa Hutang:
              </span>
              <span className="font-mono font-black text-sm text-rose-400">
                Rp{" "}
                {(isHoldingLevel
                  ? totalExternalDebtGlobal
                  : totalExternalDebtGlobal + totalInternalDebtGlobal
                ).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(debtGrouped).map(([regId, regData]) => {
              const isRegOpen = expandedRegions[regId] !== false;
              const hasExternal =
                Object.keys(regData.externalVendors).length > 0;
              const hasInternal =
                Object.keys(regData.internalWarehouses).length > 0;

              return (
                <div
                  key={regId}
                  className={`border rounded-2xl overflow-hidden ${theme.subCardBg}`}
                >
                  <div
                    onClick={() => toggleRegion(regId)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer select-none transition ${theme.regionHeaderBg}`}
                  >
                    <div className="flex items-center gap-2.5">
                      {isRegOpen ? (
                        <ChevronDown className="w-4 h-4 text-orange-500" />
                      ) : (
                        <ChevronRight
                          className={`w-4 h-4 ${theme.textMuted}`}
                        />
                      )}
                      <Building2 className={`w-4 h-4 ${theme.textSecondary}`} />
                      <span
                        className={`font-black text-xs ${theme.textPrimary}`}
                      >
                        {regData.regionName}
                      </span>
                    </div>
                    <div className="text-right font-mono font-black text-xs text-rose-400">
                      Rp{" "}
                      {(isHoldingLevel
                        ? regData.sisaHutangEksternal
                        : regData.sisaHutangEksternal +
                          regData.sisaHutangInternal
                      ).toLocaleString()}
                    </div>
                  </div>

                  {isRegOpen && (
                    <div className="p-3 space-y-3">
                      {hasExternal && (
                        <div className="space-y-1.5">
                          <span
                            className={`text-[9px] font-black uppercase ${theme.textMuted} tracking-wider block`}
                          >
                            VENDOR EKSTERNAL (PIHAK KE-3):
                          </span>
                          {Object.entries(regData.externalVendors).map(
                            ([vendId, vData]) => {
                              const isVendOpen =
                                expandedEntities[vendId] !== false;
                              return (
                                <div
                                  key={vendId}
                                  className={`border rounded-xl overflow-hidden ${theme.borderSubtle} ${theme.vendorCardBg}`}
                                >
                                  <div
                                    onClick={() => toggleEntity(vendId)}
                                    className={`p-2.5 flex items-center justify-between cursor-pointer text-xs ${theme.entityHeaderBg}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Truck className="w-3.5 h-3.5 text-orange-500" />
                                      <span
                                        className={`font-bold ${theme.textPrimary}`}
                                      >
                                        {vData.vendorName}
                                      </span>
                                      <span
                                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${isDark ? "bg-slate-800 text-slate-400" : "bg-white/10 text-white/60"}`}
                                      >
                                        {vData.invoices.length} Nota
                                      </span>
                                    </div>
                                    <span className="font-mono font-black text-rose-400">
                                      Rp {vData.sisaHutang.toLocaleString()}
                                    </span>
                                  </div>

                                  {isVendOpen && (
                                    <div
                                      className={`divide-y p-2 space-y-1 ${theme.borderDivider}`}
                                    >
                                      {vData.invoices.map((inv: any) => (
                                        <div
                                          key={inv.id}
                                          className={`flex items-center justify-between text-xs py-1.5 px-2 rounded ${theme.hoverBg}`}
                                        >
                                          <div>
                                            <span
                                              className={`font-mono font-bold block ${theme.textPrimary}`}
                                            >
                                              {inv.invoiceNumber}
                                            </span>
                                            <span
                                              className={`text-[9px] ${theme.textSecondary}`}
                                            >
                                              Tgl:{" "}
                                              {new Date(
                                                inv.date,
                                              ).toLocaleDateString(
                                                "id-ID",
                                              )}{" "}
                                              | Tempo:{" "}
                                              {inv.dueDate
                                                ? new Date(
                                                    inv.dueDate,
                                                  ).toLocaleDateString("id-ID")
                                                : "CASH"}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono font-black text-rose-400">
                                              Rp{" "}
                                              {(
                                                inv.totalAmount - inv.paidAmount
                                              ).toLocaleString()}
                                            </span>
                                            <button
                                              onClick={() =>
                                                setSelectedInvoice(inv)
                                              }
                                              className={`p-1 rounded cursor-pointer ${theme.eyeBtn}`}
                                              title="Lihat Detail Rincian Item"
                                            >
                                              <Eye className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      )}

                      {!isHoldingLevel && hasInternal && (
                        <div
                          className={`space-y-1.5 pt-2 border-t ${theme.borderDivider}`}
                        >
                          <span className="text-[9px] font-black uppercase text-blue-400 tracking-wider block items-center gap-1">
                            <ArrowRightLeft className="w-3 h-3" /> TAGIHAN
                            GUDANG PUSAT (INTERNAL CABANG):
                          </span>
                          {Object.entries(regData.internalWarehouses).map(
                            ([wKey, wData]) => (
                              <div
                                key={wKey}
                                className={`border rounded-xl p-2.5 flex items-center justify-between text-xs ${theme.internalBg}`}
                              >
                                <span
                                  className={`font-bold ${theme.internalText}`}
                                >
                                  {wData.warehouseName}
                                </span>
                                <span
                                  className={`font-mono font-black ${theme.internalText}`}
                                >
                                  Rp {wData.sisaHutang.toLocaleString()}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL KANAN: PIUTANG USAHA */}
        <div
          className={`p-5 rounded-3xl border space-y-4 shadow-xl ${theme.cardBg}`}
        >
          <div
            className={`flex items-center justify-between border-b pb-3 ${theme.borderDivider}`}
          >
            <div>
              <span className="font-black text-sm uppercase tracking-wide text-blue-400 flex items-center gap-2">
                <Store className="w-4 h-4" /> 2. POSISI PIUTANG USAHA &
                DISTRIBUSI
              </span>
              <p className={`text-[10px] mt-0.5 ${theme.textSecondary}`}>
                Tagihan Berjalan Gudang Pusat ke Cabang-Cabang Operasional
              </p>
            </div>
            <div className="text-right">
              <span
                className={`text-[9px] font-black uppercase ${theme.textMuted} block`}
              >
                Total Sisa Piutang:
              </span>
              <span className="font-mono font-black text-sm text-blue-400">
                Rp {totalReceivableGlobal.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(receivableGrouped).map(([regId, regData]) => {
              const isRegOpen = expandedRegions[`PIU_${regId}`] !== false;

              return (
                <div
                  key={regId}
                  className={`border rounded-2xl overflow-hidden ${theme.subCardBg}`}
                >
                  <div
                    onClick={() => toggleRegion(`PIU_${regId}`)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer select-none transition ${theme.regionHeaderBg}`}
                  >
                    <div className="flex items-center gap-2.5">
                      {isRegOpen ? (
                        <ChevronDown className="w-4 h-4 text-blue-500" />
                      ) : (
                        <ChevronRight
                          className={`w-4 h-4 ${theme.textMuted}`}
                        />
                      )}
                      <Building2 className={`w-4 h-4 ${theme.textSecondary}`} />
                      <span
                        className={`font-black text-xs ${theme.textPrimary}`}
                      >
                        {regData.regionName}
                      </span>
                    </div>
                    <div className="text-right font-mono font-black text-xs text-blue-400">
                      Rp {regData.sisaPiutang.toLocaleString()}
                    </div>
                  </div>

                  {isRegOpen && (
                    <div className="p-3 space-y-2">
                      {Object.entries(regData.outlets).map(([outId, oData]) => {
                        const isOutOpen =
                          expandedEntities[`PIU_${outId}`] !== false;
                        return (
                          <div
                            key={outId}
                            className={`border rounded-xl overflow-hidden ${theme.borderSubtle} ${theme.vendorCardBg}`}
                          >
                            <div
                              onClick={() => toggleEntity(`PIU_${outId}`)}
                              className={`p-2.5 flex items-center justify-between cursor-pointer text-xs ${theme.entityHeaderBg}`}
                            >
                              <div className="flex items-center gap-2">
                                <Store className="w-3.5 h-3.5 text-blue-500" />
                                <span
                                  className={`font-bold ${theme.textPrimary}`}
                                >
                                  {oData.outletName}
                                </span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${isDark ? "bg-slate-800 text-slate-400" : "bg-white/10 text-white/60"}`}
                                >
                                  {oData.invoices.length} Nota
                                </span>
                              </div>
                              <span className="font-mono font-black text-blue-400">
                                Rp {oData.sisaPiutang.toLocaleString()}
                              </span>
                            </div>

                            {isOutOpen && (
                              <div
                                className={`divide-y p-2 space-y-1 ${theme.borderDivider}`}
                              >
                                {oData.invoices.map((inv: any) => (
                                  <div
                                    key={inv.id}
                                    className={`flex items-center justify-between text-xs py-1.5 px-2 rounded ${theme.hoverBg}`}
                                  >
                                    <div>
                                      <span
                                        className={`font-mono font-bold block ${theme.textPrimary}`}
                                      >
                                        {inv.invoiceNumber}
                                      </span>
                                      <span
                                        className={`text-[9px] ${theme.textSecondary}`}
                                      >
                                        Tgl:{" "}
                                        {new Date(inv.date).toLocaleDateString(
                                          "id-ID",
                                        )}{" "}
                                        | Tempo:{" "}
                                        {inv.dueDate
                                          ? new Date(
                                              inv.dueDate,
                                            ).toLocaleDateString("id-ID")
                                          : "CASH"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-black text-blue-400">
                                        Rp{" "}
                                        {(
                                          inv.totalAmount - inv.paidAmount
                                        ).toLocaleString()}
                                      </span>
                                      <button
                                        onClick={() => setSelectedInvoice(inv)}
                                        className={`p-1 rounded cursor-pointer ${theme.eyeBtn}`}
                                        title="Lihat Detail Rincian Item"
                                      >
                                        <Eye className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
