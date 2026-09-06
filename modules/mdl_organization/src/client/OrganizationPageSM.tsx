// File: modules/mdl_organization/src/client/OrganizationPageSM.tsx
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
  X,
} from "lucide-react";
import { useOrgStore, useHasWriteAccess } from "./store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useDictionaryStore } from "../../../../apps/client_unv/src/system-ui/dictionaryStore";
import { globalBlobManager } from "../../../../packages/core_unv/src/io/BlobManager";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayoutSM";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";

// =========================================================================
// 1. FORM REKENING BANK MOBILE
// =========================================================================
const BankAccountFormSM: React.FC<{
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, initialData, onClose }) => {
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
      sysToast.success("Berhasil", "Data rekening bank disimpan.");
      onClose();
    } catch (error: any) {
      sysToast.error("Gagal Menyimpan", error.message);
    }
  };

  return (
    <form onSubmit={handleSave} className="p-4 space-y-3">
      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Nama Bank
        </label>
        <input
          type="text"
          name="bankName"
          value={formData.bankName || ""}
          onChange={handleInputUppercase}
          required
          autoFocus
          placeholder="BCA / MANDIRI / BNI..."
          className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Nomor Rekening
        </label>
        <input
          type="text"
          name="accountNumber"
          inputMode="numeric"
          value={formData.accountNumber || ""}
          onChange={handleInputUppercase}
          required
          placeholder="Ketik Nomor Rekening..."
          className="w-full text-xs font-mono font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Atas Nama Pemilik
        </label>
        <input
          type="text"
          name="accountName"
          value={formData.accountName || ""}
          onChange={handleInputUppercase}
          required
          placeholder="Nama Pemilik Rekening..."
          className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Keterangan (Opsional)
        </label>
        <input
          type="text"
          name="description"
          value={formData.description || ""}
          onChange={handleInputUppercase}
          placeholder="Rekening Operasional / Kasir..."
          className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none"
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
          Simpan Rekening
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 2. FORM ORGANISASI & DOKUMEN MOBILE
// =========================================================================
const OrgFormSM: React.FC<{
  modalType: "COMPANY" | "REGION" | "OUTLET" | "DOCUMENT";
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ modalType, isEditMode, initialData, onClose }) => {
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
      return sysToast.warn("GPS", "Sensor GPS tidak didukung.");
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const coordsStr = `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        if (navigator.onLine) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
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
          } catch {}
        }
        setFormData((prev: any) => ({
          ...prev,
          address: coordsStr,
        }));
      },
      () => {
        sysToast.error("GPS", "Izin akses lokasi diblokir browser.");
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
      sysToast.success("Berhasil", "Data berhasil disimpan.");
      onClose();
    } catch (error: any) {
      sysToast.error("Gagal", error.message || "Terjadi kesalahan sistem.");
    }
  };

  return (
    <form onSubmit={handleSave} className="p-4 space-y-3">
      {modalType === "DOCUMENT" ? (
        <>
          <div>
            <label className="block text-[10px] font-black text-(--text-secondary) mb-1 uppercase">
              Nama Dokumen
            </label>
            <input
              type="text"
              name="documentName"
              value={formData.documentName || ""}
              onChange={handleInputUppercase}
              required
              placeholder="SIUP / HALAL / NPWP..."
              className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-(--text-secondary) mb-1 uppercase">
              Pilih Berkas File
            </label>
            <div className="border-2 border-dashed border-(--border-color) rounded-xl p-4 text-center hover:bg-(--surface-hover) transition cursor-pointer relative">
              <UploadCloud className="w-6 h-6 text-(--text-secondary) mx-auto mb-1" />
              <span className="text-xs font-bold text-(--text-primary) block truncate">
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
              <label className="block text-[10px] font-black text-(--text-secondary) mb-1 uppercase">
                Perusahaan
              </label>
              <select
                name="companyId"
                value={formData.companyId || ""}
                onChange={handleInputUppercase}
                required
                className="w-full text-xs font-bold text-(--text-primary) p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none"
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
              <label className="block text-[10px] font-black text-(--text-secondary) mb-1 uppercase">
                Regional
              </label>
              <select
                name="regionId"
                value={formData.regionId || ""}
                onChange={handleInputUppercase}
                required
                className="w-full text-xs font-bold text-(--text-primary) p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none"
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
            <label className="block text-[10px] font-black text-(--text-secondary) mb-1 uppercase">
              Nama {modalType}
            </label>
            <input
              type="text"
              name="name"
              value={formData.name || ""}
              onChange={handleInputUppercase}
              required
              placeholder={`NAMA ${modalType}...`}
              className="w-full text-xs font-bold text-(--text-primary) p-2.5 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
            />
          </div>

          {modalType === "COMPANY" && (
            <div>
              <label className="block text-[10px] font-black text-(--text-secondary) mb-1 uppercase">
                Legalitas (Opsional)
              </label>
              <input
                type="text"
                name="legalName"
                value={formData.legalName || ""}
                onChange={handleInputUppercase}
                placeholder="PT. / CV. / NIB..."
                className="w-full text-xs font-bold text-(--text-primary) p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none"
              />
            </div>
          )}

          {(modalType === "REGION" || modalType === "OUTLET") && (
            <div>
              <label className="block text-[10px] font-black text-(--text-secondary) mb-1 uppercase">
                Alamat / Lokasi GPS
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="address"
                  value={formData.address || ""}
                  onChange={handleInputUppercase}
                  placeholder="Nama jalan atau GPS..."
                  className="flex-1 text-xs font-bold text-(--text-primary) p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none"
                />
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  className="px-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                  title="Deteksi Lokasi GPS"
                >
                  <Map className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {modalType === "OUTLET" && (
            <div>
              <label className="block text-[10px] font-black text-(--text-secondary) mb-1 uppercase">
                Jenis Industri
              </label>
              <select
                value={isCustomIndustry ? "LAINNYA" : formData.industry || ""}
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
                className="w-full text-xs font-bold text-(--text-primary) p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none"
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
                  placeholder="Ketik nama industri..."
                  className="w-full text-xs font-bold text-(--text-primary) p-2 bg-(--bg-input) border border-orange-500 rounded-lg outline-none mt-2"
                />
              )}
            </div>
          )}
        </>
      )}

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
          Simpan Data
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 3. HALAMAN UTAMA MOBILE: ORGANIZATION PAGE SM
// =========================================================================
export function OrganizationPageSM() {
  const {
    openCenterModal,
    closeCenterModal,
    openAlert,
  } = useUniversalModal();

  const { companies, regions, outlets, documents, bankAccounts } = useOrgStore();
  const hasWriteAccess = useHasWriteAccess();

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [showDocumentNodes, setShowDocumentNodes] = useState<Record<string, boolean>>({});
  const [showBankNodes, setShowBankNodes] = useState<Record<string, boolean>>({});
  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");

  const toggleNode = (id: string) =>
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleDocumentNode = (id: string) =>
    setShowDocumentNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleBankNode = (id: string) =>
    setShowBankNodes((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleArchive = (
    id: string,
    type: "COMPANY" | "REGION" | "OUTLET" | "DOCUMENT" | "BANK_ACCOUNT",
    subId?: string,
  ) => {
    openAlert({
      title: "Konfirmasi Arsip",
      message: "Arsipkan data ini?",
      confirmText: "YA, ARSIPKAN",
      onConfirm: async () => {
        try {
          const payload: any = { id, type };
          if (type === "DOCUMENT") payload.documentId = subId;
          if (type === "BANK_ACCOUNT") payload.bankAccountId = subId;
          await globalCommandBus.execute({ type: "ARCHIVE_DATA", payload });
          sysToast.success("Berhasil", "Data diarsipkan.");
        } catch (error: any) {
          sysToast.error("Gagal", error.message);
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
          sysToast.success("Berhasil", "Data dipulihkan.");
        } catch (error: any) {
          sysToast.error("Gagal", error.message);
        }
      },
    });
  };

  const activeCompanies = companies.filter((c) => c.status === "Aktif");

  // Render Sub-list Dokumen
  const renderDocList = (nodeId: string) => {
    const nodeDocs = documents.filter(
      (d) => d.id === nodeId && d.status !== "Arsip",
    );
    return (
      <div className="p-2.5 bg-(--surface-hover) rounded-xl border border-(--border-color) space-y-1.5 mt-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-(--text-secondary) uppercase">
            Dokumen Legalitas ({nodeDocs.length}):
          </span>
          {hasWriteAccess && viewStatus === "AKTIF" && (
            <button
              onClick={() =>
                openCenterModal({
                  title: "TAMBAH DOKUMEN",
                  content: (
                    <OrgFormSM
                      modalType="DOCUMENT"
                      isEditMode={false}
                      initialData={{ targetId: nodeId }}
                      onClose={closeCenterModal}
                    />
                  ),
                })
              }
              className="text-[9px] bg-slate-800 text-white px-2 py-0.5 rounded font-black"
            >
              + Dokumen
            </button>
          )}
        </div>
        {nodeDocs.map((doc, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2 rounded bg-(--bg-card) border border-(--border-color) text-xs"
          >
            <div className="flex items-center gap-1.5 truncate flex-1">
              <FileText className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="font-bold text-(--text-primary) truncate">{doc.name}</span>
            </div>
            {hasWriteAccess && viewStatus === "AKTIF" && (
              <button
                onClick={() => handleArchive(doc.id, "DOCUMENT", doc.documentId)}
                className="text-(--text-secondary) hover:text-rose-500 p-0.5 ml-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render Sub-list Rekening Bank
  const renderBankList = (nodeId: string) => {
    const nodeBanks = bankAccounts.filter(
      (b) => b.id === nodeId && b.status !== "Arsip",
    );
    return (
      <div className="p-2.5 bg-(--surface-hover) rounded-xl border border-(--border-color) space-y-1.5 mt-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
            Rekening Bank ({nodeBanks.length}):
          </span>
          {hasWriteAccess && viewStatus === "AKTIF" && (
            <button
              onClick={() =>
                openCenterModal({
                  title: "TAMBAH REKENING",
                  content: (
                    <BankAccountFormSM
                      isEditMode={false}
                      initialData={{ targetId: nodeId }}
                      onClose={closeCenterModal}
                    />
                  ),
                })
              }
              className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded font-black"
            >
              + Rekening
            </button>
          )}
        </div>
        {nodeBanks.map((bank, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2 rounded bg-(--bg-card) border border-(--border-color) text-xs"
          >
            <div>
              <span className="font-bold text-orange-500">{bank.bankName}</span> -{" "}
              <span className="font-mono font-bold text-(--text-primary)">{bank.accountNumber}</span>
              <div className="text-[9px] text-(--text-secondary)">A.N: {bank.accountName}</div>
            </div>
            {hasWriteAccess && viewStatus === "AKTIF" && (
              <button
                onClick={() => handleArchive(bank.id, "BANK_ACCOUNT", bank.bankAccountId)}
                className="text-(--text-secondary) hover:text-rose-500 p-0.5 ml-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {/* HEADER MOBILE */}
      <div className="p-3 bg-(--bg-card) border-b border-(--border-color) shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-sm font-black text-(--text-primary) uppercase tracking-wide">
                Struktur Organisasi
              </h2>
              <span className="text-[10px] text-(--text-secondary) font-bold">
                Holding &gt; Regional &gt; Outlet
              </span>
            </div>
          </div>

          {hasWriteAccess && viewStatus === "AKTIF" && (
            <button
              onClick={() =>
                openCenterModal({
                  title: "TAMBAH PERUSAHAAN BARU",
                  content: (
                    <OrgFormSM
                      modalType="COMPANY"
                      isEditMode={false}
                      initialData={{}}
                      onClose={closeCenterModal}
                    />
                  ),
                })
              }
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm"
            >
              <Plus className="w-4 h-4" /> Perusahaan
            </button>
          )}
        </div>

        {/* TOGGLE STATUS AKTIF / ARSIP */}
        <div className="flex bg-(--bg-input) rounded-lg border border-(--border-color) p-0.5">
          <button
            onClick={() => setViewStatus("AKTIF")}
            className={`flex-1 py-1 text-[10px] font-black rounded text-center ${
              viewStatus === "AKTIF"
                ? "bg-orange-500 text-white shadow-xs"
                : "text-(--text-secondary)"
            }`}
          >
            DATA AKTIF
          </button>
          <button
            onClick={() => setViewStatus("ARSIP")}
            className={`flex-1 py-1 text-[10px] font-black rounded text-center ${
              viewStatus === "ARSIP"
                ? "bg-slate-700 text-white shadow-xs"
                : "text-(--text-secondary)"
            }`}
          >
            ARSIP
          </button>
        </div>
      </div>

      {/* BODY KONTEN HIERARKI TREE (MOBILE ACCORDION CARDS) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {viewStatus === "AKTIF" ? (
          activeCompanies.map((company) => {
            const companyRegions = regions.filter(
              (r) => r.companyId === company.id && r.status === "Aktif",
            );
            const isCompanyOpen = expandedNodes[company.id];

            return (
              <div
                key={company.id}
                className="bg-(--bg-card) border border-(--border-color) rounded-2xl p-3 shadow-xs space-y-2"
              >
                {/* Header Perusahaan */}
                <div className="flex items-start justify-between">
                  <div
                    onClick={() => toggleNode(company.id)}
                    className="flex items-center gap-2 cursor-pointer select-none flex-1"
                  >
                    {isCompanyOpen ? (
                      <ChevronDown className="w-4 h-4 text-orange-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-(--text-secondary)" />
                    )}
                    <div>
                      <div className="font-black text-xs text-(--text-primary) uppercase tracking-wide">
                        {company.name}
                      </div>
                      <span className="text-[9px] font-mono text-(--text-secondary)">
                        {companyRegions.length} Regional
                      </span>
                    </div>
                  </div>

                  {hasWriteAccess && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          openCenterModal({
                            title: "TAMBAH REGIONAL",
                            content: (
                              <OrgFormSM
                                modalType="REGION"
                                isEditMode={false}
                                initialData={{ companyId: company.id }}
                                onClose={closeCenterModal}
                              />
                            ),
                          })
                        }
                        className="px-2 py-1 text-[9px] font-black text-orange-600 bg-orange-100 dark:bg-orange-950/40 rounded"
                      >
                        + Region
                      </button>
                      <button
                        onClick={() =>
                          openCenterModal({
                            title: "EDIT PERUSAHAAN",
                            content: (
                              <OrgFormSM
                                modalType="COMPANY"
                                isEditMode={true}
                                initialData={company}
                                onClose={closeCenterModal}
                              />
                            ),
                          })
                        }
                        className="p-1 text-(--text-secondary) hover:text-orange-500"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleArchive(company.id, "COMPANY")}
                        className="p-1 text-(--text-secondary) hover:text-rose-500"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {isCompanyOpen && (
                  <div className="space-y-3 pt-2 pl-4 border-l-2 border-orange-500/30 ml-2">
                    {/* Toggle Sub Dokumen Company */}
                    <button
                      onClick={() => toggleDocumentNode(company.id)}
                      className="text-[10px] font-bold text-slate-400 flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      {showDocumentNodes[company.id] ? "Tutup Dokumen" : "Lihat Dokumen Legal"}
                    </button>
                    {showDocumentNodes[company.id] && renderDocList(company.id)}

                    {/* Regional Nodes */}
                    {companyRegions.map((region) => {
                      const regionOutlets = outlets.filter(
                        (o) => o.regionId === region.id && o.status === "Aktif",
                      );
                      const isRegionOpen = expandedNodes[region.id];

                      return (
                        <div
                          key={region.id}
                          className="bg-(--bg-input) rounded-xl p-2.5 border border-(--border-color) space-y-2"
                        >
                          <div className="flex items-start justify-between">
                            <div
                              onClick={() => toggleNode(region.id)}
                              className="flex items-center gap-2 cursor-pointer flex-1"
                            >
                              {isRegionOpen ? (
                                <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-(--text-secondary)" />
                              )}
                              <div>
                                <div className="font-bold text-xs text-(--text-primary)">
                                  {region.name}
                                </div>
                                <span className="text-[9px] text-(--text-secondary)">
                                  {regionOutlets.length} Cabang Outlet
                                </span>
                              </div>
                            </div>

                            {hasWriteAccess && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() =>
                                    openCenterModal({
                                      title: "TAMBAH OUTLET",
                                      content: (
                                        <OrgFormSM
                                          modalType="OUTLET"
                                          isEditMode={false}
                                          initialData={{
                                            companyId: company.id,
                                            regionId: region.id,
                                          }}
                                          onClose={closeCenterModal}
                                        />
                                      ),
                                    })
                                  }
                                  className="px-2 py-0.5 text-[9px] font-black text-teal-600 bg-teal-100 dark:bg-teal-950/40 rounded"
                                >
                                  + Outlet
                                </button>
                                <button
                                  onClick={() =>
                                    openCenterModal({
                                      title: "EDIT REGIONAL",
                                      content: (
                                        <OrgFormSM
                                          modalType="REGION"
                                          isEditMode={true}
                                          initialData={region}
                                          onClose={closeCenterModal}
                                        />
                                      ),
                                    })
                                  }
                                  className="p-1 text-(--text-secondary) hover:text-blue-500"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {isRegionOpen && (
                            <div className="space-y-2 pt-1 pl-3 border-l border-blue-500/30">
                              {/* Sub Dokumen & Rekening Regional */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => toggleDocumentNode(region.id)}
                                  className="text-[9px] font-bold text-slate-400 flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" /> Dokumen
                                </button>
                                <button
                                  onClick={() => toggleBankNode(region.id)}
                                  className="text-[9px] font-bold text-emerald-500 flex items-center gap-1"
                                >
                                  <CreditCard className="w-3 h-3" /> Rekening Bank
                                </button>
                              </div>
                              {showDocumentNodes[region.id] && renderDocList(region.id)}
                              {showBankNodes[region.id] && renderBankList(region.id)}

                              {/* Outlet Nodes */}
                              {regionOutlets.map((outlet) => {
                                const isOutletOpen = expandedNodes[outlet.id];
                                return (
                                  <div
                                    key={outlet.id}
                                    className="bg-(--bg-card) p-2 rounded-lg border border-(--border-color) space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div
                                        onClick={() => toggleNode(outlet.id)}
                                        className="flex items-center gap-1.5 cursor-pointer flex-1"
                                      >
                                        <Store className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span className="font-bold text-xs text-(--text-primary)">
                                          {outlet.name}
                                        </span>
                                      </div>

                                      {hasWriteAccess && (
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() =>
                                              openCenterModal({
                                                title: "EDIT OUTLET",
                                                content: (
                                                  <OrgFormSM
                                                    modalType="OUTLET"
                                                    isEditMode={true}
                                                    initialData={outlet}
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
                                            onClick={() => handleArchive(outlet.id, "OUTLET")}
                                            className="p-1 text-(--text-secondary) hover:text-rose-500"
                                          >
                                            <Archive className="w-3 h-3" />
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    {isOutletOpen && (
                                      <div className="space-y-1.5 pt-1">
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => toggleDocumentNode(outlet.id)}
                                            className="text-[9px] font-bold text-slate-400 flex items-center gap-1"
                                          >
                                            <FileText className="w-3 h-3" /> Dokumen
                                          </button>
                                          <button
                                            onClick={() => toggleBankNode(outlet.id)}
                                            className="text-[9px] font-bold text-emerald-500 flex items-center gap-1"
                                          >
                                            <CreditCard className="w-3 h-3" /> Rekening Bank
                                          </button>
                                        </div>
                                        {showDocumentNodes[outlet.id] && renderDocList(outlet.id)}
                                        {showBankNodes[outlet.id] && renderBankList(outlet.id)}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          /* TAB DATA ARSIP */
          <div className="space-y-2">
            <div className="p-4 text-center text-slate-400 text-xs font-bold bg-(--surface-hover) rounded-xl">
              Data organisasi yang diarsipkan dapat dipulihkan melalui menu admin desktop.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
