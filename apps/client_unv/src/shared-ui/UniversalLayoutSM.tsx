// ============================================================================
// File: apps/client_unv/src/shared-ui/UniversalLayoutSM.tsx
// Deskripsi: Layout universal versi MOBILE untuk seluruh modul ALMA ERP
// Berisi: Header, Drawer Navigasi, Footer, Modal System, PWA Install
// ============================================================================

// ---------------------------------------------------------------------------
// 1. IMPORTS
// ---------------------------------------------------------------------------
import { LicenseManager } from "../../../../packages/core_unv/src/ledger/licenseManager";
import { globalLedger } from "../../../../packages/core_unv/src/ledger/UniversalLedger";
import { EventBus } from "../../../../packages/core_unv/src/cqrs/EventBus";
import { useOrgStore } from "../../../../modules/mdl_organization/src/client/store";
import { manager } from "../pluginRegistry";
import { sysToast } from "./useToastStore";

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
  memo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";

// ---------------------------------------------------------------------------
// 2. ICONS (Lucide React)
// ---------------------------------------------------------------------------
import {
  // Navigation & Menu
  Menu,
  ChevronDown,
  X,

  // Brand & Modules
  Boxes,
  Box,
  Store,
  Building2,
  LayoutDashboard,
  Database,

  // User & Auth
  LogOut,
  ShieldCheck,
  Key,

  // Theme & Display
  Sun,
  Moon,

  // Status & Connectivity
  Wifi,
  WifiOff,

  // Actions
  Bell,
  Settings,
  Download,
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

export interface UniversalLayoutSMProps {
  children: React.ReactNode;
  menus: MenuConfig[];
  activeMenuId: string;
  workspaceName?: string;
}

// ---------- Tipe Modal Universal ----------
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
  width?: string; // Diabaikan di mobile, selalu fullscreen
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
// 4. CONTEXT MODAL UNIVERSAL
// ============================================================================

const UniversalModalContext = createContext<
  UniversalModalContextValue | undefined
>(undefined);

export const useUniversalModal = () => {
  const context = useContext(UniversalModalContext);
  if (!context) {
    throw new Error(
      "useUniversalModal harus digunakan di dalam UniversalLayoutSM",
    );
  }
  return context;
};

// ============================================================================
// 5. MODAL: KONFIGURASI MODUL & LISENSI (MOBILE OPTIMIZED)
// ============================================================================

const ModuleManagerModal: React.FC<{ onClose: () => void }> = memo(
  ({ onClose }) => {
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

    // ---------- Toggle Modul ----------
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

    // ---------- Verifikasi & Aktivasi Kunci Lisensi ----------
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
      <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm">
        <div className="bg-(--bg-card) w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border border-(--border-color) overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-300">
          {/* ---------- Header Modal ---------- */}
          <div className="px-4 py-3 border-b border-(--border-color) flex items-center justify-between bg-(--surface-hover) shrink-0">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-orange-500" />
              <div>
                <h3 className="font-black text-sm text-(--text-primary) uppercase tracking-wide flex items-center gap-2">
                  Modul &amp; Lisensi
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                      currentTier === "EXCLUSIVE"
                        ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                        : currentTier === "PREMIUM"
                          ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                          : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    }`}
                  >
                    {currentTier}
                  </span>
                </h3>
                <p className="text-[10px] text-(--text-secondary) font-bold">
                  Aktifkan modul atau upgrade lisensi
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-(--text-secondary) hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ---------- Body Modal ---------- */}
          <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-4">
            {/* Status Lisensi */}
            <div className="p-3 bg-(--bg-input) rounded-xl border border-(--border-color) flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-orange-500" />
                <div>
                  <span className="text-xs font-black text-(--text-primary) block">
                    Paket {currentTier}
                  </span>
                  <span className="text-[10px] text-(--text-secondary)">
                    {currentTier === "FREE"
                      ? "7 Modul Inti Gratis"
                      : "Lisensi Aktif"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="px-3 py-1.5 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
              >
                <Key className="w-3 h-3" />
                {showKeyInput ? "Tutup" : "Upgrade"}
              </button>
            </div>

            {/* Form Aktivasi Lisensi */}
            {showKeyInput && (
              <div className="p-3 bg-orange-500/5 rounded-xl border border-orange-500/30 space-y-3">
                <label className="text-[10px] font-black text-orange-500 uppercase">
                  Input Kunci Lisensi
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={licenseInput}
                    onChange={(e) => setLicenseInput(e.target.value.trim())}
                    placeholder="Tempel kunci ALMA-LIC-..."
                    className="flex-1 text-xs font-mono font-bold p-2 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={handleApplyLicenseKey}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-lg cursor-pointer"
                  >
                    Terapkan
                  </button>
                </div>
                <div className="flex items-center gap-2 my-1">
                  <div className="h-px bg-(--border-color) flex-1" />
                  <span className="text-[9px] font-black text-(--text-secondary) uppercase">
                    ATAU
                  </span>
                  <div className="h-px bg-(--border-color) flex-1" />
                </div>
                <button
                  onClick={() => {
                    onClose();
                    window.open("/#paket", "_blank");
                  }}
                  className="w-full px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase rounded-lg cursor-pointer"
                >
                  Beli via QRIS / VA
                </button>
              </div>
            )}

            {/* Daftar Modul */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-(--text-secondary) uppercase">
                  Modul Terpasang ({allPlugins.length})
                </span>
                <button
                  onClick={handleEnableAll}
                  className="text-[10px] font-black text-orange-500 cursor-pointer"
                >
                  AKTIFKAN SEMUA
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2">
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
                      className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? "border-orange-500 bg-orange-500/5"
                          : "border-(--border-color) bg-(--bg-input) opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isSelected
                              ? "bg-orange-500 text-white"
                              : "bg-(--surface-hover) text-(--text-secondary)"
                          }`}
                        >
                          <PluginIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black flex items-center gap-1">
                            {plugin.displayName || plugin.name}
                            {isCore && (
                              <span className="text-[8px] bg-slate-900 text-white px-1 rounded">
                                WAJIB
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] text-(--text-secondary)">
                            {plugin.description || "Modul Bisnis"}
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isCore}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-orange-500"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ---------- Footer Modal ---------- */}
          <div className="px-4 py-3 bg-(--surface-hover) border-t border-(--border-color) flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-(--text-secondary)">
              {allowedModules.length}/{allPlugins.length} aktif
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-3 py-2 text-xs font-bold text-(--text-secondary) rounded-lg cursor-pointer"
              >
                BATAL
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-xs font-black text-white bg-orange-500 rounded-lg cursor-pointer"
              >
                SIMPAN
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

// ============================================================================
// 6. KOMPONEN MODAL DASAR (MOBILE)
// ============================================================================

// ---------- Alert Dialog ----------
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
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-(--bg-card) w-full max-w-sm rounded-2xl shadow-2xl p-5 border border-(--border-color) animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-black text-(--text-primary) uppercase text-base">
            {config.title || "Perhatian"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-(--text-secondary) hover:text-rose-500 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm font-semibold text-(--text-secondary) mb-6">
          {config.message}
        </p>
        <div className="flex justify-end gap-2">
          {config.cancelText !== undefined && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-xs font-bold text-(--text-secondary) rounded-lg cursor-pointer"
            >
              {config.cancelText || "BATAL"}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className="px-5 py-2 text-xs font-black text-white bg-orange-500 rounded-lg cursor-pointer"
          >
            {config.confirmText || "OK"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- Center Modal (Fullscreen di Mobile) ----------
const CenterModal: React.FC<{
  config: CenterModalConfig;
  onClose: () => void;
}> = ({ config, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-(--bg-card) w-full h-full sm:w-[90%] sm:h-[85%] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-(--border-color) flex justify-between items-center shrink-0">
          <h3 className="font-black text-(--text-primary) uppercase text-sm">
            {config.title || "Modal"}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-(--text-secondary) hover:text-rose-500 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">{config.content}</div>
        {config.footer && (
          <div className="px-4 py-3 border-t border-(--border-color) shrink-0">
            {config.footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- Side Over (Mobile: Full Width Slide dari Kanan) ----------
const SideOver: React.FC<{ config: SideOverConfig; onClose: () => void }> = ({
  config,
  onClose,
}) => {
  return (
    <div className="flex flex-col h-full w-full bg-(--bg-card)">
      <div className="px-4 py-3 border-b border-(--border-color) flex justify-between items-center shrink-0">
        <h3 className="font-black text-(--text-primary) uppercase text-sm">
          {config.title || "Panel"}
        </h3>
        <button
          onClick={onClose}
          className="p-2 rounded-full text-(--text-secondary) hover:text-rose-500 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{config.content}</div>
    </div>
  );
};

// ============================================================================
// 7. KOMPONEN STATUS KONEKSI & SINKRONISASI (HEMAT BATERAI)
// ============================================================================

// ---------- Connection Status (Mobile-friendly) ----------
const ConnectionStatus = memo(() => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const measurePing = async () => {
    if (document.hidden) return; // Jangan ping saat tab tidak aktif
    if (!navigator.onLine) {
      setIsOnline(false);
      setPingMs(null);
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

      if (res.ok) {
        const latency = Math.round(performance.now() - startTime);
        setPingMs((prev) =>
          prev === null || Math.abs(latency - prev) > 20 ? latency : prev,
        );
        setIsOnline(true);
      } else {
        setIsOnline(false);
        setPingMs(null);
      }
    } catch {
      setIsOnline(false);
      setPingMs(null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const wrapper = () => {
      if (isMounted) measurePing();
    };

    wrapper();
    // Interval lebih jarang untuk hemat baterai: 15 detik
    intervalRef.current = setInterval(wrapper, 15000);

    const handleOnline = () => wrapper();
    const handleOffline = () => {
      setIsOnline(false);
      setPingMs(null);
    };
    const handleVisibility = () => {
      if (!document.hidden) wrapper();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      {isOnline ? (
        <Wifi className="w-4 h-4 text-emerald-400" />
      ) : (
        <WifiOff className="w-4 h-4 text-rose-400" />
      )}
      <span
        className={`font-bold uppercase text-[10px] ${
          isOnline ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        {isOnline ? "ON" : "OFF"}
      </span>
      {isOnline && pingMs !== null && (
        <span className="text-[10px] text-(--text-secondary) font-mono">
          {pingMs}ms
        </span>
      )}
    </div>
  );
});

// ---------- Pending Sync Badge (Compact) ----------
const PendingSyncBadge = memo(() => {
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
    <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
      ⏳ {pendingSyncCount}
    </span>
  ) : (
    <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
      ✓ 0
    </span>
  );
});

// ============================================================================
// 8. KOMPONEN DRAWER MENU ITEM (ACCORDION)
// ============================================================================

const DrawerMenuItem: React.FC<{
  menu: MenuConfig;
  activeMenuId: string;
  pathname: string;
  onNavigate: (path: string) => void;
}> = memo(({ menu, activeMenuId, pathname, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = !!menu.children?.length;
  const isActive =
    activeMenuId === menu.id ||
    menu.children?.some((c) => c.id === activeMenuId) ||
    (menu.path && pathname.includes(menu.path));

  return (
    <div className="mb-1">
      <button
        onClick={() => {
          if (hasChildren) {
            setIsOpen(!isOpen);
          } else if (menu.path) {
            onNavigate(menu.path);
          }
        }}
        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors cursor-pointer ${
          isActive
            ? "bg-orange-500/10 text-orange-500"
            : "text-(--text-primary) hover:bg-(--surface-hover)"
        }`}
      >
        <span className="w-5 h-5 shrink-0">
          {React.cloneElement(menu.icon as React.ReactElement, {
            className: `w-5 h-5 ${isActive ? "text-orange-500" : "text-(--text-secondary)"}`,
          })}
        </span>
        <span className="flex-1 text-sm font-medium">{menu.label}</span>
        {hasChildren && (
          <ChevronDown
            className={`w-4 h-4 text-(--text-secondary) transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {hasChildren && (
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isOpen ? "max-h-96" : "max-h-0"
          }`}
        >
          <div className="ml-7 border-l border-(--border-color) pl-3 mt-1 space-y-1">
            {menu.children!.map((child) => {
              const isChildActive =
                activeMenuId === child.id || pathname.includes(child.path);
              return (
                <button
                  key={child.id}
                  onClick={() => onNavigate(child.path)}
                  className={`w-full flex items-center gap-2 py-2.5 px-3 text-sm rounded-lg cursor-pointer ${
                    isChildActive
                      ? "text-orange-500 bg-orange-500/10"
                      : "text-(--text-secondary) hover:bg-(--surface-hover)"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isChildActive ? "bg-orange-500" : "bg-slate-500"
                    }`}
                  />
                  {child.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// 9. LAYOUT UTAMA MOBILE
// ============================================================================

export function UniversalLayoutSM({
  children,
  menus,
  activeMenuId,
  workspaceName = "Modul Control",
}: UniversalLayoutSMProps) {
  // ---------- State Dasar ----------
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isModuleManagerOpen, setIsModuleManagerOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isOutletModalOpen, setIsOutletModalOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // ---------- Organisasi & Outlet ----------
  const { outlets, userAccounts, regions } = useOrgStore();
  const activeOutletId = localStorage.getItem("__unv_outletId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";

  const currentOutletName = useMemo(() => {
    if (!activeOutletId) return "Holding Pusat";
    return (
      outlets.find((o) => o.id === activeOutletId)?.name || "Cabang Outlet"
    );
  }, [outlets, activeOutletId]);

  // ---------- Deteksi User Aktif ----------
  const activeUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("__unv_activeUser");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const currentAccount = useMemo(() => {
    if (!activeUser) return null;
    return userAccounts.find(
      (u) =>
        u.id === activeUser.id ||
        u.employeeId === activeUser.employeeId ||
        u.username === activeUser.username,
    );
  }, [userAccounts, activeUser]);

  // ---------- Daftar Ruang Kerja (Region + Outlet) ----------
  const availableWorkspaces = useMemo(() => {
    const workspaces: {
      id: string;
      name: string;
      type: "REGION" | "OUTLET";
    }[] = [];
    const localCompId = localStorage.getItem("__unv_companyId");

    // 1. Jika user memiliki ikatan Region, masukkan opsi kembali ke Dashboard Region
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

    // 2. Filter outlet aktif di perusahaan yang sama
    const companyOutlets = outlets.filter(
      (o) =>
        o.status === "Aktif" && (!localCompId || o.companyId === localCompId),
    );

    // 3. Batasi outlet sesuai hak akses user (RBAC)
    let permittedOutlets: typeof companyOutlets = [];
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

  // ---------- Handler Pindah Ruang Kerja ----------
  const handleSwitchWorkspace = (workspace: {
    id: string;
    name: string;
    type: "REGION" | "OUTLET";
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

    setIsOutletModalOpen(false);
    setTimeout(() => {
      window.location.reload();
    }, 250);
  };

  // ---------- State Modal ----------
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

  // ---------- Security Alert Listener ----------
  useEffect(() => {
    const handleSecurityAlert = (e: any) => {
      const { title, message } = e.detail || {};
      modalApi.openAlert({
        title: title || "PERINGATAN KEAMANAN",
        message:
          message || "Perangkat ini telah digantikan. Sesi akan dibersihkan.",
        confirmText: "KEMBALI KE SETUP",
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

  // ---------- Smart PWA Install Button ----------
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
      sysToast.success("Aplikasi Terpasang", "ALMA siap digunakan.");
    }
  };

  // ---------- Theme Variables ----------
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

  const handleNavigate = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  // ---------- Profil User untuk Drawer ----------
  let userProfile = {
    fullName: "Rendi Faizal",
    role: "Superadmin",
    initials: "RF",
  };
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
      userProfile = {
        fullName: name,
        role: parsed.role || "STAFF",
        initials,
      };
    }
  } catch {}

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <UniversalModalContext.Provider value={modalApi}>
      <div
        className="flex flex-col h-screen w-screen overflow-hidden font-['Space_Grotesk',sans-serif] relative transition-colors duration-300"
        style={themeVars}
      >
        {/* ================================================================== */}
        {/* HEADER MOBILE                                                       */}
        {/* ================================================================== */}
        <header className="h-14 bg-(--bg-header)/90 backdrop-blur-xl border-b border-(--border-color) flex items-center justify-between px-3 shrink-0 z-40">
          {/* Kiri: Hamburger + Brand + Workspace */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-lg text-(--text-primary) hover:bg-(--surface-hover) cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-['Syne',sans-serif] font-extrabold text-lg bg-linear-to-r from-orange-400 via-orange-500 to-yellow-400 bg-clip-text text-transparent whitespace-nowrap">
                AlmaAPP
              </span>
              {availableWorkspaces.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setIsOutletModalOpen(true)}
                  className="px-2 py-0.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[10px] font-black uppercase flex items-center gap-1 truncate max-w-32 cursor-pointer"
                  title="Pindah Ruang Kerja (Region / Cabang)"
                >
                  <span className="truncate">
                    {activeOutletId ? currentOutletName : `🏢 Dashboard Region`}
                  </span>
                  <ChevronDown className="w-3 h-3 shrink-0" />
                </button>
              ) : (
                <span className="hidden xs:inline text-[10px] font-bold text-(--text-secondary) uppercase truncate max-w-28">
                  {currentOutletName}
                </span>
              )}
            </div>
          </div>

          {/* Kanan: Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Toggle Dark Mode */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg text-(--text-secondary) hover:bg-(--surface-hover) cursor-pointer"
              title={darkMode ? "Mode Terang" : "Mode Gelap"}
            >
              {darkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            {/* PWA Install */}
            {deferredPrompt && (
              <button
                onClick={handleInstallPWA}
                className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-500/10 cursor-pointer"
                title="Install App"
              >
                <Download className="w-5 h-5" />
              </button>
            )}

            {/* Tombol Aktivitas / Notifikasi */}
            <button
              onClick={() => setIsActivityOpen(true)}
              className="p-2 rounded-lg text-(--text-secondary) hover:bg-(--surface-hover) relative cursor-pointer"
              title="Buka Aktivitas / Notifikasi"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-(--bg-header)" />
            </button>

            {/* Tombol Logout / Kunci Sesi */}
            <button
              onClick={() =>
                modalApi.openAlert({
                  title: "Kunci Sesi",
                  message: "Keluar dari sesi kerja?",
                  confirmText: "KELUAR",
                  cancelText: "BATAL",
                  onConfirm: () => {
                    localStorage.removeItem("__unv_activeUser");
                    window.location.reload();
                  },
                })
              }
              className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer"
              title="Kunci Sesi / Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ================================================================== */}
        {/* DRAWER NAVIGASI                                                     */}
        {/* ================================================================== */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-90 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          >
            <div
              className="absolute left-0 top-0 h-full w-4/5 max-w-xs bg-(--bg-card) shadow-2xl flex flex-col animate-in slide-in-from-left duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Profil User */}
              <div className="p-4 border-b border-(--border-color) flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-linear-to-br from-orange-500 to-teal-500 flex items-center justify-center text-white font-bold">
                    {userProfile.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-(--text-primary)">
                      {userProfile.fullName}
                    </div>
                    <div className="text-[10px] text-(--text-secondary) uppercase">
                      {userProfile.role}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-lg text-(--text-secondary) hover:bg-(--surface-hover) cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Menu List */}
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {menus.map((menu) => (
                  <DrawerMenuItem
                    key={menu.id}
                    menu={menu}
                    activeMenuId={activeMenuId}
                    pathname={location.pathname}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>

              {/* Quick Actions */}
              <div className="p-3 border-t border-(--border-color) space-y-2">
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    setIsModuleManagerOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-(--text-primary) hover:bg-(--surface-hover) cursor-pointer"
                >
                  <Settings className="w-5 h-5 text-(--text-secondary)" />
                  {workspaceName}
                </button>
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    navigate("/system/data-manager");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-(--text-primary) hover:bg-(--surface-hover) cursor-pointer"
                >
                  <Database className="w-5 h-5 text-(--text-secondary)" />
                  Data Manager
                </button>
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    navigate("/dashboard/executive");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-(--text-primary) hover:bg-(--surface-hover) cursor-pointer"
                >
                  <LayoutDashboard className="w-5 h-5 text-orange-500" />
                  Executive Dashboard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* MAIN CONTENT                                                        */}
        {/* ================================================================== */}
        <main className="flex-1 overflow-y-auto bg-(--bg-app) relative z-10 p-3 sm:p-4">
          {children}

          {/* Modal Overlays */}
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
          {sideOverState && (
            <div className="fixed inset-0 z-85">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setSideOverState(null)}
              />
              <div className="absolute right-0 top-0 h-full w-full max-w-md bg-(--bg-card) shadow-2xl">
                <SideOver
                  config={sideOverState}
                  onClose={() => setSideOverState(null)}
                />
              </div>
            </div>
          )}
        </main>

        {/* ================================================================== */}
        {/* FOOTER MINIMAL                                                      */}
        {/* ================================================================== */}
        <footer className="h-10 bg-(--bg-header)/90 backdrop-blur-xl border-t border-(--border-color) flex items-center justify-between px-4 shrink-0 z-40">
          <div className="flex items-center gap-2">
            <ConnectionStatus />
            <PendingSyncBadge />
          </div>
          <div className="flex items-center gap-2 text-[10px] font-medium text-(--text-secondary)">
            <span className="text-orange-500 font-black">ALMA PLATFORM</span>
            <span>
              v
              {typeof __APP_VERSION__ !== "undefined"
                ? __APP_VERSION__
                : "2.1.0"}
            </span>
          </div>
        </footer>

        {/* ================================================================== */}
        {/* GLOBAL OVERLAYS                                                     */}
        {/* ================================================================== */}

        {/* Module Manager Modal */}
        {isModuleManagerOpen && (
          <ModuleManagerModal onClose={() => setIsModuleManagerOpen(false)} />
        )}

        {/* Command Palette, Numpad, Toast, Activity Drawer */}
        <CommandPalette menus={menus} />
        <VirtualNumpad />
        <UniversalToast />
        <ActivityDrawer
          isOpen={isActivityOpen}
          onClose={() => setIsActivityOpen(false)}
        />
      </div>

      {/* ================================================================== */}
      {/* MODAL PEMILIH RUANG KERJA (SMARTPHONE)                              */}
      {/* ================================================================== */}
      {isOutletModalOpen && (
        <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-3 bg-black/70 backdrop-blur-sm">
          <div className="bg-(--bg-card) border border-(--border-color) rounded-2xl w-full max-w-sm p-4 space-y-3 animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center border-b border-(--border-color) pb-2">
              <span className="font-black text-xs uppercase text-orange-500 flex items-center gap-1.5">
                <Store className="w-4 h-4" /> Pilih Ruang Kerja
              </span>
              <button
                onClick={() => setIsOutletModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
              {availableWorkspaces.map((workspace) => {
                const isSelected =
                  (workspace.type === "OUTLET" &&
                    workspace.id === activeOutletId) ||
                  (workspace.type === "REGION" && !activeOutletId);

                return (
                  <button
                    key={`${workspace.type}-${workspace.id}`}
                    type="button"
                    onClick={() => handleSwitchWorkspace(workspace)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? "bg-orange-500/10 border-orange-500 text-orange-400"
                        : "bg-(--bg-input) border-(--border-color) text-(--text-primary)"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {workspace.type === "REGION" ? (
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Store className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="truncate">{workspace.name}</span>
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </UniversalModalContext.Provider>
  );
}
