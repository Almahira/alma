// File: modules/mdl_organization/src/client/EmployeePage.tsx
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
} from "lucide-react";
import { useOrgStore } from "./store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayout";
import { globalBlobManager } from "../../../../packages/core_unv/src/io/BlobManager";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";

// =========================================================================
// 1. MODAL: PREVIEW DOKUMEN FISIK KARYAWAN
// =========================================================================
const EmployeeDocPreviewModal: React.FC<{
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
    <div className="p-4 flex flex-col items-center justify-center min-h-[50vh]">
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
        <div className="text-rose-500 text-xs font-bold">
          Dokumen masih dalam antrean sinkronisasi offline.
        </div>
      )}
      <div className="mt-4 flex justify-end w-full">
        <button
          onClick={onClose}
          className="px-5 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer"
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
const EmployeeDocumentForm: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const { employees, documentTypes } = useOrgStore();
  const [employeeId, setEmployeeId] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState(
    documentTypes[0]?.id || "",
  );
  const [documentNumber, setDocumentNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !file) {
      return sysToast.error(
        "Error",
        "Pilih karyawan dan lampirkan berkas dokumen!",
      );
    }

    try {
      await globalCommandBus.execute({
        type: "ATTACH_EMPLOYEE_DOCUMENT",
        payload: {
          employeeId,
          documentTypeId: documentTypeId || "DOC_TYPE_KTP",
          documentNumber: documentNumber.toUpperCase().trim() || "-",
          issueDate: issueDate || null,
          expiryDate: expiryDate || null,
          fileName: file.name,
          fileObj: file,
          notes: notes.trim() ? notes.toUpperCase().trim() : null,
        },
      });

      sysToast.success(
        "Berhasil",
        "Dokumen legalitas karyawan berhasil diunggah.",
      );
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 flex flex-col h-full p-1">
      <div className="flex-1 space-y-4">
        <div>
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            PILIH KARYAWAN
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              JENIS DOKUMEN
            </label>
            <select
              value={documentTypeId}
              onChange={(e) => setDocumentTypeId(e.target.value)}
              className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
            >
              <option value="DOC_KTP">KTP (KARTU TANDA PENDUDUK)</option>
              <option value="DOC_NPWP">NPWP</option>
              <option value="DOC_BPJS">BPJS KETENAGAKERJAAN / KESEHATAN</option>
              <option value="DOC_SIM">SIM (SURAT IZIN MENGEMUDI)</option>
              <option value="DOC_IJAZAH">IJAZAH TERAKHIR</option>
              <option value="DOC_KONTRAK">KONTRAK KERJA / SPK</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              NOMOR DOKUMEN / NIK
            </label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value.toUpperCase())}
              placeholder="3204xxxxxxxxxxxx"
              className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              TANGGAL DITERBITKAN
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full text-xs font-bold text-(--text-primary) p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              MASA BERLAKU S/D
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full text-xs font-bold text-(--text-primary) p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            LAMPIRAN BERKAS (FOTO / PDF)
          </label>
          <div className="border-2 border-dashed border-(--border-color) rounded-lg p-5 text-center hover:bg-(--surface-hover) transition cursor-pointer relative">
            <UploadCloud className="w-6 h-6 text-(--text-secondary) mx-auto mb-1" />
            <span className="text-xs font-bold text-(--text-primary) block truncate">
              {file ? file.name : "Klik untuk memilih file KTP/NPWP/PDF..."}
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
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            CATATAN (OPSIONAL)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value.toUpperCase())}
            placeholder="Asli diperiksa HRD..."
            className="w-full text-xs font-bold text-(--text-primary) p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none"
          />
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-(--border-color)">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-(--text-secondary)"
        >
          BATAL
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600 shadow-md cursor-pointer"
        >
          UNGGAH DOKUMEN
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 3. MODAL FORMS: DIVISI, JABATAN, KARYAWAN & PENUGASAN
// =========================================================================
const DivisionForm: React.FC<{
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, initialData, onClose }) => {
  const { openAlert } = useUniversalModal();
  const { companies } = useOrgStore();
  const [formData, setFormData] = useState<any>(initialData || {});

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await globalCommandBus.execute({
        type: isEditMode ? "UPDATE_DIVISION" : "CREATE_DIVISION",
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
            PERUSAHAAN
          </label>
          <select
            name="companyId"
            value={formData.companyId || ""}
            onChange={(e) =>
              setFormData({ ...formData, companyId: e.target.value })
            }
            required
            disabled={isEditMode}
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
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
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            NAMA DIVISI
          </label>
          <input
            type="text"
            required
            value={formData.name || ""}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value.toUpperCase() })
            }
            placeholder="OPERASIONAL / KEUANGAN / DAPUR..."
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
          />
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
          SIMPAN
        </button>
      </div>
    </form>
  );
};

