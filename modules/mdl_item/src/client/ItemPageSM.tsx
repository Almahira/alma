// File: modules/mdl_item/src/client/ItemPageSM.tsx
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useDeferredValue,
} from "react";
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
  ChevronLeft,
  ChevronRight,
  Wrench,
  Star,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { useItemStore } from "./store";
import { RuntimeSession } from "../../../../packages/core_unv/src/config/session";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayoutSM";
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

// =========================================================================
// KONSTANTA GLOBAL
// =========================================================================
const PAGE_SIZE = 30;

type SortKey = "NAME_ASC" | "NAME_DESC" | "PRICE_ASC" | "PRICE_DESC" | "NEWEST";

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
// [BARU] PAGINASI MOBILE (compact)
// =========================================================================
const PaginationSM: React.FC<{
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}> = ({ page, totalPages, totalItems, pageSize, onPageChange }) => {
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-3 bg-(--surface-hover) border border-(--border-color) rounded-xl">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-(--border-color) bg-(--bg-card) text-(--text-primary) text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Halaman sebelumnya"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Prev
      </button>

      <div className="text-[10px] font-bold text-(--text-secondary) text-center leading-tight">
        <div>
          Hal <span className="text-(--text-primary)">{page}</span> /{" "}
          <span className="text-(--text-primary)">{totalPages}</span>
        </div>
        <div className="text-[9px] font-normal">
          {start}–{end} dari {totalItems}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-(--border-color) bg-(--bg-card) text-(--text-primary) text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Halaman berikutnya"
      >
        Next <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// =========================================================================
// 1. MODAL FORM: PRODUK BARANG & JASA
// =========================================================================
const ProductForm: React.FC<{
  isEditMode: boolean;
  isExpenseMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, isExpenseMode, initialData, onClose }) => {
  const { categories, uoms, products } = useItemStore();
  const { companies } = useOrgStore();

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
            payload: { id: finalCategoryId, name: cleanCat },
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
        uomConversions: cleanConversions,
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
      <div className="flex-1 space-y-4 px-1">
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

        <div className="grid grid-cols-1 gap-3">
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

        {!isExpenseMode && (
          <div className="bg-(--surface-hover) p-3.5 rounded-xl border border-(--border-color) space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-orange-500 uppercase tracking-wider block">
                  VARIAN KONVERSI ISI (MULTI-UOM)
                </span>
                <span className="text-[9px] text-(--text-secondary)">
                  Misal: 1 Karung = 25 KG atau 5 KG
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddConversion}
                className="px-2.5 py-1 text-[10px] font-black bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> TAMBAH
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
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-(--text-secondary)">
                      1 {currentUomName}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveConversion(idx)}
                      className="text-slate-400 hover:text-rose-500 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
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
                    <select
                      value={conv.uom}
                      onChange={(e) =>
                        handleUpdateConversion(idx, "uom", e.target.value)
                      }
                      className="flex-1 min-w-0 text-xs font-black p-1.5 bg-(--bg-input) text-orange-500 border border-(--border-color) rounded-md outline-none"
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
                      className={`p-1.5 rounded-md border ${
                        conv.isDefault
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                          : "text-(--text-secondary) border-(--border-color)"
                      }`}
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
                Belum ada varian konversi.
              </div>
            )}
          </div>
        )}

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
          className="px-5 py-2 text-xs font-bold text-(--text-secondary) hover:bg-(--surface-hover) rounded-lg"
        >
          BATAL
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600"
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

  // O(1) lookup untuk label lokasi
  const companyMap = useMemo(() => {
    const m = new Map<string, any>();
    companies.forEach((c: any) => m.set(c.id, c));
    return m;
  }, [companies]);
  const regionMap = useMemo(() => {
    const m = new Map<string, any>();
    regions.forEach((r: any) => m.set(r.id, r));
    return m;
  }, [regions]);
  const outletMap = useMemo(() => {
    const m = new Map<string, any>();
    outlets.forEach((o: any) => m.set(o.id, o));
    return m;
  }, [outlets]);

  const getLocationLabel = (key: string) => {
    if (key === "DEFAULT") return "HARGA STANDAR (DEFAULT)";
    const comp = companyMap.get(key);
    if (comp) return `PERUSAHAAN (HOLDING): ${comp.name}`;
    const reg = regionMap.get(key);
    if (reg) return `REGIONAL: ${reg.name}`;
    const out = outletMap.get(key);
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

      <div className="space-y-3 max-h-72 overflow-y-auto">
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
          className="px-5 py-2 text-xs font-bold text-(--text-primary) bg-(--surface-hover) rounded-lg"
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
          className="px-4 py-2 text-xs font-bold text-(--text-secondary)"
        >
          BATAL
        </button>
        <button
          onClick={handleMerge}
          disabled={!targetValidateId}
          className="px-4 py-2 text-xs font-black text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50"
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
          className="px-4 py-2 text-xs font-bold text-(--text-secondary) hover:bg-(--surface-hover) rounded-lg"
        >
          BATAL
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-black text-white bg-orange-500 rounded-lg hover:bg-orange-600"
        >
          SIMPAN
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 5. HALAMAN UTAMA: ITEM PAGE MOBILE
// =========================================================================
export function ItemPageSM() {
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

  // === [BARU] TOOLKIT STATE: SEARCH + SORT + PAGINATION ===
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("NAME_ASC");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(searchQuery);

  // === [STATE BATCH VALIDASI] ===
  const [selectedValidateIds, setSelectedValidateIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const MAX_BATCH_LIMIT = 30; // Batas aman event ledger per eksekusi

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

  // =====================================================================
  // [BARU] PRE-COMPUTED HASH MAPS O(1)
  // =====================================================================
  const categoryMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c: any) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  const uomMap = useMemo(() => {
    const m = new Map<string, string>();
    uoms.forEach((u: any) => m.set(u.id, u.name));
    return m;
  }, [uoms]);

  const companyMap = useMemo(() => {
    const m = new Map<string, any>();
    companies.forEach((c: any) => m.set(c.id, c));
    return m;
  }, [companies]);

  const regionMap = useMemo(() => {
    const m = new Map<string, any>();
    regions.forEach((r: any) => m.set(r.id, r));
    return m;
  }, [regions]);

  const outletMap = useMemo(() => {
    const m = new Map<string, any>();
    outlets.forEach((o: any) => m.set(o.id, o));
    return m;
  }, [outlets]);

  // Alias MERGED dikelompokkan sekali (satu putaran O(M))
  const aliasMap = useMemo(() => {
    const m = new Map<string, any[]>();
    products.forEach((a: any) => {
      if (a.approvalStatus === "MERGED" && a.validateId) {
        if (!m.has(a.validateId)) m.set(a.validateId, []);
        m.get(a.validateId)!.push(a);
      }
    });
    return m;
  }, [products]);

  const toggleAlias = useCallback(
    (id: string) =>
      setExpandedAliases((prev) => ({ ...prev, [id]: !prev[id] })),
    [],
  );

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

  const getPriceDisplay = useCallback(
    (item: any, type: "basePrice" | "marginPercentage" | "sellingPrice") => {
      if (!item.pricing) return 0;
      const fallbackKeys = [
        RuntimeSession.outletId,
        RuntimeSession.regionId,
        RuntimeSession.companyId,
        item.outletId,
        item.regionId,
        item.companyId,
        "DEFAULT",
      ].filter(Boolean) as string[];

      for (const key of fallbackKeys) {
        if (item.pricing[key]) return item.pricing[key][type] || 0;
      }
      const firstKey = Object.keys(item.pricing)[0];
      return firstKey ? item.pricing[firstKey][type] || 0 : 0;
    },
    [],
  );

  // =====================================================================
  // [BARU] FILTER + SEARCH + SORT — single pass, tanpa nested .find()
  // =====================================================================
  const filteredCatalog = useMemo(() => {
    const localCompanyId = localStorage.getItem("__unv_companyId") || "";
    const localRegionId = localStorage.getItem("__unv_regionId") || "";
    const localOutletId = localStorage.getItem("__unv_outletId") || "";
    const q = deferredSearch.trim().toLowerCase();

    const list = products.filter((p: any) => {
      const matchExpense =
        activeTab === "EXPENSE" ? p.isExpense === true : !p.isExpense;

      const isProdActive =
        p.status !== undefined
          ? p.status === "Aktif"
          : p.isActive !== undefined
            ? Boolean(p.isActive)
            : Boolean(p.is_active);
      const matchStatus = viewStatus === "AKTIF" ? isProdActive : !isProdActive;

      if (!matchExpense || !matchStatus || p.approvalStatus === "MERGED") {
        return false;
      }

      if (localCompanyId && p.companyId && p.companyId !== localCompanyId) {
        return false;
      }

      if (p.approvalStatus === "APPROVED") {
        if (p.regionId && localRegionId && p.regionId !== localRegionId)
          return false;
        if (localOutletId && p.outletId && p.outletId !== localOutletId)
          return false;
      } else if (p.approvalStatus === "PENDING") {
        if (localOutletId) {
          if (p.outletId && p.outletId !== localOutletId) return false;
        } else if (localRegionId) {
          if (p.regionId && p.regionId !== localRegionId) return false;
        }
      }

      if (q) {
        const catName = categoryMap.get(p.categoryId) || "";
        const uomName = uomMap.get(p.uomId) || "";
        const hay =
          `${p.name || ""} ${p.sku || ""} ${p.validateId || ""} ${catName} ${uomName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    return [...list].sort((a: any, b: any) => {
      switch (sortBy) {
        case "NAME_ASC":
          return (a.name || "").localeCompare(b.name || "");
        case "NAME_DESC":
          return (b.name || "").localeCompare(a.name || "");
        case "PRICE_ASC":
          return (
            getPriceDisplay(a, "basePrice") - getPriceDisplay(b, "basePrice")
          );
        case "PRICE_DESC":
          return (
            getPriceDisplay(b, "basePrice") - getPriceDisplay(a, "basePrice")
          );
        case "NEWEST": {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        }
        default:
          return 0;
      }
    });
  }, [
    products,
    activeTab,
    viewStatus,
    deferredSearch,
    sortBy,
    categoryMap,
    uomMap,
    getPriceDisplay,
  ]);

  const filteredValidator = useMemo(() => {
    if (activeTab !== "VALIDATOR") return [];
    const localCompanyId = localStorage.getItem("__unv_companyId") || "";
    const localRegionId = localStorage.getItem("__unv_regionId") || "";
    const q = deferredSearch.trim().toLowerCase();

    const list = products.filter((p: any) => {
      const isProdActive =
        p.status !== undefined
          ? p.status === "Aktif"
          : p.isActive !== undefined
            ? Boolean(p.isActive)
            : Boolean(p.is_active);
      if (p.approvalStatus !== "PENDING" || !isProdActive) return false;

      if (localCompanyId && p.companyId && p.companyId !== localCompanyId)
        return false;
      if (localRegionId && p.regionId && p.regionId !== localRegionId)
        return false;

      if (q) {
        const catName = categoryMap.get(p.categoryId) || "";
        const uomName = uomMap.get(p.uomId) || "";
        const hay =
          `${p.name || ""} ${p.sku || ""} ${catName} ${uomName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    return [...list].sort((a: any, b: any) => {
      switch (sortBy) {
        case "NAME_DESC":
          return (b.name || "").localeCompare(a.name || "");
        case "PRICE_DESC":
          return (
            getPriceDisplay(b, "basePrice") - getPriceDisplay(a, "basePrice")
          );
        case "PRICE_ASC":
          return (
            getPriceDisplay(a, "basePrice") - getPriceDisplay(b, "basePrice")
          );
        case "NEWEST": {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        }
        case "NAME_ASC":
        default:
          return (a.name || "").localeCompare(b.name || "");
      }
    });
  }, [
    activeTab,
    products,
    deferredSearch,
    sortBy,
    categoryMap,
    uomMap,
    getPriceDisplay,
  ]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, sortBy, activeTab, viewStatus]);

  // PAGINATION
  const activeList =
    activeTab === "VALIDATOR" ? filteredValidator : filteredCatalog;

  const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const paginatedList = useMemo(
    () => activeList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [activeList, safePage],
  );

  // === [HELPER & HANDLER BATCH VALIDASI] ===
  // Reset seleksi jika tab, halaman, atau kata kunci pencarian berubah
  useEffect(() => {
    setSelectedValidateIds([]);
  }, [activeTab, page, deferredSearch]);

  // Cek apakah seluruh baris di halaman aktif sudah tercentang
  const isAllPageSelected = useMemo(() => {
    if (activeTab !== "VALIDATOR" || paginatedList.length === 0) return false;
    return paginatedList.every((p: any) => selectedValidateIds.includes(p.id));
  }, [activeTab, paginatedList, selectedValidateIds]);

  // Cek kondisi indeterminate (sebagian tercentang)
  const isSomePageSelected = useMemo(() => {
    if (activeTab !== "VALIDATOR") return false;
    return (
      paginatedList.some((p: any) => selectedValidateIds.includes(p.id)) &&
      !isAllPageSelected
    );
  }, [activeTab, paginatedList, selectedValidateIds, isAllPageSelected]);

  // Centang / Batal centang satu item
  const toggleSelectOne = (id: string) => {
    setSelectedValidateIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= MAX_BATCH_LIMIT) {
        sysToast.warn(
          "Batas Maksimal",
          `Maksimal ${MAX_BATCH_LIMIT} item per batch untuk menjaga kestabilan sistem.`,
        );
        return prev;
      }
      return [...prev, id];
    });
  };

  // Centang / Batal centang semua di halaman aktif
  const toggleSelectAll = () => {
    if (isAllPageSelected) {
      const pageIds = new Set(paginatedList.map((p: any) => p.id));
      setSelectedValidateIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const pageIds = paginatedList.map((p: any) => p.id);
      const combined = Array.from(
        new Set([...selectedValidateIds, ...pageIds]),
      );
      if (combined.length > MAX_BATCH_LIMIT) {
        sysToast.warn(
          "Dibatasi ke Halaman Aktif",
          `Maksimal ${MAX_BATCH_LIMIT} item terpilih per batch.`,
        );
        setSelectedValidateIds(combined.slice(0, MAX_BATCH_LIMIT));
      } else {
        setSelectedValidateIds(combined);
      }
    }
  };

  // Eksekutor Batch dengan proteksi beban Ledger
  const handleBatchValidate = (status: "APPROVED" | "REJECTED") => {
    const count = selectedValidateIds.length;
    if (count === 0) return;

    const isApprove = status === "APPROVED";
    openAlert({
      title: isApprove
        ? `Setujui ${count} Item Massal`
        : `Tolak ${count} Item Massal`,
      message: isApprove
        ? `Setujui ${count} produk terpilih sekaligus sebagai standar baku?`
        : `Tolak ${count} produk terpilih? Status data akan dikunci.`,
      confirmText: isApprove ? "YA, SETUJUI" : "YA, TOLAK",
      onConfirm: async () => {
        setIsBatchProcessing(true);
        try {
          let successCount = 0;
          for (const id of selectedValidateIds) {
            const item = products.find((p) => p.id === id);
            await globalCommandBus.execute({
              type: "VALIDATE_PRODUCT",
              payload: {
                id,
                approvalStatus: status,
                validateId: isApprove ? item?.validateId || id : null,
              },
            });
            successCount++;
            // Jeda mikro 15ms antar event agar main-thread browser tidak beku
            await new Promise((resolve) => setTimeout(resolve, 15));
          }
          sysToast.success(
            "Validasi Selesai",
            `Sukses memproses ${successCount} item (${status}).`,
          );
          setSelectedValidateIds([]);
        } catch (err: any) {
          sysToast.error("Gagal Validasi Batch", err.message);
        } finally {
          setIsBatchProcessing(false);
        }
      },
    });
  };

  // =====================================================================
  // IMPORT EXCEL
  // =====================================================================
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

      const catMapLocal = new Map<string, string>();
      itemState.categories.forEach((c) =>
        catMapLocal.set(c.name.trim().toUpperCase(), c.id),
      );

      const uomMapLocal = new Map<string, string>();
      itemState.uoms.forEach((u) =>
        uomMapLocal.set(u.name.trim().toUpperCase(), u.id),
      );

      const existingProductNames = new Set(
        itemState.products
          .filter((p) => p.status !== "Arsip" && !p.isExpense)
          .map((p) => p.name.trim().toUpperCase()),
      );

      let defaultCatId = itemState.categories[0]?.id;
      if (!defaultCatId) {
        defaultCatId = `CAT_${ulid()}`;
        await globalCommandBus.execute({
          type: "CREATE_CATEGORY",
          payload: { id: defaultCatId, name: "BARANG UMUM" },
        });
        catMapLocal.set("BARANG UMUM", defaultCatId);
      }

      let defaultUomId = itemState.uoms[0]?.id;
      if (!defaultUomId) {
        defaultUomId = `UOM_${ulid()}`;
        await globalCommandBus.execute({
          type: "CREATE_UOM",
          payload: { id: defaultUomId, name: "PCS" },
        });
        uomMapLocal.set("PCS", defaultUomId);
      }

      let successCount = 0;
      let skippedCount = 0;

      for (const row of parsedData) {
        if (!row.name) continue;
        const cleanProdName = String(row.name).trim().toUpperCase();

        if (existingProductNames.has(cleanProdName)) {
          skippedCount++;
          continue;
        }

        let catId = defaultCatId;
        if (row.categoryName) {
          const cleanCat = String(row.categoryName).trim().toUpperCase();
          if (catMapLocal.has(cleanCat)) {
            catId = catMapLocal.get(cleanCat)!;
          } else {
            catId = `CAT_${ulid()}`;
            await globalCommandBus.execute({
              type: "CREATE_CATEGORY",
              payload: { id: catId, name: cleanCat },
            });
            catMapLocal.set(cleanCat, catId);
          }
        }

        let uomId = defaultUomId;
        if (row.uomName) {
          const cleanUom = String(row.uomName).trim().toUpperCase();
          if (uomMapLocal.has(cleanUom)) {
            uomId = uomMapLocal.get(cleanUom)!;
          } else {
            uomId = `UOM_${ulid()}`;
            await globalCommandBus.execute({
              type: "CREATE_UOM",
              payload: { id: uomId, name: cleanUom },
            });
            uomMapLocal.set(cleanUom, uomId);
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

  const showToolbar =
    activeTab === "PRODUK" ||
    activeTab === "EXPENSE" ||
    activeTab === "VALIDATOR";

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card) rounded-xl shadow-sm border border-(--border-color)">
      {/* HEADER MOBILE */}
      <div className="bg-(--bg-card) border-b border-(--border-color) shrink-0">
        <div className="p-3 flex items-center justify-between">
          <h2 className="text-base font-black text-(--text-primary) flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-500" /> Katalog Item & Jasa
          </h2>
        </div>

        {/* TABS SCROLL HORIZONTAL */}
        <div className="flex overflow-x-auto gap-2 px-3 pb-2">
          <button
            onClick={() => setActiveTab("PRODUK")}
            className={`whitespace-nowrap py-2 px-4 text-xs font-black tracking-wide border-b-2 transition-all ${
              activeTab === "PRODUK"
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-(--text-secondary)"
            }`}
          >
            PRODUK
          </button>
          <button
            onClick={() => setActiveTab("EXPENSE")}
            className={`whitespace-nowrap py-2 px-4 text-xs font-black tracking-wide border-b-2 transition-all ${
              activeTab === "EXPENSE"
                ? "border-rose-500 text-rose-500"
                : "border-transparent text-(--text-secondary)"
            }`}
          >
            JASA/BIAYA
          </button>
          <button
            onClick={() => setActiveTab("KAT_UOM")}
            className={`whitespace-nowrap py-2 px-4 text-xs font-black tracking-wide border-b-2 transition-all ${
              activeTab === "KAT_UOM"
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-(--text-secondary)"
            }`}
          >
            KATEGORI & UOM
          </button>
          {canValidate && (
            <button
              onClick={() => setActiveTab("VALIDATOR")}
              className={`whitespace-nowrap py-2 px-4 text-xs font-black tracking-wide border-b-2 transition-all ${
                activeTab === "VALIDATOR"
                  ? "border-rose-500 text-rose-500"
                  : "border-transparent text-(--text-secondary)"
              }`}
            >
              VALIDASI
            </button>
          )}
        </div>

        {/* FILTER STATUS + AKSI */}
        {(activeTab === "PRODUK" || activeTab === "EXPENSE") && (
          <div className="px-3 py-2 flex items-center justify-between bg-(--surface-hover) border-b border-(--border-color) gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => setViewStatus("AKTIF")}
                className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                  viewStatus === "AKTIF"
                    ? "bg-emerald-500/10 text-emerald-500 font-black"
                    : "text-(--text-secondary)"
                }`}
              >
                AKTIF
              </button>
              <button
                onClick={() => setViewStatus("ARSIP")}
                className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                  viewStatus === "ARSIP"
                    ? "bg-(--text-primary) text-(--bg-card) font-black"
                    : "text-(--text-secondary)"
                }`}
              >
                ARSIP
              </button>
            </div>

            <div className="flex items-center gap-2">
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
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-orange-500 rounded-lg"
                >
                  <Plus className="w-4 h-4" /> Tambah
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
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-rose-500 rounded-lg"
                >
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              )}

              {(activeTab === "PRODUK" || activeTab === "EXPENSE") &&
                viewStatus === "AKTIF" && (
                  <div className="relative" ref={actionMenuRef}>
                    <button
                      onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                      className="p-2 rounded-lg border border-(--border-color) flex items-center gap-1"
                    >
                      <Layers className="w-4 h-4 text-orange-500" />
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {isActionMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-56 bg-(--bg-card) rounded-xl shadow-2xl border border-(--border-color) py-2 z-50">
                        <button
                          onClick={() => {
                            downloadTemplateExcel();
                            setIsActionMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-(--surface-hover) flex items-center gap-2"
                        >
                          <Download className="w-4 h-4 text-(--text-secondary)" />{" "}
                          Unduh Template Excel
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-(--surface-hover) flex items-center gap-2"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />{" "}
                          Import File Excel
                        </button>
                        <div className="h-px bg-(--border-color) my-1" />
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
                          className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-(--surface-hover) flex items-center gap-2"
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
                          className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-(--surface-hover) flex items-center gap-2"
                        >
                          <FileDown className="w-4 h-4 text-rose-500" /> Export
                          ke PDF
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
            </div>
          </div>
        )}

        {/* [BARU] TOOLKIT: SEARCH + SORT BY (mobile) */}
        {showToolbar && (
          <div className="px-3 py-2 bg-(--bg-card) border-b border-(--border-color) flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--text-secondary) pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, kategori, UOM…"
                className="w-full pl-8 pr-2 py-2 text-xs font-bold bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
              />
            </div>
            <div className="relative shrink-0">
              <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-(--text-secondary) pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="text-[11px] font-black py-2 pl-7 pr-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500 appearance-none cursor-pointer"
              >
                <option value="NAME_ASC">A→Z</option>
                <option value="NAME_DESC">Z→A</option>
                <option value="PRICE_ASC">Harga ↑</option>
                <option value="PRICE_DESC">Harga ↓</option>
                <option value="NEWEST">Terbaru</option>
              </select>
            </div>
          </div>
        )}

        {/* Info hasil pencarian */}
        {showToolbar && (
          <div className="px-3 pb-2 bg-(--bg-card) text-[10px] font-bold text-(--text-secondary) border-b border-(--border-color)">
            {activeList.length} data ditemukan
          </div>
        )}
      </div>

      {/* BODY KONTEN TAB */}
      <div className="flex-1 overflow-auto p-3 bg-transparent custom-scrollbar">
        {(activeTab === "PRODUK" || activeTab === "EXPENSE") && (
          <div className="space-y-3">
            {paginatedList.length === 0 ? (
              <div className="text-center py-10 text-(--text-secondary) font-bold text-xs bg-(--bg-card) border border-(--border-color) rounded-xl">
                Tidak ada data yang cocok dengan pencarian / filter.
              </div>
            ) : (
              paginatedList.map((p: any) => {
                // ==== O(1) LOOKUP ====
                const uomName = uomMap.get(p.uomId) || "N/A";
                const catName = categoryMap.get(p.categoryId) || "-";
                const isPending = p.approvalStatus === "PENDING";
                const isRejected = p.approvalStatus === "REJECTED";
                const base = getPriceDisplay(p, "basePrice");
                const margin = getPriceDisplay(p, "marginPercentage");
                const sell = getPriceDisplay(p, "sellingPrice");

                const aliases = (
                  aliasMap.get(p.validateId || p.id) || []
                ).filter((a) => a.status === p.status);

                return (
                  <div
                    key={p.id}
                    className="bg-(--bg-card) border border-(--border-color) rounded-xl p-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-(--text-primary) flex items-center gap-2 flex-wrap">
                          {p.name}
                          {Array.isArray(p.uomConversions) &&
                            p.uomConversions.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {p.uomConversions.map(
                                  (conv: any, i: number) => (
                                    <span
                                      key={i}
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-black border ${
                                        conv.isDefault
                                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                          : "bg-(--surface-hover) text-(--text-secondary) border-(--border-color)"
                                      }`}
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
                              className="text-[10px] bg-(--surface-hover) text-(--text-secondary) px-1.5 py-0.5 rounded"
                            >
                              {expandedAliases[p.id]
                                ? "Tutup Alias"
                                : `+${aliases.length} Alias`}
                            </button>
                          )}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {isPending && (
                            <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold">
                              PENDING
                            </span>
                          )}
                          {isRejected && (
                            <span className="text-[9px] bg-rose-500/10 text-rose-500 border border-rose-500/20 px-1.5 py-0.5 rounded font-bold">
                              REJECTED
                            </span>
                          )}
                          {p.approvalStatus === "APPROVED" && (
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
                              APPROVED
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-(--text-secondary) mt-1">
                          {catName} {activeTab === "PRODUK" && ` • ${uomName}`}
                        </div>
                      </div>
                      <div className="flex flex-col items-end text-right shrink-0 ml-2">
                        <span className="text-[10px] text-(--text-secondary)">
                          {activeTab === "EXPENSE" ? "Nominal" : "HPP"}
                        </span>
                        <span className="text-xs font-mono font-bold text-rose-500">
                          Rp {base.toLocaleString()}
                        </span>
                        {activeTab === "PRODUK" && (
                          <>
                            <span className="text-[10px] text-(--text-secondary) mt-1">
                              Margin
                            </span>
                            <span className="text-xs font-mono">
                              {margin.toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-(--text-secondary) mt-1">
                              Jual
                            </span>
                            <span className="text-xs font-mono font-bold text-emerald-500">
                              Rp {sell.toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t border-(--border-color) pt-2 mt-1">
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
                            className="p-2 rounded-lg text-(--text-secondary) hover:text-blue-500 border border-(--border-color)"
                            title="Lihat Rincian Harga"
                          >
                            <Clock className="w-4 h-4" />
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
                            className="p-2 rounded-lg text-(--text-secondary) hover:text-orange-500 border border-(--border-color)"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => confirmArchive(p.id, p.name)}
                            className="p-2 rounded-lg text-(--text-secondary) hover:text-rose-500 border border-(--border-color)"
                            title="Arsipkan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleAction("RESTORE_PRODUCT", p.id)}
                          disabled={isRejected}
                          className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded flex items-center gap-1 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" /> RESTORE
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* [BARU] PAGINASI */}
            {paginatedList.length > 0 && (
              <PaginationSM
                page={safePage}
                totalPages={totalPages}
                totalItems={activeList.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            )}
          </div>
        )}

        {/* TAB KATEGORI & UOM */}
        {activeTab === "KAT_UOM" && (
          <div className="space-y-4">
            <div className="bg-(--bg-card) border border-(--border-color) rounded-xl shadow-xs">
              <div className="px-4 py-3 bg-(--surface-hover) border-b border-(--border-color) flex items-center justify-between">
                <span className="font-black text-sm text-(--text-primary)">
                  MASTER KATEGORI
                </span>
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
                  className="text-[10px] bg-orange-500 text-white px-2 py-1 rounded-md"
                >
                  + TAMBAH
                </button>
              </div>
              <ul className="divide-y divide-(--border-color)">
                {categories
                  .filter((c) => c.status === "Aktif")
                  .map((c) => (
                    <li
                      key={c.id}
                      className="p-3 flex justify-between items-center"
                    >
                      <span className="text-sm font-bold">{c.name}</span>
                      <div className="flex gap-2">
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
                          className="p-1 text-blue-500"
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
                          className="p-1 text-rose-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="bg-(--bg-card) border border-(--border-color) rounded-xl shadow-xs">
              <div className="px-4 py-3 bg-(--surface-hover) border-b border-(--border-color) flex items-center justify-between">
                <span className="font-black text-sm text-(--text-primary)">
                  MASTER UOM (SATUAN)
                </span>
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
                  className="text-[10px] bg-orange-500 text-white px-2 py-1 rounded-md"
                >
                  + TAMBAH
                </button>
              </div>
              <ul className="divide-y divide-(--border-color)">
                {uoms
                  .filter((u) => u.status === "Aktif")
                  .map((u) => (
                    <li
                      key={u.id}
                      className="p-3 flex justify-between items-center"
                    >
                      <span className="text-sm font-bold">{u.name}</span>
                      <div className="flex gap-2">
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
                          className="p-1 text-blue-500"
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
                          className="p-1 text-rose-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}

        {/* TAB VALIDATOR */}
        {activeTab === "VALIDATOR" && canValidate && (
          <div className="space-y-3">
            {/* HEADER ANTREAN + TOMBOL PILIH SEMUA */}
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 font-bold text-xs p-3 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 shrink-0" />
                <span>ANTREAN VALIDASI (PENDING)</span>
              </div>
              {paginatedList.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-2.5 py-1 text-[10px] font-black rounded-md border border-rose-500/30 bg-(--bg-card) text-rose-600 active:scale-95 transition cursor-pointer"
                >
                  {isAllPageSelected ? "Batal Semua" : "Pilih Semua"}
                </button>
              )}
            </div>

            {/* STICKY BATCH ACTIONS BAR (Muncul jika ada item terpilih) */}
            {selectedValidateIds.length > 0 && (
              <div className="sticky top-0 z-20 bg-(--bg-card) border border-orange-500/40 p-2.5 rounded-xl shadow-lg flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="text-[11px] font-black text-orange-500 pl-1">
                  {selectedValidateIds.length} Dipilih
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isBatchProcessing}
                    onClick={() => handleBatchValidate("APPROVED")}
                    className="px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg font-black text-[11px] flex items-center gap-1 active:scale-95 transition disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={isBatchProcessing}
                    onClick={() => handleBatchValidate("REJECTED")}
                    className="px-2.5 py-1.5 bg-rose-500 text-white rounded-lg font-black text-[11px] flex items-center gap-1 active:scale-95 transition disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedValidateIds([])}
                    className="px-2 py-1 text-[10px] font-bold text-(--text-secondary) hover:text-(--text-primary) cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {paginatedList.length === 0 ? (
              <div className="text-center py-10 text-(--text-secondary) font-bold text-xs bg-(--bg-card) border border-(--border-color) rounded-xl">
                Tidak ada antrean validasi yang cocok.
              </div>
            ) : (
              paginatedList.map((p: any) => {
                // ==== O(1) LOOKUP ====
                const comp = companyMap.get(p.companyId);
                const reg = regionMap.get(p.regionId);
                const out = outletMap.get(p.outletId);
                const isSelected = selectedValidateIds.includes(p.id);

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
                  <div
                    key={p.id}
                    className={`border rounded-xl p-3 shadow-xs transition ${
                      isSelected
                        ? "bg-orange-500/5 border-orange-500 ring-1 ring-orange-500/30"
                        : "bg-(--bg-card) border-(--border-color)"
                    }`}
                  >
                    {/* BAGIAN ATAS: CHECKBOX SELEKSI & NAMA PRODUK */}
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(p.id)}
                        className="mt-0.5 w-4 h-4 rounded border-(--border-color) text-orange-500 focus:ring-orange-500 cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-orange-500 truncate">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className={`px-2 py-0.5 text-[9px] font-black rounded uppercase ${
                              p.isExpense
                                ? "bg-rose-500/10 text-rose-500"
                                : "bg-blue-500/10 text-blue-500"
                            }`}
                          >
                            {p.isExpense ? "JASA / BIAYA" : "BARANG"}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-black rounded ${
                              locationTag.badge === "OUTLET"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : locationTag.badge === "REGION"
                                  ? "bg-blue-500/10 text-blue-500"
                                  : "bg-orange-500/10 text-orange-500"
                            }`}
                          >
                            {locationTag.badge}
                          </span>
                          <span className="text-xs text-(--text-secondary) truncate">
                            {locationTag.primary}
                          </span>
                        </div>
                        <div className="text-[10px] text-(--text-secondary) mt-0.5">
                          {locationTag.secondary}
                        </div>
                      </div>
                    </div>

                    {/* BAGIAN BAWAH: AKSI SATUAN TETAP TERSEDIA */}
                    <div className="flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-(--border-color)">
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
                        className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-md font-bold text-[11px] flex items-center gap-1 cursor-pointer"
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
                        className="px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-md font-bold text-[11px] flex items-center gap-1 cursor-pointer"
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
                        className="px-3 py-1.5 bg-rose-500/10 text-rose-500 rounded-md font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* [BARU] PAGINASI VALIDATOR */}
            {paginatedList.length > 0 && (
              <PaginationSM
                page={safePage}
                totalPages={totalPages}
                totalItems={activeList.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
