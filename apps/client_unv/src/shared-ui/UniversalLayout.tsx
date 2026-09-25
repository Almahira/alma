// ============================================================================
// File: apps/client_unv/src/shared-ui/UniversalLayout.tsx
// Layout universal ALMA ERP: Header, Sidebar, Footer, Modal, Radial Menu, PWA
// ============================================================================

// ---------------------------------------------------------------------------
// 1. IMPORTS
// ---------------------------------------------------------------------------
import { LicenseManager } from "../../../../packages/core_unv/src/ledger/licenseManager";
import { globalLedger } from "../../../../packages/core_unv/src/ledger/UniversalLedger";
import { useOrgStore } from "../../../../modules/mdl_organization/src/client/store";
import { manager } from "../pluginRegistry";
import { sysToast } from "./useToastStore";
import { EventBus } from "../../../../packages/core_unv/src/cqrs/EventBus";

import { ActivityDrawer } from "./ActivityDrawer";
import { CommandPalette } from "./CommandPalette";
import { UniversalToast } from "./UniversalToast";
import { VirtualNumpad } from "./VirtualNumpad";

import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  useMemo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// 2. ICONS
// ---------------------------------------------------------------------------
import {
  Search,
  Bell,
  Settings,
  ChevronDown,
  Circle,
  Boxes,
  Box,
  Store,
  Building2,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Key,
  Sun,
  Moon,
  Minimize2,
  Maximize2,
  Wifi,
  WifiOff,
  Power,
  Download,
  X,
  RefreshCw,
  AlertTriangle,
  Database,
} from "lucide-react";

// ============================================================================
// 3. TIPE & INTERFACE
// ============================================================================

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

// ============================================================================
// 4. CONTEXT MODAL
// ============================================================================

export const UniversalModalContext = createContext<
  UniversalModalContextValue | undefined
>(undefined);

export const useUniversalModal = () => {
  const context = useContext(UniversalModalContext);
  if (!context) {
    throw new Error("useUniversalModal harus dipakai di dalam UniversalLayout");
  }
  return context;
};

// ============================================================================
// 5. MODAL: MODUL & LISENSI
// ============================================================================

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

    localStorage.setItem("__unv_license_tier", result.tier);
    localStorage.setItem("__unv_license_token", licenseInput.trim());

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

    setTimeout(() => window.location.reload(), 600);
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
    setTimeout(() => window.location.reload(), 400);
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-(--bg-card) w-full max-w-2xl rounded-2xl shadow-2xl border border-(--border-color) overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
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

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {/* Status lisensi */}
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

          {/* Form aktivasi */}
          {showKeyInput && (
            <div className="p-4 bg-orange-500/5 rounded-xl border border-orange-500/30 space-y-3 animate-in fade-in duration-150">
              <div className="flex justify-between items-center border-b border-orange-500/20 pb-2">
                <label className="text-[10px] font-black text-orange-500 uppercase">
                  Aktivasi atau Pembelian Lisensi Baru:
                </label>
                <span className="text-[9px] text-(--text-secondary)">
                  Bayar langsung atau tempel kunci dari email
                </span>
              </div>

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

              <div className="flex items-center justify-between p-2.5 bg-(--bg-card) rounded-lg border border-(--border-color)">
                <div>
                  <span className="text-xs font-black text-(--text-primary) block">
                    Beli Lisensi Baru via Midtrans
                  </span>
                  <span className="text-[9px] text-(--text-secondary)">
                    Bayar via QRIS / Bank Transfer • Kunci otomatis aktif
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.open("/#paket", "_blank");
                  }}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase rounded-lg transition shadow-xs cursor-pointer"
                >
                  Beli via QRIS / VA
                </button>
              </div>
            </div>
          )}

          {/* Daftar modul */}
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

        {/* Footer */}
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

// ============================================================================
// 6. MODAL DASAR
// ============================================================================

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

// ============================================================================
// 7. RADIAL MENU PORTAL
// ============================================================================

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

// ============================================================================
// 8. STATUS KONEKSI & SINKRONISASI
// ============================================================================