const PositionForm: React.FC<{
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, initialData, onClose }) => {
  const { openAlert } = useUniversalModal();
  const { companies, divisions } = useOrgStore();
  const [formData, setFormData] = useState<any>(initialData || {});

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await globalCommandBus.execute({
        type: isEditMode ? "UPDATE_POSITION" : "CREATE_POSITION",
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
            PERUSAHAAN
          </label>
          <select
            name="companyId"
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
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
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
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            DIVISI
          </label>
          <select
            name="divisionId"
            value={formData.divisionId || ""}
            onChange={(e) =>
              setFormData({ ...formData, divisionId: e.target.value })
            }
            required
            disabled={isEditMode}
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
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
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            NAMA JABATAN / POSISI
          </label>
          <input
            type="text"
            required
            value={formData.name || ""}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value.toUpperCase() })
            }
            placeholder="HEAD CHEF / KASIR UTAMA / BARISTA..."
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            LINK / DOKUMEN SOP (OPSIONAL)
          </label>
          <input
            type="text"
            value={formData.sopFileUrl || ""}
            onChange={(e) =>
              setFormData({ ...formData, sopFileUrl: e.target.value })
            }
            placeholder="https://drive.google.com/... atau SOP-01"
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
          />
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
          SIMPAN
        </button>
      </div>
    </form>
  );
};

const EmployeeForm: React.FC<{
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, initialData, onClose }) => {
  const { openAlert } = useUniversalModal();
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
            NAMA LENGKAP KARYAWAN
          </label>
          <input
            type="text"
            required
            value={formData.fullName || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                fullName: e.target.value.toUpperCase(),
              })
            }
            placeholder="NAMA LENGKAP..."
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              NOMOR KARYAWAN / NIK
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
              placeholder="EMP-001 (Auto jika kosong)"
              className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              JENIS KELAMIN
            </label>
            <select
              value={formData.gender || "LAKI-LAKI"}
              onChange={(e) =>
                setFormData({ ...formData, gender: e.target.value })
              }
              className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
            >
              <option value="LAKI-LAKI">LAKI-LAKI</option>
              <option value="PEREMPUAN">PEREMPUAN</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              NO TELEPON / WA
            </label>
            <input
              type="text"
              value={formData.phone || ""}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="08123456789"
              className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              STATUS KEPEGAWAIAN
            </label>
            <select
              value={formData.employmentStatus || "PERMANENT"}
              onChange={(e) =>
                setFormData({ ...formData, employmentStatus: e.target.value })
              }
              className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
            >
              <option value="PERMANENT">TETAP (PERMANENT)</option>
              <option value="CONTRACT">KONTRAK (CONTRACT)</option>
              <option value="PROBATION">PROBATION</option>
              <option value="INTERN">MAGANG (INTERN)</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            EMAIL
          </label>
          <input
            type="email"
            value={formData.email || ""}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="karyawan@perusahaan.com"
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
          />
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
          SIMPAN
        </button>
      </div>
    </form>
  );
};

