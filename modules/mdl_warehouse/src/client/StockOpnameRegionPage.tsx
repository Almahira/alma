// File: modules/mdl_warehouse/src/client/StockOpnameRegionPage.tsx
import React, { useState, useMemo } from "react";
import {
  Scale,
  Printer,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  Calendar,
  Lock,
  ArrowDownToLine,
  Truck,
  Flame,
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

export function StockOpnameRegionPage() {
  const { initialStocks, opnames, spoilWastes } = useWarehouseStore();
  const { products, uoms, categories } = useItemStore();
  const { documents: receivingDocs } = useReceivingStore();
  const { regions } = useOrgStore();
  const { openAlert } = useUniversalModal();

  const [activeTab, setActiveTab] = useState<
    "ACTIVE_OPNAME" | "OPNAME_HISTORY"
  >("ACTIVE_OPNAME");
  const [opnameDate, setOpnameDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [searchTerm, setSearchTerm] = useState("");

  const localCompanyId = localStorage.getItem("__unv_companyId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const currentRegion = regions.find((r) => r.id === localRegionId);
  const regionName = currentRegion
    ? `GUDANG WILAYAH: ${currentRegion.name.toUpperCase()}`
    : "GUDANG PUSAT / REGIONAL";

  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>(
    {},
  );
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  const isAlreadyAdjustedToday = useMemo(() => {
    return opnames.some((o: any) => {
      const isOpActive = o.isActive !== undefined ? o.isActive : o.is_active;
      return (
        isOpActive !== false &&
        !o.outletId && // Khusus Region (tanpa outletId)
        (!localRegionId || o.regionId === localRegionId) &&
        (!localCompanyId || o.companyId === localCompanyId) &&
        o.date.startsWith(opnameDate)
      );
    });
  }, [opnames, localRegionId, localCompanyId, opnameDate]);

  // =========================================================================
  // LOGIKA STOK OPNAME KHUSUS REGION:
  // Masuk  = Belanja Vendor Eksternal (Receiving HUTANG Region)
  // Keluar = Kirim ke Cabang Outlet (Receiving PIUTANG Region)
  // Spoil  = Kerusakan di Gudang Region
  // =========================================================================
  const regionOpnameMatrix = useMemo(() => {
    const validProducts = products.filter(
      (p) => p.status === "Aktif" && !p.isExpense,
    );

    return validProducts.map((p) => {
      const uomName = uoms.find((u) => u.id === p.uomId)?.name || "PCS";
      const catName =
        categories.find((c) => c.id === p.categoryId)?.name || "-";

      // 1. Stok Awal Gudang Region
      const initialStockKey = `${localRegionId}_${p.id}`;
      const initialStock = initialStocks[initialStockKey] || 0;

      // 2. STOK MASUK: Belanja Vendor Eksternal ke Gudang Region (HUTANG Region)
      const receivingVendorItems = receivingDocs
        .filter((doc: any) => {
          const isDocActive =
            doc.isActive !== undefined ? doc.isActive : doc.is_active;
          const matchActive =
            doc.status !== "CANCELLED" && isDocActive !== false;
          const matchCompany =
            !localCompanyId || doc.companyId === localCompanyId;
          const matchRegion = !localRegionId || doc.regionId === localRegionId;
          // Hutang Region adalah belanja masuk ke gudang region (bukan milik cabang)
          const isHutangRegion = doc.documentType === "HUTANG" && !doc.outletId;

          return matchActive && matchCompany && matchRegion && isHutangRegion;
        })
        .flatMap((doc) => doc.items || [])
        .filter((it) => it.itemId === p.id && !it.isExpense);

      const stockIn = receivingVendorItems.reduce(
        (sum, it) => sum + Number(it.receivedQty || it.qty || 0),
        0,
      );

      // 3. STOK KELUAR: Pengiriman ke Cabang (PIUTANG / Surat Jalan Cabang)
      const piutangOutletItems = receivingDocs
        .filter((doc: any) => {
          const isDocActive =
            doc.isActive !== undefined ? doc.isActive : doc.is_active;
          const matchActive =
            doc.status !== "CANCELLED" && isDocActive !== false;
          const matchCompany =
            !localCompanyId || doc.companyId === localCompanyId;
          const matchRegion = !localRegionId || doc.regionId === localRegionId;
          // Piutang adalah barang keluar dari Region menuju Outlet cabang
          const isPiutangDistribusi =
            doc.documentType === "PIUTANG" ||
            (doc.documentType === "HUTANG" &&
              doc.outletId &&
              doc.vendorId === localRegionId);

          return (
            matchActive && matchCompany && matchRegion && isPiutangDistribusi
          );
        })
        .flatMap((doc) => doc.items || [])
        .filter((it) => it.itemId === p.id && !it.isExpense);

      const stockOut = piutangOutletItems.reduce(
        (sum, it) => sum + Number(it.receivedQty || it.qty || 0),
        0,
      );

      // 4. Stok Rusak / Basi di Gudang Region
      const spoilWasteQty = spoilWastes
        .filter((sw: any) => {
          const isSwActive =
            sw.isActive !== undefined ? sw.isActive : sw.is_active;
          return (
            sw.itemId === p.id &&
            !sw.outletId &&
            (!localRegionId || sw.regionId === localRegionId) &&
            (!localCompanyId || sw.companyId === localCompanyId) &&
            isSwActive !== false
          );
        })
        .reduce(
          (sum, sw) => sum + Number(sw.convertedBaseQty || sw.inputQty || 0),
          0,
        );

      // 5. Sisa Stok Sistem Riil Region
      const rawSystemStock = initialStock + stockIn - stockOut - spoilWasteQty;
      const systemStock = parseFloat(rawSystemStock.toFixed(4));

      // 6. Harga Beli HPP Region
      const scopeKey = localRegionId || localCompanyId || "DEFAULT";
      const pricing =
        p.pricing?.[scopeKey] ||
        p.pricing?.[Object.keys(p.pricing || {})[0]] ||
        {};
      const currentPrice = Math.round(Number(pricing.basePrice || 0));

      // 7. Hitungan Fisik & Selisih
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
        initialStock,
        stockIn,
        stockOut,
        spoilWasteQty,
        systemStock,
        currentPrice,
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
    spoilWastes,
    localRegionId,
    localCompanyId,
    physicalCounts,
    itemNotes,
  ]);

  const filteredMatrix = useMemo(() => {
    return regionOpnameMatrix.filter(
      (item) =>
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.categoryName.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [regionOpnameMatrix, searchTerm]);

  // Riwayat Berita Acara Khusus Region
  const filteredOpnames = useMemo(() => {
    return opnames.filter((o: any) => {
      const isOpActive = o.isActive !== undefined ? o.isActive : o.is_active;
      if (isOpActive === false) return false;
      if (o.outletId) return false; // Khusus berita acara Region (tanpa outletId)
      if (localRegionId && o.regionId && o.regionId !== localRegionId)
        return false;
      if (localCompanyId && o.companyId && o.companyId !== localCompanyId)
        return false;
      return true;
    });
  }, [opnames, localRegionId, localCompanyId]);

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

  const handleNoteChange = (itemId: string, text: string) => {
    setItemNotes((prev) => ({ ...prev, [itemId]: text.toUpperCase() }));
  };

  // Simpan Berita Acara Opname Gudang Wilayah
  const handleCompleteRegionOpname = () => {
    openAlert({
      title: "Konfirmasi Simpan Opname Gudang Wilayah",
      message: `Seluruh angka fisik riil akan dibekukan sebagai Berita Acara resmi Gudang Region tanggal ${opnameDate} dan menjadi Stok Awal (Baseline) baru Region. Lanjutkan?`,
      confirmText: "SIMPAN & ADJUST REGION",
      onConfirm: async () => {
        try {
          const itemsPayload = regionOpnameMatrix.map((it) => ({
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
            varianceCost: it.varianceCost,
            notes: it.note || null,
          }));

          await globalCommandBus.execute({
            type: "COMPLETE_STOCK_OPNAME",
            payload: {
              companyId: localCompanyId,
              regionId: localRegionId,
              outletId: null, // Murni level Gudang Region
              date: opnameDate,
              totalVarianceCost,
              totalVarianceQty,
              items: itemsPayload,
            },
          });

          sysToast.success(
            "Opname Region Selesai",
            `Berita Acara Opname Region ${opnameDate} berhasil disimpan.`,
          );
        } catch (err: any) {
          sysToast.error("Gagal Menyimpan Opname", err.message);
        }
      },
    });
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {/* HEADER UTAMA REGION */}
      <div className="p-5 bg-(--surface-hover) border-b border-(--border-color) shrink-0 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-black text-(--text-primary) tracking-tight flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-500" /> Stok Opname Gudang
              Wilayah (Central Hub)
            </h2>
            <p className="text-[11px] text-(--text-secondary) font-bold mt-0.5">
              {regionName} • Alur: Masuk (Vendor Eksternal) | Keluar (Kirim ke
              Cabang)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() =>
                printBlankOpnameChecklistPdf(
                  products,
                  uoms,
                  categories,
                  regionName,
                )
              }
              className="px-3.5 py-2 bg-(--bg-card) border border-(--border-color) text-(--text-primary) hover:bg-(--surface-hover) rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-slate-400" /> FORM CHECKLIST
              GUDANG
            </button>

            <button
              onClick={() =>
                exportExcelStockOpname(regionOpnameMatrix, opnameDate)
              }
              className="px-3.5 py-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" /> EXPORT EXCEL
            </button>

            {activeTab === "ACTIVE_OPNAME" && (
              <button
                onClick={handleCompleteRegionOpname}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> SIMPAN ADJUST REGION
              </button>
            )}
          </div>
        </div>

        {/* KARTU STATISTIK OPNAME REGION */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-(--bg-card) rounded-xl border border-(--border-color)">
            <span className="text-[9px] font-black uppercase text-(--text-secondary) block">
              TOTAL ITEM GUDANG
            </span>
            <span className="text-sm font-black font-mono text-(--text-primary) block mt-0.5">
              {filteredMatrix.length} Produk
            </span>
          </div>

          <div className="p-3 bg-(--bg-card) rounded-xl border border-(--border-color)">
            <span className="text-[9px] font-black uppercase text-(--text-secondary) block">
              SELISIH FISIK (QTY)
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
              SELISIH FINANSIAL (RP)
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
                STATUS CLOSING HARI INI
              </span>
              <span
                className={`text-xs font-black uppercase block mt-0.5 ${isAlreadyAdjustedToday ? "text-emerald-500" : "text-amber-500"}`}
              >
                {isAlreadyAdjustedToday ? "TER-ADJUSTED" : "BELUM CLOSING"}
              </span>
            </div>
            {isAlreadyAdjustedToday && (
              <Lock className="w-4 h-4 text-emerald-500" />
            )}
          </div>
        </div>
      </div>

      {/* FILTER & TABS */}
      <div className="px-6 py-3 bg-(--bg-card) border-b border-(--border-color) flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-(--bg-input) p-1 rounded-xl border border-(--border-color)">
            <button
              onClick={() => setActiveTab("ACTIVE_OPNAME")}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition cursor-pointer ${
                activeTab === "ACTIVE_OPNAME"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              LEMBAR OPNAME REGION
            </button>
            <button
              onClick={() => setActiveTab("OPNAME_HISTORY")}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition cursor-pointer ${
                activeTab === "OPNAME_HISTORY"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              RIWAYAT BERITA ACARA REGION ({filteredOpnames.length})
            </button>
          </div>

          {activeTab === "ACTIVE_OPNAME" && (
            <div className="flex items-center gap-2 bg-(--bg-input) border border-(--border-color) rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-emerald-500" />
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
              placeholder="Cari barang gudang..."
              className="w-full text-xs font-bold pl-9 pr-3 py-2 bg-(--bg-input) border border-(--border-color) rounded-xl outline-none text-(--text-primary)"
            />
          </div>
        )}
      </div>

      {/* TABEL OPNAME REGION */}
      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
        {activeTab === "ACTIVE_OPNAME" ? (
          <div className="bg-(--bg-card) border border-(--border-color) rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black text-(--text-secondary) tracking-wider">
                  <th className="px-4 py-3">Nama Barang</th>
                  <th className="px-3 py-3 text-center">Satuan</th>
                  <th className="px-3 py-3 text-center">Stok Awal</th>
                  <th
                    className="px-3 py-3 text-center text-emerald-600"
                    title="Masuk dari Supplier Vendor Eksternal"
                  >
                    +Masuk (Vendor)
                  </th>
                  <th
                    className="px-3 py-3 text-center text-blue-600"
                    title="Keluar ke Cabang via Surat Jalan Piutang"
                  >
                    -Kirim (Cabang)
                  </th>
                  <th className="px-3 py-3 text-center text-rose-500">
                    -Spoil
                  </th>
                  <th className="px-3 py-3 text-center font-bold">
                    Sisa Sistem Region
                  </th>
                  <th className="px-4 py-3 text-right">HPP Beli</th>
                  <th className="px-4 py-3 text-center w-28 text-emerald-600">
                    Fisik Riil
                  </th>
                  <th className="px-3 py-3 text-center">Selisih</th>
                  <th className="px-4 py-3 text-right">Nilai Selisih</th>
                  <th className="px-4 py-3 w-40">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-color) text-xs font-semibold text-(--text-primary)">
                {filteredMatrix.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-(--surface-hover) transition"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-(--text-primary)">
                        {item.itemName}
                      </div>
                      <div className="text-[10px] text-(--text-secondary)">
                        {item.categoryName}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-center font-mono text-(--text-secondary) font-bold">
                      {item.uomName}
                    </td>

                    <td className="px-3 py-2.5 text-center font-mono font-bold">
                      {item.initialStock}
                    </td>

                    {/* MASUK: VENDOR EKSTERNAL */}
                    <td className="px-3 py-2.5 text-center font-mono text-emerald-600 font-bold bg-emerald-500/5">
                      +{item.stockIn}
                    </td>

                    {/* KELUAR: PIUTANG / KIRIM KE CABANG */}
                    <td className="px-3 py-2.5 text-center font-mono text-blue-600 font-bold bg-blue-500/5">
                      -{item.stockOut}
                    </td>

                    {/* SPOIL GUDANG */}
                    <td className="px-3 py-2.5 text-center font-mono text-rose-500 font-bold">
                      -{item.spoilWasteQty}
                    </td>

                    {/* SISA SISTEM */}
                    <td className="px-3 py-2.5 text-center font-mono font-black text-(--text-primary) bg-(--bg-input)/70">
                      {item.systemStock}
                    </td>

                    <td className="px-4 py-2.5 text-right font-mono text-(--text-secondary)">
                      Rp {item.currentPrice.toLocaleString()}
                    </td>

                    {/* INPUT FISIK GUDANG REGION */}
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="number"
                        step="any"
                        value={item.physicalStock}
                        onChange={(e) =>
                          handlePhysicalCountChange(item.id, e.target.value)
                        }
                        className="w-20 text-center font-mono font-black text-sm p-1.5 bg-(--bg-input) border-2 border-emerald-500/40 focus:border-emerald-500 rounded-lg outline-none text-(--text-primary)"
                      />
                    </td>

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

                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        value={item.note}
                        onChange={(e) =>
                          handleNoteChange(item.id, e.target.value)
                        }
                        placeholder="Kondisi barang..."
                        className="w-full text-[11px] p-1 bg-transparent border-b border-(--border-color) focus:border-emerald-500 outline-none text-(--text-primary)"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB RIWAYAT OPNAME REGION */
          <div className="bg-(--bg-card) border border-(--border-color) rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[10px] uppercase font-black text-(--text-secondary) tracking-wider">
                  <th className="px-4 py-3">Tanggal Opname</th>
                  <th className="px-4 py-3">No. Dokumen Region</th>
                  <th className="px-4 py-3 text-center">Item Dihitung</th>
                  <th className="px-4 py-3 text-center">Selisih Qty</th>
                  <th className="px-4 py-3 text-right">Nilai Selisih (Rp)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right w-24">Cetak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-color) text-xs font-semibold text-(--text-primary)">
                {filteredOpnames.map((doc: any) => (
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
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() =>
                          printStockOpnameReportPdf(doc, regionName)
                        }
                        className="p-1.5 text-(--text-secondary) hover:text-indigo-500 bg-(--bg-card) border border-(--border-color) rounded cursor-pointer"
                        title="Cetak Berita Acara Region"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredOpnames.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-12 text-center text-(--text-secondary) font-bold text-xs italic"
                    >
                      Belum ada riwayat dokumen stok opname gudang wilayah.
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
