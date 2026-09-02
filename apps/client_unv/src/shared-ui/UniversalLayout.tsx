// File: apps/client_unv/src/shared-ui/UniversalLayout.tsx
import { LicenseManager } from "../../../../packages/core_unv/src/ledger/licenseManager";
import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
} from "react";
import {
  Search,
  LogOut,
  ChevronDown,
  Bell,
  Settings,
  Circle,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  X,
  Boxes,
  Power,
  Box,
  ShieldCheck,
  Key,
  LayoutDashboard,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import { ActivityDrawer } from "./ActivityDrawer";
import { CommandPalette } from "./CommandPalette";
import { VirtualNumpad } from "./VirtualNumpad";
import { UniversalToast } from "./UniversalToast";
import { manager } from "../pluginRegistry";
import { sysToast } from "./useToastStore";

export interface MenuConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: {
    id: string;
    label: string;
    path: string;
    icon?: React.ReactNode;
  }[];
}

export interface UniversalLayoutProps {
  children: React.ReactNode;
  menus: MenuConfig[];
  activeMenuId: string;
  workspaceName?: string;
}

// ========== TIPE MODAL UNIVERSAL ==========
export interface AlertConfig {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface CenterModalConfig {
  title?: string;
  content: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
}

export interface SideOverConfig {
  title?: string;
  content: React.ReactNode;
  width?: string;
  onClose?: () => void;
}

interface UniversalModalContextValue {
  openAlert: (config: AlertConfig) => void;
  closeAlert: () => void;
  openCenterModal: (config: CenterModalConfig) => void;
  closeCenterModal: () => void;
  openSideOver: (config: SideOverConfig) => void;
  closeSideOver: () => void;
}

const UniversalModalContext = createContext<
  UniversalModalContextValue | undefined
>(undefined);

export const useUniversalModal = () => {
  const context = useContext(UniversalModalContext);
  if (!context) {
    throw new Error(
      "useUniversalModal harus digunakan di dalam UniversalLayout",
    );
  }
  return context;
};

// =========================================================================
// MODAL: KONFIGURASI MODUL KONTROL PERANGKAT
// =========================================================================
const ModuleManagerModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const allPlugins = manager.getAllPlugins();

  const [currentTier, setCurrentTier] = useState<string>(() => {
    return localStorage.getItem("__unv_license_tier") || "FREE";
  });