const AssignmentForm: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const { openAlert } = useUniversalModal();
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
            PILIH KARYAWAN
          </label>
          <select
            value={formData.employeeId || ""}
            onChange={(e) =>
              setFormData({ ...formData, employeeId: e.target.value })
            }
            required
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              PERUSAHAAN
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
              className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
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
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              REGIONAL
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
              className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
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
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            OUTLET / CABANG PENUGASAN
          </label>
          <select
            value={formData.outletId || ""}
            onChange={(e) =>
              setFormData({ ...formData, outletId: e.target.value })
            }
            required
            disabled={!formData.regionId}
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              DIVISI
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
              className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
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
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              JABATAN / POSISI
            </label>
            <select
              value={formData.positionId || ""}
              onChange={(e) =>
                setFormData({ ...formData, positionId: e.target.value })
              }
              required
              disabled={!formData.divisionId}
              className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
            >
              <option value="">PILIH JABATAN</option>
              {positions
                .filter(
                  (p) =>
                    p.divisionId === formData.divisionId &&
                    p.status === "Aktif",
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              TANGGAL MULAI
            </label>
            <input
              type="date"
              required
              value={formData.startDate || ""}
              onChange={(e) =>
                setFormData({ ...formData, startDate: e.target.value })
              }
              className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 text-xs font-bold text-(--text-primary) cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPrimary}
                onChange={(e) =>
                  setFormData({ ...formData, isPrimary: e.target.checked })
                }
                className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500"
              />
              Jadikan Outlet Utama (Primary)
            </label>
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
          TUGASKAN KARYAWAN
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 4. HALAMAN UTAMA MASTER KARYAWAN (DILENGKAPI TAB DOKUMEN LEGALITAS)
// =========================================================================
export const EmployeePage: React.FC = () => {
  const {
    openSideOver,
    closeSideOver,
    openCenterModal,
    closeCenterModal,
    openAlert,
  } = useUniversalModal();
  const {
    companies,
    divisions,
    positions,
    employees,
    employmentAssignments,
    employeeDocuments,
    outlets,
  } = useOrgStore();

  const [activeTab, setActiveTab] = useState<
    "DIV_POS" | "EMPLOYEES" | "ASSIGNMENTS" | "DOCUMENTS"
  >("DIV_POS");
  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");

  const handleArchive = (id: string, type: string) => {
    openAlert({
      title: "Konfirmasi Arsip",
      message: `Arsipkan data ${type} ini?`,
      confirmText: "YA, ARSIPKAN",
      onConfirm: async () => {
        await globalCommandBus.execute({
          type: "ARCHIVE_DATA",
          payload: { id, type },
        });
      },
    });
  };

  const handleRestore = (id: string, type: string) => {
    openAlert({
      title: "Konfirmasi Restore",
      message: `Pulihkan data ${type} ini?`,
      confirmText: "YA, RESTORE",
      onConfirm: async () => {
        await globalCommandBus.execute({
          type: "RESTORE_DATA",
          payload: { id, type },
        });
      },
    });
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {/* Header Utama */}
      <div className="h-18 px-6 flex items-center justify-between bg-(--bg-card) border-b border-(--border-color) shrink-0">
        <div>
          <h2 className="text-2xl font-black text-(--text-primary) tracking-tight flex items-center gap-3">
            <Users className="w-6 h-6 text-orange-500" /> Master Karyawan &amp;
            SDM
          </h2>
          <p className="text-xs text-(--text-secondary) font-semibold mt-0.5">
            Manajemen Divisi, Jabatan, Profil Karyawan, Penugasan, dan Dokumen
            Legal
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "DIV_POS" && (
            <>
              <button
                onClick={() => {
                  openSideOver({
                    title: "TAMBAH DIVISI",
                    width: "w-[450px]",
                    content: (
                      <DivisionForm
                        isEditMode={false}
                        initialData={{}}
                        onClose={closeSideOver}
                      />
                    ),
                  });
                }}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-black text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> + DIVISI
              </button>
              <button
                onClick={() => {
                  openSideOver({
                    title: "TAMBAH JABATAN",
                    width: "w-[450px]",
                    content: (
                      <PositionForm
                        isEditMode={false}
                        initialData={{}}
                        onClose={closeSideOver}
                      />
                    ),
                  });
                }}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" /> + JABATAN
              </button>
            </>
          )}
          {activeTab === "EMPLOYEES" && (
            <button
              onClick={() => {
                openSideOver({
                  title: "TAMBAH KARYAWAN BARU",
                  width: "w-[500px]",
                  content: (
                    <EmployeeForm
                      isEditMode={false}
                      initialData={{}}
                      onClose={closeSideOver}
                    />
                  ),
                });
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" /> + KARYAWAN BARU
            </button>
          )}
          {activeTab === "ASSIGNMENTS" && (
            <button
              onClick={() => {
                openSideOver({
                  title: "BUAT PENUGASAN CABANG",
                  width: "w-[500px]",
                  content: <AssignmentForm onClose={closeSideOver} />,
                });
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition shadow-md cursor-pointer"
            >
              <UserCheck className="w-4 h-4" /> + TUGASKAN KE CABANG
            </button>
          )}
          {activeTab === "DOCUMENTS" && (
            <button
              onClick={() => {
                openSideOver({
                  title: "UNGGAH DOKUMEN LEGAL KARYAWAN",
                  width: "w-[500px]",
                  content: <EmployeeDocumentForm onClose={closeSideOver} />,
                });
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-md cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" /> + UNGGAH DOKUMEN
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigasi */}
      <div className="px-6 bg-(--bg-card) border-b border-(--border-color) flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab("DIV_POS")}
            className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "DIV_POS"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            <Network className="w-4 h-4" /> DIVISI &amp; POSISI
          </button>
          <button
            onClick={() => setActiveTab("EMPLOYEES")}
            className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "EMPLOYEES"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            <Users className="w-4 h-4" /> DATA KARYAWAN
          </button>
          <button
            onClick={() => setActiveTab("ASSIGNMENTS")}
            className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "ASSIGNMENTS"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            <Briefcase className="w-4 h-4" /> PENUGASAN
          </button>
          <button
            onClick={() => setActiveTab("DOCUMENTS")}
            className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "DOCUMENTS"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            <FileText className="w-4 h-4" /> DOKUMEN LEGALITAS (
            {employeeDocuments.length})
          </button>
        </div>

        {/* Filter Aktif / Arsip */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewStatus("AKTIF")}
            className={`px-3 py-1 text-[11px] font-bold rounded-lg transition ${
              viewStatus === "AKTIF"
                ? "bg-orange-500/10 text-orange-500 font-black"
                : "text-(--text-secondary)"
            }`}
          >
            AKTIF
          </button>
          <button
            onClick={() => setViewStatus("ARSIP")}
            className={`px-3 py-1 text-[11px] font-bold rounded-lg transition ${
              viewStatus === "ARSIP"
                ? "bg-slate-800 text-white font-black"
                : "text-(--text-secondary)"
            }`}
          >
            ARSIP
          </button>
        </div>
      </div>

      {/* Konten Utama */}
      <div className="flex-1 overflow-auto p-6 bg-transparent custom-scrollbar">
        {/* ========================================================================= */}
        {/* TAB 1: DIVISI DAN POSISI */}
        {/* ========================================================================= */}
        {activeTab === "DIV_POS" && (
          <div className="space-y-6">
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
                    className="bg-(--bg-card) rounded-xl border border-(--border-color) overflow-hidden shadow-xs"
                  >
                    <div className="px-5 py-3.5 bg-(--surface-hover) border-b border-(--border-color) flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-orange-500" />
                        <h3 className="font-black text-sm text-(--text-primary)">
                          {company.name}
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-(--text-secondary)">
                        {companyDivs.length} DIVISI
                      </span>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                            className="bg-(--bg-input) rounded-lg border border-(--border-color) p-4 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-3 border-b border-(--border-color) pb-2">
                                <span className="font-black text-xs text-(--text-primary) flex items-center gap-2">
                                  <Network className="w-3.5 h-3.5 text-blue-400" />{" "}
                                  {div.name}
                                </span>
                                <div className="flex items-center gap-1">
                                  {viewStatus === "AKTIF" ? (
                                    <>
                                      <button
                                        onClick={() =>
                                          openSideOver({
                                            title: "EDIT DIVISI",
                                            width: "w-[450px]",
                                            content: (
                                              <DivisionForm
                                                isEditMode={true}
                                                initialData={div}
                                                onClose={closeSideOver}
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
                                          handleArchive(div.id, "DIVISION")
                                        }
                                        className="p-1 text-(--text-secondary) hover:text-rose-500"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        handleRestore(div.id, "DIVISION")
                                      }
                                      className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"
                                    >
                                      <RotateCcw className="w-3 h-3" /> RESTORE
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                {divPositions.map((pos) => (
                                  <div
                                    key={pos.id}
                                    className="flex items-center justify-between p-2 rounded bg-(--bg-card) border border-(--border-color) text-xs"
                                  >
                                    <span className="font-bold text-(--text-primary)">
                                      {pos.name}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {viewStatus === "AKTIF" ? (
                                        <>
                                          <button
                                            onClick={() =>
                                              openSideOver({
                                                title: "EDIT JABATAN",
                                                width: "w-[450px]",
                                                content: (
                                                  <PositionForm
                                                    isEditMode={true}
                                                    initialData={pos}
                                                    onClose={closeSideOver}
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
                                              handleArchive(pos.id, "POSITION")
                                            }
                                            className="p-1 text-(--text-secondary) hover:text-rose-500"
                                          >
                                            <Archive className="w-3 h-3" />
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          onClick={() =>
                                            handleRestore(pos.id, "POSITION")
                                          }
                                          className="text-[9px] font-bold text-emerald-500"
                                        >
                                          RESTORE
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {divPositions.length === 0 && (
                                  <div className="text-[10px] text-(--text-secondary) italic">
                                    Belum ada jabatan.
                                  </div>
                                )}
                              </div>
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

        {/* ========================================================================= */}
        {/* TAB 2: DATA KARYAWAN */}
        {/* ========================================================================= */}
        {activeTab === "EMPLOYEES" && (
          <div className="bg-(--bg-card) rounded-xl shadow-xs border border-(--border-color) overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black tracking-widest text-(--text-secondary)">
                  <th className="px-6 py-4">No Karyawan</th>
                  <th className="px-6 py-4">Nama Lengkap</th>
                  <th className="px-6 py-4">Gender</th>
                  <th className="px-6 py-4">Kontak (HP/Email)</th>
                  <th className="px-6 py-4">Status Kerja</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-color)">
                {employees
                  .filter((e) =>
                    viewStatus === "AKTIF"
                      ? e.status === "Aktif"
                      : e.status === "Arsip",
                  )
                  .map((emp) => (
                    <tr
                      key={emp.id}
                      className="hover:bg-(--surface-hover) transition"
                    >
                      <td className="px-6 py-4 font-mono font-bold text-orange-500">
                        {emp.employeeNumber}
                      </td>
                      <td className="px-6 py-4 font-bold text-(--text-primary)">
                        {emp.fullName}
                      </td>
                      <td className="px-6 py-4 text-(--text-secondary)">
                        {emp.gender}
                      </td>
                      <td className="px-6 py-4 text-(--text-secondary)">
                        <div>{emp.phone || "-"}</div>
                        <div className="text-[10px] opacity-70">
                          {emp.email || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          {emp.employmentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {viewStatus === "AKTIF" ? (
                          <>
                            <button
                              onClick={() =>
                                openSideOver({
                                  title: "EDIT KARYAWAN",
                                  width: "w-[500px]",
                                  content: (
                                    <EmployeeForm
                                      isEditMode={true}
                                      initialData={emp}
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
                              onClick={() => handleArchive(emp.id, "EMPLOYEE")}
                              className="p-1.5 text-(--text-secondary) hover:text-rose-500 rounded"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleRestore(emp.id, "EMPLOYEE")}
                            className="px-3 py-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 rounded"
                          >
                            RESTORE
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PENUGASAN (ASSIGNMENT) */}
        {/* ========================================================================= */}
        {activeTab === "ASSIGNMENTS" && (
          <div className="bg-(--bg-card) rounded-xl shadow-xs border border-(--border-color) overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black tracking-widest text-(--text-secondary)">
                  <th className="px-6 py-4">Karyawan</th>
                  <th className="px-6 py-4">Penempatan Cabang</th>
                  <th className="px-6 py-4">Divisi &amp; Jabatan</th>
                  <th className="px-6 py-4">Tipe Penugasan</th>
                  <th className="px-6 py-4">Tanggal Mulai</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-color)">
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
                      <tr
                        key={asn.id}
                        className="hover:bg-(--surface-hover) transition"
                      >
                        <td className="px-6 py-4 font-bold text-(--text-primary)">
                          {emp?.fullName || asn.employeeId}
                          <div className="text-[10px] font-mono text-(--text-secondary)">
                            {emp?.employeeNumber}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-(--text-primary)">
                          <div className="flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-emerald-500" />
                            {outlet?.name || "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-(--text-secondary)">
                          <div className="font-bold text-(--text-primary)">
                            {pos?.name || "-"}
                          </div>
                          <div className="text-[10px]">{div?.name || "-"}</div>
                        </td>
                        <td className="px-6 py-4">
                          {asn.isPrimary ? (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black rounded">
                              OUTLET UTAMA
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[9px] font-black rounded">
                              SEKUNDER / BACKUP
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-(--text-secondary)">
                          {asn.startDate}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {viewStatus === "AKTIF" && (
                            <button
                              onClick={() =>
                                handleArchive(
                                  asn.employeeId,
                                  "EMPLOYMENT_ASSIGNMENT",
                                )
                              }
                              className="p-1.5 text-(--text-secondary) hover:text-rose-500 rounded"
                              title="Akhiri Penugasan"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: DOKUMEN LEGALITAS KARYAWAN (KTP, NPWP, BPJS, IJAZAH) */}
        {/* ========================================================================= */}
        {activeTab === "DOCUMENTS" && (
          <div className="bg-(--bg-card) rounded-xl shadow-xs border border-(--border-color) overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black tracking-widest text-(--text-secondary)">
                  <th className="px-6 py-4">Karyawan</th>
                  <th className="px-6 py-4">Jenis Dokumen</th>
                  <th className="px-6 py-4">No. Dokumen / NIK</th>
                  <th className="px-6 py-4">Masa Berlaku</th>
                  <th className="px-6 py-4">Catatan</th>
                  <th className="px-6 py-4 text-right w-28">Berkas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-color)">
                {employeeDocuments.map((doc) => {
                  const emp = employees.find((e) => e.id === doc.employeeId);
                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-(--surface-hover) transition"
                    >
                      <td className="px-6 py-4 font-bold text-(--text-primary)">
                        {emp?.fullName || doc.employeeId}
                        <div className="text-[10px] font-mono text-(--text-secondary)">
                          {emp?.employeeNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[9px] font-black rounded uppercase">
                          {doc.documentTypeId || "DOKUMEN"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-(--text-primary)">
                        {doc.documentNumber}
                      </td>
                      <td className="px-6 py-4 font-mono text-(--text-secondary) text-[11px]">
                        {doc.expiryDate ? doc.expiryDate : "SEUMUR HIDUP"}
                      </td>
                      <td className="px-6 py-4 text-(--text-secondary) text-[11px] italic">
                        {doc.notes || "-"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() =>
                            openCenterModal({
                              title: `BERKAS: ${doc.documentNumber}`,
                              content: (
                                <EmployeeDocPreviewModal
                                  doc={doc}
                                  onClose={closeCenterModal}
                                />
                              ),
                            })
                          }
                          className="px-2.5 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-md text-[10px] font-bold hover:bg-blue-500/20 transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" /> LIHAT
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {employeeDocuments.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-(--text-secondary) font-bold"
                    >
                      BELUM ADA DOKUMEN LEGALITAS KARYAWAN YANG DIUNGGAH.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
