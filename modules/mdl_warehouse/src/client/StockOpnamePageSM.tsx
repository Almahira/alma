// File: modules/mdl_warehouse/src/client/StockOpnamePageSM.tsx
import React, { useState, useMemo } from "react";
import {
  Scale,
  Plus,
  Printer,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Lock,
  RotateCcw,
  Check,
  ChevronDown,
  Layers,
} from "lucide-react";
import { useWarehouseStore } from "./store";
import { useItemStore } from "../../../mdl_item/src/client/store";
import { useReceivingStore } from "../../../mdl_receiving/src/client/store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayoutSM";
import {
  printBlankOpnameChecklistPdf,
  printStockOpnameReportPdf,
} from "./features/pdf-warehouse";
import { exportExcelStockOpname } from "./features/excel-warehouse";

// Modal Set Saldo Stok Awal Cepat
const InitialStockModalSM: React.FC<{
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
    <form onSubmit={handleSave} className="p-4 space-y-4 max-w-sm">
      <div className="border-b border-(--border-color) pb-2">
        <h4 className="font-black text-xs text-(--text-primary) uppercase">
          Set Saldo Stok Awal (Baseline)
        </h4>
        <p className="text-xs text-orange-500 font-bold mt-0.5">{item.name}</p>
      </div>
      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Jumlah Stok Awal ({item.uomName || "PCS"})
        </label>
        <input
          type="number"
          step="any"
          required
          autoFocus
          value={qty}
          onChange={(e) =>
            setQty(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder="0"
          className="w-full text-base font-black p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-xl outline-none font-mono text-center"
        />
      </div>
      <div className="pt-2 flex justify-end gap-2 border-t border-(--border-color)">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-(--text-secondary) rounded-lg"
        >
          Batal
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-black text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-md"
        >
          Simpan Stok Awal
        </button>
      </div>
    </form>
  );
};

export function StockOpnamePageSM() {
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

  // State Input Fisik & Catatan
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>(
    {},
  );
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  // Cek apakah hari ini sudah pernah dilakukan closing opname
  const isAlreadyAdjustedToday = useMemo(() => {
    return opnames.some(
      (o) =>
        (!localOutletId || o.outletId === localOutletId) &&
        (!localCompanyId || o.companyId === localCompanyId) &&
        o.date.startsWith(opnameDate) &&
        o.isActive !== false,
    );
  }, [opnames, localOutletId, localCompanyId, opnameDate]);

  // =========================================================================
  // KALKULASI OTOMATIS MATRIKS INVENTORI PER ITEM (TERISOLASI CABANG)
  // =========================================================================
  const opnameMatrix = useMemo(() => {
    const validProducts = products.filter(
      (p) => p.status === "Aktif" && !p.isExpense,
    );
    return validProducts.map((p) => {
      const uomName = uoms.find((u) => u.id === p.uomId)?.name || "PCS";
      const catName =
        categories.find((c) => c.id === p.categoryId)?.name || "-";

      const initialStockKey = `${localOutletId || localRegionId}_${p.id}`;
      const initialStock = initialStocks[initialStockKey] || 0;

      const receivingItemsForProduct = receivingDocs
        .filter((doc) => {
          const matchCompany =
            !localCompanyId || doc.companyId === localCompanyId;
          const matchOutlet = localOutletId
            ? doc.outletId === localOutletId
            : !doc.outletId &&
              (!localRegionId || doc.regionId === localRegionId);
          const matchActive =
            doc.status !== "CANCELLED" && doc.isActive !== false;
          return matchCompany && matchOutlet && matchActive;
        })
        .flatMap((doc) => doc.items || [])
        .filter((it) => it.itemId === p.id && !it.isExpense);

      const stockIn = receivingItemsForProduct.reduce(
        (sum, it) => sum + Number(it.receivedQty || it.qty || 0),
        0,
      );

      const stockOut = distributions
        .filter(
          (d) =>
            d.itemId === p.id &&
            (localOutletId ? d.outletId === localOutletId : !d.outletId) &&
            (!localCompanyId || d.companyId === localCompanyId) &&
            d.isActive !== false,
        )
        .reduce((sum, d) => sum + Number(d.qty || 0), 0);

      const spoilWasteQty = spoilWastes
        .filter(
          (sw) =>
            sw.itemId === p.id &&
            (localOutletId ? sw.outletId === localOutletId : !sw.outletId) &&
            (!localCompanyId || sw.companyId === localCompanyId) &&
            sw.isActive !== false,
        )
        .reduce(
          (sum, sw) => sum + Number(sw.convertedBaseQty || sw.inputQty || 0),
          0,
        );

      const rawSystemStock = initialStock + stockIn - stockOut - spoilWasteQty;
      const systemStock = parseFloat(rawSystemStock.toFixed(4));

      const scopeKey =
        localOutletId || localRegionId || localCompanyId || "DEFAULT";
      const pricing =
        p.pricing?.[scopeKey] ||
        p.pricing?.[Object.keys(p.pricing || {})[0]] ||
        {};
      const currentPrice = Math.round(Number(pricing.basePrice || 0));
      let previousPrice = currentPrice;
      if (receivingItemsForProduct.length > 1) {
        previousPrice = Math.round(
          Number(
            receivingItemsForProduct[receivingItemsForProduct.length - 2]
              .price || currentPrice,
          ),
        );
      }

      const physicalStock =
        physicalCounts[p.id] !== undefined ? physicalCounts[p.id] : systemStock;
      const varianceQty = parseFloat((physicalStock - systemStock).toFixed(4));
      const varianceCost = Math.round(varianceQty * currentPrice);
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

  const filteredMatrix = useMemo(() => {
    return opnameMatrix.filter(
      (item) =>
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.categoryName.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [opnameMatrix, searchTerm]);

  const filteredOpnames = useMemo(() => {
    return opnames.filter((o) => {
      if (localOutletId && o.outletId && o.outletId !== localOutletId)
        return false;
      if (
        !localOutletId &&
        localRegionId &&
        o.regionId &&
        o.regionId !== localRegionId
      )
        return false;
      if (localCompanyId && o.companyId && o.companyId !== localCompanyId)
        return false;
      return true;
    });
  }, [opnames, localOutletId, localRegionId, localCompanyId]);

  const totalVarianceCost = useMemo(() => {
    return filteredMatrix.reduce((sum, it) => sum + it.varianceCost, 0);
  }, [filteredMatrix]);

  const totalVarianceQty = useMemo(() => {
    return parseFloat(
      filteredMatrix.reduce((sum, it) => sum + it.varianceQty, 0).toFixed(4),
    );
  }, [filteredMatrix]);

  const handlePhysicalCountChange = (itemId: string, val: string) => {
    const num = val === "" ? 0 : Number(val);
    setPhysicalCounts((prev) => ({ ...prev, [itemId]: num }));
  };

  const handleStepCount = (itemId: string, currentVal: number, delta: number) => {
    const nextVal = Math.max(0, parseFloat((currentVal + delta).toFixed(2)));
    setPhysicalCounts((prev) => ({ ...prev, [itemId]: nextVal }));
  };

  const handleNoteChange = (itemId: string, text: string) => {
    setItemNotes((prev) => ({ ...prev, [itemId]: text.toUpperCase() }));
  };

  // SUBMIT HASIL STOK OPNAME & ADJUST STOK
  const handleCompleteOpname = () => {
    openAlert({
      title: "Konfirmasi Simpan & Adjust",
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
            `Berita Acara Opname ${opnameDate} tersimpan & stok sistem diselaraskan.`,
          );
        } catch (err: any) {
          sysToast.error("Gagal Menyimpan Opname", err.message);
        }
      },
    });
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {/* HEADER MOBILE */}
      <div className="p-3 bg-(--bg-card) border-b border-(--border-color) shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-sm font-black text-(--text-primary) uppercase tracking-wide">
                Stok Opname
              </h2>
              <span className="text-[10px] text-(--text-secondary) font-bold">
                {outletName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                printBlankOpnameChecklistPdf(
                  products,
                  uoms,
                  categories,
                  outletName,
                )
              }
              className="p-1.5 rounded-lg border border-(--border-color) text-(--text-secondary)"
              title="Cetak Form Kertas"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={() => exportExcelStockOpname(opnameMatrix, opnameDate)}
              className="p-1.5 rounded-lg border border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
              title="Export Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* STATISTIK RINGKAS (KARTU STATS MOBILE) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-(--bg-input) rounded-xl border border-(--border-color)">
            <span className="text-[8px] font-black uppercase text-(--text-secondary) block">
              Selisih Fisik (Qty)
            </span>
            <span
              className={`text-xs font-black font-mono block mt-0.5 ${
                totalVarianceQty === 0
                  ? "text-slate-400"
                  : totalVarianceQty < 0
                    ? "text-rose-500"
                    : "text-emerald-500"
              }`}
            >
              {totalVarianceQty > 0 ? "+" : ""}
              {totalVarianceQty} Satuan
            </span>
          </div>

          <div className="p-2 bg-(--bg-input) rounded-xl border border-(--border-color)">
            <span className="text-[8px] font-black uppercase text-(--text-secondary) block">
              Nilai Selisih (Rp)
            </span>
            <span
              className={`text-xs font-black font-mono block mt-0.5 ${
                totalVarianceCost === 0
                  ? "text-slate-400"
                  : totalVarianceCost < 0
                    ? "text-rose-500"
                    : "text-emerald-500"
              }`}
            >
              Rp {totalVarianceCost.toLocaleString()}
            </span>
          </div>
        </div>

        {/* TABS LEMBAR KERJA vs RIWAYAT */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex bg-(--bg-input) rounded-lg border border-(--border-color) p-0.5 flex-1">
            <button
              onClick={() => setActiveTab("ACTIVE_OPNAME")}
              className={`flex-1 py-1 text-[10px] font-black rounded text-center transition ${
                activeTab === "ACTIVE_OPNAME"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-(--text-secondary)"
              }`}
            >
              LEMBAR OPNAME ({filteredMatrix.length})
            </button>
            <button
              onClick={() => setActiveTab("OPNAME_HISTORY")}
              className={`flex-1 py-1 text-[10px] font-black rounded text-center transition ${
                activeTab === "OPNAME_HISTORY"
                  ? "bg-slate-700 text-white shadow-xs"
                  : "text-(--text-secondary)"
              }`}
            >
              RIWAYAT ({filteredOpnames.length})
            </button>
          </div>

          {activeTab === "ACTIVE_OPNAME" && (
            <div className="flex items-center gap-1 bg-(--bg-input) px-2 py-1 rounded-lg border border-(--border-color) shrink-0">
              <Calendar className="w-3.5 h-3.5 text-orange-500" />
              <input
                type="date"
                value={opnameDate}
                onChange={(e) => setOpnameDate(e.target.value)}
                className="bg-transparent font-bold text-xs outline-none text-(--text-primary)"
              />
            </div>
          )}
        </div>

        {/* PENCARIAN BARANG */}
        {activeTab === "ACTIVE_OPNAME" && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-(--text-secondary) absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari barang opname..."
              className="w-full text-xs font-bold pl-8 pr-3 py-1.5 bg-(--bg-input) border border-(--border-color) rounded-xl outline-none text-(--text-primary)"
            />
          </div>
        )}
      </div>

      {/* BODY KONTEN */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {activeTab === "ACTIVE_OPNAME" ? (
          /* TAB 1: KARTU HITUNG OPNAME MOBILE */
          <>
            {filteredMatrix.map((item) => {
              const currentPhysical = item.physicalStock;
              const hasDiff = item.varianceQty !== 0;

              return (
                <div
                  key={item.id}
                  className="bg-(--bg-card) border border-(--border-color) rounded-xl p-3 shadow-xs space-y-2"
                >
                  {/* Header Item */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-xs text-(--text-primary)">
                        {item.itemName}
                      </div>
                      <div className="text-[9px] text-(--text-secondary) mt-0.5">
                        {item.categoryName} •{" "}
                        <span className="text-orange-500 font-bold">{item.uomName}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-(--text-secondary) block">Sistem:</span>
                      <span className="font-mono font-black text-xs text-(--text-primary) bg-(--bg-input) px-2 py-0.5 rounded">
                        {item.systemStock} {item.uomName}
                      </span>
                    </div>
                  </div>

                  {/* Riwayat Alur Stok Kecil */}
                  <div className="grid grid-cols-4 gap-1 p-1.5 bg-(--surface-hover) rounded-lg text-[9px] text-center font-mono">
                    <div>
                      <span className="text-slate-400 block">Awal</span>
                      <span className="font-bold">{item.initialStock}</span>
                    </div>
                    <div>
                      <span className="text-emerald-500 block">+Masuk</span>
                      <span className="font-bold text-emerald-500">{item.stockIn}</span>
                    </div>
                    <div>
                      <span className="text-rose-500 block">-Keluar</span>
                      <span className="font-bold text-rose-500">{item.stockOut}</span>
                    </div>
                    <div>
                      <span className="text-amber-500 block">-Spoil</span>
                      <span className="font-bold text-amber-500">{item.spoilWasteQty}</span>
                    </div>
                  </div>

                  {/* Input Hitungan Fisik Riil (Touch-First Buttons) */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleStepCount(item.id, currentPhysical, -1)}
                      className="w-8 h-8 rounded-lg bg-(--bg-input) border border-(--border-color) text-rose-500 font-black flex items-center justify-center active:scale-95"
                    >
                      -1
                    </button>

                    <div className="flex-1">
                      <input
                        type="number"
                        step="any"
                        value={currentPhysical}
                        onChange={(e) =>
                          handlePhysicalCountChange(item.id, e.target.value)
                        }
                        className="w-full text-center font-mono font-black text-sm p-1.5 bg-(--bg-input) border-2 border-orange-500/50 focus:border-orange-500 rounded-lg outline-none text-(--text-primary)"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStepCount(item.id, currentPhysical, 1)}
                      className="w-8 h-8 rounded-lg bg-(--bg-input) border border-(--border-color) text-emerald-500 font-black flex items-center justify-center active:scale-95"
                    >
                      +1
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handlePhysicalCountChange(item.id, String(item.systemStock))
                      }
                      className="px-2 py-1.5 bg-(--surface-hover) border border-(--border-color) text-[9px] font-bold text-(--text-secondary) rounded-lg active:scale-95 shrink-0"
                      title="Sesuai Sistem"
                    >
                      = Sistem
                    </button>
                  </div>

                  {/* Selisih & Catatan */}
                  <div className="flex items-center justify-between pt-1 border-t border-(--border-color) text-xs">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black font-mono ${
                          item.varianceQty === 0
                            ? "bg-slate-500/10 text-slate-400"
                            : item.varianceQty < 0
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        }`}
                      >
                        {item.varianceQty > 0 ? "+" : ""}
                        {item.varianceQty} {item.uomName}
                      </span>
                      {hasDiff && (
                        <span className="font-mono text-[10px] text-rose-500 font-bold">
                          (Rp {item.varianceCost.toLocaleString()})
                        </span>
                      )}
                    </div>

                    <div className="flex-1 max-w-36 ml-2">
                      <input
                        type="text"
                        value={item.note}
                        onChange={(e) => handleNoteChange(item.id, e.target.value)}
                        placeholder="Catatan..."
                        className="w-full text-[10px] p-1 bg-transparent border-b border-(--border-color) focus:border-orange-500 outline-none text-(--text-primary) placeholder:text-[9px]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredMatrix.length === 0 && (
              <div className="p-8 text-center text-(--text-secondary) font-bold text-xs italic">
                Tidak ada barang yang cocok dengan pencarian.
              </div>
            )}
          </>
        ) : (
          /* TAB 2: RIWAYAT BERITA ACARA */
          <>
            {filteredOpnames.map((doc) => (
              <div
                key={doc.id}
                className="bg-(--bg-card) border border-(--border-color) rounded-xl p-3 shadow-xs space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-xs text-(--text-primary)">
                      {doc.documentNumber}
                    </div>
                    <span className="text-[9px] font-mono text-(--text-secondary)">
                      {new Date(doc.date).toLocaleDateString("id-ID", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <button
                    onClick={() => printStockOpnameReportPdf(doc, outletName)}
                    className="p-1.5 text-(--text-secondary) hover:text-indigo-500 border border-(--border-color) rounded-lg"
                    title="Cetak Berita Acara (PDF)"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-(--border-color) text-xs">
                  <div>
                    <span className="text-[9px] text-(--text-secondary) block">Item Dihitung:</span>
                    <span className="font-mono font-bold text-(--text-primary) text-xs">
                      {doc.totalItemsCounted} Produk
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-(--text-secondary) block">Nilai Selisih:</span>
                    <span className="font-mono font-black text-rose-500 text-xs">
                      Rp {(doc.totalVarianceCost || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {filteredOpnames.length === 0 && (
              <div className="p-8 text-center text-(--text-secondary) font-bold text-xs italic">
                Belum ada riwayat dokumen stok opname tersimpan.
              </div>
            )}
          </>
        )}
      </div>

      {/* STICKY BOTTOM BUTTON: SIMPAN & ADJUST */}
      {activeTab === "ACTIVE_OPNAME" && (
        <div className="p-3 bg-(--surface-hover) border-t border-(--border-color) shrink-0">
          <button
            onClick={handleCompleteOpname}
            className="w-full py-3 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-orange-500/25 flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Simpan &amp; Adjust Stok
          </button>
        </div>
      )}
    </div>
  );
}