const ConnectionStatus = React.memo(() => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pingMs, setPingMs] = useState<number | null>(null);

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
          localStorage.getItem("__unv_serverUrl") ||
          "https://api.almazain.my.id";

        const res = await fetch(`${serverUrl.replace(/\/+$/, "")}/api/health`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok && isMounted) {
          const latency = Math.round(performance.now() - startTime);
          setPingMs((prev) =>
            prev === null || Math.abs(latency - prev) > 20 ? latency : prev,
          );
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

  return (
    <div className="flex items-center gap-2 select-none">
      {isOnline ? (
        <Wifi className="w-4 h-4 text-emerald-400" />
      ) : (
        <WifiOff className="w-4 h-4 text-rose-400" />
      )}
      <span
        className={`font-bold uppercase tracking-wider text-[10px] ${
          isOnline ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        {isOnline ? "ONLINE" : "OFFLINE"}
      </span>

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
              className={`w-0.75 rounded-t-sm transition-all duration-300 ${
                isBarLit ? barColor : "bg-slate-700 opacity-40"
              }`}
              style={{ height: `${bar * 3}px` }}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-(--surface-hover) rounded border border-(--border-color)">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isOnline
              ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse"
              : "bg-rose-400"
          }`}
        />
        <span className="text-(--text-secondary) font-mono text-[11px] font-bold">
          {isOnline && pingMs !== null ? `${pingMs} ms` : "-- ms"}
        </span>
      </div>
    </div>
  );
});

const PendingSyncBadge = React.memo(() => {
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    let sub: any;
    const rxdb = globalLedger.getRxDatabase();
    if (rxdb && rxdb.collections.outbox) {
      sub = rxdb.collections.outbox.find().$.subscribe((docs: any[]) => {
        setPendingSyncCount((prev) =>
          prev !== docs.length ? docs.length : prev,
        );
      });
    }
    return () => {
      if (sub) sub.unsubscribe();
    };
  }, []);

  return pendingSyncCount > 0 ? (
    <div
      className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-amber-500/10 rounded border border-amber-500/30 text-amber-500 font-mono text-[11px] font-black animate-pulse"
      title="Transaksi tersimpan aman di memori lokal kasir, sedang mengantre terkirim ke server"
    >
      <span>⏳ {pendingSyncCount} Pending Sync</span>
    </div>
  ) : (
    <div
      className="hidden sm:flex items-center gap-1 ml-2 px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20 text-emerald-500 font-mono text-[10px] font-bold"
      title="Seluruh data lokal tersinkronisasi 100% ke server cloud"
    >
      <span>✓ 0 Pending</span>
    </div>
  );
});

// ============================================================================
// 9. SIDEBAR ITEM
// ============================================================================

