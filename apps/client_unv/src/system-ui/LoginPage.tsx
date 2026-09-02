// File: apps/client_unv/src/system-ui/LoginPage.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Lock,
  User,
  Delete,
  ArrowRight,
  ShieldCheck,
  Building2,
  Store,
  Clock,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { UniversalCombobox } from "../shared-ui/UniversalCombobox";
import { useOrgStore } from "../../../../modules/mdl_organization/src/client/store";
import { sysToast } from "../shared-ui/useToastStore";

interface RecentUser {
  employeeId: string;
  fullName: string;
  role: string;
  initials: string;
  lastLogin: number;
}

export const LoginPage: React.FC<{ onLoginSuccess?: () => void }> = ({
  onLoginSuccess,
}) => {
  const { employees, userAccounts, outlets, companies } = useOrgStore();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);

  // 1. Ambil Nama Outlet & Perusahaan dari Konfigurasi Perangkat
  const currentOutletName = useMemo(() => {
    const outId = localStorage.getItem("__unv_outletId");
    if (!outId) return "Holding / Kantor Pusat";
    return outlets.find((o) => o.id === outId)?.name || "Cabang Outlet";
  }, [outlets]);

  const currentCompanyName = useMemo(() => {
    const compId = localStorage.getItem("__unv_companyId");
    return companies.find((c) => c.id === compId)?.name || "ALMA Enterprise";
  }, [companies]);

  // 2. Muat 10 Riwayat Login Terakhir di Perangkat Ini
  useEffect(() => {
    try {
      const raw = localStorage.getItem("__unv_recent_logins");
      if (raw) {
        setRecentUsers(JSON.parse(raw));
      }
    } catch {
      setRecentUsers([]);
    }
  }, []);

  // 3. Siapkan Opsi Dropdown Karyawan
  const employeeOptions = useMemo(() => {
    return (employees || [])
      .filter((emp) => emp.systemStatus !== "ARCHIVED")
      .map((emp) => {
        const user = (userAccounts || []).find((u) => u.employeeId === emp.id);
        const roleLabel = user?.role || emp.employmentStatus || "STAFF";
        return {
          value: emp.id,
          label: `${emp.fullName} (${roleLabel})`,
        };
      });
  }, [employees, userAccounts]);

  const selectedEmployee = useMemo(() => {
    return (employees || []).find((e) => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  // Helper Initials (misal: "Rendi Faizal" -> "RF")
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Pilih dari Kartu Nama Cepat
  const handleSelectRecent = (user: RecentUser) => {
    setSelectedEmployeeId(user.employeeId);
    setPin("");
  };

  // Pengetikan Numpad Sentuh
  const handleNumClick = (digit: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin("");
  };

  // 4. Eksekusi Autentikasi PIN
  const handleLogin = () => {
    if (!selectedEmployeeId) {
      sysToast.warn("Perhatian", "Pilih nama karyawan terlebih dahulu.");
      return;
    }

    if (!pin) {
      sysToast.warn("Perhatian", "Masukkan PIN akses Anda.");
      return;
    }

    // Cari akun terkait karyawan
    const account = (userAccounts || []).find(
      (u) => u.employeeId === selectedEmployeeId,
    );

    // Cocokkan PIN (Default fallback 123456 jika belum disetel)
    const validPin = account?.pin || "123456";
    const empName = selectedEmployee?.fullName || "Karyawan";
    const empRole = account?.role || "STAFF";

    if (
      pin === validPin ||
      (account?.passwordHash && pin === account.passwordHash)
    ) {
      // Simpan Sesi Aktor Aktif
      const activeUserData = {
        id: account?.id || `USR_${selectedEmployeeId}`,
        employeeId: selectedEmployeeId,
        username: account?.username || empName,
        fullName: empName,
        role: empRole,
      };
      localStorage.setItem("__unv_activeUser", JSON.stringify(activeUserData));

      // Perbarui Daftar 10 Karyawan Terakhir (Deduplikasi & Paling Baru di Depan)
      const newRecent: RecentUser = {
        employeeId: selectedEmployeeId,
        fullName: empName,
        role: empRole,
        initials: getInitials(empName),
        lastLogin: Date.now(),
      };

      const updatedRecent = [
        newRecent,
        ...recentUsers.filter((u) => u.employeeId !== selectedEmployeeId),
      ].slice(0, 10);

      localStorage.setItem(
        "__unv_recent_logins",
        JSON.stringify(updatedRecent),
      );

      sysToast.success("Login Berhasil", `Selamat bertugas, ${empName}!`);

      if (onLoginSuccess) {
        onLoginSuccess();
      } else {
        window.location.reload();
      }
    } else {
      // Efek Getar jika PIN Salah
      setIsShaking(true);
      setPin("");
      setTimeout(() => setIsShaking(false), 500);
      sysToast.error("PIN Salah", "PIN akses tidak sesuai. Silakan coba lagi.");
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 font-sans selection:bg-orange-500 selection:text-white overflow-hidden">
      {/* Background Ornamen Glow dengan Animasi */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-120 h-120 rounded-full bg-orange-500/10 blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
            x: ["-50%", "-45%", "-50%"],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.25, 0.1],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Kartu Sentral Liquid Glass */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-md bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col space-y-5 text-slate-100"
      >
        {/* Header Unit & Cabang */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <span className="font-black text-white text-xl">Z</span>
            </div>
            <div>
              <h2 className="font-black text-sm text-white tracking-wide uppercase flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-orange-400" />
                {currentOutletName}
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">
                {currentCompanyName}
              </span>
            </div>
          </div>
          <div className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-wider">
            Ready POS
          </div>
        </div>

        {/* 10 Karyawan Cepat (Recent Quick Switch) */}
        {recentUsers.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-orange-400" /> Karyawan Terakhir
              (Cepat):
            </span>
            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1.5 pt-0.5">
              {recentUsers.map((user) => {
                const isSelected = selectedEmployeeId === user.employeeId;
                return (
                  <button
                    key={user.employeeId}
                    type="button"
                    onClick={() => handleSelectRecent(user)}
                    className={`shrink-0 flex items-center gap-2 p-1.5 pr-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-orange-500/20 border-orange-500 text-white shadow-md shadow-orange-500/10 scale-105"
                        : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] ${
                        isSelected
                          ? "bg-orange-500 text-white"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {user.initials}
                    </div>
                    <div className="text-left leading-tight">
                      <div className="text-[11px] font-bold truncate max-w-20">
                        {user.fullName}
                      </div>
                      <div className="text-[8px] opacity-60 uppercase font-mono">
                        {user.role}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Form Pemilihan Karyawan */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            Pilih Nama Karyawan:
          </label>
          <UniversalCombobox
            options={employeeOptions}
            value={selectedEmployeeId}
            onChange={(val) => {
              setSelectedEmployeeId(val);
              setPin("");
            }}
            placeholder="Cari atau pilih nama karyawan..."
            dropdownDirection="left" // Dropdown muncul ke samping (kanan) dari input
          />
        </div>

        {/* Indikator Titik PIN (Masked Dots) */}
        <div className="space-y-2 text-center pt-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            Ketik PIN Akses (4-6 Digit):
          </label>
          <motion.div
            animate={isShaking ? { x: [-10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center gap-3 py-2 bg-slate-950/80 rounded-2xl border border-white/5"
          >
            {Array.from({ length: 6 }).map((_, idx: number) => (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                  pin.length > idx
                    ? "bg-orange-500 border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.8)] scale-110"
                    : "bg-slate-800 border-slate-700"
                }`}
              />
            ))}
          </motion.div>
        </div>

        {/* Virtual Numpad Terintegrasi (Layar Sentuh Ready) */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleNumClick(n)}
              className="h-12 rounded-xl bg-white/5 hover:bg-white/10 active:bg-orange-500 active:text-white border border-white/5 text-base font-bold text-white transition-all cursor-pointer select-none active:scale-95 flex items-center justify-center shadow-xs"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-rose-400 border border-white/5 font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center justify-center"
            title="Hapus Satu Angka"
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleNumClick("0")}
            className="h-12 rounded-xl bg-white/5 hover:bg-white/10 active:bg-orange-500 active:text-white border border-white/5 text-base font-bold text-white transition-all cursor-pointer select-none active:scale-95 flex items-center justify-center shadow-xs"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleLogin}
            disabled={!selectedEmployeeId || pin.length < 4}
            className="h-12 rounded-xl bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-orange-500/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer select-none active:scale-95 flex items-center justify-center gap-1"
          >
            MASUK <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
