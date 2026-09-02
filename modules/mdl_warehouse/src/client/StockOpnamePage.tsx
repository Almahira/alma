// File: modules/mdl_warehouse/src/client/StockOpnamePage.tsx
import React, { useState, useMemo } from "react";
import {
  Scale,
  Plus,
  Printer,
  FileSpreadsheet,
  FileDown,
  Search,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  History,
  Lock,
  Layers,
} from "lucide-react";
import { useWarehouseStore } from "./store";
import { useItemStore } from "../../../mdl_item/src/client/store";
import { useReceivingStore } from "../../../mdl_receiving/src/client/store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayout";

import {
  printBlankOpnameChecklistPdf,
  printStockOpnameReportPdf,
} from "./features/pdf-warehouse";
import { exportExcelStockOpname } from "./features/excel-warehouse";

// Komponen Input Stok Awal Cepat
const InitialStockModal: React.FC<{
  item: any;
  currentInitial: number;
  onClose: () => void;
}> = ({ item, currentInitial, onClose }) => {
  const [qty, setQty] = useState<number | "">(currentInitial || 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const outletId = localStorage.getItem("__unv_outletId") || "";
    const companyId = localStorage.getItem("__unv_companyId") || "";

    try {
      await globalCommandBus.execute({
        type: "SET_INITIAL_STOCK",
        payload: {
          companyId,
          outletId,
          itemId: item.id,
          initialQty: Number(qty) || 0,
        },
      });
      sysToast.success("Berhasil", `Stok awal ${item.name} berhasil diset.`);
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <form onSubmit={handleSave} className="p-5 space-y-4 max-w-sm">
      <div className="border-b border-(--border-color) pb-2">
        <h4 className="font-black text-sm text-(--text-primary)">
          SET SALDO STOK AWAL
        </h4>
        <p className="text-xs text-orange-500 font-bold mt-0.5">{item.name}</p>
      </div>

      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Jumlah Stok Awal ({item.uomName || "PCS"})
        </label>
        <input
          type="number"
          required
          autoFocus
          value={qty}
          onChange={(e) =>
            setQty(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder="0"
          className="w-full text-base font-black p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none font-mono text-center"
        />
      </div>

      <div className="pt-3 flex justify-end gap-2 border-t border-(--border-color)">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-(--text-secondary) hover:bg-(--surface-hover) rounded-lg cursor-pointer"
        >
          BATAL
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-md cursor-pointer"
        >
          SIMPAN
        </button>
      </div>
    </form>
  );
};

export function StockOpnamePage() {
  const { distributions, initialStocks, opnames, spoilWastes } =
    useWarehouseStore();
  const { products, uoms, categories } = useItemStore();
  const { documents: receivingDocs } = useReceivingStore();
  const { outlets } = useOrgStore();
  const { openCenterModal, closeCenterModal, openAlert } = useUniversalModal();

  const [activeTab, setActiveTab] = useState<
    "ACTIVE_OPNAME" | "OPNAME_HISTORY"
  >("ACTIVE_OPNAME");
  const [opnameDate, setOpnameDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [searchTerm, setSearchTerm] = useState("");

  const localCompanyId = localStorage.getItem("__unv_companyId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";
  const currentOutlet = outlets.find((o) => o.id === localOutletId);
  const outletName = currentOutlet
    ? currentOutlet.name.toUpperCase()
    : "GUDANG OUTLET";

  // State Input Fisik & Catatan per Item
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>(
    {},
  );
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  // Cek apakah hari ini sudah pernah dilakukan closing opname
  const isAlreadyAdjustedToday = useMemo(() => {
    return opnames.some(
      (o) =>
        o.outletId === localOutletId &&
        o.date.startsWith(opnameDate) &&
        o.isActive !== false,
    );
  }, [opnames, localOutletId, opnameDate]);

  // =========================================================================
  // KALKULASI OTOMATIS MATRIKS INVENTORI PER ITEM
  // =========================================================================
  const opnameMatrix = useMemo(() => {
    // Hanya barang fisik (bukan jasa)
    const validProducts = products.filter(
      (p) => p.status === "Aktif" && !p.isExpense,
    );

    return validProducts.map((p) => {
      const uomName = uoms.find((u) => u.id === p.uomId)?.name || "PCS";
      const catName =
        categories.find((c) => c.id === p.categoryId)?.name || "-";

      // 1. Stok Awal (Baseline)
      const initialStockKey = `${localOutletId}_${p.id}`;
      const initialStock = initialStocks[initialStockKey] || 0;

      // 2. Stok Masuk (Receiving)
      const receivingItemsForProduct = receivingDocs
        .filter((doc) => {
          const matchOutlet = !localOutletId || doc.outletId === localOutletId;
          const matchActive =
            doc.status !== "CANCELLED" && doc.isActive !== false;
          return matchOutlet && matchActive;
        })
        .flatMap((doc) => doc.items || [])
        .filter((it) => it.itemId === p.id && !it.isExpense);

      const stockIn = receivingItemsForProduct.reduce(
        (sum, it) => sum + Number(it.receivedQty || it.qty || 0),
        0,
      );

      // 3. Stok Keluar (Distribusi Divisi)
      const stockOut = distributions
        .filter(
          (d) =>
            d.itemId === p.id &&
            d.outletId === localOutletId &&
            d.isActive !== false,
        )
        .reduce((sum, d) => sum + Number(d.qty || 0), 0);

      // 4. Stok Rusak / Basi / Terbuang (Spoil & Waste)
      const spoilWasteQty = spoilWastes
        .filter(
          (sw) =>
            sw.itemId === p.id &&
            sw.outletId === localOutletId &&
            sw.isActive !== false,
        )
        .reduce(
          (sum, sw) => sum + Number(sw.convertedBaseQty || sw.inputQty || 0),
          0,
        );

      // 5. Sisa Stok Sistem Riil (Termasuk Pengurangan Spoil & Waste)
      const rawSystemStock = initialStock + stockIn - stockOut - spoilWasteQty;
      const systemStock = parseFloat(rawSystemStock.toFixed(2));

      // 6. Harga HPP Terbaru & Trend Harga
      const scopeKey =
        localOutletId || localRegionId || localCompanyId || "DEFAULT";
      const pricing =
        p.pricing?.[scopeKey] ||
        p.pricing?.[Object.keys(p.pricing || {})[0]] ||
        {};
      const currentPrice = pricing.basePrice || 0;

      let previousPrice = currentPrice;
      if (receivingItemsForProduct.length > 1) {
        previousPrice =
          receivingItemsForProduct[receivingItemsForProduct.length - 2].price ||
          currentPrice;
      }

      // 7. Hitungan Fisik & Selisih
      const physicalStock =
        physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : systemStock;
      const varianceQty = physicalStock - systemStock;
      const varianceCost = varianceQty * currentPrice;
      const note = itemNotes[p.id] || "";

      return {
        id: p.id,
        itemId: p.id,
        itemName: p.name,
        categoryName: catName,
        uomName,
        uomConversions: p.uomConversions || [],
        initialStock,
        stockIn,
        stockOut,
        spoilWasteQty,
        systemStock,
        currentPrice,
        previousPrice,
        physicalStock,
        varianceQty,
        varianceCost,
        note,
      };
    });
  }, [
    products,
    uoms,
    categories,
    initialStocks,
    receivingDocs,
    distributions,
    spoilWastes,
    localOutletId,
    localRegionId,
    localCompanyId,
    physicalCounts,
    itemNotes,
  ]);

  // Filter Search
  const filteredMatrix = useMemo(() => {
    return opnameMatrix.filter(
      (item) =>
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.categoryName.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [opnameMatrix, searchTerm]);

  // Ringkasan Akumulasi Selisih
  const totalVarianceCost = useMemo(() => {
    return filteredMatrix.reduce((sum, it) => sum + it.varianceCost, 0);
  }, [filteredMatrix]);

  const totalVarianceQty = useMemo(() => {
    return filteredMatrix.reduce((sum, it) => sum + it.varianceQty, 0);
  }, [filteredMatrix]);

  // Handle Input Fisik per Item
  const handlePhysicalCountChange = (itemId: string, val: string) => {
    const num = val === "" ? 0 : Number(val);
    setPhysicalCounts((prev) => ({ ...prev, [itemId]: num }));
  };

  const handleNoteChange = (itemId: string, text: string) => {
    setItemNotes((prev) => ({ ...prev, [itemId]: text.toUpperCase() }));
  };

  // SUBMIT HASIL STOK OPNAME & ADJUST STOK
  const handleCompleteOpname = () => {
    openAlert({
      title: "Konfirmasi Simpan & Adjust Stok",
      message: `Seluruh angka fisik riil akan dibekukan sebagai Berita Acara resmi tanggal ${opnameDate}, dan otomatis menjadi Stok Awal (Baseline) baru. Lanjutkan?`,
      confirmText: "SIMPAN & ADJUST",
      onConfirm: async () => {
        try {
          const itemsPayload = opnameMatrix.map((it) => ({
            itemId: it.itemId,
            itemName: it.itemName,
            uomName: it.uomName,
            initialStock: it.initialStock,
            stockIn: it.stockIn,
            stockOut: it.stockOut,
            systemStock: it.systemStock,
            physicalStock: it.physicalStock,
            varianceQty: it.varianceQty,
            unitCost: it.currentPrice,
            previousUnitCost: it.previousPrice,
            varianceCost: it.varianceCost,
            notes: it.note || null,
          }));

          await globalCommandBus.execute({
            type: "COMPLETE_STOCK_OPNAME",
            payload: {
              companyId: localCompanyId,
              regionId: localRegionId,
              outletId: localOutletId,
              date: opnameDate,
              totalVarianceCost,
              totalVarianceQty,
              items: itemsPayload,
            },
          });

          sysToast.success(
            "Opname Selesai",
            `Berita Acara Opname ${opnameDate} tersimpan & stok sistem telah diselaraskan.`,
          );
        } catch (err: any) {
          sysToast.error("Gagal Menyimpan Opname", err.message);
        }
      },
    });
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {/* ========================================================================= */}
      {/* 1. HEADER & QUICK ACTION TOOLBAR */}
      {/* ========================================================================= */}
      <div className="p-5 bg-(--surface-hover) border-b border-(--border-color) shrink-0 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-black text-(--text-primary) tracking-tight flex items-center gap-2">
              <Scale className="w-5 h-5 text-orange-500" /> Stok Opname
              (Penyelarasan Fisik vs Sistem)
            </h2>
            <p className="text-[11px] text-(--text-secondary) font-bold mt-0.5">
              {outletName} • Tanggal: {opnameDate}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* CETAK LEMBAR BLANK CHECKLIST KERTAS */}
            <button
              onClick={() =>
                printBlankOpnameChecklistPdf(
                  products,
                  uoms,
                  categories,
                  outletName,
                )
              }
              className="px-3.5 py-2 bg-(--bg-card) border border-(--border-color) text-(--text-primary) hover:bg-(--surface-hover) rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Unduh Lembar Kertas Blank Checklist"
            >
              <Printer className="w-4 h-4 text-slate-400" /> CETAK FORM KERTAS
            </button>

            {/* EXPORT EXCEL HASIL OPNAME */}
            <button
              onClick={() => exportExcelStockOpname(opnameMatrix, opnameDate)}
              className="px-3.5 py-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" /> EXPORT EXCEL
            </button>

            {/* TOMBOL SIMPAN & ADJUST STOK */}
            {activeTab === "ACTIVE_OPNAME" && (
              <button
                onClick={handleCompleteOpname}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> SIMPAN &amp; ADJUST STOK
              </button>
            )}
          </div>
        </div>

        {/* STATISTIK RINGKASAN SELISIH */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-(--bg-card) rounded-xl border border-(--border-color)">
            <span className="text-[9px] font-black uppercase text-(--text-secondary) block">
              TOTAL ITEM DIHITUNG
            </span>
            <span className="text-sm font-black font-mono text-(--text-primary) block mt-0.5">
              {filteredMatrix.length} Produk
            </span>
          </div>

          <div className="p-3 bg-(--bg-card) rounded-xl border border-(--border-color)">
            <span className="text-[9px] font-black uppercase text-(--text-secondary) block">
              TOTAL SELISIH FISIK (QTY)
            </span>
            <span
              className={`text-sm font-black font-mono block mt-0.5 ${totalVarianceQty === 0 ? "text-slate-400" : totalVarianceQty < 0 ? "text-rose-500" : "text-emerald-500"}`}
            >
              {totalVarianceQty > 0 ? "+" : ""}
              {totalVarianceQty} Satuan
            </span>
          </div>

          <div className="p-3 bg-(--bg-card) rounded-xl border border-(--border-color)">
            <span className="text-[9px] font-black uppercase text-(--text-secondary) block">
              NILAI VARIANCE FINANSIAL (RP)
            </span>
            <span
              className={`text-sm font-black font-mono block mt-0.5 ${totalVarianceCost === 0 ? "text-slate-400" : totalVarianceCost < 0 ? "text-rose-500" : "text-emerald-500"}`}
            >
              Rp {totalVarianceCost.toLocaleString()}
            </span>
          </div>

          <div className="p-3 bg-(--bg-card) rounded-xl border border-(--border-color) flex items-center justify-between">
            <div>
              <span className="text-[9px] font-black uppercase text-(--text-secondary) block">
                STATUS HARI INI
              </span>
              <span
                className={`text-xs font-black uppercase block mt-0.5 ${isAlreadyAdjustedToday ? "text-emerald-500" : "text-amber-500"}`}
              >
                {isAlreadyAdjustedToday
                  ? "TER-ADJUSTED (LOCKED)"
                  : "BELUM CLOSING"}
              </span>
            </div>
            {isAlreadyAdjustedToday && (
              <Lock className="w-4 h-4 text-emerald-500" />
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FILTER & TABS */}
      {/* ========================================================================= */}
      <div className="px-6 py-3 bg-(--bg-card) border-b border-(--border-color) flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-(--bg-input) p-1 rounded-xl border border-(--border-color)">
            <button
              onClick={() => setActiveTab("ACTIVE_OPNAME")}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition cursor-pointer ${
                activeTab === "ACTIVE_OPNAME"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              LEMBAR KERJA OPNAME
            </button>
            <button
              onClick={() => setActiveTab("OPNAME_HISTORY")}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition cursor-pointer ${
                activeTab === "OPNAME_HISTORY"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              RIWAYAT BERITA ACARA ({opnames.length})
            </button>
          </div>

          {activeTab === "ACTIVE_OPNAME" && (
            <div className="flex items-center gap-2 bg-(--bg-input) border border-(--border-color) rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-orange-500" />
              <input
                type="date"
                value={opnameDate}
                onChange={(e) => setOpnameDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-(--text-primary) outline-none"
              />
            </div>
          )}
        </div>

        {activeTab === "ACTIVE_OPNAME" && (
          <div className="relative w-64">
            <Search className="w-4 h-4 text-(--text-secondary) absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama barang..."
              className="w-full text-xs font-bold pl-9 pr-3 py-2 bg-(--bg-input) border border-(--border-color) rounded-xl outline-none text-(--text-primary) placeholder:text-(--text-secondary)"
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. BODY TABEL MATRIKS OPNAME ATAU RIWAYAT */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
        {activeTab === "ACTIVE_OPNAME" ? (
          <div className="bg-(--bg-card) border border-(--border-color) rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black text-(--text-secondary) tracking-wider">
                  <th className="px-4 py-3">Nama Barang</th>
                  <th className="px-3 py-3 text-center">UOM</th>
                  <th className="px-3 py-3 text-center">Stok Awal</th>
                  <th className="px-3 py-3 text-center text-emerald-500">
                    Masuk
                  </th>
                  <th className="px-3 py-3 text-center text-rose-500">
                    Keluar
                  </th>
                  <th className="px-3 py-3 text-center text-amber-500">
                    Spoil
                  </th>
                  <th className="px-3 py-3 text-center font-bold">
                    Sisa Sistem
                  </th>
                  <th className="px-4 py-3 text-right">HPP &amp; Trend</th>
                  <th className="px-4 py-3 text-center w-28 text-orange-500">
                    Hitungan Fisik
                  </th>
                  <th className="px-3 py-3 text-center">Selisih</th>
                  <th className="px-4 py-3 text-right">Nilai Selisih</th>
                  <th className="px-4 py-3 w-40">Catatan Kondisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-color) text-xs font-semibold text-(--text-primary)">
                {filteredMatrix.map((item) => {
                  const isPriceUp = item.currentPrice > item.previousPrice;
                  const isPriceDown = item.currentPrice < item.previousPrice;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-(--surface-hover) transition"
                    >
                      {/* NAMA BARANG */}
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-(--text-primary)">
                          {item.itemName}
                        </div>
                        <div className="text-[10px] text-(--text-secondary)">
                          {item.categoryName}
                        </div>
                      </td>

                      {/* UOM */}
                      <td className="px-3 py-2.5 text-center font-mono text-(--text-secondary)">
                        <span className="font-bold block">{item.uomName}</span>
                        {Array.isArray(item.uomConversions) &&
                          item.uomConversions.length > 0 && (
                            <span className="text-[9px] text-orange-500 block">
                              ({item.uomConversions[0].value}{" "}
                              {item.uomConversions[0].uom})
                            </span>
                          )}
                      </td>

                      {/* STOK AWAL (BISA DI-SET JIKA BELUM PERNAH OPNAME / READ-ONLY JIKA SUDAH) */}
                      <td className="px-3 py-2.5 text-center font-mono">
                        {item.initialStock > 0 ? (
                          <span className="font-bold">{item.initialStock}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              openCenterModal({
                                title: "SET STOK AWAL",
                                content: (
                                  <InitialStockModal
                                    item={item}
                                    currentInitial={item.initialStock}
                                    onClose={closeCenterModal}
                                  />
                                ),
                              })
                            }
                            className="text-[9px] font-black bg-slate-800 text-white px-2 py-0.5 rounded hover:bg-slate-700 cursor-pointer"
                          >
                            + SET
                          </button>
                        )}
                      </td>

                      {/* STOK MASUK (RECEIVING) */}
                      <td className="px-3 py-2.5 text-center font-mono text-emerald-500 font-bold">
                        +{item.stockIn}
                      </td>

                      {/* STOK KELUAR (DISTRIBUSI) */}
                      <td className="px-3 py-2.5 text-center font-mono text-rose-500 font-bold">
                        -{item.stockOut}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-amber-500 font-bold">
                        -{item.spoilWasteQty}
                      </td>
                      {/* SISA SISTEM */}
                      <td className="px-3 py-2.5 text-center font-mono font-black text-(--text-primary) bg-(--bg-input)/50">
                        {item.systemStock}
                      </td>

                      {/* HARGA TERBARU & INDIKATOR TREND */}
                      <td className="px-4 py-2.5 text-right font-mono">
                        <div className="font-bold">
                          Rp {item.currentPrice.toLocaleString()}
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          {isPriceUp ? (
                            <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-1 py-0.2 rounded inline-flex items-center gap-0.5">
                              <TrendingUp className="w-2.5 h-2.5" /> NAIK
                            </span>
                          ) : isPriceDown ? (
                            <span className="text-[8px] font-black text-rose-500 bg-rose-500/10 px-1 py-0.2 rounded inline-flex items-center gap-0.5">
                              <TrendingDown className="w-2.5 h-2.5" /> TURUN
                            </span>
                          ) : (
                            <span className="text-[8px] font-bold text-slate-400 inline-flex items-center gap-0.5">
                              <Minus className="w-2.5 h-2.5" /> STABIL
                            </span>
                          )}
                        </div>
                      </td>

                      {/* HITUNGAN FISIK RIIL (INPUT NUMBER) */}
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          step="any"
                          data-unv-numpad="true"
                          value={item.physicalStock}
                          onChange={(e) =>
                            handlePhysicalCountChange(item.id, e.target.value)
                          }
                          className="w-20 text-center font-mono font-black text-sm p-1.5 bg-(--bg-input) border-2 border-orange-500/40 focus:border-orange-500 rounded-lg outline-none text-(--text-primary)"
                        />
                      </td>

                      {/* SELISIH (VARIANCE QTY) */}
                      <td className="px-3 py-2.5 text-center font-mono font-black">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            item.varianceQty === 0
                              ? "bg-slate-500/10 text-slate-400"
                              : item.varianceQty < 0
                                ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          }`}
                        >
                          {item.varianceQty > 0 ? "+" : ""}
                          {item.varianceQty}
                        </span>
                      </td>

                      {/* NILAI SELISIH FINANSIAL (RP) */}
                      <td
                        className={`px-4 py-2.5 text-right font-mono font-bold ${
                          item.varianceCost === 0
                            ? "text-slate-400"
                            : item.varianceCost < 0
                              ? "text-rose-500"
                              : "text-emerald-500"
                        }`}
                      >
                        Rp {item.varianceCost.toLocaleString()}
                      </td>

                      {/* CATATAN ALASAN SELISIH */}
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={item.note}
                          onChange={(e) =>
                            handleNoteChange(item.id, e.target.value)
                          }
                          placeholder="Susut/Basi..."
                          className="w-full text-[11px] p-1 bg-transparent border-b border-(--border-color) focus:border-orange-500 outline-none text-(--text-primary)"
                        />
                      </td>
                    </tr>
                  );
                })}

                {filteredMatrix.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="p-12 text-center text-(--text-secondary) font-bold text-xs italic"
                    >
                      Belum ada katalog barang fisik untuk di-opname.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ========================================================================= */
          /* TAB 2: RIWAYAT BERITA ACARA STOK OPNAME LALU */
          /* ========================================================================= */
          <div className="bg-(--bg-card) border border-(--border-color) rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black text-(--text-secondary) tracking-wider">
                  <th className="px-4 py-3">Tanggal Opname</th>
                  <th className="px-4 py-3">No. Berita Acara</th>
                  <th className="px-4 py-3 text-center">Item Dihitung</th>
                  <th className="px-4 py-3 text-center">Selisih Qty</th>
                  <th className="px-4 py-3 text-right">Nilai Selisih (Rp)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-color) text-xs font-semibold text-(--text-primary)">
                {opnames.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-(--surface-hover) transition"
                  >
                    <td className="px-4 py-3 font-mono">
                      {new Date(doc.date).toLocaleDateString("id-ID", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 font-bold font-mono text-(--text-primary)">
                      {doc.documentNumber}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">
                      {doc.totalItemsCounted} Item
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${doc.totalVarianceQty === 0 ? "text-slate-400" : doc.totalVarianceQty < 0 ? "text-rose-500" : "text-emerald-500"}`}
                      >
                        {doc.totalVarianceQty > 0 ? "+" : ""}
                        {doc.totalVarianceQty}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-(--text-primary)">
                      Rp {(doc.totalVarianceCost || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 text-[9px] font-black rounded uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() =>
                          printStockOpnameReportPdf(doc, outletName)
                        }
                        className="p-1.5 text-(--text-secondary) hover:text-indigo-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                        title="Cetak Berita Acara (PDF)"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {opnames.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-12 text-center text-(--text-secondary) font-bold text-xs italic"
                    >
                      Belum ada riwayat dokumen stok opname yang tersimpan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
