// File: modules/mdl_organization/src/client/AccountPageSM.tsx
import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  Key,
  Lock,
  User,
  Users,
  X,
  CheckCircle2,
} from "lucide-react";
import { useOrgStore, useHasWriteAccess } from "./store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayoutSM";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";

// =========================================================================
// 1. FORM USER ACCOUNT MOBILE
// =========================================================================
const UserAccountFormSM: React.FC<{
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, initialData, onClose }) => {
  const { employees, positions } = useOrgStore();
  const [formData, setFormData] = useState<any>({
    role: "STAFF",
    ...(initialData || {}),
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId) {
      return sysToast.error("Error", "Pilih karyawan pemilik akun!");
    }
    if (!formData.username) {
      return sysToast.error("Error", "Username wajib diisi!");
    }
    try {
      await globalCommandBus.execute({
        type: isEditMode ? "UPDATE_USER_ACCOUNT" : "CREATE_USER_ACCOUNT",
        payload: {
          ...formData,
          role: formData.role || "STAFF",
        },
      });
      sysToast.success(
        "Berhasil",
        `Akun ${formData.username} berhasil disimpan.`,
      );
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-(--bg-card) w-full max-w-lg rounded-2xl shadow-2xl border border-(--border-color) overflow-hidden flex flex-col max-h-[92vh] text-(--text-primary)">
        <div className="px-4 py-3 border-b border-(--border-color) flex items-center justify-between bg-(--surface-hover) shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            <h3 className="font-black text-xs uppercase tracking-wide">
              {isEditMode ? "Edit Akun Pengguna" : "Buat Akun Sistem Baru"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-(--text-secondary) hover:text-rose-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSave}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="p-4 overflow-y-auto custom-scrollbar space-y-3.5 flex-1">
            <div>
              <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                Karyawan Pemilik Akun
              </label>
              <select
                value={formData.employeeId || ""}
                onChange={(e) =>
                  setFormData({ ...formData, employeeId: e.target.value })
                }
                required
                disabled={isEditMode}
                className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500 disabled:opacity-50"
              >
                <option value="">-- PILIH KARYAWAN --</option>
                {employees
                  .filter((e) => e.status === "Aktif")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      [{e.employeeNumber}] {e.fullName}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                Username Login
              </label>
              <input
                type="text"
                required
                disabled={isEditMode}
                value={formData.username || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    username: e.target.value.toLowerCase().trim(),
                  })
                }
                placeholder="kasir01 / supervisor"
                className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500 font-mono disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                  Password {isEditMode && "(Opsional)"}
                </label>
                <input
                  type="password"
                  required={!isEditMode}
                  value={formData.passwordHash || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, passwordHash: e.target.value })
                  }
                  placeholder="••••••••"
                  className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                  PIN Kasir (6 Digit)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={formData.pin || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, pin: e.target.value })
                  }
                  placeholder="123456"
                  className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500 font-mono text-center tracking-widest"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                Role Guard (Hak Akses)
              </label>
              <select
                value={formData.role || "STAFF"}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
              >
                <option value="SUPER_ADMIN">SUPER ADMIN (Semua Akses)</option>
                <option value="OUTLET_MANAGER">
                  OUTLET MANAGER (Manajer Toko)
                </option>
                <option value="ADMIN">ADMIN OUTLET (Staff Kantor)</option>
                <option value="STAFF">STAFF UMUM / KASIR (Operasional)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                Jabatan Struktural Terkait
              </label>
              <select
                value={formData.positionId || ""}
                onChange={(e) =>
                  setFormData({ ...formData, positionId: e.target.value })
                }
                className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
              >
                <option value="">-- TANPA POSISI --</option>
                {positions
                  .filter((p) => p.status === "Aktif")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="px-4 py-3 bg-(--surface-hover) border-t border-(--border-color) flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-(--text-secondary) rounded-lg"
            >
              BATAL
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-md"
            >
              SIMPAN AKUN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// 2. HALAMAN UTAMA MOBILE: ACCOUNT PAGE SM
// =========================================================================
export function AccountPageSM() {
  const { userAccounts, employees, positions, employmentAssignments } =
    useOrgStore();
  const hasWriteAccess = useHasWriteAccess();
  const { openAlert } = useUniversalModal();

  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  // =========================================================================
  // FILTER TERPADU BERDASARKAN UNIT (REGION / OUTLET)
  // =========================================================================
  const localOutletId = localStorage.getItem("__unv_outletId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";

  const allowedEmployeeIds = useMemo(() => {
    if (localOutletId) {
      return new Set(
        (employmentAssignments || [])
          .filter((a) => a.outletId === localOutletId && a.status === "Aktif")
          .map((a) => a.employeeId),
      );
    }
    if (localRegionId) {
      return new Set(
        (employmentAssignments || [])
          .filter((a) => a.regionId === localRegionId && a.status === "Aktif")
          .map((a) => a.employeeId),
      );
    }
    return new Set((employees || []).map((e) => e.id));
  }, [employmentAssignments, employees, localOutletId, localRegionId]);

  const scopedUserAccounts = useMemo(() => {
    return userAccounts.filter((u) => {
      const matchStatus =
        viewStatus === "AKTIF" ? u.status === "Aktif" : u.status === "Arsip";
      return matchStatus && allowedEmployeeIds.has(u.employeeId);
    });
  }, [userAccounts, viewStatus, allowedEmployeeIds]);

  const handleArchive = (id: string, username: string) => {
    openAlert({
      title: "Kunci / Arsipkan Akun",
      message: `Akun "${username}" yang diarsipkan tidak akan bisa login ke mesin kasir/ERP.`,
      confirmText: "YA, ARSIPKAN",
      onConfirm: async () => {
        try {
          await globalCommandBus.execute({
            type: "ARCHIVE_DATA",
            payload: { id, type: "USER_ACCOUNT" },
          });
          sysToast.success("Berhasil", `Akun ${username} dinonaktifkan.`);
        } catch (err: any) {
          sysToast.error("Gagal", err.message);
        }
      },
    });
  };

  const handleRestore = async (id: string) => {
    try {
      await globalCommandBus.execute({
        type: "RESTORE_DATA",
        payload: { id, type: "USER_ACCOUNT" },
      });
      sysToast.success("Berhasil", "Akses login akun dipulihkan.");
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {isFormOpen && (
        <UserAccountFormSM
          isEditMode={Boolean(editUser)}
          initialData={editUser}
          onClose={() => {
            setIsFormOpen(false);
            setEditUser(null);
          }}
        />
      )}

      {/* HEADER MOBILE */}
      <div className="p-3 bg-(--bg-card) border-b border-(--border-color) shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-sm font-black text-(--text-primary) uppercase tracking-wide">
                Master Akun Sistem
              </h2>
              <span className="text-[10px] text-(--text-secondary) font-bold">
                Otorisasi &amp; PIN Kasir
              </span>
            </div>
          </div>

          {hasWriteAccess && viewStatus === "AKTIF" && (
            <button
              onClick={() => {
                setEditUser(null);
                setIsFormOpen(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm"
            >
              <Plus className="w-4 h-4" /> Akun
            </button>
          )}
        </div>

        {/* TOGGLE AKTIF / ARSIP */}
        <div className="flex bg-(--bg-input) rounded-lg border border-(--border-color) p-0.5">
          <button
            onClick={() => setViewStatus("AKTIF")}
            className={`flex-1 py-1 text-[10px] font-black rounded text-center ${
              viewStatus === "AKTIF"
                ? "bg-orange-500 text-white shadow-xs"
                : "text-(--text-secondary)"
            }`}
          >
            AKUN AKTIF (
            {scopedUserAccounts.filter((u) => u.status === "Aktif").length})
          </button>
          <button
            onClick={() => setViewStatus("ARSIP")}
            className={`flex-1 py-1 text-[10px] font-black rounded text-center ${
              viewStatus === "ARSIP"
                ? "bg-slate-700 text-white shadow-xs"
                : "text-(--text-secondary)"
            }`}
          >
            AKUN DIKUNCI / ARSIP
          </button>
        </div>
      </div>

      {/* DAFTAR AKUN (KARTU MOBILE) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {scopedUserAccounts.map((user) => {
          const emp = employees.find((e) => e.id === user.employeeId);
          const pos = positions.find((p) => p.id === user.positionId);

          let roleBadgeColor =
            "bg-slate-500/10 text-slate-400 border-slate-500/20";
          if (user.role === "SUPER_ADMIN")
            roleBadgeColor = "bg-rose-500/10 text-rose-500 border-rose-500/20";
          if (user.role === "OUTLET_MANAGER")
            roleBadgeColor =
              "bg-amber-500/10 text-amber-500 border-amber-500/20";
          if (user.role === "CASHIER" || user.role === "STAFF")
            roleBadgeColor =
              "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";

          return (
            <div
              key={user.id}
              className="bg-(--bg-card) border border-(--border-color) rounded-xl p-3 shadow-xs space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono font-bold text-xs text-orange-500">
                    @{user.username}
                  </div>
                  <div className="font-bold text-sm text-(--text-primary) mt-0.5">
                    {emp?.fullName || user.employeeId}
                  </div>
                  <div className="text-[10px] font-mono text-(--text-secondary)">
                    NIK: {emp?.employeeNumber || "-"}
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[8px] font-black tracking-wider border uppercase ${roleBadgeColor}`}
                >
                  {user.role}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-(--border-color) text-xs">
                <span className="text-[10px] text-(--text-secondary)">
                  Posisi:{" "}
                  <strong className="text-(--text-primary)">
                    {pos?.name || "-"}
                  </strong>
                </span>

                {hasWriteAccess && (
                  <div className="flex items-center gap-1.5">
                    {viewStatus === "AKTIF" ? (
                      <>
                        <button
                          onClick={() => {
                            setEditUser(user);
                            setIsFormOpen(true);
                          }}
                          className="p-1.5 text-(--text-secondary) hover:text-orange-500 border border-(--border-color) rounded-lg"
                          title="Edit Akun"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleArchive(user.id, user.username)}
                          className="p-1.5 text-(--text-secondary) hover:text-rose-500 border border-(--border-color) rounded-lg"
                          title="Kunci / Arsipkan"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleRestore(user.id)}
                        className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded-lg flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {scopedUserAccounts.length === 0 && (
          <div className="p-8 text-center text-(--text-secondary) font-bold text-xs italic">
            Belum ada akun pengguna pada status ini.
          </div>
        )}
      </div>
    </div>
  );
}
