// File: apps/client_unv/src/system-ui/LoginPageSM.tsx
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

export const LoginPageSM: React.FC<{ onLoginSuccess?: () => void }> = ({
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
    if (!outId) return "Holding / Pusat";
    return outlets.find((o) => o.id === outId)?.name || "Cabang Outlet";
  }, [outlets]);

  const currentCompanyName = useMemo(() => {
    const compId = localStorage.getItem("__unv_companyId");
    return companies.find((c) => c.id === compId)?.name || "ALMA Enterprise";
  }, [companies]);

  // 2. Muat Riwayat Login Terakhir di Perangkat Ini
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

  // 3. Opsi Dropdown Karyawan
  const employeeOptions = useMemo(() => {
    return (employees || [])
      .filter((emp) => emp.systemStatus !== "ARCHIVED" && emp.status !== "Arsip")
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

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleSelectRecent = (user: RecentUser) => {
    setSelectedEmployeeId(user.employeeId);
    setPin("");
  };

  const handleNumClick = (digit: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
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

    const account = (userAccounts || []).find(
      (u) => u.employeeId === selectedEmployeeId,
    );

    const validPin = account?.pin || "123456";
    const empName = selectedEmployee?.fullName || "Karyawan";
    const empRole = account?.role || "STAFF";

    if (
      pin === validPin ||
      (account?.passwordHash && pin === account.passwordHash)
    ) {
      const activeUserData = {
        id: account?.id || `USR_${selectedEmployeeId}`,
        employeeId: selectedEmployeeId,
        username: account?.username || empName,
        fullName: empName,
        role: empRole,
      };

      localStorage.setItem("__unv_activeUser", JSON.stringify(activeUserData));

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

      localStorage.setItem("__unv_recent_logins", JSON.stringify(updatedRecent));

      sysToast.success("Login Berhasil", `Selamat bertugas, ${empName}!`);
      if (onLoginSuccess) {
        onLoginSuccess();
      } else {
        window.location.reload();
      }
    } else {
      setIsShaking(true);
      setPin("");
      setTimeout(() => setIsShaking(false), 500);
      sysToast.error("PIN Salah", "PIN akses tidak sesuai. Silakan coba lagi.");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-slate-950 p-4 font-sans text-slate-100 selection:bg-orange-500 selection:text-white overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-sm mx-auto space-y-4 pt-2">
        {/* Header Unit & Cabang Mobile */}
        <div className="p-3.5 bg-slate-900/80 border border-white/10 rounded-2xl backdrop-blur-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md">
              <span className="font-black text-white text-lg">Z</span>
            </div>
            <div>
              <h2 className="font-black text-xs text-white uppercase tracking-wider flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-orange-400" />
                {currentOutletName}
              </h2>
              <span className="text-[9px] text-slate-400 font-mono">
                {currentCompanyName}
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[9px] font-black uppercase">
            Ready POS
          </span>
        </div>

        {/* Recent Karyawan Cepat (Chips) */}
        {recentUsers.length > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-orange-400" /> Karyawan Terakhir:
            </span>
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {recentUsers.map((user) => {
                const isSelected = selectedEmployeeId === user.employeeId;
                return (
                  <button
                    key={user.employeeId}
                    type="button"
                    onClick={() => handleSelectRecent(user)}
                    className={`shrink-0 flex items-center gap-1.5 p-1.5 pr-2.5 rounded-xl border transition ${
                      isSelected
                        ? "bg-orange-500/20 border-orange-500 text-white shadow-sm"
                        : "bg-slate-900/80 border-white/5 text-slate-400"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[9px] ${
                        isSelected ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {user.initials}
                    </div>
                    <span className="text-[11px] font-bold truncate max-w-20">
                      {user.fullName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pemilihan Karyawan (Dropdown arah BOTTOM untuk mobile) */}
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
            dropdownDirection="bottom"
          />
        </div>

        {/* Masked PIN Dots */}
        <div className="space-y-1 text-center pt-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            PIN Akses (4-6 Digit):
          </label>
          <div
            className={`flex items-center justify-center gap-2.5 py-2.5 bg-slate-900/90 rounded-2xl border border-white/10 ${
              isShaking ? "animate-shake border-rose-500" : ""
            }`}
          >
            {Array.from({ length: 6 }).map((_, idx: number) => (
              <div
                key={idx}
                className={`w-3 h-3 rounded-full border transition-all duration-150 ${
                  pin.length > idx
                    ? "bg-orange-500 border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.8)] scale-110"
                    : "bg-slate-800 border-slate-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Virtual Numpad Mobile */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleNumClick(n)}
              className="h-12 rounded-xl bg-slate-900/90 active:bg-orange-500 active:text-white border border-white/5 text-base font-bold text-white transition active:scale-95 flex items-center justify-center shadow-xs"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-xl bg-slate-900/90 active:bg-rose-500/20 text-slate-400 active:text-rose-400 border border-white/5 font-bold transition active:scale-95 flex items-center justify-center"
            title="Hapus"
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleNumClick("0")}
            className="h-12 rounded-xl bg-slate-900/90 active:bg-orange-500 active:text-white border border-white/5 text-base font-bold text-white transition active:scale-95 flex items-center justify-center shadow-xs"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleLogin}
            disabled={!selectedEmployeeId || pin.length < 4}
            className="h-12 rounded-xl bg-linear-to-r from-orange-500 to-orange-600 text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-orange-500/20 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-1"
          >
            Masuk <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="text-center py-2 text-[9px] font-mono text-slate-600">
        ALMA Enterprise • Quick Touch POS
      </div>
    </div>
  );
};
