import React, { useState, useEffect } from "react";
import {
  Building2,
  MapPin,
  Store,
  Plus,
  ChevronRight,
  ChevronDown,
  UploadCloud,
  Edit2,
  Printer,
  Trash2,
  Map,
  FileText,
  Archive,
  CheckCircle2,
  RotateCcw,
  Eye,
  CreditCard,
} from "lucide-react";
import { useOrgStore, useHasWriteAccess } from "./store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useDictionaryStore } from "../../../../apps/client_unv/src/system-ui/dictionaryStore";
import { globalBlobManager } from "../../../../packages/core_unv/src/io/BlobManager";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayout";
import { globalSubscriptionManager } from "../../../../packages/core_unv/src/runtime/SubscriptionManager";

// =========================================================================
// KOMPONEN: FORM REKENING BANK
// =========================================================================
const BankAccountForm: React.FC<{
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, initialData, onClose }) => {
  const { openAlert } = useUniversalModal();
  const [formData, setFormData] = useState<any>(initialData || {});

  const handleInputUppercase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value.toUpperCase() });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await globalCommandBus.execute({
        type: isEditMode ? "UPDATE_BANK_ACCOUNT" : "ADD_BANK_ACCOUNT",
        payload: formData,
      });
      onClose();
    } catch (error: any) {
      console.error("Gagal menyimpan data rekening:", error);
      openAlert({
        title: "Gagal Menyimpan",
        message: error.message || "Terjadi kesalahan sistem.",
      });
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 flex flex-col h-full">
      <div className="flex-1 space-y-4">
        <div>
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            NAMA BANK
          </label>
          <input
            type="text"
            name="bankName"
            value={formData.bankName || ""}
            onChange={handleInputUppercase}
            required
            placeholder="BCA / MANDIRI / BNI..."
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            NO REKENING
          </label>
          <input
            type="text"
            name="accountNumber"
            value={formData.accountNumber || ""}
            onChange={handleInputUppercase}
            required
            placeholder="Ketik Nomor Rekening..."
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            ATAS NAMA
          </label>
          <input
            type="text"
            name="accountName"
            value={formData.accountName || ""}
            onChange={handleInputUppercase}
            required
            placeholder="Nama Pemilik Rekening..."
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            KETERANGAN (OPSIONAL)
          </label>
          <input
            type="text"
            name="description"
            value={formData.description || ""}
            onChange={handleInputUppercase}
            placeholder="Cabang Utama / Kas Kecil..."
            className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
          />
        </div>
      </div>
      <div className="pt-4 flex justify-end gap-3 border-t border-(--border-color) shrink-0 bg-(--bg-card)">
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
          SIMPAN
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// KOMPONEN: FORM ORGANISASI & DOKUMEN
// =========================================================================
const OrgForm: React.FC<{
  modalType: "COMPANY" | "REGION" | "OUTLET" | "DOCUMENT";
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ modalType, isEditMode, initialData, onClose }) => {
  const { openAlert } = useUniversalModal();
  const { companies, regions } = useOrgStore();
  const industryOptions = useDictionaryStore((state) =>
    state.getItemsByCategory("INDUSTRY_TYPE"),
  );

  const [formData, setFormData] = useState<any>(initialData || {});
  const [isCustomIndustry, setIsCustomIndustry] = useState(
    modalType === "OUTLET" && isEditMode && initialData.industry
      ? !industryOptions.some((opt) => opt.value === initialData.industry)
      : false,
  );

  const handleInputUppercase = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value.toUpperCase() });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({
        ...formData,
        fileObj: file,
        fileName: file.name.toUpperCase(),
      });
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      return openAlert({
        title: "Sensor GPS Tidak Ditemukan",
        message: "Perangkat ini tidak mendukung penguncian geolokasi satelit.",
      });
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const coordsStr = `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

        // 1. Jika Online, coba ambil nama alamat wilayah resmi
        if (navigator.onLine) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout guard
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
              { signal: controller.signal },
            );
            clearTimeout(timeoutId);
            if (res.ok) {
              const data = await res.json();
              if (data && data.display_name) {
                setFormData((prev: any) => ({
                  ...prev,
                  address: `${data.display_name.toUpperCase()} (${coordsStr})`,
                }));
                return;
              }
            }
          } catch {
            // Fallback halus jika fetch gagal/lambat
          }
        }

        // 2. Jika Offline / Jaringan Gagal: Kunci murni koordinat satelit asli perangkat
        setFormData((prev: any) => ({
          ...prev,
          address: coordsStr,
        }));
      },
      () => {
        openAlert({
          title: "Izin Lokasi Diblokir",
          message:
            "Pastikan izin akses lokasi (GPS) diaktifkan pada browser perangkat ini.",
        });
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalType === "COMPANY") {
        await globalCommandBus.execute({
          type: isEditMode ? "UPDATE_COMPANY" : "CREATE_COMPANY",
          payload: formData,
        });
      } else if (modalType === "REGION") {
        await globalCommandBus.execute({
          type: isEditMode ? "UPDATE_REGION" : "CREATE_REGION",
          payload: formData,
        });
      } else if (modalType === "OUTLET") {
        if (isCustomIndustry && formData.industry) {
          await globalCommandBus.execute({
            type: "CREATE_DICTIONARY",
            payload: {
              category: "INDUSTRY_TYPE",
              value: formData.industry.toUpperCase().trim(),
            },
          });
        }
        await globalCommandBus.execute({
          type: isEditMode ? "UPDATE_OUTLET" : "CREATE_OUTLET",
          payload: formData,
        });
      } else if (modalType === "DOCUMENT") {
        await globalCommandBus.execute({
          type: isEditMode ? "UPDATE_DOCUMENT" : "ATTACH_DOCUMENT",
          payload: formData,
        });
      }
      onClose();
    } catch (error: any) {
      openAlert({
        title: "Gagal Menyimpan",
        message: error.message || "Terjadi kesalahan sistem.",
      });
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 flex flex-col h-full">
      <div className="flex-1 space-y-4">
        {modalType === "DOCUMENT" ? (
          <>
            <div>
              <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
                NAMA DOKUMEN
              </label>
              <input
                type="text"
                name="documentName"
                value={formData.documentName || ""}
                onChange={handleInputUppercase}
                required
                placeholder="SIUP / HALAL / NPWP..."
                className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
                PILIH FILE DOKUMEN {isEditMode && "(OPSIONAL)"}
              </label>
              <div className="border-2 border-dashed border-(--border-color) rounded-lg p-6 text-center hover:bg-(--surface-hover) transition cursor-pointer relative">
                <UploadCloud className="w-8 h-8 text-(--text-secondary) mx-auto mb-2" />
                <span className="text-sm font-bold text-(--text-primary)">
                  {formData.fileName || "Klik untuk memilih file..."}
                </span>
                <input
                  type="file"
                  required={!isEditMode}
                  accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {(modalType === "REGION" || modalType === "OUTLET") && (
              <div>
                <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
                  PERUSAHAAN
                </label>
                <select
                  name="companyId"
                  value={formData.companyId || ""}
                  onChange={handleInputUppercase}
                  required
                  className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
                >
                  <option value="">PILIH PERUSAHAAN</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {modalType === "OUTLET" && (
              <div>
                <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
                  REGIONAL
                </label>
                <select
                  name="regionId"
                  value={formData.regionId || ""}
                  onChange={handleInputUppercase}
                  required
                  className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
                >
                  <option value="">PILIH REGIONAL</option>
                  {regions
                    .filter((r) => r.companyId === formData.companyId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
                NAMA {modalType}
              </label>
              <input
                type="text"
                name="name"
                value={formData.name || ""}
                onChange={handleInputUppercase}
                required
                placeholder={`NAMA ${modalType}...`}
                className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
              />
            </div>
            {modalType === "COMPANY" && (
              <div>
                <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
                  LEGALITAS (OPSIONAL)
                </label>
                <input
                  type="text"
                  name="legalName"
                  value={formData.legalName || ""}
                  onChange={handleInputUppercase}
                  placeholder="PT. / CV. / NIB..."
                  className="w-full text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
                />
              </div>
            )}
            {(modalType === "REGION" || modalType === "OUTLET") && (
              <div>
                <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
                  ALAMAT / LOKASI
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="address"
                    value={formData.address || ""}
                    onChange={handleInputUppercase}
                    placeholder="NAMA JALAN / KOTA..."
                    className="flex-1 text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    className="px-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition cursor-pointer"
                    title="Deteksi Lokasi"
                  >
                    <Map className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            {modalType === "OUTLET" && (
              <div>
                <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
                  INDUSTRI
                </label>
                <div className="flex gap-2">
                  <select
                    value={
                      isCustomIndustry ? "LAINNYA" : formData.industry || ""
                    }
                    onChange={(e) => {
                      if (e.target.value === "LAINNYA") {
                        setIsCustomIndustry(true);
                        setFormData({ ...formData, industry: "" });
                      } else {
                        setIsCustomIndustry(false);
                        handleInputUppercase(e);
                      }
                    }}
                    name="industry"
                    required={!isCustomIndustry}
                    className="w-1/2 text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
                  >
                    <option value="">PILIH INDUSTRI</option>
                    {industryOptions.map((opt) => (
                      <option key={opt.id} value={opt.value}>
                        {opt.value}
                      </option>
                    ))}
                    <option value="LAINNYA">+ LAINNYA (KETIK MANUAL)</option>
                  </select>
                  {isCustomIndustry && (
                    <input
                      type="text"
                      name="industry"
                      value={formData.industry || ""}
                      onChange={handleInputUppercase}
                      required
                      placeholder="KETIK..."
                      className="w-1/2 text-sm font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div className="pt-4 flex justify-end gap-3 border-t border-(--border-color) shrink-0 bg-(--bg-card)">
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
          SIMPAN
        </button>
      </div>
    </form>
  );
};

const DocumentPreview: React.FC<{ doc: any }> = ({ doc }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setPreviewLoading(true);
    globalBlobManager
      .getFileFromCacheOrDownload(doc.documentId, "ORGANIZATION", true)
      .then((blob) => {
        if (blob && isMounted) setPreviewUrl(URL.createObjectURL(blob));
      })
      .catch((err) => {})
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
            Mengambil Dokumen Fisik...
          </span>
        </div>
      ) : previewUrl ? (
        doc.fileType?.startsWith("image/") ||
        doc.fileName.match(/\.(jpg|jpeg|png)$/i) ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain shadow-md rounded border-2 border-dashed border-(--border-color)"
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
            <FileText className="w-24 h-24 text-(--text-secondary) mb-4" />
            <span className="font-black text-xl text-(--text-primary) uppercase">
              {doc.name}
            </span>
            <span className="text-sm font-bold text-(--text-secondary) mt-2 font-mono">
              FILE: {doc.fileName}
            </span>
            <span className="text-xs text-(--text-secondary) mt-1 font-mono">
              SIZE: {(doc.size / 1024).toFixed(2)} KB
            </span>
            <a
              href={previewUrl}
              download={doc.fileName}
              className="mt-6 px-6 py-2 bg-orange-500 text-white rounded font-bold hover:bg-orange-600 transition cursor-pointer"
            >
              Download File
            </a>
          </div>
        )
      ) : (
        <div className="text-rose-500 font-bold">
          Gagal memuat dokumen (Masih Offline / Dalam Antrean).
        </div>
      )}
    </div>
  );
};

// =========================================================================
// KOMPONEN UTAMA: HALAMAN ORGANISASI
// =========================================================================
export function OrganizationPage() {
  const contextId = "mdl_organization_main_page";
  useEffect(() => {
    console.log(`[UI LIFECYCLE] Mounting modul: ${contextId}`);
    return () => {
      console.log(
        `[UI LIFECYCLE] Unmounting modul: ${contextId}. Membersihkan RAM...`,
      );
      globalSubscriptionManager.releaseAll(contextId);
    };
  }, []);

  const {
    openCenterModal,
    closeCenterModal,
    openSideOver,
    closeSideOver,
    openAlert,
  } = useUniversalModal();
  const { companies, regions, outlets, documents, bankAccounts } =
    useOrgStore();
  const hasWriteAccess = useHasWriteAccess();

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(
    {},
  );
  const [showDocumentNodes, setShowDocumentNodes] = useState<
    Record<string, boolean>
  >({});
  const [showBankNodes, setShowBankNodes] = useState<Record<string, boolean>>(
    {},
  ); // <-- TAMBAHAN
  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");

  const toggleNode = (id: string) =>
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleDocumentNode = (id: string) =>
    setShowDocumentNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleBankNode = (id: string) =>
    setShowBankNodes((prev) => ({ ...prev, [id]: !prev[id] })); // <-- TAMBAHAN

  const handleArchive = (
    id: string,
    type: "COMPANY" | "REGION" | "OUTLET" | "DOCUMENT" | "BANK_ACCOUNT",
    subId?: string,
  ) => {
    openAlert({
      title: "Konfirmasi Arsip",
      message: "Arsipkan (Soft Delete) data ini?",
      confirmText: "YA, ARSIPKAN",
      onConfirm: async () => {
        try {
          // Normalisasi nama payload agar command handler bisa memprosesnya
          const payload: any = { id, type };
          if (type === "DOCUMENT") payload.documentId = subId;
          if (type === "BANK_ACCOUNT") payload.bankAccountId = subId;

          await globalCommandBus.execute({ type: "ARCHIVE_DATA", payload });
        } catch (error) {
          console.error("Gagal mengarsipkan:", error);
        }
      },
    });
  };

  const handleRestore = (id: string, type: string, targetId?: string) => {
    openAlert({
      title: "Konfirmasi Restore",
      message: "Aktifkan kembali data ini?",
      confirmText: "YA, RESTORE",
      onConfirm: async () => {
        try {
          await globalCommandBus.execute({
            type: "RESTORE_DATA",
            payload: { id, type, targetId },
          });
        } catch (error) {
          console.error("Gagal merestore:", error);
        }
      },
    });
  };

  // RENDER DOKUMEN LIST
  const renderDocumentList = (nodeId: string) => {
    const nodeDocs = documents.filter(
      (d) => d.id === nodeId && d.status !== "Arsip",
    );
    return (
      <div className="pl-8 py-3 bg-(--surface-hover) border-t border-(--border-color)">
        {viewStatus === "AKTIF" && (
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => {
                openCenterModal({
                  title: "TAMBAH DOKUMEN",
                  content: (
                    <OrgForm
                      modalType="DOCUMENT"
                      isEditMode={false}
                      initialData={{ targetId: nodeId }}
                      onClose={closeCenterModal}
                    />
                  ),
                });
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black text-white bg-slate-800 rounded-md hover:bg-slate-700 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> TAMBAH DOKUMEN
            </button>
          </div>
        )}
        {nodeDocs.length > 0 ? (
          <div className="space-y-1 mt-3 pr-4">
            {nodeDocs.map((doc, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs font-semibold text-(--text-primary) bg-(--bg-card) p-2 rounded border border-(--border-color)"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-orange-500" />
                  <span>
                    {doc.name}{" "}
                    <span className="text-[10px] text-(--text-secondary) font-mono">
                      ({doc.fileName})
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      openCenterModal({
                        title: `PREVIEW: ${doc.fileName}`,
                        content: <DocumentPreview doc={doc} />,
                        footer: (
                          <div className="flex justify-end gap-3 w-full">
                            <button
                              onClick={() => window.print()}
                              className="px-4 py-2 text-xs font-black text-emerald-600 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition cursor-pointer flex items-center gap-2"
                            >
                              <Printer className="w-4 h-4" /> PRINT
                            </button>
                            <button
                              onClick={closeCenterModal}
                              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            >
                              TUTUP
                            </button>
                          </div>
                        ),
                      });
                    }}
                    className="p-1.5 text-(--text-secondary) hover:text-indigo-500 rounded cursor-pointer"
                    title="Preview Dokumen"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      openCenterModal({
                        title: "EDIT DOKUMEN",
                        content: (
                          <OrgForm
                            modalType="DOCUMENT"
                            isEditMode={true}
                            initialData={{
                              targetId: doc.id,
                              documentId: doc.documentId,
                              documentName: doc.name,
                              fileName: doc.fileName,
                              fileType: doc.fileType,
                              size: doc.size,
                            }}
                            onClose={closeCenterModal}
                          />
                        ),
                      });
                    }}
                    className="p-1.5 text-(--text-secondary) hover:text-blue-500 rounded cursor-pointer"
                    title="Edit Dokumen"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      handleArchive(doc.id, "DOCUMENT", doc.documentId)
                    }
                    className="p-1.5 text-(--text-secondary) hover:text-rose-500 rounded cursor-pointer"
                    title="Arsipkan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-(--text-secondary) font-bold mt-2 ml-1">
            BELUM ADA DOKUMEN.
          </div>
        )}
      </div>
    );
  };

  // RENDER BANK ACCOUNT LIST (TAMBAHAN BARU)
  const renderBankAccountList = (nodeId: string) => {
    const nodeBanks = bankAccounts.filter(
      (b) => b.id === nodeId && b.status !== "Arsip",
    );
    return (
      <div className="pl-8 py-3 bg-(--surface-hover) border-t border-(--border-color)">
        {viewStatus === "AKTIF" && (
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => {
                openSideOver({
                  title: "TAMBAH REKENING BANK",
                  width: "w-[450px]",
                  content: (
                    <BankAccountForm
                      isEditMode={false}
                      initialData={{ targetId: nodeId }}
                      onClose={closeSideOver}
                    />
                  ),
                });
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black text-white bg-slate-800 rounded-md hover:bg-slate-700 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> TAMBAH REKENING
            </button>
          </div>
        )}
        {nodeBanks.length > 0 ? (
          <div className="space-y-1 mt-3 pr-4">
            {nodeBanks.map((bank, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs font-semibold text-(--text-primary) bg-(--bg-card) p-2 rounded border border-(--border-color)"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  <div className="flex flex-col">
                    <span>
                      {bank.bankName} -{" "}
                      <span className="font-mono text-orange-500">
                        {bank.accountNumber}
                      </span>
                    </span>
                    <span className="text-[10px] text-(--text-secondary)">
                      A.N: {bank.accountName}{" "}
                      {bank.description ? `(${bank.description})` : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      openSideOver({
                        title: "EDIT REKENING BANK",
                        width: "w-[450px]",
                        content: (
                          <BankAccountForm
                            isEditMode={true}
                            initialData={{
                              targetId: bank.id,
                              bankAccountId: bank.bankAccountId,
                              bankName: bank.bankName,
                              accountNumber: bank.accountNumber,
                              accountName: bank.accountName,
                              description: bank.description,
                            }}
                            onClose={closeSideOver}
                          />
                        ),
                      });
                    }}
                    className="p-1.5 text-(--text-secondary) hover:text-blue-500 rounded cursor-pointer"
                    title="Edit Rekening"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      handleArchive(bank.id, "BANK_ACCOUNT", bank.bankAccountId)
                    }
                    className="p-1.5 text-(--text-secondary) hover:text-rose-500 rounded cursor-pointer"
                    title="Arsipkan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-(--text-secondary) font-bold mt-2 ml-1">
            BELUM ADA REKENING BANK.
          </div>
        )}
      </div>
    );
  };

  const archiveList: any[] = [];
  const getCompanyName = (id: string) =>
    companies.find((c) => c.id === id)?.name || "-";
  const getRegionName = (id: string) =>
    regions.find((r) => r.id === id)?.name || "-";

  if (viewStatus === "ARSIP") {
    companies
      .filter((c) => c.status === "Arsip")
      .forEach((c) =>
        archiveList.push({
          restoreId: c.id,
          type: "COMPANY",
          comp: c.name,
          reg: "-",
          out: "-",
          doc: "-",
        }),
      );
    regions
      .filter((r) => r.status === "Arsip")
      .forEach((r) =>
        archiveList.push({
          restoreId: r.id,
          type: "REGION",
          comp: getCompanyName(r.companyId),
          reg: r.name,
          out: "-",
          doc: "-",
        }),
      );
    outlets
      .filter((o) => o.status === "Arsip")
      .forEach((o) =>
        archiveList.push({
          restoreId: o.id,
          type: "OUTLET",
          comp: getCompanyName(o.companyId),
          reg: getRegionName(o.regionId),
          out: o.name,
          doc: "-",
        }),
      );
    documents
      .filter((d) => d.status === "Arsip")
      .forEach((d) => {
        let comp = "-",
          reg = "-",
          out = "-";
        if (companies.some((c) => c.id === d.id)) comp = getCompanyName(d.id);
        else if (regions.some((r) => r.id === d.id)) {
          const r = regions.find((x) => x.id === d.id);
          comp = getCompanyName(r?.companyId || "");
          reg = r?.name || "-";
        } else if (outlets.some((o) => o.id === d.id)) {
          const o = outlets.find((x) => x.id === d.id);
          comp = getCompanyName(o?.companyId || "");
          reg = getRegionName(o?.regionId || "");
          out = o?.name || "-";
        }
        archiveList.push({
          restoreId: d.documentId,
          type: "DOCUMENT",
          comp,
          reg,
          out,
          doc: `DOC: ${d.name} ("${d.fileName}")`,
          targetId: d.id,
        });
      });
    // TAMBAHAN: Tampilkan arsip Rekening Bank
    bankAccounts
      .filter((b) => b.status === "Arsip")
      .forEach((b) => {
        let comp = "-",
          reg = "-",
          out = "-";
        if (regions.some((r) => r.id === b.id)) {
          const r = regions.find((x) => x.id === b.id);
          comp = getCompanyName(r?.companyId || "");
          reg = r?.name || "-";
        } else if (outlets.some((o) => o.id === b.id)) {
          const o = outlets.find((x) => x.id === b.id);
          comp = getCompanyName(o?.companyId || "");
          reg = getRegionName(o?.regionId || "");
          out = o?.name || "-";
        }
        archiveList.push({
          restoreId: b.bankAccountId,
          type: "BANK_ACCOUNT",
          comp,
          reg,
          out,
          doc: `REK: ${b.bankName} - ${b.accountNumber} (${b.accountName})`,
          targetId: b.id,
        });
      });
  }

  const activeCompanies = companies.filter((c) => c.status === "Aktif");

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-18 px-6 flex items-center justify-between bg-(--bg-card) border-b border-(--border-color) shrink-0">
        <div>
          <h2 className="text-2xl font-black text-(--text-primary) tracking-tight">
            Struktur Organisasi
          </h2>
          <p className="text-xs text-(--text-secondary) font-semibold mt-0.5">
            Manajemen Berjenjang (Perusahaan &gt; Regional &gt; Outlet)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasWriteAccess && (
            <button
              onClick={() => {
                openSideOver({
                  title: "TAMBAH PERUSAHAAN",
                  width: "w-[450px]",
                  content: (
                    <OrgForm
                      modalType="COMPANY"
                      isEditMode={false}
                      initialData={{}}
                      onClose={closeSideOver}
                    />
                  ),
                });
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition shadow-[0_4px_10px_rgba(249,115,22,0.3)] cursor-pointer"
            >
              <Plus className="w-4 h-4" /> TAMBAH PERUSAHAAN
            </button>
          )}
        </div>
      </div>
      {/* Tabs */}
      <div className="px-6 bg-(--bg-card) border-b border-(--border-color) flex items-center gap-6 shrink-0">
        <button
          onClick={() => setViewStatus("AKTIF")}
          className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all cursor-pointer flex items-center gap-2 ${viewStatus === "AKTIF" ? "border-orange-500 text-orange-600" : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"}`}
        >
          <CheckCircle2 className="w-4 h-4" /> DATA AKTIF
        </button>
        <button
          onClick={() => setViewStatus("ARSIP")}
          className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all cursor-pointer flex items-center gap-2 ${viewStatus === "ARSIP" ? "border-(--text-primary) text-(--text-primary)" : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"}`}
        >
          <Archive className="w-4 h-4" /> ARSIP (NON-AKTIF)
        </button>
      </div>
      {/* Konten Utama */}
      <div className="flex-1 overflow-auto p-6 bg-transparent custom-scrollbar">
        {viewStatus === "AKTIF" ? (
          <div className="bg-(--bg-card) rounded-xl shadow-sm border border-(--border-color) overflow-hidden">
            {activeCompanies.length === 0 ? (
              <div className="p-10 text-center text-(--text-secondary) font-bold uppercase">
                BELUM ADA DATA AKTIF
              </div>
            ) : (
              activeCompanies.map((company) => {
                const companyRegions = regions.filter(
                  (r) => r.companyId === company.id && r.status === "Aktif",
                );
                return (
                  <div
                    key={company.id}
                    className="border-b border-(--border-color) last:border-b-0"
                  >
                    <div className="flex items-center justify-between p-4 hover:bg-(--surface-hover) transition">
                      <div
                        className="flex items-center gap-3 cursor-pointer select-none"
                        onClick={() => toggleNode(company.id)}
                      >
                        {expandedNodes[company.id] ? (
                          <ChevronDown className="w-5 h-5 text-(--text-secondary)" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-(--text-secondary)" />
                        )}
                        <Building2 className="w-5 h-5 text-(--text-primary)" />
                        <span className="font-black text-(--text-primary) text-sm tracking-wide">
                          {company.name}
                        </span>
                        <span className="px-2 py-0.5 bg-(--surface-hover) text-(--text-secondary) font-bold text-[10px] rounded-full">
                          BADGE{" "}
                          {
                            documents.filter(
                              (d) =>
                                d.id === company.id && d.status === "Aktif",
                            ).length
                          }{" "}
                          DOKUMEN
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {hasWriteAccess && (
                          <button
                            onClick={() => {
                              openSideOver({
                                title: "TAMBAH REGIONAL",
                                width: "w-[450px]",
                                content: (
                                  <OrgForm
                                    modalType="REGION"
                                    isEditMode={false}
                                    initialData={{ companyId: company.id }}
                                    onClose={closeSideOver}
                                  />
                                ),
                              });
                            }}
                            className="text-[10px] font-black text-orange-600 bg-orange-100 px-3 py-1.5 rounded hover:bg-orange-200 cursor-pointer"
                          >
                            + REGIONAL
                          </button>
                        )}
                        {hasWriteAccess && (
                          <button
                            onClick={() => {
                              openSideOver({
                                title: "EDIT PERUSAHAAN",
                                width: "w-[450px]",
                                content: (
                                  <OrgForm
                                    modalType="COMPANY"
                                    isEditMode={true}
                                    initialData={{
                                      id: company.id,
                                      name: company.name,
                                      legalName: company.legalName,
                                    }}
                                    onClose={closeSideOver}
                                  />
                                ),
                              });
                            }}
                            className="p-1.5 text-(--text-secondary) hover:text-blue-500 rounded cursor-pointer"
                            title="Edit Data"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {hasWriteAccess && (
                          <button
                            onClick={() => handleArchive(company.id, "COMPANY")}
                            className="p-1.5 text-(--text-secondary) hover:text-rose-500 rounded cursor-pointer"
                            title="Arsipkan"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {expandedNodes[company.id] && (
                      <div className="bg-(--surface-hover) border-t border-(--border-color)">
                        <div className="pl-8 pt-3 pb-1 flex gap-2">
                          <button
                            onClick={() => toggleDocumentNode(company.id)}
                            className="inline-flex items-center gap-2 text-[10px] font-black text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />{" "}
                            {showDocumentNodes[company.id]
                              ? "SEMBUNYIKAN DOKUMEN"
                              : "LIHAT DOKUMEN"}
                          </button>
                        </div>
                        {showDocumentNodes[company.id] &&
                          renderDocumentList(company.id)}
                        <div className="pl-8">
                          {companyRegions.map((region) => {
                            const regionOutlets = outlets.filter(
                              (o) =>
                                o.regionId === region.id &&
                                o.status === "Aktif",
                            );
                            return (
                              <div
                                key={region.id}
                                className="border-t border-(--border-color)"
                              >
                                <div className="flex items-center justify-between p-3 hover:bg-(--surface-hover) transition">
                                  <div
                                    className="flex items-center gap-3 cursor-pointer select-none"
                                    onClick={() => toggleNode(region.id)}
                                  >
                                    {expandedNodes[region.id] ? (
                                      <ChevronDown className="w-4 h-4 text-(--text-secondary)" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-(--text-secondary)" />
                                    )}
                                    <MapPin className="w-4 h-4 text-(--text-primary)" />
                                    <span className="font-bold text-(--text-primary) text-sm">
                                      {region.name}
                                    </span>
                                    <span className="px-2 py-0.5 bg-(--bg-card) border border-(--border-color) text-(--text-secondary) font-bold text-[10px] rounded-full">
                                      BADGE{" "}
                                      {
                                        documents.filter(
                                          (d) =>
                                            d.id === region.id &&
                                            d.status === "Aktif",
                                        ).length
                                      }{" "}
                                      DOKUMEN
                                    </span>
                                    <span className="px-2 py-0.5 bg-emerald-100/50 border border-emerald-500/30 text-emerald-600 font-bold text-[10px] rounded-full">
                                      BADGE{" "}
                                      {
                                        bankAccounts.filter(
                                          (b) =>
                                            b.id === region.id &&
                                            b.status === "Aktif",
                                        ).length
                                      }{" "}
                                      REK
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {hasWriteAccess && (
                                      <button
                                        onClick={() => {
                                          openSideOver({
                                            title: "TAMBAH OUTLET",
                                            width: "w-[450px]",
                                            content: (
                                              <OrgForm
                                                modalType="OUTLET"
                                                isEditMode={false}
                                                initialData={{
                                                  companyId: company.id,
                                                  regionId: region.id,
                                                }}
                                                onClose={closeSideOver}
                                              />
                                            ),
                                          });
                                        }}
                                        className="text-[10px] font-black text-teal-600 bg-teal-100 px-3 py-1.5 rounded hover:bg-teal-200 cursor-pointer"
                                      >
                                        + OUTLET
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        openSideOver({
                                          title: "TAMBAH REKENING",
                                          width: "w-[450px]",
                                          content: (
                                            <BankAccountForm
                                              isEditMode={false}
                                              initialData={{
                                                targetId: region.id,
                                              }}
                                              onClose={closeSideOver}
                                            />
                                          ),
                                        });
                                      }}
                                      className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded hover:bg-emerald-200 cursor-pointer"
                                    >
                                      + REKENING
                                    </button>
                                    {hasWriteAccess && (
                                      <button
                                        onClick={() => {
                                          openSideOver({
                                            title: "EDIT REGIONAL",
                                            width: "w-[450px]",
                                            content: (
                                              <OrgForm
                                                modalType="REGION"
                                                isEditMode={true}
                                                initialData={{
                                                  id: region.id,
                                                  companyId: region.companyId,
                                                  name: region.name,
                                                  address: region.address,
                                                }}
                                                onClose={closeSideOver}
                                              />
                                            ),
                                          });
                                        }}
                                        className="p-1.5 text-(--text-secondary) hover:text-blue-500 rounded cursor-pointer"
                                        title="Edit Data"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                    )}
                                    {hasWriteAccess && (
                                      <button
                                        onClick={() =>
                                          handleArchive(region.id, "REGION")
                                        }
                                        className="p-1.5 text-(--text-secondary) hover:text-rose-500 rounded cursor-pointer"
                                        title="Arsipkan"
                                      >
                                        <Archive className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {expandedNodes[region.id] && (
                                  <div className="bg-(--surface-hover)">
                                    <div className="pl-8 pt-3 pb-1 flex gap-2">
                                      <button
                                        onClick={() =>
                                          toggleDocumentNode(region.id)
                                        }
                                        className="inline-flex items-center gap-2 text-[10px] font-black text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition cursor-pointer"
                                      >
                                        <FileText className="w-3.5 h-3.5" />{" "}
                                        {showDocumentNodes[region.id]
                                          ? "SEMBUNYIKAN DOKUMEN"
                                          : "LIHAT DOKUMEN"}
                                      </button>
                                      <button
                                        onClick={() =>
                                          toggleBankNode(region.id)
                                        }
                                        className="inline-flex items-center gap-2 text-[10px] font-black text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded transition cursor-pointer"
                                      >
                                        <CreditCard className="w-3.5 h-3.5" />{" "}
                                        {showBankNodes[region.id]
                                          ? "SEMBUNYIKAN REKENING"
                                          : "LIHAT REKENING"}
                                      </button>
                                    </div>
                                    {showDocumentNodes[region.id] &&
                                      renderDocumentList(region.id)}
                                    {showBankNodes[region.id] &&
                                      renderBankAccountList(region.id)}
                                    <div className="pl-8">
                                      {regionOutlets.map((outlet) => (
                                        <div
                                          key={outlet.id}
                                          className="border-t border-(--border-color)"
                                        >
                                          <div className="flex items-center justify-between p-3 hover:bg-(--surface-hover) transition">
                                            <div
                                              className="flex items-center gap-3 cursor-pointer select-none"
                                              onClick={() =>
                                                toggleNode(outlet.id)
                                              }
                                            >
                                              {expandedNodes[outlet.id] ? (
                                                <ChevronDown className="w-4 h-4 text-(--text-secondary)" />
                                              ) : (
                                                <ChevronRight className="w-4 h-4 text-(--text-secondary)" />
                                              )}
                                              <Store className="w-4 h-4 text-(--text-primary)" />
                                              <span className="font-bold text-(--text-primary) text-sm">
                                                {outlet.name}{" "}
                                                <span className="text-[10px] text-(--text-secondary) font-medium">
                                                  ({outlet.industry || "JASA"})
                                                </span>
                                              </span>
                                              <span className="px-2 py-0.5 bg-(--bg-card) border border-(--border-color) text-(--text-secondary) font-bold text-[10px] rounded-full">
                                                BADGE{" "}
                                                {
                                                  documents.filter(
                                                    (d) =>
                                                      d.id === outlet.id &&
                                                      d.status === "Aktif",
                                                  ).length
                                                }{" "}
                                                DOKUMEN
                                              </span>
                                              <span className="px-2 py-0.5 bg-emerald-100/50 border border-emerald-500/30 text-emerald-600 font-bold text-[10px] rounded-full">
                                                BADGE{" "}
                                                {
                                                  bankAccounts.filter(
                                                    (b) =>
                                                      b.id === outlet.id &&
                                                      b.status === "Aktif",
                                                  ).length
                                                }{" "}
                                                REK
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <button
                                                onClick={() => {
                                                  openSideOver({
                                                    title: "TAMBAH REKENING",
                                                    width: "w-[450px]",
                                                    content: (
                                                      <BankAccountForm
                                                        isEditMode={false}
                                                        initialData={{
                                                          targetId: outlet.id,
                                                        }}
                                                        onClose={closeSideOver}
                                                      />
                                                    ),
                                                  });
                                                }}
                                                className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded hover:bg-emerald-200 cursor-pointer"
                                              >
                                                + REKENING
                                              </button>
                                              {hasWriteAccess && (
                                                <button
                                                  onClick={() => {
                                                    openSideOver({
                                                      title: "EDIT OUTLET",
                                                      width: "w-[450px]",
                                                      content: (
                                                        <OrgForm
                                                          modalType="OUTLET"
                                                          isEditMode={true}
                                                          initialData={{
                                                            id: outlet.id,
                                                            companyId:
                                                              outlet.companyId,
                                                            regionId:
                                                              outlet.regionId,
                                                            name: outlet.name,
                                                            address:
                                                              outlet.address,
                                                            industry:
                                                              outlet.industry,
                                                          }}
                                                          onClose={
                                                            closeSideOver
                                                          }
                                                        />
                                                      ),
                                                    });
                                                  }}
                                                  className="p-1.5 text-(--text-secondary) hover:text-blue-500 rounded cursor-pointer"
                                                  title="Edit Data"
                                                >
                                                  <Edit2 className="w-4 h-4" />
                                                </button>
                                              )}
                                              {hasWriteAccess && (
                                                <button
                                                  onClick={() =>
                                                    handleArchive(
                                                      outlet.id,
                                                      "OUTLET",
                                                    )
                                                  }
                                                  className="p-1.5 text-(--text-secondary) hover:text-rose-500 rounded cursor-pointer"
                                                  title="Arsipkan"
                                                >
                                                  <Archive className="w-4 h-4" />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          {expandedNodes[outlet.id] && (
                                            <div className="bg-(--surface-hover) border-t border-(--border-color)">
                                              <div className="pl-8 pt-3 pb-1 flex gap-2">
                                                <button
                                                  onClick={() =>
                                                    toggleDocumentNode(
                                                      outlet.id,
                                                    )
                                                  }
                                                  className="inline-flex items-center gap-2 text-[10px] font-black text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition cursor-pointer"
                                                >
                                                  <FileText className="w-3.5 h-3.5" />{" "}
                                                  {showDocumentNodes[outlet.id]
                                                    ? "SEMBUNYIKAN DOKUMEN"
                                                    : "LIHAT DOKUMEN"}
                                                </button>
                                                <button
                                                  onClick={() =>
                                                    toggleBankNode(outlet.id)
                                                  }
                                                  className="inline-flex items-center gap-2 text-[10px] font-black text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded transition cursor-pointer"
                                                >
                                                  <CreditCard className="w-3.5 h-3.5" />{" "}
                                                  {showBankNodes[outlet.id]
                                                    ? "SEMBUNYIKAN REKENING"
                                                    : "LIHAT REKENING"}
                                                </button>
                                              </div>
                                              {showDocumentNodes[outlet.id] &&
                                                renderDocumentList(outlet.id)}
                                              {showBankNodes[outlet.id] &&
                                                renderBankAccountList(
                                                  outlet.id,
                                                )}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="bg-(--bg-card) rounded-xl shadow-sm border border-(--border-color) overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black tracking-widest text-(--text-secondary)">
                  <th className="px-6 py-4">Nama Perusahaan</th>
                  <th className="px-6 py-4">Nama Region</th>
                  <th className="px-6 py-4">Nama Outlet</th>
                  <th className="px-6 py-4">Nama Dokumen / Rekening</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-color) text-[13px]">
                {archiveList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-(--text-secondary) font-bold uppercase"
                    >
                      TIDAK ADA DATA ARSIP
                    </td>
                  </tr>
                ) : (
                  archiveList.map((item, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-(--surface-hover) transition"
                    >
                      <td className="px-6 py-4 font-bold text-(--text-primary)">
                        {item.comp}
                      </td>
                      <td className="px-6 py-4 font-semibold text-(--text-secondary)">
                        {item.reg}
                      </td>
                      <td className="px-6 py-4 font-medium text-(--text-secondary)">
                        {item.out}
                      </td>
                      <td className="px-6 py-4 font-medium text-(--text-secondary)">
                        {item.doc}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {hasWriteAccess && (
                          <button
                            onClick={() =>
                              handleRestore(
                                item.restoreId,
                                item.type,
                                item.targetId,
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-black text-emerald-600 bg-emerald-100 rounded hover:bg-emerald-200 transition uppercase cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" /> Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