  const [allowedModules, setAllowedModules] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("__unv_allowed_modules");
      return raw ? JSON.parse(raw) : ["mdl_organization"];
    } catch {
      return ["mdl_organization"];
    }
  });

  // State Input Kunci Lisensi Baru
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [licenseInput, setLicenseInput] = useState("");

  const toggleModule = (modName: string, isCore?: boolean) => {
    if (isCore || modName === "mdl_organization") return;
    setAllowedModules((prev) =>
      prev.includes(modName)
        ? prev.filter((name) => name !== modName)
        : [...prev, modName],
    );
  };

  const handleEnableAll = () => {
    setAllowedModules(allPlugins.map((p) => p.name));
  };

  // VERIFIKASI & AKTIVASI KUNCI LISENSI SECARA INSTAN (OFFLINE-SAFE)
  const handleApplyLicenseKey = () => {
    if (!licenseInput.trim()) {
      return sysToast.error(
        "Error",
        "Tempelkan kunci lisensi terlebih dahulu!",
      );
    }

    const result = LicenseManager.verifyLicense(licenseInput.trim());
    if (!result.isValid) {
      return sysToast.error(
        "Lisensi Tidak Valid",
        result.errorMessage || "Kunci lisensi salah atau telah kedaluwarsa.",
      );
    }

    // 1. Simpan Tier & Token Baru
    localStorage.setItem("__unv_license_tier", result.tier);
    localStorage.setItem("__unv_license_token", licenseInput.trim());

    // 2. Gabungkan modul baru yang diizinkan oleh lisensi
    const newAllowed = Array.from(
      new Set([...allowedModules, ...result.allowedModules]),
    );
    localStorage.setItem("__unv_allowed_modules", JSON.stringify(newAllowed));

    setCurrentTier(result.tier);
    setAllowedModules(newAllowed);
    setShowKeyInput(false);
    setLicenseInput("");

    sysToast.success(
      "Lisensi Terverifikasi",
      `Paket ${result.tier} aktif untuk ${result.companyName || "Perusahaan"}. Masa aktif s/d ${result.validUntil ? new Date(result.validUntil).toLocaleDateString("id-ID") : "Selamanya"}`,
    );

    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const handleSave = () => {
    localStorage.setItem(
      "__unv_allowed_modules",
      JSON.stringify(allowedModules),
    );
    sysToast.success(
      "Modul Diperbarui",
      "Konfigurasi modul berhasil disimpan. Memuat ulang antarmuka...",
    );
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-(--bg-card) w-full max-w-2xl rounded-2xl shadow-2xl border border-(--border-color) overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-(--border-color) flex items-center justify-between bg-(--surface-hover) shrink-0">
          <div className="flex items-center gap-3">
            <Boxes className="w-5 h-5 text-orange-500" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-(--text-primary) uppercase tracking-wide">
                  Konfigurasi Modul &amp; Lisensi
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                    currentTier === "EXCLUSIVE"
                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      : currentTier === "PREMIUM"
                        ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  }`}
                >
                  TIER: {currentTier}
                </span>
              </div>
              <p className="text-[10px] text-(--text-secondary) font-bold">
                Aktifkan modul atau upgrade lisensi perusahaan secara instan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-(--text-secondary) hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BUKU AKTIVASI LISENSI BARU */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          <div className="p-3.5 bg-(--bg-input) rounded-xl border border-(--border-color) flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-orange-500" />
              <div>
                <span className="text-xs font-black text-(--text-primary) block">
                  Status Lisensi: Paket {currentTier}
                </span>
                <span className="text-[10px] text-(--text-secondary)">
                  {currentTier === "FREE"
                    ? "Menggunakan 7 Modul Inti Komunitas Gratis"
                    : "Lisensi Kriptografis Ed25519 Aktif"}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="px-3 py-1.5 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg text-[10px] font-black uppercase transition cursor-pointer flex items-center gap-1"
            >
              <Key className="w-3 h-3" />{" "}
              {showKeyInput ? "Tutup Form" : "Upgrade / Input Kunci"}
            </button>
          </div>

          {/* FORM AKTIVASI / PEMBELIAN LISENSI IN-APP */}
          {showKeyInput && (
            <div className="p-4 bg-orange-500/5 rounded-xl border border-orange-500/30 space-y-3 animate-in fade-in duration-150">
              <div className="flex justify-between items-center border-b border-orange-500/20 pb-2">
                <label className="text-[10px] font-black text-orange-500 uppercase">
                  Aktivasi atau Pembelian Lisensi Baru:
                </label>
                <span className="text-[9px] text-(--text-secondary)">
                  Bisa bayar langsung atau tempel kunci dari email
                </span>
              </div>

              {/* INPUT TEMPEL KUNCI (DARI EMAIL) */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-(--text-secondary) uppercase block">
                  1. Jika sudah punya kunci (dari Email / Kantor Pusat):
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={licenseInput}
                    onChange={(e) => setLicenseInput(e.target.value.trim())}
                    placeholder="Tempelkan kunci ALMA-LIC-... dari email Anda"
                    className="flex-1 text-xs font-mono font-bold p-2 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyLicenseKey}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-lg transition shadow-xs cursor-pointer shrink-0"
                  >
                    Terapkan Kunci
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 my-2">
                <div className="h-px bg-(--border-color) flex-1" />
                <span className="text-[9px] font-black text-(--text-secondary) uppercase">
                  ATAU
                </span>
                <div className="h-px bg-(--border-color) flex-1" />
              </div>

              {/* TOMBOL BELI LANGSUNG DI DALAM APLIKASI */}
              <div className="flex items-center justify-between p-2.5 bg-(--bg-card) rounded-lg border border-(--border-color)">
                <div>
                  <span className="text-xs font-black text-(--text-primary) block">
                    Beli Lisensi Baru via Midtrans
                  </span>
                  <span className="text-[9px] text-(--text-secondary)">
                    Bayar via QRIS / Bank Transfer • Kunci otomatis aktif
                    seketika
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    // Arahkan ke modal checkout atau buka landing page
                    window.open("/#paket", "_blank");
                  }}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase rounded-lg transition shadow-xs cursor-pointer"
                >
                  Beli via QRIS / VA
                </button>
              </div>
            </div>
          )}

          {/* DAFTAR CHECKBOX MODUL TERPASANG */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-(--text-secondary) uppercase tracking-wider">
                DAFTAR MODUL TERPASANG ({allPlugins.length})
              </span>
              <button
                onClick={handleEnableAll}
                className="text-[10px] font-black text-orange-500 hover:underline cursor-pointer"
              >
                + AKTIFKAN SEMUA MODUL
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allPlugins.map((plugin) => {
                const isSelected = allowedModules.includes(plugin.name);
                const isCore =
                  plugin.isCore || plugin.name === "mdl_organization";
                const PluginIcon = (
                  typeof plugin.icon === "function" ? plugin.icon : Box
                ) as React.ComponentType<{ className?: string }>;

                return (
                  <div
                    key={plugin.name}
                    onClick={() => toggleModule(plugin.name, isCore)}
                    className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? "border-orange-500 bg-orange-500/5 text-(--text-primary) shadow-xs"
                        : "border-(--border-color) bg-(--bg-input) text-(--text-secondary) opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          isSelected
                            ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                            : "bg-(--surface-hover) text-(--text-secondary)"
                        }`}
                      >
                        <PluginIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black flex items-center gap-1.5">
                          {plugin.displayName || plugin.name}
                          {isCore && (
                            <span className="text-[8px] bg-slate-900 text-white px-1.5 py-0.2 rounded font-black uppercase">
                              Wajib
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-(--text-secondary) mt-0.5 line-clamp-1">
                          {plugin.description || "Modul Bisnis Tambahan"}
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isCore}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 disabled:cursor-not-allowed"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-3.5 bg-(--surface-hover) border-t border-(--border-color) flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-(--text-secondary)">
            {allowedModules.length} dari {allPlugins.length} modul aktif
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-(--text-secondary) hover:bg-(--surface-hover) rounded-xl cursor-pointer"
            >
              BATAL
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Power className="w-3.5 h-3.5" /> SIMPAN &amp; TERAPKAN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== KOMPONEN MODAL ==========
const AlertDialog: React.FC<{ config: AlertConfig; onClose: () => void }> = ({
  config,
  onClose,
}) => {
  const handleConfirm = () => {
    config.onConfirm?.();
    onClose();
  };
  const handleCancel = () => {
    config.onCancel?.();
    onClose();
  };
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-(--bg-card) w-120 max-w-[90%] rounded-2xl shadow-2xl p-6 border border-(--border-color) animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-black text-(--text-primary) tracking-wide uppercase text-lg">
            {config.title || "Perhatian"}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-(--text-secondary) hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer -mt-1 -mr-1 shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm font-semibold text-(--text-secondary) mb-6">
          {config.message}
        </p>
        <div className="flex justify-end gap-3">
          {config.cancelText !== undefined && (
            <button
              onClick={handleCancel}
              className="px-5 py-2 text-xs font-bold text-(--text-secondary) hover:bg-(--surface-hover) rounded-lg transition cursor-pointer"
            >
              {config.cancelText || "BATAL"}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition shadow-[0_4px_10px_rgba(249,115,22,0.3)] cursor-pointer"
          >
            {config.confirmText || "OK"}
          </button>
        </div>
      </div>
    </div>
  );
};

const CenterModal: React.FC<{
  config: CenterModalConfig;
  onClose: () => void;
}> = ({ config, onClose }) => {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-(--bg-card) w-[80%] h-[80%] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-(--border-color) flex justify-between items-center bg-linear-to-r from-slate-800/5 to-transparent shrink-0">
          <h3 className="font-black text-(--text-primary) tracking-wide uppercase">
            {config.title || "Modal"}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-(--text-secondary) hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">{config.content}</div>
        {config.footer && (
          <div className="px-6 py-4 border-t border-(--border-color) shrink-0">
            {config.footer}
          </div>
        )}
      </div>
    </div>
  );
};

const SideOver: React.FC<{ config: SideOverConfig; onClose: () => void }> = ({
  config,
  onClose,
}) => {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="px-5 py-4 border-b border-(--border-color) flex justify-between items-center shrink-0 bg-transparent">
        <h3 className="font-black text-(--text-primary) tracking-wide uppercase">
          {config.title || "Panel"}
        </h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full text-(--text-secondary) hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
          title="Tutup Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {config.content}
      </div>
    </div>
  );
};