const SidebarItem = React.memo(
  ({
    menu,
    isCollapsed,
    activeMenuId,
    focusedMenuId,
    pathname,
    isExpanded,
    onToggleAccordion,
    onNavigate,
    onHover,
    onRadialOpen,
  }: {
    menu: MenuConfig;
    isCollapsed: boolean;
    activeMenuId: string;
    focusedMenuId: string | null;
    pathname: string;
    isExpanded: boolean;
    onToggleAccordion: (id: string) => void;
    onNavigate: (path: string) => void;
    onHover: (menuId: string | null) => void;
    onRadialOpen: (menuId: string, event: React.MouseEvent) => void;
  }) => {
    const hasChildren = !!menu.children?.length;
    const effectiveActiveId = isCollapsed
      ? (focusedMenuId ?? activeMenuId)
      : activeMenuId;
    const isActive =
      activeMenuId === menu.id ||
      menu.children?.some((c) => c.id === activeMenuId) ||
      (menu.path && pathname.includes(menu.path));
    const isPillActive = isCollapsed
      ? effectiveActiveId === menu.id ||
        menu.children?.some((c) => c.id === effectiveActiveId)
      : isActive;

    return (
      <div
        className="mb-1 relative"
        data-menu-id={menu.id}
        data-active={isPillActive ? "true" : "false"}
        onMouseEnter={() => isCollapsed && onHover(menu.id)}
      >
        <button
          onClick={(e) => {
            if (isCollapsed && hasChildren) {
              onRadialOpen(menu.id, e);
            } else if (hasChildren) {
              onToggleAccordion(menu.id);
            } else {
              onNavigate(menu.path || "");
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
                  activeMenuId === child.id || pathname.includes(child.path);
                return (
                  <li key={child.id}>
                    <button
                      onClick={() => onNavigate(child.path)}
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
  },
);

// ============================================================================
// 10. LAYOUT UTAMA
// ============================================================================

export function UniversalLayout({
  children,
  menus,
  activeMenuId,
  workspaceName = "Modul Control",
}: UniversalLayoutProps) {
  // --- State dasar ---
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(
    {},
  );
  const [radialOpenId, setRadialOpenId] = useState<string | null>(null);
  const [closingRadialId, setClosingRadialId] = useState<string | null>(null);
  const [radialPosition, setRadialPosition] = useState({ x: 0, y: 0 });
  const [darkMode, setDarkMode] = useState(false);

  // --- Organisasi & outlet ---
  const { outlets, companies, userAccounts } = useOrgStore();
  const { regions } = useOrgStore();
  const [isOutletSwitcherOpen, setIsOutletSwitcherOpen] = useState(false);
  const outletSwitcherRef = useRef<HTMLDivElement>(null);

  const activeOutletId = localStorage.getItem("__unv_outletId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";

  const currentOutletName = React.useMemo(() => {
    if (!activeOutletId) return "Holding Pusat";
    return (
      outlets.find((o) => o.id === activeOutletId)?.name || "Cabang Outlet"
    );
  }, [outlets, activeOutletId]);

  // --- Deteksi user aktif ---
  const activeUser = React.useMemo(() => {
    try {
      const raw = localStorage.getItem("__unv_activeUser");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const currentAccount = React.useMemo(() => {
    if (!activeUser) return null;
    return userAccounts.find(
      (u) =>
        u.id === activeUser.id ||
        u.employeeId === activeUser.employeeId ||
        u.username === activeUser.username,
    );
  }, [userAccounts, activeUser]);

  // --- Daftar ruang kerja ---
  const availableWorkspaces = React.useMemo(() => {
    const workspaces = [];
    const localCompId = localStorage.getItem("__unv_companyId");

    if (localRegionId) {
      const userRegion = regions.find((r) => r.id === localRegionId);
      if (userRegion) {
        workspaces.push({
          id: userRegion.id,
          name: `🏢 DASHBOARD ${userRegion.name}`,
          type: "REGION",
        });
      }
    }

    const companyOutlets = outlets.filter(
      (o) =>
        o.status === "Aktif" && (!localCompId || o.companyId === localCompId),
    );

    let permittedOutlets = [];
    if (
      activeUser?.role === "SUPER_ADMIN" ||
      currentAccount?.role === "SUPER_ADMIN"
    ) {
      permittedOutlets = companyOutlets;
    } else if (
      Array.isArray(currentAccount?.allowedOutletIds) &&
      currentAccount.allowedOutletIds.length > 0
    ) {
      permittedOutlets = companyOutlets.filter((o) =>
        currentAccount.allowedOutletIds.includes(o.id),
      );
    } else {
      const single = companyOutlets.filter((o) => o.id === activeOutletId);
      permittedOutlets =
        single.length > 0 ? single : companyOutlets.slice(0, 1);
    }

    permittedOutlets.forEach((o) => {
      workspaces.push({
        id: o.id,
        name: `🏪 ${o.name}`,
        type: "OUTLET",
      });
    });

    return workspaces;
  }, [
    regions,
    outlets,
    activeUser,
    currentAccount,
    activeOutletId,
    localRegionId,
  ]);

  // --- Handler pindah ruang kerja ---
  const handleSwitchWorkspace = (workspace: {
    id: string;
    name: string;
    type: string;
  }) => {
    if (workspace.type === "REGION" && !activeOutletId) return;
    if (workspace.type === "OUTLET" && activeOutletId === workspace.id) return;

    if (workspace.type === "REGION") {
      localStorage.removeItem("__unv_outletId");
      localStorage.setItem("__unv_deviceScope", "REGION");
      sysToast.success("Pindah Ruang Kerja", `Kembali ke ${workspace.name}`);
    } else {
      localStorage.setItem("__unv_outletId", workspace.id);
      localStorage.setItem("__unv_deviceScope", "OUTLET");
      sysToast.success(
        "Pindah Cabang",
        `Ruang kerja beralih ke ${workspace.name}.`,
      );
    }

    setIsOutletSwitcherOpen(false);
    setTimeout(() => window.location.reload(), 250);
  };

  // --- Auto-close dropdown ---
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        outletSwitcherRef.current &&
        !outletSwitcherRef.current.contains(e.target as Node)
      ) {
        setIsOutletSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Kiosk / Fullscreen ---
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // --- PWA install ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
      sysToast.success(
        "Aplikasi Terpasang",
        "ALMA ERP siap dibuka dari Desktop.",
      );
    }
  };

  // --- State UI ---
  const [logoAnim, setLogoAnim] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModuleManagerOpen, setIsModuleManagerOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // --- Liquid pill sidebar ---
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

  // --- State modal ---
  const [alertState, setAlertState] = useState<AlertConfig | null>(null);
  const [centerModalState, setCenterModalState] =
    useState<CenterModalConfig | null>(null);
  const [sideOverState, setSideOverState] = useState<SideOverConfig | null>(
    null,
  );

  const modalApi: UniversalModalContextValue = useMemo(
    () => ({
      openAlert: (config) => setAlertState(config),
      closeAlert: () => setAlertState(null),
      openCenterModal: (config) => setCenterModalState(config),
      closeCenterModal: () => setCenterModalState(null),
      openSideOver: (config) => setSideOverState(config),
      closeSideOver: () => setSideOverState(null),
    }),
    [],
  );

  // ==========================================================================
  // STATE SINKRONISASI (dipindah ke scope utama agar bisa diakses header+footer)
  // ==========================================================================
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>(
    localStorage.getItem("__unv_last_sync_datetime") || "Belum pernah",
  );
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const handleStatus = (e: any) => {
      if (e.detail?.isSyncing !== undefined) setIsSyncing(e.detail.isSyncing);
      if (e.detail?.lastSync) setLastSync(e.detail.lastSync);
    };

    window.addEventListener("UNV_SYNC_STATUS", handleStatus);
    return () => window.removeEventListener("UNV_SYNC_STATUS", handleStatus);
  }, []);

  const handleConfirmFreshSync = async () => {
    try {
      setIsResetting(true);
      await EventBus.executeSafeLocalResync();
    } catch (err) {
      console.error("[FRESH SYNC ERROR]:", err);
      setIsResetting(false);
      setShowSyncModal(false);
    }
  };

  // --- Security alert listener ---
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
  }, [modalApi]);

  useEffect(() => {
    setFocusedMenuId(null);
  }, [activeMenuId]);

  // --- Logika liquid pill (rAF + ResizeObserver) ---
  useEffect(() => {
    const listEl = sidebarListRef.current;
    if (!listEl || !isCollapsed) {
      setPillStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }

    let rafId: number | null = null;
    const updatePill = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const activeWrapper = listEl.querySelector(
          '[data-active="true"]',
        ) as HTMLElement;
        const hoverWrapper = hoveredMenuId
          ? (listEl.querySelector(
              `[data-menu-id="${hoveredMenuId}"]`,
            ) as HTMLElement)
          : null;

        if (activeWrapper) {
          const activeBtn = activeWrapper.querySelector(
            "button",
          ) as HTMLElement;
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
      });
    };

    updatePill();

    const ro = new ResizeObserver(updatePill);
    ro.observe(listEl);
    listEl.addEventListener("scroll", updatePill);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      listEl.removeEventListener("scroll", updatePill);
    };
  }, [
    isCollapsed,
    hoveredMenuId,
    activeMenuId,
    location.pathname,
    focusedMenuId,
  ]);

  // --- Handler radial menu ---
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

  // --- Theme variables ---
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

  const radialMenu = menus.find((m) => m.id === radialOpenId);
  const glassInputStyle =
    "bg-(--surface-hover) backdrop-blur-xl border border-(--border-color) shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.05)] transition-all duration-300";

  // --- Profil user (dihitung tanpa IIFE berisi state) ---
  const profile = React.useMemo(() => {
    let fullName = "Rendi Faizal";
    let role = "Superadmin";
    try {
      const raw = localStorage.getItem("__unv_activeUser");
      if (raw) {
        const parsed = JSON.parse(raw);
        const name = parsed.fullName || parsed.username || "Karyawan";
        const parts = name.trim().split(" ");
        const initials =
          parts.length > 1
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : name.slice(0, 2).toUpperCase();
        return { fullName: name, role: parsed.role || "STAFF", initials };
      }
    } catch {}
    const parts = fullName.trim().split(" ");
    const initials =
      parts.length > 1
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : fullName.slice(0, 2).toUpperCase();
    return { fullName, role, initials };
  }, []);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <UniversalModalContext.Provider value={modalApi}>
      <div
        className="flex flex-col h-screen w-screen overflow-hidden font-['Space_Grotesk',sans-serif] relative transition-colors duration-300"
        style={themeVars}
      >
        {/* Modal konfigurasi modul */}
        {isModuleManagerOpen && (
          <ModuleManagerModal onClose={() => setIsModuleManagerOpen(false)} />
        )}

        {/* ================= HEADER ================= */}
        <header className="h-16 bg-(--bg-header)/80 backdrop-blur-xl border-b border-(--border-color) flex items-center justify-between px-5 shrink-0 z-40 relative">
          {/* Brand */}
          <div
            className={`flex items-center gap-2.5 w-40 shrink-0 px-3 py-1.5 rounded-2xl ${glassInputStyle}`}
          >
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
              <span className="font-['Syne',sans-serif] font-black text-xl text-white">
                Z
              </span>
            </div>
            <span className="font-['Syne',sans-serif] font-black text-xl tracking-tight text-orange-500">
              AlmaAPP
            </span>
          </div>

          {/* Pemilih ruang kerja */}
          {availableWorkspaces.length > 1 ? (
            <div className="relative" ref={outletSwitcherRef}>
              <button
                type="button"
                onClick={() => setIsOutletSwitcherOpen(!isOutletSwitcherOpen)}
                className={`hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 rounded-xl ${glassInputStyle} border-orange-500/40 hover:border-orange-500 transition cursor-pointer shrink-0`}
                title="Klik untuk berpindah ruang kerja"
              >
                <Store className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="text-xs font-black text-(--text-primary) uppercase tracking-wide">
                  {activeOutletId ? currentOutletName : `🏢 Dashboard Region`}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-orange-500 transition-transform duration-200 ${
                    isOutletSwitcherOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOutletSwitcherOpen && (
                <div className="absolute left-4 top-full mt-1.5 w-64 bg-(--bg-card) border border-(--border-color) rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1 text-[9px] font-black uppercase text-(--text-secondary) border-b border-(--border-color) mb-1">
                    PILIH RUANG KERJA:
                  </div>
                  <div className="max-h-56 overflow-y-auto custom-scrollbar">
                    {availableWorkspaces.map((workspace) => {
                      const isSelected =
                        (workspace.type === "OUTLET" &&
                          workspace.id === activeOutletId) ||
                        (workspace.type === "REGION" && !activeOutletId);

                      return (
                        <button
                          key={workspace.id}
                          type="button"
                          onClick={() => handleSwitchWorkspace(workspace)}
                          className={`w-full text-left px-3 py-2 text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "bg-orange-500/10 text-orange-500 font-black"
                              : "text-(--text-primary) hover:bg-(--surface-hover)"
                          }`}
                        >
                          <span className="truncate">{workspace.name}</span>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 rounded-xl ${glassInputStyle} border-orange-500/20 shrink-0`}
              title="Lokasi Operasional"
            >
              <Store className="w-4 h-4 text-orange-500 shrink-0" />
              <span className="text-xs font-black text-(--text-primary) uppercase tracking-wide">
                {currentOutletName}
              </span>
            </div>
          )}

          {/* Search bar */}
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

          {/* Tombol aksi */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate("/dashboard/executive")}
              className="p-2 rounded-full text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 transition cursor-pointer shadow-xs"
              title="Buka Executive Owner Dashboard"
            >
              <LayoutDashboard className="w-4 h-4" />
            </button>

            <div className="h-6 w-px bg-(--border-color)" />

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-full text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--surface-hover) ${glassInputStyle} cursor-pointer`}
              title={darkMode ? "Mode Terang" : "Mode Gelap"}
            >
              {darkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            {deferredPrompt && (
              <button
                onClick={handleInstallPWA}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition cursor-pointer shadow-xs animate-bounce"
                title="Pasang Aplikasi ALMA ke Layar Desktop / Home"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className={`p-2 rounded-full text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--surface-hover) ${glassInputStyle} cursor-pointer`}
              title={
                isFullscreen
                  ? "Keluar Layar Penuh"
                  : "Layar Penuh (Kiosk Kasir)"
              }
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5 text-orange-500" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={() => setIsDrawerOpen(true)}
              className={`relative p-2 rounded-full text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--surface-hover) ${glassInputStyle} cursor-pointer`}
              title="Buka Aktivitas / Notifikasi"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-(--bg-header)" />
            </button>

            {/* Profil user */}
            <div
              className={`flex items-center gap-2 pl-1 pr-3 rounded-full cursor-pointer ${glassInputStyle}`}
              title={`Sedang bertugas: ${profile.fullName} (${profile.role})`}
            >
              <div className="w-8 h-8 rounded-full bg-linear-to-br from-orange-500 to-teal-500 flex items-center justify-center font-['Syne',sans-serif] font-bold text-white text-xs shadow-xs">
                {profile.initials}
              </div>
              <div className="hidden lg:block text-left leading-tight">
                <div className="text-xs font-semibold text-(--text-primary)">
                  {profile.fullName}
                </div>
                <div className="text-[10px] text-(--text-secondary) uppercase font-mono font-bold">
                  {profile.role}
                </div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={() => {
                modalApi.openAlert({
                  title: "Kunci Sesi / Ganti Shift",
                  message:
                    "Apakah Anda yakin ingin keluar dari sesi kerja saat ini? Layar akan dikunci untuk shift kasir berikutnya.",
                  confirmText: "KUNCI & KELUAR",
                  cancelText: "BATAL",
                  onConfirm: () => {
                    localStorage.removeItem("__unv_activeUser");
                    window.location.reload();
                  },
                });
              }}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
              title="Kunci Layar / Logout Kasir"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ================= BODY ================= */}
        <div className="flex-1 flex overflow-hidden relative bg-(--bg-app)">
          {/* Sidebar */}
          <aside
            ref={sidebarRef}
            className={`flex shrink-0 bg-(--bg-sidebar)/80 backdrop-blur-xl border-r border-(--border-color) transition-all duration-700 z-30 ${
              sideOverState
                ? sideOverState.width || "w-96"
                : isCollapsed
                  ? "w-23"
                  : "w-65"
            }`}
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
                {/* Collapse toggle */}
                <div className="absolute right-0 top-0 bottom-0 w-6 flex flex-col items-center justify-between py-2 z-20">
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="w-6 h-6 rounded-full bg-(--bg-sidebar) border border-(--border-color) flex items-center justify-center text-(--text-secondary) hover:text-orange-500 hover:border-orange-500 transition-all cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]"
                    title={isCollapsed ? "Perluas Sidebar" : "Ciutkan Sidebar"}
                  >
                    <Settings
                      className={`w-3.5 h-3.5 transition-transform duration-700 ${isCollapsed ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div className="w-0.5 flex-1 my-2 bg-linear-to-b from-transparent via-(--border-color) to-transparent opacity-50" />
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="w-6 h-6 rounded-full bg-(--bg-sidebar) border border-(--border-color) flex items-center justify-center text-(--text-secondary) hover:text-teal-400 hover:border-teal-400 transition-all cursor-pointer shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]"
                    title={isCollapsed ? "Perluas Sidebar" : "Ciutkan Sidebar"}
                  >
                    <Settings
                      className={`w-3.5 h-3.5 transition-transform duration-700 ${isCollapsed ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>

                {/* Menu list */}
                <div
                  ref={sidebarListRef}
                  className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 custom-scrollbar space-y-3 relative"
                  onMouseLeave={() => setHoveredMenuId(null)}
                >
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

                  {menus.map((menu) => (
                    <SidebarItem
                      key={menu.id}
                      menu={menu}
                      isCollapsed={isCollapsed}
                      activeMenuId={activeMenuId}
                      focusedMenuId={focusedMenuId}
                      pathname={location.pathname}
                      isExpanded={!!expandedMenus[menu.id]}
                      onToggleAccordion={toggleAccordion}
                      onNavigate={(path) => {
                        if (isCollapsed) setFocusedMenuId(menu.id);
                        navigate(path);
                        setRadialOpenId(null);
                      }}
                      onHover={setHoveredMenuId}
                      onRadialOpen={(menuId, e) => {
                        if (closingRadialId) return;
                        setFocusedMenuId(menuId);
                        const rect = (
                          e.currentTarget as HTMLElement
                        ).getBoundingClientRect();
                        setRadialPosition({
                          x: rect.left + rect.width / 2,
                          y: rect.top + rect.height / 2,
                        });
                        setRadialOpenId(
                          radialOpenId === menuId ? null : menuId,
                        );
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Radial menu portal */}
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

          {/* Main content */}
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

        {/* ================= FOOTER ================= */}
        <footer className="h-10 bg-(--bg-header)/80 backdrop-blur-xl border-t border-(--border-color) flex items-center justify-between px-5 shrink-0 z-40 text-[11px] font-medium text-(--text-secondary)">
          {/* Kiri: sinyal, pending sync, riwayat sinkron */}
          <div className="flex items-center gap-3">
            <ConnectionStatus />
            <PendingSyncBadge />

            <div className="h-3.5 w-px bg-(--border-color)" />

            <div className="flex items-center gap-1.5">
              <span className="flex h-1.5 w-1.5 relative">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isSyncing ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                    isSyncing ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                ></span>
              </span>
              <span className="text-(--text-secondary) text-[10.5px]">
                Sync:{" "}
                <strong className="text-(--text-primary) font-mono font-semibold">
                  {lastSync}
                </strong>
              </span>

              <button
                type="button"
                onClick={() => setShowSyncModal(true)}
                title="Klik untuk Sinkronisasi Penuh & Pembersihan Cache Storage"
                className="p-1 text-(--text-secondary) hover:text-orange-500 hover:bg-(--surface-hover) rounded transition-colors cursor-pointer flex items-center justify-center"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isSyncing ? "animate-spin text-amber-500" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* Tengah: identitas */}
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

          {/* Kanan: versi & modul control */}
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
            <button
              onClick={() => setIsModuleManagerOpen(true)}
              className="p-1 text-(--text-secondary) hover:text-orange-500 hover:bg-(--surface-hover) rounded transition-colors cursor-pointer flex items-center gap-1.5"
              title="Klik untuk Mengatur & Mengaktifkan Modul"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="text-(--text-primary) font-bold">
                {workspaceName}
              </span>
            </button>
          </div>
        </footer>

        {/* Modal konfirmasi fresh sync */}
        {showSyncModal && (
          <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-(--bg-header) border border-(--border-color) rounded-xl shadow-2xl max-w-md w-full p-5 text-(--text-primary)">
              <div className="flex items-start justify-between pb-3 border-b border-(--border-color)">
                <div className="flex items-center gap-2 text-amber-500">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h3 className="font-bold text-sm text-(--text-primary)">
                    Konfirmasi Sinkronisasi Penuh
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => setShowSyncModal(false)}
                  className="text-(--text-secondary) hover:text-(--text-primary) p-1 rounded-md transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-3 text-xs leading-relaxed text-(--text-secondary)">
                <p>
                  Tindakan ini akan{" "}
                  <strong className="text-(--text-primary)">
                    membersihkan penyimpanan internal browser (IndexedDB &amp;
                    Cache)
                  </strong>{" "}
                  pada perangkat ini untuk menjamin data benar-benar segar dan
                  bebas dari selisih versi dengan server pusat.
                </p>
                <div className="bg-(--surface-hover) p-3 rounded-lg border border-(--border-color) space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-2 text-orange-500 font-semibold">
                    <Database className="w-3.5 h-3.5" />
                    <span>Prosedur pembersihan:</span>
                  </div>
                  <ul className="list-disc list-inside text-(--text-secondary) space-y-1">
                    <li>Mengosongkan cache antrean lokal.</li>
                    <li>
                      Mengunduh ulang seluruh Master Data &amp; Transaksi dari
                      server.
                    </li>
                    <li>Sesi login saat ini akan ditutup secara aman.</li>
                  </ul>
                </div>
                <p className="text-amber-500/90 text-[10.5px]">
                  *Pastikan perangkat terhubung internet sebelum melanjutkan.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-(--border-color)">
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => setShowSyncModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-(--text-secondary) hover:bg-(--surface-hover) border border-(--border-color) transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={handleConfirmFreshSync}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`}
                  />
                  {isResetting
                    ? "Membersihkan Storage..."
                    : "Bersihkan & Sinkronkan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global overlays */}
        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 5px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
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
