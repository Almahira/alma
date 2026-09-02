// File: apps/client_unv/src/system-ui/SetupWizard.tsx
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

const AlertModal: React.FC<{
  alert: AlertState;
  onClose: () => void;
}> = ({ alert, onClose }) => {
  if (!alert.isOpen) return null;
  const config = {
    success: {
      icon: CheckCircle2,
      color: "text-emerald-500",
      ring: "border-emerald-200",
      button: "bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-300",
      bg: "bg-emerald-50",
    },
    error: {
      icon: AlertTriangle,
      color: "text-red-500",
      ring: "border-red-200",
      button: "bg-red-500 hover:bg-red-600 focus:ring-red-300",
      bg: "bg-red-50",
    },
    warning: {
      icon: AlertTriangle,
      color: "text-amber-500",
      ring: "border-amber-200",
      button: "bg-amber-500 hover:bg-amber-600 focus:ring-amber-300",
      bg: "bg-amber-50",
    },
    info: {
      icon: Info,
      color: "text-blue-500",
      ring: "border-blue-200",
      button: "bg-blue-500 hover:bg-blue-600 focus:ring-blue-300",
      bg: "bg-blue-50",
    },
  }[alert.type];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 transform transition-all">
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl ${config.bg} ${config.color} flex items-center justify-center shrink-0`}
          >
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              {alert.title}
            </h3>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              {alert.message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className={`px-5 py-2.5 ${config.button} text-white font-bold text-xs uppercase tracking-wider rounded-xl transition focus:outline-none focus:ring-2 cursor-pointer`}
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
};

const StepProgress: React.FC<{
  currentStep: number;
  isVirgin: boolean;
  mainMode: string | null;
}> = ({ currentStep, isVirgin, mainMode }) => {
  const steps = isVirgin
    ? [
        { id: 1, label: "Lisensi", icon: Key },
        { id: 2, label: "Struktur", icon: Building2 },
        { id: 3, label: "Admin", icon: ShieldCheck },
        { id: 4, label: "Sinkronisasi", icon: TerminalSquare },
      ]
    : [
        { id: 1, label: "Otorisasi", icon: ShieldCheck },
        { id: 2, label: "Lingkup", icon: Store },
        {
          id: 3,
          label: mainMode === "RECOVERY" ? "Mesin Lama" : "Modul",
          icon: mainMode === "RECOVERY" ? Laptop : Layers,
        },
        { id: 4, label: "Sinkronisasi", icon: TerminalSquare },
      ];

  return (
    <div className="px-8 py-5 bg-slate-50/80 border-b border-slate-100">
      <div className="relative flex items-center justify-between">
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-slate-200 rounded-full z-0" />
        <div
          className="absolute top-5 left-5 h-0.5 bg-linear-to-r from-orange-400 to-orange-500 rounded-full z-10 transition-all duration-700 ease-out"
          style={{
            width: `calc((100% - 2.5rem) * ${Math.max(0, currentStep - 1) / (steps.length - 1)})`,
          }}
        />
        {steps.map((s) => {
          const isCompleted = currentStep > s.id;
          const isActive = currentStep === s.id;
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className="relative z-20 flex flex-col items-center gap-1.5"
            >
              <div
                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                  isCompleted
                    ? "bg-linear-to-br from-orange-400 to-orange-500 shadow-lg shadow-orange-500/40 text-white"
                    : isActive
                      ? "bg-white/70 backdrop-blur-xl border-2 border-orange-500 shadow-lg shadow-orange-500/30 scale-110 text-orange-500"
                      : "bg-white/40 backdrop-blur-md border-2 border-slate-200 text-slate-400"
                }`}
              >
                <Icon className="w-5 h-5" />
                {isCompleted && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                    <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${
                  isActive || isCompleted ? "text-orange-600" : "text-slate-400"
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

export const SetupWizard: React.FC<{ onComplete: () => void }> = ({
  onComplete,
}) => {
  const availablePlugins = manager.getAllPlugins();
  const [isVirgin, setIsVirgin] = useState<boolean | null>(null);
  const [mainMode, setMainMode] = useState<"NEW_DEVICE" | "RECOVERY" | null>(
    null,
  );
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [alert, setAlert] = useState<AlertState>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });
  const [animKey, setAnimKey] = useState(0);

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
  const [deviceScope, setDeviceScope] = useState<
    "COMPANY" | "REGION" | "OUTLET"
  >("OUTLET");

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

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [step, mainMode, isVirgin]);

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
      sysToast.success(
        "Lisensi Free Aktif",
        "Menggunakan 7 modul inti komunitas.",
      );
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
        res.errorMessage ||
          "Format kunci lisensi tidak valid atau tanda tangan digital rusak.",
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

  const handleToggleModule = (modName: string, isCore?: boolean) => {
    if (isCore || modName === "mdl_organization") return;
    setSelectedModules((prev) =>
      prev.includes(modName)
        ? prev.filter((id) => id !== modName)
        : [...prev, modName],
    );
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      showAlert(
        "warning",
        "GPS Tidak Didukung",
        "Browser Anda tidak mendukung geolokasi.",
      );
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
        showAlert(
          "error",
          "Gagal Mendeteksi Lokasi",
          "Pastikan izin lokasi diaktifkan pada browser.",
        );
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
      sysToast.success(
        "Otorisasi Berhasil",
        "Identitas supervisor terverifikasi.",
      );
      setStep(2);
    } catch (err: any) {
      sysToast.error(
        "Otorisasi Gagal",
        err.message || "Email atau password salah.",
      );
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
      const res = await fetch(
        getApiUrl(`/api/provision/devices-by-scope?${query.toString()}`),
      );
      const data = await res.json();
      if (res.ok) {
        setExistingDevices(data.devices || []);
      }
    } catch (err) {
      showAlert(
        "error",
        "Gagal Mengambil Data",
        "Gagal memuat daftar perangkat aktif.",
      );
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
    addLog(
      `[SECURITY] Kunci Terdaftar. Public Key: ${keyPair.publicKey.substring(0, 16)}...`,
    );

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
        addLog(
          `[RECOVERY] Mengambil alih identitas mesin rusak (${replaceDeviceId})...`,
        );
      } else if (isVirgin) {
        endpoint = getApiUrl("/api/provision/cold-start");
        bodyData = {
          company: { name: companyName, legalName },
          region:
            deviceScope !== "COMPANY" && regionName
              ? { name: regionName }
              : null,
          outlet:
            deviceScope === "OUTLET" && outletName
              ? { name: outletName }
              : null,
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
        addLog(
          `[COLD-START] Mendaftarkan entitas holding & akun superadmin...`,
        );
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

      addLog(
        `[RAPID RECOVERY] Menarik Master Data & Transaksi 24 Jam Terakhir...`,
      );
      const pullQuery = new URLSearchParams({
        deviceId: nodeId,
        window: "24h",
      });
      if (data.outletId) pullQuery.append("outletId", data.outletId);
      const pullRes = await fetch(
        getApiUrl(`/api/events/pull/system?${pullQuery.toString()}`),
      );
      if (pullRes.ok) {
        const events = await pullRes.json();
        addLog(`[SYNC] Menerima ${events.length} event instan dari server.`);
      }

      addLog(`[READY] Perangkat resmi aktif dan siap melayani transaksi!`);
      setIsRecoveryDone(true);
    } catch (err: any) {
      addLog(`[FATAL ERROR] ${err.message}`);
      showAlert(
        "error",
        "Proses Gagal",
        err.message || "Terjadi kesalahan saat provisioning.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVirgin === null) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-white font-mono">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // STEP 0: PILIH MODE (JIKA BUKAN VIRGIN & MODE BELUM DIPILIH)
  if (!mainMode && !isVirgin) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-br from-slate-900 via-slate-950 to-black p-6 font-sans">
        <AlertModal
          alert={alert}
          onClose={() => setAlert({ ...alert, isOpen: false })}
        />
        <div
          key={animKey}
          className="w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200/60 p-8 animate-in fade-in"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center font-black text-3xl text-white mx-auto shadow-xl shadow-orange-500/30 mb-4">
              Z
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Portal Aktivasi Mesin{" "}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-500 to-orange-600">
                Alma ERP
              </span>
            </h1>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-2">
              Pilih Tindakan untuk Perangkat Ini
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div
              onClick={() => {
                setMainMode("NEW_DEVICE");
                setStep(1);
              }}
              className="group p-7 rounded-2xl border-2 border-slate-200 hover:border-orange-500 bg-slate-50/80 hover:bg-white transition-all cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-xl hover:shadow-orange-500/10"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-900 group-hover:bg-orange-500 text-white flex items-center justify-center mb-4 transition-all">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <h3 className="font-black text-sm text-slate-800 uppercase tracking-wide">
                  Daftarkan Perangkat Baru
                </h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Konfigurasi mesin baru untuk kasir, gudang, atau holding.
                </p>
              </div>
              <div className="pt-6 flex items-center gap-2 text-xs font-bold text-orange-600 group-hover:translate-x-1 transition-transform">
                Mulai Registrasi <ArrowRight className="w-4 h-4" />
              </div>
            </div>
            <div
              onClick={() => {
                setMainMode("RECOVERY");
                setStep(1);
              }}
              className="group p-7 rounded-2xl border-2 border-slate-200 hover:border-blue-500 bg-slate-50/80 hover:bg-white transition-all cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-xl hover:shadow-blue-500/10"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-slate-900 group-hover:bg-blue-600 text-white flex items-center justify-center mb-4 transition-all">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <h3 className="font-black text-sm text-slate-800 uppercase tracking-wide">
                  Pulihkan Perangkat Lama
                </h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Gantikan tablet yang rusak & pulihkan data 24 jam terakhir.
                </p>
              </div>
              <div className="pt-6 flex items-center gap-2 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                Mulai Pemulihan <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AlertModal
        alert={alert}
        onClose={() => setAlert({ ...alert, isOpen: false })}
      />
      <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-br from-slate-900 via-slate-950 to-black p-6 font-sans">
        <div className="w-full max-w-3xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200/60 flex flex-col">
          {/* Header */}
          <div className="px-8 py-6 bg-linear-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center font-black text-xl shadow-lg shadow-orange-500/30">
                Z
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-wide">
                  Alma <span className="text-orange-400">Setup Wizard</span>
                </h1>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                  {mainMode === "RECOVERY"
                    ? "Disaster Recovery (Ganti Mesin Rusak)"
                    : isVirgin
                      ? "Inisialisasi Sistem Pertama (Cold-Start)"
                      : "Registrasi Mesin Baru"}
                </p>
              </div>
            </div>
            <span className="px-4 py-1.5 bg-white/10 rounded-full text-[10px] font-mono font-bold text-orange-400 border border-white/10">
              LANGKAH {step} / 4
            </span>
          </div>

          <StepProgress
            currentStep={step}
            isVirgin={!!isVirgin}
            mainMode={mainMode}
          />

          <div className="p-8 flex-1 overflow-y-auto">
            <div key={animKey} className="animate-in fade-in duration-200">
              {/* ========================================================= */}
              {/* FLOW COLD-START: STEP 1 (VERIFIKASI LISENSI)             */}
              {/* ========================================================= */}
              {isVirgin && step === 1 && (
                <div className="space-y-5">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-3 flex items-center gap-2">
                    <Key className="w-5 h-5 text-orange-500" /> 1. Kunci Lisensi
                    Kriptografis
                  </h3>

                  <div className="p-4 bg-orange-50/50 border border-orange-200 rounded-2xl space-y-3">
                    <label className="text-[11px] font-black text-slate-700 uppercase block">
                      Masukkan Kunci Lisensi (Dari Email Pembelian):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="licenseKeyInput"
                        name="licenseKeyInput"
                        disabled={isFreeCommunity}
                        value={licenseKeyInput}
                        onChange={(e) =>
                          setLicenseKeyInput(e.target.value.trim())
                        }
                        placeholder="ALMA-LIC-eyJwYXlsb2FkIjp7..."
                        className="flex-1 text-xs font-mono font-bold p-3 bg-white border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 disabled:bg-slate-100 disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyLicense}
                        className="px-5 py-3 bg-slate-900 hover:bg-orange-600 text-white font-bold text-xs uppercase rounded-xl transition shadow cursor-pointer shrink-0"
                      >
                        Verifikasi
                      </button>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1 select-none">
                      <input
                        type="checkbox"
                        id="isFreeCommunity"
                        name="isFreeCommunity"
                        checked={isFreeCommunity}
                        onChange={(e) => {
                          setIsFreeCommunity(e.target.checked);
                          if (e.target.checked) {
                            setLicenseKeyInput("");
                          }
                        }}
                        className="w-4 h-4 rounded text-orange-500 accent-orange-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        Gunakan Versi Komunitas Gratis (Free Tier)
                      </span>
                    </label>
                  </div>

                  {verifiedLicense && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 animate-in fade-in">
                      <div className="flex items-center gap-2 text-emerald-700 font-black text-xs uppercase">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Lisensi Terverifikasi Secara Kriptografis: Paket{" "}
                        {verifiedLicense.tier}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-semibold pt-1">
                        <div>
                          Perusahaan:{" "}
                          <strong className="text-slate-800">
                            {verifiedLicense.companyName || "PT Mandiri"}
                          </strong>
                        </div>
                        <div>
                          Masa Aktif:{" "}
                          <strong className="text-slate-800">
                            {verifiedLicense.validUntil
                              ? new Date(
                                  verifiedLicense.validUntil,
                                ).toLocaleDateString("id-ID")
                              : "Selamanya"}
                          </strong>
                        </div>
                        <div className="col-span-2">
                          Modul Terbuka:{" "}
                          <strong className="text-slate-800">
                            {verifiedLicense.allowedModules.length} Modul Aktif
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={!verifiedLicense}
                      onClick={() => setStep(2)}
                      className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-orange-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-slate-900/10 cursor-pointer"
                    >
                      Lanjut ke Struktur Organisasi{" "}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* FLOW COLD-START: STEP 2 (STRUKTUR ORGANISASI)            */}
              {/* ========================================================= */}
              {isVirgin && step === 2 && (
                <div className="space-y-5">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-3 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-orange-500" /> 2.
                    Struktur Organisasi
                  </h3>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
                      Tingkat Operasional Mesin Ini:
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDeviceScope("COMPANY");
                          setRegionName("");
                          setOutletName("");
                        }}
                        className={`p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                          deviceScope === "COMPANY"
                            ? "border-orange-500 bg-orange-50/80 text-orange-600 font-bold shadow-sm"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <Building2 className="w-6 h-6 mx-auto mb-1" />
                        <div className="text-xs font-bold">Holding / Owner</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeviceScope("REGION");
                          setOutletName("");
                        }}
                        className={`p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                          deviceScope === "REGION"
                            ? "border-orange-500 bg-orange-50/80 text-orange-600 font-bold shadow-sm"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <MapPin className="w-6 h-6 mx-auto mb-1" />
                        <div className="text-xs font-bold">
                          Gudang / Central
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeviceScope("OUTLET")}
                        className={`p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                          deviceScope === "OUTLET"
                            ? "border-orange-500 bg-orange-50/80 text-orange-600 font-bold shadow-sm"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <Store className="w-6 h-6 mx-auto mb-1" />
                        <div className="text-xs font-bold">Outlet / Kasir</div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                        Nama Perusahaan / Bisnis
                      </label>
                      <input
                        type="text"
                        id="companyName"
                        name="companyName"
                        required
                        value={companyName}
                        onChange={(e) =>
                          setCompanyName(e.target.value.toUpperCase())
                        }
                        placeholder="PT ALMA NUSANTARA"
                        className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                        Bentuk Legalitas (Opsional)
                      </label>
                      <input
                        type="text"
                        id="legalName"
                        name="legalName"
                        value={legalName}
                        onChange={(e) =>
                          setLegalName(e.target.value.toUpperCase())
                        }
                        placeholder="PT / CV / PERORANGAN"
                        className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  {(deviceScope === "REGION" || deviceScope === "OUTLET") && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Nama Wilayah / Region
                        </label>
                        <input
                          type="text"
                          id="regionName"
                          name="regionName"
                          required
                          value={regionName}
                          onChange={(e) =>
                            setRegionName(e.target.value.toUpperCase())
                          }
                          placeholder="JAWA BARAT / PUSAT"
                          className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white"
                        />
                      </div>
                      {deviceScope === "OUTLET" && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                            Nama Cabang / Outlet
                          </label>
                          <input
                            type="text"
                            id="outletName"
                            name="outletName"
                            required
                            value={outletName}
                            onChange={(e) =>
                              setOutletName(e.target.value.toUpperCase())
                            }
                            placeholder="CABANG DAGO / LEMBANG"
                            className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-4 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer flex items-center"
                    >
                      <ArrowLeft className="w-4 h-4 inline mr-1" /> Kembali
                    </button>
                    <button
                      type="button"
                      disabled={!companyName.trim()}
                      onClick={() => setStep(3)}
                      className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-orange-600 transition-all disabled:opacity-40 flex items-center gap-2 shadow-lg cursor-pointer"
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
                <div className="space-y-5">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-3 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-orange-500" /> 3. Akun
                    Superadmin & Identitas Mesin
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                        Nama Lengkap Owner
                      </label>
                      <input
                        type="text"
                        id="ownerName"
                        name="ownerName"
                        required
                        value={ownerName}
                        onChange={(e) =>
                          setOwnerName(e.target.value.toUpperCase())
                        }
                        placeholder="RENDI FAIZAL"
                        className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                        Email Login
                      </label>
                      <input
                        type="email"
                        id="adminEmail"
                        name="adminEmail"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="owner@company.com"
                        className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                        Password
                      </label>
                      <input
                        type="password"
                        id="adminPassword"
                        name="adminPassword"
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                        PIN Kasir (4-6 Digit)
                      </label>
                      <input
                        type="password"
                        id="adminPin"
                        name="adminPin"
                        maxLength={6}
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value)}
                        placeholder="123456"
                        className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Nama Identitas Perangkat
                    </label>
                    <input
                      type="text"
                      id="deviceName"
                      name="deviceName"
                      required
                      value={deviceName}
                      onChange={(e) =>
                        setDeviceName(e.target.value.toUpperCase())
                      }
                      placeholder="TABLET-KASIR-01 / LAPTOP-GUDANG"
                      className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white font-mono"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={isLocating}
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-orange-500" />
                      {isLocating
                        ? "Mengunci Satelit GPS..."
                        : latitude
                          ? `GPS Terkunci (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
                          : "Kunci Koordinat Lokasi Mesin"}
                    </button>
                  </div>

                  <div className="pt-4 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer flex items-center"
                    >
                      <ArrowLeft className="w-4 h-4 inline mr-1" /> Kembali
                    </button>
                    <button
                      type="button"
                      disabled={
                        !ownerName ||
                        !adminEmail ||
                        !adminPassword ||
                        !deviceName
                      }
                      onClick={runOrchestrator}
                      className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-orange-500/30 flex items-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Aktifkan Mesin & Selesai"
                      )}{" "}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* FLOW NON-VIRGIN STEP 1: AUTH SUPERVISOR                  */}
              {/* ========================================================= */}
              {!isVirgin && step === 1 && (
                <form onSubmit={handleSupervisorAuth} className="space-y-5">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-3 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-orange-500" /> 1.
                    Otorisasi Supervisor
                  </h3>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Email Administrator
                    </label>
                    <input
                      type="email"
                      id="loginEmail"
                      name="loginEmail"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="admin@company.com"
                      className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      id="loginPassword"
                      name="loginPassword"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white"
                    />
                  </div>
                  <div className="pt-4 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setMainMode(null)}
                      className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer flex items-center"
                    >
                      <ArrowLeft className="w-4 h-4 inline mr-1" /> Ganti Mode
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading || !loginEmail || !loginPassword}
                      className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-orange-600 transition-all disabled:opacity-40 flex items-center gap-2 shadow-lg cursor-pointer"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Verifikasi Otorisasi"
                      )}{" "}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* ========================================================= */}
              {/* FLOW NON-VIRGIN STEP 2: PENEMPATAN LINGKUP               */}
              {/* ========================================================= */}
              {!isVirgin && step === 2 && (
                <div className="space-y-5">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-3 flex items-center gap-2">
                    <Store className="w-5 h-5 text-orange-500" /> 2. Penempatan
                    Lingkup Mesin
                  </h3>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
                      Tingkat Operasional Mesin:
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDeviceScope("COMPANY");
                          setSelectedRegionId("");
                          setSelectedOutletId("");
                        }}
                        className={`p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                          deviceScope === "COMPANY"
                            ? "border-orange-500 bg-orange-50/80 text-orange-600 font-bold shadow-sm"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <Building2 className="w-6 h-6 mx-auto mb-1" />
                        <div className="text-xs font-bold">Holding / Owner</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeviceScope("REGION");
                          setSelectedOutletId("");
                        }}
                        className={`p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                          deviceScope === "REGION"
                            ? "border-orange-500 bg-orange-50/80 text-orange-600 font-bold shadow-sm"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <MapPin className="w-6 h-6 mx-auto mb-1" />
                        <div className="text-xs font-bold">
                          Gudang / Central
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeviceScope("OUTLET")}
                        className={`p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                          deviceScope === "OUTLET"
                            ? "border-orange-500 bg-orange-50/80 text-orange-600 font-bold shadow-sm"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        <Store className="w-6 h-6 mx-auto mb-1" />
                        <div className="text-xs font-bold">Outlet / Kasir</div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Pilih Perusahaan
                    </label>
                    <select
                      id="selectedCompanyId"
                      name="selectedCompanyId"
                      value={selectedCompanyId}
                      onChange={(e) => {
                        setSelectedCompanyId(e.target.value);
                        setSelectedRegionId("");
                        setSelectedOutletId("");
                      }}
                      className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white"
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
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                        Pilih Regional
                      </label>
                      <select
                        id="selectedRegionId"
                        name="selectedRegionId"
                        value={selectedRegionId}
                        onChange={(e) => {
                          setSelectedRegionId(e.target.value);
                          setSelectedOutletId("");
                        }}
                        className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white"
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
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                        Pilih Outlet
                      </label>
                      <select
                        id="selectedOutletId"
                        name="selectedOutletId"
                        value={selectedOutletId}
                        disabled={!selectedRegionId}
                        onChange={(e) => setSelectedOutletId(e.target.value)}
                        className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white disabled:opacity-50"
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

                  <div className="pt-4 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer flex items-center"
                    >
                      <ArrowLeft className="w-4 h-4 inline mr-1" /> Kembali
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
                      className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-orange-600 transition-all disabled:opacity-40 flex items-center gap-2 shadow-lg cursor-pointer"
                    >
                      {mainMode === "RECOVERY"
                        ? "Pilih Mesin yang Rusak"
                        : "Lanjut ke Identitas Mesin"}{" "}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* FLOW NON-VIRGIN STEP 3: RECOVERY / IDENTITAS PERANGKAT    */}
              {/* ========================================================= */}
              {!isVirgin && step === 3 && (
                <div className="space-y-5">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-3 flex items-center gap-2">
                    {mainMode === "RECOVERY" ? (
                      <>
                        <RefreshCw className="w-5 h-5 text-blue-500" /> 3. Pilih
                        Mesin yang Akan Digantikan
                      </>
                    ) : (
                      <>
                        <Layers className="w-5 h-5 text-orange-500" /> 3.
                        Identitas Perangkat Baru
                      </>
                    )}
                  </h3>

                  {mainMode === "RECOVERY" ? (
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block">
                        Pilih Mesin Lama yang Rusak:
                      </label>
                      {existingDevices.length === 0 ? (
                        <div className="p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs font-bold text-slate-400">
                          Tidak ditemukan mesin aktif pada ruang lingkup ini.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2">
                          {existingDevices.map((d) => (
                            <div
                              key={d.id}
                              onClick={() => {
                                setReplaceDeviceId(d.id);
                                setDeviceName(d.name);
                              }}
                              className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-center justify-between group ${
                                replaceDeviceId === d.id
                                  ? "border-blue-500 bg-blue-50/70 text-slate-900 shadow-md"
                                  : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Laptop
                                  className={`w-7 h-7 ${replaceDeviceId === d.id ? "text-blue-600" : "text-slate-400"}`}
                                />
                                <div>
                                  <div className="font-black text-xs">
                                    {d.name}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    ID: {d.id}
                                  </div>
                                </div>
                              </div>
                              {replaceDeviceId === d.id && (
                                <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase">
                                  DIPILIH
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Nama Identitas Perangkat
                        </label>
                        <input
                          type="text"
                          id="deviceName"
                          name="deviceName"
                          required
                          value={deviceName}
                          onChange={(e) =>
                            setDeviceName(e.target.value.toUpperCase())
                          }
                          placeholder="TABLET-KASIR-02"
                          className="w-full text-xs font-bold p-3 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-orange-500 focus:bg-white font-mono"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={isLocating}
                      className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-orange-500" />
                      {isLocating
                        ? "Mengunci Satelit GPS..."
                        : latitude
                          ? `GPS Terkunci (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
                          : "Kunci Koordinat Lokasi Mesin"}
                    </button>
                  </div>

                  <div className="pt-4 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer flex items-center"
                    >
                      <ArrowLeft className="w-4 h-4 inline mr-1" /> Kembali
                    </button>
                    <button
                      type="button"
                      disabled={
                        (mainMode === "RECOVERY" && !replaceDeviceId) ||
                        (mainMode === "NEW_DEVICE" && !deviceName) ||
                        isSubmitting
                      }
                      onClick={runOrchestrator}
                      className={`px-8 py-3 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 cursor-pointer ${
                        mainMode === "RECOVERY"
                          ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/30"
                          : "bg-orange-500 hover:bg-orange-600 shadow-orange-500/30"
                      }`}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : mainMode === "RECOVERY" ? (
                        "Ambil Alih & Pulihkan Data"
                      ) : (
                        "Aktifkan Perangkat"
                      )}{" "}
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
                  <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wide">
                    <TerminalSquare
                      className={`w-5 h-5 ${isRecoveryDone ? "text-emerald-500" : "text-orange-500 animate-pulse"}`}
                    />
                    {isRecoveryDone
                      ? "Perangkat Berhasil Diaktifkan"
                      : "Menjalankan Protokol Provisioning..."}
                  </div>
                  <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                        <span className="text-[10px] font-mono text-slate-400 ml-2">
                          provision@alma-core:~$
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {isRecoveryDone ? "ONLINE" : "PROGRESS"}
                      </span>
                    </div>
                    <div className="p-4 h-64 overflow-y-auto font-mono text-[11px] leading-relaxed text-emerald-400 bg-slate-950">
                      {logs.map((log, idx) => (
                        <div
                          key={idx}
                          className={`mb-1 ${log.startsWith("  [FATAL") ? "text-red-400" : ""} ${log.startsWith("  [READY") ? "text-emerald-300 font-bold" : ""}`}
                        >
                          <span className="text-slate-500">&gt; </span>
                          {log}
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                  {isRecoveryDone && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={onComplete}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Buka Aplikasi ERP / Kasir{" "}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
