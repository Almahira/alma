// File: modules/mdl_plusales/src/client/form-plusales.tsx
import React, { useState, useMemo, useEffect } from "react";
import {
  Scale,
  Trash2,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Calendar,
} from "lucide-react";
import { useReceivingStore } from "../../../mdl_receiving/src/client/store";
import { useItemStore } from "../../../mdl_item/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { ulid } from "ulidx";

export interface DynamicItemRow {
  id: string;
  category: "SETTLEMENT" | "DEDUCTION";
  name: string;
  amount: number;
}

// =========================================================================
// KOMPONEN NUMBER INPUT DENGAN SEPARATOR OTOMATIS
// =========================================================================
const NumberInput: React.FC<{
  value: number | "";
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  autoFocus?: boolean;
  dataUnvNumpad?: string;
}> = ({
  value,
  onChange,
  placeholder,
  className,
  required,
  autoFocus,
  dataUnvNumpad,
}) => {
  const [display, setDisplay] = useState<string>(
    value === "" || value === 0 ? "" : value.toLocaleString("id-ID"),
  );

  useEffect(() => {
    setDisplay(
      value === "" || value === 0 ? "" : value.toLocaleString("id-ID"),
    );
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const digits = input.replace(/\D/g, "");
    const num = digits ? parseInt(digits, 10) : 0;
    const formatted = digits ? num.toLocaleString("id-ID") : "";
    setDisplay(formatted);
    onChange(num);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      required={required}
      autoFocus={autoFocus}
      value={display}
      onChange={handleChange}
      placeholder={placeholder || "0"}
      className={className}
      data-unv-numpad={dataUnvNumpad}
    />
  );
};

// =========================================================================
// 1. SUB-MODAL: INPUT PENGELUARAN PETTYCASH (BERSIH DARI DUMMY ID)
// =========================================================================
const QuickPettycashModal: React.FC<{
  targetDate: string;
  onClose: () => void;
}> = ({ targetDate, onClose }) => {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const { products, categories, uoms } = useItemStore();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || Number(amount) <= 0) {
      return sysToast.error("Error", "Deskripsi dan nominal wajib diisi!");
    }

    const companyId = localStorage.getItem("__unv_companyId") || "";
    const regionId = localStorage.getItem("__unv_regionId") || null;
    const outletId = localStorage.getItem("__unv_outletId") || null;
    const cleanName = description.toUpperCase().trim();

    // 1. Cari apakah item jasa/biaya ini sudah ada di Master Item
    let expenseItem = products.find(
      (p) => p.name === cleanName && p.isExpense === true,
    );
    let validItemId = expenseItem?.id;

    // 2. Jika belum ada, buatkan master item jasa baru otomatis dengan ULID valid
    if (!validItemId) {
      validItemId = `PRD_${ulid()}`;
      const defaultCatId = categories[0]?.id || `CAT_${ulid()}`;
      const defaultUomId = uoms[0]?.id || `UOM_${ulid()}`;

      await globalCommandBus.execute({
        type: "CREATE_PRODUCT",
        payload: {
          id: validItemId,
          categoryId: defaultCatId,
          uomId: defaultUomId,
          companyId,
          regionId,
          outletId,
          name: cleanName,
          isExpense: true,
          pricing: {
            DEFAULT: {
              basePrice: Number(amount),
              marginPercentage: 0,
              sellingPrice: Number(amount),
            },
          },
          approvalStatus: "APPROVED",
        },
      });
    }

    try {
      await globalCommandBus.execute({
        type: "CREATE_RECEIVING",
        payload: {
          companyId,
          regionId,
          outletId,
          vendorId: regionId,
          invoiceNumber: cleanName,
          date: targetDate,
          documentType: "PETTYCASH",
          paymentMethod: "KASIR",
          items: [
            {
              id: `RITM_${ulid()}`,
              itemId: validItemId, // <-- GUNAKAN ID RESMI DARI MASTER ITEM
              name: cleanName,
              isExpense: true,
              qty: 1,
              receivedQty: 1,
              returnedQty: 0,
              price: Number(amount),
              subtotal: Number(amount),
              itemStatus: "RECEIVED",
            },
          ],
        },
      });

      sysToast.success(
        "Berhasil",
        `Pengeluaran kasir "${cleanName}" Rp ${Number(amount).toLocaleString()} berhasil dicatat.`,
      );
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal Mencatat", err.message);
    }
  };

  return (
    <form onSubmit={handleSave} className="p-5 space-y-4">
      <div className="border-b border-(--border-color) pb-2">
        <h4 className="font-black text-sm text-(--text-primary) flex items-center gap-2">
          <Wallet className="w-4 h-4 text-orange-500" /> Catat Pengeluaran Kasir
          (Pettycash)
        </h4>
        <p className="text-xs text-(--text-secondary) mt-0.5">
          Tercatat di Buku Kas Receiving &amp; otomatis memotong timbangan.
        </p>
      </div>

      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Keterangan Pengeluaran / Nota
        </label>
        <input
          type="text"
          required
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value.toUpperCase())}
          placeholder="CONTOH: BELI ES BATU / ISI GALON / GAS..."
          className="w-full text-sm font-bold p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
          Nominal Pengeluaran (Rp)
        </label>
        <NumberInput
          value={amount}
          onChange={setAmount}
          required
          dataUnvNumpad="true"
          placeholder="0"
          className="w-full text-base font-black p-2.5 bg-(--bg-input) text-rose-500 border border-(--border-color) rounded-lg outline-none font-mono"
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
          SIMPAN PENGELUARAN
        </button>
      </div>
    </form>
  );
};

