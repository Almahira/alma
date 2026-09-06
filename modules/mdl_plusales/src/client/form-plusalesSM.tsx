// File: modules/mdl_plusales/src/client/form-plusalesSM.tsx
import React, { useState, useMemo, useEffect } from "react";
import {
  Scale,
  Trash2,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Calendar,
  Plus,
  Minus,
  X,
} from "lucide-react";
import { useReceivingStore } from "../../../mdl_receiving/src/client/store";
import { useItemStore } from "../../../mdl_item/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayoutSM";
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
// 1. SUB-MODAL: INPUT PENGELUARAN PETTYCASH (MOBILE)
// =========================================================================
const QuickPettycashModalSM: React.FC<{
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

    let expenseItem = products.find(
      (p) => p.name === cleanName && p.isExpense === true,
    );
    let validItemId = expenseItem?.id;

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
              itemId: validItemId,
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
        `Pengeluaran kasir "${cleanName}" Rp ${Number(amount).toLocaleString("id-ID")} dicatat.`,
      );
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal Mencatat", err.message);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center border-b border-(--border-color) pb-2">
        <div>
          <h4 className="font-black text-xs text-(--text-primary) uppercase flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-orange-500" /> Catat Kas Keluar
          </h4>
          <p className="text-[10px] text-(--text-secondary) mt-0.5">
            Otomatis terhubung ke Buku Kas & Timbangan
          </p>
        </div>
        <button onClick={onClose} className="p-1 text-(--text-secondary) hover:text-rose-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            Keterangan Pengeluaran
          </label>
          <input
            type="text"
            required
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value.toUpperCase())}
            placeholder="CONTOH: BELI ES BATU / GAS..."
            className="w-full text-xs font-bold p-2.5 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
            Nominal Kasir (Rp)
          </label>
          <NumberInput
            value={amount}
            onChange={setAmount}
            required
            dataUnvNumpad="true"
            placeholder="0"
            className="w-full text-sm font-black p-2.5 bg-(--bg-input) text-rose-500 border border-(--border-color) rounded-lg outline-none font-mono"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-(--text-secondary) rounded-lg"
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-black text-white bg-orange-500 rounded-lg shadow-md"
          >
            Simpan Kas Keluar
          </button>
        </div>
      </form>
    </div>
  );
};

