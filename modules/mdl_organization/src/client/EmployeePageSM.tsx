// File: modules/mdl_organization/src/client/EmployeePageSM.tsx
import React, { useState, useEffect } from "react";
import {
  Users,
  Briefcase,
  Network,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  Building2,
  Store,
  FileText,
  UserCheck,
  UploadCloud,
  Eye,
  Trash2,
  Printer,
  ShieldCheck,
  X,
  Phone,
} from "lucide-react";
import { useOrgStore, useHasWriteAccess } from "./store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayoutSM";
import { globalBlobManager } from "../../../../packages/core_unv/src/io/BlobManager";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";

// =========================================================================
// 1. PREVIEW DOKUMEN KARYAWAN
// =========================================================================
const EmployeeDocPreviewModalSM: React.FC<{
  doc: any;
  onClose: () => void;
}> = ({ doc, onClose }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    globalBlobManager
      .getFileFromCacheOrDownload(
        doc.attachmentUrl || doc.id,
        "ORGANIZATION",
        true,
      )
      .then((blob) => {
        if (blob && isMounted) setPreviewUrl(URL.createObjectURL(blob));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [doc]);

  return (
    <div className="p-3 flex flex-col items-center justify-center min-h-[50vh]">
      {loading ? (
        <div className="text-xs font-bold text-slate-400 animate-pulse">
          Mengambil Berkas Dokumen Karyawan...
        </div>
      ) : previewUrl ? (
        doc.attachmentUrl?.match(/\.(jpg|jpeg|png)$/i) ||
        !doc.attachmentUrl?.includes(".") ? (
          <img
            src={previewUrl}
            alt="Dokumen Karyawan"
            className="max-w-full max-h-[60vh] rounded-lg border shadow-md object-contain"
          />
        ) : (
          <iframe
            src={previewUrl}
            className="w-full h-[60vh] bg-white rounded border"
            title="Preview PDF"
          />
        )
      ) : (
        <div className="text-rose-500 text-xs font-bold text-center">
          Dokumen masih dalam antrean sinkronisasi offline.
        </div>
      )}
      <div className="mt-4 flex justify-end w-full">
        <button
          onClick={onClose}
          className="w-full py-2 bg-(--surface-hover) text-xs font-bold rounded-lg"
        >
          TUTUP
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// 2. MODAL FORM: UPLOAD DOKUMEN KARYAWAN
// =========================================================================
const EmployeeDocumentFormSM: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const { employees, documentTypes } = useOrgStore();
  const [employeeId, setEmployeeId] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState(
    documentTypes[0]?.id || "DOC_KTP",
  );
  const [documentNumber, setDocumentNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !file) {
      return sysToast.error("Error", "Pilih karyawan dan lampirkan berkas dokumen!");
    }
    try {
      await globalCommandBus.execute({
        type: "ATTACH_EMPLOYEE_DOCUMENT",
        payload: {
          employeeId,
          documentTypeId: documentTypeId || "DOC_KTP",
          documentNumber: documentNumber.toUpperCase().trim() || "-",
          issueDate: issueDate || null,
          expiryDate: expiryDate || null,
          fileName: file.name,
          fileObj: file,
          notes: notes.trim() ? notes.toUpperCase().trim() : null,
        },
      });
      sysToast.success("Berhasil", "Dokumen legalitas karyawan diunggah.");
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <form onSubmit={handleSave} className="p-4 space-y-3">
      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Pilih Karyawan
        </label>
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          required
          className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
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

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            Jenis Dokumen
          </label>
          <select
            value={documentTypeId}
            onChange={(e) => setDocumentTypeId(e.target.value)}
            className="w-full text-xs font-bold text-(--text-primary) p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none"
          >
            <option value="DOC_KTP">KTP</option>
            <option value="DOC_NPWP">NPWP</option>
            <option value="DOC_BPJS">BPJS</option>
            <option value="DOC_SIM">SIM</option>
            <option value="DOC_IJAZAH">IJAZAH</option>
            <option value="DOC_KONTRAK">KONTRAK KERJA</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            Nomor NIK / Dokumen
          </label>
          <input
            type="text"
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value.toUpperCase())}
            placeholder="3204..."
            className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            Tanggal Terbit
          </label>
          <input
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="w-full text-xs font-bold p-1.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            Berlaku S/D
          </label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full text-xs font-bold p-1.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Lampiran Berkas (Foto / PDF)
        </label>
        <div className="border-2 border-dashed border-(--border-color) rounded-xl p-4 text-center hover:bg-(--surface-hover) transition cursor-pointer relative">
          <UploadCloud className="w-6 h-6 text-(--text-secondary) mx-auto mb-1" />
          <span className="text-xs font-bold text-(--text-primary) block truncate">
            {file ? file.name : "Pilih foto KTP / dokumen..."}
          </span>
          <input
            type="file"
            required
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>

      <div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value.toUpperCase())}
          placeholder="Catatan dokumen (opsional)..."
          className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none placeholder:text-[10px]"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-(--border-color)">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-(--text-secondary) rounded-lg"
        >
          Batal
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-black text-white bg-blue-600 rounded-lg shadow-md"
        >
          Unggah Dokumen
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 3. FORM KARYAWAN MOBILE
// =========================================================================
const EmployeeFormSM: React.FC<{
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, initialData, onClose }) => {
  const [formData, setFormData] = useState<any>({
    employmentStatus: "PERMANENT",
    gender: "LAKI-LAKI",
    ...(initialData || {}),
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await globalCommandBus.execute({
        type: isEditMode ? "UPDATE_EMPLOYEE" : "CREATE_EMPLOYEE",
        payload: {
          ...formData,
          gender: formData.gender || "LAKI-LAKI",
          employmentStatus: formData.employmentStatus || "PERMANENT",
        },
      });
      sysToast.success("Berhasil", `Data karyawan ${formData.fullName} disimpan.`);
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <form onSubmit={handleSave} className="p-4 space-y-3">
      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Nama Lengkap Karyawan
        </label>
        <input
          type="text"
          required
          autoFocus
          value={formData.fullName || ""}
          onChange={(e) =>
            setFormData({ ...formData, fullName: e.target.value.toUpperCase() })
          }
          placeholder="NAMA LENGKAP..."
          className="w-full text-xs font-bold p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            NIK / No Karyawan
          </label>
          <input
            type="text"
            value={formData.employeeNumber || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                employeeNumber: e.target.value.toUpperCase(),
              })
            }
            placeholder="EMP-001 (Auto)"
            className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            Gender
          </label>
          <select
            value={formData.gender || "LAKI-LAKI"}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
            className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
          >
            <option value="LAKI-LAKI">LAKI-LAKI</option>
            <option value="PEREMPUAN">PEREMPUAN</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            No HP / WA
          </label>
          <input
            type="tel"
            inputMode="tel"
            value={formData.phone || ""}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="08123456789"
            className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            Status Kerja
          </label>
          <select
            value={formData.employmentStatus || "PERMANENT"}
            onChange={(e) =>
              setFormData({ ...formData, employmentStatus: e.target.value })
            }
            className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
          >
            <option value="PERMANENT">TETAP</option>
            <option value="CONTRACT">KONTRAK</option>
            <option value="PROBATION">PROBATION</option>
            <option value="INTERN">MAGANG</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Email (Opsional)
        </label>
        <input
          type="email"
          inputMode="email"
          value={formData.email || ""}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="karyawan@company.com"
          className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-(--border-color)">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-(--text-secondary) rounded-lg"
        >
          Batal
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-black text-white bg-orange-500 rounded-lg shadow-md"
        >
          Simpan Karyawan
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 4. FORM PENUGASAN CABANG (ASSIGNMENT)
// =========================================================================
const AssignmentFormSM: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { companies, regions, outlets, divisions, positions, employees } =
    useOrgStore();
  const [formData, setFormData] = useState<any>({
    isPrimary: true,
    startDate: new Date().toISOString().slice(0, 10),
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await globalCommandBus.execute({
        type: "ASSIGN_EMPLOYMENT",
        payload: formData,
      });
      sysToast.success("Berhasil", "Penugasan karyawan disimpan.");
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <form onSubmit={handleSave} className="p-4 space-y-3">
      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Pilih Karyawan
        </label>
        <select
          value={formData.employeeId || ""}
          onChange={(e) =>
            setFormData({ ...formData, employeeId: e.target.value })
          }
          required
          className="w-full text-xs font-bold text-(--text-primary) p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none"
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

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            Perusahaan
          </label>
          <select
            value={formData.companyId || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                companyId: e.target.value,
                regionId: "",
                outletId: "",
                divisionId: "",
                positionId: "",
              })
            }
            required
            className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
          >
            <option value="">PILIH PERUSAHAAN</option>
            {companies
              .filter((c) => c.status === "Aktif")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            Regional
          </label>
          <select
            value={formData.regionId || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                regionId: e.target.value,
                outletId: "",
              })
            }
            required
            disabled={!formData.companyId}
            className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none disabled:opacity-40"
          >
            <option value="">PILIH REGIONAL</option>
            {regions
              .filter(
                (r) =>
                  r.companyId === formData.companyId && r.status === "Aktif",
              )
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Outlet Cabang Penugasan
        </label>
        <select
          value={formData.outletId || ""}
          onChange={(e) =>
            setFormData({ ...formData, outletId: e.target.value })
          }
          required
          disabled={!formData.regionId}
          className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none disabled:opacity-40"
        >
          <option value="">PILIH OUTLET</option>
          {outlets
            .filter(
              (o) => o.regionId === formData.regionId && o.status === "Aktif",
            )
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            Divisi
          </label>
          <select
            value={formData.divisionId || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                divisionId: e.target.value,
                positionId: "",
              })
            }
            required
            disabled={!formData.companyId}
            className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none disabled:opacity-40"
          >
            <option value="">PILIH DIVISI</option>
            {divisions
              .filter(
                (d) =>
                  d.companyId === formData.companyId && d.status === "Aktif",
              )
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            Jabatan
          </label>
          <select
            value={formData.positionId || ""}
            onChange={(e) =>
              setFormData({ ...formData, positionId: e.target.value })
            }
            required
            disabled={!formData.divisionId}
            className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none disabled:opacity-40"
          >
            <option value="">PILIH JABATAN</option>
            {positions
              .filter(
                (p) =>
                  p.divisionId === formData.divisionId && p.status === "Aktif",
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 items-center">
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            Tanggal Mulai
          </label>
          <input
            type="date"
            required
            value={formData.startDate || ""}
            onChange={(e) =>
              setFormData({ ...formData, startDate: e.target.value })
            }
            className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
          />
        </div>
        <div className="pt-4">
          <label className="flex items-center gap-1.5 text-xs font-bold text-(--text-primary) cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.isPrimary}
              onChange={(e) =>
                setFormData({ ...formData, isPrimary: e.target.checked })
              }
              className="w-4 h-4 rounded text-orange-500 accent-orange-500"
            />
            <span>Outlet Utama</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-(--border-color)">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-(--text-secondary) rounded-lg"
        >
          Batal
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-black text-white bg-orange-500 rounded-lg shadow-md"
        >
          Tugaskan Karyawan
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 5. FORM DIVISI & JABATAN
// =========================================================================
const DivisionFormSM: React.FC<{
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, initialData, onClose }) => {
  const { companies } = useOrgStore();
  const [formData, setFormData] = useState<any>(initialData || {});

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await globalCommandBus.execute({
        type: isEditMode ? "UPDATE_DIVISION" : "CREATE_DIVISION",
        payload: formData,
      });
      sysToast.success("Berhasil", "Divisi berhasil disimpan.");
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <form onSubmit={handleSave} className="p-4 space-y-3">
      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Perusahaan
        </label>
        <select
          value={formData.companyId || ""}
          onChange={(e) =>
            setFormData({ ...formData, companyId: e.target.value })
          }
          required
          disabled={isEditMode}
          className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500 disabled:opacity-50"
        >
          <option value="">PILIH PERUSAHAAN</option>
          {companies
            .filter((c) => c.status === "Aktif")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Nama Divisi
        </label>
        <input
          type="text"
          required
          autoFocus
          value={formData.name || ""}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value.toUpperCase() })
          }
          placeholder="DAPUR / BAR / SERVICE..."
          className="w-full text-xs font-bold p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-(--border-color)">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-(--text-secondary) rounded-lg"
        >
          Batal
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-black text-white bg-orange-500 rounded-lg shadow-md"
        >
          Simpan Divisi
        </button>
      </div>
    </form>
  );
};

