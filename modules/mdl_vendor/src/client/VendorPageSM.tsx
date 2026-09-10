// File: modules/mdl_vendor/src/client/VendorPageSM.tsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  FileText,
  UploadCloud,
  Layers,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Upload,
  FileDown,
  Eye,
  Printer,
  Phone,
  X,
} from "lucide-react";
import { useVendorStore } from "./store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayoutSM";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { globalBlobManager } from "../../../../packages/core_unv/src/io/BlobManager";
import { ExcelEngine } from "../../../../packages/core_unv/src/io/engines/ExcelEngine";
import {
  downloadTemplateVendorExcel,
  exportExcelVendor,
  vendorExcelSchema,
} from "./features/excel-vendor";
import { exportPdfVendor } from "./features/pdf-vendor";

// =========================================================================
// 1. FORM VENDOR MOBILE (FULL-SCREEN / BOTTOM SHEET)
// =========================================================================
const VendorFormSM: React.FC<{
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, initialData, onClose }) => {
  const { companies, regions, outlets } = useOrgStore();
  const localCompanyId =
    localStorage.getItem("__unv_companyId") || companies[0]?.id || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";

  const [formData, setFormData] = useState({
    id: initialData?.id || "",
    companyId: initialData?.companyId || localCompanyId,
    regionId:
      initialData?.regionId !== undefined
        ? initialData.regionId
        : localRegionId,
    outletId:
      initialData?.outletId !== undefined
        ? initialData.outletId
        : localOutletId,
    name: initialData?.name || "",
    contactNumber: initialData?.contactNumber || "",
    bankName: initialData?.bankName || "",
    bankAccount: initialData?.bankAccount || "",
    bankAccountName: initialData?.bankAccountName || "",
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return sysToast.error("Error", "Nama vendor wajib diisi!");
    }
    try {
      await globalCommandBus.execute({
        type: isEditMode ? "UPDATE_VENDOR" : "CREATE_VENDOR",
        payload: formData,
      });
      sysToast.success(
        "Berhasil",
        `Data vendor ${formData.name} berhasil disimpan.`,
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
            <Users className="w-5 h-5 text-orange-500" />
            <h3 className="font-black text-xs uppercase tracking-wide">
              {isEditMode ? "Edit Pemasok Vendor" : "Tambah Pemasok Baru"}
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
            {/* Scope Wilayah */}
            <div className="bg-(--surface-hover) p-3 rounded-xl border border-(--border-color) space-y-2">
              <label className="block text-[10px] font-black text-(--text-secondary) uppercase tracking-wide">
                Cakupan Operasional:
              </label>
              <select
                value={formData.regionId}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    regionId: e.target.value,
                    outletId: "",
                  })
                }
                className="w-full text-xs font-bold p-2 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
              >
                <option value="">-- PUSAT / NASIONAL (COMPANY LEVEL) --</option>
                {regions
                  .filter(
                    (r) =>
                      r.status === "Aktif" &&
                      (!localCompanyId || r.companyId === localCompanyId),
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>

              <select
                value={formData.outletId}
                onChange={(e) =>
                  setFormData({ ...formData, outletId: e.target.value })
                }
                disabled={!formData.regionId}
                className="w-full text-xs font-bold p-2 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none disabled:opacity-40"
              >
                <option value="">-- SEMUA CABANG (REGIONAL LEVEL) --</option>
                {outlets
                  .filter(
                    (o) =>
                      o.regionId === formData.regionId && o.status === "Aktif",
                  )
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                Nama Vendor / Distributor
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    name: e.target.value.toUpperCase(),
                  })
                }
                required
                autoFocus
                placeholder="CONTOH: PT SUMBER SEGAR UTAMA..."
                className="w-full text-xs font-bold p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                Nomor Kontak / WhatsApp Sales
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={formData.contactNumber}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contactNumber: e.target.value.toUpperCase(),
                  })
                }
                placeholder="08123456789"
                className="w-full text-xs font-bold p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none font-mono"
              />
            </div>

            {/* Rekening Pembayaran */}
            <div className="bg-blue-500/5 p-3 rounded-xl border border-blue-500/20 space-y-2.5">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider block">
                Rekening Pembayaran Vendor:
              </span>

              <div>
                <label className="block text-[9px] font-bold text-(--text-secondary) mb-0.5">
                  Nama Bank
                </label>
                <input
                  type="text"
                  placeholder="BCA / MANDIRI / BNI..."
                  value={formData.bankName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankName: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full text-xs font-bold p-2 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-(--text-secondary) mb-0.5">
                  Nomor Rekening
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="1234567890"
                  value={formData.bankAccount}
                  onChange={(e) =>
                    setFormData({ ...formData, bankAccount: e.target.value })
                  }
                  className="w-full text-xs font-mono font-bold p-2 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-(--text-secondary) mb-0.5">
                  Atas Nama Rekening
                </label>
                <input
                  type="text"
                  placeholder="PT SUMBER SEGAR UTAMA"
                  value={formData.bankAccountName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankAccountName: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full text-xs font-bold p-2 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
                />
              </div>
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
              SIMPAN VENDOR
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// 2. MODAL FORM: UPLOAD DOKUMEN VENDOR (MOBILE)
// =========================================================================
const DocumentUploadFormSM: React.FC<{
  vendorId: string;
  onClose: () => void;
}> = ({ vendorId, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file)
      return sysToast.error("Error", "Pilih file dokumen terlebih dahulu!");
    try {
      await globalCommandBus.execute({
        type: "ATTACH_VENDOR_DOCUMENT",
        payload: {
          vendorId,
          documentName: docName.toUpperCase(),
          fileName: file.name,
          fileObj: file,
        },
      });
      sysToast.success("Berhasil", "Dokumen masuk antrean upload.");
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <form onSubmit={handleUpload} className="p-4 space-y-3">
      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Nama Dokumen / Legalitas
        </label>
        <input
          type="text"
          placeholder="NPWP / SERTIFIKAT HALAL / KONTRAK..."
          required
          autoFocus
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          className="w-full text-xs font-bold p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
        />
      </div>

      <div className="border-2 border-dashed border-(--border-color) rounded-xl p-5 text-center hover:bg-(--surface-hover) transition cursor-pointer relative">
        <UploadCloud className="w-6 h-6 text-(--text-secondary) mx-auto mb-1" />
        <span className="text-xs font-bold text-(--text-primary) block truncate">
          {file ? file.name : "Klik untuk memilih file lampiran..."}
        </span>
        <input
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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
// 3. PREVIEW DOKUMEN VENDOR (MOBILE)
// =========================================================================
const VendorDocPreviewSM: React.FC<{ doc: any; onClose: () => void }> = ({
  doc,
  onClose,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setPreviewLoading(true);
    globalBlobManager
      .getFileFromCacheOrDownload(doc.documentId, "VENDOR", true)
      .then((blob) => {
        if (blob && isMounted) setPreviewUrl(URL.createObjectURL(blob));
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setPreviewLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [doc]);

  return (
    <div className="p-3 flex flex-col items-center justify-center min-h-[50vh]">
      {previewLoading ? (
        <div className="text-xs font-bold text-slate-400 animate-pulse">
          Memuat Dokumen...
        </div>
      ) : previewUrl ? (
        doc.fileType?.startsWith("image/") ||
        doc.fileName.match(/\.(jpg|jpeg|png)$/i) ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-[60vh] object-contain rounded-lg border shadow-md"
          />
        ) : (
          <iframe
            src={previewUrl}
            className="w-full h-[60vh] bg-white rounded-lg border"
            title="PDF Preview"
          />
        )
      ) : (
        <div className="text-rose-500 text-xs font-bold text-center">
          Dokumen masih dalam antrean offline.
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
// 4. HALAMAN UTAMA MOBILE: VENDOR PAGE SM
// =========================================================================
export function VendorPageSM() {
  const { vendors, documents } = useVendorStore();
  const { regions, outlets } = useOrgStore();
  const { openCenterModal, closeCenterModal, openAlert } = useUniversalModal();

  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const localCompanyId = localStorage.getItem("__unv_companyId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";
  const [filterOutletId, setFilterOutletId] = useState("");

  const availableOutlets = useMemo(() => {
    return outlets.filter((o) => {
      if (o.status !== "Aktif") return false;
      if (localCompanyId && o.companyId && o.companyId !== localCompanyId)
        return false;
      if (localRegionId && o.regionId && o.regionId !== localRegionId)
        return false;
      return true;
    });
  }, [outlets, localCompanyId, localRegionId]);

  const regionMap = useMemo(() => {
    const map = new Map<string, any>();
    regions.forEach((r: any) => map.set(r.id, r));
    return map;
  }, [regions]);

  const outletMap = useMemo(() => {
    const map = new Map<string, any>();
    outlets.forEach((o: any) => map.set(o.id, o));
    return map;
  }, [outlets]);

  const vendorDocsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    documents.forEach((d: any) => {
      const isDocActive =
        d.isActive !== undefined
          ? d.isActive
          : d.is_active !== undefined
            ? d.is_active
            : d.status === "Aktif";
      if (isDocActive && d.vendorId) {
        if (!map.has(d.vendorId)) map.set(d.vendorId, []);
        map.get(d.vendorId)!.push(d);
      }
    });
    return map;
  }, [documents]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(e.target as Node)
      ) {
        setIsActionMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredVendors = useMemo(() => {
    return vendors.filter((v: any) => {
      const isVendorActive =
        v.status !== undefined
          ? v.status === "Aktif"
          : v.isActive !== undefined
            ? Boolean(v.isActive)
            : Boolean(v.is_active);
      const matchStatus =
        viewStatus === "AKTIF" ? isVendorActive : !isVendorActive;
      if (!matchStatus) return false;

      if (localCompanyId && v.companyId && v.companyId !== localCompanyId) {
        return false;
      }

      if (localOutletId) {
        if (v.outletId && v.outletId !== localOutletId) return false;
        if (v.regionId && localRegionId && v.regionId !== localRegionId)
          return false;
      } else if (localRegionId) {
        if (v.regionId && v.regionId !== localRegionId) return false;
        if (filterOutletId === "REGION_ONLY") {
          if (v.outletId) return false;
        } else if (filterOutletId) {
          if (v.outletId !== filterOutletId) return false;
        }
      }
      return true;
    });
  }, [
    vendors,
    viewStatus,
    localCompanyId,
    localRegionId,
    localOutletId,
    filterOutletId,
  ]);

  const handleAction = async (type: string, id: string) => {
    try {
      await globalCommandBus.execute({ type, payload: { id } });
      sysToast.success("Berhasil", "Data diperbarui.");
    } catch (e: any) {
      sysToast.error("Gagal", e.message);
    }
  };

  const confirmArchive = (id: string, name: string) => {
    openAlert({
      title: "Arsipkan Vendor",
      message: `Anda yakin ingin mengarsipkan vendor "${name}"?`,
      confirmText: "YA, ARSIPKAN",
      onConfirm: () => handleAction("ARCHIVE_VENDOR", id),
    });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsedData = await ExcelEngine.parseFile(file, vendorExcelSchema);
      if (parsedData.length === 0) {
        throw new Error("File Excel kosong atau format tidak sesuai.");
      }
      const companyId = localStorage.getItem("__unv_companyId") || "";
      const regionId = localStorage.getItem("__unv_regionId") || null;
      const outletId = localStorage.getItem("__unv_outletId") || null;
      let count = 0;
      for (const row of parsedData) {
        if (!row.name) continue;
        await globalCommandBus.execute({
          type: "CREATE_VENDOR",
          payload: {
            name: String(row.name).toUpperCase().trim(),
            contactNumber: row.contactNumber
              ? String(row.contactNumber).trim()
              : null,
            bankName: row.bankName
              ? String(row.bankName).toUpperCase().trim()
              : null,
            bankAccount: row.bankAccount
              ? String(row.bankAccount).trim()
              : null,
            bankAccountName: row.bankAccountName
              ? String(row.bankAccountName).toUpperCase().trim()
              : null,
            companyId,
            regionId,
            outletId,
          },
        });
        count++;
      }
      sysToast.success(
        "Import Berhasil",
        `Sukses mengimpor ${count} vendor dari Excel.`,
      );
    } catch (err: any) {
      sysToast.error("Gagal Import", err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsActionMenuOpen(false);
    }
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {isFormModalOpen && (
        <VendorFormSM
          isEditMode={Boolean(editData)}
          initialData={editData}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditData(null);
          }}
        />
      )}

      {/* HEADER MOBILE */}
      <div className="p-3 bg-(--bg-card) border-b border-(--border-color) shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-sm font-black text-(--text-primary) uppercase tracking-wide">
                Database Vendor
              </h2>
              <span className="text-[10px] text-(--text-secondary) font-bold">
                Pemasok &amp; Rekening
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Popover Aksi & Dokumen */}
            {viewStatus === "AKTIF" && (
              <div className="relative" ref={actionMenuRef}>
                <button
                  onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                  className="p-2 rounded-lg border border-(--border-color) flex items-center gap-1 text-(--text-secondary)"
                >
                  <Layers className="w-4 h-4 text-orange-500" />
                </button>

                {isActionMenuOpen && (
                  <div className="absolute right-0 mt-1 w-52 bg-(--bg-card) rounded-xl shadow-2xl border border-(--border-color) py-1.5 z-50 animate-in fade-in">
                    <button
                      onClick={() => {
                        downloadTemplateVendorExcel();
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-(--surface-hover) flex items-center gap-2"
                    >
                      <Download className="w-4 h-4 text-(--text-secondary)" />{" "}
                      Unduh Template
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-(--surface-hover) text-emerald-500 flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Import Excel
                    </button>
                    <div className="h-px bg-(--border-color) my-1" />
                    <button
                      onClick={() => {
                        exportExcelVendor(filteredVendors);
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-(--surface-hover) flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4 text-(--text-secondary)" />{" "}
                      Export Excel
                    </button>
                    <button
                      onClick={() => {
                        exportPdfVendor(filteredVendors);
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-(--surface-hover) text-rose-500 flex items-center gap-2"
                    >
                      <FileDown className="w-4 h-4" /> Export PDF
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportExcel}
                  accept=".xlsx,.xls"
                  className="hidden"
                />
              </div>
            )}

            {viewStatus === "AKTIF" && (
              <button
                onClick={() => {
                  setEditData(null);
                  setIsFormModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm"
              >
                <Plus className="w-4 h-4" /> Vendor
              </button>
            )}
          </div>
        </div>

        {/* SELECTOR OUTLET VENDOR UNTUK REGION */}
        {!localOutletId && (
          <select
            value={filterOutletId}
            onChange={(e) => setFilterOutletId(e.target.value)}
            className="w-full text-xs font-black p-1.5 bg-(--bg-input) text-orange-500 border border-orange-500/30 rounded-lg outline-none"
          >
            <option value="">-- SEMUA VENDOR WILAYAH --</option>
            <option value="REGION_ONLY">[PUSAT &amp; GUDANG REGION]</option>
            {availableOutlets.map((o) => (
              <option key={o.id} value={o.id}>
                VENDOR OUTLET: {o.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* DAFTAR VENDOR (KARTU MOBILE) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {filteredVendors.map((v: any) => {
          const reg = v.regionId ? regionMap.get(v.regionId) : null;
          const out = v.outletId ? outletMap.get(v.outletId) : null;
          const vendorDocs = vendorDocsMap.get(v.id) || [];

          return (
            <div
              key={v.id}
              className="bg-(--bg-card) border border-(--border-color) rounded-xl p-3 shadow-xs space-y-2.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-sm text-(--text-primary)">
                    {v.name}
                  </div>
                  {v.contactNumber ? (
                    <a
                      href={`tel:${v.contactNumber}`}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-orange-500 font-bold mt-0.5"
                    >
                      <Phone className="w-3 h-3" /> {v.contactNumber}
                    </a>
                  ) : (
                    <span className="text-[10px] text-(--text-secondary)">
                      -
                    </span>
                  )}
                </div>

                {/* Scope Badge */}
                {!v.regionId ? (
                  <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    [HOLDING] PUSAT
                  </span>
                ) : out ? (
                  <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-orange-500/10 text-orange-500 border border-orange-500/20">
                    {out.name}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    [REGION] {reg?.name || "-"}
                  </span>
                )}
              </div>

              {/* Rekening Pembayaran Info */}
              <div className="p-2 bg-(--surface-hover) rounded-lg border border-(--border-color) text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-orange-500">
                    {v.bankName || "-"}
                  </span>
                  <span className="font-mono text-(--text-primary) font-bold">
                    {v.bankAccount || "-"}
                  </span>
                </div>
                {v.bankAccountName && (
                  <div className="text-[9px] text-(--text-secondary) mt-0.5 uppercase">
                    A.N: {v.bankAccountName}
                  </div>
                )}
              </div>

              {/* Dokumen Lampiran */}
              {vendorDocs.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {vendorDocs.map((d) => (
                    <button
                      key={d.id}
                      onClick={() =>
                        openCenterModal({
                          title: `DOKUMEN VENDOR: ${d.name}`,
                          content: (
                            <VendorDocPreviewSM
                              doc={d}
                              onClose={closeCenterModal}
                            />
                          ),
                        })
                      }
                      className="text-[9px] bg-(--bg-input) text-(--text-secondary) hover:text-orange-500 px-2 py-0.5 rounded font-bold border border-(--border-color) flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3 text-orange-500" /> {d.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Tombol Aksi */}
              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-(--border-color)">
                {viewStatus === "AKTIF" ? (
                  <>
                    <button
                      onClick={() =>
                        openCenterModal({
                          title: `UNGGAH DOKUMEN: ${v.name}`,
                          content: (
                            <DocumentUploadFormSM
                              vendorId={v.id}
                              onClose={closeCenterModal}
                            />
                          ),
                        })
                      }
                      className="px-2.5 py-1 text-[10px] font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-1"
                    >
                      <UploadCloud className="w-3.5 h-3.5" /> Dokumen
                    </button>
                    <button
                      onClick={() => {
                        setEditData(v);
                        setIsFormModalOpen(true);
                      }}
                      className="p-1.5 text-(--text-secondary) hover:text-orange-500 border border-(--border-color) rounded-lg"
                      title="Edit Vendor"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => confirmArchive(v.id, v.name)}
                      className="p-1.5 text-(--text-secondary) hover:text-rose-500 border border-(--border-color) rounded-lg"
                      title="Arsipkan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleAction("RESTORE_VENDOR", v.id)}
                    className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded-lg flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredVendors.length === 0 && (
          <div className="p-8 text-center text-(--text-secondary) font-bold text-xs italic">
            Belum ada data vendor pemasok untuk unit ini.
          </div>
        )}
      </div>
    </div>
  );
}