// =========================================================================
// 2. FORM UTAMA MOBILE: TIMBANGAN PENJUALAN KASIR
// =========================================================================
export const PlusalesFormModalSM: React.FC<{
  isEditMode?: boolean;
  initialData?: any;
  onClose: () => void;
}> = ({ isEditMode = false, initialData, onClose }) => {
  const { documents: receivingDocs } = useReceivingStore();
  const [isQuickPettycashOpen, setIsQuickPettycashOpen] = useState(false);
  const [mobileFormTab, setMobileFormTab] = useState<"OMSET" | "REALISASI">("OMSET");

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

  const grossSales = Math.max(
    0,
    (netSales || 0) - (discount || 0) + (tax || 0) + (service || 0),
  );

  // SISI DINAMIS (PIRINGAN KANAN)
  const [dynamicItems, setDynamicItems] = useState<DynamicItemRow[]>(
    initialData?.dynamicItems || [],
  );

  const [newRowName, setNewRowName] = useState("");
  const [newRowAmount, setNewRowAmount] = useState<number | "">("");
  const [cashOnHand, setCashOnHand] = useState<number>(
    initialData?.cashOnHand || 0,
  );
  const [discrepancyNote, setDiscrepancyNote] = useState<string>(
    initialData?.discrepancyNote || "",
  );

  // SINKRONISASI LIVE PETTYCASH
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
      return matchType && matchMethod && matchOutlet && matchDate && matchActive;
    });
  }, [receivingDocs, date, localOutletId]);

  const livePettycashTotal = useMemo(() => {
    return pettycashKasirList.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
  }, [pettycashKasirList]);

  // Realisasi Non-Tunai
  const totalDynamicSettlement = useMemo(() => {
    return dynamicItems.reduce((sum, item) => {
      const val = item.amount || 0;
      return item.category === "DEDUCTION" ? sum - Math.abs(val) : sum + val;
    }, 0);
  }, [dynamicItems]);

  const totalRealization =
    totalDynamicSettlement + livePettycashTotal + (cashOnHand || 0);

  const balanceDifference = totalRealization - grossSales;
  const isBalanced = balanceDifference === 0;

  const handleAddNewRow = (category: "SETTLEMENT" | "DEDUCTION") => {
    if (!newRowName.trim() || Number(newRowAmount) <= 0) {
      return sysToast.error("Error", "Isi nama dan nominal terlebih dahulu!");
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
    if (!isBalanced && !discrepancyNote.trim()) {
      return sysToast.error("Perhatian", "Terdapat selisih kas! Wajib mengisi alasan selisih.");
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
        `Rekap Penjualan tanggal ${date} tersimpan di Ledger.`,
      );
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal Menyimpan", err.message);
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-(--bg-card) text-(--text-primary)">
      {/* Submodal Pettycash */}
      {isQuickPettycashOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-(--bg-card) w-full max-w-sm rounded-2xl shadow-2xl border border-(--border-color) overflow-hidden">
            <QuickPettycashModalSM
              targetDate={date}
              onClose={() => setIsQuickPettycashOpen(false)}
            />
          </div>
        </div>
      )}

      <form onSubmit={handleSaveDocument} className="flex flex-col h-full overflow-hidden">
        {/* HEADER & DATE */}
        <div className="p-3 bg-(--surface-hover) border-b border-(--border-color) shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-black text-xs uppercase text-(--text-primary)">
              <Scale className="w-4 h-4 text-orange-500" />
              <span>{isEditMode ? "Edit Timbangan" : "Timbangan Harian"}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-(--bg-input) px-2 py-1 rounded-lg border border-(--border-color)">
              <Calendar className="w-3.5 h-3.5 text-orange-500" />
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent font-bold text-xs outline-none text-(--text-primary)"
              />
            </div>
          </div>

          {/* TAB SWITCHER: 1. OMSET (POS) VS 2. REALISASI KAS */}
          <div className="grid grid-cols-2 gap-1 bg-(--bg-input) p-1 rounded-xl border border-(--border-color)">
            <button
              type="button"
              onClick={() => setMobileFormTab("OMSET")}
              className={`py-1.5 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${
                mobileFormTab === "OMSET"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-(--text-secondary)"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" /> 1. OMSET POS
            </button>
            <button
              type="button"
              onClick={() => setMobileFormTab("REALISASI")}
              className={`py-1.5 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${
                mobileFormTab === "REALISASI"
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "text-(--text-secondary)"
              }`}
            >
              <Wallet className="w-3.5 h-3.5" /> 2. REALISASI KAS
            </button>
          </div>
        </div>

        {/* BODY TAB CONTENT */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
          {mobileFormTab === "OMSET" ? (
            /* TAB 1: SISI OMSET */
            <div className="space-y-3">
              <div className="p-3 bg-orange-500/5 rounded-xl border border-orange-500/20 flex justify-between items-center">
                <span className="text-[10px] font-black text-orange-500 uppercase">
                  Gross Sales Terhitung:
                </span>
                <span className="font-mono font-black text-base text-orange-500">
                  Rp {grossSales.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                  1. Net Sales / Menu Sold (Rp)
                </label>
                <NumberInput
                  value={netSales}
                  onChange={setNetSales}
                  required
                  autoFocus
                  dataUnvNumpad="true"
                  placeholder="0"
                  className="w-full text-base font-black p-2.5 bg-(--bg-input) border border-(--border-color) rounded-xl outline-none font-mono text-orange-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                  2. Total Diskon (-) (Rp)
                </label>
                <NumberInput
                  value={discount}
                  onChange={setDiscount}
                  dataUnvNumpad="true"
                  placeholder="0"
                  className="w-full text-xs font-bold p-2.5 bg-(--bg-input) border border-(--border-color) rounded-xl outline-none font-mono text-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                    3. PB1 Resto (10%)
                  </label>
                  <NumberInput
                    value={tax}
                    onChange={setTax}
                    dataUnvNumpad="true"
                    placeholder="0"
                    className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-xl outline-none font-mono text-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-(--text-secondary) uppercase mb-1">
                    4. Service Charge
                  </label>
                  <NumberInput
                    value={service}
                    onChange={setService}
                    dataUnvNumpad="true"
                    placeholder="0"
                    className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-xl outline-none font-mono text-blue-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileFormTab("REALISASI")}
                className="w-full py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 mt-4"
              >
                Lanjut ke Realisasi Kas & EDC <Wallet className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* TAB 2: SISI REALISASI KAS & NON-TUNAI */
            <div className="space-y-3">
              {/* Form Tambah Baris Non-Tunai / EDC / Voucher */}
              <div className="p-3 bg-(--bg-input)/70 rounded-xl border border-(--border-color) space-y-2">
                <span className="text-[10px] font-black text-(--text-secondary) uppercase block">
                  + Tambah Non-Tunai / Settlement EDC / Diskon:
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRowName}
                    onChange={(e) => setNewRowName(e.target.value.toUpperCase())}
                    placeholder="BCA / Mandiri / QRIS..."
                    className="flex-1 text-xs font-bold p-2 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-(--text-primary)"
                  />
                  <NumberInput
                    value={newRowAmount}
                    onChange={setNewRowAmount}
                    dataUnvNumpad="true"
                    placeholder="Nominal..."
                    className="w-28 text-xs font-mono font-bold text-right p-2 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-(--text-primary)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddNewRow("SETTLEMENT")}
                    className="py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> NON-TUNAI (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddNewRow("DEDUCTION")}
                    className="py-1.5 bg-rose-500 text-white rounded-lg text-xs font-black flex items-center justify-center gap-1 shadow-xs"
                  >
                    <Minus className="w-3.5 h-3.5" /> PENGURANG (-)
                  </button>
                </div>
              </div>

              {/* Daftar Baris Dinamis */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {dynamicItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 bg-(--bg-card) rounded-xl border border-(--border-color) text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`text-[8px] font-black px-1.5 py-0.2 rounded uppercase ${
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
                        className="text-(--text-secondary) hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Baris Kas Keluar (Pettycash Kasir) */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-blue-500 uppercase block">
                    Kas Kecil Kasir (Pettycash):
                  </span>
                  <span className="text-[9px] text-(--text-secondary)">
                    {pettycashKasirList.length} Nota di Receiving
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-xs text-blue-500">
                    + Rp {livePettycashTotal.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsQuickPettycashOpen(true)}
                    className="px-2 py-1 bg-orange-500 text-white rounded text-[10px] font-black uppercase shadow-xs"
                  >
                    + Nota
                  </button>
                </div>
              </div>

              {/* Uang Fisik Kasir (Cash on Hand) */}
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1">
                <label className="block text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">
                  Uang Fisik Kasir di Laci (Cash on Hand):
                </label>
                <NumberInput
                  value={cashOnHand}
                  onChange={setCashOnHand}
                  required
                  dataUnvNumpad="true"
                  placeholder="0"
                  className="w-full text-base font-black p-2.5 bg-(--bg-card) text-emerald-500 border border-(--border-color) rounded-xl outline-none font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* FOOTER STATS & SUBMIT (STICKY BOTTOM) */}
        <div className="p-3 bg-(--surface-hover) border-t border-(--border-color) shrink-0 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-[9px] text-(--text-secondary) uppercase font-bold block">
                Gross Sales:
              </span>
              <span className="font-mono font-black text-orange-500 text-xs">
                Rp {grossSales.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-(--text-secondary) uppercase font-bold block">
                Realisasi:
              </span>
              <span className="font-mono font-black text-emerald-500 text-xs">
                Rp {totalRealization.toLocaleString()}
              </span>
            </div>
            <div
              className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase font-mono ${
                isBalanced
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                  : balanceDifference < 0
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                    : "bg-blue-500/10 text-blue-500 border-blue-500/30"
              }`}
            >
              {isBalanced ? (
                "BALANCE"
              ) : balanceDifference < 0 ? (
                `KURANG Rp ${Math.abs(balanceDifference).toLocaleString()}`
              ) : (
                `LEBIH Rp ${balanceDifference.toLocaleString()}`
              )}
            </div>
          </div>

          {!isBalanced && (
            <input
              type="text"
              required
              value={discrepancyNote}
              onChange={(e) => setDiscrepancyNote(e.target.value.toUpperCase())}
              placeholder="Alasan selisih uang kasir..."
              className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-rose-500/40 rounded-xl outline-none text-rose-500 placeholder:text-rose-400/60"
            />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-bold text-(--text-secondary) rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-2 py-2.5 text-xs font-black text-white bg-slate-900 dark:bg-orange-500 rounded-xl shadow-md flex items-center justify-center gap-1.5 uppercase tracking-wider"
            >
              <CheckCircle2 className="w-4 h-4" /> Simpan Rekap
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
