// File: modules/mdl_item/src/client/ItemPage.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  Package,
  FileDown,
  Scale,
  Clock,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  GitMerge,
  Plus,
  RotateCcw,
  Download,
  Upload,
  FileSpreadsheet,
  Layers,
  ChevronDown,
  Wrench,
  Star,
} from "lucide-react";
import { useItemStore } from "./store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayout";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { ulid } from "ulidx";

// Core Engine I/O
import { ExcelEngine } from "../../../../packages/core_unv/src/io/engines/ExcelEngine";
import {
  downloadTemplateExcel,
  exportExcelItem,
  productExcelSchema,
} from "./features/excel-item";
import { exportPdfItem } from "./features/pdf-item";

function parseSmartNumber(val: any): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim();
  if (str.includes(".") && str.includes(",")) {
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

// Daftar pilihan satuan standar untuk konversi isi kemasan
const CONVERSION_UOM_OPTIONS = [
  { value: "KG", label: "Kilogram (KG)" },
  { value: "GRAM", label: "Gram (GRAM)" },
  { value: "ONS", label: "Ons (100 Gram)" },
  { value: "LITER", label: "Liter (LITER)" },
  { value: "ML", label: "Mililiter (ML)" },
  { value: "PCS", label: "Pieces (PCS)" },
  { value: "BTL", label: "Botol (BTL)" },
  { value: "PORSI", label: "Porsi (PORSI)" },
];

interface ConversionRow {
  id: string;
  value: number | "";
  uom: string;
  isDefault?: boolean;
}

// =========================================================================
// 1. MODAL FORM: PRODUK BARANG & JASA (OTOMASI LOKASI DARI DEVICE ID)
// =========================================================================
const ProductForm: React.FC<{
  isEditMode: boolean;
  isExpenseMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, isExpenseMode, initialData, onClose }) => {
  const { categories, uoms, products } = useItemStore();
  const { companies } = useOrgStore();

  // ---> DETEKSI IDENTITAS PERANGKAT OTOMATIS <---
  const localCompanyId =
    localStorage.getItem("__unv_companyId") || companies[0]?.id || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || null;
  const localOutletId = localStorage.getItem("__unv_outletId") || null;

  const [formData, setFormData] = useState({
    id: initialData?.id || "",
    categoryId: initialData?.categoryId || "",
    uomId: initialData?.uomId || (isExpenseMode ? "UOM_X" : ""),
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
    isExpense: isExpenseMode,
  });

  // State Varian Konversi Isi Kemasan (Multi-UOM)
  const [uomConversions, setUomConversions] = useState<ConversionRow[]>(() => {
    if (
      Array.isArray(initialData?.uomConversions) &&
      initialData.uomConversions.length > 0
    ) {
      return initialData.uomConversions;
    }
    return [];
  });

  const handleAddConversion = () => {
    const newRow: ConversionRow = {
      id: `UOMC_${ulid()}`,
      value: 1,
      uom: "KG",
      isDefault: uomConversions.length === 0,
    };
    setUomConversions((prev) => [...prev, newRow]);
  };

  const handleRemoveConversion = (index: number) => {
    setUomConversions((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length > 0 && !updated.some((r) => r.isDefault)) {
        updated[0].isDefault = true;
      }
      return updated;
    });
  };

  const handleUpdateConversion = (
    index: number,
    field: "value" | "uom",
    val: any,
  ) => {
    setUomConversions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handleSetDefaultConversion = (index: number) => {
    setUomConversions((prev) =>
      prev.map((r, i) => ({
        ...r,
        isDefault: i === index,
      })),
    );
  };

  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [isCustomUom, setIsCustomUom] = useState(false);
  const [customUomName, setCustomUomName] = useState("");

  // Kunci Pricing otomatis mewarisi cabang/wilayah mesin
  const activePricingKey =
    formData.outletId || formData.regionId || formData.companyId || "DEFAULT";

  const [pricingMap, setPricingMap] = useState<Record<string, any>>(
    initialData?.pricing || {},
  );

  const currentPricing = pricingMap[activePricingKey] || {
    basePrice: 0,
    marginPercentage: 0,
    sellingPrice: 0,
  };

  const handlePriceChange = (
    field: "basePrice" | "marginPercentage" | "sellingPrice",
    value: number,
  ) => {
    const newPrice = { ...currentPricing, [field]: value };
    if (isExpenseMode) {
      newPrice.sellingPrice = newPrice.basePrice;
      newPrice.marginPercentage = 0;
    } else {
      if (field === "marginPercentage") {
        newPrice.sellingPrice =
          newPrice.basePrice +
          newPrice.basePrice * (newPrice.marginPercentage / 100);
      } else if (field === "sellingPrice") {
        newPrice.marginPercentage =
          newPrice.basePrice > 0
            ? ((newPrice.sellingPrice - newPrice.basePrice) /
                newPrice.basePrice) *
              100
            : 0;
      } else if (field === "basePrice") {
        if (newPrice.sellingPrice > 0) {
          newPrice.marginPercentage =
            newPrice.basePrice > 0
              ? ((newPrice.sellingPrice - newPrice.basePrice) /
                  newPrice.basePrice) *
                100
              : 0;
        } else {
          newPrice.sellingPrice =
            newPrice.basePrice +
            newPrice.basePrice * (newPrice.marginPercentage / 100);
        }
      }
    }
    setPricingMap({ ...pricingMap, [activePricingKey]: newPrice });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanProductName = formData.name.trim().toUpperCase();
    const isDuplicateProduct = products.some(
      (p) =>
        p.name.trim().toUpperCase() === cleanProductName &&
        (!isEditMode || p.id !== formData.id) &&
        Boolean(p.isExpense) === isExpenseMode &&
        p.status !== "Arsip",
    );
    if (isDuplicateProduct) {
      return sysToast.error(
        "Nama Duplikat",
        `${isExpenseMode ? "Jasa/Biaya" : "Produk"} dengan nama "${cleanProductName}" sudah ada!`,
      );
    }
    try {
      let finalCategoryId = formData.categoryId;
      let finalUomId = formData.uomId;

      // 1. Buat Kategori Baru jika inline (cek apakah sudah ada terlebih dahulu)
      if (isCustomCategory && customCategoryName.trim()) {
        const cleanCat = customCategoryName.toUpperCase().trim();
        const existingCat = categories.find(
          (c) => c.name.toUpperCase().trim() === cleanCat,
        );
        if (existingCat) {
          finalCategoryId = existingCat.id;
        } else {
          finalCategoryId = `CAT_${ulid()}`;
          await globalCommandBus.execute({
            type: "CREATE_CATEGORY",
            payload: {
              id: finalCategoryId,
              name: cleanCat,
            },
          });
        }
      } else if (!finalCategoryId) {
        finalCategoryId = categories[0]?.id || `CAT_${ulid()}`;
        if (categories.length === 0) {
          await globalCommandBus.execute({
            type: "CREATE_CATEGORY",
            payload: {
              id: finalCategoryId,
              name: isExpenseMode ? "BIAYA OPERASIONAL" : "BARANG UMUM",
            },
          });
        }
      }

      // 2. Buat / Ambil UOM
      if (isExpenseMode) {
        const uomX = uoms.find((u) => u.name.toUpperCase() === "X");
        if (uomX) {
          finalUomId = uomX.id;
        } else {
          finalUomId = `UOM_${ulid()}`;
          await globalCommandBus.execute({
            type: "CREATE_UOM",
            payload: { id: finalUomId, name: "X" },
          });
        }
      } else {
        if (isCustomUom && customUomName.trim()) {
          finalUomId = `UOM_${ulid()}`;
          await globalCommandBus.execute({
            type: "CREATE_UOM",
            payload: {
              id: finalUomId,
              name: customUomName.toUpperCase().trim(),
            },
          });
        } else if (!finalUomId) {
          finalUomId = uoms[0]?.id || `UOM_${ulid()}`;
          if (uoms.length === 0) {
            await globalCommandBus.execute({
              type: "CREATE_UOM",
              payload: { id: finalUomId, name: "PCS" },
            });
          }
        }
      }

      // Bersihkan dan format array varian konversi sebelum dikirim
      const cleanConversions = uomConversions
        .filter((c) => Number(c.value) > 0 && c.uom)
        .map((c, i) => ({
          id: c.id || `UOMC_${ulid()}`,
          value: Number(c.value),
          uom: c.uom.toUpperCase().trim(),
          label: `${Number(c.value)} ${c.uom.toUpperCase().trim()}`,
          isDefault: c.isDefault ?? i === 0,
        }));

      if (
        cleanConversions.length > 0 &&
        !cleanConversions.some((c) => c.isDefault)
      ) {
        cleanConversions[0].isDefault = true;
      }

      const isNameChanged = isEditMode && formData.name !== initialData?.name;
      const commandPayload = {
        ...formData,
        categoryId: finalCategoryId,
        uomId: finalUomId,
        isExpense: isExpenseMode,
        pricing: pricingMap,
        uomConversions: cleanConversions, // <--- TERIKUT KE COMMAND PAYLOAD
        nameChanged: isNameChanged,
      };

      await globalCommandBus.execute({
        type: isEditMode ? "UPDATE_PRODUCT" : "CREATE_PRODUCT",
        payload: commandPayload,
      });

      sysToast.success(
        "Sukses",
        `${isExpenseMode ? "Jasa/Biaya" : "Produk"} ${formData.name} berhasil disimpan!`,
      );
      onClose();
    } catch (error: any) {
      sysToast.error("Gagal Menyimpan", error.message);
    }
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full space-y-4">
      <div className="flex-1 space-y-4">
        {/* NAMA ITEM / JASA */}
        <div>
          <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
            NAMA {isExpenseMode ? "JASA / BIAYA OPERASIONAL" : "PRODUK BARANG"}
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value.toUpperCase() })
            }
            required
            autoFocus
            placeholder={
              isExpenseMode
                ? "CONTOH: PAKAN TERNAK / BIAYA SAMPAH / ANGKUT..."
                : "CONTOH: AYAM / BERAS PREMIUM..."
            }
            className="w-full text-sm font-bold p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
          />
        </div>

        {/* KATEGORI & UOM */}
        <div
          className={`grid ${!isExpenseMode ? "grid-cols-2" : "grid-cols-1"} gap-3`}
        >
          <div>
            <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
              KATEGORI
            </label>
            <div className="flex flex-col gap-2">
              <select
                value={isCustomCategory ? "NEW" : formData.categoryId}
                onChange={(e) => {
                  if (e.target.value === "NEW") {
                    setIsCustomCategory(true);
                    setFormData({ ...formData, categoryId: "" });
                  } else {
                    setIsCustomCategory(false);
                    setFormData({ ...formData, categoryId: e.target.value });
                  }
                }}
                required={!isCustomCategory}
                className="w-full text-sm font-bold p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
              >
                <option value="">PILIH KATEGORI</option>
                {categories
                  .filter((c) => c.status === "Aktif")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                <option value="NEW" className="text-orange-600 font-black">
                  + KATEGORI BARU
                </option>
              </select>
              {isCustomCategory && (
                <input
                  type="text"
                  value={customCategoryName}
                  onChange={(e) =>
                    setCustomCategoryName(e.target.value.toUpperCase())
                  }
                  required
                  placeholder="Ketik nama kategori..."
                  autoFocus
                  className="w-full text-sm font-bold p-2.5 bg-(--bg-input) border border-orange-500/40 rounded-lg outline-none text-(--text-primary)"
                />
              )}
            </div>
          </div>

          {!isExpenseMode && (
            <div>
              <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
                SATUAN (UOM)
              </label>
              <div className="flex flex-col gap-2">
                <select
                  value={isCustomUom ? "NEW" : formData.uomId}
                  onChange={(e) => {
                    if (e.target.value === "NEW") {
                      setIsCustomUom(true);
                      setFormData({ ...formData, uomId: "" });
                    } else {
                      setIsCustomUom(false);
                      setFormData({ ...formData, uomId: e.target.value });
                    }
                  }}
                  required={!isCustomUom}
                  className="w-full text-sm font-bold p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
                >
                  <option value="">PILIH UOM</option>
                  {uoms
                    .filter((u) => u.status === "Aktif")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  <option value="NEW" className="text-orange-600 font-black">
                    + UOM BARU
                  </option>
                </select>
                {isCustomUom && (
                  <input
                    type="text"
                    value={customUomName}
                    onChange={(e) =>
                      setCustomUomName(e.target.value.toUpperCase())
                    }
                    required
                    placeholder="Ketik satuan baru..."
                    autoFocus
                    className="w-full text-sm font-bold p-2.5 bg-(--bg-input) border border-orange-500/40 rounded-lg outline-none text-(--text-primary)"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* PANEL VARIAN KONVERSI ISI KEMASAN (MULTI-UOM) */}
        {!isExpenseMode && (
          <div className="bg-(--surface-hover) p-3.5 rounded-xl border border-(--border-color) space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                {/* Ukuran teks judul diubah di sini: text-[11px] → text-[10px] */}
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-wider block">
                  VARIAN KONVERSI ISI (MULTI-UOM)
                </span>
                <span className="text-[9px] text-(--text-secondary)">
                  Misal: 1 Karung = 25 KG atau 5 KG (untuk takaran resep &amp;
                  timbangan dapur)
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddConversion}
                className="px-2.5 py-1 text-[10px] font-black bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> TAMBAH VARIAN
              </button>
            </div>

            {uomConversions.map((conv, idx) => {
              const currentUomName =
                uoms.find((u) => u.id === formData.uomId)?.name || "KEMASAN";

              return (
                <div
                  key={conv.id || idx}
                  className="p-2 bg-(--bg-card) border border-(--border-color) rounded-lg space-y-1.5"
                >
                  {/* Baris pertama: label dan tombol hapus */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-(--text-secondary) whitespace-nowrap">
                      1 {currentUomName}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveConversion(idx)}
                      className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                      title="Hapus varian ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Baris kedua: input, select, tombol default */}
                  <div className="flex items-center gap-1.5">
                    {/* Input angka: lebar tetap w-14 (56px) – bisa diubah ke w-16 jika butuh sedikit lebih lebar */}
                    <input
                      type="number"
                      step="any"
                      min={0.001}
                      required
                      value={conv.value}
                      onChange={(e) =>
                        handleUpdateConversion(
                          idx,
                          "value",
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      placeholder="Nilai"
                      className="w-14 shrink-0 text-xs font-mono font-black text-center p-1.5 bg-(--bg-input) border border-(--border-color) rounded-md text-(--text-primary) outline-none focus:border-orange-500"
                    />
                    {/* Dropdown UOM: flex-1 agar mengambil sisa ruang dan teks tidak terpotong */}
                    <select
                      value={conv.uom}
                      onChange={(e) =>
                        handleUpdateConversion(idx, "uom", e.target.value)
                      }
                      className="flex-1 min-w-0 text-xs font-black p-1.5 bg-(--bg-input) text-orange-500 border border-(--border-color) rounded-md outline-none cursor-pointer"
                    >
                      {CONVERSION_UOM_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleSetDefaultConversion(idx)}
                      className={`p-1.5 rounded-md border transition cursor-pointer ${
                        conv.isDefault
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                          : "text-(--text-secondary) border-(--border-color) hover:text-(--text-primary)"
                      }`}
                      title="Jadikan varian default untuk resep & timbangan"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          conv.isDefault ? "fill-emerald-500" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}

            {uomConversions.length === 0 && (
              <div className="text-[10px] text-(--text-secondary) italic text-center py-2">
                Belum ada varian konversi. Klik "+ TAMBAH VARIAN" jika barang
                ini dibeli per karung/dus/jerigen.
              </div>
            )}
          </div>
        )}

        {/* STRUKTUR HARGA & BIAYA */}
        <div className="bg-orange-500/5 p-3.5 rounded-xl border border-orange-500/20 mt-4">
          <label className="block text-[11px] font-black text-orange-500 mb-3 uppercase tracking-wider">
            {isExpenseMode ? "NOMINAL BIAYA / HPP" : "STRUKTUR HARGA PRODUK"}
          </label>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-black text-(--text-primary) mb-1">
                {isExpenseMode
                  ? "NOMINAL ESTIMASI BIAYA (Rp)"
                  : "HARGA BELI (HPP) (Rp)"}
              </label>
              <input
                type="number"
                value={currentPricing.basePrice || ""}
                onChange={(e) =>
                  handlePriceChange("basePrice", Number(e.target.value))
                }
                data-unv-numpad="true"
                placeholder="0"
                className="w-full text-sm font-black p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500 font-mono"
              />
            </div>

            {!isExpenseMode && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-(--text-primary) mb-1">
                    MARGIN (%)
                  </label>
                  <input
                    type="number"
                    value={currentPricing.marginPercentage || ""}
                    onChange={(e) =>
                      handlePriceChange(
                        "marginPercentage",
                        Number(e.target.value),
                      )
                    }
                    data-unv-numpad="true"
                    placeholder="0"
                    className="w-full text-sm font-black p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-(--text-primary) mb-1">
                    HARGA JUAL (Rp)
                  </label>
                  <input
                    type="number"
                    value={currentPricing.sellingPrice || ""}
                    onChange={(e) =>
                      handlePriceChange("sellingPrice", Number(e.target.value))
                    }
                    data-unv-numpad="true"
                    placeholder="0"
                    className="w-full text-sm font-black p-2.5 bg-(--bg-input) text-emerald-500 border border-(--border-color) rounded-lg outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            )}
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
          className="px-5 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition shadow-md cursor-pointer"
        >
          {isEditMode
            ? "SIMPAN PERUBAHAN"
            : isExpenseMode
              ? "SIMPAN JASA/BIAYA"
              : "SIMPAN PRODUK"}
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 2. MODAL: RINCIAN HARGA MULTI-CABANG
// =========================================================================
const PricingDetailModal: React.FC<{
  item: any;
  onClose: () => void;
}> = ({ item, onClose }) => {
  const { companies, regions, outlets } = useOrgStore();
  const pricingKeys = Object.keys(item.pricing || {});

  const getLocationLabel = (key: string) => {
    if (key === "DEFAULT") return "HARGA STANDAR (DEFAULT)";
    const comp = companies.find((c) => c.id === key);
    if (comp) return `PERUSAHAAN (HOLDING): ${comp.name}`;
    const reg = regions.find((r) => r.id === key);
    if (reg) return `REGIONAL: ${reg.name}`;
    const out = outlets.find((o) => o.id === key);
    if (out) return `OUTLET: ${out.name}`;
    return `LOKASI KHUSUS (${key.substring(0, 10)}...)`;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="border-b border-(--border-color) pb-2">
        <h4 className="font-black text-(--text-primary) text-sm flex items-center gap-2">
          {item.name}{" "}
          {item.isExpense && (
            <span className="text-[9px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded font-black border border-rose-500/20">
              JASA / BIAYA
            </span>
          )}
        </h4>
        <p className="text-xs text-(--text-secondary)">
          Rincian Multi-Tier Pricing antar Cabang
        </p>
      </div>

      <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
        {pricingKeys.map((key) => {
          const p = item.pricing[key];
          return (
            <div
              key={key}
              className="p-3 bg-(--surface-hover) border border-(--border-color) rounded-xl space-y-1"
            >
              <div className="text-[10px] font-black uppercase text-orange-500 tracking-wider">
                {getLocationLabel(key)}
              </div>
              <div
                className={`grid ${item.isExpense ? "grid-cols-1" : "grid-cols-3"} gap-2 text-xs font-bold pt-1`}
              >
                <div>
                  <span className="text-[10px] text-(--text-secondary) block font-normal">
                    {item.isExpense ? "Nominal Biaya (HPP):" : "HPP Beli:"}
                  </span>
                  Rp {(p.basePrice || 0).toLocaleString()}
                </div>
                {!item.isExpense && (
                  <>
                    <div>
                      <span className="text-[10px] text-(--text-secondary) block font-normal">
                        Margin:
                      </span>
                      {(p.marginPercentage || 0).toFixed(1)}%
                    </div>
                    <div>
                      <span className="text-[10px] text-(--text-secondary) block font-normal">
                        Harga Jual:
                      </span>
                      <span className="text-emerald-500 font-black">
                        Rp {(p.sellingPrice || 0).toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-3 border-t border-(--border-color)">
        <button
          onClick={onClose}
          className="px-5 py-2 text-xs font-bold text-(--text-primary) bg-(--surface-hover) rounded-lg cursor-pointer"
        >
          TUTUP
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// 3. KOMPONEN: MERGE MODAL
// =========================================================================
const MergeModal: React.FC<{
  sourceItem: any;
  onClose: () => void;
}> = ({ sourceItem, onClose }) => {
  const { products } = useItemStore();
  const [targetValidateId, setTargetValidateId] = useState("");

  const handleMerge = async () => {
    if (!targetValidateId) return;
    try {
      await globalCommandBus.execute({
        type: "VALIDATE_PRODUCT",
        payload: {
          id: sourceItem.id,
          approvalStatus: "MERGED",
          validateId: targetValidateId,
        },
      });
      sysToast.success("Berhasil", "Item berhasil ditautkan (Merge).");
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  const validTargets = products.filter(
    (p) =>
      p.id !== sourceItem.id &&
      p.approvalStatus === "APPROVED" &&
      Boolean(p.isExpense) === Boolean(sourceItem.isExpense),
  );

  return (
    <div className="p-2">
      <div className="bg-(--surface-hover) p-3 rounded-lg border border-(--border-color) text-sm font-bold mb-4">
        Asal (PENDING):{" "}
        <span className="text-orange-500">{sourceItem.name}</span>
      </div>
      <label className="block text-[11px] font-black text-(--text-secondary) mb-2">
        GABUNGKAN KE ITEM STANDAR (APPROVED):
      </label>
      <select
        value={targetValidateId}
        onChange={(e) => setTargetValidateId(e.target.value)}
        className="w-full text-sm font-bold p-3 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500 mb-6"
      >
        <option value="">-- PILIH ITEM RUJUKAN --</option>
        {validTargets.map((t) => (
          <option key={t.id} value={t.validateId || t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-(--text-secondary) cursor-pointer"
        >
          BATAL
        </button>
        <button
          onClick={handleMerge}
          disabled={!targetValidateId}
          className="px-4 py-2 text-xs font-black text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50 cursor-pointer"
        >
          JALANKAN MERGE
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// 4. FORM KATEGORI & UOM
// =========================================================================
const MasterItemForm: React.FC<{
  type: "CATEGORY" | "UOM";
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ type, isEditMode, initialData, onClose }) => {
  const { categories, uoms } = useItemStore();
  const [name, setName] = useState(initialData?.name || "");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim().toUpperCase();
    if (type === "CATEGORY") {
      const isDup = categories.some(
        (c) =>
          c.name.trim().toUpperCase() === cleanName &&
          (!isEditMode || c.id !== initialData?.id),
      );
      if (isDup)
        return sysToast.error("Duplikat", `Kategori "${cleanName}" sudah ada!`);
    } else {
      const isDup = uoms.some(
        (u) =>
          u.name.trim().toUpperCase() === cleanName &&
          (!isEditMode || u.id !== initialData?.id),
      );
      if (isDup)
        return sysToast.error(
          "Duplikat",
          `Satuan (UOM) "${cleanName}" sudah ada!`,
        );
    }
    try {
      const cmdType =
        type === "CATEGORY"
          ? isEditMode
            ? "UPDATE_CATEGORY"
            : "CREATE_CATEGORY"
          : isEditMode
            ? "UPDATE_UOM"
            : "CREATE_UOM";
      const payload = isEditMode
        ? { id: initialData.id, name: name.toUpperCase() }
        : { name: name.toUpperCase() };

      await globalCommandBus.execute({ type: cmdType, payload });
      sysToast.success("Sukses", `${type} berhasil disimpan!`);
      onClose();
    } catch (error: any) {
      sysToast.error("Gagal Menyimpan", error.message);
    }
  };

  return (
    <form onSubmit={handleSave} className="p-4 space-y-4">
      <div>
        <label className="block text-[11px] font-black text-(--text-secondary) mb-1">
          NAMA {type}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          required
          autoFocus
          className="w-full text-sm font-bold p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
        />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-(--border-color)">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-(--text-secondary) hover:bg-(--surface-hover) rounded-lg cursor-pointer"
        >
          BATAL
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600 shadow-md cursor-pointer"
        >
          SIMPAN
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 5. HALAMAN UTAMA: ITEM PAGE
// =========================================================================
export function ItemPage() {
  const { categories, uoms, products } = useItemStore();
  const { companies, regions, outlets } = useOrgStore();
  const {
    openSideOver,
    closeSideOver,
    openCenterModal,
    closeCenterModal,
    openAlert,
  } = useUniversalModal();

  const [activeTab, setActiveTab] = useState<
    "PRODUK" | "EXPENSE" | "KAT_UOM" | "VALIDATOR"
  >("PRODUK");
  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");
  const [expandedAliases, setExpandedAliases] = useState<
    Record<string, boolean>
  >({});
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deviceScope =
    localStorage.getItem("__unv_deviceScope") ||
    (localStorage.getItem("__unv_outletId") ? "OUTLET" : "COMPANY");
  const canValidate = deviceScope === "COMPANY" || deviceScope === "REGION";

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

  const toggleAlias = (id: string) =>
    setExpandedAliases((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleAction = async (type: string, id: string, payload: any = {}) => {
    try {
      await globalCommandBus.execute({ type, payload: { id, ...payload } });
    } catch (e: any) {
      sysToast.error("Gagal", e.message);
    }
  };

  const confirmArchive = (id: string, name: string) => {
    openAlert({
      title: "Arsipkan Data",
      message: `Anda yakin ingin menghapus/mengarsipkan "${name}"?`,
      confirmText: "YA, ARSIPKAN",
      onConfirm: () => handleAction("ARCHIVE_PRODUCT", id),
    });
  };

  const getPriceDisplay = (
    item: any,
    type: "basePrice" | "marginPercentage" | "sellingPrice",
  ) => {
    if (!item.pricing) return 0;
    const localOutletId = localStorage.getItem("__unv_outletId");
    const localRegionId = localStorage.getItem("__unv_regionId");
    const localCompanyId = localStorage.getItem("__unv_companyId");

    const fallbackKeys = [
      localOutletId,
      localRegionId,
      localCompanyId,
      item.outletId,
      item.regionId,
      item.companyId,
      "DEFAULT",
    ].filter(Boolean);

    for (const key of fallbackKeys) {
      if (item.pricing[key]) return item.pricing[key][type] || 0;
    }
    const firstKey = Object.keys(item.pricing)[0];
    return firstKey ? item.pricing[firstKey][type] || 0 : 0;
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedData = await ExcelEngine.parseFile(file, productExcelSchema);
      if (parsedData.length === 0) {
        throw new Error("File Excel kosong atau format tidak sesuai.");
      }

      const itemState = useItemStore.getState();
      const companyId = localStorage.getItem("__unv_companyId") || "";

      // 1. Inisialisasi Map Pencarian Lokal
      const categoryMap = new Map<string, string>();
      itemState.categories.forEach((c) =>
        categoryMap.set(c.name.trim().toUpperCase(), c.id),
      );

      const uomMap = new Map<string, string>();
      itemState.uoms.forEach((u) =>
        uomMap.set(u.name.trim().toUpperCase(), u.id),
      );

      // Set nama produk untuk cegah duplikasi
      const existingProductNames = new Set(
        itemState.products
          .filter((p) => p.status !== "Arsip" && !p.isExpense)
          .map((p) => p.name.trim().toUpperCase()),
      );

      // 2. Kategori Default Riil (Bukan String Fiktif)
      let defaultCatId = itemState.categories[0]?.id;
      if (!defaultCatId) {
        defaultCatId = `CAT_${ulid()}`;
        await globalCommandBus.execute({
          type: "CREATE_CATEGORY",
          payload: { id: defaultCatId, name: "BARANG UMUM" },
        });
        categoryMap.set("BARANG UMUM", defaultCatId);
      }

      // 3. UOM Default Riil (Bukan String Fiktif)
      let defaultUomId = itemState.uoms[0]?.id;
      if (!defaultUomId) {
        defaultUomId = `UOM_${ulid()}`;
        await globalCommandBus.execute({
          type: "CREATE_UOM",
          payload: { id: defaultUomId, name: "PCS" },
        });
        uomMap.set("PCS", defaultUomId);
      }

      let successCount = 0;
      let skippedCount = 0;

      for (const row of parsedData) {
        if (!row.name) continue;
        const cleanProdName = String(row.name).trim().toUpperCase();

        // Lewati jika produk sudah terdaftar
        if (existingProductNames.has(cleanProdName)) {
          skippedCount++;
          continue;
        }

        // Resolusi Kategori via Map Lokal
        let catId = defaultCatId;
        if (row.categoryName) {
          const cleanCat = String(row.categoryName).trim().toUpperCase();
          if (categoryMap.has(cleanCat)) {
            catId = categoryMap.get(cleanCat)!;
          } else {
            catId = `CAT_${ulid()}`;
            await globalCommandBus.execute({
              type: "CREATE_CATEGORY",
              payload: { id: catId, name: cleanCat },
            });
            categoryMap.set(cleanCat, catId); // Simpan ke map lokal seketika
          }
        }

        // Resolusi UOM via Map Lokal
        let uomId = defaultUomId;
        if (row.uomName) {
          const cleanUom = String(row.uomName).trim().toUpperCase();
          if (uomMap.has(cleanUom)) {
            uomId = uomMap.get(cleanUom)!;
          } else {
            uomId = `UOM_${ulid()}`;
            await globalCommandBus.execute({
              type: "CREATE_UOM",
              payload: { id: uomId, name: cleanUom },
            });
            uomMap.set(cleanUom, uomId); // Simpan ke map lokal seketika
          }
        }

        const basePrice = parseSmartNumber(row.basePrice);
        const marginPercentage = parseSmartNumber(row.marginPercentage);
        const sellingPrice =
          parseSmartNumber(row.sellingPrice) ||
          basePrice + basePrice * (marginPercentage / 100);

        const pricing = {
          DEFAULT: { basePrice, marginPercentage, sellingPrice },
        };

        const convValue = parseSmartNumber(row.conversionValue);
        const convUom = String(row.conversionUom || "")
          .toUpperCase()
          .trim();
        const uomConversions =
          convValue > 0 && convUom
            ? [
                {
                  id: `UOMC_${ulid()}`,
                  value: convValue,
                  uom: convUom,
                  label: `${convValue} ${convUom}`,
                  isDefault: true,
                },
              ]
            : [];

        await globalCommandBus.execute({
          type: "CREATE_PRODUCT",
          payload: {
            name: cleanProdName,
            categoryId: catId,
            uomId: uomId,
            companyId,
            isExpense: false,
            pricing,
            uomConversions,
          },
        });

        existingProductNames.add(cleanProdName);
        successCount++;
      }

      if (successCount > 0) {
        sysToast.success(
          "Import Berhasil",
          `Sukses mengimpor ${successCount} produk.${skippedCount > 0 ? ` (${skippedCount} produk dilewati karena sudah ada)` : ""}`,
        );
      } else if (skippedCount > 0) {
        sysToast.warn(
          "Import Dilewati",
          `Semua (${skippedCount}) produk dalam file sudah terdaftar di sistem.`,
        );
      }
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
      <div className="bg-(--bg-card) border-b border-(--border-color) shrink-0">
        <div className="h-16 px-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-(--text-primary) tracking-tight flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" /> Katalog Master
              Item & Jasa
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* ACTION POPOVER */}
            {(activeTab === "PRODUK" || activeTab === "EXPENSE") &&
              viewStatus === "AKTIF" && (
                <div className="relative" ref={actionMenuRef}>
                  <button
                    onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-black text-(--text-primary) bg-(--bg-card) border border-(--border-color) rounded-lg hover:bg-(--surface-hover) transition shadow-sm cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-orange-500" /> AKSI &
                    DOKUMEN
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isActionMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isActionMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-60 origin-top-right bg-(--bg-card) rounded-xl shadow-2xl border border-(--border-color) py-2 z-50 animate-in fade-in slide-in-from-top-1 zoom-in-95 duration-200">
                      <button
                        onClick={() => {
                          downloadTemplateExcel();
                          setIsActionMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-(--text-primary) hover:bg-(--surface-hover) hover:text-orange-500 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-(--text-secondary)" />{" "}
                        Unduh Template Excel
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-(--text-primary) hover:bg-(--surface-hover) hover:text-emerald-500 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500" />{" "}
                        Import File Excel
                      </button>
                      <div className="h-px bg-(--border-color) my-1"></div>
                      <button
                        onClick={() => {
                          const exportableProducts = products.filter((p) => {
                            const matchExpense =
                              activeTab === "EXPENSE"
                                ? p.isExpense === true
                                : !p.isExpense;
                            return (
                              matchExpense &&
                              p.status === "Aktif" &&
                              p.approvalStatus !== "MERGED"
                            );
                          });
                          exportExcelItem(
                            exportableProducts,
                            categories,
                            uoms,
                            getPriceDisplay,
                          );
                          setIsActionMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-(--text-primary) hover:bg-(--surface-hover) hover:text-orange-500 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-(--text-secondary)" />{" "}
                        Export ke Excel
                      </button>
                      <button
                        onClick={() => {
                          const exportableProducts = products.filter((p) => {
                            const matchExpense =
                              activeTab === "EXPENSE"
                                ? p.isExpense === true
                                : !p.isExpense;
                            return (
                              matchExpense &&
                              p.status === "Aktif" &&
                              p.approvalStatus !== "MERGED"
                            );
                          });
                          const activeCompName =
                            companies[0]?.name || "ALMA ENTERPRISE";
                          exportPdfItem(
                            exportableProducts,
                            categories,
                            uoms,
                            getPriceDisplay,
                            activeCompName,
                            activeTab === "EXPENSE" ? "EXPENSE" : "PRODUK",
                          );
                          setIsActionMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-(--text-primary) hover:bg-(--surface-hover) hover:text-rose-500 flex items-center gap-2.5 transition cursor-pointer"
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

            {/* TOMBOL TAMBAH SESUAI TAB */}
            {activeTab === "PRODUK" && viewStatus === "AKTIF" && (
              <button
                onClick={() =>
                  openSideOver({
                    title: "TAMBAH PRODUK BARU",
                    content: (
                      <ProductForm
                        isEditMode={false}
                        isExpenseMode={false}
                        initialData={{}}
                        onClose={closeSideOver}
                      />
                    ),
                  })
                }
                className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" /> TAMBAH PRODUK
              </button>
            )}

            {activeTab === "EXPENSE" && viewStatus === "AKTIF" && (
              <button
                onClick={() =>
                  openSideOver({
                    title: "TAMBAH JASA / BIAYA OPERASIONAL",
                    content: (
                      <ProductForm
                        isEditMode={false}
                        isExpenseMode={true}
                        initialData={{}}
                        onClose={closeSideOver}
                      />
                    ),
                  })
                }
                className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-rose-500 rounded-lg hover:bg-rose-600 transition shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" /> TAMBAH JASA/BIAYA
              </button>
            )}
          </div>
        </div>

        {/* TABS UTAMA (SEGMENTASI MUTLAK PRODUK VS JASA) */}
        <div className="flex items-center gap-6 px-6">
          <button
            onClick={() => setActiveTab("PRODUK")}
            className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "PRODUK"
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            <Package className="w-4 h-4" /> KATALOG PRODUK BARANG
          </button>

          <button
            onClick={() => setActiveTab("EXPENSE")}
            className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "EXPENSE"
                ? "border-rose-500 text-rose-500"
                : "border-transparent text-(--text-secondary) hover:text-rose-500"
            }`}
          >
            <Wrench className="w-4 h-4" /> JASA & BIAYA OPERASIONAL
          </button>

          <button
            onClick={() => setActiveTab("KAT_UOM")}
            className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all cursor-pointer ${
              activeTab === "KAT_UOM"
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            KATEGORI & UOM
          </button>

          {canValidate && (
            <button
              onClick={() => setActiveTab("VALIDATOR")}
              className={`py-3 text-xs font-black tracking-wide border-b-[3px] transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "VALIDATOR"
                  ? "border-rose-500 text-rose-500"
                  : "border-transparent text-(--text-secondary) hover:text-rose-500"
              }`}
            >
              <Scale className="w-4 h-4" /> PUSAT VALIDASI
            </button>
          )}
        </div>
      </div>

      {/* FILTER STATUS AKTIF / ARSIP */}
      {(activeTab === "PRODUK" || activeTab === "EXPENSE") && (
        <div className="px-6 py-2 bg-(--surface-hover) border-b border-(--border-color) flex items-center gap-4 shrink-0">
          <button
            onClick={() => setViewStatus("AKTIF")}
            className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors cursor-pointer ${
              viewStatus === "AKTIF"
                ? "bg-emerald-500/10 text-emerald-500 font-black"
                : "text-(--text-secondary) hover:bg-(--surface-hover)"
            }`}
          >
            DATA AKTIF
          </button>
          <button
            onClick={() => setViewStatus("ARSIP")}
            className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors cursor-pointer ${
              viewStatus === "ARSIP"
                ? "bg-(--text-primary) text-(--bg-card) font-black"
                : "text-(--text-secondary) hover:bg-(--surface-hover)"
            }`}
          >
            DATA ARSIP
          </button>
        </div>
      )}

      {/* BODY KONTEN TAB */}
      <div className="flex-1 overflow-auto bg-transparent p-6 custom-scrollbar">
        {(activeTab === "PRODUK" || activeTab === "EXPENSE") && (
          <div className="bg-(--bg-card) rounded-lg border border-(--border-color) overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black text-(--text-secondary) tracking-wider">
                  <th className="px-4 py-3">
                    {activeTab === "EXPENSE"
                      ? "Nama Jasa / Biaya"
                      : "Item / Status"}
                  </th>
                  <th className="px-4 py-3">Kategori</th>
                  {activeTab === "PRODUK" && <th className="px-4 py-3">UOM</th>}
                  <th className="px-4 py-3 text-right">
                    {activeTab === "EXPENSE"
                      ? "Nominal Biaya (HPP)"
                      : "Harga Beli"}
                  </th>
                  {activeTab === "PRODUK" && (
                    <th className="px-4 py-3 text-center">Margin %</th>
                  )}
                  {activeTab === "PRODUK" && (
                    <th className="px-4 py-3 text-right">Harga Jual</th>
                  )}
                  <th className="px-4 py-3 text-right w-32">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-color) text-xs font-semibold text-(--text-primary)">
                {products
                  .filter((p) => {
                    const matchExpense =
                      activeTab === "EXPENSE"
                        ? p.isExpense === true
                        : !p.isExpense;
                    const matchStatus =
                      viewStatus === "AKTIF"
                        ? p.status === "Aktif"
                        : p.status === "Arsip";
                    return (
                      matchExpense &&
                      matchStatus &&
                      p.approvalStatus !== "MERGED"
                    );
                  })
                  .map((p) => {
                    const uomName =
                      uoms.find((u) => u.id === p.uomId)?.name || "N/A";
                    const catName =
                      categories.find((c) => c.id === p.categoryId)?.name ||
                      "-";
                    const isPending = p.approvalStatus === "PENDING";
                    const isRejected = p.approvalStatus === "REJECTED";
                    const base = getPriceDisplay(p, "basePrice");
                    const margin = getPriceDisplay(p, "marginPercentage");
                    const sell = getPriceDisplay(p, "sellingPrice");

                    const aliases = products.filter(
                      (a) =>
                        a.approvalStatus === "MERGED" &&
                        a.validateId === (p.validateId || p.id) &&
                        a.status === p.status,
                    );

                    return (
                      <React.Fragment key={p.id}>
                        <tr className="hover:bg-(--surface-hover) transition">
                          <td className="px-4 py-3">
                            <div className="font-bold text-(--text-primary) flex items-center gap-2">
                              {p.name}
                              {/* BADGE VARIAN KONVERSI ISI */}
                              {Array.isArray(p.uomConversions) &&
                                p.uomConversions.length > 0 && (
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {p.uomConversions.map(
                                      (conv: any, i: number) => (
                                        <span
                                          key={i}
                                          className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-black border ${
                                            conv.isDefault
                                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                              : "bg-(--surface-hover) text-(--text-secondary) border-(--border-color)"
                                          }`}
                                          title={
                                            conv.isDefault
                                              ? "Varian Default"
                                              : "Varian Tambahan"
                                          }
                                        >
                                          {conv.value} {conv.uom}
                                          {conv.isDefault && " ★"}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                )}
                              {aliases.length > 0 && (
                                <button
                                  onClick={() => toggleAlias(p.id)}
                                  className="text-[10px] bg-(--surface-hover) text-(--text-secondary) px-1.5 py-0.5 rounded hover:bg-(--border-color) transition cursor-pointer"
                                >
                                  {expandedAliases[p.id]
                                    ? "Tutup Alias"
                                    : `+${aliases.length} Alias`}
                                </button>
                              )}
                            </div>
                            <div className="flex gap-1 mt-1">
                              {isPending && (
                                <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
                                  PENDING
                                </span>
                              )}
                              {isRejected && (
                                <span className="text-[9px] bg-rose-500/10 text-rose-500 border border-rose-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
                                  REJECTED
                                </span>
                              )}
                              {p.approvalStatus === "APPROVED" && (
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
                                  APPROVED
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-(--text-secondary)">
                            {catName}
                          </td>
                          {activeTab === "PRODUK" && (
                            <td className="px-4 py-3">{uomName}</td>
                          )}
                          <td className="px-4 py-3 text-right font-mono font-bold text-rose-500">
                            Rp {base.toLocaleString()}
                          </td>
                          {activeTab === "PRODUK" && (
                            <td className="px-4 py-3 text-center font-mono">
                              {margin.toFixed(1)}%
                            </td>
                          )}
                          {activeTab === "PRODUK" && (
                            <td className="px-4 py-3 text-right font-mono text-emerald-500 font-bold">
                              Rp {sell.toLocaleString()}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right space-x-1">
                            {viewStatus === "AKTIF" ? (
                              <>
                                <button
                                  onClick={() =>
                                    openCenterModal({
                                      title: "RINCIAN HARGA MULTI-CABANG",
                                      content: (
                                        <PricingDetailModal
                                          item={p}
                                          onClose={closeCenterModal}
                                        />
                                      ),
                                    })
                                  }
                                  className="p-1.5 text-(--text-secondary) hover:text-blue-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                                  title="Lihat Rincian Harga Multi-Lokasi"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    openSideOver({
                                      title: `EDIT ${p.isExpense ? "JASA / BIAYA" : "PRODUK"}`,
                                      content: (
                                        <ProductForm
                                          isEditMode={true}
                                          isExpenseMode={Boolean(p.isExpense)}
                                          initialData={p}
                                          onClose={closeSideOver}
                                        />
                                      ),
                                    })
                                  }
                                  className="p-1.5 text-(--text-secondary) hover:text-orange-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                                  title="Edit Item"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => confirmArchive(p.id, p.name)}
                                  className="p-1.5 text-(--text-secondary) hover:text-rose-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                                  title="Arsipkan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() =>
                                  handleAction("RESTORE_PRODUCT", p.id)
                                }
                                disabled={isRejected}
                                className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded flex items-center gap-1 disabled:opacity-50 cursor-pointer border border-emerald-500/20"
                              >
                                <RotateCcw className="w-3 h-3" /> RESTORE
                              </button>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: KATEGORI & UOM */}
        {activeTab === "KAT_UOM" && (
          <div className="grid grid-cols-2 gap-6 h-full">
            <div className="bg-(--bg-card) rounded-lg border border-(--border-color) flex flex-col shadow-xs">
              <div className="px-4 py-3 bg-(--surface-hover) border-b border-(--border-color) flex items-center justify-between font-black text-sm text-(--text-primary)">
                MASTER KATEGORI
                <button
                  onClick={() =>
                    openCenterModal({
                      title: "TAMBAH KATEGORI BARU",
                      content: (
                        <MasterItemForm
                          type="CATEGORY"
                          isEditMode={false}
                          initialData={{}}
                          onClose={closeCenterModal}
                        />
                      ),
                    })
                  }
                  className="text-[10px] bg-orange-500 text-white px-2.5 py-1 rounded-md hover:bg-orange-600 cursor-pointer font-black"
                >
                  + TAMBAH
                </button>
              </div>
              <div className="p-4 flex-1 overflow-auto custom-scrollbar">
                <ul className="space-y-2 text-sm font-bold text-(--text-primary)">
                  {categories
                    .filter((c) => c.status === "Aktif")
                    .map((c) => (
                      <li
                        key={c.id}
                        className="p-3 border border-(--border-color) rounded-lg bg-(--surface-hover) flex justify-between items-center group"
                      >
                        {c.name}
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() =>
                              openCenterModal({
                                title: "EDIT KATEGORI",
                                content: (
                                  <MasterItemForm
                                    type="CATEGORY"
                                    isEditMode={true}
                                    initialData={c}
                                    onClose={closeCenterModal}
                                  />
                                ),
                              })
                            }
                            className="text-blue-500 hover:text-blue-600 cursor-pointer p-1"
                            title="Edit Kategori"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              openAlert({
                                title: "Arsipkan Kategori",
                                message: `Arsipkan kategori "${c.name}"?`,
                                confirmText: "YA, ARSIPKAN",
                                onConfirm: () =>
                                  globalCommandBus.execute({
                                    type: "ARCHIVE_CATEGORY",
                                    payload: { id: c.id },
                                  }),
                              })
                            }
                            className="text-rose-500 hover:text-rose-600 cursor-pointer p-1"
                            title="Arsipkan Kategori"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            </div>

            <div className="bg-(--bg-card) rounded-lg border border-(--border-color) flex flex-col shadow-xs">
              <div className="px-4 py-3 bg-(--surface-hover) border-b border-(--border-color) flex items-center justify-between font-black text-sm text-(--text-primary)">
                MASTER UOM (SATUAN BARANG)
                <button
                  onClick={() =>
                    openCenterModal({
                      title: "TAMBAH UOM BARU",
                      content: (
                        <MasterItemForm
                          type="UOM"
                          isEditMode={false}
                          initialData={{}}
                          onClose={closeCenterModal}
                        />
                      ),
                    })
                  }
                  className="text-[10px] bg-orange-500 text-white px-2.5 py-1 rounded-md hover:bg-orange-600 cursor-pointer font-black"
                >
                  + TAMBAH
                </button>
              </div>
              <div className="p-4 flex-1 overflow-auto custom-scrollbar">
                <ul className="space-y-2 text-sm font-bold text-(--text-primary)">
                  {uoms
                    .filter((u) => u.status === "Aktif")
                    .map((u) => (
                      <li
                        key={u.id}
                        className="p-3 border border-(--border-color) rounded-lg bg-(--surface-hover) flex justify-between items-center group"
                      >
                        {u.name}
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() =>
                              openCenterModal({
                                title: "EDIT UOM",
                                content: (
                                  <MasterItemForm
                                    type="UOM"
                                    isEditMode={true}
                                    initialData={u}
                                    onClose={closeCenterModal}
                                  />
                                ),
                              })
                            }
                            className="text-blue-500 hover:text-blue-600 cursor-pointer p-1"
                            title="Edit UOM"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              openAlert({
                                title: "Arsipkan UOM",
                                message: `Arsipkan satuan "${u.name}"?`,
                                confirmText: "YA, ARSIPKAN",
                                onConfirm: () =>
                                  globalCommandBus.execute({
                                    type: "ARCHIVE_UOM",
                                    payload: { id: u.id },
                                  }),
                              })
                            }
                            className="text-rose-500 hover:text-rose-600 cursor-pointer p-1"
                            title="Arsipkan UOM"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PUSAT VALIDASI */}
        {activeTab === "VALIDATOR" && canValidate && (
          <div className="bg-(--bg-card) rounded-lg border border-(--border-color) overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-500 font-bold text-xs flex items-center gap-2">
              <Scale className="w-4 h-4" /> ANTREAN VALIDASI DATA DARI CABANG
              (STATUS: PENDING)
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black text-(--text-secondary) tracking-wider">
                  <th className="px-4 py-3">Nama Input (Raw)</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">Asal Usul Input</th>
                  <th className="px-4 py-3 text-right">Keputusan Pusat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-color) text-xs font-semibold text-(--text-primary)">
                {products
                  .filter(
                    (p) =>
                      p.approvalStatus === "PENDING" && p.status === "Aktif",
                  )
                  .map((p) => {
                    const comp = companies.find((c) => c.id === p.companyId);
                    const reg = regions.find((r) => r.id === p.regionId);
                    const out = outlets.find((o) => o.id === p.outletId);

                    let locationTag = {
                      badge: "HOLDING",
                      primary: comp?.name || "PUSAT",
                      secondary: "Level Perusahaan",
                    };
                    if (out) {
                      locationTag = {
                        badge: "OUTLET",
                        primary: out.name,
                        secondary: reg ? `Reg: ${reg.name}` : "Cabang Outlet",
                      };
                    } else if (reg) {
                      locationTag = {
                        badge: "REGION",
                        primary: reg.name,
                        secondary: "Central Hub / Gudang",
                      };
                    }

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-(--surface-hover) transition"
                      >
                        <td className="px-4 py-3 font-bold text-orange-500">
                          {p.name}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 text-[9px] font-black rounded uppercase ${p.isExpense ? "bg-rose-500/10 text-rose-500" : "bg-blue-500/10 text-blue-500"}`}
                          >
                            {p.isExpense ? "JASA / BIAYA" : "BARANG"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="font-bold text-(--text-primary) flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-black rounded ${
                                locationTag.badge === "OUTLET"
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                  : locationTag.badge === "REGION"
                                    ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                                    : "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                              }`}
                            >
                              {locationTag.badge}
                            </span>
                            {locationTag.primary}
                          </div>
                          <div className="text-[10px] text-(--text-secondary) font-medium mt-0.5">
                            {locationTag.secondary}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() =>
                              openAlert({
                                title: "Setujui Nama Baru",
                                message: `Jadikan "${p.name}" sebagai standar baku yang baru?`,
                                confirmText: "YA, APPROVED",
                                onConfirm: () =>
                                  handleAction("VALIDATE_PRODUCT", p.id, {
                                    approvalStatus: "APPROVED",
                                    validateId: p.validateId || p.id,
                                  }),
                              })
                            }
                            className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-md shadow-xs hover:bg-emerald-500/20 border border-emerald-500/20 inline-flex items-center gap-1 font-bold text-[11px] cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() =>
                              openCenterModal({
                                title: "MERGE ALIAS PRODUK",
                                content: (
                                  <MergeModal
                                    sourceItem={p}
                                    onClose={closeCenterModal}
                                  />
                                ),
                              })
                            }
                            className="px-2.5 py-1.5 bg-blue-500/10 text-blue-500 rounded-md shadow-xs hover:bg-blue-500/20 border border-blue-500/20 inline-flex items-center gap-1 font-bold text-[11px] cursor-pointer"
                          >
                            <GitMerge className="w-3.5 h-3.5" /> Merge
                          </button>
                          <button
                            onClick={() =>
                              openAlert({
                                title: "Tolak Data",
                                message: `Tolak pengajuan "${p.name}"? Data akan dikunci.`,
                                confirmText: "YA, REJECT",
                                onConfirm: () =>
                                  handleAction("VALIDATE_PRODUCT", p.id, {
                                    approvalStatus: "REJECTED",
                                  }),
                              })
                            }
                            className="px-2.5 py-1.5 bg-rose-500/10 text-rose-500 rounded-md shadow-xs hover:bg-rose-500/20 border border-rose-500/20 inline-flex items-center gap-1 font-bold text-[11px] cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