// =========================================================================
// 2. FORM UTAMA: CENTER MODAL TIMBANGAN KASIR
// =========================================================================
export const PlusalesFormModal: React.FC<{
  isEditMode?: boolean;
  initialData?: any;
  onClose: () => void;
}> = ({ isEditMode = false, initialData, onClose }) => {
  const { documents: receivingDocs } = useReceivingStore();
  const [isQuickPettycashOpen, setIsQuickPettycashOpen] = useState(false);

  const localCompanyId = localStorage.getItem("__unv_companyId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";

  const [date, setDate] = useState(
    initialData?.date
      ? new Date(initialData.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
  );

  // SISI OMSET (PIRINGAN KIRI)
  const [netSales, setNetSales] = useState<number>(initialData?.netSales || 0);
  const [discount, setDiscount] = useState<number>(initialData?.discount || 0);
  const [tax, setTax] = useState<number>(initialData?.tax || 0);
  const [service, setService] = useState<number>(initialData?.service || 0);

  // GROSS SALES = NetSales - Diskon + PB1 (Tax) + Service
  const grossSales = Math.max(
    0,
    (netSales || 0) - (discount || 0) + (tax || 0) + (service || 0),
  );

  // SISI DINAMIS (PIRINGAN KANAN)
  const [dynamicItems, setDynamicItems] = useState<DynamicItemRow[]>(
    initialData?.dynamicItems || [],
  );

  // Input Tambah Baris Baru Cepat
  const [newRowName, setNewRowName] = useState("");
  const [newRowAmount, setNewRowAmount] = useState<number | "">("");

  const [cashOnHand, setCashOnHand] = useState<number>(
    initialData?.cashOnHand || 0,
  );
  const [discrepancyNote, setDiscrepancyNote] = useState<string>(
    initialData?.discrepancyNote || "",
  );

  // SINKRONISASI LIVE REAKTIF PETTYCASH KASIR
  const pettycashKasirList = useMemo(() => {
    return receivingDocs.filter((doc) => {
      const matchType = doc.documentType === "PETTYCASH";
      const matchMethod = doc.paymentMethod === "KASIR";
      const matchOutlet = !localOutletId || doc.outletId === localOutletId;

      const docDateStr = doc.date
        ? new Date(doc.date).toISOString().slice(0, 10)
        : "";
      const matchDate = docDateStr === date;
      const matchActive = doc.status !== "CANCELLED" && doc.isActive !== false;

      return (
        matchType && matchMethod && matchOutlet && matchDate && matchActive
      );
    });
  }, [receivingDocs, date, localOutletId]);

  const livePettycashTotal = useMemo(() => {
    return pettycashKasirList.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
  }, [pettycashKasirList]);

  // Subtotal Non-Tunai / EDC / QR
  const totalDynamicSettlement = useMemo(() => {
    return dynamicItems.reduce((sum, item) => {
      const val = item.amount || 0;
      return item.category === "DEDUCTION" ? sum - Math.abs(val) : sum + val;
    }, 0);
  }, [dynamicItems]);

  // TOTAL REALISASI = Non-Tunai + Pettycash Keluar + Cash on Hand
  const totalRealization =
    totalDynamicSettlement + livePettycashTotal + (cashOnHand || 0);

  // SELISIH TIMBANGAN = TOTAL REALISASI - GROSS SALES
  const balanceDifference = totalRealization - grossSales;
  const isBalanced = balanceDifference === 0;

  const handleAddNewRow = (category: "SETTLEMENT" | "DEDUCTION") => {
    if (!newRowName.trim() || Number(newRowAmount) <= 0) {
      return sysToast.error(
        "Error",
        "Isi nama dan nominal data terlebih dahulu!",
      );
    }
    const newRow: DynamicItemRow = {
      id: `DYN_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      category,
      name: newRowName.toUpperCase().trim(),
      amount: Number(newRowAmount),
    };
    setDynamicItems((prev) => [...prev, newRow]);
    setNewRowName("");
    setNewRowAmount("");
  };

  const handleRemoveRow = (id: string) => {
    setDynamicItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grossSales <= 0 && netSales <= 0) {
      return sysToast.error("Error", "Nilai penjualan tidak boleh 0!");
    }

    try {
      const payload = {
        id: initialData?.id,
        companyId: localCompanyId,
        regionId: localRegionId,
        outletId: localOutletId,
        date,
        grossSales,
        discount,
        tax,
        service,
        netSales,
        totalSettlement: totalDynamicSettlement,
        totalPettycash: livePettycashTotal,
        cashOnHand,
        balanceDifference,
        discrepancyNote,
        dynamicItems,
      };

      await globalCommandBus.execute({
        type: isEditMode ? "UPDATE_PLUSALES" : "CREATE_PLUSALES",
        payload,
      });

      sysToast.success(
        "Berhasil",
        `Rekap Penjualan tanggal ${date} berhasil disimpan.`,
      );
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal Menyimpan", err.message);
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-(--bg-card) text-(--text-primary)">
      {/* SUB-MODAL OVERLAY INTERNAL (PETTYCASH) */}
      {isQuickPettycashOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-(--bg-card) w-full max-w-md rounded-2xl shadow-2xl border border-(--border-color) overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <QuickPettycashModal
              targetDate={date}
              onClose={() => setIsQuickPettycashOpen(false)}
            />
          </div>
        </div>
      )}

      <form
        onSubmit={handleSaveDocument}
        className="flex flex-col h-full overflow-hidden"
      >
        {/* HEADER */}
        <div className="px-5 py-2.5 bg-(--surface-hover) border-b border-(--border-color) flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-orange-500" />
            <span className="font-black text-xs uppercase tracking-wide text-(--text-primary)">
              Formulir Timbangan Penjualan Harian
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[10px] font-black text-(--text-secondary) uppercase">
              TANGGAL REKONSILIASI:
            </span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2.5 py-1 bg-(--bg-input) border border-(--border-color) rounded-md font-bold text-xs outline-none text-(--text-primary)"
            />
          </div>
        </div>

        {/* 2 PANEL FIXED */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 min-h-0 overflow-hidden">
          {/* PIRINGAN KIRI: OMSET PENJUALAN (POS) */}
          <div className="bg-(--bg-input)/40 p-4 rounded-xl border border-(--border-color) flex flex-col justify-between overflow-hidden">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-(--border-color) pb-1.5">
                <span className="font-black text-[11px] uppercase tracking-wider text-orange-500 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" /> OMSET PENJUALAN (POS)
                </span>
                <span className="text-[8px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded font-black uppercase">
                  Data Statis
                </span>
              </div>

              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  1. NETSALES / MENU SOLD (Rp)
                </label>
                <NumberInput
                  value={netSales}
                  onChange={setNetSales}
                  required
                  autoFocus
                  dataUnvNumpad="true"
                  placeholder="0"
                  className="w-full text-sm font-black p-2 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none font-mono focus:border-orange-500 text-orange-500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  2. TOTAL DISKON (-) (Rp)
                </label>
                <NumberInput
                  value={discount}
                  onChange={setDiscount}
                  dataUnvNumpad="true"
                  placeholder="0"
                  className="w-full text-xs font-bold p-1.5 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none font-mono text-rose-500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  3. PAJAK RESTO (PB1 10%) (+) (Rp)
                </label>
                <NumberInput
                  value={tax}
                  onChange={setTax}
                  dataUnvNumpad="true"
                  placeholder="0"
                  className="w-full text-xs font-bold p-1.5 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none font-mono text-blue-500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  4. SERVICE CHARGE (+) (Rp)
                </label>
                <NumberInput
                  value={service}
                  onChange={setService}
                  dataUnvNumpad="true"
                  placeholder="0"
                  className="w-full text-xs font-bold p-1.5 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none font-mono text-blue-500"
                />
              </div>
            </div>
          </div>

          {/* PIRINGAN KANAN: REALISASI KAS & PEMBAYARAN */}
          <div className="bg-(--bg-input)/40 p-4 rounded-xl border border-(--border-color) flex flex-col justify-between overflow-hidden">
            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-(--border-color) pb-1.5 shrink-0">
                <span className="font-black text-[11px] uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" /> REALISASI KAS &amp;
                  PEMBAYARAN
                </span>
                <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-black uppercase">
                  Data Dinamis
                </span>
              </div>

              {/* FORM INPUT BARIS BARU CEPAT */}
              <div className="flex items-center gap-1.5 p-1.5 bg-(--bg-card) rounded-lg border border-(--border-color) shrink-0">
                <input
                  type="text"
                  value={newRowName}
                  onChange={(e) => setNewRowName(e.target.value.toUpperCase())}
                  placeholder="Nama (EDC/QR/Compliment)..."
                  className="flex-1 text-xs font-bold bg-transparent outline-none text-(--text-primary) px-1 placeholder:text-[11px]"
                />
                <NumberInput
                  value={newRowAmount}
                  onChange={setNewRowAmount}
                  dataUnvNumpad="true"
                  placeholder="Nominal..."
                  className="w-24 text-xs font-mono font-black text-right bg-(--bg-input) p-1 rounded border border-(--border-color) outline-none text-(--text-primary)"
                />
                <button
                  type="button"
                  onClick={() => handleAddNewRow("SETTLEMENT")}
                  className="px-2 py-1 bg-emerald-500 text-white rounded text-[10px] font-black hover:bg-emerald-600 cursor-pointer"
                  title="Tambah Pemasukan / Non-Tunai (+)"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => handleAddNewRow("DEDUCTION")}
                  className="px-2 py-1 bg-rose-500 text-white rounded text-[10px] font-black hover:bg-rose-600 cursor-pointer"
                  title="Tambah Pengurang / Compliment (-)"
                >
                  -
                </button>
              </div>

              {/* DAFTAR BARIS DINAMIS */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1 min-h-18">
                {dynamicItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-1.5 bg-(--bg-card) rounded-md border border-(--border-color) text-xs"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className={`text-[8px] font-black px-1 py-0.2 rounded uppercase ${
                          item.category === "DEDUCTION"
                            ? "bg-rose-500/10 text-rose-500"
                            : "bg-emerald-500/10 text-emerald-500"
                        }`}
                      >
                        {item.category === "DEDUCTION" ? "[-]" : "[+]"}
                      </span>
                      <span className="font-bold text-(--text-primary) truncate">
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono font-black ${
                          item.category === "DEDUCTION"
                            ? "text-rose-500"
                            : "text-emerald-500"
                        }`}
                      >
                        {item.category === "DEDUCTION" ? "-" : ""} Rp{" "}
                        {(item.amount || 0).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(item.id)}
                        className="text-(--text-secondary) hover:text-rose-500 p-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {dynamicItems.length === 0 && (
                  <div className="text-center py-3 text-[11px] text-(--text-secondary) italic">
                    Ketik nama &amp; nominal di atas, lalu tekan [+] atau [-].
                  </div>
                )}
              </div>

              {/* BARIS PENGELUARAN PETTYCASH KASIR */}
              <div className="p-2 bg-blue-500/5 rounded-lg border border-blue-500/20 flex items-center justify-between shrink-0">
                <div className="truncate">
                  <div className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1">
                    <Receipt className="w-3 h-3" /> PETTYCASH KASIR (KELUAR):
                  </div>
                  <div className="text-[8px] text-(--text-secondary) truncate">
                    {pettycashKasirList.length} Nota di Receiving
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono font-black text-xs text-blue-500">
                    + Rp {livePettycashTotal.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsQuickPettycashOpen(true)}
                    className="px-1.5 py-0.5 bg-orange-500 text-white rounded text-[8px] font-black hover:bg-orange-600 cursor-pointer shadow-xs"
                  >
                    + NOTA
                  </button>
                </div>
              </div>

              {/* CASH ON HAND */}
              <div className="shrink-0">
                <label className="block text-[9px] font-black text-emerald-500 uppercase mb-0.5">
                  UANG FISIK KASIR (CASH ON HAND) (Rp)
                </label>
                <NumberInput
                  value={cashOnHand}
                  onChange={setCashOnHand}
                  required
                  dataUnvNumpad="true"
                  placeholder="0"
                  className="w-full text-sm font-black p-2 bg-(--bg-card) text-emerald-500 border border-(--border-color) rounded-lg outline-none font-mono focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER 1 BARIS */}
        <div className="px-5 py-2.5 bg-(--surface-hover) border-t border-(--border-color) flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-(--text-secondary) uppercase">
                GROSS SALES:
              </span>
              <span className="font-mono font-black text-orange-500 text-sm">
                Rp {grossSales.toLocaleString()}
              </span>
            </div>

            <div className="h-4 w-px bg-(--border-color)" />

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-(--text-secondary) uppercase">
                REALISASI:
              </span>
              <span className="font-mono font-black text-emerald-500 text-sm">
                Rp {totalRealization.toLocaleString()}
              </span>
            </div>

            <div className="h-4 w-px bg-(--border-color)" />

            <div
              className={`px-2.5 py-1 rounded-md border flex items-center gap-1 text-[10px] font-black uppercase font-mono ${
                isBalanced
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                  : balanceDifference < 0
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                    : "bg-blue-500/10 text-blue-500 border-blue-500/30"
              }`}
            >
              {isBalanced ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> SELISIH Rp 0
                </>
              ) : balanceDifference < 0 ? (
                <>
                  <AlertTriangle className="w-3 h-3" /> KURANG: Rp{" "}
                  {Math.abs(balanceDifference).toLocaleString()}
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" /> LEBIH: Rp{" "}
                  {balanceDifference.toLocaleString()}
                </>
              )}
            </div>

            {!isBalanced && (
              <input
                type="text"
                required
                value={discrepancyNote}
                onChange={(e) =>
                  setDiscrepancyNote(e.target.value.toUpperCase())
                }
                placeholder="Alasan selisih..."
                className="w-40 text-xs font-bold p-1 bg-(--bg-input) border border-rose-500/30 rounded outline-none text-rose-500 placeholder:text-rose-400/50"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold text-(--text-secondary) hover:bg-(--surface-hover) rounded-lg transition cursor-pointer"
            >
              BATAL
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              SIMPAN <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
