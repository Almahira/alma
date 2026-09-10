// File: apps/client_unv/src/executive-dashboard/desktop_dashboard.tsx
import React, { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Target,
  ArrowRightLeft,
  Handshake,
  Building2,
  Calendar,
  RotateCw,
  Sun,
  Moon,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  Percent,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DebtReceivableView } from "./components/DebtReceivableView";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useNavigate } from "react-router-dom";

/* ------------------------------------------------------------------ */
/*  KOMPONEN CARD EKSEKUTIF: SMOKED OBSIDIAN GLASS                    */
/* ------------------------------------------------------------------ */
const ExecutiveCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  isDark?: boolean;
  highlight?: "gold" | "emerald" | "rose" | "none";
}> = ({ children, className = "", isDark = true, highlight = "none" }) => {
  const borderHighlight =
    highlight === "gold"
      ? "border-amber-500/40 shadow-[0_0_25px_rgba(217,119,6,0.15)]"
      : highlight === "emerald"
        ? "border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.15)]"
        : highlight === "rose"
          ? "border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.15)]"
          : isDark
            ? "border-white/[0.08] hover:border-white/[0.15]"
            : "border-slate-200 hover:border-slate-300";

  const bgStyle = isDark
    ? "bg-gradient-to-b from-[#131B2A]/90 to-[#0B0F17]/95 backdrop-blur-2xl"
    : "bg-white/95 backdrop-blur-xl shadow-lg";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${borderHighlight} ${bgStyle} ${className}`}
    >
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  KOMPONEN UTAMA DASHBOARD EKSEKUTIF                                 */
/* ------------------------------------------------------------------ */
export const DesktopDashboard: React.FC<{
  data: any;
  filters: any;
  setFilters: React.Dispatch<React.SetStateAction<any>>;
  regions: any[];
  outlets: any[];
  receivingDocs: any[];
  vendors: any[];
  isLiveSyncing?: boolean;
  lastSyncTime?: string;
  onManualSync?: () => void;
}> = ({
  data,
  filters,
  setFilters,
  regions,
  outlets,
  receivingDocs,
  vendors,
  isLiveSyncing = false,
  lastSyncTime = "",
  onManualSync,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "PL_WATERFALL" | "DEBT_RECEIVABLE"
  >("PL_WATERFALL");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    cogs: false,
    pendukung: false,
    owner: false,
  });
  const [expandedPendukungCat, setExpandedPendukungCat] = useState<
    Record<string, boolean>
  >({});
  const [isDark, setIsDark] = useState(true);

  const toggleSec = (key: string) =>
    setExpandedSections((p) => ({ ...p, [key]: !p[key] }));
  const togglePendukung = (key: string) =>
    setExpandedPendukungCat((p) => ({ ...p, [key]: !p[key] }));

  const netSalesNominal = data.revenue.netSales || 0;

  const formatPct = (nom: number) => {
    if (!netSalesNominal || netSalesNominal <= 0) return "0,0%";
    return `${((nom / netSalesNominal) * 100).toFixed(1).replace(".", ",")}%`;
  };

  const chartData = useMemo(() => {
    return (data.outletPerformance || []).map((o: any) => ({
      name: o.outletName,
      netSales: o.netSales,
    }));
  }, [data.outletPerformance]);

  // Palet Warna Dewasa & Elegan
  const bgCanvas = isDark
    ? "bg-[#080C14] text-slate-100"
    : "bg-slate-100 text-slate-900";

  const subText = isDark ? "text-slate-400" : "text-slate-500";
  const cardSubBg = isDark ? "bg-white/[0.03]" : "bg-slate-50";

  return (
    <div
      className={`h-dvh flex flex-col font-sans overflow-hidden ${bgCanvas}`}
    >
      {/* ===================================================================== */}
      {/* 1. TOP EXECUTIVE APP BAR                                              */}
      {/* ===================================================================== */}
      <header className="px-6 py-3 border-b border-white/8 shrink-0 bg-[#0B101B]/80 backdrop-blur-xl flex items-center justify-between gap-4 z-20">
        {/* Sisi Kiri: Branding & Navigasi Cepat */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/app")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold tracking-wide transition cursor-pointer text-slate-200"
            title="Kembali ke Ruang Kerja Kasir / ERP"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                EXECUTIVE OWNER SUITE
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                HOLDING LEVEL
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-400">
              Konsolidasi Arus Kas Bersih &amp; Profitabilitas Pemilik Usaha
            </p>
          </div>
        </div>

        {/* Sisi Kanan: Kontrol Filter & Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Sinkronisasi Real-Time */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/3 text-[10px] font-mono text-slate-300">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isLiveSyncing ? "bg-amber-400" : "bg-emerald-400"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                  isLiveSyncing ? "bg-amber-400" : "bg-emerald-400"
                }`}
              />
            </span>
            <span>
              {isLiveSyncing ? "Syncing..." : lastSyncTime || "Realtime"}
            </span>
            {onManualSync && (
              <button
                onClick={onManualSync}
                disabled={isLiveSyncing}
                className="p-0.5 text-slate-400 hover:text-white transition cursor-pointer"
                title="Sinkronkan Data Sekarang"
              >
                <RotateCw
                  className={`w-3 h-3 ${isLiveSyncing ? "animate-spin text-amber-400" : ""}`}
                />
              </button>
            )}
          </div>

          {/* Filter Region */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/3 text-xs font-semibold">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={filters.regionId}
              onChange={(e) =>
                setFilters((p: any) => ({
                  ...p,
                  regionId: e.target.value,
                  outletId: "",
                }))
              }
              className="bg-transparent text-xs font-semibold outline-none cursor-pointer text-slate-200"
            >
              <option value="" className="bg-[#0F172A] text-slate-200">
                Semua Wilayah
              </option>
              {regions.map((r) => (
                <option
                  key={r.id}
                  value={r.id}
                  className="bg-[#0F172A] text-slate-200"
                >
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Outlet */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/3 text-xs font-semibold">
            <select
              value={filters.outletId}
              onChange={(e) =>
                setFilters((p: any) => ({ ...p, outletId: e.target.value }))
              }
              className="bg-transparent text-xs font-semibold outline-none cursor-pointer text-slate-200"
            >
              <option value="" className="bg-[#0F172A] text-slate-200">
                Semua Cabang
              </option>
              {outlets
                .filter(
                  (o) => !filters.regionId || o.regionId === filters.regionId,
                )
                .map((o) => (
                  <option
                    key={o.id}
                    value={o.id}
                    className="bg-[#0F172A] text-slate-200"
                  >
                    {o.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Filter Bulan */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/3 text-xs font-semibold">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <input
              type="month"
              value={filters.month}
              onChange={(e) =>
                setFilters((p: any) => ({ ...p, month: e.target.value }))
              }
              className="bg-transparent text-xs font-mono font-bold outline-none cursor-pointer text-slate-200"
            />
          </div>

          {/* Tab Utama: P&L vs Hutang Piutang */}
          <div className="flex items-center rounded-lg border border-white/10 bg-black/40 p-0.5">
            <button
              onClick={() => setActiveTab("PL_WATERFALL")}
              className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                activeTab === "PL_WATERFALL"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Laba Rugi (P&amp;L)
            </button>
            <button
              onClick={() => setActiveTab("DEBT_RECEIVABLE")}
              className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                activeTab === "DEBT_RECEIVABLE"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Hutang &amp; Piutang
            </button>
          </div>

          {/* Toggle Light / Dark */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-1.5 rounded-lg border border-white/10 bg-white/3 text-slate-400 hover:text-amber-300 transition cursor-pointer"
            title="Ganti Tema"
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 2. HERO KPI CARDS: 3 PILAR UTAMA FINANSIAL OWNER                      */}
      {/* ===================================================================== */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 bg-linear-to-b from-[#0B101B]/60 to-transparent">
        {/* PILAR 1: OMSET BERSIH */}
        <ExecutiveCard isDark={isDark} className="p-4" highlight="gold">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                1. OMSET BERSIH (NET REVENUE)
              </span>
              <div className="text-2xl font-black font-mono tracking-tight text-white mt-1">
                Rp {data.revenue.netSales.toLocaleString()}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-white/6 flex items-center justify-between text-[11px] text-slate-400">
            <span>Gross: Rp {data.revenue.grossSales.toLocaleString()}</span>
            <span className="text-rose-400">
              Diskon: -Rp {data.revenue.discount.toLocaleString()}
            </span>
          </div>
        </ExecutiveCard>

        {/* PILAR 2: UNTUNG RESTO (GOP) */}
        <ExecutiveCard isDark={isDark} className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                2. UNTUNG RESTORAN (GOP OPERASIONAL)
              </span>
              <div className="text-2xl font-black font-mono tracking-tight text-amber-300 mt-1">
                Rp {data.gop.grossOperatingProfit.toLocaleString()}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-white/6 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Marjin Restoran:</span>
            <span className="font-mono font-bold text-amber-300">
              {data.gop.gopPercentage}% dari Penjualan
            </span>
          </div>
        </ExecutiveCard>

        {/* PILAR 3: SISA LABA BERSIH OWNER */}
        <ExecutiveCard
          isDark={isDark}
          className="p-4"
          highlight={data.finalProfit.isNomplok ? "rose" : "emerald"}
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                3. SISA UANG BERSIH PEMILIK (NET RETAINED)
              </span>
              <div
                className={`text-2xl font-black font-mono tracking-tight mt-1 ${
                  data.finalProfit.isNomplok
                    ? "text-rose-400"
                    : "text-emerald-400"
                }`}
              >
                Rp {data.finalProfit.finalProfitOwner.toLocaleString()}
              </div>
            </div>
            <div
              className={`p-2 rounded-xl border ${
                data.finalProfit.isNomplok
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              }`}
            >
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-white/6 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Status Kas Bersih:</span>
            <span
              className={`font-bold font-mono ${
                data.finalProfit.isNomplok
                  ? "text-rose-400"
                  : "text-emerald-400"
              }`}
            >
              {data.finalProfit.isNomplok
                ? "DEFISIT OPERASIONAL"
                : `${data.finalProfit.finalProfitPercentage}% Siap Disimpan`}
            </span>
          </div>
        </ExecutiveCard>
      </div>

      {/* ===================================================================== */}
      {/* 3. KONTEN UTAMA DASHBOARD                                             */}
      {/* ===================================================================== */}
      <main className="flex-1 px-6 pb-6 overflow-y-auto custom-scrollbar">
        {activeTab === "PL_WATERFALL" ? (
          <div className="grid grid-cols-12 gap-5">
            {/* ------------------------------------------------------------- */}
            {/* KOLOM KIRI (7/12): WATERFALL ALIRAN KAS INTUITIF              */}
            {/* ------------------------------------------------------------- */}
            <div className="col-span-12 lg:col-span-7 space-y-4">
              <ExecutiveCard isDark={isDark} className="p-5">
                {/* Header Section */}
                <div className="flex items-center justify-between pb-3 border-b border-white/8 mb-4">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      STRUKTUR PENYUSUTAN ARUS KAS DARI OMSET (WATERFALL)
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Bagaimana omset Anda terdistribusi ke bahan baku, toko,
                      dan laba
                    </p>
                  </div>
                  {/* Pilihan Posisi Deviden & Pajak */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setFilters((p: any) => ({
                          ...p,
                          devidenPosition:
                            p.devidenPosition === "TOP_NET_SALES"
                              ? "BOTTOM_OWNER"
                              : "TOP_NET_SALES",
                        }))
                      }
                      className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[10px] font-bold text-slate-300 hover:text-white transition flex items-center gap-1"
                    >
                      <ArrowRightLeft className="w-3 h-3 text-amber-400" />
                      <span>
                        {filters.devidenPosition === "TOP_NET_SALES"
                          ? "Sharing: Potong Omset (Atas)"
                          : "Sharing: Potong Laba (Bawah)"}
                      </span>
                    </button>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-slate-300 cursor-pointer px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                      <input
                        type="checkbox"
                        checked={filters.showTaxService}
                        onChange={(e) =>
                          setFilters((p: any) => ({
                            ...p,
                            showTaxService: e.target.checked,
                          }))
                        }
                        className="rounded border-white/20 accent-amber-500"
                      />
                      <span>Pajak &amp; Servis</span>
                    </label>
                  </div>
                </div>

                {/* VISUAL MINI-WATERFALL BAR (Untuk Pemilik Tanpa Background Akuntansi) */}
                <div className="mb-5 p-3 rounded-xl bg-black/40 border border-white/6 space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>Proporsi Penyerapan Omset (100%):</span>
                    <span className="font-mono text-amber-300">
                      Rp {data.revenue.netSales.toLocaleString()}
                    </span>
                  </div>
                  {/* Multi-Segment Proportion Bar */}
                  <div className="h-3.5 w-full rounded-full bg-slate-800 overflow-hidden flex">
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          (data.cogs.totalBelanjaDapur /
                            (netSalesNominal || 1)) *
                            100,
                        )}%`,
                      }}
                      className="h-full bg-rose-500/80 transition-all"
                      title={`Bahan Dapur (CoGS): ${formatPct(data.cogs.totalBelanjaDapur)}`}
                    />
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          (data.pendukung.totalBelanjaPendukung /
                            (netSalesNominal || 1)) *
                            100,
                        )}%`,
                      }}
                      className="h-full bg-orange-500/80 transition-all"
                      title={`Operasional & OPEX: ${formatPct(
                        data.pendukung.totalBelanjaPendukung,
                      )}`}
                    />
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          (data.payroll.realisasiGaji /
                            (netSalesNominal || 1)) *
                            100,
                        )}%`,
                      }}
                      className="h-full bg-amber-500/80 transition-all"
                      title={`Gaji Karyawan: ${formatPct(data.payroll.realisasiGaji)}`}
                    />
                    <div
                      style={{
                        width: `${Math.max(
                          0,
                          (data.gop.grossOperatingProfit /
                            (netSalesNominal || 1)) *
                            100,
                        )}%`,
                      }}
                      className="h-full bg-emerald-500/90 transition-all"
                      title={`Laba Resto (GOP): ${data.gop.gopPercentage}%`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 pt-1 flex-wrap gap-2">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />{" "}
                      Dapur (CoGS): {formatPct(data.cogs.totalBelanjaDapur)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />{" "}
                      OPEX Toko:{" "}
                      {formatPct(data.pendukung.totalBelanjaPendukung)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />{" "}
                      Gaji Toko: {formatPct(data.payroll.realisasiGaji)}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400 font-black">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />{" "}
                      Laba Resto: {data.gop.gopPercentage}%
                    </span>
                  </div>
                </div>

                {/* DAFTAR POS ARUS KAS (ACCORDION BERSIH) */}
                <div className="space-y-2 text-xs">
                  {/* 1. OMSET DASAR */}
                  <div className="p-3 rounded-xl bg-white/2 border border-white/6 space-y-1">
                    <div className="flex justify-between items-center font-bold text-slate-200">
                      <span>1. PENJUALAN KOTOR (GROSS SALES)</span>
                      <span className="font-mono">
                        Rp {data.revenue.grossSales.toLocaleString()}
                      </span>
                    </div>
                    {data.revenue.discount > 0 && (
                      <div className="flex justify-between items-center text-[11px] text-rose-400 pl-3">
                        <span>Potongan Diskon Penjualan</span>
                        <span className="font-mono">
                          - Rp {data.revenue.discount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center font-black text-amber-300 pt-1 border-t border-white/4">
                      <span>= OMSET BERSIH (NETT SALES)</span>
                      <span className="font-mono">
                        Rp {data.revenue.netSales.toLocaleString()} (100%)
                      </span>
                    </div>
                  </div>

                  {/* SALES SHARING (JIKA DI ATAS) */}
                  {filters.devidenPosition === "TOP_NET_SALES" &&
                    data.salesSharing.amount > 0 && (
                      <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex justify-between items-center font-bold text-amber-300">
                        <span className="flex items-center gap-1.5">
                          <Handshake className="w-3.5 h-3.5" />
                          Sales Sharing ({data.salesSharing.recipientName})
                        </span>
                        <span className="font-mono">
                          - Rp {data.salesSharing.amount.toLocaleString()} (
                          {formatPct(data.salesSharing.amount)})
                        </span>
                      </div>
                    )}

                  {/* 2. BELANJA DAPUR (CoGS) */}
                  <div className="rounded-xl bg-white/2 border border-white/6 overflow-hidden">
                    <div
                      onClick={() => toggleSec("cogs")}
                      className="p-3 flex justify-between items-center cursor-pointer hover:bg-white/4 transition select-none"
                    >
                      <div className="flex items-center gap-2 font-bold text-slate-200">
                        {expandedSections.cogs ? (
                          <ChevronDown className="w-4 h-4 text-amber-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                        <span>2. BELANJA DAPUR (CoGS BAHAN BAKU)</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono font-bold text-rose-400">
                        <span>
                          - Rp {data.cogs.totalBelanjaDapur.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 w-12 text-right">
                          {formatPct(data.cogs.totalBelanjaDapur)}
                        </span>
                      </div>
                    </div>
                    {expandedSections.cogs && (
                      <div className="px-4 pb-3 pt-1 border-t border-white/4 space-y-1.5 text-[11px] text-slate-400">
                        <div className="flex justify-between">
                          <span>Bahan Makanan (Food Cost)</span>
                          <span className="font-mono">
                            Rp {data.cogs.foodCost.toLocaleString()} (
                            {formatPct(data.cogs.foodCost)})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bahan Minuman (Beverage Cost)</span>
                          <span className="font-mono">
                            Rp {data.cogs.beverageCost.toLocaleString()} (
                            {formatPct(data.cogs.beverageCost)})
                          </span>
                        </div>
                        <div className="flex justify-between text-rose-400">
                          <span>Kerugian Bahan (Spoil &amp; Rusak)</span>
                          <span className="font-mono">
                            Rp {data.cogs.spoilLoss.toLocaleString()} (
                            {formatPct(data.cogs.spoilLoss)})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. BIAYA PENDUKUNG TOKO (OPEX) */}
                  <div className="rounded-xl bg-white/2 border border-white/6 overflow-hidden">
                    <div
                      onClick={() => toggleSec("pendukung")}
                      className="p-3 flex justify-between items-center cursor-pointer hover:bg-white/4 transition select-none"
                    >
                      <div className="flex items-center gap-2 font-bold text-slate-200">
                        {expandedSections.pendukung ? (
                          <ChevronDown className="w-4 h-4 text-amber-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                        <span>3. OPERASIONAL TOKO (OPEX &amp; LOGISTIK)</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono font-bold text-rose-400">
                        <span>
                          - Rp{" "}
                          {data.pendukung.totalBelanjaPendukung.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 w-12 text-right">
                          {formatPct(data.pendukung.totalBelanjaPendukung)}
                        </span>
                      </div>
                    </div>
                    {expandedSections.pendukung && (
                      <div className="px-4 pb-3 pt-1 border-t border-white/4 space-y-2 text-[11px] text-slate-400">
                        {Object.entries(data.pendukung.categories || {}).map(
                          ([catKey, cat]: any) => {
                            const isOpen = expandedPendukungCat[catKey];
                            return (
                              <div
                                key={catKey}
                                className="p-2 rounded-lg bg-white/2 border border-white/4"
                              >
                                <div
                                  onClick={() => togglePendukung(catKey)}
                                  className="flex justify-between items-center cursor-pointer hover:text-white"
                                >
                                  <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                                    {isOpen ? (
                                      <ChevronDown className="w-3 h-3 text-amber-400" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3 text-slate-500" />
                                    )}
                                    {cat.categoryName}
                                  </span>
                                  <span className="font-mono font-bold text-rose-400">
                                    Rp {cat.amount.toLocaleString()} (
                                    {formatPct(cat.amount)})
                                  </span>
                                </div>
                                {isOpen && (
                                  <div className="pl-4 pt-1.5 space-y-1 text-[10px] font-mono text-slate-400 border-t border-white/4 mt-1.5">
                                    {cat.items.map((it: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className="flex justify-between"
                                      >
                                        <span className="truncate max-w-60">
                                          {it.name} ({it.invoiceNumber || "-"})
                                        </span>
                                        <span>
                                          Rp {it.subtotal.toLocaleString()}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          },
                        )}
                        <div className="flex justify-between pt-1">
                          <span>Makan Karyawan (EDR)</span>
                          <span className="font-mono">
                            Rp {data.pendukung.employeeMeals.toLocaleString()} (
                            {formatPct(data.pendukung.employeeMeals)})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. GAJI & BIAYA BANK */}
                  <div className="p-3 rounded-xl bg-white/2 border border-white/6 space-y-1.5">
                    <div className="flex justify-between items-center font-bold text-slate-200">
                      <span>4. GAJI &amp; BIAYA BANK TOKO</span>
                      <span className="font-mono text-rose-400 font-bold">
                        - Rp{" "}
                        {(
                          data.payroll.realisasiGaji + data.payroll.bankFee
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400 pl-3">
                      <span>Realisasi Gaji Karyawan Toko</span>
                      <span className="font-mono">
                        Rp {data.payroll.realisasiGaji.toLocaleString()} (
                        {formatPct(data.payroll.realisasiGaji)})
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400 pl-3">
                      <span>
                        Biaya Transaksi EDC / QRIS (MDR{" "}
                        {data.payroll.bankFeePct}%)
                      </span>
                      <span className="font-mono">
                        Rp {data.payroll.bankFee.toLocaleString()} (
                        {formatPct(data.payroll.bankFee)})
                      </span>
                    </div>
                  </div>

                  {/* MILESTONE: UNTUNG RESTORAN (GOP) */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex justify-between items-center font-black">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-300">
                        = LABA KOTOR RESTORAN (GOP)
                      </span>
                    </div>
                    <div className="font-mono text-base text-amber-300">
                      Rp {data.gop.grossOperatingProfit.toLocaleString()} (
                      {data.gop.gopPercentage}%)
                    </div>
                  </div>

                  {/* 5. PENARIKAN OWNER & PROYEK */}
                  <div className="rounded-xl bg-white/2 border border-white/6 overflow-hidden">
                    <div
                      onClick={() => toggleSec("owner")}
                      className="p-3 flex justify-between items-center cursor-pointer hover:bg-white/4 transition select-none"
                    >
                      <div className="flex items-center gap-2 font-bold text-slate-200">
                        {expandedSections.owner ? (
                          <ChevronDown className="w-4 h-4 text-amber-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                        <span>5. PENARIKAN OWNER, PROYEK &amp; ALOKASI</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono font-bold text-rose-400">
                        <span>
                          - Rp{" "}
                          {data.ownerExpenses.totalOwnerExpenses.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500 w-12 text-right">
                          {formatPct(data.ownerExpenses.totalOwnerExpenses)}
                        </span>
                      </div>
                    </div>
                    {expandedSections.owner && (
                      <div className="px-4 pb-3 pt-1 border-t border-white/4 space-y-1.5 text-[11px] text-slate-400">
                        <div className="flex justify-between">
                          <span>Prive Pribadi Pemilik</span>
                          <span className="font-mono">
                            Rp {data.ownerExpenses.prive.toLocaleString()} (
                            {formatPct(data.ownerExpenses.prive)})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Gaji Manajemen Holding</span>
                          <span className="font-mono">
                            Rp {data.ownerExpenses.gajiHolding.toLocaleString()}{" "}
                            ({formatPct(data.ownerExpenses.gajiHolding)})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Saving Proyek &amp; Pengembangan</span>
                          <span className="font-mono">
                            Rp{" "}
                            {data.ownerExpenses.savingPengembangan.toLocaleString()}{" "}
                            ({formatPct(data.ownerExpenses.savingPengembangan)})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Alokasi Umroh (2%) &amp; THR (1%)</span>
                          <span className="font-mono">
                            Rp{" "}
                            {(
                              data.ownerExpenses.alokasiUmroh +
                              data.ownerExpenses.alokasiThr
                            ).toLocaleString()}{" "}
                            (3,0%)
                          </span>
                        </div>
                        {filters.devidenPosition === "BOTTOM_OWNER" &&
                          data.salesSharing.amount > 0 && (
                            <div className="flex justify-between text-amber-300 font-bold">
                              <span>
                                Deviden Mitra ({data.salesSharing.recipientName}
                                )
                              </span>
                              <span className="font-mono">
                                Rp {data.salesSharing.amount.toLocaleString()} (
                                {formatPct(data.salesSharing.amount)})
                              </span>
                            </div>
                          )}
                      </div>
                    )}
                  </div>

                  {/* HASIL AKHIR: SISA LABA BERSIH OWNER */}
                  <div
                    className={`p-4 rounded-xl border-2 flex justify-between items-center ${
                      data.finalProfit.isNomplok
                        ? "bg-rose-500/10 border-rose-500/50 text-rose-300"
                        : "bg-emerald-500/10 border-emerald-500/50 text-emerald-300"
                    }`}
                  >
                    <div>
                      <div className="font-black text-sm uppercase flex items-center gap-1.5">
                        {data.finalProfit.isNomplok ? (
                          <>
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                            <span>DEFISIT: PENARIKAN MELEBIHI LABA TOKO</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <span>
                              SISA KAS BERSIH DI TANGAN (RETAINED PROFIT)
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Dana bersih yang siap ditabung / tidak terpakai
                      </span>
                    </div>
                    <div className="text-right font-mono font-black text-lg">
                      Rp {data.finalProfit.finalProfitOwner.toLocaleString()}{" "}
                      <span className="text-xs font-bold">
                        ({data.finalProfit.finalProfitPercentage}%)
                      </span>
                    </div>
                  </div>
                </div>
              </ExecutiveCard>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* KOLOM KANAN (5/12): GRAFIK PERFORMA & RADAR ANGGARAN          */}
            {/* ------------------------------------------------------------- */}
            <div className="col-span-12 lg:col-span-5 space-y-4">
              {/* RADAR TARGET & BATAS ANGGARAN (TRAFFIC LIGHT SYSTEM) */}
              <ExecutiveCard isDark={isDark} className="p-5">
                <div className="flex items-center justify-between pb-3 border-b border-white/8 mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      INDIKATOR BATAS AMAN BIAYA (BUDGET)
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Bulan: {filters.month}
                  </span>
                </div>

                <div className="space-y-3.5">
                  {/* Target Omset */}
                  <div className="p-3 rounded-xl bg-white/2 border border-white/6 space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-300">
                        Pencapaian Target Penjualan:
                      </span>
                      <span className="font-mono text-amber-300">
                        {data.budgeting.salesAchievedPct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-linear-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, data.budgeting.salesAchievedPct)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>
                        Real: Rp {data.revenue.netSales.toLocaleString()}
                      </span>
                      <span>
                        Target: Rp{" "}
                        {(data.budgeting.targetSales || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Kuota Belanja Dapur */}
                  <div className="p-3 rounded-xl bg-white/2 border border-white/6 space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-300">
                        Batas Kuota Belanja Dapur:
                      </span>
                      <span
                        className={`font-mono ${
                          data.budgeting.cogsUsedPct > 100
                            ? "text-rose-400 font-black"
                            : "text-emerald-400 font-bold"
                        }`}
                      >
                        {data.budgeting.cogsUsedPct}%{" "}
                        {data.budgeting.cogsUsedPct > 100 ? "(OVER)" : "(AMAN)"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          data.budgeting.cogsUsedPct > 100
                            ? "bg-rose-500"
                            : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${Math.min(100, data.budgeting.cogsUsedPct)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>
                        Terpakai: Rp{" "}
                        {data.cogs.totalBelanjaDapur.toLocaleString()}
                      </span>
                      <span>
                        Plafon: Rp{" "}
                        {(data.budgeting.cogsLimit || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Kuota OPEX Pendukung */}
                  <div className="p-3 rounded-xl bg-white/2 border border-white/6 space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-300">
                        Batas Operasional Toko (OPEX):
                      </span>
                      <span
                        className={`font-mono ${
                          data.budgeting.opexUsedPct > 100
                            ? "text-rose-400 font-black"
                            : "text-emerald-400 font-bold"
                        }`}
                      >
                        {data.budgeting.opexUsedPct}%{" "}
                        {data.budgeting.opexUsedPct > 100 ? "(OVER)" : "(AMAN)"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          data.budgeting.opexUsedPct > 100
                            ? "bg-rose-500"
                            : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${Math.min(100, data.budgeting.opexUsedPct)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>
                        Terpakai: Rp{" "}
                        {data.pendukung.totalBelanjaPendukung.toLocaleString()}
                      </span>
                      <span>
                        Plafon: Rp{" "}
                        {(data.budgeting.opexLimit || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </ExecutiveCard>

              {/* PERFORMA OUTLET: CHART + RANKING */}
              <ExecutiveCard isDark={isDark} className="p-5">
                <div className="flex items-center justify-between pb-3 border-b border-white/8 mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                    PERFORMA OMSET ANTAR CABANG
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    Peringkat Kontribusi
                  </span>
                </div>

                {/* Area Chart yang Elegan & Halus */}
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="execGoldGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#F59E0B"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="95%"
                            stopColor="#F59E0B"
                            stopOpacity={0.0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="name"
                        stroke="#64748B"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#64748B"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${(v / 1000000).toFixed(0)}Jt`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0F172A",
                          borderColor: "rgba(255,255,255,0.1)",
                          borderRadius: "12px",
                          color: "#F8FAFC",
                          fontSize: "11px",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                        }}
                        formatter={(val: any) => [
                          `Rp ${Number(val || 0).toLocaleString()}`,
                          "Nett Sales",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="netSales"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        fill="url(#execGoldGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* List Ranking Cabang */}
                <div className="mt-3 space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                  {data.outletPerformance.map((out: any, idx: number) => {
                    const pctOfTotal =
                      netSalesNominal > 0
                        ? ((out.netSales / netSalesNominal) * 100).toFixed(1)
                        : "0";
                    return (
                      <div
                        key={out.outletId}
                        className="p-2 rounded-xl bg-white/2 border border-white/4 flex items-center justify-between text-xs hover:bg-white/5 transition"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                              idx === 0
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-200">
                            {out.outletName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-[10px] text-slate-400">
                            {pctOfTotal}%
                          </span>
                          <span className="font-black text-amber-300">
                            Rp {(out.netSales / 1000000).toFixed(1)} Jt
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ExecutiveCard>
            </div>
          </div>
        ) : (
          /* TAB 2: HUTANG & PIUTANG */
          <div className="pt-2">
            <DebtReceivableView
              receivingDocs={receivingDocs}
              regions={regions}
              outlets={outlets}
              vendors={vendors}
              isDark={isDark}
            />
          </div>
        )}
      </main>
    </div>
  );
};