const PositionFormSM: React.FC<{
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, initialData, onClose }) => {
  const { companies, divisions } = useOrgStore();
  const [formData, setFormData] = useState<any>(initialData || {});

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await globalCommandBus.execute({
        type: isEditMode ? "UPDATE_POSITION" : "CREATE_POSITION",
        payload: formData,
      });
      sysToast.success("Berhasil", "Jabatan berhasil disimpan.");
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <form onSubmit={handleSave} className="p-4 space-y-3">
      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Perusahaan
        </label>
        <select
          value={formData.companyId || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              companyId: e.target.value,
              divisionId: "",
            })
          }
          required
          disabled={isEditMode}
          className="w-full text-xs font-bold text-(--text-primary) p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none disabled:opacity-50"
        >
          <option value="">PILIH PERUSAHAAN</option>
          {companies
            .filter((c) => c.status === "Aktif")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Divisi
        </label>
        <select
          value={formData.divisionId || ""}
          onChange={(e) =>
            setFormData({ ...formData, divisionId: e.target.value })
          }
          required
          disabled={isEditMode}
          className="w-full text-xs font-bold text-(--text-primary) p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none disabled:opacity-50"
        >
          <option value="">PILIH DIVISI</option>
          {divisions
            .filter(
              (d) =>
                d.companyId === formData.companyId && d.status === "Aktif",
            )
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Nama Jabatan
        </label>
        <input
          type="text"
          required
          autoFocus
          value={formData.name || ""}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value.toUpperCase() })
          }
          placeholder="HEAD CHEF / KASIR..."
          className="w-full text-xs font-bold p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-(--border-color)">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-(--text-secondary) rounded-lg"
        >
          Batal
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-black text-white bg-orange-500 rounded-lg shadow-md"
        >
          Simpan Jabatan
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 6. HALAMAN UTAMA MOBILE: EMPLOYEE PAGE SM
// =========================================================================
export function EmployeePageSM() {
  const {
    companies,
    divisions,
    positions,
    employees,
    employmentAssignments,
    employeeDocuments,
    outlets,
  } = useOrgStore();
  const hasWriteAccess = useHasWriteAccess();
  const { openCenterModal, closeCenterModal, openAlert } = useUniversalModal();

  const [activeTab, setActiveTab] = useState<
    "EMPLOYEES" | "ASSIGNMENTS" | "DOCUMENTS" | "DIV_POS"
  >("EMPLOYEES");
  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");

  const handleArchive = (id: string, type: string, name: string) => {
    openAlert({
      title: "Konfirmasi Arsip",
      message: `Arsipkan data ${name}?`,
      confirmText: "YA, ARSIPKAN",
      onConfirm: async () => {
        try {
          await globalCommandBus.execute({
            type: "ARCHIVE_DATA",
            payload: { id, type },
          });
          sysToast.success("Berhasil", "Data diarsipkan.");
        } catch (err: any) {
          sysToast.error("Gagal", err.message);
        }
      },
    });
  };

  const handleRestore = async (id: string, type: string) => {
    try {
      await globalCommandBus.execute({
        type: "RESTORE_DATA",
        payload: { id, type },
      });
      sysToast.success("Berhasil", "Data dipulihkan.");
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {/* HEADER MOBILE */}
      <div className="p-3 bg-(--bg-card) border-b border-(--border-color) shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-sm font-black text-(--text-primary) uppercase tracking-wide">
                Master Karyawan &amp; SDM
              </h2>
              <span className="text-[10px] text-(--text-secondary) font-bold">
                Profil &amp; Penugasan
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {hasWriteAccess && activeTab === "EMPLOYEES" && (
              <button
                onClick={() =>
                  openCenterModal({
                    title: "TAMBAH KARYAWAN BARU",
                    content: (
                      <EmployeeFormSM
                        isEditMode={false}
                        initialData={{}}
                        onClose={closeCenterModal}
                      />
                    ),
                  })
                }
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm"
              >
                <Plus className="w-4 h-4" /> Karyawan
              </button>
            )}

            {hasWriteAccess && activeTab === "ASSIGNMENTS" && (
              <button
                onClick={() =>
                  openCenterModal({
                    title: "PENUGASAN CABANG",
                    content: <AssignmentFormSM onClose={closeCenterModal} />,
                  })
                }
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm"
              >
                <UserCheck className="w-4 h-4" /> Tugaskan
              </button>
            )}

            {hasWriteAccess && activeTab === "DOCUMENTS" && (
              <button
                onClick={() =>
                  openCenterModal({
                    title: "UNGGAH DOKUMEN LEGALITAS",
                    content: <EmployeeDocumentFormSM onClose={closeCenterModal} />,
                  })
                }
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                <UploadCloud className="w-4 h-4" /> Dokumen
              </button>
            )}

            {hasWriteAccess && activeTab === "DIV_POS" && (
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    openCenterModal({
                      title: "TAMBAH DIVISI",
                      content: (
                        <DivisionFormSM
                          isEditMode={false}
                          initialData={{}}
                          onClose={closeCenterModal}
                        />
                      ),
                    })
                  }
                  className="px-2.5 py-1 text-[10px] font-black text-white bg-slate-800 rounded-lg"
                >
                  + Divisi
                </button>
                <button
                  onClick={() =>
                    openCenterModal({
                      title: "TAMBAH JABATAN",
                      content: (
                        <PositionFormSM
                          isEditMode={false}
                          initialData={{}}
                          onClose={closeCenterModal}
                        />
                      ),
                    })
                  }
                  className="px-2.5 py-1 text-[10px] font-black text-white bg-orange-500 rounded-lg"
                >
                  + Jabatan
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TABS SCROLL HORIZONTAL */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <button
            onClick={() => setActiveTab("EMPLOYEES")}
            className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition ${
              activeTab === "EMPLOYEES"
                ? "bg-orange-500 text-white shadow-xs"
                : "text-(--text-secondary) bg-(--bg-input)"
            }`}
          >
            DATA KARYAWAN ({employees.filter((e) => e.status === "Aktif").length})
          </button>
          <button
            onClick={() => setActiveTab("ASSIGNMENTS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition ${
              activeTab === "ASSIGNMENTS"
                ? "bg-orange-500 text-white shadow-xs"
                : "text-(--text-secondary) bg-(--bg-input)"
            }`}
          >
            PENUGASAN ({employmentAssignments.filter((a) => a.status === "Aktif").length})
          </button>
          <button
            onClick={() => setActiveTab("DOCUMENTS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition ${
              activeTab === "DOCUMENTS"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-(--text-secondary) bg-(--bg-input)"
            }`}
          >
            DOKUMEN ({employeeDocuments.length})
          </button>
          <button
            onClick={() => setActiveTab("DIV_POS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition ${
              activeTab === "DIV_POS"
                ? "bg-orange-500 text-white shadow-xs"
                : "text-(--text-secondary) bg-(--bg-input)"
            }`}
          >
            DIVISI &amp; POSISI
          </button>
        </div>

        {/* TOGGLE STATUS AKTIF / ARSIP */}
        {activeTab !== "DOCUMENTS" && (
          <div className="flex bg-(--bg-input) rounded-lg border border-(--border-color) p-0.5">
            <button
              onClick={() => setViewStatus("AKTIF")}
              className={`flex-1 py-0.5 text-[10px] font-black rounded text-center ${
                viewStatus === "AKTIF"
                  ? "bg-orange-500 text-white"
                  : "text-(--text-secondary)"
              }`}
            >
              AKTIF
            </button>
            <button
              onClick={() => setViewStatus("ARSIP")}
              className={`flex-1 py-0.5 text-[10px] font-black rounded text-center ${
                viewStatus === "ARSIP"
                  ? "bg-slate-700 text-white"
                  : "text-(--text-secondary)"
              }`}
            >
              ARSIP
            </button>
          </div>
        )}
      </div>

      {/* BODY KONTEN TAB */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {/* ========================================================= */}
        {/* TAB 1: EMPLOYEES                                          */}
        {/* ========================================================= */}
        {activeTab === "EMPLOYEES" && (
          <>
            {employees
              .filter((e) =>
                viewStatus === "AKTIF"
                  ? e.status === "Aktif"
                  : e.status === "Arsip",
              )
              .map((emp) => (
                <div
                  key={emp.id}
                  className="bg-(--bg-card) border border-(--border-color) rounded-xl p-3 shadow-xs space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-sm text-(--text-primary)">
                        {emp.fullName}
                      </div>
                      <div className="text-[10px] font-mono text-orange-500 font-bold mt-0.5">
                        NIK: {emp.employeeNumber || "-"}
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[8px] font-black tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase">
                      {emp.employmentStatus}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-(--border-color) text-xs">
                    <div>
                      {emp.phone ? (
                        <a
                          href={`tel:${emp.phone}`}
                          className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-500 font-bold"
                        >
                          <Phone className="w-3 h-3" /> {emp.phone}
                        </a>
                      ) : (
                        <span className="text-[10px] text-(--text-secondary)">{emp.gender}</span>
                      )}
                    </div>

                    {hasWriteAccess && (
                      <div className="flex items-center gap-1.5">
                        {viewStatus === "AKTIF" ? (
                          <>
                            <button
                              onClick={() =>
                                openCenterModal({
                                  title: "EDIT KARYAWAN",
                                  content: (
                                    <EmployeeFormSM
                                      isEditMode={true}
                                      initialData={emp}
                                      onClose={closeCenterModal}
                                    />
                                  ),
                                })
                              }
                              className="p-1.5 text-(--text-secondary) hover:text-orange-500 border border-(--border-color) rounded-lg"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                handleArchive(emp.id, "EMPLOYEE", emp.fullName)
                              }
                              className="p-1.5 text-(--text-secondary) hover:text-rose-500 border border-(--border-color) rounded-lg"
                              title="Arsipkan"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleRestore(emp.id, "EMPLOYEE")}
                            className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded-lg flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Restore
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </>
        )}

        {/* ========================================================= */}
        {/* TAB 2: ASSIGNMENTS (PENUGASAN CABANG)                     */}
        {/* ========================================================= */}
        {activeTab === "ASSIGNMENTS" && (
          <>
            {employmentAssignments
              .filter((a) =>
                viewStatus === "AKTIF"
                  ? a.status === "Aktif"
                  : a.status === "Arsip",
              )
              .map((asn) => {
                const emp = employees.find((e) => e.id === asn.employeeId);
                const outlet = outlets.find((o) => o.id === asn.outletId);
                const div = divisions.find((d) => d.id === asn.divisionId);
                const pos = positions.find((p) => p.id === asn.positionId);

                return (
                  <div
                    key={asn.id}
                    className="bg-(--bg-card) border border-(--border-color) rounded-xl p-3 shadow-xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-xs text-(--text-primary)">
                          {emp?.fullName || asn.employeeId}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                          <Store className="w-3 h-3" />
                          <span>{outlet?.name || "-"}</span>
                        </div>
                      </div>

                      <span
                        className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase border ${
                          asn.isPrimary
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        }`}
                      >
                        {asn.isPrimary ? "UTAMA" : "BACKUP"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-(--border-color) text-xs">
                      <div>
                        <span className="font-bold text-(--text-primary) block text-[11px]">
                          {pos?.name || "-"}
                        </span>
                        <span className="text-[9px] text-(--text-secondary)">
                          Div: {div?.name || "-"} • Sejak {asn.startDate}
                        </span>
                      </div>

                      {hasWriteAccess && viewStatus === "AKTIF" && (
                        <button
                          onClick={() =>
                            handleArchive(
                              asn.employeeId,
                              "EMPLOYMENT_ASSIGNMENT",
                              emp?.fullName || "Penugasan",
                            )
                          }
                          className="p-1.5 text-(--text-secondary) hover:text-rose-500 border border-(--border-color) rounded-lg"
                          title="Akhiri Penugasan"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </>
        )}

        {/* ========================================================= */}
        {/* TAB 3: DOCUMENTS (LEGALITAS KARYAWAN)                     */}
        {/* ========================================================= */}
        {activeTab === "DOCUMENTS" && (
          <>
            {employeeDocuments.map((doc) => {
              const emp = employees.find((e) => e.id === doc.employeeId);
              return (
                <div
                  key={doc.id}
                  className="bg-(--bg-card) border border-(--border-color) rounded-xl p-3 shadow-xs space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-xs text-(--text-primary)">
                        {emp?.fullName || doc.employeeId}
                      </div>
                      <div className="text-[10px] font-mono font-bold text-orange-500 mt-0.5">
                        {doc.documentNumber}
                      </div>
                    </div>

                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[8px] font-black rounded uppercase">
                      {doc.documentTypeId || "DOKUMEN"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-(--border-color) text-xs">
                    <span className="text-[9px] text-(--text-secondary) font-mono">
                      Masa: {doc.expiryDate ? doc.expiryDate : "SEUMUR HIDUP"}
                    </span>

                    <button
                      onClick={() =>
                        openCenterModal({
                          title: `BERKAS: ${doc.documentNumber}`,
                          content: (
                            <EmployeeDocPreviewModalSM
                              doc={doc}
                              onClose={closeCenterModal}
                            />
                          ),
                        })
                      }
                      className="px-2.5 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-md text-[10px] font-bold flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Lihat Berkas
                    </button>
                  </div>
                </div>
              );
            })}

            {employeeDocuments.length === 0 && (
              <div className="p-8 text-center text-(--text-secondary) font-bold text-xs italic">
                Belum ada dokumen legalitas karyawan yang diunggah.
              </div>
            )}
          </>
        )}

        {/* ========================================================= */}
        {/* TAB 4: DIV_POS (DIVISI & JABATAN)                          */}
        {/* ========================================================= */}
        {activeTab === "DIV_POS" && (
          <div className="space-y-3">
            {companies
              .filter((c) => c.status === "Aktif")
              .map((company) => {
                const companyDivs = divisions.filter(
                  (d) =>
                    d.companyId === company.id &&
                    (viewStatus === "AKTIF"
                      ? d.status === "Aktif"
                      : d.status === "Arsip"),
                );

                return (
                  <div
                    key={company.id}
                    className="bg-(--bg-card) rounded-xl border border-(--border-color) overflow-hidden shadow-xs space-y-2 p-3"
                  >
                    <div className="flex items-center justify-between border-b border-(--border-color) pb-2">
                      <span className="font-black text-xs text-(--text-primary) uppercase flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-orange-500" /> {company.name}
                      </span>
                      <span className="text-[9px] font-mono text-(--text-secondary)">
                        {companyDivs.length} Divisi
                      </span>
                    </div>

                    <div className="space-y-2">
                      {companyDivs.map((div) => {
                        const divPositions = positions.filter(
                          (p) =>
                            p.divisionId === div.id &&
                            (viewStatus === "AKTIF"
                              ? p.status === "Aktif"
                              : p.status === "Arsip"),
                        );

                        return (
                          <div
                            key={div.id}
                            className="bg-(--bg-input) rounded-xl p-2.5 border border-(--border-color) space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-(--text-primary)">
                                {div.name}
                              </span>
                              {hasWriteAccess && viewStatus === "AKTIF" && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() =>
                                      openCenterModal({
                                        title: "EDIT DIVISI",
                                        content: (
                                          <DivisionFormSM
                                            isEditMode={true}
                                            initialData={div}
                                            onClose={closeCenterModal}
                                          />
                                        ),
                                      })
                                    }
                                    className="p-1 text-(--text-secondary) hover:text-blue-500"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleArchive(div.id, "DIVISION", div.name)
                                    }
                                    className="p-1 text-(--text-secondary) hover:text-rose-500"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Daftar Jabatan */}
                            <div className="space-y-1 pl-2 border-l-2 border-orange-500/30">
                              {divPositions.map((pos) => (
                                <div
                                  key={pos.id}
                                  className="flex items-center justify-between p-1.5 rounded bg-(--bg-card) border border-(--border-color) text-xs"
                                >
                                  <span className="font-bold text-[11px] text-(--text-primary)">
                                    {pos.name}
                                  </span>
                                  {hasWriteAccess && viewStatus === "AKTIF" && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() =>
                                          openCenterModal({
                                            title: "EDIT JABATAN",
                                            content: (
                                              <PositionFormSM
                                                isEditMode={true}
                                                initialData={pos}
                                                onClose={closeCenterModal}
                                              />
                                            ),
                                          })
                                        }
                                        className="p-1 text-(--text-secondary) hover:text-blue-500"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleArchive(
                                            pos.id,
                                            "POSITION",
                                            pos.name,
                                          )
                                        }
                                        className="p-1 text-(--text-secondary) hover:text-rose-500"
                                      >
                                        <Archive className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {divPositions.length === 0 && (
                                <div className="text-[10px] text-(--text-secondary) italic">
                                  Belum ada jabatan.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
