// File: apps/client_unv/src/executive-dashboard/phone_dashboard.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Layers,
  Target,
  CreditCard,
  Sun,
  Moon,
  Building2,
  Calendar,
  ArrowRightLeft,
  RotateCw,
  X,
  SlidersHorizontal,
  Handshake,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DebtReceivableView } from "./components/DebtReceivableView";

/* ------------------------------------------------------------------ */
/* KOMPONEN LIQUID GLASS (Disesuaikan dengan iOS 26)                 */
/* ------------------------------------------------------------------ */
interface LiquidGlassProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  onMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: () => void;
  isDark?: boolean; // true = light mode (B), false = dark mode (D)
}

const LiquidGlass = React.forwardRef<HTMLDivElement, LiquidGlassProps>(
  (
    {
      children,
      className = "",
      style,
      onClick,
      onMouseMove,
      onMouseLeave,
      isDark = true,
    },
    ref,
  ) => {
    // Tentukan background & border berdasarkan mode
    const bg = isDark
      ? "rgba(255, 255, 255, 0.03)" // light mode B (transparan terang)
      : "rgba(15, 23, 42, 0.9)"; // dark mode D (slate gelap)
    const borderColor = isDark
      ? "rgba(255, 255, 255, 0.15)"
      : "rgba(51, 65, 85, 1)"; // slate-700

    return (
      <motion.div
        ref={ref}
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className={`relative overflow-hidden border backdrop-blur-2xl saturate-200 transition-all duration-300 ${className}`}
        style={{
          background: bg,
          borderColor: borderColor,
          boxShadow:
            "0 30px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
          borderRadius: "24px",
          ...style,
        }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="relative z-10 h-full">{children}</div>
      </motion.div>
    );
  },
);
LiquidGlass.displayName = "LiquidGlass";

/* ------------------------------------------------------------------ */
/* KOMPONEN UTAMA PHONE DASHBOARD                                    */
/* ------------------------------------------------------------------ */
export const PhoneDashboard: React.FC<{
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
  const [mobileTab, setMobileTab] = useState<"WATERFALL" | "BUDGET" | "DEBT">(
    "WATERFALL",
  );
  // Default isDark = true (light mode baru bergaya B)
  const [isDark, setIsDark] = useState(true);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [expandedWaterfall, setExpandedWaterfall] = useState(false);
  const [expandedPendukung, setExpandedPendukung] = useState(false);

  // LOGIKA LIQUID GLASS NAV
  const dockRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ x: 0, width: 0 });

  const navItems = [
    {
      id: "WATERFALL",
      label: "P&L",
      icon: Layers,
      action: () => setMobileTab("WATERFALL"),
    },
    {
      id: "BUDGET",
      label: "Budget",
      icon: Target,
      action: () => setMobileTab("BUDGET"),
    },
    {
      id: "DEBT",
      label: "Hutang",
      icon: CreditCard,
      action: () => setMobileTab("DEBT"),
    },
    {
      id: "THEME",
      label: "Tema",
      icon: isDark ? Sun : Moon,
      action: () => setIsDark(!isDark),
      isActionOnly: true,
    },
    {
      id: "FILTER",
      label: "Filter",
      icon: SlidersHorizontal,
      action: () => setShowFilterPanel(true),
      isActionOnly: true,
    },
  ];

  const activeIdxReal = navItems.findIndex((item) => item.id === mobileTab);

  const updateIndicatorToActive = useCallback(() => {
    const activeEl = itemRefs.current[activeIdxReal !== -1 ? activeIdxReal : 0];
    const dockEl = dockRef.current;
    if (activeEl && dockEl) {
      const dockRect = dockEl.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      setIndicator({
        x: activeRect.left - dockRect.left,
        width: activeRect.width,
      });
    }
  }, [activeIdxReal]);

  useEffect(() => {
    const timer = setTimeout(() => updateIndicatorToActive(), 50);
    return () => clearTimeout(timer);
  }, [mobileTab, showFilterPanel, updateIndicatorToActive]);

  useEffect(() => {
    window.addEventListener("resize", updateIndicatorToActive);
    return () => window.removeEventListener("resize", updateIndicatorToActive);
  }, [updateIndicatorToActive]);

  const handleMouseMoveDock = (e: React.MouseEvent) => {
    if (dockRef.current) {
      const rect = dockRef.current.getBoundingClientRect();
      dockRef.current.style.setProperty("--x", `${e.clientX - rect.left}px`);
      dockRef.current.style.setProperty("--y", `${e.clientY - rect.top}px`);
    }
  };

  const handleMouseEnterItem = (idx: number) => {
    const activeEl = itemRefs.current[activeIdxReal !== -1 ? activeIdxReal : 0];
    const hoverEl = itemRefs.current[idx];
    const dockEl = dockRef.current;

    if (activeEl && hoverEl && dockEl) {
      const dockRect = dockEl.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const hoverRect = hoverEl.getBoundingClientRect();

      const activeX = activeRect.left - dockRect.left;
      const hoverX = hoverRect.left - dockRect.left;

      const stretchLeft = Math.min(activeX, hoverX);
      const stretchRight = Math.max(
        activeX + activeRect.width,
        hoverX + hoverRect.width,
      );

      setIndicator({ x: stretchLeft, width: stretchRight - stretchLeft });
    }
  };

  // =========================================================================
  // TEMA BARU:
  // isDark true  = light mode (gaya B phone sebelumnya) -> transparan gelap
  // isDark false = dark mode (gaya D DebtReceivableView) -> slate solid
  // =========================================================================
  const primaryText = "text-white"; // keduanya putih
  const secondaryText = isDark ? "text-white/60" : "text-slate-400";
  const mutedText = isDark ? "text-white/40" : "text-slate-500";
  const positiveText = isDark ? "text-emerald-300" : "text-emerald-400";
  const warningText = isDark ? "text-amber-300" : "text-amber-400";

  return (
    <div
      className={`min-h-screen font-sans p-3 pb-28 overflow-x-hidden relative ${
        isDark ? "light-mode-bg" : "dark-mode-bg"
      }`}
      style={{
        backgroundImage: `url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Tidak perlu overlay putih lagi untuk light mode baru */}

      {/* Vignette dan Glow Background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      {/* GLOBAL STYLE UNTUK EFEK CAHAYA DISTORSI iOS 26 */}
      <style>{`
        .ios-liquid-dock {
          --x: 50%;
          --y: 50%;
          border-radius: 40px !important;
          background: rgba(255, 255, 255, 0.03) !important;
          backdrop-filter: blur(40px) saturate(200%);
          -webkit-backdrop-filter: blur(40px) saturate(200%);
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
          overflow: hidden;
          padding: 8px;
        }
        .dark-mode-bg .ios-liquid-dock {
          background: rgba(15, 23, 42, 0.9) !important;
          border-color: rgba(51, 65, 85, 1) !important;
        }
        .ios-liquid-dock::before {
          content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          background: radial-gradient(circle 90px at var(--x) var(--y), rgba(255,255,255,0.28), transparent 70%);
          pointer-events: none; z-index: 0;
        }
        .ios-liquid-dock::after {
          content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          background: radial-gradient(circle 130px at calc(var(--x) * -1) calc(var(--y) * -1), rgba(0,0,0,0.22), transparent 70%);
          pointer-events: none; z-index: 0;
        }
        .liquid-indicator {
          position: absolute;
          top: 3px; bottom: 3px; left: 0;
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.22);
          box-shadow: inset 0 2px 10px rgba(255,255,255,0.55), inset 0 -2px 8px rgba(0,0,0,0.08), 0 5px 15px rgba(0,0,0,0.2), 0 0 22px rgba(255,255,255,0.18);
          backdrop-filter: blur(10px);
          z-index: 1;
        }
        .nav-item-dock {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          padding: 10px 14px;
          border-radius: 30px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.6);
          transition: color 0.35s ease;
          background: transparent;
          border: none;
          outline: none;
        }
        .nav-item-dock:hover { color: rgba(255, 255, 255, 0.92); }
        .nav-item-dock.active { color: #ffffff; }
        .nav-item-dock svg {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          will-change: transform;
        }
        .nav-item-dock:hover:not(.active) svg { transform: translateY(-2px) scale(1.1); }
        .nav-item-dock.active svg { transform: translateY(-2px) scale(1.06); }
        .nav-label-dock {
          font-size: 13px;
          font-weight: 600;
          margin-left: 6px;
          overflow: hidden;
          white-space: nowrap;
          letter-spacing: 0.2px;
        }
      `}</style>

      <div className="relative z-10 space-y-3">
        {/* HEADER HP */}
        <LiquidGlass
          isDark={isDark}
          className={`p-3 space-y-3 ${isDark ? "" : ""}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center font-black text-lg text-white shadow-md">
                Z
              </div>
              <div className="leading-tight">
                <h1 className={`text-xs font-black uppercase ${primaryText}`}>
                  Mobile Owner
                </h1>
                <div className={`flex items-center gap-1 ${secondaryText}`}>
                  <span className="relative flex h-1.5 w-1.5">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isLiveSyncing ? "bg-amber-400" : "bg-emerald-500"
                      }`}
                    ></span>
                    <span
                      className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                        isLiveSyncing ? "bg-amber-500" : "bg-emerald-600"
                      }`}
                    ></span>
                  </span>
                  <span className="text-[9px] font-bold font-mono">
                    {isLiveSyncing
                      ? "Syncing..."
                      : `Live • ${lastSyncTime || "Realtime"}`}
                  </span>
                  {onManualSync && (
                    <button
                      onClick={onManualSync}
                      disabled={isLiveSyncing}
                      className="p-0.5 rounded cursor-pointer transition disabled:opacity-50 text-white/60 hover:text-white"
                      title="Sinkronkan Sekarang"
                    >
                      <RotateCw
                        className={`w-3 h-3 ${
                          isLiveSyncing ? "animate-spin text-orange-500" : ""
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Hero Cards */}
          <div className="space-y-2">
            <LiquidGlass
              isDark={isDark}
              className={`p-3 rounded-xl border text-center ${
                data.finalProfit.isNomplok
                  ? "border-rose-400/60"
                  : "border-emerald-400/60"
              } ${isDark ? "" : ""}`}
            >
              <span
                className={`text-[9px] font-black uppercase block ${secondaryText}`}
              >
                Sisa Profit Owner
              </span>
              <div
                className={`text-xl font-black font-mono mt-0.5 ${
                  data.finalProfit.isNomplok
                    ? "text-rose-400 animate-pulse"
                    : positiveText
                }`}
              >
                Rp {data.finalProfit.finalProfitOwner.toLocaleString()}
              </div>
              <span className={`text-[9px] block mt-0.5 ${mutedText}`}>
                {data.finalProfit.finalProfitPercentage}% dari Net Sales
              </span>
            </LiquidGlass>

            <div className="grid grid-cols-2 gap-2">
              <LiquidGlass isDark={isDark} className="p-2.5 text-center">
                <span className="text-[8px] font-bold uppercase block text-emerald-400">
                  Net Revenue
                </span>
                <span
                  className={`font-mono font-black text-xs ${positiveText}`}
                >
                  Rp {(data.revenue.netSales / 1000000).toFixed(1)}Jt
                </span>
              </LiquidGlass>
              <LiquidGlass isDark={isDark} className="p-2.5 text-center">
                <span className="text-[8px] font-bold uppercase block text-amber-400">
                  GOP (Untung Resto)
                </span>
                <span className={`font-mono font-black text-xs ${warningText}`}>
                  Rp {(data.gop.grossOperatingProfit / 1000000).toFixed(1)}Jt
                </span>
              </LiquidGlass>
            </div>
          </div>
        </LiquidGlass>

        {/* KONTEN UTAMA BERDASARKAN TAB */}
        <div className="space-y-3">
          {mobileTab === "WATERFALL" && (
            <LiquidGlass isDark={isDark} className="p-3 space-y-2">
              <div className="border-b border-white/10 pb-1">
                <h3 className="font-black text-xs uppercase text-orange-400">
                  📊 Arus Kas Air Terjun
                </h3>
              </div>

              <div className="space-y-1 text-[11px] font-semibold">
                <div
                  className={`flex justify-between p-2 rounded-lg border ${
                    isDark
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-emerald-900/30 border-emerald-700/50 text-emerald-300"
                  }`}
                >
                  <span>Net Sales</span>
                  <span className="font-mono font-black">
                    Rp {data.revenue.netSales.toLocaleString()}
                  </span>
                </div>

                {filters.devidenPosition === "TOP_NET_SALES" && (
                  <div
                    className={`flex justify-between p-2 rounded-lg border ${
                      isDark
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        : "bg-amber-900/30 border-amber-700/50 text-amber-300"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Handshake className="w-3 h-3" />
                      Sales Sharing
                    </span>
                    <span className="font-mono font-black">
                      - Rp {data.salesSharing.amount.toLocaleString()}
                    </span>
                  </div>
                )}

                <div
                  className={`flex justify-between p-2 rounded-lg border ${
                    isDark
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      : "bg-rose-900/30 border-rose-700/50 text-rose-300"
                  }`}
                >
                  <span>Belanja Dapur (CoGS)</span>
                  <span className="font-mono font-black">
                    Rp {data.cogs.totalBelanjaDapur.toLocaleString()}
                  </span>
                </div>

                <div
                  className={`flex justify-between p-2 rounded-lg border ${
                    isDark
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      : "bg-rose-900/30 border-rose-700/50 text-rose-300"
                  }`}
                >
                  <span>Biaya Pendukung (OPEX)</span>
                  <span className="font-mono font-black">
                    Rp {data.pendukung.totalBelanjaPendukung.toLocaleString()}
                  </span>
                </div>

                <div
                  className={`flex justify-between p-2 rounded-lg border ${
                    isDark
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-amber-900/30 border-amber-700/50 text-amber-300"
                  }`}
                >
                  <span>GOP (Untung Resto)</span>
                  <span className="font-mono font-black">
                    Rp {data.gop.grossOperatingProfit.toLocaleString()}
                  </span>
                </div>

                <div
                  className={`flex justify-between p-2 rounded-lg border ${
                    isDark
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                      : "bg-blue-900/30 border-blue-700/50 text-blue-300"
                  }`}
                >
                  <span>Diambil Owner</span>
                  <span className="font-mono font-black">
                    Rp {data.ownerExpenses.totalOwnerExpenses.toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={() => setExpandedWaterfall(!expandedWaterfall)}
                  className={`w-full flex items-center justify-center gap-1 py-1 text-[10px] font-bold rounded-lg border ${
                    isDark
                      ? "bg-white/5 border-white/10 text-white/80"
                      : "bg-slate-800 border-slate-700 text-slate-300"
                  }`}
                >
                  {expandedWaterfall ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  {expandedWaterfall
                    ? "Sembunyikan Detail"
                    : "Lihat Detail Lengkap"}
                </button>

                {expandedWaterfall && (
                  <div className="space-y-1 pt-1">
                    <div
                      className={`pl-2 space-y-0.5 text-[10px] ${secondaryText}`}
                    >
                      <div className="flex justify-between">
                        <span>Food Sales</span>
                        <span className="font-mono">
                          Rp {data.revenue.foodSales.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Beverage Sales</span>
                        <span className="font-mono">
                          Rp {data.revenue.beverageSales.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Discount</span>
                        <span className="font-mono">
                          - Rp {data.revenue.discount.toLocaleString()}
                        </span>
                      </div>
                      {filters.showTaxService && (
                        <>
                          <div className="flex justify-between">
                            <span>Tax (PB1 10%)</span>
                            <span className="font-mono">
                              Rp {data.revenue.tax.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Service (5%)</span>
                            <span className="font-mono">
                              Rp {data.revenue.service.toLocaleString()}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <div
                      className={`p-1.5 rounded-lg border ${
                        isDark
                          ? "bg-white/5 border-white/10"
                          : "bg-slate-800 border-slate-700"
                      }`}
                    >
                      <div
                        onClick={() => setExpandedPendukung(!expandedPendukung)}
                        className="flex justify-between items-center cursor-pointer"
                      >
                        <span
                          className={`text-[10px] font-bold ${primaryText}`}
                        >
                          Rincian Pendukung
                        </span>
                        {expandedPendukung ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </div>
                      {expandedPendukung && (
                        <div
                          className={`mt-1 space-y-0.5 text-[9px] font-mono ${secondaryText}`}
                        >
                          {Object.entries(data.pendukung.categories).map(
                            ([k, cat]: any) => (
                              <div key={k} className="flex justify-between">
                                <span>• {cat.categoryName}</span>
                                <span>Rp {cat.amount.toLocaleString()}</span>
                              </div>
                            ),
                          )}
                          <div className="flex justify-between">
                            <span>• Employee Meals</span>
                            <span>
                              Rp {data.pendukung.employeeMeals.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className={`pl-2 space-y-0.5 text-[10px] ${secondaryText}`}
                    >
                      <div className="flex justify-between">
                        <span>Realisasi Gaji</span>
                        <span className="font-mono">
                          - Rp {data.payroll.realisasiGaji.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bank Fee</span>
                        <span className="font-mono">
                          - Rp {data.payroll.bankFee.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`pl-2 space-y-0.5 text-[10px] ${secondaryText}`}
                    >
                      <div className="flex justify-between">
                        <span>Prive Owner</span>
                        <span className="font-mono">
                          Rp {data.ownerExpenses.prive.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Gaji Holding</span>
                        <span className="font-mono">
                          Rp {data.ownerExpenses.gajiHolding.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Saving Pengembangan</span>
                        <span className="font-mono">
                          Rp{" "}
                          {data.ownerExpenses.savingPengembangan.toLocaleString()}
                        </span>
                      </div>
                      {filters.devidenPosition === "BOTTOM_OWNER" && (
                        <div
                          className={`flex justify-between font-bold ${primaryText}`}
                        >
                          <span>Deviden Mitra</span>
                          <span className="font-mono">
                            Rp {data.salesSharing.amount.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div
                  className={`p-2.5 rounded-xl flex justify-between font-black text-xs border-2 ${
                    data.finalProfit.isNomplok
                      ? "bg-rose-500/20 border-rose-400 text-rose-300"
                      : "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                  }`}
                >
                  <span>
                    {data.finalProfit.isNomplok ? "⚠️ Nomplok" : "🏦 Sisa Kas"}
                  </span>
                  <span className="font-mono">
                    Rp {data.finalProfit.finalProfitOwner.toLocaleString()}
                  </span>
                </div>
              </div>
            </LiquidGlass>
          )}

          {mobileTab === "BUDGET" && (
            <LiquidGlass isDark={isDark} className="p-3 space-y-3">
              <div className="border-b border-white/10 pb-1">
                <h3 className="font-black text-xs uppercase flex items-center gap-1 text-orange-400">
                  <Target className="w-3.5 h-3.5" /> Kuota Biaya & Target
                </h3>
              </div>

              <div className="space-y-2">
                <div
                  className={`p-2 rounded-lg border ${
                    isDark
                      ? "bg-white/5 border-white/10"
                      : "bg-slate-800 border-slate-700"
                  }`}
                >
                  <div
                    className={`flex justify-between text-[11px] font-bold ${primaryText}`}
                  >
                    <span>Target Net Sales</span>
                    <span className="font-mono font-black text-orange-400">
                      {data.budgeting.salesAchievedPct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mt-1 bg-white/10">
                    <div
                      className="h-full bg-linear-to-r from-orange-400 to-amber-400"
                      style={{ width: `${data.budgeting.salesAchievedPct}%` }}
                    />
                  </div>
                </div>

                <div
                  className={`p-2 rounded-lg border ${
                    isDark
                      ? "bg-white/5 border-white/10"
                      : "bg-slate-800 border-slate-700"
                  }`}
                >
                  <div
                    className={`flex justify-between text-[11px] font-bold ${primaryText}`}
                  >
                    <span>CoGS Dapur</span>
                    <span
                      className={`font-mono font-black ${
                        data.budgeting.cogsUsedPct > 100
                          ? "text-rose-400"
                          : positiveText
                      }`}
                    >
                      {data.budgeting.cogsUsedPct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mt-1 bg-white/10">
                    <div
                      className={`h-full ${
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
                  className={`p-2 rounded-lg border ${
                    isDark
                      ? "bg-white/5 border-white/10"
                      : "bg-slate-800 border-slate-700"
                  }`}
                >
                  <div
                    className={`flex justify-between text-[11px] font-bold ${primaryText}`}
                  >
                    <span>Pendukung (OPEX)</span>
                    <span
                      className={`font-mono font-black ${
                        data.budgeting.opexUsedPct > 100
                          ? "text-rose-400"
                          : positiveText
                      }`}
                    >
                      {data.budgeting.opexUsedPct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mt-1 bg-white/10">
                    <div
                      className={`h-full ${
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

              <div className="pt-1">
                <span
                  className={`font-black text-[10px] uppercase block ${mutedText}`}
                >
                  Peringkat Outlet
                </span>
                <div className="space-y-1 mt-1">
                  {data.outletPerformance.map((out: any, idx: number) => (
                    <div
                      key={out.outletId}
                      className={`flex justify-between p-2 rounded-lg border text-[11px] font-bold ${
                        isDark
                          ? "bg-white/5 border-white/10 text-white"
                          : "bg-slate-800 border-slate-700 text-slate-200"
                      }`}
                    >
                      <span className="truncate">
                        #{idx + 1} {out.outletName}
                      </span>
                      <span className="font-mono font-black text-orange-400">
                        Rp {(out.netSales / 1000000).toFixed(1)} Jt
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </LiquidGlass>
          )}

          {mobileTab === "DEBT" && (
            <DebtReceivableView
              receivingDocs={receivingDocs}
              regions={regions}
              outlets={outlets}
              vendors={vendors}
              isDark={isDark}
            />
          )}
        </div>
      </div>

      {/* DOCK LIQUID GLASS iOS 26 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 flex justify-center">
        <AnimatePresence mode="wait">
          {showFilterPanel ? (
            <motion.div
              key="filter-panel"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-md"
            >
              <LiquidGlass isDark={isDark} className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`font-black text-xs uppercase ${primaryText}`}
                  >
                    Filter & Pengaturan
                  </span>
                  <button
                    onClick={() => setShowFilterPanel(false)}
                    className="p-1 rounded-lg text-white/60 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div
                    className={`flex items-center gap-1 border rounded-lg px-2 py-1.5 ${
                      isDark
                        ? "bg-white/5 border-white/10"
                        : "bg-slate-800 border-slate-700"
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-orange-500" />
                    <select
                      value={filters.regionId}
                      onChange={(e) =>
                        setFilters((p: any) => ({
                          ...p,
                          regionId: e.target.value,
                          outletId: "",
                        }))
                      }
                      className={`bg-transparent text-xs font-bold outline-none cursor-pointer flex-1 ${primaryText}`}
                    >
                      <option
                        value=""
                        className={
                          isDark
                            ? "bg-slate-800 text-white"
                            : "bg-slate-800 text-white"
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
                              ? "bg-slate-800 text-white"
                              : "bg-slate-800 text-white"
                          }
                        >
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    className={`flex items-center gap-1 border rounded-lg px-2 py-1.5 ${
                      isDark
                        ? "bg-white/5 border-white/10"
                        : "bg-slate-800 border-slate-700"
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-orange-500" />
                    <select
                      value={filters.outletId}
                      onChange={(e) =>
                        setFilters((p: any) => ({
                          ...p,
                          outletId: e.target.value,
                        }))
                      }
                      className={`bg-transparent text-xs font-bold outline-none cursor-pointer flex-1 ${primaryText}`}
                    >
                      <option
                        value=""
                        className={
                          isDark
                            ? "bg-slate-800 text-white"
                            : "bg-slate-800 text-white"
                        }
                      >
                        Semua Outlet
                      </option>
                      {outlets
                        .filter(
                          (o) =>
                            !filters.regionId ||
                            o.regionId === filters.regionId,
                        )
                        .map((o) => (
                          <option
                            key={o.id}
                            value={o.id}
                            className={
                              isDark
                                ? "bg-slate-800 text-white"
                                : "bg-slate-800 text-white"
                            }
                          >
                            {o.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div
                    className={`flex items-center gap-1 border rounded-lg px-2 py-1.5 ${
                      isDark
                        ? "bg-white/5 border-white/10"
                        : "bg-slate-800 border-slate-700"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-orange-500" />
                    <input
                      type="month"
                      value={filters.month}
                      onChange={(e) =>
                        setFilters((p: any) => ({
                          ...p,
                          month: e.target.value,
                        }))
                      }
                      className={`bg-transparent text-xs font-bold outline-none font-mono cursor-pointer flex-1 ${primaryText}`}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
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
                    className={`px-3 py-1.5 rounded-lg border flex items-center gap-1 font-bold text-[10px] transition cursor-pointer ${
                      filters.devidenPosition === "TOP_NET_SALES"
                        ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                        : "bg-blue-500/10 text-blue-300 border-blue-500/30"
                    }`}
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>
                      {filters.devidenPosition === "TOP_NET_SALES"
                        ? "Deviden Atas"
                        : "Deviden Bawah"}
                    </span>
                  </button>

                  <label
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer select-none text-[10px] font-bold ${
                      isDark
                        ? "bg-white/5 border-white/10"
                        : "bg-slate-800 border-slate-700"
                    }`}
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
                    <span className={primaryText}>Pajak PB1 & Servis</span>
                  </label>
                </div>
              </LiquidGlass>
            </motion.div>
          ) : (
            <motion.div
              key="main-dock"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-md"
            >
              <LiquidGlass
                isDark={isDark}
                className="ios-liquid-dock relative"
                onMouseMove={handleMouseMoveDock}
                onMouseLeave={updateIndicatorToActive}
              >
                <div
                  ref={dockRef}
                  className="flex flex-row justify-center items-center w-full relative gap-0.5"
                >
                  <motion.div
                    className="liquid-indicator"
                    initial={false}
                    animate={{ x: indicator.x, width: indicator.width }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 18,
                      mass: 1,
                    }}
                  />

                  {navItems.map((item, idx) => {
                    const isActive =
                      !item.isActionOnly && mobileTab === item.id;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        ref={(el) => (itemRefs.current[idx] = el)}
                        onClick={() => item.action()}
                        onMouseEnter={() => handleMouseEnterItem(idx)}
                        className={`nav-item-dock ${isActive ? "active" : ""}`}
                      >
                        <Icon className="w-5 h-5" />
                        <AnimatePresence>
                          {isActive && (
                            <motion.span
                              className="nav-label-dock"
                              initial={{ width: 0, opacity: 0 }}
                              animate={{ width: "auto", opacity: 1 }}
                              exit={{ width: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                            >
                              {item.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>
                    );
                  })}
                </div>
              </LiquidGlass>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
