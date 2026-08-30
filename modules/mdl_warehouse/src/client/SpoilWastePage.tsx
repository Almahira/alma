// File: modules/mdl_warehouse/src/client/SpoilWastePage.tsx
import React, { useState, useMemo } from "react";
import { Flame, Trash2, Filter, UtensilsCrossed } from "lucide-react";
import { useWarehouseStore } from "./store";
import { useItemStore } from "../../../mdl_item/src/client/store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { UniversalCombobox } from "../../../../apps/client_unv/src/shared-ui/UniversalCombobox";
import { STANDARD_UOMS, calculateLossCost } from "../shared/uomConverter";

export function SpoilWastePage() {
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

  // Toggle Mode: SPOIL (Bahan Mentah Basi) vs WASTE (Menu Jadi Gagal)
  const [entryMode, setEntryMode] = useState<"SPOIL" | "WASTE">("SPOIL");
  const [viewStatus, setViewStatus] = useState<"AKTIF" | "ARSIP">("AKTIF");

  // Sticky State Form
  const [stickyDate, setStickyDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [stickyDivisionId, setStickyDivisionId] = useState("");

  // Input Spoil (Bahan Baku Langsung)
  const [spoilItemId, setSpoilItemId] = useState("");
  const [spoilQty, setSpoilQty] = useState<number | "">(1);
  const [spoilUom, setSpoilUom] = useState("GRAM");
  const [spoilNote, setSpoilNote] = useState("");

  // Input Waste (Menu Jadi yang Terurai via Resep BOM)
  const [wasteRecipeId, setWasteRecipeId] = useState("");
  const [wastePortionQty, setWastePortionQty] = useState<number | "">(1);
  const [wasteNote, setWasteNote] = useState("");

  // Filter List
  const [filterType, setFilterType] = useState<"ALL" | "SPOIL" | "WASTE">(
    "ALL",
  );

  const divisionOptions = useMemo(() => {
    return divisions
      .filter(
        (d) =>
          d.status === "Aktif" &&
          (!localCompanyId || d.companyId === localCompanyId),
      )
      .map((d) => ({ value: d.id, label: d.name }));
  }, [divisions, localCompanyId]);

  React.useEffect(() => {
    if (!stickyDivisionId && divisionOptions.length > 0) {
      setStickyDivisionId(divisionOptions[0].value);
    }
  }, [divisionOptions, stickyDivisionId]);

  // Opsi Bahan Mentah (Hanya Barang Stok)
  const rawMaterialOptions = useMemo(() => {
    return products
      .filter((p) => p.status === "Aktif" && !p.isExpense)
      .map((p) => ({ value: p.id, label: p.name }));
  }, [products]);

  // ---> PERBAIKAN TS: Membaca r.name dan r.totalHppCost <---
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

  // Base HPP Produk Terpilih
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

  // SUBMIT FORM SPOIL / WASTE
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const divisionObj = divisions.find((d) => d.id === stickyDivisionId);
    const divisionName = divisionObj ? divisionObj.name : "KITCHEN";

    if (entryMode === "SPOIL") {
      if (!spoilItemId || Number(spoilQty) <= 0) {
        return sysToast.error("Error", "Pilih bahan baku dan isi jumlah qty!");
      }

      const { convertedQty, totalCost } = calculateLossCost(
        Number(spoilQty),
        spoilUom,
        spoilBaseUomName,
        spoilBaseUnitCost,
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
            totalLossCost: totalCost,
            spoilItems: [
              {
                id: `SPW_${Date.now()}`,
                itemId: spoilItemId,
                itemName: selectedSpoilProduct?.name || "Bahan",
                inputQty: Number(spoilQty),
                inputUom: spoilUom,
                convertedBaseQty: convertedQty,
                baseUom: spoilBaseUomName,
                unitCost: spoilBaseUnitCost,
                totalLossCost: totalCost,
                notes: spoilNote.trim()
                  ? spoilNote.toUpperCase().trim()
                  : "Bahan Basi/Rusak",
              },
            ],
          },
        });

        sysToast.success(
          "Spoil Tercatat",
          `Kerugian bahan ${Number(spoilQty)} ${spoilUom} "${selectedSpoilProduct?.name}" (Rp ${totalCost.toLocaleString()}) dicatat.`,
        );

        setSpoilItemId("");
        setSpoilQty(1);
        setSpoilNote("");
      } catch (err: any) {
        sysToast.error("Gagal", err.message);
      }
    } else {
      // MODE WASTE (MENU JADI GAGAL -> DIURAIKAN RESEP)
      if (!selectedRecipe || Number(wastePortionQty) <= 0) {
        return sysToast.error("Error", "Pilih menu hidangan yang gagal!");
      }

      const portionMultiplier = Number(wastePortionQty);
      const totalMenuLoss = Math.round(
        (selectedRecipe.totalHppCost || 0) * portionMultiplier,
      );

      const convertedIngredients: any[] = [];

      // 1. Uraikan Bahan Baku Mentah
      (selectedRecipe.rawMaterials || []).forEach((ing: any) => {
        const ingProduct = products.find((p) => p.id === ing.itemId);
        const ingBaseUom =
          uoms.find((u) => u.id === ingProduct?.uomId)?.name ||
          ing.uomName ||
          "KG";
        const requiredQty = Number(ing.qty) * portionMultiplier;

        const { convertedQty, totalCost } = calculateLossCost(
          requiredQty,
          ing.uomName,
          ingBaseUom,
          ing.unitCost,
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
          convertedBaseQty: convertedQty,
          baseUom: ingBaseUom,
          unitCost: ing.unitCost,
          totalLossCost: totalCost,
          notes: `Waste Menu [${selectedRecipe.name} x${portionMultiplier} ${selectedRecipe.uomName}]: ${wasteNote || "Gagal Masak"}`,
        });
      });

      // 2. Uraikan Sub-Resep Jadi (jika ada)
      (selectedRecipe.subRecipes || []).forEach((sub: any) => {
        const subQty = Number(sub.qty) * portionMultiplier;
        const subLoss = Math.round(Number(sub.unitCost) * subQty);

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
          `${portionMultiplier} ${selectedRecipe.uomName} "${selectedRecipe.name}" terurai menjadi ${convertedIngredients.length} komponen bahan (Rugi Rp ${totalMenuLoss.toLocaleString()}).`,
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
      const matchStatus =
        viewStatus === "AKTIF" ? sw.isActive !== false : sw.isActive === false;
      const matchType = filterType === "ALL" ? true : sw.type === filterType;
      return matchStatus && matchType;
    });
  }, [spoilWastes, viewStatus, filterType]);

  const totalLossPeriod = useMemo(() => {
    return filteredList.reduce((sum, it) => sum + (it.totalLossCost || 0), 0);
  }, [filteredList]);

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {/* HEADER & TOGGLE INPUT FORM */}
      <div className="p-5 bg-(--surface-hover) border-b border-(--border-color) shrink-0 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Flame className="w-5 h-5 text-rose-500" />
            <div>
              <h2 className="text-base font-black text-(--text-primary) tracking-tight">
                Pencatatan Spoil &amp; Waste (Beban Kerugian Bahan)
              </h2>
              <p className="text-[11px] text-(--text-secondary) font-bold">
                {outletName} • Otomatis memotong stok gudang &amp; mencatat
                beban HPP
              </p>
            </div>
          </div>

          {/* TOGGLE PILIH INPUT: SPOIL BAHAN vs WASTE MENU */}
          <div className="flex items-center bg-(--bg-input) p-1 rounded-xl border border-(--border-color)">
            <button
              onClick={() => setEntryMode("SPOIL")}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                entryMode === "SPOIL"
                  ? "bg-rose-500 text-white shadow-xs"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" /> SPOIL (BAHAN MENTAH)
            </button>
            <button
              onClick={() => setEntryMode("WASTE")}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                entryMode === "WASTE"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" /> WASTE (MENU JADI
              GAGAL)
            </button>
          </div>
        </div>

        {/* FORM QUICK-ADD */}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
        >
          <div className="sm:col-span-2">
            <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-1">
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

          <div className="sm:col-span-2">
            <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-1">
              Divisi Terkait
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

          {/* FORM MODE 1: SPOIL BAHAN BAKU */}
          {entryMode === "SPOIL" ? (
            <>
              <div className="sm:col-span-3">
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-1">
                  Pilih Bahan Baku (Basi/Rusak)
                </label>
                <UniversalCombobox
                  options={rawMaterialOptions}
                  value={spoilItemId}
                  onChange={setSpoilItemId}
                  placeholder="Pilih nama bahan..."
                />
              </div>

              <div className="sm:col-span-2 flex gap-1">
                <div className="w-16">
                  <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-1">
                    Qty
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
                <div className="flex-1">
                  <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-1">
                    UOM Terkunci
                  </label>
                  <select
                    value={spoilUom}
                    onChange={(e) => setSpoilUom(e.target.value)}
                    className="w-full text-xs font-black p-2 bg-(--bg-input) text-orange-500 border border-(--border-color) rounded-lg outline-none"
                  >
                    {STANDARD_UOMS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-1">
                  Alasan / Catatan
                </label>
                <input
                  type="text"
                  value={spoilNote}
                  onChange={(e) => setSpoilNote(e.target.value)}
                  placeholder="Basi / Jamuran / Jatuh..."
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none placeholder:text-[11px]"
                />
              </div>
            </>
          ) : (
            /* FORM MODE 2: WASTE MENU JADI */
            <>
              <div className="sm:col-span-4">
                <label className="block text-[9px] font-black text-orange-500 uppercase mb-1">
                  Pilih Menu Gagal Masak (Data Resep BOM)
                </label>
                <UniversalCombobox
                  options={availableRecipeOptions}
                  value={wasteRecipeId}
                  onChange={setWasteRecipeId}
                  placeholder="Pilih menu hidangan gagal..."
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-1">
                  Porsi
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

              <div className="sm:col-span-2">
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-1">
                  Penyebab Gagal
                </label>
                <input
                  type="text"
                  value={wasteNote}
                  onChange={(e) => setWasteNote(e.target.value)}
                  placeholder="Gosong / Tumpah..."
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none placeholder:text-[11px]"
                />
              </div>
            </>
          )}

          <div className="sm:col-span-1">
            <button
              type="submit"
              className={`w-full py-2 text-white font-black text-xs rounded-lg transition shadow-md cursor-pointer ${
                entryMode === "SPOIL"
                  ? "bg-rose-500 hover:bg-rose-600"
                  : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              SIMPAN
            </button>
          </div>
        </form>
      </div>

      {/* FILTER & TABEL LEDGER KERUGIAN */}
      <div className="px-6 py-3 bg-(--bg-card) border-b border-(--border-color) flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-(--text-secondary)" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-xl outline-none"
          >
            <option value="ALL">-- SEMUA TIPE (SPOIL &amp; WASTE) --</option>
            <option value="SPOIL">HANYA SPOIL (BAHAN MENTAH)</option>
            <option value="WASTE">HANYA WASTE (MENU GAGAL)</option>
          </select>
        </div>

        <div className="text-xs font-black text-(--text-secondary)">
          TOTAL KERUGIAN HPP:{" "}
          <span className="font-mono text-rose-500 text-sm">
            Rp {totalLossPeriod.toLocaleString()}
          </span>
        </div>
      </div>

      {/* TABEL LEDGER */}
      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
        <div className="bg-(--bg-card) border border-(--border-color) rounded-2xl shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black text-(--text-secondary) tracking-wider">
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3 text-center">Tipe</th>
                <th className="px-4 py-3">Bahan Baku / Menu Terkait</th>
                <th className="px-4 py-3 text-center">Jumlah Terbuang</th>
                <th className="px-4 py-3 text-right">HPP Satuan</th>
                <th className="px-4 py-3 text-right text-rose-500">
                  Total Kerugian (Rp)
                </th>
                <th className="px-4 py-3">Alasan / Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--border-color) text-xs font-semibold text-(--text-primary)">
              {filteredList.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-(--surface-hover) transition"
                >
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {new Date(doc.date).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </td>

                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                        doc.type === "SPOIL"
                          ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                          : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                      }`}
                    >
                      {doc.type}
                    </span>
                  </td>

                  <td className="px-4 py-2.5">
                    <div className="font-bold text-(--text-primary)">
                      {doc.itemName}
                    </div>
                    {doc.menuItemName && (
                      <div className="text-[10px] text-orange-500 font-semibold">
                        Dari Menu: {doc.menuItemName} (x{doc.menuPortionQty}{" "}
                        Porsi)
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-2.5 text-center font-mono font-bold text-rose-500">
                    {doc.inputQty} {doc.inputUom}
                    {doc.inputUom !== doc.baseUom && (
                      <span className="text-[9px] text-(--text-secondary) block">
                        (= {doc.convertedBaseQty} {doc.baseUom})
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-2.5 text-right font-mono text-(--text-secondary)">
                    Rp {(doc.unitCost || 0).toLocaleString()}
                  </td>

                  <td className="px-4 py-2.5 text-right font-mono font-black text-rose-500">
                    Rp {(doc.totalLossCost || 0).toLocaleString()}
                  </td>

                  <td className="px-4 py-2.5 text-(--text-secondary) text-[11px] italic">
                    {doc.notes || "-"}
                  </td>
                </tr>
              ))}
              {filteredList.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-12 text-center text-(--text-secondary) font-bold text-xs italic"
                  >
                    Belum ada data spoil &amp; waste bahan baku.
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
