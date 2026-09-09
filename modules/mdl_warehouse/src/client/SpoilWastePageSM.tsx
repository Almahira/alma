// File: modules/mdl_warehouse/src/client/SpoilWastePageSM.tsx
import React, { useState, useMemo, useEffect } from "react";
import {
  Flame,
  Trash2,
  Filter,
  UtensilsCrossed,
  Calculator,
  Plus,
  ChevronDown,
} from "lucide-react";
import { useWarehouseStore } from "./store";
import { useItemStore } from "../../../mdl_item/src/client/store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { UniversalCombobox } from "../../../../apps/client_unv/src/shared-ui/UniversalCombobox";
import { calculatePackagingLossCost } from "../shared/uomConverter";

const MEASURE_UOMS = [
  { value: "GRAM", label: "Gram (g)" },
  { value: "KG", label: "Kilogram (kg)" },
  { value: "ONS", label: "Ons (100g)" },
  { value: "ML", label: "Mililiter (ml)" },
  { value: "LITER", label: "Liter (L)" },
  { value: "PCS", label: "Pieces (pcs)" },
];

export function SpoilWastePageSM() {
  const { spoilWastes, recipes } = useWarehouseStore();
  const { products, uoms } = useItemStore();
  const { divisions, outlets } = useOrgStore();

  const localCompanyId = localStorage.getItem("__unv_companyId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";
  const currentOutlet = outlets.find((o) => o.id === localOutletId);
  const outletName = currentOutlet
    ? currentOutlet.name.toUpperCase()
    : "GUDANG OUTLET";

  // Mode Toggle: SPOIL (Bahan Rusak) vs WASTE (Menu Gagal)
  const [entryMode, setEntryMode] = useState<"SPOIL" | "WASTE">("SPOIL");
  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");
  const [filterType, setFilterType] = useState<"ALL" | "SPOIL" | "WASTE">(
    "ALL",
  );
  const [filterOutletId, setFilterOutletId] = useState(""); // Tambahan untuk filter outlet (region/company)
  const [isAddFormOpen, setIsAddFormOpen] = useState(true);

  // Sticky State Form
  const [stickyDate, setStickyDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [stickyDivisionId, setStickyDivisionId] = useState("");

  // Input Spoil
  const [spoilItemId, setSpoilItemId] = useState("");
  const [spoilVariantId, setSpoilVariantId] = useState("");
  const [spoilQty, setSpoilQty] = useState<number | "">(1);
  const [spoilUom, setSpoilUom] = useState("GRAM");
  const [spoilNote, setSpoilNote] = useState("");

  // Input Waste
  const [wasteRecipeId, setWasteRecipeId] = useState("");
  const [wastePortionQty, setWastePortionQty] = useState<number | "">(1);
  const [wasteNote, setWasteNote] = useState("");

  const divisionOptions = useMemo(() => {
    return divisions
      .filter((d) => {
        if (d.status !== "Aktif") return false;
        if (localCompanyId && d.companyId && d.companyId !== localCompanyId)
          return false;

        // Cabang Outlet HANYA melihat divisi yang dibuat untuk cabang ini:
        if (localOutletId) {
          return d.outletId === localOutletId || !d.outletId;
        }
        // Region melihat divisi region atau divisi cabang wilayahnya:
        if (localRegionId) {
          return d.regionId === localRegionId || !d.regionId;
        }
        return true;
      })
      .map((d) => ({ value: d.id, label: d.name }));
  }, [divisions, localCompanyId, localOutletId, localRegionId]);

  useEffect(() => {
    if (!stickyDivisionId && divisionOptions.length > 0) {
      setStickyDivisionId(divisionOptions[0].value);
    }
  }, [divisionOptions, stickyDivisionId]);

  const rawMaterialOptions = useMemo(() => {
    return products
      .filter((p) => p.status === "Aktif" && !p.isExpense)
      .map((p) => ({ value: p.id, label: p.name }));
  }, [products]);

  const availableRecipeOptions = useMemo(() => {
    return recipes
      .filter((r) => r.isActive !== false)
      .map((r) => ({
        value: r.id,
        label: `${r.name} (HPP: Rp ${(r.totalHppCost || 0).toLocaleString()} / ${r.uomName || "PORSI"})`,
      }));
  }, [recipes]);

  const selectedSpoilProduct = useMemo(() => {
    return products.find((p) => p.id === spoilItemId);
  }, [products, spoilItemId]);

  const selectedRecipe = useMemo(() => {
    return recipes.find((r) => r.id === wasteRecipeId);
  }, [recipes, wasteRecipeId]);

  // Deteksi Varian Kemasan
  const availableVariants = useMemo(() => {
    if (
      !selectedSpoilProduct?.uomConversions ||
      !Array.isArray(selectedSpoilProduct.uomConversions)
    ) {
      return [];
    }
    return selectedSpoilProduct.uomConversions.filter(
      (c: any) => Number(c.value) > 0 && c.uom,
    );
  }, [selectedSpoilProduct]);

  useEffect(() => {
    if (availableVariants.length > 0) {
      const def =
        availableVariants.find((v: any) => v.isDefault) || availableVariants[0];
      setSpoilVariantId(def.id);
    } else {
      setSpoilVariantId("");
    }
  }, [availableVariants]);

  const selectedVariant = useMemo(() => {
    return (
      availableVariants.find((v: any) => v.id === spoilVariantId) ||
      availableVariants[0] ||
      null
    );
  }, [availableVariants, spoilVariantId]);

  const spoilBaseUnitCost = useMemo(() => {
    if (!selectedSpoilProduct?.pricing) return 0;
    const scopeKey =
      localOutletId || localRegionId || localCompanyId || "DEFAULT";
    const pricing =
      selectedSpoilProduct.pricing[scopeKey] ||
      selectedSpoilProduct.pricing[
        Object.keys(selectedSpoilProduct.pricing)[0]
      ] ||
      {};
    return pricing.basePrice || 0;
  }, [selectedSpoilProduct, localOutletId, localRegionId, localCompanyId]);

  const spoilBaseUomName = useMemo(() => {
    if (!selectedSpoilProduct) return "KG";
    return uoms.find((u) => u.id === selectedSpoilProduct.uomId)?.name || "KG";
  }, [selectedSpoilProduct, uoms]);

  // Preview Kalkulasi
  const spoilCalculationPreview = useMemo(() => {
    if (!selectedSpoilProduct || Number(spoilQty) <= 0) return null;
    return calculatePackagingLossCost(
      Number(spoilQty),
      spoilUom,
      spoilBaseUomName,
      spoilBaseUnitCost,
      selectedVariant
        ? { value: selectedVariant.value, uom: selectedVariant.uom }
        : null,
    );
  }, [
    selectedSpoilProduct,
    spoilQty,
    spoilUom,
    spoilBaseUomName,
    spoilBaseUnitCost,
    selectedVariant,
  ]);

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const divisionObj = divisions.find((d) => d.id === stickyDivisionId);
    const divisionName = divisionObj ? divisionObj.name : "KITCHEN";

    if (entryMode === "SPOIL") {
      if (!spoilItemId || Number(spoilQty) <= 0) {
        return sysToast.error("Error", "Pilih bahan baku dan isi jumlah qty!");
      }
      const lossResult = calculatePackagingLossCost(
        Number(spoilQty),
        spoilUom,
        spoilBaseUomName,
        spoilBaseUnitCost,
        selectedVariant
          ? { value: selectedVariant.value, uom: selectedVariant.uom }
          : null,
      );

      try {
        await globalCommandBus.execute({
          type: "CREATE_SPOIL_WASTE",
          payload: {
            companyId: localCompanyId,
            regionId: localRegionId,
            outletId: localOutletId,
            date: stickyDate,
            type: "SPOIL",
            divisionId: stickyDivisionId,
            divisionName,
            totalLossCost: lossResult.totalCost,
            spoilItems: [
              {
                id: `SPW_${Date.now()}`,
                itemId: spoilItemId,
                itemName: selectedSpoilProduct?.name || "Bahan",
                inputQty: Number(spoilQty),
                inputUom: spoilUom,
                convertedBaseQty: lossResult.convertedBaseQty,
                baseUom: spoilBaseUomName,
                variantInfo: selectedVariant
                  ? `${selectedVariant.value} ${selectedVariant.uom}`
                  : null,
                unitCost: spoilBaseUnitCost,
                totalLossCost: lossResult.totalCost,
                notes: spoilNote.trim()
                  ? spoilNote.toUpperCase().trim()
                  : "Bahan Basi/Rusak",
              },
            ],
          },
        });
        sysToast.success(
          "Spoil Tercatat",
          `Kerugian ${Number(spoilQty)} ${spoilUom} "${selectedSpoilProduct?.name}" (Rp ${lossResult.totalCost.toLocaleString()}) dicatat.`,
        );
        setSpoilItemId("");
        setSpoilQty(1);
        setSpoilNote("");
      } catch (err: any) {
        sysToast.error("Gagal", err.message);
      }
    } else {
      // Mode Waste
      if (!selectedRecipe || Number(wastePortionQty) <= 0) {
        return sysToast.error("Error", "Pilih menu hidangan yang gagal!");
      }
      const portionMultiplier = Number(wastePortionQty);
      const totalMenuLoss = Math.round(
        (selectedRecipe.totalHppCost || 0) * portionMultiplier,
      );
      const convertedIngredients: any[] = [];

      (selectedRecipe.rawMaterials || []).forEach((ing: any) => {
        const ingProduct = products.find((p) => p.id === ing.itemId);
        const ingBaseUom =
          uoms.find((u) => u.id === ingProduct?.uomId)?.name ||
          ing.baseUom ||
          ing.uomName ||
          "KG";
        const matchingVariant = Array.isArray(ingProduct?.uomConversions)
          ? ingProduct.uomConversions.find(
              (v: any) =>
                ing.variantInfo && `${v.value} ${v.uom}` === ing.variantInfo,
            ) ||
            ingProduct.uomConversions.find((v: any) => v.isDefault) ||
            ingProduct.uomConversions[0]
          : null;

        const requiredQty = Number(ing.qty) * portionMultiplier;
        const { convertedBaseQty, totalCost } = calculatePackagingLossCost(
          requiredQty,
          ing.uomName,
          ingBaseUom,
          Number(ing.unitCost || 0),
          matchingVariant
            ? { value: matchingVariant.value, uom: matchingVariant.uom }
            : null,
        );

        convertedIngredients.push({
          id: `SPW_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          menuItemId: selectedRecipe.id,
          menuItemName: selectedRecipe.name,
          menuPortionQty: portionMultiplier,
          itemId: ing.itemId,
          itemName: ing.itemName,
          inputQty: requiredQty,
          inputUom: ing.uomName,
          convertedBaseQty,
          baseUom: ingBaseUom,
          unitCost: ing.unitCost,
          totalLossCost: totalCost,
          notes: `Waste Menu [${selectedRecipe.name} x${portionMultiplier}]: ${wasteNote || "Gagal Masak"}`,
        });
      });

      (selectedRecipe.subRecipes || []).forEach((sub: any) => {
        const subQty = Number(sub.qty) * portionMultiplier;
        const subLoss = Math.round(Number(sub.unitCost || 0) * subQty);
        convertedIngredients.push({
          id: `SPW_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          menuItemId: selectedRecipe.id,
          menuItemName: selectedRecipe.name,
          menuPortionQty: portionMultiplier,
          itemId: sub.recipeId,
          itemName: sub.recipeName,
          inputQty: subQty,
          inputUom: sub.uomName || "PORSI",
          convertedBaseQty: subQty,
          baseUom: sub.uomName || "PORSI",
          unitCost: sub.unitCost,
          totalLossCost: subLoss,
          notes: `Waste Sub-Menu [${sub.recipeName} x${subQty}]: ${wasteNote || "Gagal Masak"}`,
        });
      });

      try {
        await globalCommandBus.execute({
          type: "CREATE_SPOIL_WASTE",
          payload: {
            companyId: localCompanyId,
            regionId: localRegionId,
            outletId: localOutletId,
            date: stickyDate,
            type: "WASTE",
            divisionId: stickyDivisionId,
            divisionName,
            menuItemId: selectedRecipe.id,
            menuItemName: selectedRecipe.name,
            menuPortionQty: portionMultiplier,
            totalLossCost: totalMenuLoss,
            spoilItems: convertedIngredients,
          },
        });
        sysToast.success(
          "Waste Menu Tercatat",
          `${portionMultiplier} ${selectedRecipe.uomName} "${selectedRecipe.name}" diurai (${convertedIngredients.length} bahan). Rugi Rp ${totalMenuLoss.toLocaleString()}.`,
        );
        setWasteRecipeId("");
        setWastePortionQty(1);
        setWasteNote("");
      } catch (err: any) {
        sysToast.error("Gagal", err.message);
      }
    }
  };

  const filteredList = useMemo(() => {
    return spoilWastes.filter((sw) => {
      // 1. Penyekatan Company & Region
      if (localCompanyId && sw.companyId && sw.companyId !== localCompanyId)
        return false;
      if (localRegionId && sw.regionId && sw.regionId !== localRegionId)
        return false;

      // 2. Penyekatan Outlet
      if (localOutletId) {
        if (sw.outletId && sw.outletId !== localOutletId) return false;
      } else if (filterOutletId) {
        if (sw.outletId !== filterOutletId) return false;
      }

      // 3. Status Aktif vs Arsip (default AKTIF, tanpa UI toggle di mobile)
      const isItemActive =
        sw.isActive !== undefined ? sw.isActive : sw.isActive;
      const matchStatus = isItemActive !== false; // hanya tampilkan aktif
      const matchType = filterType === "ALL" ? true : sw.type === filterType;

      return matchStatus && matchType;
    });
  }, [
    spoilWastes,
    filterType,
    localOutletId,
    localRegionId,
    localCompanyId,
    filterOutletId,
  ]);

  const totalLossPeriod = useMemo(() => {
    return filteredList.reduce((sum, it) => sum + (it.totalLossCost || 0), 0);
  }, [filteredList]);

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {/* HEADER MOBILE */}
      <div className="p-3 bg-(--bg-card) border-b border-(--border-color) shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-500" />
            <div>
              <h2 className="text-sm font-black text-(--text-primary) uppercase tracking-wide">
                Spoil &amp; Waste
              </h2>
              <span className="text-[10px] text-(--text-secondary) font-bold">
                {outletName}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsAddFormOpen(!isAddFormOpen)}
            className={`p-1.5 text-xs font-black rounded-lg border flex items-center gap-1 ${
              isAddFormOpen
                ? "bg-rose-500 text-white border-rose-500"
                : "bg-(--bg-input) text-(--text-secondary) border-(--border-color)"
            }`}
          >
            <Plus className="w-4 h-4" /> {isAddFormOpen ? "Tutup" : "Catat"}
          </button>
        </div>

        {/* MODE TOGGLE: SPOIL vs WASTE */}
        <div className="grid grid-cols-2 gap-1 bg-(--bg-input) p-1 rounded-xl border border-(--border-color)">
          <button
            type="button"
            onClick={() => setEntryMode("SPOIL")}
            className={`py-1.5 text-xs font-black rounded-lg transition flex items-center justify-center gap-1 ${
              entryMode === "SPOIL"
                ? "bg-rose-500 text-white shadow-xs"
                : "text-(--text-secondary)"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" /> SPOIL (BAHAN MENTAH)
          </button>
          <button
            type="button"
            onClick={() => setEntryMode("WASTE")}
            className={`py-1.5 text-xs font-black rounded-lg transition flex items-center justify-center gap-1 ${
              entryMode === "WASTE"
                ? "bg-orange-500 text-white shadow-xs"
                : "text-(--text-secondary)"
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" /> WASTE (MENU GAGAL)
          </button>
        </div>

        {/* Total Kerugian Banner */}
        <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between">
          <span className="text-[10px] font-black uppercase text-(--text-secondary)">
            Total Kerugian HPP:
          </span>
          <span className="font-mono font-black text-rose-500 text-xs">
            Rp {totalLossPeriod.toLocaleString()}
          </span>
        </div>
      </div>

      {/* QUICK FORM MOBILE (COLLAPSIBLE) */}
      {isAddFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="p-3 bg-(--surface-hover) border-b border-(--border-color) shrink-0 space-y-2.5 animate-in slide-in-from-top-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                Tanggal (Sticky)
              </label>
              <input
                type="date"
                required
                value={stickyDate}
                onChange={(e) => setStickyDate(e.target.value)}
                className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                Divisi Terkait (Sticky)
              </label>
              <select
                value={stickyDivisionId}
                onChange={(e) => setStickyDivisionId(e.target.value)}
                required
                className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
              >
                {divisionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {entryMode === "SPOIL" ? (
            /* MODE 1: SPOIL */
            <div className="space-y-2">
              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Pilih Bahan Baku Mentah
                </label>
                <UniversalCombobox
                  options={rawMaterialOptions}
                  value={spoilItemId}
                  onChange={setSpoilItemId}
                  placeholder="Pilih nama bahan..."
                  dropdownDirection="bottom"
                />
              </div>

              {availableVariants.length > 0 && (
                <div>
                  <label className="block text-[9px] font-black text-orange-500 uppercase mb-0.5">
                    Kemasan Master
                  </label>
                  <select
                    value={spoilVariantId}
                    onChange={(e) => setSpoilVariantId(e.target.value)}
                    className="w-full text-xs font-black p-2 bg-(--bg-input) text-orange-500 border border-orange-500/30 rounded-lg outline-none"
                  >
                    {availableVariants.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.value} {v.uom} {v.isDefault ? "★" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                    Takaran Rusak
                  </label>
                  <input
                    type="number"
                    required
                    min={0.001}
                    step="any"
                    value={spoilQty}
                    onChange={(e) =>
                      setSpoilQty(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none text-center font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                    Satuan Takar
                  </label>
                  <select
                    value={spoilUom}
                    onChange={(e) => setSpoilUom(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
                  >
                    {MEASURE_UOMS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {spoilCalculationPreview && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-bold flex items-center justify-between text-rose-500">
                  <div className="flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-orange-500" />
                    <span className="font-mono">
                      {spoilCalculationPreview.convertedStandardQty}{" "}
                      {spoilCalculationPreview.standardUom}
                    </span>
                  </div>
                  <span className="font-mono font-black">
                    Rugi: Rp{" "}
                    {spoilCalculationPreview.totalCost.toLocaleString()}
                  </span>
                </div>
              )}

              <div>
                <input
                  type="text"
                  value={spoilNote}
                  onChange={(e) => setSpoilNote(e.target.value)}
                  placeholder="Alasan (Basi / Jatuh / Tumpah)..."
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none placeholder:text-[10px]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs uppercase rounded-lg shadow-sm"
              >
                Simpan Spoil Bahan
              </button>
            </div>
          ) : (
            /* MODE 2: WASTE MENU GAGAL */
            <div className="space-y-2">
              <div>
                <label className="block text-[9px] font-black text-orange-500 uppercase mb-0.5">
                  Pilih Menu Gagal Masak (Resep BOM)
                </label>
                <UniversalCombobox
                  options={availableRecipeOptions}
                  value={wasteRecipeId}
                  onChange={setWasteRecipeId}
                  placeholder="Pilih menu..."
                  dropdownDirection="bottom"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Jumlah Porsi Gagal
                </label>
                <input
                  type="number"
                  required
                  min={0.1}
                  step="any"
                  value={wastePortionQty}
                  onChange={(e) =>
                    setWastePortionQty(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none text-center font-mono"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={wasteNote}
                  onChange={(e) => setWasteNote(e.target.value)}
                  placeholder="Penyebab (Gosong / Terlalu asin)..."
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none placeholder:text-[10px]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase rounded-lg shadow-sm"
              >
                Simpan Waste Menu
              </button>
            </div>
          )}
        </form>
      )}

      {/* FILTER TIPE & OUTLET (Untuk Region/Company) */}
      <div className="px-3 py-2 bg-(--bg-card) border-b border-(--border-color) flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-(--text-secondary)" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="text-xs font-bold p-1.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
          >
            <option value="ALL">SEMUA TIPE</option>
            <option value="SPOIL">HANYA SPOIL</option>
            <option value="WASTE">HANYA WASTE</option>
          </select>
        </div>

        {/* Filter Outlet untuk Region/Company (hanya jika bukan level outlet) */}
        {!localOutletId && (
          <select
            value={filterOutletId}
            onChange={(e) => setFilterOutletId(e.target.value)}
            className="text-xs font-black p-1.5 bg-(--bg-input) text-orange-500 border border-orange-500/30 rounded-lg outline-none cursor-pointer"
          >
            <option value="">-- SEMUA OUTLET --</option>
            {outlets
              .filter(
                (o) =>
                  o.status === "Aktif" &&
                  (!localRegionId || o.regionId === localRegionId),
              )
              .map((o) => (
                <option key={o.id} value={o.id}>
                  OUTLET: {o.name}
                </option>
              ))}
          </select>
        )}
      </div>

      {/* DAFTAR DATA KERUGIAN (KARTU MOBILE) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {filteredList.map((doc) => (
          <div
            key={doc.id}
            className="bg-(--bg-card) border border-(--border-color) rounded-xl p-3 shadow-xs space-y-2"
          >
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                    doc.type === "SPOIL"
                      ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                  }`}
                >
                  {doc.type}
                </span>
                <div className="font-bold text-xs text-(--text-primary) mt-1">
                  {doc.itemName}
                </div>
                {doc.menuItemName && (
                  <div className="text-[10px] text-orange-500 font-semibold">
                    Menu: {doc.menuItemName} (x{doc.menuPortionQty} Porsi)
                  </div>
                )}
                {doc.notes && (
                  <div className="text-[10px] text-(--text-secondary) italic mt-0.5">
                    "{doc.notes}"
                  </div>
                )}
              </div>

              <span className="text-[10px] font-mono text-(--text-secondary)">
                {new Date(doc.date).toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-(--border-color) text-xs">
              <div>
                <span className="text-[9px] text-(--text-secondary) block">
                  Terbuang:
                </span>
                <span className="font-mono font-bold text-rose-500 text-xs">
                  {doc.inputQty} {doc.inputUom}
                </span>
                {/* Tampilkan konversi jika UOM input berbeda dengan base UOM */}
                {doc.inputUom !== doc.baseUom && (
                  <span className="block text-[9px] text-(--text-secondary) font-mono">
                    (= {doc.convertedBaseQty} {doc.baseUom})
                  </span>
                )}
              </div>

              <div className="text-right">
                <span className="text-[9px] text-(--text-secondary) block">
                  HPP Satuan:
                </span>
                <span className="font-mono font-bold text-(--text-secondary) text-xs">
                  Rp {(doc.unitCost || 0).toLocaleString()}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[9px] text-(--text-secondary) block">
                  Kerugian HPP:
                </span>
                <span className="font-mono font-black text-rose-500 text-xs">
                  Rp {(doc.totalLossCost || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}

        {filteredList.length === 0 && (
          <div className="p-8 text-center text-(--text-secondary) font-bold text-xs italic">
            Belum ada catatan spoil &amp; waste pada filter ini.
          </div>
        )}
      </div>
    </div>
  );
}
