// File: modules/mdl_warehouse/src/client/RecipePage.tsx
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
} from "lucide-react";
import { useWarehouseStore } from "./store";
import { useItemStore } from "../../../mdl_item/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayout";
import { calculatePackagingLossCost } from "../shared/uomConverter";

// SATUAN TAKAR MURNI MATEMATIS
const MEASURE_UOMS = [
  { value: "GRAM", label: "Gram (g)" },
  { value: "KG", label: "Kilogram (kg)" },
  { value: "ONS", label: "Ons (100g)" },
  { value: "ML", label: "Mililiter (ml)" },
  { value: "LITER", label: "Liter (L)" },
  { value: "PCS", label: "Pieces (pcs)" },
];

// =========================================================================
// 1. MODAL DETAIL RESEP LENGKAP
// =========================================================================
const RecipeDetailModal: React.FC<{ recipe: any; onClose: () => void }> = ({
  recipe,
  onClose,
}) => {
  return (
    <div className="p-6 space-y-4 max-w-2xl bg-(--bg-card) text-(--text-primary)">
      <div className="flex items-center justify-between border-b border-(--border-color) pb-3">
        <div>
          <h3 className="text-base font-black text-(--text-primary) uppercase">
            {recipe.name}
          </h3>
          <span className="text-[10px] bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded font-bold uppercase mt-1 inline-block">
            Satuan: {recipe.uomName || "PORSI"}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-(--text-secondary) font-black uppercase block">
            Harga Jual Ideal ({recipe.foodCostPercentage}%):
          </span>
          <span className="text-lg font-black font-mono text-emerald-500">
            Rp {(recipe.idealSellingPrice || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Tabel 1: Bahan Baku Mentah */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-black text-(--text-secondary) uppercase tracking-wider block">
          1. Komposisi Bahan Baku Mentah:
        </span>
        <div className="border border-(--border-color) rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-(--surface-hover) text-[10px] font-black text-(--text-secondary) uppercase">
                <th className="p-2">Nama Bahan</th>
                <th className="p-2 text-center">Takaran</th>
                <th className="p-2 text-right">Subtotal HPP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border-color)">
              {(recipe.rawMaterials || []).map((it: any, i: number) => (
                <tr key={i}>
                  <td className="p-2 font-bold">
                    {it.itemName}
                    {it.variantInfo && (
                      <span className="text-[9px] text-slate-400 font-normal block font-mono">
                        Kemasan: {it.variantInfo}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center font-mono text-orange-500 font-bold">
                    {it.qty} {it.uomName}
                  </td>
                  <td className="p-2 text-right font-mono font-bold">
                    Rp {(it.subtotalCost || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
              {(recipe.rawMaterials || []).length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="p-3 text-center text-slate-400 italic"
                  >
                    Tidak ada bahan baku mentah langsung.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabel 2: Sub-Resep */}
      {(recipe.subRecipes || []).length > 0 && (
        <div className="space-y-1.5 pt-2">
          <span className="text-[11px] font-black text-orange-500 uppercase tracking-wider block">
            2. Komposisi Menu Jadi / Sub-Resep Produksi:
          </span>
          <div className="border border-(--border-color) rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-(--surface-hover) text-[10px] font-black text-(--text-secondary) uppercase">
                  <th className="p-2">Nama Menu Sub-Resep</th>
                  <th className="p-2 text-center">Porsi</th>
                  <th className="p-2 text-right">Subtotal HPP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-color)">
                {(recipe.subRecipes || []).map((it: any, i: number) => (
                  <tr key={i}>
                    <td className="p-2 font-bold text-orange-500">
                      {it.recipeName}
                    </td>
                    <td className="p-2 text-center font-mono font-bold">
                      {it.qty} {it.uomName}
                    </td>
                    <td className="p-2 text-right font-mono font-bold">
                      Rp {(it.subtotalCost || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Total HPP Summary */}
      <div className="p-3.5 bg-(--surface-hover) rounded-xl border border-(--border-color) flex justify-between items-center text-xs font-bold">
        <span>TOTAL HPP POKOK PRODUKSI:</span>
        <span className="font-mono text-base font-black text-(--text-primary)">
          Rp {(recipe.totalHppCost || 0).toLocaleString()}
        </span>
      </div>

      <div className="flex justify-end pt-3 border-t border-(--border-color)">
        <button
          onClick={onClose}
          className="px-5 py-2 bg-(--surface-hover) hover:bg-(--border-color) text-xs font-bold rounded-lg cursor-pointer"
        >
          TUTUP
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// 2. MODAL FORM BUILDER RESEP BERJENJANG (DENGAN VARIAN KEMASAN)
// =========================================================================
const RecipeFormModal: React.FC<{
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
      .filter((p) => p.status === "Aktif" && !p.isExpense)
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

  // Varian Kemasan Bahan Terpilih
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

  // Tambah Bahan Baku Mentah
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

  // Tambah Sub-Resep
  const handleAddSubRecipe = () => {
    if (!selectedSubRecipeId || Number(subRecipeQty) <= 0) {
      return sysToast.error("Error", "Pilih menu jadi dan isi jumlah porsi!");
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
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-(--bg-card) w-full max-w-3xl rounded-2xl shadow-2xl border border-(--border-color) overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 text-(--text-primary)">
        <div className="px-6 py-3.5 border-b border-(--border-color) flex items-center justify-between bg-(--surface-hover) shrink-0">
          <div className="flex items-center gap-2.5">
            <CookingPot className="w-5 h-5 text-orange-500" />
            <h3 className="font-black text-sm uppercase tracking-wide">
              {isEditMode
                ? "Edit Formula Resep (BOM)"
                : "Buat Resep / Formula Menu Baru (BOM)"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-(--text-secondary) hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSave}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">
            {/* IDENTITAS RESEP */}
            <div className="grid grid-cols-3 gap-3 bg-(--surface-hover) p-3.5 rounded-xl border border-(--border-color)">
              <div className="col-span-2">
                <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                  Nama Menu / Resep
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value.toUpperCase())}
                  placeholder="CONTOH: AYAM GORENG SPESIAL / SAMBEL TERASI..."
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none focus:border-orange-500 text-(--text-primary)"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                  Satuan Porsi
                </label>
                <input
                  type="text"
                  required
                  value={uomName}
                  onChange={(e) => setUomName(e.target.value.toUpperCase())}
                  placeholder="PORSI / POTONG / CUP..."
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none text-center text-orange-500 font-mono"
                />
              </div>
            </div>

            {/* KOMPOSISI BAHAN BAKU */}
            <div className="p-3.5 bg-(--bg-input)/50 rounded-xl border border-(--border-color) space-y-2">
              <span className="text-[10px] font-black text-orange-500 uppercase tracking-wider block">
                1. BAHAN BAKU MENTAH (DARI MASTER ITEM)
              </span>

              <div className="grid grid-cols-12 gap-2 items-end">
                <div
                  className={
                    itemVariants.length > 0 ? "col-span-4" : "col-span-6"
                  }
                >
                  <select
                    value={selectedRawId}
                    onChange={(e) => setSelectedRawId(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none cursor-pointer"
                  >
                    <option value="">-- PILIH BAHAN BAKU --</option>
                    {rawProductOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* FORM TAMBAHAN: VARIAN KEMASAN */}
                {itemVariants.length > 0 && (
                  <div className="col-span-2">
                    <select
                      value={selectedRawVariantId}
                      onChange={(e) => setSelectedRawVariantId(e.target.value)}
                      className="w-full text-xs font-black p-2 bg-(--bg-card) text-orange-500 border border-orange-500/30 rounded-lg outline-none cursor-pointer"
                    >
                      {itemVariants.map((v: any) => (
                        <option key={v.id} value={v.id}>
                          {v.value} {v.uom}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* TAKARAN & SATUAN UKUR MURNI MATEMATIS */}
                <div
                  className={
                    itemVariants.length > 0
                      ? "col-span-4 flex gap-1"
                      : "col-span-3 flex gap-1"
                  }
                >
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
                    className="w-20 text-xs font-bold p-2 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-center font-mono text-(--text-primary)"
                  />
                  <select
                    value={rawUom}
                    onChange={(e) => setRawUom(e.target.value)}
                    className="flex-1 text-xs font-bold p-2 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none cursor-pointer"
                  >
                    {MEASURE_UOMS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className={
                    itemVariants.length > 0 ? "col-span-2" : "col-span-3"
                  }
                >
                  <button
                    type="button"
                    onClick={handleAddRawMaterial}
                    className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-lg transition cursor-pointer shadow-xs"
                  >
                    + TAMBAH
                  </button>
                </div>
              </div>

              {/* List Bahan Baku */}
              {rawMaterials.length > 0 && (
                <div className="space-y-1 pt-1.5">
                  {rawMaterials.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-(--bg-card) rounded-lg border border-(--border-color) text-xs"
                    >
                      <div>
                        <span className="font-bold text-(--text-primary)">
                          {it.itemName}
                        </span>
                        {it.variantInfo && (
                          <span className="text-[9px] text-slate-400 font-normal font-mono block">
                            Kemasan: {it.variantInfo}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-orange-500 font-bold">
                          {it.qty} {it.uomName}
                        </span>
                        <span className="font-mono text-emerald-500 font-black">
                          Rp {(it.subtotalCost || 0).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRawMaterials((p) =>
                              p.filter((_, i) => i !== idx),
                            )
                          }
                          className="text-(--text-secondary) hover:text-rose-500 p-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* KOMPOSISI SUB-RESEP */}
            <div className="p-3.5 bg-(--bg-input)/50 rounded-xl border border-(--border-color) space-y-2">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider block">
                2. MENU JADI / PRODUKSI LAIN (SUB-RESEP BOM)
              </span>

              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6">
                  <select
                    value={selectedSubRecipeId}
                    onChange={(e) => setSelectedSubRecipeId(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none cursor-pointer"
                  >
                    <option value="">-- PILIH SUB-RESEP MENU JADI --</option>
                    {availableSubRecipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (HPP: Rp{" "}
                        {(r.totalHppCost || 0).toLocaleString()} / {r.uomName})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-3">
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
                    placeholder="Porsi"
                    className="w-full text-xs font-bold p-2 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-center font-mono text-(--text-primary)"
                  />
                </div>

                <div className="col-span-3">
                  <button
                    type="button"
                    onClick={handleAddSubRecipe}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg transition cursor-pointer shadow-xs"
                  >
                    + TAMBAH SUB-MENU
                  </button>
                </div>
              </div>

              {subRecipes.length > 0 && (
                <div className="space-y-1 pt-1.5">
                  {subRecipes.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-(--bg-card) rounded-lg border border-(--border-color) text-xs"
                    >
                      <span className="font-bold text-blue-500">
                        {it.recipeName}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-orange-500 font-bold">
                          {it.qty} {it.uomName}
                        </span>
                        <span className="font-mono text-emerald-500 font-black">
                          Rp {(it.subtotalCost || 0).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSubRecipes((p) => p.filter((_, i) => i !== idx))
                          }
                          className="text-(--text-secondary) hover:text-rose-500 p-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* KALKULATOR FOOD COST & HARGA JUAL */}
            <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/30 grid grid-cols-3 gap-4 items-center">
              <div>
                <span className="text-[10px] font-black text-(--text-secondary) uppercase block">
                  1. TOTAL HPP BAHAN &amp; SUB-MENU:
                </span>
                <span className="text-base font-black font-mono text-(--text-primary) block mt-0.5">
                  Rp {totalHpp.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase block mb-1">
                  2. TARGET FOOD COST (%):
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={foodCostPct}
                    onChange={(e) => setFoodCostPct(Number(e.target.value))}
                    className="w-16 text-xs font-black p-1.5 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-center font-mono text-emerald-500"
                  />
                  <span className="text-xs font-bold text-(--text-secondary)">
                    %
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase block">
                  3. HARGA JUAL IDEAL (POS):
                </span>
                <span className="text-xl font-black font-mono text-emerald-500 block mt-0.5">
                  Rp {idealPrice.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="px-6 py-3.5 bg-(--surface-hover) border-t border-(--border-color) flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-(--text-secondary) hover:bg-(--surface-hover) rounded-xl cursor-pointer"
            >
              BATAL
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> SIMPAN RESEP
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// 3. HALAMAN UTAMA RECIPE PAGE
// =========================================================================
export function RecipePage() {
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
        <RecipeFormModal
          isEditMode={Boolean(editRecipeData)}
          initialData={editRecipeData}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditRecipeData(null);
          }}
        />
      )}

      <div className="p-5 bg-(--surface-hover) border-b border-(--border-color) flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <CookingPot className="w-5 h-5 text-orange-500" />
          <div>
            <h2 className="text-base font-black text-(--text-primary) tracking-tight">
              Master Resep &amp; Bill of Materials (BOM)
            </h2>
            <p className="text-[11px] text-(--text-secondary) font-bold">
              Formula Takaran Bahan Baku, Komposisi Menu Jadi, dan Target Food
              Cost
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-(--bg-input) p-1 rounded-xl border border-(--border-color)">
            <button
              onClick={() => setViewStatus("AKTIF")}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition cursor-pointer ${
                viewStatus === "AKTIF"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              DATA AKTIF
            </button>
            <button
              onClick={() => setViewStatus("ARSIP")}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition cursor-pointer ${
                viewStatus === "ARSIP"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
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
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> BUAT RESEP BARU
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
        <div className="bg-(--bg-card) border border-(--border-color) rounded-2xl shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black text-(--text-secondary) tracking-wider">
                <th className="px-4 py-3">Nama Menu Hidangan</th>
                <th className="px-4 py-3">Komposisi Formula</th>
                <th className="px-4 py-3 text-right">Total HPP Pokok</th>
                <th className="px-4 py-3 text-center">Target FC %</th>
                <th className="px-4 py-3 text-right text-emerald-500">
                  Harga Jual Ideal (POS)
                </th>
                <th className="px-4 py-3 text-right w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border-color) text-xs font-semibold text-(--text-primary)">
              {filteredRecipes.map((rcp) => {
                const rawCount = (rcp.rawMaterials || []).length;
                const subCount = (rcp.subRecipes || []).length;

                return (
                  <tr
                    key={rcp.id}
                    className="hover:bg-(--surface-hover) transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-bold text-(--text-primary) text-sm">
                        {rcp.name}
                      </div>
                      <span className="text-[9px] font-black uppercase text-orange-500 font-mono">
                        Per {rcp.uomName || "PORSI"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {rawCount > 0 && (
                          <span className="px-2 py-0.5 bg-(--bg-input) border border-(--border-color) rounded text-[10px] font-bold text-(--text-primary)">
                            {rawCount} Bahan Baku
                          </span>
                        )}
                        {subCount > 0 && (
                          <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded text-[10px] font-black">
                            {subCount} Sub-Menu Jadi
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-bold text-(--text-primary)">
                      Rp {(rcp.totalHppCost || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-center font-mono font-black text-orange-500">
                      {rcp.foodCostPercentage || 30}%
                    </td>

                    <td className="px-4 py-3 text-right font-mono font-black text-emerald-500 text-sm">
                      Rp {(rcp.idealSellingPrice || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() =>
                          openCenterModal({
                            title: `RINCIAN RESEP: ${rcp.name}`,
                            content: (
                              <RecipeDetailModal
                                recipe={rcp}
                                onClose={closeCenterModal}
                              />
                            ),
                          })
                        }
                        className="p-1.5 text-(--text-secondary) hover:text-blue-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                        title="Lihat Rincian Takaran"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {viewStatus === "AKTIF" ? (
                        <>
                          <button
                            onClick={() => {
                              setEditRecipeData(rcp);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 text-(--text-secondary) hover:text-orange-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                            title="Edit Resep"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => confirmArchive(rcp.id, rcp.name)}
                            className="p-1.5 text-(--text-secondary) hover:text-rose-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                            title="Arsipkan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleAction("RESTORE_RECIPE", rcp.id)}
                          className="px-2 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> RESTORE
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredRecipes.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-12 text-center text-(--text-secondary) font-bold text-xs italic"
                  >
                    Belum ada formula resep menu yang terdaftar.
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
