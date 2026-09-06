// File: apps/client_unv/src/system-ui/SetupWizardSM.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Building2,
  MapPin,
  Store,
  ArrowRight,
  ArrowLeft,
  Loader2,
  TerminalSquare,
  PlusCircle,
  RefreshCw,
  Box,
  Layers,
  Laptop,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  Key,
  Check,
} from "lucide-react";
import { CryptoManager } from "../../../../packages/core_unv/src/ledger/crypto";
import { globalLedger } from "../../../../packages/core_unv/src/ledger/UniversalLedger";
import { LicenseManager } from "../../../../packages/core_unv/src/ledger/licenseManager";
import { sysToast } from "../shared-ui/useToastStore";
import { manager } from "../pluginRegistry";
import { getApiUrl } from "../../../../packages/core_unv/src/config/env";

type AlertType = "success" | "error" | "info" | "warning";

interface AlertState {
  isOpen: boolean;
  type: AlertType;
  title: string;
  message: string;
}

const AlertModalSM: React.FC<{
  alert: AlertState;
  onClose: () => void;
}> = ({ alert, onClose }) => {
  if (!alert.isOpen) return null;

  const config = {
    success: {
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      button: "bg-emerald-500 hover:bg-emerald-600",
    },
    error: {
      icon: AlertTriangle,
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
      button: "bg-rose-500 hover:bg-rose-600",
    },
    warning: {
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      button: "bg-amber-500 hover:bg-amber-600",
    },
    info: {
      icon: Info,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      button: "bg-blue-500 hover:bg-blue-600",
    },
  }[alert.type];

  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${config.bg} ${config.border} border ${config.color} flex items-center justify-center shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black uppercase tracking-wide text-white">
              {alert.title}
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {alert.message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className={`w-full py-2.5 ${config.button} text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md`}
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
};

const StepProgressSM: React.FC<{
  currentStep: number;
  isVirgin: boolean;
  mainMode: string | null;
}> = ({ currentStep, isVirgin, mainMode }) => {
  const steps = isVirgin
    ? [
        { id: 1, label: "Lisensi", icon: Key },
        { id: 2, label: "Struktur", icon: Building2 },
        { id: 3, label: "Admin", icon: ShieldCheck },
        { id: 4, label: "Sinkron", icon: TerminalSquare },
      ]
    : [
        { id: 1, label: "Otorisasi", icon: ShieldCheck },
        { id: 2, label: "Lingkup", icon: Store },
        {
          id: 3,
          label: mainMode === "RECOVERY" ? "Mesin" : "Modul",
          icon: mainMode === "RECOVERY" ? Laptop : Layers,
        },
        { id: 4, label: "Sinkron", icon: TerminalSquare },
      ];

  return (
    <div className="px-4 py-3 bg-slate-900/60 border-b border-white/5 backdrop-blur-md">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-800 rounded-full z-0" />
        <div
          className="absolute top-4 left-4 h-0.5 bg-linear-to-r from-orange-400 to-orange-500 rounded-full z-10 transition-all duration-500"
          style={{
            width: `calc((100% - 2rem) * ${Math.max(0, currentStep - 1) / (steps.length - 1)})`,
          }}
        />
        {steps.map((s) => {
          const isCompleted = currentStep > s.id;
          const isActive = currentStep === s.id;
          const Icon = s.icon;
          return (
            <div key={s.id} className="relative z-20 flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isCompleted
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/40"
                    : isActive
                      ? "bg-slate-950 border-2 border-orange-500 text-orange-400 scale-105 shadow-md shadow-orange-500/20"
                      : "bg-slate-900 border border-slate-700 text-slate-500"
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
              </div>
              <span
                className={`text-[9px] font-black uppercase tracking-wider ${
                  isActive ? "text-orange-400" : isCompleted ? "text-slate-300" : "text-slate-500"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const SetupWizardSM: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const availablePlugins = manager.getAllPlugins();
  const [isVirgin, setIsVirgin] = useState<boolean | null>(null);
  const [mainMode, setMainMode] = useState<"NEW_DEVICE" | "RECOVERY" | null>(null);
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [alert, setAlert] = useState<AlertState>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  const showAlert = (type: AlertType, title: string, message: string) => {
    setAlert({ isOpen: true, type, title, message });
  };

  // State Lisensi
  const [licenseKeyInput, setLicenseKeyInput] = useState("");
  const [isFreeCommunity, setIsFreeCommunity] = useState(false);
  const [verifiedLicense, setVerifiedLicense] = useState<{
    isValid: boolean;
    tier: "FREE" | "PREMIUM" | "EXCLUSIVE";
    companyName?: string;
    allowedModules: string[];
    validUntil?: string;
  } | null>(null);

  // Multi-Tier Scope
  const [deviceScope, setDeviceScope] = useState<"COMPANY" | "REGION" | "OUTLET">("OUTLET");

  // Form Cold-Start
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [regionName, setRegionName] = useState("");
  const [outletName, setOutletName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPin, setAdminPin] = useState("");

  // Form Login Standard / Recovery
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [structure, setStructure] = useState<any>({
    companies: [],
    regions: [],
    outlets: [],
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [selectedOutletId, setSelectedOutletId] = useState("");

  // Device & Takeover
  const [deviceName, setDeviceName] = useState("");
  const [replaceDeviceId, setReplaceDeviceId] = useState("");
  const [existingDevices, setExistingDevices] = useState<any[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>(() =>
    availablePlugins.map((p) => p.name),
  );
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Terminal Logs
  const [logs, setLogs] = useState<string[]>([]);
  const [isRecoveryDone, setIsRecoveryDone] = useState<boolean>(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Cek Status Virgin State
  useEffect(() => {
    fetch(getApiUrl("/api/provision/system-status"))
      .then((res) => res.json())
      .then((data) => {
        setIsVirgin(data.isVirgin);
        if (data.isVirgin) {
          setMainMode("NEW_DEVICE");
        }
      })
      .catch(() => setIsVirgin(false));
  }, []);

  // FUNGSI VERIFIKASI LISENSI OFFLINE
  const handleVerifyLicense = () => {
    if (isFreeCommunity) {
      setVerifiedLicense({
        isValid: true,
        tier: "FREE",
        companyName: companyName || "Komunitas ALMA",
        allowedModules: [
          "mdl_organization",
          "mdl_item",
          "mdl_vendor",
          "mdl_receiving",
          "mdl_warehouse",
          "mdl_plusales",
          "mdl_executivepanel",
        ],
      });
      setSelectedModules([
        "mdl_organization",
        "mdl_item",
        "mdl_vendor",
        "mdl_receiving",
        "mdl_warehouse",
        "mdl_plusales",
        "mdl_executivepanel",
      ]);
      sysToast.success("Lisensi Free Aktif", "Menggunakan 7 modul inti komunitas.");
      return;
    }

    if (!licenseKeyInput.trim()) {
      showAlert(
        "error",
        "Kunci Kosong",
        "Silakan tempelkan kunci lisensi dari email Anda atau centang paket Gratis.",
      );
      return;
    }

    const res = LicenseManager.verifyLicense(licenseKeyInput.trim());
    if (!res.isValid) {
      showAlert(
        "error",
        "Lisensi Tidak Sah",
        res.errorMessage || "Format kunci lisensi tidak valid atau tanda tangan digital rusak.",
      );
      setVerifiedLicense(null);
      return;
    }

    setVerifiedLicense(res);
    if (res.companyName) setCompanyName(res.companyName);
    if (res.allowedModules && res.allowedModules.length > 0) {
      setSelectedModules(res.allowedModules);
    }
    sysToast.success(
      "Lisensi Terverifikasi",
      `Paket ${res.tier} untuk ${res.companyName || "Perusahaan"} sah secara kriptografis.`,
    );
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      showAlert("warning", "GPS Tidak Didukung", "Browser Anda tidak mendukung geolokasi.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        showAlert("error", "Gagal Mendeteksi Lokasi", "Pastikan izin lokasi diaktifkan pada browser.");
      },
      { timeout: 15000 },
    );
  };

  const handleSupervisorAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/provision/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Otorisasi ditolak.");
      setStructure(data.structure);
      if (data.structure.companies.length > 0) {
        setSelectedCompanyId(data.structure.companies[0].id);
      }
      sysToast.success("Otorisasi Berhasil", "Identitas supervisor terverifikasi.");
      setStep(2);
    } catch (err: any) {
      sysToast.error("Otorisasi Gagal", err.message || "Email atau password salah.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDevicesForTakeover = async () => {
    if (!selectedCompanyId) return;
    try {
      const query = new URLSearchParams({ companyId: selectedCompanyId });
      if (selectedRegionId) query.append("regionId", selectedRegionId);
      if (selectedOutletId) query.append("outletId", selectedOutletId);
      const res = await fetch(getApiUrl(`/api/provision/devices-by-scope?${query.toString()}`));
      const data = await res.json();
      if (res.ok) {
        setExistingDevices(data.devices || []);
      }
    } catch (err) {
      showAlert("error", "Gagal Mengambil Data", "Gagal memuat daftar perangkat aktif.");
    }
  };

  const runOrchestrator = async () => {
    setStep(4);
    setIsSubmitting(true);
    setLogs([]);
    setIsRecoveryDone(false);

    addLog(`[PURGE] Membersihkan database IndexedDB lokal lama...`);
    try {
      const rxdb = globalLedger.getRxDatabase();
      if (rxdb) {
        for (const col of Object.values(rxdb.collections)) {
          const allDocs = await col.find().exec();
          for (const doc of allDocs) {
            await doc.remove();
          }
        }
      }
    } catch (err) {
      console.warn("Pembersihan database diabaikan:", err);
    }

    addLog(`[SECURITY] Membangkitkan Kunci Kriptografi Ed25519 Perangkat...`);
    const keyPair = CryptoManager.generateKeyPair();
    const nodeId = localStorage.getItem("__unv_nodeId") || `NODE_${Date.now()}`;
    localStorage.setItem("__unv_nodeId", nodeId);
    localStorage.setItem("__unv_secretKey", keyPair.secretKey);
    addLog(`[SECURITY] Kunci Terdaftar. Public Key: ${keyPair.publicKey.substring(0, 16)}...`);

    const licenseTier = verifiedLicense?.tier || "FREE";
    const licenseKey = isFreeCommunity ? null : licenseKeyInput.trim() || null;
    const licenseExpiresAt = verifiedLicense?.validUntil || null;

    try {
      let endpoint = getApiUrl("/api/provision/device");
      let bodyData: any = {};

      if (mainMode === "RECOVERY") {
        endpoint = getApiUrl("/api/provision/takeover");
        bodyData = {
          replaceDeviceId,
          deviceId: nodeId,
          nodeId: nodeId,
          publicKey: keyPair.publicKey,
          lat: latitude,
          lng: longitude,
        };
        addLog(`[RECOVERY] Mengambil alih identitas mesin rusak (${replaceDeviceId})...`);
      } else if (isVirgin) {
        endpoint = getApiUrl("/api/provision/cold-start");
        bodyData = {
          company: { name: companyName, legalName },
          region: deviceScope !== "COMPANY" && regionName ? { name: regionName } : null,
          outlet: deviceScope === "OUTLET" && outletName ? { name: outletName } : null,
          superAdmin: {
            fullName: ownerName,
            email: adminEmail,
            password: adminPassword,
            pin: adminPin,
          },
          device: {
            deviceId: nodeId,
            nodeId: nodeId,
            name: deviceName,
            scope: deviceScope,
            publicKey: keyPair.publicKey,
            allowedModules: selectedModules,
            lat: latitude,
            lng: longitude,
          },
          licenseTier,
          licenseKey,
          licenseExpiresAt,
        };
        addLog(`[COLD-START] Mendaftarkan entitas holding & akun superadmin...`);
      } else {
        endpoint = getApiUrl("/api/provision/device");
        bodyData = {
          deviceId: nodeId,
          nodeId: nodeId,
          companyId: selectedCompanyId,
          regionId: deviceScope === "COMPANY" ? null : selectedRegionId,
          outletId: deviceScope === "OUTLET" ? selectedOutletId : null,
          scope: deviceScope,
          name: deviceName,
          publicKey: keyPair.publicKey,
          allowedModules: selectedModules,
          lat: latitude,
          lng: longitude,
          licenseTier,
          licenseKey,
          licenseExpiresAt,
        };
      }

      addLog(`[NETWORK] Menghubungi Server Provisioning...`);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      addLog(`[STORAGE] Menginisialisasi Universal Ledger (RxDB)...`);
      await globalLedger.init();
      addLog(`[STORAGE] Database Lokal Terenkripsi Siap.`);

      localStorage.setItem("__unv_deviceToken", data.deviceToken);
      localStorage.setItem(
        "__unv_allowed_modules",
        JSON.stringify(data.allowedModules || selectedModules),
      );
      localStorage.setItem("__unv_companyId", data.companyId || "");
      localStorage.setItem("__unv_regionId", data.regionId || "");
      localStorage.setItem("__unv_outletId", data.outletId || "");
      localStorage.setItem("__unv_license_tier", licenseTier);
      if (licenseKey) localStorage.setItem("__unv_license_token", licenseKey);

      addLog(`[RAPID RECOVERY] Menarik Master Data & Transaksi 24 Jam Terakhir...`);
      const pullQuery = new URLSearchParams({ deviceId: nodeId, window: "24h" });
      if (data.outletId) pullQuery.append("outletId", data.outletId);

      const pullRes = await fetch(getApiUrl(`/api/events/pull/system?${pullQuery.toString()}`));
      if (pullRes.ok) {
        const events = await pullRes.json();
        addLog(`[SYNC] Menerima ${events.length} event instan dari server.`);
      }

      addLog(`[READY] Perangkat resmi aktif dan siap melayani transaksi!`);
      setIsRecoveryDone(true);
    } catch (err: any) {
      addLog(`[FATAL ERROR] ${err.message}`);
      showAlert("error", "Proses Gagal", err.message || "Terjadi kesalahan saat provisioning.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVirgin === null) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-white font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // STEP 0: PILIH MODE (JIKA BUKAN VIRGIN & MODE BELUM DIPILIH)
  if (!mainMode && !isVirgin) {
    return (
      <div className="min-h-screen w-full flex flex-col justify-center bg-slate-950 p-4 font-sans text-slate-100 selection:bg-orange-500 selection:text-white">
        <AlertModalSM alert={alert} onClose={() => setAlert({ ...alert, isOpen: false })} />
        <div className="w-full max-w-sm mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center font-black text-2xl text-white mx-auto shadow-lg shadow-orange-500/30">
              Z
            </div>
            <h1 className="text-xl font-black text-white tracking-tight uppercase">
              Aktivasi Mesin <span className="text-orange-400">Alma ERP</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Pilih alur aktivasi untuk perangkat ini
            </p>
          </div>

          <div className="space-y-3">
            <div
              onClick={() => {
                setMainMode("NEW_DEVICE");
                setStep(1);
              }}
              className="p-4 rounded-2xl border border-orange-500/30 bg-slate-900/80 backdrop-blur-md active:scale-[0.98] transition cursor-pointer shadow-lg space-y-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-sm text-white uppercase">Daftar Perangkat Baru</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Konfigurasi mesin baru untuk kasir, gudang, atau holding.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-orange-400 shrink-0" />
              </div>
            </div>

            <div
              onClick={() => {
                setMainMode("RECOVERY");
                setStep(1);
              }}
              className="p-4 rounded-2xl border border-blue-500/30 bg-slate-900/80 backdrop-blur-md active:scale-[0.98] transition cursor-pointer shadow-lg space-y-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-sm text-white uppercase">Pulihkan Mesin Lama</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Gantikan tablet kasir yang rusak & pulihkan data 24 jam terakhir.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AlertModalSM alert={alert} onClose={() => setAlert({ ...alert, isOpen: false })} />
      <div className="min-h-screen w-full flex flex-col bg-slate-950 font-sans text-slate-100 selection:bg-orange-500 selection:text-white">
        {/* Header Mobile Ringkas */}
        <div className="px-4 py-3.5 bg-slate-900/90 border-b border-white/10 backdrop-blur-xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center font-black text-sm text-white shadow-md">
              Z
            </div>
            <div>
              <h2 className="text-xs font-black text-white uppercase tracking-wider">
                Alma <span className="text-orange-400">Setup</span>
              </h2>
              <span className="text-[9px] text-slate-400 font-mono block">
                {mainMode === "RECOVERY"
                  ? "Disaster Recovery"
                  : isVirgin
                    ? "Cold-Start Setup"
                    : "Perangkat Baru"}
              </span>
            </div>
          </div>
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
            LANGKAH {step}/4
          </span>
        </div>

        {/* Step Indicator Mobile */}
        <StepProgressSM currentStep={step} isVirgin={!!isVirgin} mainMode={mainMode} />

        {/* Konten Form */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="max-w-md mx-auto">
            {/* ========================================================= */}
            {/* FLOW COLD-START: STEP 1 (VERIFIKASI LISENSI)             */}
            {/* ========================================================= */}
            {isVirgin && step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <Key className="w-4 h-4 text-orange-500" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    1. Kunci Lisensi Kriptografis
                  </h3>
                </div>

                <div className="p-3.5 bg-slate-900/80 border border-white/10 rounded-2xl space-y-3">
                  <label className="text-[10px] font-black text-slate-300 uppercase block">
                    Tempelkan Kunci Lisensi (Dari Email):
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      disabled={isFreeCommunity}
                      value={licenseKeyInput}
                      onChange={(e) => setLicenseKeyInput(e.target.value.trim())}
                      placeholder="ALMA-LIC-eyJwYXlsb2FkI..."
                      className="w-full text-xs font-mono font-bold p-3 bg-slate-950 border border-slate-700 rounded-xl outline-none focus:border-orange-500 disabled:opacity-50 text-orange-400"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyLicense}
                      className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase rounded-xl transition shadow-md shadow-orange-500/20"
                    >
                      Verifikasi Kunci Lisensi
                    </button>
                  </div>

                  <label className="flex items-center gap-2 pt-2 border-t border-white/5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isFreeCommunity}
                      onChange={(e) => {
                        setIsFreeCommunity(e.target.checked);
                        if (e.target.checked) setLicenseKeyInput("");
                      }}
                      className="w-4 h-4 rounded text-orange-500 accent-orange-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-300">
                      Gunakan Versi Komunitas Gratis (Free Tier)
                    </span>
                  </label>
                </div>

                {verifiedLicense && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1.5 animate-in fade-in">
                    <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase">
                      <CheckCircle2 className="w-4 h-4" /> Paket {verifiedLicense.tier} Sah
                    </div>
                    <div className="text-[11px] text-slate-300 space-y-0.5 pt-1">
                      <div>
                        Perusahaan: <strong className="text-white">{verifiedLicense.companyName || "PT Mandiri"}</strong>
                      </div>
                      <div>
                        Masa Aktif:{" "}
                        <strong className="text-white">
                          {verifiedLicense.validUntil
                            ? new Date(verifiedLicense.validUntil).toLocaleDateString("id-ID")
                            : "Selamanya"}
                        </strong>
                      </div>
                      <div>
                        Modul Terbuka: <strong className="text-white">{verifiedLicense.allowedModules.length} Modul</strong>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-3">
                  <button
                    type="button"
                    disabled={!verifiedLicense}
                    onClick={() => setStep(2)}
                    className="w-full py-3 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-wider disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                  >
                    Lanjut ke Struktur Organisasi <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* FLOW COLD-START: STEP 2 (STRUKTUR ORGANISASI)            */}
            {/* ========================================================= */}
            {isVirgin && step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <Building2 className="w-4 h-4 text-orange-500" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    2. Struktur Organisasi & Scope
                  </h3>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase block">
                    Tingkat Operasional Mesin Ini:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeviceScope("COMPANY");
                        setRegionName("");
                        setOutletName("");
                      }}
                      className={`p-3 rounded-xl border text-center transition ${
                        deviceScope === "COMPANY"
                          ? "border-orange-500 bg-orange-500/20 text-orange-400 font-bold"
                          : "border-slate-800 bg-slate-900/60 text-slate-400"
                      }`}
                    >
                      <Building2 className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-[10px] block font-black uppercase">Holding</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeviceScope("REGION");
                        setOutletName("");
                      }}
                      className={`p-3 rounded-xl border text-center transition ${
                        deviceScope === "REGION"
                          ? "border-orange-500 bg-orange-500/20 text-orange-400 font-bold"
                          : "border-slate-800 bg-slate-900/60 text-slate-400"
                      }`}
                    >
                      <MapPin className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-[10px] block font-black uppercase">Gudang Hub</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeviceScope("OUTLET")}
                      className={`p-3 rounded-xl border text-center transition ${
                        deviceScope === "OUTLET"
                          ? "border-orange-500 bg-orange-500/20 text-orange-400 font-bold"
                          : "border-slate-800 bg-slate-900/60 text-slate-400"
                      }`}
                    >
                      <Store className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-[10px] block font-black uppercase">Outlet POS</span>
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                      Nama Perusahaan / Bisnis
                    </label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value.toUpperCase())}
                      placeholder="PT ALMA NUSANTARA"
                      className="w-full text-xs font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                      Bentuk Legalitas (Opsional)
                    </label>
                    <input
                      type="text"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value.toUpperCase())}
                      placeholder="PT / CV / PERORANGAN"
                      className="w-full text-xs font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
                    />
                  </div>

                  {(deviceScope === "REGION" || deviceScope === "OUTLET") && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                        Nama Wilayah / Hub
                      </label>
                      <input
                        type="text"
                        required
                        value={regionName}
                        onChange={(e) => setRegionName(e.target.value.toUpperCase())}
                        placeholder="JAWA BARAT / PUSAT"
                        className="w-full text-xs font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
                      />
                    </div>
                  )}

                  {deviceScope === "OUTLET" && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                        Nama Cabang / Outlet Kasir
                      </label>
                      <input
                        type="text"
                        required
                        value={outletName}
                        onChange={(e) => setOutletName(e.target.value.toUpperCase())}
                        placeholder="CABANG DAGO / KASIR 01"
                        className="w-full text-xs font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 bg-slate-900 text-slate-400 font-bold text-xs uppercase rounded-xl border border-slate-800 flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Kembali
                  </button>
                  <button
                    type="button"
                    disabled={!companyName.trim()}
                    onClick={() => setStep(3)}
                    className="flex-2 py-3 bg-linear-to-r from-orange-500 to-orange-600 text-white font-black text-xs uppercase rounded-xl disabled:opacity-40 flex items-center justify-center gap-1 shadow-md"
                  >
                    Lanjut ke Superadmin <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* FLOW COLD-START: STEP 3 (AKUN SUPERADMIN & MESIN)         */}
            {/* ========================================================= */}
            {isVirgin && step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <ShieldCheck className="w-4 h-4 text-orange-500" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    3. Akun Superadmin & Identitas Mesin
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                      Nama Lengkap Owner / Direksi
                    </label>
                    <input
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value.toUpperCase())}
                      placeholder="RENDI FAIZAL"
                      className="w-full text-xs font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                      Email Login
                    </label>
                    <input
                      type="email"
                      inputMode="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="owner@company.com"
                      className="w-full text-xs font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                        PIN Kasir (6 Digit)
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value)}
                        placeholder="123456"
                        className="w-full text-xs font-mono font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white tracking-widest text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                      Nama Identitas Perangkat Ponsel
                    </label>
                    <input
                      type="text"
                      required
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value.toUpperCase())}
                      placeholder="HP-KASIR-01"
                      className="w-full text-xs font-mono font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isLocating}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    <MapPin className="w-4 h-4 text-orange-500" />
                    {isLocating
                      ? "Mengunci Satelit GPS..."
                      : latitude
                        ? `GPS Terkunci (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
                        : "Kunci Koordinat Lokasi Mesin"}
                  </button>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 py-3 bg-slate-900 text-slate-400 font-bold text-xs uppercase rounded-xl border border-slate-800 flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Kembali
                  </button>
                  <button
                    type="button"
                    disabled={!ownerName || !adminEmail || !adminPassword || !deviceName || isSubmitting}
                    onClick={runOrchestrator}
                    className="flex-2 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aktifkan Mesin"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* FLOW NON-VIRGIN STEP 1: AUTH SUPERVISOR                  */}
            {/* ========================================================= */}
            {!isVirgin && step === 1 && (
              <form onSubmit={handleSupervisorAuth} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <ShieldCheck className="w-4 h-4 text-orange-500" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    1. Otorisasi Supervisor
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                      Email Administrator
                    </label>
                    <input
                      type="email"
                      inputMode="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="admin@company.com"
                      className="w-full text-xs font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
                    />
                  </div>
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMainMode(null)}
                    className="flex-1 py-3 bg-slate-900 text-slate-400 font-bold text-xs uppercase rounded-xl border border-slate-800 flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Ganti Mode
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !loginEmail || !loginPassword}
                    className="flex-2 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verifikasi Otorisasi"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* ========================================================= */}
            {/* FLOW NON-VIRGIN STEP 2: PENEMPATAN LINGKUP               */}
            {/* ========================================================= */}
            {!isVirgin && step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <Store className="w-4 h-4 text-orange-500" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    2. Penempatan Lingkup Mesin
                  </h3>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase block">
                    Tingkat Operasional:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeviceScope("COMPANY");
                        setSelectedRegionId("");
                        setSelectedOutletId("");
                      }}
                      className={`p-3 rounded-xl border text-center transition ${
                        deviceScope === "COMPANY"
                          ? "border-orange-500 bg-orange-500/20 text-orange-400 font-bold"
                          : "border-slate-800 bg-slate-900/60 text-slate-400"
                      }`}
                    >
                      <Building2 className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-[10px] block font-black uppercase">Holding</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeviceScope("REGION");
                        setSelectedOutletId("");
                      }}
                      className={`p-3 rounded-xl border text-center transition ${
                        deviceScope === "REGION"
                          ? "border-orange-500 bg-orange-500/20 text-orange-400 font-bold"
                          : "border-slate-800 bg-slate-900/60 text-slate-400"
                      }`}
                    >
                      <MapPin className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-[10px] block font-black uppercase">Gudang Hub</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeviceScope("OUTLET")}
                      className={`p-3 rounded-xl border text-center transition ${
                        deviceScope === "OUTLET"
                          ? "border-orange-500 bg-orange-500/20 text-orange-400 font-bold"
                          : "border-slate-800 bg-slate-900/60 text-slate-400"
                      }`}
                    >
                      <Store className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-[10px] block font-black uppercase">Outlet POS</span>
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                      Pilih Perusahaan
                    </label>
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => {
                        setSelectedCompanyId(e.target.value);
                        setSelectedRegionId("");
                        setSelectedOutletId("");
                      }}
                      className="w-full text-xs font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
                    >
                      {structure.companies.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(deviceScope === "REGION" || deviceScope === "OUTLET") && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                        Pilih Regional
                      </label>
                      <select
                        value={selectedRegionId}
                        onChange={(e) => {
                          setSelectedRegionId(e.target.value);
                          setSelectedOutletId("");
                        }}
                        className="w-full text-xs font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
                      >
                        <option value="">-- PILIH REGIONAL --</option>
                        {structure.regions
                          .filter((r: any) => r.companyId === selectedCompanyId)
                          .map((r: any) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {deviceScope === "OUTLET" && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                        Pilih Outlet Cabang
                      </label>
                      <select
                        value={selectedOutletId}
                        disabled={!selectedRegionId}
                        onChange={(e) => setSelectedOutletId(e.target.value)}
                        className="w-full text-xs font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white disabled:opacity-50"
                      >
                        <option value="">-- PILIH OUTLET --</option>
                        {structure.outlets
                          .filter((o: any) => o.regionId === selectedRegionId)
                          .map((o: any) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 bg-slate-900 text-slate-400 font-bold text-xs uppercase rounded-xl border border-slate-800 flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Kembali
                  </button>
                  <button
                    type="button"
                    disabled={!selectedCompanyId}
                    onClick={() => {
                      if (mainMode === "RECOVERY") {
                        fetchDevicesForTakeover();
                      }
                      setStep(3);
                    }}
                    className="flex-2 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase rounded-xl disabled:opacity-40 flex items-center justify-center gap-1 shadow-md"
                  >
                    {mainMode === "RECOVERY" ? "Pilih Mesin Rusak" : "Identitas Mesin"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* FLOW NON-VIRGIN STEP 3: RECOVERY / IDENTITAS PERANGKAT    */}
            {/* ========================================================= */}
            {!isVirgin && step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  {mainMode === "RECOVERY" ? (
                    <>
                      <RefreshCw className="w-4 h-4 text-blue-400" />
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">
                        3. Pilih Mesin yang Digantikan
                      </h3>
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4 text-orange-500" />
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">
                        3. Identitas Perangkat Baru
                      </h3>
                    </>
                  )}
                </div>

                {mainMode === "RECOVERY" ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase block">
                      Pilih Mesin Lama yang Rusak:
                    </label>
                    {existingDevices.length === 0 ? (
                      <div className="p-6 bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl text-center text-xs font-bold text-slate-500">
                        Tidak ditemukan mesin aktif pada lingkup ini.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                        {existingDevices.map((d) => (
                          <div
                            key={d.id}
                            onClick={() => {
                              setReplaceDeviceId(d.id);
                              setDeviceName(d.name);
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                              replaceDeviceId === d.id
                                ? "border-blue-500 bg-blue-500/20 text-white shadow-md"
                                : "border-slate-800 bg-slate-900/60 text-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Laptop className={`w-5 h-5 ${replaceDeviceId === d.id ? "text-blue-400" : "text-slate-500"}`} />
                              <div>
                                <div className="font-bold text-xs text-white">{d.name}</div>
                                <div className="text-[9px] font-mono text-slate-400">ID: {d.id}</div>
                              </div>
                            </div>
                            {replaceDeviceId === d.id && (
                              <span className="px-2 py-0.5 bg-blue-500 text-white rounded text-[8px] font-black uppercase">
                                Dipilih
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                        Nama Identitas Perangkat Ponsel
                      </label>
                      <input
                        type="text"
                        required
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value.toUpperCase())}
                        placeholder="HP-KASIR-02"
                        className="w-full text-xs font-mono font-bold p-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isLocating}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                >
                  <MapPin className="w-4 h-4 text-orange-500" />
                  {isLocating
                    ? "Mengunci Satelit GPS..."
                    : latitude
                      ? `GPS Terkunci (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
                      : "Kunci Koordinat Lokasi Mesin"}
                </button>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 py-3 bg-slate-900 text-slate-400 font-bold text-xs uppercase rounded-xl border border-slate-800 flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Kembali
                  </button>
                  <button
                    type="button"
                    disabled={
                      (mainMode === "RECOVERY" && !replaceDeviceId) ||
                      (mainMode === "NEW_DEVICE" && !deviceName) ||
                      isSubmitting
                    }
                    onClick={runOrchestrator}
                    className={`flex-2 py-3 text-white rounded-xl font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 ${
                      mainMode === "RECOVERY"
                        ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/30"
                        : "bg-orange-500 hover:bg-orange-600 shadow-orange-500/30"
                    }`}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : mainMode === "RECOVERY" ? (
                      "Ambil Alih Data"
                    ) : (
                      "Aktifkan Mesin"
                    )}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* STEP 4: TERMINAL ORCHESTRATOR & SYNC LOGS                */}
            {/* ========================================================= */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                  <TerminalSquare
                    className={`w-4 h-4 ${isRecoveryDone ? "text-emerald-400" : "text-orange-400 animate-pulse"}`}
                  />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    {isRecoveryDone ? "Perangkat Siap Digunakan" : "Menjalankan Provisioning..."}
                  </h3>
                </div>

                <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400">
                      provision@alma-edge:~$
                    </span>
                    <span className="text-[9px] font-mono font-bold text-orange-400">
                      {isRecoveryDone ? "COMPLETED" : "SYNCING"}
                    </span>
                  </div>
                  <div className="p-3 h-60 overflow-y-auto font-mono text-[10px] leading-relaxed text-emerald-400 bg-slate-950">
                    {logs.map((log, idx) => (
                      <div
                        key={idx}
                        className={`mb-1 ${
                          log.startsWith("  [FATAL")
                            ? "text-rose-400 font-bold"
                            : log.startsWith("  [READY")
                              ? "text-emerald-300 font-bold"
                              : ""
                        }`}
                      >
                        <span className="text-slate-600">&gt; </span>
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>

                {isRecoveryDone && (
                  <button
                    type="button"
                    onClick={onComplete}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl transition shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    Buka Aplikasi ERP / Kasir <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
