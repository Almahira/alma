// File: apps/client_unv/src/executive-dashboard/desktop_dashboard.tsx
import React, { useState, useRef } from "react";
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
} from "lucide-react";
import { motion } from "framer-motion";
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
/*  HOOK: Mouse position untuk efek highlight dinamis pada liquid glass */
/* ------------------------------------------------------------------ */
const useMousePosition = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  return { position, handleMouseMove };
};

/* ------------------------------------------------------------------ */
/*  TIPE PROPS UNTUK LIQUID GLASS                                      */
/* ------------------------------------------------------------------ */
interface LiquidGlassProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  idleFloat?: boolean;
  dark?: boolean;
}

/* ------------------------------------------------------------------ */
/*  KOMPONEN LIQUID GLASS (mendukung light & dark)                     */
/* ------------------------------------------------------------------ */
const LiquidGlass: React.FC<LiquidGlassProps> = ({
  children,
  className = "",
  style,
  onClick,
  idleFloat = false,
  dark = false,
}) => {
  const { position, handleMouseMove } = useMousePosition();
  const [isHovered, setIsHovered] = useState(false);

  // Warna background, border, dan shadow untuk light / dark
  const background = dark
    ? "rgba(30, 41, 59, 0.85)" // dark slate
    : "rgba(255, 255, 255, 0.85)";
  const borderColor = dark ? "rgba(148, 163, 184, 0.3)" : "rgba(0, 0, 0, 0.1)";
  const shadowHover = dark
    ? "0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(56,189,248,0.2), inset 0 0 20px rgba(148,163,184,0.1)"
    : "0 8px 32px rgba(0,0,0,0.08), 0 0 20px rgba(255,255,255,0.2), inset 0 0 20px rgba(255,255,255,0.3)";
  const shadowIdle = dark
    ? "0 4px 20px rgba(0,0,0,0.4), 0 0 10px rgba(56,189,248,0.1)"
    : "0 4px 20px rgba(0,0,0,0.05), 0 0 10px rgba(255,255,255,0.1)";
  const highlightColor = dark
    ? "rgba(255,255,255,0.15)"
    : "rgba(255,255,255,0.4)";

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 ${className}`}
      style={{
        background,
        borderColor,
        boxShadow: isHovered ? shadowHover : shadowIdle,
        ...style,
      }}
      whileHover={idleFloat ? undefined : { scale: 1.01 }}
      whileTap={idleFloat ? undefined : { scale: 0.99 }}
      animate={idleFloat ? { y: [0, -4, 0] } : undefined}
      transition={
        idleFloat
          ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
          : { type: "spring", stiffness: 300, damping: 20 }
      }
    >
      {/* Highlight dinamis mengikuti kursor */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `radial-gradient(circle at ${position.x}px ${position.y}px, ${highlightColor} 0%, transparent 70%)`,
          opacity: isHovered ? 1 : 0,
          transition: "opacity 0.3s",
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/*  KOMPONEN UTAMA DASHBOARD                                           */
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
  const [ripples, setRipples] = useState<
    { x: number; y: number; id: number }[]
  >([]);
  const logoRef = useRef<HTMLDivElement>(null);

  // State tema (default light)
  const [isDark, setIsDark] = useState(false);

  const toggleSec = (key: string) =>
    setExpandedSections((p) => ({ ...p, [key]: !p[key] }));
  const togglePendukung = (key: string) =>
    setExpandedPendukungCat((p) => ({ ...p, [key]: !p[key] }));

  const formatPct = (nom: number) => {
    if (!data.revenue.netSales || data.revenue.netSales <= 0) return "0,00%";
    return `${((nom / data.revenue.netSales) * 100).toFixed(2).replace(".", ",")}%`;
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    const rect = logoRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      setRipples((prev) => [...prev, { x, y, id }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);
    }
  };

  const chartData = data.outletPerformance.map((o: any) => ({
    name: o.outletName,
    netSales: o.netSales,
  }));

  /* ------------------------------------------------------------------ */
  /*  KELAS WARNA UTAMA BERDASARKAN TEMA                                 */
  /* ------------------------------------------------------------------ */
  const rootBg = isDark
    ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
    : "bg-gradient-to-br from-teal-400 via-cyan-500 to-blue-500";
  const primaryText = isDark ? "text-slate-100" : "text-slate-800";
  const secondaryText = isDark ? "text-slate-300" : "text-slate-600";
  const mutedText = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div
      className={`h-dvh flex flex-col ${rootBg} ${primaryText} font-sans overflow-hidden`}
    >
      {/* ===================================================================== */}
      {/* HEADER (30% tinggi viewport)                                        */}
      {/* ===================================================================== */}
      <div className="flex-none h-[23%] p-4 pb-2">
        <LiquidGlass
          className="h-full p-4 flex flex-col justify-between"
          dark={isDark}
        >
          {/* Baris atas: Logo + Judul + Toolkit + Toggle Utama + Toggle Tema */}
          <div className="flex items-center justify-between gap-3">
            {/* Kiri: Logo & Judul */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => navigate("/app")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase transition shadow-md cursor-pointer mr-1"
                title="Kembali ke Ruang Kerja Kasir / ERP"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Kembali ke ERP</span>
              </button>
              <motion.div
                ref={logoRef}
                onClick={handleLogoClick}
                className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center cursor-pointer relative overflow-hidden shadow-md"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <motion.span
                  className="text-white font-black text-xl select-none"
                  whileHover={{ rotateY: 360 }}
                  transition={{ duration: 0.8 }}
                >
                  Z
                </motion.span>
                {ripples.map((r) => (
                  <motion.span
                    key={r.id}
                    className="absolute rounded-full bg-white/60 pointer-events-none"
                    style={{
                      left: r.x - 20,
                      top: r.y - 20,
                      width: 40,
                      height: 40,
                    }}
                    initial={{ scale: 0, opacity: 0.8 }}
                    animate={{ scale: 4, opacity: 0 }}
                    transition={{ duration: 0.6 }}
                  />
                ))}
              </motion.div>

              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <h1
                    className={`text-base font-black tracking-tight ${isDark ? "text-white" : "text-slate-900"} uppercase`}
                  >
                    EXECUTIVE OWNER PORTAL
                  </h1>
                  <div
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full border shadow-sm ${isDark ? "bg-slate-700/70 border-slate-500/50" : "bg-white/70 border-slate-300/60"}`}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLiveSyncing ? "bg-amber-400" : "bg-emerald-500"}`}
                      ></span>
                      <span
                        className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isLiveSyncing ? "bg-amber-500" : "bg-emerald-600"}`}
                      ></span>
                    </span>
                    <span
                      className={`text-[9px] font-bold font-mono ${isDark ? "text-slate-200" : "text-slate-600"}`}
                    >
                      {isLiveSyncing
                        ? "Syncing..."
                        : `Live • ${lastSyncTime || "Realtime"}`}
                    </span>
                    {onManualSync && (
                      <button
                        onClick={onManualSync}
                        disabled={isLiveSyncing}
                        className={`p-0.5 rounded cursor-pointer transition disabled:opacity-50 ${isDark ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
                        title="Sinkronkan Sekarang"
                      >
                        <RotateCw
                          className={`w-3 h-3 ${isLiveSyncing ? "animate-spin text-orange-500" : ""}`}
                        />
                      </button>
                    )}
                  </div>
                </div>
                <p className={`text-[10px] font-semibold ${secondaryText}`}>
                  Laporan Arus Kas &amp; Profitabilitas Standar Eksekutif
                </p>
              </div>
            </div>

            {/* Kanan: Toolkit + Toggle Utama + Toggle Tema */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Toggle Tema */}
              <button
                onClick={() => setIsDark(!isDark)}
                className={`p-1.5 rounded-lg border shadow-sm transition cursor-pointer ${
                  isDark
                    ? "bg-slate-700 border-slate-500 text-amber-300 hover:bg-slate-600"
                    : "bg-white/60 border-slate-300/70 text-slate-600 hover:bg-white/80"
                }`}
                title={isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
              >
                {isDark ? (
                  <Sun className="w-3.5 h-3.5" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Region */}
              <div
                className={`flex items-center gap-1 border rounded-lg px-2 py-1 shadow-sm ${isDark ? "bg-slate-700/70 border-slate-500/50" : "bg-white/60 border-slate-300/70"}`}
              >
                <Building2 className="w-3 h-3 text-orange-500" />
                <select
                  value={filters.regionId}
                  onChange={(e) =>
                    setFilters((p: any) => ({
                      ...p,
                      regionId: e.target.value,
                      outletId: "",
                    }))
                  }
                  className={`bg-transparent text-[10px] font-bold outline-none cursor-pointer max-w-27.5 ${isDark ? "text-slate-100" : "text-slate-800"}`}
                >
                  <option
                    value=""
                    className={
                      isDark
                        ? "bg-slate-800 text-slate-100"
                        : "bg-white text-slate-800"
                    }
                  >
                    Semua Wilayah
                  </option>
                  {regions.map((r) => (
                    <option
                      key={r.id}
                      value={r.id}
                      className={
                        isDark
                          ? "bg-slate-800 text-slate-100"
                          : "bg-white text-slate-800"
                      }
                    >
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Outlet */}
              <div
                className={`flex items-center gap-1 border rounded-lg px-2 py-1 shadow-sm ${isDark ? "bg-slate-700/70 border-slate-500/50" : "bg-white/60 border-slate-300/70"}`}
              >
                <Building2 className="w-3 h-3 text-orange-500" />
                <select
                  value={filters.outletId}
                  onChange={(e) =>
                    setFilters((p: any) => ({ ...p, outletId: e.target.value }))
                  }
                  className={`bg-transparent text-[10px] font-bold outline-none cursor-pointer max-w-27.5 ${isDark ? "text-slate-100" : "text-slate-800"}`}
                >
                  <option
                    value=""
                    className={
                      isDark
                        ? "bg-slate-800 text-slate-100"
                        : "bg-white text-slate-800"
                    }
                  >
                    Semua Outlet
                  </option>
                  {outlets
                    .filter(
                      (o) =>
                        !filters.regionId || o.regionId === filters.regionId,
                    )
                    .map((o) => (
                      <option
                        key={o.id}
                        value={o.id}
                        className={
                          isDark
                            ? "bg-slate-800 text-slate-100"
                            : "bg-white text-slate-800"
                        }
                      >
                        {o.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Bulan */}
              <div
                className={`flex items-center gap-1 border rounded-lg px-2 py-1 shadow-sm ${isDark ? "bg-slate-700/70 border-slate-500/50" : "bg-white/60 border-slate-300/70"}`}
              >
                <Calendar className="w-3 h-3 text-orange-500" />
                <input
                  type="month"
                  value={filters.month}
                  onChange={(e) =>
                    setFilters((p: any) => ({ ...p, month: e.target.value }))
                  }
                  className={`bg-transparent text-[10px] font-bold outline-none font-mono cursor-pointer w-22.5 ${isDark ? "text-slate-100" : "text-slate-800"}`}
                />
              </div>

              {/* Toggle Deviden */}
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
                title={
                  filters.devidenPosition === "TOP_NET_SALES"
                    ? "Deviden dipotong dari Net Sales (Atas)"
                    : "Deviden dipotong dari Laba Owner (Bawah)"
                }
                className={`px-2 py-1 rounded-lg border flex items-center gap-1 font-bold transition cursor-pointer shadow-sm text-[10px] ${
                  filters.devidenPosition === "TOP_NET_SALES"
                    ? isDark
                      ? "bg-amber-900/50 text-amber-300 border-amber-500/50 hover:bg-amber-800/50"
                      : "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                    : isDark
                      ? "bg-blue-900/50 text-blue-300 border-blue-500/50 hover:bg-blue-800/50"
                      : "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200"
                }`}
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>
                  {filters.devidenPosition === "TOP_NET_SALES"
                    ? "Deviden Atas"
                    : "Deviden Bawah"}
                </span>
              </button>

              {/* Toggle Pajak */}
              <label
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-pointer select-none shadow-sm ${isDark ? "bg-slate-700/70 border-slate-500/50" : "bg-white/60 border-slate-300/70"}`}
              >
                <input
                  type="checkbox"
                  checked={filters.showTaxService}
                  onChange={(e) =>
                    setFilters((p: any) => ({
                      ...p,
                      showTaxService: e.target.checked,
                    }))
                  }
                  className="w-3.5 h-3.5 rounded text-orange-500 accent-orange-500"
                />
                <span
                  className={`font-bold text-[10px] ${isDark ? "text-slate-200" : "text-slate-700"}`}
                >
                  Pajak PB1 &amp; Servis
                </span>
              </label>

              {/* Toggle Utama (P&L vs Hutang) */}
              <div
                className={`flex items-center border rounded-lg p-0.5 shadow-sm ${isDark ? "bg-slate-700/70 border-slate-500/50" : "bg-white/60 border-slate-300/70"}`}
              >
                <button
                  onClick={() => setActiveTab("PL_WATERFALL")}
                  className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                    activeTab === "PL_WATERFALL"
                      ? "bg-linear-to-r from-blue-500 to-teal-400 text-white shadow"
                      : isDark
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  P&amp;L
                </button>
                <button
                  onClick={() => setActiveTab("DEBT_RECEIVABLE")}
                  className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                    activeTab === "DEBT_RECEIVABLE"
                      ? "bg-linear-to-r from-blue-500 to-teal-400 text-white shadow"
                      : isDark
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Hutang
                </button>
              </div>
            </div>
          </div>

          {/* Baris bawah: 3 Hero Cards */}
          <div className="grid grid-cols-3 gap-3 mt-2 flex-1 items-stretch">
            <LiquidGlass
              className="p-3 flex flex-col justify-center"
              dark={isDark}
            >
              <span
                className={`text-[9px] font-black uppercase tracking-wider block ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
              >
                TOTAL NETT SALES (100%)
              </span>
              <div
                className={`text-lg font-black font-mono mt-0.5 ${isDark ? "text-emerald-300" : "text-emerald-700"}`}
              >
                Rp {data.revenue.netSales.toLocaleString()}
              </div>
              <span className={`text-[9px] block mt-0.5 ${mutedText}`}>
                Gross: Rp {data.revenue.grossSales.toLocaleString()} | Diskon:
                Rp {data.revenue.discount.toLocaleString()}
              </span>
            </LiquidGlass>

            <LiquidGlass
              className="p-3 flex flex-col justify-center"
              dark={isDark}
            >
              <span
                className={`text-[9px] font-black uppercase tracking-wider block ${isDark ? "text-amber-400" : "text-amber-600"}`}
              >
                GROSS OPERATING PROFIT (GOP / UNTUNG RESTO)
              </span>
              <div
                className={`text-lg font-black font-mono mt-0.5 ${isDark ? "text-amber-300" : "text-amber-700"}`}
              >
                Rp {data.gop.grossOperatingProfit.toLocaleString()} (
                {data.gop.gopPercentage}%)
              </div>
              <span className={`text-[9px] block mt-0.5 ${mutedText}`}>
                Total Biaya Toko: Rp{" "}
                {(
                  data.summaryUsage.totalUsageAll + data.payroll.realisasiGaji
                ).toLocaleString()}
              </span>
            </LiquidGlass>

            <LiquidGlass
              className={`p-3 flex flex-col justify-center ${
                data.finalProfit.isNomplok
                  ? isDark
                    ? "border-rose-500/60"
                    : "border-rose-400/60"
                  : isDark
                    ? "border-emerald-500/60"
                    : "border-emerald-400/60"
              }`}
              dark={isDark}
            >
              <span
                className={`text-[9px] font-black uppercase tracking-wider block ${secondaryText}`}
              >
                SISA PROFIT PAK HAJI &amp; BU HAJI
              </span>
              <div
                className={`text-lg font-black font-mono mt-0.5 ${
                  data.finalProfit.isNomplok
                    ? isDark
                      ? "text-rose-400 animate-pulse"
                      : "text-rose-600 animate-pulse"
                    : isDark
                      ? "text-emerald-300"
                      : "text-emerald-700"
                }`}
              >
                Rp {data.finalProfit.finalProfitOwner.toLocaleString()} (
                {data.finalProfit.finalProfitPercentage}%)
              </div>
              <span
                className={`text-[9px] font-bold block mt-0.5 ${secondaryText}`}
              >
                {data.finalProfit.isNomplok
                  ? "⚠️ DEFISIT OPERASIONAL: Penarikan Melebihi Laba Bersih"
                  : "✅ SISA KAS BERSIH DI TANGAN"}
              </span>
            </LiquidGlass>
          </div>
        </LiquidGlass>
      </div>

      {/* ===================================================================== */}
      {/* KONTEN UTAMA (70% tinggi viewport) - sekarang bisa di-scroll penuh  */}
      {/* ===================================================================== */}
      <div className="flex-1 p-4 pt-2 overflow-y-auto">
        {activeTab === "PL_WATERFALL" ? (
          <div className="grid grid-cols-10 gap-3">
            {/* Kolom Kiri: Laporan P&L (40%) */}
            <div className="col-span-4">
              <LiquidGlass className="p-3 flex flex-col" dark={isDark}>
                <div
                  className={`border-b pb-1 mb-2 flex justify-between items-center ${isDark ? "border-slate-600/60" : "border-slate-200/60"}`}
                >
                  <h3
                    className={`font-black text-[11px] uppercase tracking-wide ${isDark ? "text-orange-400" : "text-orange-600"}`}
                  >
                    📊 LAPORAN P&amp;L ARUS KAS AIR TERJUN
                  </h3>
                  <span className={`text-[9px] font-mono ${mutedText}`}>
                    Periode: {filters.month}
                  </span>
                </div>

                {/* Konten P&L tanpa scroll internal */}
                <div className="space-y-1 text-[10px] font-semibold">
                  {/* Revenue block */}
                  <div className="py-1 space-y-0.5">
                    <div
                      className={`text-[8px] font-black uppercase tracking-wider ${mutedText}`}
                    >
                      REVENUE MONTH TO DATE
                    </div>
                    <div
                      className={`flex justify-between pl-3 ${secondaryText}`}
                    >
                      <span>FOOD SALES</span>
                      <div className="flex gap-3 font-mono">
                        <span>
                          Rp {data.revenue.foodSales.toLocaleString()}
                        </span>
                        <span className={`w-10 text-right ${mutedText}`}>
                          {formatPct(data.revenue.foodSales)}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`flex justify-between pl-3 ${secondaryText}`}
                    >
                      <span>BEVERAGE SALES</span>
                      <div className="flex gap-3 font-mono">
                        <span>
                          Rp {data.revenue.beverageSales.toLocaleString()}
                        </span>
                        <span className={`w-10 text-right ${mutedText}`}>
                          {formatPct(data.revenue.beverageSales)}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`flex justify-between pl-3 ${secondaryText}`}
                    >
                      <span>CHARGE</span>
                      <div className="flex gap-3 font-mono">
                        <span>
                          Rp {data.revenue.chargeSales.toLocaleString()}
                        </span>
                        <span className={`w-10 text-right ${mutedText}`}>
                          {formatPct(data.revenue.chargeSales)}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`flex justify-between pl-2 font-bold pt-0.5 border-t ${isDark ? "border-slate-600/70 text-white" : "border-slate-200/70 text-slate-900"}`}
                    >
                      <span>GROSS SALES</span>
                      <div className="flex gap-3 font-mono">
                        <span>
                          Rp {data.revenue.grossSales.toLocaleString()}
                        </span>
                        <span className={`w-10 text-right ${mutedText}`}>
                          115,00%
                        </span>
                      </div>
                    </div>
                    {filters.showTaxService && (
                      <>
                        <div
                          className={`flex justify-between pl-3 ${mutedText}`}
                        >
                          <span>TAX (PB1 10%)</span>
                          <div className="flex gap-3 font-mono">
                            <span>Rp {data.revenue.tax.toLocaleString()}</span>
                            <span className="w-10 text-right">10,00%</span>
                          </div>
                        </div>
                        <div
                          className={`flex justify-between pl-3 ${mutedText}`}
                        >
                          <span>SERVICE (5%)</span>
                          <div className="flex gap-3 font-mono">
                            <span>
                              Rp {data.revenue.service.toLocaleString()}
                            </span>
                            <span className="w-10 text-right">5,00%</span>
                          </div>
                        </div>
                      </>
                    )}
                    <div
                      className={`flex justify-between pl-2 font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}
                    >
                      <span>NETT BEFORE DISCOUNT</span>
                      <div className="flex gap-3 font-mono">
                        <span>
                          Rp {data.revenue.nettBeforeDiscount.toLocaleString()}
                        </span>
                        <span className={`w-10 text-right ${mutedText}`}>
                          100,30%
                        </span>
                      </div>
                    </div>
                    <div
                      className={`flex justify-between pl-3 ${isDark ? "text-rose-400" : "text-rose-600"}`}
                    >
                      <span>DISCOUNT</span>
                      <div className="flex gap-3 font-mono">
                        <span>
                          - Rp {data.revenue.discount.toLocaleString()}
                        </span>
                        <span className={`w-10 text-right ${mutedText}`}>
                          {formatPct(data.revenue.discount)}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`flex justify-between p-1.5 rounded-lg font-black text-[11px] border ${
                        isDark
                          ? "bg-emerald-900/50 border-emerald-500/50 text-emerald-300"
                          : "bg-emerald-50 border-emerald-200 text-emerald-700"
                      }`}
                    >
                      <span>NETT SALES</span>
                      <div className="flex gap-3 font-mono">
                        <span>Rp {data.revenue.netSales.toLocaleString()}</span>
                        <span className="w-10 text-right">100,00%</span>
                      </div>
                    </div>
                  </div>

                  {/* Sales Sharing (posisi atas) */}
                  {filters.devidenPosition === "TOP_NET_SALES" && (
                    <div
                      className={`py-1 flex justify-between p-1.5 rounded-lg font-bold border ${
                        isDark
                          ? "bg-amber-900/50 border-amber-500/50 text-amber-300"
                          : "bg-amber-50 border-amber-200 text-amber-700"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <Handshake className="w-3 h-3 text-amber-600" />
                        <span>
                          SALES SHARING ({data.salesSharing.recipientName})
                        </span>
                      </div>
                      <div className="flex gap-3 font-mono">
                        <span>
                          - Rp {data.salesSharing.amount.toLocaleString()}
                        </span>
                        <span className={`w-10 text-right ${mutedText}`}>
                          {formatPct(data.salesSharing.amount)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Belanja Dapur (CoGS) */}
                  <div className="py-1 space-y-0.5">
                    <div
                      onClick={() => toggleSec("cogs")}
                      className={`flex justify-between font-black uppercase cursor-pointer select-none ${isDark ? "text-rose-400" : "text-rose-600"}`}
                    >
                      <span className="flex items-center gap-1">
                        {expandedSections.cogs ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        BELANJA DAPUR (CoGS)
                      </span>
                      <div className="flex gap-3 font-mono">
                        <span>
                          Rp {data.cogs.totalBelanjaDapur.toLocaleString()}
                        </span>
                        <span className={`w-10 text-right ${mutedText}`}>
                          {formatPct(data.cogs.totalBelanjaDapur)}
                        </span>
                      </div>
                    </div>
                    {expandedSections.cogs && (
                      <div
                        className={`pl-4 space-y-0.5 font-normal ${secondaryText}`}
                      >
                        <div className="flex justify-between">
                          <span>FOOD COST</span>
                          <div className="flex gap-3 font-mono">
                            <span>
                              Rp {data.cogs.foodCost.toLocaleString()}
                            </span>
                            <span className={`w-10 text-right ${mutedText}`}>
                              {formatPct(data.cogs.foodCost)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span>BEVERAGE COST</span>
                          <div className="flex gap-3 font-mono">
                            <span>
                              Rp {data.cogs.beverageCost.toLocaleString()}
                            </span>
                            <span className={`w-10 text-right ${mutedText}`}>
                              {formatPct(data.cogs.beverageCost)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span>SPOIL &amp; RUSAK</span>
                          <div className="flex gap-3 font-mono">
                            <span>
                              Rp {data.cogs.spoilLoss.toLocaleString()}
                            </span>
                            <span className={`w-10 text-right ${mutedText}`}>
                              {formatPct(data.cogs.spoilLoss)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pendukung (OPEX) */}
                  <div className="py-1 space-y-0.5">
                    <div
                      onClick={() => toggleSec("pendukung")}
                      className={`flex justify-between font-black uppercase cursor-pointer select-none ${isDark ? "text-rose-400" : "text-rose-600"}`}
                    >
                      <span className="flex items-center gap-1">
                        {expandedSections.pendukung ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        PENDUKUNG (BIAYA RESTO / OPEX)
                      </span>
                      <div className="flex gap-3 font-mono">
                        <span>
                          Rp{" "}
                          {data.pendukung.totalBelanjaPendukung.toLocaleString()}
                        </span>
                        <span className={`w-10 text-right ${mutedText}`}>
                          {formatPct(data.pendukung.totalBelanjaPendukung)}
                        </span>
                      </div>
                    </div>
                    {expandedSections.pendukung && (
                      <div className="pl-3 space-y-1">
                        {Object.entries(data.pendukung.categories).map(
                          ([catKey, cat]: any) => {
                            const isOpen = expandedPendukungCat[catKey];
                            return (
                              <div
                                key={catKey}
                                className={`p-1.5 rounded-lg border ${isDark ? "bg-slate-700/50 border-slate-600/50" : "bg-white/50 border-slate-200/70"}`}
                              >
                                <div
                                  onClick={() => togglePendukung(catKey)}
                                  className={`flex justify-between items-center text-[10px] font-bold cursor-pointer ${isDark ? "text-slate-200 hover:text-white" : "text-slate-700 hover:text-slate-900"}`}
                                >
                                  <span className="flex items-center gap-1">
                                    {isOpen ? (
                                      <ChevronDown className="w-2.5 h-2.5 text-orange-500" />
                                    ) : (
                                      <ChevronRight className="w-2.5 h-2.5 text-slate-400" />
                                    )}
                                    {cat.categoryName}
                                  </span>
                                  <div className="flex gap-2 font-mono">
                                    <span>
                                      Rp {cat.amount.toLocaleString()}
                                    </span>
                                    <span
                                      className={`w-10 text-right text-[9px] ${mutedText}`}
                                    >
                                      {formatPct(cat.amount)}
                                    </span>
                                  </div>
                                </div>
                                {isOpen && (
                                  <div
                                    className={`pl-4 pt-1 space-y-0.5 text-[10px] font-mono ${mutedText}`}
                                  >
                                    {cat.items.map((it: any, i: number) => (
                                      <div
                                        key={i}
                                        className="flex justify-between"
                                      >
                                        <span>
                                          • {it.name} (Nota:{" "}
                                          {it.invoiceNumber || "-"})
                                        </span>
                                        <span>
                                          Rp {it.subtotal.toLocaleString()}
                                        </span>
                                      </div>
                                    ))}
                                    {cat.items.length === 0 && (
                                      <div className="text-[9px] italic">
                                        Belum ada nota belanja.
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          },
                        )}
                        <div
                          className={`flex justify-between p-1.5 rounded-lg border text-[10px] font-bold ${isDark ? "bg-slate-700/50 border-slate-600/50 text-slate-200" : "bg-white/50 border-slate-200/70 text-slate-700"}`}
                        >
                          <span>
                            🍽️ Employee Meals (Jatah Makan Karyawan EDR)
                          </span>
                          <div className="flex gap-2 font-mono">
                            <span>
                              Rp {data.pendukung.employeeMeals.toLocaleString()}
                            </span>
                            <span
                              className={`w-10 text-right text-[9px] ${mutedText}`}
                            >
                              {formatPct(data.pendukung.employeeMeals)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Total Usage */}
                  <div
                    className={`py-1 flex justify-between font-black p-1.5 rounded-lg border ${
                      isDark
                        ? "bg-rose-900/50 border-rose-500/50 text-rose-300"
                        : "bg-rose-50 border-rose-200 text-rose-600"
                    }`}
                  >
                    <span>TOTAL USAGE BELANJA DAPUR + PENDUKUNG</span>
                    <div className="flex gap-3 font-mono">
                      <span>
                        Rp {data.summaryUsage.totalUsageAll.toLocaleString()}
                      </span>
                      <span className={`w-10 text-right ${mutedText}`}>
                        {formatPct(data.summaryUsage.totalUsageAll)}
                      </span>
                    </div>
                  </div>

                  {/* Gaji & Biaya Bank */}
                  <div className="py-1 space-y-0.5">
                    <div
                      className={`flex justify-between pl-3 ${secondaryText}`}
                    >
                      <span>ALOKASI GAJI (15%)</span>
                      <div className="flex gap-3 font-mono">
                        <span>
                          Rp {data.payroll.alokasiGaji.toLocaleString()}
                        </span>
                        <span className="w-10 text-right">15,00%</span>
                      </div>
                    </div>
                    <div
                      className={`flex justify-between pl-3 font-bold ${isDark ? "text-rose-400" : "text-rose-600"}`}
                    >
                      <span>REALISASI GAJI KARYAWAN</span>
                      <div className="flex gap-3 font-mono">
                        <span>
                          - Rp {data.payroll.realisasiGaji.toLocaleString()}
                        </span>
                        <span className={`w-10 text-right ${mutedText}`}>
                          {formatPct(data.payroll.realisasiGaji)}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`flex justify-between pl-3 ${secondaryText}`}
                    >
                      <span>
                        Bank Fee (MDR EDC/QRIS {data.payroll.bankFeePct || 0.7}
                        %)
                      </span>
                      <div className="flex gap-3 font-mono">
                        <span>
                          - Rp {data.payroll.bankFee.toLocaleString()}
                        </span>
                        <span className={`w-10 text-right ${mutedText}`}>
                          {formatPct(data.payroll.bankFee)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* GOP */}
                  <div
                    className={`py-1.5 flex justify-between p-2 rounded-lg font-black text-[11px] border ${
                      isDark
                        ? "bg-amber-900/50 border-amber-500/50 text-amber-300"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}
                  >
                    <span>GROSS OPERATING PROFIT (GOP / UNTUNG RESTO)</span>
                    <div className="flex gap-3 font-mono">
                      <span>
                        Rp {data.gop.grossOperatingProfit.toLocaleString()}
                      </span>
                      <span className="w-10 text-right">
                        {data.gop.gopPercentage}%
                      </span>
                    </div>
                  </div>

                  {/* Owner & Development Expenses */}
                  <div className="py-1 space-y-0.5">
                    <div
                      onClick={() => toggleSec("owner")}
                      className={`flex justify-between font-black uppercase cursor-pointer select-none ${isDark ? "text-orange-400" : "text-orange-600"}`}
                    >
                      <span className="flex items-center gap-1">
                        {expandedSections.owner ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        OWNER &amp; DEVELOPMENT EXPENSES
                      </span>
                      <div className="flex gap-3 font-mono">
                        <span>
                          Rp{" "}
                          {data.ownerExpenses.totalOwnerExpenses.toLocaleString()}
                        </span>
                        <span className={`w-10 text-right ${mutedText}`}>
                          {formatPct(data.ownerExpenses.totalOwnerExpenses)}
                        </span>
                      </div>
                    </div>
                    {expandedSections.owner && (
                      <div
                        className={`pl-4 space-y-0.5 font-normal ${secondaryText}`}
                      >
                        <div className="flex justify-between">
                          <span>PRIVE OWNER</span>
                          <div className="flex gap-3 font-mono">
                            <span>
                              Rp {data.ownerExpenses.prive.toLocaleString()}
                            </span>
                            <span className={`w-10 text-right ${mutedText}`}>
                              {formatPct(data.ownerExpenses.prive)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span>GAJI HOLDING</span>
                          <div className="flex gap-3 font-mono">
                            <span>
                              Rp{" "}
                              {data.ownerExpenses.gajiHolding.toLocaleString()}
                            </span>
                            <span className={`w-10 text-right ${mutedText}`}>
                              {formatPct(data.ownerExpenses.gajiHolding)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span>SAVING PENGEMBANGAN / PROYEK</span>
                          <div className="flex gap-3 font-mono">
                            <span>
                              Rp{" "}
                              {data.ownerExpenses.savingPengembangan.toLocaleString()}
                            </span>
                            <span className={`w-10 text-right ${mutedText}`}>
                              {formatPct(data.ownerExpenses.savingPengembangan)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span>COMPLIMENT</span>
                          <div className="flex gap-3 font-mono">
                            <span>
                              Rp{" "}
                              {data.ownerExpenses.compliment.toLocaleString()}
                            </span>
                            <span className={`w-10 text-right ${mutedText}`}>
                              {formatPct(data.ownerExpenses.compliment)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span>ALOKASI UMROH (2%)</span>
                          <div className="flex gap-3 font-mono">
                            <span>
                              Rp{" "}
                              {data.ownerExpenses.alokasiUmroh.toLocaleString()}
                            </span>
                            <span className={`w-10 text-right ${mutedText}`}>
                              2,00%
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span>ALOKASI THR (1%)</span>
                          <div className="flex gap-3 font-mono">
                            <span>
                              Rp{" "}
                              {data.ownerExpenses.alokasiThr.toLocaleString()}
                            </span>
                            <span className={`w-10 text-right ${mutedText}`}>
                              1,00%
                            </span>
                          </div>
                        </div>
                        {filters.devidenPosition === "BOTTOM_OWNER" && (
                          <div
                            className={`flex justify-between font-bold ${isDark ? "text-amber-400" : "text-amber-600"}`}
                          >
                            <span>
                              🤝 DEVIDEN MITRA (
                              {data.salesSharing.recipientName})
                            </span>
                            <div className="flex gap-3 font-mono">
                              <span>
                                Rp {data.salesSharing.amount.toLocaleString()}
                              </span>
                              <span className={`w-10 text-right ${mutedText}`}>
                                {formatPct(data.salesSharing.amount)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sisa Profit */}
                  <div
                    className={`py-2 flex justify-between p-2.5 rounded-xl font-black text-[12px] border-2 shadow-md ${
                      data.finalProfit.isNomplok
                        ? isDark
                          ? "bg-rose-900/80 border-rose-500 text-rose-300"
                          : "bg-rose-100/80 border-rose-400 text-rose-700"
                        : isDark
                          ? "bg-emerald-900/80 border-emerald-500 text-emerald-300"
                          : "bg-emerald-100/80 border-emerald-400 text-emerald-700"
                    }`}
                  >
                    <span>
                      {data.finalProfit.isNomplok
                        ? "⚠️ SISA PROFIT (NOMPLOK / MINUS)"
                        : "🏦 SISA LABA BERSIH PEMILIK (RETAINED PROFIT)"}
                    </span>
                    <div className="flex gap-3 font-mono">
                      <span>
                        Rp {data.finalProfit.finalProfitOwner.toLocaleString()}
                      </span>
                      <span className="w-10 text-right">
                        {data.finalProfit.finalProfitPercentage}%
                      </span>
                    </div>
                  </div>
                </div>
              </LiquidGlass>
            </div>

            {/* Kolom Tengah: Performa Outlet (30%) */}
            <div className="col-span-3">
              <LiquidGlass className="p-3 flex flex-col" dark={isDark}>
                <div className="flex justify-between items-center mb-2">
                  <span
                    className={`font-black text-[11px] uppercase tracking-wider ${isDark ? "text-orange-400" : "text-orange-600"}`}
                  >
                    🏆 PERFORMA OUTLET
                  </span>
                  <span className={`text-[9px] ${mutedText}`}>
                    Net Sales per Outlet
                  </span>
                </div>

                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorNetSales"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#0EA5E9"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#0EA5E9"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={
                          isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"
                        }
                      />
                      <XAxis
                        dataKey="name"
                        stroke={isDark ? "#94A3B8" : "#64748B"}
                        fontSize={9}
                        tickLine={false}
                      />
                      <YAxis
                        stroke={isDark ? "#94A3B8" : "#64748B"}
                        fontSize={9}
                        tickLine={false}
                        tickFormatter={(value) =>
                          `Rp ${(value / 1000000).toFixed(0)}Jt`
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#1E293B" : "#ffffff",
                          border: isDark
                            ? "1px solid #475569"
                            : "1px solid #CBD5E1",
                          borderRadius: "8px",
                          color: isDark ? "#F1F5F9" : "#1E293B",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                          fontSize: "10px",
                        }}
                        formatter={(value: any) => [
                          `Rp ${Number(value ?? 0).toLocaleString()}`,
                          "Net Sales",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="netSales"
                        stroke="#0EA5E9"
                        fillOpacity={1}
                        fill="url(#colorNetSales)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-2 space-y-1">
                  {data.outletPerformance.map((out: any, idx: number) => (
                    <div
                      key={out.outletId}
                      className={`flex justify-between items-center p-1.5 rounded-lg border text-[10px] font-bold ${
                        isDark
                          ? "bg-slate-700/50 border-slate-600/50 text-slate-200"
                          : "bg-white/50 border-slate-200/70 text-slate-700"
                      }`}
                    >
                      <span className="truncate">
                        #{idx + 1} {out.outletName}
                      </span>
                      <span
                        className={`font-mono font-black whitespace-nowrap ${isDark ? "text-orange-400" : "text-orange-600"}`}
                      >
                        Rp {(out.netSales / 1000000).toFixed(1)} Jt
                      </span>
                    </div>
                  ))}
                </div>
              </LiquidGlass>
            </div>

            {/* Kolom Kanan: Kuota Biaya (30%) */}
            <div className="col-span-3">
              <LiquidGlass className="p-3 flex flex-col" dark={isDark}>
                <div
                  className={`border-b pb-1 mb-2 ${isDark ? "border-slate-600/60" : "border-slate-200/60"}`}
                >
                  <h3
                    className={`font-black text-[11px] uppercase tracking-wide flex items-center gap-1 ${isDark ? "text-orange-400" : "text-orange-600"}`}
                  >
                    <Target className="w-3.5 h-3.5" /> KUOTA BIAYA &amp; TARGET
                  </h3>
                </div>

                <div className="space-y-2">
                  <div
                    className={`p-2 rounded-lg border ${isDark ? "bg-slate-700/50 border-slate-600/50" : "bg-white/50 border-slate-200/70"}`}
                  >
                    <div
                      className={`flex justify-between text-[10px] font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}
                    >
                      <span>Target Net Sales:</span>
                      <span
                        className={`font-mono font-black ${isDark ? "text-orange-400" : "text-orange-600"}`}
                      >
                        {data.budgeting.salesAchievedPct}%
                      </span>
                    </div>
                    <div
                      className={`h-1.5 rounded-full overflow-hidden mt-1 ${isDark ? "bg-slate-500" : "bg-slate-200"}`}
                    >
                      <div
                        className="h-full bg-linear-to-r from-orange-400 to-amber-400 rounded-full"
                        style={{ width: `${data.budgeting.salesAchievedPct}%` }}
                      />
                    </div>
                  </div>

                  <div
                    className={`p-2 rounded-lg border ${isDark ? "bg-slate-700/50 border-slate-600/50" : "bg-white/50 border-slate-200/70"}`}
                  >
                    <div
                      className={`flex justify-between text-[10px] font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}
                    >
                      <span>Belanja Dapur (CoGS):</span>
                      <span
                        className={`font-mono font-black ${
                          data.budgeting.cogsUsedPct > 100
                            ? isDark
                              ? "text-rose-400"
                              : "text-rose-600"
                            : isDark
                              ? "text-emerald-400"
                              : "text-emerald-600"
                        }`}
                      >
                        {data.budgeting.cogsUsedPct}%
                      </span>
                    </div>
                    <div
                      className={`h-1.5 rounded-full overflow-hidden mt-1 ${isDark ? "bg-slate-500" : "bg-slate-200"}`}
                    >
                      <div
                        className={`h-full rounded-full ${
                          data.budgeting.cogsUsedPct > 100
                            ? "bg-rose-500"
                            : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${Math.min(100, data.budgeting.cogsUsedPct)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className={`p-2 rounded-lg border ${isDark ? "bg-slate-700/50 border-slate-600/50" : "bg-white/50 border-slate-200/70"}`}
                  >
                    <div
                      className={`flex justify-between text-[10px] font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}
                    >
                      <span>Pendukung (OPEX):</span>
                      <span
                        className={`font-mono font-black ${
                          data.budgeting.opexUsedPct > 100
                            ? isDark
                              ? "text-rose-400"
                              : "text-rose-600"
                            : isDark
                              ? "text-emerald-400"
                              : "text-emerald-600"
                        }`}
                      >
                        {data.budgeting.opexUsedPct}%
                      </span>
                    </div>
                    <div
                      className={`h-1.5 rounded-full overflow-hidden mt-1 ${isDark ? "bg-slate-500" : "bg-slate-200"}`}
                    >
                      <div
                        className={`h-full rounded-full ${
                          data.budgeting.opexUsedPct > 100
                            ? "bg-rose-500"
                            : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${Math.min(100, data.budgeting.opexUsedPct)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </LiquidGlass>
            </div>
          </div>
        ) : (
          <div>
            <DebtReceivableView
              receivingDocs={receivingDocs}
              regions={regions}
              outlets={outlets}
              vendors={vendors}
            />
          </div>
        )}
      </div>
    </div>
  );
};
