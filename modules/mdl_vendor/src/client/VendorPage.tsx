// File: modules/mdl_vendor/src/client/VendorPage.tsx
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
  Building2,
  MapPin,
  Store,
} from "lucide-react";
import { useVendorStore } from "./store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayout";
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
// 1. KOMPONEN FORM: VENDOR (SIDEOVER)
// =========================================================================
const VendorForm: React.FC<{
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
    <form onSubmit={handleSave} className="flex flex-col h-full space-y-4">
      <div className="flex-1 space-y-4">
        {/* Scope Wilayah Vendor */}
        <div className="bg-slate-100 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 mb-4">
          <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wide">
            CAKUPAN OPERASIONAL VENDOR
          </label>
          <div className="space-y-2">
            <select
              value={formData.regionId}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  regionId: e.target.value,
                  outletId: "",
                })
              }
              className="w-full text-xs font-bold p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-orange-500"
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
              className="w-full text-xs font-bold p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-orange-500 disabled:opacity-40"
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
        </div>

        <div>
          <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200 mb-1">
            NAMA VENDOR / DISTRIBUTOR
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value.toUpperCase() })
            }
            required
            autoFocus
            placeholder="CONTOH: PT SUMBER SEGAR UTAMA..."
            className="w-full text-sm font-bold p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200 mb-1">
            NOMOR KONTAK / SALES (HP / WA)
          </label>
          <input
            type="text"
            value={formData.contactNumber}
            onChange={(e) =>
              setFormData({
                ...formData,
                contactNumber: e.target.value.toUpperCase(),
              })
            }
            data-unv-numpad="true"
            placeholder="08123456789"
            className="w-full text-sm font-bold p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-orange-500 font-mono"
          />
        </div>

        {/* Info Rekening Bank */}
        <div className="bg-blue-50 dark:bg-blue-950/30 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 space-y-3">
          <label className="block text-[11px] font-black text-blue-700 dark:text-blue-400 mb-1 uppercase tracking-wider">
            INFORMASI REKENING PEMBAYARAN
          </label>

          <div>
            <label className="block text-[10px] font-black text-slate-800 dark:text-slate-200 mb-1">
              NAMA BANK
            </label>
            <input
              type="text"
              placeholder="BCA / MANDIRI / BNI / BRI..."
              value={formData.bankName}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  bankName: e.target.value.toUpperCase(),
                })
              }
              className="w-full text-sm font-bold p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-800 dark:text-slate-200 mb-1">
              NOMOR REKENING
            </label>
            <input
              type="text"
              placeholder="1234567890"
              value={formData.bankAccount}
              onChange={(e) =>
                setFormData({ ...formData, bankAccount: e.target.value })
              }
              data-unv-numpad="true"
              className="w-full text-sm font-bold p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-800 dark:text-slate-200 mb-1">
              ATAS NAMA REKENING
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
              className="w-full text-sm font-bold p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-(--border-color) shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 text-xs font-bold text-(--text-secondary) hover:bg-(--surface-hover) rounded-lg transition cursor-pointer"
        >
          BATAL
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition shadow-[0_4px_10px_rgba(249,115,22,0.3)] cursor-pointer"
        >
          SIMPAN VENDOR
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 2. MODAL FORM: UPLOAD DOKUMEN VENDOR
// =========================================================================
const DocumentUploadForm: React.FC<{
  vendorId: string;
  onClose: () => void;
}> = ({ vendorId, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return sysToast.error("Error", "Pilih file terlebih dahulu!");
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
      sysToast.success("Berhasil", "Dokumen masuk ke antrean upload offline.");
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <form onSubmit={handleUpload} className="p-4 space-y-4">
      <div>
        <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
          NAMA DOKUMEN / LEGALITAS
        </label>
        <input
          type="text"
          placeholder="NPWP / SERTIFIKAT HALAL / KONTRAK KERJA..."
          required
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          className="w-full text-sm font-bold p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
        />
      </div>

      <div className="border-2 border-dashed border-(--border-color) rounded-lg p-6 text-center hover:bg-(--surface-hover) transition cursor-pointer relative">
        <UploadCloud className="w-8 h-8 text-(--text-secondary) mx-auto mb-2" />
        <span className="text-sm font-bold text-(--text-primary)">
          {file ? file.name : "Klik untuk memilih file dokumen..."}
        </span>
        <input
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-(--border-color)">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-(--text-secondary) hover:bg-(--surface-hover) rounded-lg"
        >
          BATAL
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-black text-white bg-blue-500 rounded-lg hover:bg-blue-600 shadow-md"
        >
          SIMPAN DOKUMEN
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 3. KOMPONEN: PREVIEW DOKUMEN VENDOR
// =========================================================================
const VendorDocPreview: React.FC<{ doc: any }> = ({ doc }) => {
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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="w-full h-[60vh] flex items-center justify-center p-4">
      {previewLoading ? (
        <div className="flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <span className="font-bold text-slate-500 animate-pulse text-sm">
            Memuat Dokumen Vendor...
          </span>
        </div>
      ) : previewUrl ? (
        doc.fileType?.startsWith("image/") ||
        doc.fileName.match(/\.(jpg|jpeg|png)$/i) ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain shadow-md rounded border"
          />
        ) : doc.fileType === "application/pdf" ||
          doc.fileName.match(/\.pdf$/i) ? (
          <iframe
            src={previewUrl}
            className="w-full h-full bg-white rounded shadow-md border-0"
            title="PDF Preview"
          />
        ) : (
          <div className="bg-(--bg-card) w-full h-full shadow-md rounded flex flex-col items-center justify-center border-2 border-dashed border-(--border-color)">
            <FileText className="w-20 h-20 text-(--text-secondary) mb-3" />
            <span className="font-black text-lg text-(--text-primary) uppercase">
              {doc.name}
            </span>
            <span className="text-xs text-(--text-secondary) font-mono mt-1">
              FILE: {doc.fileName}
            </span>
            <a
              href={previewUrl}
              download={doc.fileName}
              className="mt-5 px-6 py-2 bg-orange-500 text-white rounded font-bold hover:bg-orange-600 transition cursor-pointer"
            >
              Unduh File
            </a>
          </div>
        )
      ) : (
        <div className="text-rose-500 font-bold">
          Dokumen belum tersinkronisasi / masih dalam antrean offline.
        </div>
      )}
    </div>
  );
};

