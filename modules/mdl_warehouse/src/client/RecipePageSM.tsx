// File: modules/mdl_warehouse/src/client/RecipePageSM.tsx
import React, { useState, useMemo, useEffect } from "react";
import {
  CookingPot,
  Plus,
  Trash2,
  Edit2,
  Eye,
  RotateCcw,
  CheckCircle2,
  X,
  Calculator,
  ChevronDown,
} from "lucide-react";
import { useWarehouseStore } from "./store";
import { useItemStore } from "../../../mdl_item/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayoutSM";
import { calculatePackagingLossCost } from "../shared/uomConverter";

const MEASURE_UOMS = [
  { value: "GRAM", label: "Gram (g)" },
  { value: "KG", label: "Kilogram (kg)" },
  { value: "ONS", label: "Ons (100g)" },
  { value: "ML", label: "Mililiter (ml)" },
  { value: "LITER", label: "Liter (L)" },
  { value: "PCS", label: "Pieces (pcs)" },
];

// =========================================================================
// 1. MODAL DETAIL RESEP LENGKAP (MOBILE)
// =========================================================================
const RecipeDetailModalSM: React.FC<{ recipe: any; onClose: () => void }> = ({
  recipe,
  onClose,
}) => {
  return (
    <div className="p-4 space-y-3 max-w-md bg-(--bg-card) text-(--text-primary)">
      <div className="flex items-center justify-between border-b border-(--border-color) pb-2">
        <div>
          <h3 className="text-sm font-black text-(--text-primary) uppercase">
            {recipe.name}
          </h3>
          <span className="text-[9px] bg-orange-500/10 text-orange-500 px-1.5 py-0.2 rounded font-bold uppercase mt-0.5 inline-block">
            Satuan: {recipe.uomName || "PORSI"}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[9px] text-(--text-secondary) font-black uppercase block">
            Jual Ideal ({recipe.foodCostPercentage}%):
          </span>
          <span className="text-sm font-black font-mono text-emerald-500">
            Rp {(recipe.idealSellingPrice || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* 1. Bahan Baku Mentah */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-black text-(--text-secondary) uppercase tracking-wider block">
          1. Komposisi Bahan Mentah:
        </span>
        <div className="space-y-1">
          {(recipe.rawMaterials || []).map((it: any, i: number) => (
            <div
              key={i}
              className="p-2 bg-(--surface-hover) rounded-lg border border-(--border-color) flex justify-between items-center text-xs"
            >
              <div>
                <span className="font-bold block text-(--text-primary)">
                  {it.itemName}
                </span>
                {it.variantInfo && (
                  <span className="text-[9px] text-slate-400 font-mono">
                    Kemasan: {it.variantInfo}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="font-mono text-orange-500 font-bold block">
                  {it.qty} {it.uomName}
                </span>
                <span className="font-mono font-bold text-[10px] text-emerald-500">
                  Rp {(it.subtotalCost || 0).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
          {(recipe.rawMaterials || []).length === 0 && (
            <div className="text-center py-2 text-slate-400 text-xs italic">
              Tidak ada bahan baku langsung.
            </div>
          )}
        </div>
      </div>

      {/* 2. Sub-Resep */}
      {(recipe.subRecipes || []).length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider block">
            2. Menu Sub-Resep Produksi:
          </span>
          <div className="space-y-1">
            {(recipe.subRecipes || []).map((it: any, i: number) => (
              <div
                key={i}
                className="p-2 bg-blue-500/5 rounded-lg border border-blue-500/20 flex justify-between items-center text-xs"
              >
                <span className="font-bold text-blue-500">{it.recipeName}</span>
                <div className="text-right">
                  <span className="font-mono text-orange-500 font-bold block">
                    {it.qty} {it.uomName}
                  </span>
                  <span className="font-mono font-bold text-[10px] text-emerald-500">
                    Rp {(it.subtotalCost || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total HPP Summary */}
      <div className="p-3 bg-(--surface-hover) rounded-xl border border-(--border-color) flex justify-between items-center text-xs font-bold">
        <span>TOTAL HPP POKOK:</span>
        <span className="font-mono text-sm font-black text-(--text-primary)">
          Rp {(recipe.totalHppCost || 0).toLocaleString()}
        </span>
      </div>

      <div className="flex justify-end pt-2 border-t border-(--border-color)">
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
// 2. MODAL FORM BUILDER RESEP (MOBILE)
// =========================================================================
const RecipeFormModalSM: React.FC<{
  isEditMode: boolean;
  initialData: any;
  onClose: () => void;
}> = ({ isEditMode, initialData, onClose }) => {
  const { recipes } = useWarehouseStore();
  const { products, uoms } = useItemStore();

  const localCompanyId = localStorage.getItem("__unv_companyId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || null;

  const [recipeName, setRecipeName] = useState(initialData?.name || "");
  const [uomName, setUomName] = useState(initialData?.uomName || "PORSI");
  const [foodCostPct, setFoodCostPct] = useState<number>(
    initialData?.foodCostPercentage || 30,
  );
  const [rawMaterials, setRawMaterials] = useState<any[]>(
    initialData?.rawMaterials || [],
  );
  const [subRecipes, setSubRecipes] = useState<any[]>(
    initialData?.subRecipes || [],
  );

  // Form Baris Bahan Baku
  const [selectedRawId, setSelectedRawId] = useState("");
  const [selectedRawVariantId, setSelectedRawVariantId] = useState("");
  const [rawQty, setRawQty] = useState<number | "">("");
  const [rawUom, setRawUom] = useState("GRAM");

  // Form Baris Sub-Resep
  const [selectedSubRecipeId, setSelectedSubRecipeId] = useState("");
  const [subRecipeQty, setSubRecipeQty] = useState<number | "">("");

  const rawProductOptions = useMemo(() => {
    return products
      .filter((p: any) => {
        const isAct =
          p.status !== undefined
            ? p.status === "Aktif"
            : p.isActive !== undefined
              ? Boolean(p.isActive)
              : Boolean(p.is_active);
        if (!isAct || p.isExpense || p.approvalStatus === "MERGED")
          return false;

        const localCompanyId = localStorage.getItem("__unv_companyId") || "";
        const localRegionId = localStorage.getItem("__unv_regionId") || "";
        const localOutletId = localStorage.getItem("__unv_outletId") || "";

        if (localCompanyId && p.companyId && p.companyId !== localCompanyId)
          return false;
        if (localRegionId && p.regionId && p.regionId !== localRegionId)
          return false;

        if (localOutletId) {
          return !p.outletId || p.outletId === localOutletId;
        }
        return true;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        uomId: p.uomId,
        pricing: p.pricing,
        uomConversions: p.uomConversions || [],
      }));
  }, [products]);

  const selectedItemObj = useMemo(() => {
    return rawProductOptions.find((p) => p.id === selectedRawId);
  }, [rawProductOptions, selectedRawId]);

  const itemVariants = useMemo(() => {
    if (
      !selectedItemObj?.uomConversions ||
      !Array.isArray(selectedItemObj.uomConversions)
    ) {
      return [];
    }
    return selectedItemObj.uomConversions.filter(
      (c: any) => Number(c.value) > 0 && c.uom,
    );
  }, [selectedItemObj]);

  useEffect(() => {
    if (itemVariants.length > 0) {
      const def = itemVariants.find((v: any) => v.isDefault) || itemVariants[0];
      setSelectedRawVariantId(def.id);
    } else {
      setSelectedRawVariantId("");
    }
  }, [itemVariants]);

  const activeRawVariant = useMemo(() => {
    return (
      itemVariants.find((v: any) => v.id === selectedRawVariantId) ||
      itemVariants[0] ||
      null
    );
  }, [itemVariants, selectedRawVariantId]);

  const availableSubRecipes = useMemo(() => {
    return recipes.filter(
      (r) => r.isActive !== false && (!isEditMode || r.id !== initialData?.id),
    );
  }, [recipes, isEditMode, initialData]);

  const handleAddRawMaterial = () => {
    if (!selectedItemObj || Number(rawQty) <= 0) {
      return sysToast.error("Error", "Pilih bahan baku dan isi takaran!");
    }
    const baseUomName =
      uoms.find((u) => u.id === selectedItemObj.uomId)?.name || "KG";
    const pricing =
      selectedItemObj.pricing?.[localOutletId || "DEFAULT"] ||
      selectedItemObj.pricing?.[
        Object.keys(selectedItemObj.pricing || {})[0]
      ] ||
      {};
    const basePrice = pricing.basePrice || 0;
    const calcResult = calculatePackagingLossCost(
      Number(rawQty),
      rawUom,
      baseUomName,
      basePrice,
      activeRawVariant
        ? { value: activeRawVariant.value, uom: activeRawVariant.uom }
        : null,
    );
    const newRow = {
      itemId: selectedItemObj.id,
      itemName: selectedItemObj.name,
      qty: Number(rawQty),
      uomName: rawUom,
      baseUom: baseUomName,
      convertedBaseQty: calcResult.convertedBaseQty,
      variantInfo: activeRawVariant
        ? `${activeRawVariant.value} ${activeRawVariant.uom}`
        : null,
      unitCost: calcResult.unitCostPerStandard,
      subtotalCost: calcResult.totalCost,
    };
    setRawMaterials((prev) => [...prev, newRow]);
    setSelectedRawId("");
    setRawQty("");
  };

  const handleAddSubRecipe = () => {
    if (!selectedSubRecipeId || Number(subRecipeQty) <= 0) {
      return sysToast.error("Error", "Pilih sub-menu dan isi jumlah porsi!");
    }
    const rcpObj = availableSubRecipes.find(
      (r) => r.id === selectedSubRecipeId,
    );
    if (!rcpObj) return;
    const subtotalCost = Math.round(
      (rcpObj.totalHppCost || 0) * Number(subRecipeQty),
    );
    const newRow = {
      recipeId: rcpObj.id,
      recipeName: rcpObj.name,
      qty: Number(subRecipeQty),
      uomName: rcpObj.uomName || "PORSI",
      unitCost: rcpObj.totalHppCost || 0,
      subtotalCost,
    };
    setSubRecipes((prev) => [...prev, newRow]);
    setSelectedSubRecipeId("");
    setSubRecipeQty("");
  };

  const totalHpp = useMemo(() => {
    const rawTotal = rawMaterials.reduce(
      (sum, it) => sum + (it.subtotalCost || 0),
      0,
    );
    const subTotal = subRecipes.reduce(
      (sum, it) => sum + (it.subtotalCost || 0),
      0,
    );
    return rawTotal + subTotal;
  }, [rawMaterials, subRecipes]);

  const idealPrice = useMemo(() => {
    if (foodCostPct <= 0 || totalHpp <= 0) return 0;
    return Math.round(totalHpp / (foodCostPct / 100));
  }, [totalHpp, foodCostPct]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeName.trim()) {
      return sysToast.error("Error", "Nama menu resep tidak boleh kosong!");
    }
    if (rawMaterials.length === 0 && subRecipes.length === 0) {
      return sysToast.error(
        "Error",
        "Masukkan minimal 1 bahan baku atau menu jadi!",
      );
    }
    try {
      const payload = {
        id: initialData?.id,
        companyId: localCompanyId,
        outletId: localOutletId,
        name: recipeName.toUpperCase().trim(),
        uomName: uomName.toUpperCase().trim(),
        foodCostPercentage: Number(foodCostPct) || 30,
        totalHppCost: totalHpp,
        idealSellingPrice: idealPrice,
        rawMaterials,
        subRecipes,
      };
      await globalCommandBus.execute({
        type: isEditMode ? "UPDATE_RECIPE" : "CREATE_RECIPE",
        payload,
      });
      sysToast.success(
        "Resep Disimpan",
        `Resep "${recipeName.toUpperCase()}" (HPP: Rp ${totalHpp.toLocaleString()} | Jual: Rp ${idealPrice.toLocaleString()}) berhasil disimpan.`,
      );
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-(--bg-card) w-full max-w-lg rounded-2xl shadow-2xl border border-(--border-color) overflow-hidden flex flex-col max-h-[92vh] text-(--text-primary)">
        {/* Header Form */}
        <div className="px-4 py-3 border-b border-(--border-color) flex items-center justify-between bg-(--surface-hover) shrink-0">
          <div className="flex items-center gap-2">
            <CookingPot className="w-5 h-5 text-orange-500" />
            <h3 className="font-black text-xs uppercase tracking-wide">
              {isEditMode
                ? "Edit Formula Resep (BOM)"
                : "Buat Formula Resep Baru"}
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
          <div className="p-3.5 overflow-y-auto custom-scrollbar space-y-3 flex-1">
            {/* 1. IDENTITAS RESEP */}
            <div className="grid grid-cols-3 gap-2 bg-(--surface-hover) p-3 rounded-xl border border-(--border-color)">
              <div className="col-span-2">
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Nama Menu Hidangan
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value.toUpperCase())}
                  placeholder="AYAM GORENG..."
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none text-(--text-primary)"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Satuan
                </label>
                <input
                  type="text"
                  required
                  value={uomName}
                  onChange={(e) => setUomName(e.target.value.toUpperCase())}
                  placeholder="PORSI"
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none text-center text-orange-500 font-mono"
                />
              </div>
            </div>

            {/* 2. BAHAN BAKU MENTAH */}
            <div className="p-3 bg-(--bg-input)/50 rounded-xl border border-(--border-color) space-y-2">
              <span className="text-[10px] font-black text-orange-500 uppercase tracking-wider block">
                1. BAHAN BAKU MENTAH (DARI MASTER ITEM)
              </span>

              <select
                value={selectedRawId}
                onChange={(e) => setSelectedRawId(e.target.value)}
                className="w-full text-xs font-bold p-2 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
              >
                <option value="">-- PILIH BAHAN BAKU --</option>
                {rawProductOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {itemVariants.length > 0 && (
                <div>
                  <label className="block text-[9px] font-black text-orange-500 uppercase mb-0.5">
                    Kemasan Master:
                  </label>
                  <select
                    value={selectedRawVariantId}
                    onChange={(e) => setSelectedRawVariantId(e.target.value)}
                    className="w-full text-xs font-black p-1.5 bg-(--bg-card) text-orange-500 border border-orange-500/30 rounded-lg outline-none"
                  >
                    {itemVariants.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.value} {v.uom}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-12 gap-1.5 items-end">
                <div className="col-span-5">
                  <input
                    type="number"
                    step="any"
                    min={0.001}
                    value={rawQty}
                    onChange={(e) =>
                      setRawQty(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="Takaran"
                    className="w-full text-xs font-bold p-2 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-center font-mono text-(--text-primary)"
                  />
                </div>
                <div className="col-span-4">
                  <select
                    value={rawUom}
                    onChange={(e) => setRawUom(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
                  >
                    {MEASURE_UOMS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <button
                    type="button"
                    onClick={handleAddRawMaterial}
                    className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-lg shadow-xs"
                  >
                    + Tambah
                  </button>
                </div>
              </div>

              {rawMaterials.length > 0 && (
                <div className="space-y-1 pt-1">
                  {rawMaterials.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-(--bg-card) rounded-lg border border-(--border-color) text-xs"
                    >
                      <div className="truncate flex-1">
                        <span className="font-bold text-(--text-primary) truncate block">
                          {it.itemName}
                        </span>
                        {it.variantInfo && (
                          <span className="text-[9px] text-slate-400 font-mono">
                            {it.variantInfo}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-orange-500 font-bold text-xs">
                          {it.qty} {it.uomName}
                        </span>
                        <span className="font-mono text-emerald-500 font-black text-xs">
                          Rp {(it.subtotalCost || 0).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRawMaterials((p) =>
                              p.filter((_, i) => i !== idx),
                            )
                          }
                          className="text-(--text-secondary) hover:text-rose-500 p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. SUB-RESEP */}
            <div className="p-3 bg-(--bg-input)/50 rounded-xl border border-(--border-color) space-y-2">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider block">
                2. SUB-RESEP MENU JADI (PRODUKSI BERJENJANG)
              </span>

              <select
                value={selectedSubRecipeId}
                onChange={(e) => setSelectedSubRecipeId(e.target.value)}
                className="w-full text-xs font-bold p-2 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
              >
                <option value="">-- PILIH SUB-RESEP --</option>
                {availableSubRecipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (HPP: Rp {(r.totalHppCost || 0).toLocaleString()})
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-12 gap-1.5 items-end">
                <div className="col-span-8">
                  <input
                    type="number"
                    min={0.1}
                    step="any"
                    value={subRecipeQty}
                    onChange={(e) =>
                      setSubRecipeQty(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="Jumlah Porsi Sub-Menu"
                    className="w-full text-xs font-bold p-2 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-center font-mono text-(--text-primary)"
                  />
                </div>
                <div className="col-span-4">
                  <button
                    type="button"
                    onClick={handleAddSubRecipe}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg shadow-xs"
                  >
                    + Sub-Menu
                  </button>
                </div>
              </div>

              {subRecipes.length > 0 && (
                <div className="space-y-1 pt-1">
                  {subRecipes.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-(--bg-card) rounded-lg border border-(--border-color) text-xs"
                    >
                      <span className="font-bold text-blue-500 truncate flex-1">
                        {it.recipeName}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-orange-500 font-bold text-xs">
                          {it.qty} {it.uomName}
                        </span>
                        <span className="font-mono text-emerald-500 font-black text-xs">
                          Rp {(it.subtotalCost || 0).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSubRecipes((p) => p.filter((_, i) => i !== idx))
                          }
                          className="text-(--text-secondary) hover:text-rose-500 p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. KALKULATOR FOOD COST & HARGA JUAL IDEAL */}
            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[10px] font-black uppercase text-(--text-secondary)">
                  Total HPP Pokok:
                </span>
                <span className="font-mono font-black text-sm text-(--text-primary)">
                  Rp {totalHpp.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <label className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                  Target Food Cost (%):
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={foodCostPct}
                    onChange={(e) => setFoodCostPct(Number(e.target.value))}
                    className="w-14 text-xs font-black p-1 bg-(--bg-card) border border-(--border-color) rounded-lg text-center font-mono text-emerald-500 outline-none"
                  />
                  <span className="text-xs font-bold text-(--text-secondary)">
                    %
                  </span>
                </div>
              </div>

              <div className="pt-1 border-t border-emerald-500/20 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                  Harga Jual Ideal POS:
                </span>
                <span className="font-mono font-black text-base text-emerald-500">
                  Rp {idealPrice.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-(--surface-hover) border-t border-(--border-color) flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-(--text-secondary) rounded-lg"
            >
              BATAL
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-md flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" /> SIMPAN RESEP
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// 3. HALAMAN UTAMA MOBILE: RECIPE PAGE SM
// =========================================================================
export function RecipePageSM() {
  const { recipes } = useWarehouseStore();
  const { openCenterModal, closeCenterModal, openAlert } = useUniversalModal();
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editRecipeData, setEditRecipeData] = useState<any>(null);
  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");

  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) =>
      viewStatus === "AKTIF" ? r.isActive !== false : r.isActive === false,
    );
  }, [recipes, viewStatus]);

  const handleAction = async (type: string, id: string) => {
    try {
      await globalCommandBus.execute({ type, payload: { id } });
      sysToast.success("Berhasil", "Data resep diperbarui.");
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  const confirmArchive = (id: string, name: string) => {
    openAlert({
      title: "Arsipkan Resep",
      message: `Arsipkan resep "${name}"?`,
      confirmText: "YA, ARSIPKAN",
      onConfirm: () => handleAction("ARCHIVE_RECIPE", id),
    });
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {isFormModalOpen && (
        <RecipeFormModalSM
          isEditMode={Boolean(editRecipeData)}
          initialData={editRecipeData}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditRecipeData(null);
          }}
        />
      )}

      {/* HEADER MOBILE */}
      <div className="p-3 bg-(--bg-card) border-b border-(--border-color) shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CookingPot className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-sm font-black text-(--text-primary) uppercase tracking-wide">
                Master Resep (BOM)
              </h2>
              <span className="text-[10px] text-(--text-secondary) font-bold">
                Formula &amp; Food Cost
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex bg-(--bg-input) rounded-lg border border-(--border-color) p-0.5">
              <button
                onClick={() => setViewStatus("AKTIF")}
                className={`px-2.5 py-1 text-[10px] font-black rounded ${
                  viewStatus === "AKTIF"
                    ? "bg-orange-500 text-white"
                    : "text-(--text-secondary)"
                }`}
              >
                AKTIF
              </button>
              <button
                onClick={() => setViewStatus("ARSIP")}
                className={`px-2.5 py-1 text-[10px] font-black rounded ${
                  viewStatus === "ARSIP"
                    ? "bg-slate-700 text-white"
                    : "text-(--text-secondary)"
                }`}
              >
                ARSIP
              </button>
            </div>

            {viewStatus === "AKTIF" && (
              <button
                onClick={() => {
                  setEditRecipeData(null);
                  setIsFormModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm"
              >
                <Plus className="w-4 h-4" /> Resep
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DAFTAR RESEP (KARTU MOBILE) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {filteredRecipes.map((rcp) => {
          const rawCount = (rcp.rawMaterials || []).length;
          const subCount = (rcp.subRecipes || []).length;

          return (
            <div
              key={rcp.id}
              className="bg-(--bg-card) border border-(--border-color) rounded-xl p-3 shadow-xs space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-xs text-(--text-primary)">
                    {rcp.name}
                  </div>
                  <span className="text-[9px] font-black uppercase text-orange-500 font-mono">
                    Per {rcp.uomName || "PORSI"}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {rawCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-(--bg-input) border border-(--border-color) rounded text-[9px] font-bold text-(--text-primary)">
                      {rawCount} Bahan
                    </span>
                  )}
                  {subCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded text-[9px] font-black">
                      {subCount} Sub-Menu
                    </span>
                  )}
                </div>
              </div>

              {/* Rincian Finansial Resep */}
              <div className="grid grid-cols-3 gap-2 py-1 border-t border-(--border-color) text-xs">
                <div>
                  <span className="text-[9px] text-(--text-secondary) block">
                    Total HPP
                  </span>
                  <span className="font-mono font-bold text-(--text-primary) text-xs">
                    Rp {(rcp.totalHppCost || 0).toLocaleString()}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] text-(--text-secondary) block">
                    Food Cost
                  </span>
                  <span className="font-mono font-black text-orange-500 text-xs">
                    {rcp.foodCostPercentage || 30}%
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[9px] text-(--text-secondary) block">
                    Jual Ideal
                  </span>
                  <span className="font-mono font-black text-emerald-500 text-xs">
                    Rp {(rcp.idealSellingPrice || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Tombol Aksi */}
              <div className="flex items-center justify-end gap-1 pt-1 border-t border-(--border-color)">
                <button
                  onClick={() =>
                    openCenterModal({
                      title: `RINCIAN RESEP: ${rcp.name}`,
                      content: (
                        <RecipeDetailModalSM
                          recipe={rcp}
                          onClose={closeCenterModal}
                        />
                      ),
                    })
                  }
                  className="p-1.5 text-(--text-secondary) hover:text-blue-500 border border-(--border-color) rounded-lg"
                  title="Lihat Komposisi"
                >
                  <Eye className="w-4 h-4" />
                </button>

                {viewStatus === "AKTIF" ? (
                  <>
                    <button
                      onClick={() => {
                        setEditRecipeData(rcp);
                        setIsFormModalOpen(true);
                      }}
                      className="p-1.5 text-(--text-secondary) hover:text-orange-500 border border-(--border-color) rounded-lg"
                      title="Edit Resep"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => confirmArchive(rcp.id, rcp.name)}
                      className="p-1.5 text-(--text-secondary) hover:text-rose-500 border border-(--border-color) rounded-lg"
                      title="Arsipkan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleAction("RESTORE_RECIPE", rcp.id)}
                    className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded-lg flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredRecipes.length === 0 && (
          <div className="p-8 text-center text-(--text-secondary) font-bold text-xs italic">
            Belum ada formula resep menu terdaftar.
          </div>
        )}
      </div>
    </div>
  );
}
