// File: modules/mdl_organization/src/client/AccountPage.tsx
import React, { useState } from "react";
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
} from "lucide-react";
import { useOrgStore } from "./store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayout";

const UserAccountForm: React.FC<{
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, initialData, onClose }) => {
  const { openAlert } = useUniversalModal();
  const { employees, positions } = useOrgStore();
  const [formData, setFormData] = useState<any>(
    initialData || { role: "CASHIER" },
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await globalCommandBus.execute({
        type: isEditMode ? "UPDATE_USER_ACCOUNT" : "CREATE_USER_ACCOUNT",
        payload: formData,
      });
      onClose();
    } catch (err: any) {
      openAlert({ title: "Gagal", message: err.message });
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 flex flex-col h-full">
      <div className="flex-1 space-y-4">
        <div>
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            PILIH KARYAWAN PEMILIK AKUN
          </label>
          <select
            value={formData.employeeId || ""}
            onChange={(e) =>
              setFormData({ ...formData, employeeId: e.target.value })
            }
            required
            disabled={isEditMode}
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
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
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            USERNAME / EMAIL LOGIN
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
            placeholder="kasir01 / supervisor@company.com"
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              PASSWORD {isEditMode && "(KOSONGKAN JIKA TIDAK UBAH)"}
            </label>
            <input
              type="password"
              required={!isEditMode}
              value={formData.passwordHash || ""}
              onChange={(e) =>
                setFormData({ ...formData, passwordHash: e.target.value })
              }
              placeholder="••••••••"
              className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              PIN KASIR OFFLINE (4-6 ANGKA)
            </label>
            <input
              type="password"
              maxLength={6}
              value={formData.pin || ""}
              onChange={(e) =>
                setFormData({ ...formData, pin: e.target.value })
              }
              placeholder="123456"
              className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500 font-mono tracking-widest"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              HAK AKSES / ROLE GUARD
            </label>
            <select
              value={formData.role || "CASHIER"}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }
              className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
            >
              <option value="SUPER_ADMIN">SUPER ADMIN (SEMUA AKSES)</option>
              <option value="OUTLET_MANAGER">OUTLET MANAGER</option>
              <option value="CASHIER">KASIR (POS)</option>
              <option value="KITCHEN">KITCHEN / DISPLAY</option>
              <option value="PURCHASING">PURCHASING & GUDANG</option>
              <option value="STAFF">STAFF UMUM</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              JABATAN STRUKTURAL
            </label>
            <select
              value={formData.positionId || ""}
              onChange={(e) =>
                setFormData({ ...formData, positionId: e.target.value })
              }
              className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
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
      </div>
      <div className="pt-4 flex justify-end gap-3 border-t border-(--border-color)">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 text-xs font-bold text-(--text-secondary)"
        >
          BATAL
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-black text-white bg-orange-500 rounded-lg"
        >
          SIMPAN AKUN
        </button>
      </div>
    </form>
  );
};