// =========================================================================
// 4. HALAMAN UTAMA: VENDOR PAGE
// =========================================================================
export function VendorPage() {
  const { vendors, documents } = useVendorStore();
  const { companies, regions, outlets } = useOrgStore();
  const {
    openSideOver,
    closeSideOver,
    openCenterModal,
    closeCenterModal,
    openAlert,
  } = useUniversalModal();

  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Konteks Spasial Mesin Ini
  const localCompanyId = localStorage.getItem("__unv_companyId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";

  // =========================================================================
  // PERBAIKAN SPASIAL MUTLAK: PENYEKATAN VENDOR CABANG & HOLDING
  // =========================================================================
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      // 1. Filter Status Aktif vs Arsip
      const matchStatus =
        viewStatus === "AKTIF" ? v.status === "Aktif" : v.status === "Arsip";
      if (!matchStatus) return false;

      // 2. Filter Perusahaan / Holding
      if (localCompanyId && v.companyId && v.companyId !== localCompanyId) {
        return false;
      }

      // 3. Filter Spasial:
      // Mesin Cabang Outlet: Hanya lihat Vendor Pusat, Vendor Wilayahnya, atau Vendor Khusus Cabangnya
      if (localOutletId) {
        if (v.outletId && v.outletId !== localOutletId) return false;
        if (v.regionId && localRegionId && v.regionId !== localRegionId)
          return false;
      }
      // Mesin Gudang Regional: Hanya lihat Vendor Pusat atau Vendor Wilayahnya (Sembunyikan vendor lokal cabang lain)
      else if (localRegionId) {
        if (v.regionId && v.regionId !== localRegionId) return false;
        if (v.outletId) return false;
      }

      return true;
    });
  }, [vendors, viewStatus, localCompanyId, localRegionId, localOutletId]);

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

  const handleAction = async (type: string, id: string) => {
    try {
      await globalCommandBus.execute({ type, payload: { id } });
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

  // FULL ENGINE: Import Excel Otomatis untuk Vendor (Batch Injection)
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedData = await ExcelEngine.parseFile(file, vendorExcelSchema);
      if (parsedData.length === 0) {
        throw new Error("File Excel kosong atau format tidak sesuai.");
      }

      const companyId =
        localStorage.getItem("__unv_companyId") || companies[0]?.id || "";
      const regionId = localStorage.getItem("__unv_regionId") || null;
      const outletId = localStorage.getItem("__unv_outletId") || null;

      let successCount = 0;
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
        successCount++;
      }

      sysToast.success(
        "Import Berhasil",
        `Sukses mengimpor ${successCount} vendor pemasok dari file Excel!`,
      );
    } catch (err: any) {
      sysToast.error("Gagal Import Excel", err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsActionMenuOpen(false);
    }
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card) rounded-xl shadow-sm border border-(--border-color)">
      {/* HEADER UTAMA */}
      <div className="bg-(--surface-hover) border-b border-(--border-color) shrink-0">
        <div className="h-16 px-6 flex items-center justify-between">
          <h2 className="text-xl font-black text-(--text-primary) tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" /> Database Vendor &amp;
            Pemasok
          </h2>

          <div className="flex items-center gap-3">
            {/* SATU TOMBOL AKSI DATA & EXPORT POPOVER */}
            {viewStatus === "AKTIF" && (
              <div className="relative" ref={actionMenuRef}>
                <button
                  onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-black text-(--text-primary) bg-(--bg-card) border border-(--border-color) rounded-lg hover:bg-(--surface-hover) transition shadow-sm cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-orange-500" /> AKSI &amp;
                  DOKUMEN
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${isActionMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isActionMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-(--bg-card) rounded-xl shadow-2xl border border-(--border-color) py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      onClick={() => {
                        downloadTemplateVendorExcel();
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-(--text-primary) hover:bg-orange-500/10 hover:text-orange-500 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-(--text-secondary)" />{" "}
                      Unduh Template Excel
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-emerald-500 hover:bg-emerald-500/10 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500" />{" "}
                      Import File Excel
                    </button>
                    <div className="h-px bg-(--border-color) my-1"></div>
                    <button
                      onClick={() => {
                        exportExcelVendor(filteredVendors);
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-(--text-primary) hover:bg-orange-500/10 hover:text-orange-500 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-(--text-secondary)" />{" "}
                      Export ke Excel
                    </button>
                    <button
                      onClick={() => {
                        exportPdfVendor(filteredVendors);
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <FileDown className="w-4 h-4 text-rose-500" /> Export ke
                      PDF
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
                onClick={() =>
                  openSideOver({
                    title: "TAMBAH VENDOR BARU",
                    content: (
                      <VendorForm
                        isEditMode={false}
                        initialData={{}}
                        onClose={closeSideOver}
                      />
                    ),
                  })
                }
                className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" /> TAMBAH VENDOR
              </button>
            )}
          </div>
        </div>

        {/* TABS AKTIF / ARSIP */}
        <div className="px-6 py-3 border-t border-(--border-color) flex items-center gap-4">
          <button
            onClick={() => setViewStatus("AKTIF")}
            className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors cursor-pointer ${
              viewStatus === "AKTIF"
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-black"
                : "text-(--text-secondary) hover:bg-(--surface-hover)"
            }`}
          >
            DATA AKTIF ({filteredVendors.length})
          </button>
          <button
            onClick={() => setViewStatus("ARSIP")}
            className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors cursor-pointer ${
              viewStatus === "ARSIP"
                ? "bg-slate-800 text-white font-black"
                : "text-(--text-secondary) hover:bg-(--surface-hover)"
            }`}
          >
            DATA ARSIP
          </button>
        </div>
      </div>

      {/* BODY KONTEN TABEL */}
      <div className="flex-1 overflow-auto bg-transparent p-6 custom-scrollbar">
        <div className="bg-(--bg-card) rounded-lg border border-(--border-color) overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black text-(--text-secondary) tracking-wider">
                <th className="px-4 py-3">Nama Vendor</th>
                <th className="px-4 py-3">Informasi Rekening</th>
                <th className="px-4 py-3">Cakupan Wilayah</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border-color) text-xs font-semibold text-(--text-primary)">
              {filteredVendors.map((v) => {
                const reg = regions.find((r) => r.id === v.regionId);
                const out = outlets.find((o) => o.id === v.outletId);
                const vendorDocs = documents.filter(
                  (d) => d.vendorId === v.id && d.status === "Aktif",
                );

                return (
                  <tr
                    key={v.id}
                    className="hover:bg-(--surface-hover) transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-bold text-(--text-primary) text-sm">
                        {v.name}
                      </div>
                      <div className="text-(--text-secondary) font-mono mt-0.5">
                        {v.contactNumber || "-"}
                      </div>
                      {vendorDocs.length > 0 && (
                        <div className="mt-2 flex gap-1 flex-wrap">
                          {vendorDocs.map((d) => (
                            <button
                              key={d.id}
                              onClick={() =>
                                openCenterModal({
                                  title: `DOKUMEN VENDOR: ${d.name}`,
                                  content: <VendorDocPreview doc={d} />,
                                  footer: (
                                    <div className="flex justify-end gap-3 w-full">
                                      <button
                                        onClick={() => window.print()}
                                        className="px-4 py-2 text-xs font-black text-emerald-600 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition cursor-pointer flex items-center gap-1.5"
                                      >
                                        <Printer className="w-3.5 h-3.5" />{" "}
                                        CETAK
                                      </button>
                                      <button
                                        onClick={closeCenterModal}
                                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                                      >
                                        TUTUP
                                      </button>
                                    </div>
                                  ),
                                })
                              }
                              className="text-[9px] bg-(--bg-input) text-(--text-secondary) hover:text-orange-500 hover:border-orange-500/30 px-2 py-0.5 rounded font-bold border border-(--border-color) flex items-center gap-1 transition cursor-pointer"
                              title="Lihat Dokumen"
                            >
                              <FileText className="w-3 h-3 text-orange-500" />{" "}
                              {d.name}{" "}
                              <Eye className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-orange-500">
                        {v.bankName || "-"}
                      </div>
                      <div className="font-mono text-(--text-primary)">
                        {v.bankAccount || "-"}
                      </div>
                      <div className="text-(--text-secondary) uppercase text-[10px]">
                        A.N: {v.bankAccountName || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {!v.regionId ? (
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 inline-block px-2 py-0.5 rounded text-[10px]">
                          [HOLDING] PUSAT
                        </div>
                      ) : out ? (
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">
                            {out.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Reg: {reg?.name || "-"}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="font-bold text-blue-600 dark:text-blue-400 block">
                            [REGION] {reg?.name || "-"}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Cakupan Wilayah
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      {viewStatus === "AKTIF" ? (
                        <>
                          <button
                            onClick={() =>
                              openCenterModal({
                                title: `UNGGAH DOKUMEN: ${v.name}`,
                                content: (
                                  <DocumentUploadForm
                                    vendorId={v.id}
                                    onClose={closeCenterModal}
                                  />
                                ),
                              })
                            }
                            className="p-1.5 text-(--text-secondary) hover:text-blue-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                            title="Unggah Dokumen Legal"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              openSideOver({
                                title: "EDIT VENDOR",
                                content: (
                                  <VendorForm
                                    isEditMode={true}
                                    initialData={v}
                                    onClose={closeSideOver}
                                  />
                                ),
                              })
                            }
                            className="p-1.5 text-(--text-secondary) hover:text-orange-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                            title="Edit Vendor"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => confirmArchive(v.id, v.name)}
                            className="p-1.5 text-(--text-secondary) hover:text-rose-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                            title="Arsipkan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleAction("RESTORE_VENDOR", v.id)}
                          className="px-2 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> RESTORE
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredVendors.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-(--text-secondary) font-semibold text-xs"
                  >
                    Belum ada data vendor pemasok untuk unit ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