// ========== VERTICAL MENU PORTAL (Bubble Capsule & Liquid Glass Solid) ==========
const RadialMenuPortal: React.FC<{
  menu: MenuConfig;
  position: { x: number; y: number };
  closing: boolean;
  onAnimationEnd: () => void;
  onItemClick: (path: string) => void;
  OFFSET_X?: number;
  GAP?: number;
  BUBBLE_HEIGHT?: number;
}> = ({
  menu,
  position,
  closing,
  onAnimationEnd,
  onItemClick,
  OFFSET_X = 130,
  GAP = 8,
  BUBBLE_HEIGHT = 44,
}) => {
  const [animOpen, setAnimOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const t = setTimeout(() => setAnimOpen(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (closing) {
      setAnimOpen(false);
      const totalItems = menu.children?.length || 0;
      const maxDelay = 0.05 + (totalItems - 1) * 0.04;
      const duration = 0.45;
      const totalTime = (maxDelay + duration) * 1000 + 50;
      timeoutRef.current = setTimeout(() => onAnimationEnd(), totalTime);
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
  }, [closing, menu.children, onAnimationEnd]);

  if (!menu.children) return null;

  const total = menu.children.length;
  const spacing = BUBBLE_HEIGHT + GAP;

  const getVerticalItemStyle = (index: number) => {
    const y = (index - (total - 1) / 2) * spacing;
    const x = OFFSET_X;
    const delay = 0.05 + index * 0.04;
    return {
      left: 0,
      top: 0,
      transform: animOpen
        ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`
        : `translate(-50%, -50%) scale(0)`,
      opacity: animOpen ? 1 : 0,
      transition: `transform 0.45s cubic-bezier(0.34,1.56,0.64,1) ${delay}s, opacity 0.3s ${delay}s`,
    };
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="absolute pointer-events-auto"
        style={{ left: position.x, top: position.y }}
      >
        {menu.children.map((child, idx) => {
          const y = (idx - (total - 1) / 2) * spacing;
          const x = OFFSET_X;
          const delay = 0.05 + idx * 0.04;
          const pathD = `M 0 0 C ${x * 0.45} 0, ${x * 0.55} ${y}, ${x} ${y}`;

          return (
            <React.Fragment key={child.id}>
              <svg
                className="absolute left-0 top-0 pointer-events-none"
                width="500"
                height="500"
                style={{ overflow: "visible" }}
              >
                <path
                  d={pathD}
                  fill="none"
                  stroke="rgba(244,121,62,0.8)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{
                    filter: "drop-shadow(0 0 4px rgba(244,121,62,0.5))",
                    opacity: animOpen ? 1 : 0,
                    transition: `opacity 0.3s ${delay}s`,
                  }}
                />
              </svg>
              <button
                className="absolute left-0 top-0 group cursor-pointer"
                style={getVerticalItemStyle(idx)}
                onClick={() => onItemClick(child.path)}
              >
                <div className="flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-full bg-(--bg-card) border border-(--border-color) shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1.5px_1px_rgba(255,255,255,0.5),inset_0_-1.5px_1px_rgba(0,0,0,0.2)] group-hover:border-orange-500 group-hover:bg-orange-500/10 transition-all duration-300 group-hover:scale-105 backdrop-blur-xl whitespace-nowrap">
                  <span className="text-teal-400 group-hover:text-orange-500 transition-colors">
                    {child.icon || <Circle className="w-4 h-4" />}
                  </span>
                  <span className="text-sm font-bold text-(--text-primary) group-hover:text-orange-500 transition-colors">
                    {child.label}
                  </span>
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ========== LAYOUT UTAMA ==========
export function UniversalLayout({
  children,
  menus,
  activeMenuId,
  workspaceName = "Modul Control",
}: UniversalLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  // PERBAIKAN: inisialisasi expandedMenus agar semua submenu tertutup secara default
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(
    {},
  );
  const [radialOpenId, setRadialOpenId] = useState<string | null>(null);
  const [closingRadialId, setClosingRadialId] = useState<string | null>(null);
  const [radialPosition, setRadialPosition] = useState({ x: 0, y: 0 });
  // PERBAIKAN: default theme menjadi "light" (darkMode = false)
  const [darkMode, setDarkMode] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pingMs, setPingMs] = useState<number | null>(null);

  // REAL PING LATENCY DETECTOR (Pemeriksaan Setiap 10 Detik)
  useEffect(() => {
    let isMounted = true;

    const measurePing = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (isMounted) {
          setIsOnline(false);
          setPingMs(null);
        }
        return;
      }

      const startTime = performance.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const serverUrl =
          localStorage.getItem("__unv_serverUrl") || "https://api.almazain.my.id";

        const res = await fetch(`${serverUrl.replace(/\/+$/, "")}/api/health`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok && isMounted) {
          const latency = Math.round(performance.now() - startTime);
          setPingMs(latency);
          setIsOnline(true);
        } else if (isMounted) {
          setIsOnline(false);
          setPingMs(null);
        }
      } catch {
        if (isMounted) {
          setIsOnline(false);
          setPingMs(null);
        }
      }
    };

    measurePing();
    const interval = setInterval(measurePing, 10000);

    const handleOnline = () => measurePing();
    const handleOffline = () => {
      setIsOnline(false);
      setPingMs(null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  const [logoAnim, setLogoAnim] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modal Manager Trigger
  const [isModuleManagerOpen, setIsModuleManagerOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // State untuk Liquid Pill Sidebar
  const [hoveredMenuId, setHoveredMenuId] = useState<string | null>(null);
  const [focusedMenuId, setFocusedMenuId] = useState<string | null>(null);
  const sidebarListRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<React.CSSProperties>({
    top: 0,
    height: 0,
    left: 0,
    width: 0,
    opacity: 0,
  });

  // State Modal
  const [alertState, setAlertState] = useState<AlertConfig | null>(null);
  const [centerModalState, setCenterModalState] =
    useState<CenterModalConfig | null>(null);
  const [sideOverState, setSideOverState] = useState<SideOverConfig | null>(
    null,
  );

  const modalApi: UniversalModalContextValue = {
    openAlert: (config) => setAlertState(config),
    closeAlert: () => setAlertState(null),
    openCenterModal: (config) => setCenterModalState(config),
    closeCenterModal: () => setCenterModalState(null),
    openSideOver: (config) => setSideOverState(config),
    closeSideOver: () => setSideOverState(null),
  };

  useEffect(() => {
    const handleSecurityAlert = (e: any) => {
      const { title, message } = e.detail || {};
      modalApi.openAlert({
        title: title || "PERINGATAN KEAMANAN",
        message:
          message || "Perangkat ini telah digantikan. Sesi akan dibersihkan.",
        confirmText: "KEMBALI KE SETUP WIZARD",
        onConfirm: () => {
          localStorage.clear();
          window.location.reload();
        },
      });
    };
    window.addEventListener("UNV_SECURITY_ALERT", handleSecurityAlert);
    return () =>
      window.removeEventListener("UNV_SECURITY_ALERT", handleSecurityAlert);
  }, []);

  useEffect(() => {
    setFocusedMenuId(null);
  }, [activeMenuId]);

  // Logika Liquid Glass Pill Sidebar
  useEffect(() => {
    const listEl = sidebarListRef.current;
    if (!listEl || !isCollapsed) {
      setPillStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const updatePill = () => {
      const activeWrapper = listEl.querySelector(
        '[data-active="true"]',
      ) as HTMLElement;
      const hoverWrapper = hoveredMenuId
        ? (listEl.querySelector(
            `[data-menu-id="${hoveredMenuId}"]`,
          ) as HTMLElement)
        : null;
      if (activeWrapper) {
        const activeBtn = activeWrapper.querySelector("button") as HTMLElement;
        const hoverBtn = hoverWrapper?.querySelector("button") as HTMLElement;
        if (activeBtn) {
          const listRect = listEl.getBoundingClientRect();
          const aRect = activeBtn.getBoundingClientRect();
          let top = aRect.top - listRect.top + listEl.scrollTop;
          let bottom = aRect.bottom - listRect.top + listEl.scrollTop;
          let left = aRect.left - listRect.left + listEl.scrollLeft;
          let right = aRect.right - listRect.left + listEl.scrollLeft;

          if (hoverBtn) {
            const hRect = hoverBtn.getBoundingClientRect();
            top = Math.min(top, hRect.top - listRect.top + listEl.scrollTop);
            bottom = Math.max(
              bottom,
              hRect.bottom - listRect.top + listEl.scrollTop,
            );
          }
          setPillStyle({
            top: `${top}px`,
            height: `${bottom - top}px`,
            left: `${left}px`,
            width: `${right - left}px`,
            opacity: 1,
            transition:
              "top 0.5s cubic-bezier(0.22, 1, 0.36, 1), height 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease",
          });
        }
      } else {
        setPillStyle((prev) => ({ ...prev, opacity: 0 }));
      }
    };
    updatePill();
    listEl.addEventListener("scroll", updatePill);
    window.addEventListener("resize", updatePill);
    return () => {
      listEl.removeEventListener("scroll", updatePill);
      window.removeEventListener("resize", updatePill);
    };
  }, [
    isCollapsed,
    hoveredMenuId,
    activeMenuId,
    menus,
    location.pathname,
    expandedMenus,
    focusedMenuId,
  ]);

  const handleCloseRadial = () => {
    if (radialOpenId && !closingRadialId) setClosingRadialId(radialOpenId);
  };

  const handleRadialAnimationEnd = () => {
    setRadialOpenId(null);
    setClosingRadialId(null);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        radialOpenId &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        handleCloseRadial();
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [radialOpenId, closingRadialId]);

  useEffect(() => {
    if (!isCollapsed && radialOpenId && !closingRadialId) handleCloseRadial();
  }, [isCollapsed]);

  const handleRadialItemClick = (path: string) => {
    navigate(path);
    handleCloseRadial();
  };

  const toggleAccordion = (id: string) => {
    if (isCollapsed) return;
    setExpandedMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRadialOpen = (menuId: string, event: React.MouseEvent) => {
    if (closingRadialId) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setRadialPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setRadialOpenId(radialOpenId === menuId ? null : menuId);
  };

  const themeVars = {
    "--bg-app": darkMode ? "#090c13" : "#f0f2f5",
    "--bg-sidebar": darkMode ? "#0e1119" : "#ffffff",
    "--bg-header": darkMode ? "#0e1119" : "#ffffff",
    "--bg-card": darkMode ? "#111827" : "#ffffff",
    "--bg-input": darkMode ? "#0f172a" : "#f8fafc",
    "--text-primary": darkMode ? "#e8ecf1" : "#111827",
    "--text-secondary": darkMode ? "#94a3b8" : "#6b7280",
    "--border-color": darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    "--surface-hover": darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
  } as React.CSSProperties;

  const renderSidebarItem = (menu: MenuConfig) => {
    const hasChildren = !!menu.children?.length;
    // PERBAIKAN: ubah logika isExpanded agar default tertutup
    const isExpanded = !!expandedMenus[menu.id]; // sebelumnya: expandedMenus[menu.id] !== false
    const effectiveActiveId = isCollapsed
      ? (focusedMenuId ?? activeMenuId)
      : activeMenuId;
    const isActive =
      activeMenuId === menu.id ||
      menu.children?.some((c) => c.id === activeMenuId) ||
      (menu.path && location.pathname.includes(menu.path));
    const isPillActive = isCollapsed
      ? effectiveActiveId === menu.id ||
        menu.children?.some((c) => c.id === effectiveActiveId)
      : isActive;

    return (
      <div
        key={menu.id}
        className="mb-1 relative"
        data-menu-id={menu.id}
        data-active={isPillActive ? "true" : "false"}
        onMouseEnter={() => isCollapsed && setHoveredMenuId(menu.id)}
      >
        <button
          onClick={(e) => {
            if (isCollapsed && hasChildren) {
              setFocusedMenuId(menu.id);
              handleRadialOpen(menu.id, e);
            } else if (hasChildren) {
              toggleAccordion(menu.id);
            } else {
              if (isCollapsed) setFocusedMenuId(menu.id);
              navigate(menu.path || "");
              setRadialOpenId(null);
            }
          }}
          title={isCollapsed ? menu.label : undefined}
          className={`flex items-center transition-colors duration-300 cursor-pointer group relative z-10
            ${isCollapsed ? "w-12 h-12 rounded-full justify-center mx-auto bg-transparent border border-transparent" : "w-full gap-3.5 px-3 py-2.5 rounded-lg hover:bg-(--surface-hover) border border-transparent"}
            ${isActive && !isCollapsed ? "bg-linear-to-r from-orange-500/20 to-teal-500/10 text-(--text-primary)" : "text-(--text-secondary) hover:text-(--text-primary)"}
          `}
        >
          <div
            className={`shrink-0 ${isCollapsed ? "w-5 h-5 flex items-center justify-center" : ""}`}
          >
            {React.cloneElement(menu.icon as React.ReactElement, {
              className: `w-5 h-5 ${isActive ? "text-orange-500" : "text-(--text-secondary) group-hover:text-teal-400"}`,
            })}
          </div>
          {!isCollapsed && (
            <>
              <span className="text-sm font-medium flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                {menu.label}
              </span>
              {hasChildren && (
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-300 text-(--text-secondary) ${isExpanded ? "rotate-180" : ""}`}
                />
              )}
            </>
          )}
        </button>
        {!isCollapsed && hasChildren && (
          <div
            className={`overflow-hidden transition-all duration-700 ease-in-out ml-4 ${isExpanded ? "max-h-80 opacity-100 mt-1" : "max-h-0 opacity-0"}`}
          >
            <ul className="flex flex-col gap-1 border-l border-(--border-color) pl-4 ml-4">
              {menu.children!.map((child) => {
                const isChildActive =
                  activeMenuId === child.id ||
                  location.pathname.includes(child.path);
                return (
                  <li key={child.id}>
                    <button
                      onClick={() => navigate(child.path)}
                      className={`flex items-center gap-2 py-2 px-3 text-sm rounded-lg transition-all duration-200 w-full text-left group ${isChildActive ? "text-orange-500 bg-orange-500/10" : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--surface-hover)"}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${isChildActive ? "bg-orange-500 shadow-[0_0_8px_rgba(244,121,62,0.5)]" : "bg-slate-600 group-hover:bg-teal-400 group-hover:shadow-[0_0_8px_rgba(46,196,182,0.5)]"}`}
                      ></span>
                      {child.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const radialMenu = menus.find((m) => m.id === radialOpenId);
  const glassInputStyle =
    "bg-(--surface-hover) backdrop-blur-xl border border-(--border-color) shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.05)] transition-all duration-300";

  return (
    <UniversalModalContext.Provider value={modalApi}>
      <div
        className="flex flex-col h-screen w-screen overflow-hidden font-['Space_Grotesk',sans-serif] relative transition-colors duration-300"
        style={themeVars}
      >
        {/* Noise Texture Background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04] z-0"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
            backgroundRepeat: "repeat",
            mixBlendMode: "overlay",
          }}
        />

        {/* MODAL KONFIGURASI MODUL KONTROL */}
        {isModuleManagerOpen && (
          <ModuleManagerModal onClose={() => setIsModuleManagerOpen(false)} />
        )}

        <header className="h-16 bg-(--bg-header)/80 backdrop-blur-xl border-b border-(--border-color) flex items-center justify-between px-5 shrink-0 z-40 relative">
          <div
            className={`flex items-center gap-3 w-64 shrink-0 cursor-pointer px-3 py-1.5 rounded-2xl ${glassInputStyle} hover:border-orange-500/30`}
            onClick={() => setLogoAnim((prev) => !prev)}
          >
            <div className="relative w-9 h-9 flex items-center justify-center perspective-200">
              <div
                className={`w-full h-full flex items-center justify-center transform-style-3d ${logoAnim ? "animate-[logo-pop_0.8s_ease-out]" : "animate-[spin_18s_linear_infinite]"}`}
              >
                <span className="absolute font-['Syne',sans-serif] font-extrabold text-3xl text-orange-500/30 -translate-z-2 blur-sm">
                  Z
                </span>
                <span className="absolute font-['Syne',sans-serif] font-extrabold text-3xl bg-linear-to-br from-orange-400 via-orange-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(244,121,62,0.6)]">
                  Z
                </span>
              </div>
            </div>
            <span className="font-['Syne',sans-serif] font-extrabold text-xl tracking-tighter bg-linear-to-r from-orange-400 via-orange-500 to-yellow-400 bg-clip-text text-transparent animate-[title-shimmer_5s_linear_infinite] bg-size-[200%_auto]">
              AlmaAPP
            </span>
          </div>

          <div className="flex-1 max-w-xl mx-4 relative">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full ${glassInputStyle} focus-within:border-orange-500/40 focus-within:shadow-[0_0_15px_rgba(244,121,62,0.2),inset_0_1px_1px_rgba(255,255,255,0.25)]`}
            >
              <Search className="w-4 h-4 text-(--text-secondary)" />
              <input
                type="text"
                placeholder="Cari data di halaman ini..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-(--text-primary) placeholder:text-(--text-secondary) font-medium"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 bg-(--surface-hover) border border-(--border-color) rounded text-(--text-secondary) font-bold whitespace-nowrap shadow-[inset_0_-1px_1px_rgba(0,0,0,0.1)]">
                CTRL + K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate("/dashboard/executive")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 transition cursor-pointer shadow-xs"
              title="Buka Executive Owner Dashboard"
            >
              <LayoutDashboard className="w-4 h-4 text-orange-500" />
              <span className="hidden md:inline">Executive Portal</span>
            </button>
            {/* ================================================================= */}
            {/* KAPSUL "MODUL CONTROL" (KLIK UNTUK KONFIGURASI MODUL) */}
            {/* ================================================================= */}
            <button
              onClick={() => setIsModuleManagerOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-(--text-primary) ${glassInputStyle} hover:border-orange-500/40 cursor-pointer`}
              title="Klik untuk Mengatur &amp; Mengaktifkan Modul"
            >
              <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(46,196,182,0.6)]"></span>
              <span>{workspaceName}</span>
            </button>

            <div className="h-6 w-px bg-(--border-color)" />

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-full text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--surface-hover) ${glassInputStyle} cursor-pointer`}
            >
              {darkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={() => setIsDrawerOpen(true)}
              className={`relative p-2 rounded-full text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--surface-hover) ${glassInputStyle} cursor-pointer`}
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-(--bg-header)" />
            </button>

            <div
              className={`flex items-center gap-2 pl-1 pr-3 rounded-full cursor-pointer ${glassInputStyle}`}
            >
              <div className="w-8 h-8 rounded-full bg-linear-to-br from-orange-500 to-teal-500 flex items-center justify-center font-['Syne',sans-serif] font-bold text-white text-xs">
                RF
              </div>
              <div className="hidden lg:block text-left leading-tight">
                <div className="text-xs font-semibold text-(--text-primary)">
                  Rendi Faizal
                </div>
                <div className="text-[10px] text-(--text-secondary) uppercase">
                  Superadmin
                </div>
              </div>
            </div>

            <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative bg-(--bg-app)">
          <aside
            ref={sidebarRef}
            className={`flex shrink-0 bg-(--bg-sidebar)/80 backdrop-blur-xl border-r border-(--border-color) transition-all duration-700 z-30 ${sideOverState ? sideOverState.width || "w-96" : isCollapsed ? "w-23" : "w-65"}`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.77, 0, 0.175, 1)",
            }}
          >
            {sideOverState ? (
              <div className="flex flex-col h-full w-full animate-in fade-in slide-in-from-left-8 duration-500">
                <SideOver
                  config={sideOverState}
                  onClose={() => setSideOverState(null)}
                />
              </div>
            ) : (
              <div className="flex flex-col flex-1 overflow-hidden relative">
                <div className="absolute right-0 top-0 bottom-0 w-6 flex flex-col items-center justify-between py-2 z-20">
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="w-6 h-6 rounded-full bg-(--bg-sidebar) border border-(--border-color) flex items-center justify-center text-(--text-secondary) hover:text-orange-500 hover:border-orange-500 transition-all cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]"
                  >
                    <Settings
                      className={`w-3.5 h-3.5 transition-transform duration-700 ${isCollapsed ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div className="w-0.5 flex-1 my-2 bg-linear-to-b from-transparent via-(--border-color) to-transparent opacity-50" />
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="w-6 h-6 rounded-full bg-(--bg-sidebar) border border-(--border-color) flex items-center justify-center text-(--text-secondary) hover:text-teal-400 hover:border-teal-400 transition-all cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]"
                  >
                    <Settings
                      className={`w-3.5 h-3.5 transition-transform duration-700 ${isCollapsed ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
                <div
                  ref={sidebarListRef}
                  className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 custom-scrollbar space-y-3 relative"
                  onMouseLeave={() => setHoveredMenuId(null)}
                >
                  {/* LIQUID GLASS PILL SIDEBAR (Collapsed Mode Only) */}
                  {isCollapsed && (
                    <div
                      className="absolute rounded-full pointer-events-none z-0"
                      style={{
                        ...pillStyle,
                        background:
                          "linear-gradient(135deg, rgba(244, 121, 62, 0.2) 0%, rgba(14, 165, 233, 0.15) 100%)",
                        backdropFilter:
                          "blur(14px) saturate(180%) brightness(1.15)",
                        WebkitBackdropFilter:
                          "blur(14px) saturate(180%) brightness(1.15)",
                        border: "1px solid rgba(244, 121, 62, 0.3)",
                        boxShadow:
                          "0 4px 20px rgba(244, 121, 62, 0.15), inset 0 1.5px 1px rgba(255,255,255,0.25), inset 0 -1.5px 1px rgba(0,0,0,0.05)",
                      }}
                    />
                  )}
                  {menus.map((menu) => renderSidebarItem(menu))}
                </div>
              </div>
            )}
          </aside>
          {radialOpenId &&
            radialMenu &&
            createPortal(
              <RadialMenuPortal
                menu={radialMenu}
                position={radialPosition}
                closing={closingRadialId === radialOpenId}
                onAnimationEnd={handleRadialAnimationEnd}
                onItemClick={handleRadialItemClick}
                OFFSET_X={130}
                GAP={8}
                BUBBLE_HEIGHT={44}
              />,
              document.body,
            )}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-transparent relative z-10 p-6">
            <div className="w-full h-full relative">{children}</div>
            {alertState && (
              <AlertDialog
                config={alertState}
                onClose={() => setAlertState(null)}
              />
            )}
            {centerModalState && (
              <CenterModal
                config={centerModalState}
                onClose={() => setCenterModalState(null)}
              />
            )}
          </main>
        </div>

        <footer className="h-10 bg-(--bg-header)/80 backdrop-blur-xl border-t border-(--border-color) flex items-center justify-between px-5 shrink-0 z-40 text-[11px] font-medium text-(--text-secondary)">
          {/* SISI KIRI: INDIKATOR SINYAL & PING NYATA */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 select-none">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-rose-400" />
              )}
              <span
                className={`font-bold uppercase tracking-wider text-[10px] ${isOnline ? "text-emerald-400" : "text-rose-400"}`}
              >
                {isOnline ? "ONLINE" : "OFFLINE"}
              </span>

              {/* TINGKAT BAR SINYAL BERDASARKAN LATENSI NYATA */}
              <div className="flex items-end gap-0.5 h-3 ml-1">
                {[1, 2, 3, 4].map((bar) => {
                  const activeBars =
                    !isOnline || pingMs === null
                      ? 0
                      : pingMs < 50
                        ? 4
                        : pingMs < 150
                          ? 3
                          : pingMs < 300
                            ? 2
                            : 1;
                  const isBarLit = bar <= activeBars;
                  const barColor =
                    activeBars >= 3
                      ? "bg-emerald-400"
                      : activeBars === 2
                        ? "bg-amber-400"
                        : "bg-rose-500";

                  return (
                    <div
                      key={bar}
                      className={`w-0.75 rounded-t-sm transition-all duration-300 ${isBarLit ? barColor : "bg-slate-700 opacity-40"}`}
                      style={{ height: `${bar * 3}px` }}
                    />
                  );
                })}
              </div>

              {/* NILAI MS NYATA */}
              <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-(--surface-hover) rounded border border-(--border-color)">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" : "bg-rose-400"}`}
                />
                <span className="text-(--text-secondary) font-mono text-[11px] font-bold">
                  {isOnline && pingMs !== null ? `${pingMs} ms` : "-- ms"}
                </span>
              </div>
            </div>
          </div>

          {/* SISI TENGAH: IDENTITAS ALMA & FOUNDER */}
          <div className="flex items-center gap-2">
            <span className="text-(--text-secondary)">Developed by</span>
            <span className="text-(--text-primary) font-bold">
              Rendi Faizal Dat
            </span>
            <span className="w-4 h-4 flex items-center justify-center font-['Syne',sans-serif] font-extrabold text-sm bg-linear-to-br from-orange-400 to-orange-600 bg-clip-text text-transparent drop-shadow-[0_0_6px_rgba(244,121,62,0.5)]">
              Z
            </span>
            <span className="text-orange-500 font-black tracking-wide">
              ALMA PLATFORM
            </span>
          </div>

          {/* SISI KANAN: VERSI APLIKASI & BUILD TIMESTAMP NYATA */}
          <div className="flex items-center gap-2">
            <span className="text-(--text-secondary) font-mono text-[10px]">
              v
              <span className="text-orange-500 font-bold">
                {typeof __APP_VERSION__ !== "undefined"
                  ? __APP_VERSION__
                  : "2.1.0"}
              </span>{" "}
              build{" "}
              <span className="text-(--text-primary) font-bold">
                {typeof __BUILD_DATE__ !== "undefined"
                  ? __BUILD_DATE__
                  : "20260829"}
              </span>
            </span>
            <div className="h-4 w-px bg-(--border-color)" />
            <button
              onClick={() => navigate("/system/data-manager")}
              className="p-1 text-(--text-secondary) hover:text-orange-500 hover:bg-(--surface-hover) rounded transition-colors cursor-pointer flex items-center gap-1.5"
              title="Sistem Data Manager"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="font-bold tracking-wider text-[10px]">
                DATA MANAGER
              </span>
            </button>
          </div>
        </footer>

        <style>{`
          @keyframes title-shimmer { to { background-position: 200% center; } }
          @keyframes signal-bounce { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.3); } }
          @keyframes logo-pop { 0% { transform: perspective(600px) rotateY(-15deg) rotateX(10deg) scale(0.9); } 40% { transform: perspective(600px) rotateY(5deg) rotateX(-3deg) scale(1.08); } 100% { transform: perspective(600px) rotateY(0deg) rotateX(0deg) scale(1); } }
          .custom-scrollbar::-webkit-scrollbar { width: 5px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .perspective-200 { perspective: 200px; }
          .transform-style-3d { transform-style: preserve-3d; }
        `}</style>

        <CommandPalette menus={menus} />
        <VirtualNumpad />
        <UniversalToast />
        <ActivityDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
        />
      </div>
    </UniversalModalContext.Provider>
  );
}