export const AccountPage: React.FC = () => {
  const { openSideOver, closeSideOver, openAlert } = useUniversalModal();
  const { userAccounts, employees, positions } = useOrgStore();
  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");

  const handleArchive = (id: string) => {
    openAlert({
      title: "Arsipkan Akun",
      message: "Akun yang diarsipkan tidak akan bisa login ke mesin mana pun.",
      confirmText: "ARSIPKAN",
      onConfirm: async () => {
        await globalCommandBus.execute({
          type: "ARCHIVE_DATA",
          payload: { id, type: "USER_ACCOUNT" },
        });
      },
    });
  };

  const handleRestore = (id: string) => {
    openAlert({
      title: "Aktifkan Akun",
      message: "Pulihkan akses login akun ini?",
      confirmText: "AKTIFKAN",
      onConfirm: async () => {
        await globalCommandBus.execute({
          type: "RESTORE_DATA",
          payload: { id, type: "USER_ACCOUNT" },
        });
      },
    });
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* Header Utama */}
      <div className="h-18 px-6 flex items-center justify-between bg-(--bg-card) border-b border-(--border-color) shrink-0">
        <div>
          <h2 className="text-2xl font-black text-(--text-primary) tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-orange-500" /> Master Akun
            Sistem & Role Guard
          </h2>
          <p className="text-xs text-(--text-secondary) font-semibold mt-0.5">
            Otorisasi Pengguna, Kredensial Login, dan PIN Mesin Kasir
          </p>
        </div>
        <button
          onClick={() => {
            openSideOver({
              title: "BUAT AKUN PENGGUNA",
              width: "w-[500px]",
              content: (
                <UserAccountForm
                  isEditMode={false}
                  initialData={{}}
                  onClose={closeSideOver}
                />
              ),
            });
          }}
          className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition shadow-[0_4px_10px_rgba(249,115,22,0.3)] cursor-pointer"
        >
          <Plus className="w-4 h-4" /> + BUAT AKUN BARU
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 bg-(--bg-card) border-b border-(--border-color) flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setViewStatus("AKTIF")}
            className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all cursor-pointer flex items-center gap-2 ${
              viewStatus === "AKTIF"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> AKUN AKTIF
          </button>
          <button
            onClick={() => setViewStatus("ARSIP")}
            className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all cursor-pointer flex items-center gap-2 ${
              viewStatus === "ARSIP"
                ? "border-(--text-primary) text-(--text-primary)"
                : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            <Archive className="w-4 h-4" /> AKUN DIKUNCI / ARSIP
          </button>
        </div>
      </div>

      {/* Konten Table */}
      <div className="flex-1 overflow-auto p-6 bg-transparent custom-scrollbar">
        <div className="bg-(--bg-card) rounded-xl shadow-sm border border-(--border-color) overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black tracking-widest text-(--text-secondary)">
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Pemilik Akun (Karyawan)</th>
                <th className="px-6 py-4">Role Guard</th>
                <th className="px-6 py-4">Jabatan Terhubung</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border-color)">
              {userAccounts
                .filter((u) =>
                  viewStatus === "AKTIF"
                    ? u.status === "Aktif"
                    : u.status === "Arsip",
                )
                .map((user) => {
                  const emp = employees.find((e) => e.id === user.employeeId);
                  const pos = positions.find((p) => p.id === user.positionId);

                  let roleBadgeColor =
                    "bg-slate-500/10 text-slate-400 border-slate-500/20";
                  if (user.role === "SUPER_ADMIN")
                    roleBadgeColor =
                      "bg-rose-500/10 text-rose-500 border-rose-500/20";
                  if (user.role === "OUTLET_MANAGER")
                    roleBadgeColor =
                      "bg-amber-500/10 text-amber-500 border-amber-500/20";
                  if (user.role === "CASHIER")
                    roleBadgeColor =
                      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-(--surface-hover) transition"
                    >
                      <td className="px-6 py-4 font-mono font-bold text-orange-500">
                        {user.username}
                      </td>
                      <td className="px-6 py-4 font-bold text-(--text-primary)">
                        {emp?.fullName || user.employeeId}
                        <div className="text-[10px] font-mono text-(--text-secondary)">
                          {emp?.employeeNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider border ${roleBadgeColor}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-(--text-secondary)">
                        {pos?.name || "-"}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {viewStatus === "AKTIF" ? (
                          <>
                            <button
                              onClick={() =>
                                openSideOver({
                                  title: "EDIT AKUN",
                                  width: "w-[500px]",
                                  content: (
                                    <UserAccountForm
                                      isEditMode={true}
                                      initialData={user}
                                      onClose={closeSideOver}
                                    />
                                  ),
                                })
                              }
                              className="p-1.5 text-(--text-secondary) hover:text-blue-500 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleArchive(user.id)}
                              className="p-1.5 text-(--text-secondary) hover:text-rose-500 rounded"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleRestore(user.id)}
                            className="px-3 py-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 rounded"
                          >
                            RESTORE
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {userAccounts.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-(--text-secondary) font-bold"
                  >
                    BELUM ADA AKUN PENGGUNA.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
