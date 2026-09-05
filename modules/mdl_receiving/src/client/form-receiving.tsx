// File: modules/mdl_receiving/src/client/form-receiving.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  ShoppingCart,
  Receipt,
  UploadCloud,
  CheckCircle2,
  Trash2,
  Building2,
  Truck,
  Eye,
  Wallet,
  Calendar,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useItemStore } from "../../../mdl_item/src/client/store";
import { useVendorStore } from "../../../mdl_vendor/src/client/store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";
import { UniversalCombobox } from "../../../../apps/client_unv/src/shared-ui/UniversalCombobox";
import { useUniversalModal } from "../../../../apps/client_unv/src/shared-ui/UniversalLayout";
import { globalBlobManager } from "../../../../packages/core_unv/src/io/BlobManager";
import { ulid } from "ulidx";

/**
 * UTILITY: Smart Number Separator Sanitizer
 */
export function parseSmartNumber(val: string | number): number {
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

// =========================================================================
// 1. KOMPONEN: PREVIEW BUKTI TRANSFER PEMBAYARAN
// =========================================================================
const ProofViewerModal: React.FC<{ fileId: string; onClose: () => void }> = ({
  fileId,
  onClose,
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    globalBlobManager
      .getFileFromCacheOrDownload(fileId, "RECEIVING", true)
      .then((blob) => {
        if (blob && isMounted) setUrl(URL.createObjectURL(blob));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);

  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-75">
      {loading ? (
        <div className="text-xs font-bold text-slate-400 animate-pulse">
          Memuat Bukti Pembayaran...
        </div>
      ) : url ? (
        <img
          src={url}
          alt="Bukti Transfer"
          className="max-w-full max-h-[60vh] rounded-lg border shadow-md object-contain"
        />
      ) : (
        <div className="text-rose-500 text-xs font-bold">
          Bukti transfer belum tersinkronisasi offline.
        </div>
      )}
      <div className="mt-4 flex justify-end w-full">
        <button
          onClick={onClose}
          className="px-5 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-lg cursor-pointer"
        >
          TUTUP
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// 2. KOMPONEN FORM: PEMBAYARAN CICILAN 2-PANEL
// =========================================================================
export const PaymentModal: React.FC<{ document: any; onClose: () => void }> = ({
  document,
  onClose,
}) => {
  const { openCenterModal, closeCenterModal, openAlert } = useUniversalModal();

  const paymentsList = document.payments || [];
  const validPayments = paymentsList.filter((p: any) => p.status !== "VOID");
  const totalValidPaid = validPayments.reduce(
    (sum: number, p: any) => sum + (p.amount || 0),
    0,
  );
  const sisaTagihan = Math.max(0, (document.totalAmount || 0) - totalValidPaid);

  const [amount, setAmount] = useState<string>(sisaTagihan.toString());
  const [paymentMethod, setPaymentMethod] = useState("TRANSFER");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawNumeric = parseSmartNumber(amount);
    const numericAmount = Math.round(rawNumeric);

    if (numericAmount <= 0 || numericAmount > sisaTagihan) {
      setError(
        `Nominal harus antara 1 dan Rp ${sisaTagihan.toLocaleString("id-ID")}`,
      );
      return;
    }
    setError("");
    try {
      await globalCommandBus.execute({
        type: "ADD_RECEIVING_PAYMENT",
        payload: {
          documentId: document.id,
          amount: numericAmount,
          paymentMethod,
          paymentDate: new Date().toISOString(),
          proofFileObj: file,
        },
      });
      sysToast.success(
        "Sukses",
        `Pembayaran Rp ${numericAmount.toLocaleString("id-ID")} berhasil dicatat.`,
      );
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
      <div className="space-y-4 border-r border-slate-200 dark:border-slate-800 pr-4 flex flex-col justify-between">
        <div className="space-y-3">
          <div className="border-b pb-2">
            <h4 className="text-xs font-black text-slate-500 uppercase">
              Riwayat Pembayaran & Cicilan
            </h4>
            <div className="text-sm font-bold text-slate-800 dark:text-white mt-0.5 font-mono">
              Nota: {document.invoiceNumber}
            </div>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
            {paymentsList.map((p: any, idx: number) => {
              const isVoid = p.status === "VOID";
              return (
                <div
                  key={p.id || idx}
                  className={`p-3 rounded-xl border flex items-center justify-between transition ${
                    isVoid
                      ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 opacity-75"
                      : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase">
                        Cicilan Ke-{idx + 1}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-[8px] font-black rounded uppercase border ${
                          isVoid
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {isVoid ? "VOID / DIBATALKAN" : "SUKSES"}
                      </span>
                    </div>

                    <div
                      className={`text-xs font-bold font-mono mt-0.5 ${
                        isVoid
                          ? "line-through text-slate-400 dark:text-slate-500"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      Rp {(p.amount || 0).toLocaleString("id-ID")}
                    </div>

                    <div className="text-[9px] text-slate-400 mt-0.5">
                      {new Date(p.paymentDate).toLocaleDateString("id-ID")} •{" "}
                      {p.paymentMethod}
                      {p.voidReason && (
                        <span className="text-rose-500 ml-1 font-semibold">
                          ({p.voidReason})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {p.proofFileId && (
                      <button
                        type="button"
                        onClick={() =>
                          openCenterModal({
                            title: `BUKTI TRANSFER CICILAN KE-${idx + 1}`,
                            content: (
                              <ProofViewerModal
                                fileId={p.proofFileId}
                                onClose={closeCenterModal}
                              />
                            ),
                          })
                        }
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg border border-blue-200 dark:border-blue-800 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        title="Lihat Bukti Transfer"
                        aria-label={`Lihat bukti transfer cicilan ke-${idx + 1}`}
                      >
                        <Eye className="w-3 h-3" /> Bukti
                      </button>
                    )}

                    {!isVoid && document.status !== "CANCELLED" && (
                      <button
                        type="button"
                        onClick={() =>
                          openAlert({
                            title: "Batalkan Cicilan (VOID)",
                            message: `Batalkan cicilan ke-${idx + 1} sebesar Rp ${(p.amount || 0).toLocaleString("id-ID")}? Nominal ini tidak akan lagi dihitung sebagai pembayaran.`,
                            confirmText: "YA, VOID CICILAN",
                            onConfirm: async () => {
                              await globalCommandBus.execute({
                                type: "VOID_RECEIVING_PAYMENT",
                                payload: {
                                  documentId: document.id,
                                  paymentId: p.id,
                                  voidReason:
                                    "Dibatalkan oleh Pengguna (Koreksi)",
                                },
                              });
                              sysToast.success(
                                "Berhasil",
                                `Cicilan ke-${idx + 1} berhasil di-VOID.`,
                              );
                            },
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded border border-transparent hover:border-rose-200 dark:hover:border-rose-900 cursor-pointer"
                        title="Batalkan Cicilan Ini (VOID)"
                        aria-label={`Batalkan cicilan ke-${idx + 1}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {paymentsList.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400 italic">
                Belum ada riwayat cicilan.
              </div>
            )}
          </div>
        </div>

        <div className="p-3.5 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-300 dark:border-slate-700 space-y-1">
          <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>Total Nilai Dokumen:</span>
            <span className="font-mono">
              Rp {(document.totalAmount || 0).toLocaleString("id-ID")}
            </span>
          </div>
          <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span>Total Terbayar Sah:</span>
            <span className="font-mono">
              Rp {totalValidPaid.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="flex justify-between text-sm font-black text-rose-600 dark:text-rose-400 pt-1 border-t border-slate-200 dark:border-slate-700">
            <span>SISA TAGIHAN AKTIF:</span>
            <span className="font-mono text-base">
              Rp {sisaTagihan.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      <form
        onSubmit={handlePay}
        className="space-y-4 flex flex-col justify-between"
      >
        <div className="space-y-3">
          <div className="border-b pb-2">
            <h4 className="text-xs font-black text-slate-500 uppercase">
              Input Pembayaran Baru
            </h4>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200 mb-1">
              NOMINAL BAYAR (Rp)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError("");
              }}
              disabled={sisaTagihan <= 0}
              placeholder="0"
              className={`w-full text-lg font-black p-2.5 bg-white dark:bg-slate-900 border rounded-lg outline-none focus:border-emerald-500 font-mono text-emerald-600 dark:text-emerald-400 disabled:opacity-50 ${
                error
                  ? "border-rose-500"
                  : "border-slate-300 dark:border-slate-700"
              }`}
            />
            {error && (
              <p className="text-[10px] text-rose-500 font-bold mt-1">
                {error}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200 mb-1">
              SUMBER DANA
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              disabled={sisaTagihan <= 0}
              className="w-full text-xs font-bold p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg outline-none disabled:opacity-50"
            >
              <option value="TRANSFER">BANK TRANSFER / GIRO</option>
              <option value="KAS_BESAR">KAS BESAR (FINANCE)</option>
              <option value="KASIR">UANG LACI (KASIR)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200 mb-1">
              BUKTI TRANSFER / NOTA
            </label>
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer relative">
              <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-1" />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block truncate">
                {file ? file.name : "Klik untuk melampirkan file bukti..."}
              </span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                disabled={sisaTagihan <= 0}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            BATAL
          </button>
          <button
            type="submit"
            disabled={sisaTagihan <= 0}
            className="px-5 py-2 text-xs font-black text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            SIMPAN CICILAN
          </button>
        </div>
      </form>
    </div>
  );
};

// =========================================================================
// 3. KOMPONEN: MODAL VIEW RINCIAN FAKTUR
// =========================================================================
export const InvoiceDetailModal: React.FC<{
  document: any;
  vendorName: string;
  locationName: string;
  onClose: () => void;
}> = ({ document, vendorName, locationName, onClose }) => {
  const items = document.items || [];

  return (
    <div className="p-5 space-y-5 max-w-3xl">
      <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
        <div>
          <span className="text-slate-400 text-[10px] uppercase font-bold block">
            No. Invoice / Referensi:
          </span>
          <span className="font-black text-slate-900 dark:text-white font-mono text-sm">
            {document.invoiceNumber}
          </span>
          <span className="text-slate-400 text-[10px] uppercase font-bold block mt-2">
            Tanggal Transaksi:
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {new Date(document.date).toLocaleDateString("id-ID")}
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-[10px] uppercase font-bold block">
            Vendor / Sumber:
          </span>
          <span className="font-black text-orange-600 text-sm">
            {vendorName}
          </span>
          <span className="text-slate-400 text-[10px] uppercase font-bold block mt-2">
            Lokasi Unit:
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {locationName}
          </span>
        </div>
      </div>

      <div>
        <h5 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2">
          Rincian Barang / Jasa
        </h5>
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-black text-slate-600 dark:text-slate-300">
                <th className="p-2.5">Item</th>
                <th className="p-2.5 text-center w-16">Qty</th>
                <th className="p-2.5 text-right w-28">Harga</th>
                <th className="p-2.5 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {items.map((it: any, i: number) => (
                <tr
                  key={i}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                >
                  <td className="p-2.5 font-bold text-slate-800 dark:text-slate-100">
                    {it.name || it.itemId}
                    {it.isExpense && (
                      <span className="ml-2 text-[9px] text-rose-500 font-bold">
                        [JASA/BIAYA]
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-center font-mono text-slate-700 dark:text-slate-200">
                    {it.qty}
                  </td>
                  <td className="p-2.5 text-right font-mono text-slate-700 dark:text-slate-200">
                    Rp {(it.price || 0).toLocaleString("id-ID")}
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-slate-900 dark:text-white">
                    Rp {(it.subtotal || 0).toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-slate-50 dark:bg-slate-800 p-3 flex justify-between font-black text-sm text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700">
            <span>Total Nilai Dokumen:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              Rp {document.totalAmount.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={onClose}
          className="px-5 py-2 text-xs font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 rounded-lg cursor-pointer"
        >
          TUTUP
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// 4. KOMPONEN: MODAL KONFIRMASI SUBMIT
// =========================================================================
const ConfirmSubmitModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  documentType: string;
  invoiceNumber: string;
  total: number;
  itemCount: number;
}> = ({
  isOpen,
  onClose,
  onConfirm,
  isSaving,
  documentType,
  invoiceNumber,
  total,
  itemCount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
              Konfirmasi Simpan Dokumen
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pastikan rincian belanja sudah benar sebelum masuk ke Ledger.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-xs bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex justify-between">
            <span className="text-slate-500">Jenis Dokumen:</span>
            <span className="font-bold text-orange-500">{documentType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">No. Referensi / Nota:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {invoiceNumber || "-"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Jumlah Item:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {itemCount} Barang/Jasa
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
            <span className="text-slate-700 dark:text-slate-300 font-bold">
              Total Nilai Dokumen:
            </span>
            <span className="font-black font-mono text-emerald-600 dark:text-emerald-400 text-sm">
              Rp {total.toLocaleString("id-ID")}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer disabled:opacity-50"
          >
            BATAL
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="px-5 py-2 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                MENYIMPAN...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                YA, SIMPAN
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 5. KOMPONEN BARIS KERANJANG (CONTROLLED INPUT + SAFE ENTER)
// =========================================================================
const CartRow: React.FC<{
  item: any;
  index: number;
  onUpdate: (index: number, field: string, value: number) => void;
  onRemove: (index: number) => void;
}> = ({ item, index, onUpdate, onRemove }) => {
  const [qtyText, setQtyText] = useState<string>(String(item.qty));
  const [priceText, setPriceText] = useState<string>(String(item.price));
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setQtyText(String(item.qty));
    setPriceText(String(item.price));
  }, [item.qty, item.price]);

  const commitQty = (val: string) => {
    const parsed = parseSmartNumber(val);
    if (item.isExpense || parsed > 0) {
      onUpdate(index, "qty", parsed);
      setError("");
    } else {
      setError("Qty harus > 0");
      setQtyText(String(item.qty));
    }
  };

  const commitPrice = (val: string) => {
    const parsed = parseSmartNumber(val);
    if (parsed >= 0) {
      onUpdate(index, "price", parsed);
      setError("");
    } else {
      setError("Harga tidak valid");
      setPriceText(String(item.price));
    }
  };

  return (
    <tr>
      <td className="p-2.5 font-bold text-slate-800 dark:text-white">
        {item.name}
        {item.isExpense && (
          <span className="ml-2 text-[8px] bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded font-black border border-rose-500/20">
            JASA / BIAYA
          </span>
        )}
        {error && (
          <div className="text-[10px] text-rose-500 font-semibold mt-0.5">
            {error}
          </div>
        )}
      </td>
      <td className="p-2.5">
        {!item.isExpense ? (
          <input
            type="text"
            inputMode="decimal"
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value)}
            onBlur={() => commitQty(qtyText)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitQty(qtyText);
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-full text-xs font-bold p-1 bg-slate-50 dark:bg-slate-800 border rounded text-center font-mono"
            aria-label={`Qty untuk ${item.name}`}
          />
        ) : (
          <div className="text-center text-slate-400 font-mono">-</div>
        )}
      </td>
      <td className="p-2.5">
        <input
          type="text"
          inputMode="decimal"
          value={priceText}
          onChange={(e) => setPriceText(e.target.value)}
          onBlur={() => commitPrice(priceText)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitPrice(priceText);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-full text-xs font-bold p-1 bg-slate-50 dark:bg-slate-800 border rounded text-right text-blue-600 dark:text-blue-400 font-mono"
          aria-label={`Harga untuk ${item.name}`}
        />
      </td>
      <td className="p-2.5 text-right font-mono text-slate-900 dark:text-white font-bold">
        Rp {((item.qty || 1) * (item.price || 0)).toLocaleString("id-ID")}
      </td>
      <td className="p-2.5 text-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1 rounded cursor-pointer"
          title="Hapus item"
          aria-label={`Hapus ${item.name}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
};

// =========================================================================
// 6. FORM UTAMA: RECEIVING FORM
// =========================================================================
export const ReceivingForm: React.FC<{
  tabType: "HUTANG" | "PIUTANG" | "PETTYCASH";
  isEditMode?: boolean;
  initialData?: any;
  onClose: () => void;
}> = ({ tabType, isEditMode = false, initialData, onClose }) => {
  const { products } = useItemStore();
  const { vendors } = useVendorStore();
  const { outlets, regions } = useOrgStore();

  // ---> 1. RESOLUSI IDENTITAS PERANGKAT LOKAL OTOMATIS <---
  const localCompanyId = localStorage.getItem("__unv_companyId") || "";
  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";
  const isOutletMachine = Boolean(localOutletId);
  const isRegionMachine = Boolean(localRegionId) && !isOutletMachine;

  const generateInternalCode = () =>
    `INT-${Math.floor(100000 + Math.random() * 900000)}`;

  // Tentukan default Sumber Dana Pettycash
  const defaultPaymentMethod = isOutletMachine ? "KASIR" : "KAS_BESAR";

  const [header, setHeader] = useState({
    companyId: initialData?.companyId || localCompanyId,
    regionId: initialData?.regionId || localRegionId,
    outletId:
      initialData?.outletId || (tabType === "PIUTANG" ? "" : localOutletId),
    vendorId: initialData?.vendorId || "",
    invoiceNumber:
      initialData?.invoiceNumber ||
      (tabType === "PIUTANG" ? generateInternalCode() : ""),
    date: initialData?.date
      ? new Date(initialData.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    isTempo: tabType !== "PETTYCASH",
    dueDate: initialData?.dueDate
      ? new Date(initialData.dueDate).toISOString().split("T")[0]
      : tabType !== "PETTYCASH"
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
        : "",
    paymentMethod: initialData?.paymentMethod || defaultPaymentMethod,
  });

  const [vendorSource, setVendorSource] = useState<"EXTERNAL" | "INTERNAL">(
    isRegionMachine
      ? "EXTERNAL"
      : initialData?.vendorId === localRegionId
        ? "INTERNAL"
        : "EXTERNAL",
  );

  const [isCustomVendor, setIsCustomVendor] = useState<boolean>(() => {
    if (!isEditMode || !initialData) return false;
    const vendorExists = vendors.some((v) => v.id === initialData.vendorId);
    return (
      Boolean(initialData.vendorId) &&
      !vendorExists &&
      initialData.vendorId !== localRegionId
    );
  });

  const [customVendorName, setCustomVendorName] = useState<string>(() => {
    if (isEditMode && initialData?.vendorName && initialData.vendorId) {
      const vendorExists = vendors.some((v) => v.id === initialData.vendorId);
      if (!vendorExists && initialData.vendorId !== localRegionId) {
        return initialData.vendorName || "";
      }
    }
    return "";
  });

  const [cart, setCart] = useState<any[]>(initialData?.items || []);
  const [isExpense, setIsExpense] = useState(tabType === "PETTYCASH");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [inputQtyText, setInputQtyText] = useState<string>("1");
  const [inputPriceText, setInputPriceText] = useState<string>("0");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const itemComboboxRef = useRef<any>(null);

  useEffect(() => {
    if (isEditMode) return;

    setHeader((prev) => ({
      ...prev,
      companyId: localCompanyId,
      regionId: localRegionId,
      outletId: tabType === "PIUTANG" ? "" : localOutletId,
      invoiceNumber: tabType === "PIUTANG" ? generateInternalCode() : "",
      vendorId: vendorSource === "INTERNAL" ? localRegionId : "",
      isTempo: tabType !== "PETTYCASH",
      dueDate:
        tabType !== "PETTYCASH"
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0]
          : "",
      paymentMethod: defaultPaymentMethod,
    }));
    setIsCustomVendor(false);
    setCustomVendorName("");
    setCart([]);
    setErrors({});
  }, [
    tabType,
    vendorSource,
    localCompanyId,
    localRegionId,
    localOutletId,
    isEditMode,
    isRegionMachine,
    defaultPaymentMethod,
  ]);

  useEffect(() => {
    if (selectedItemId) {
      const scopeKey =
        header.outletId || header.regionId || header.companyId || "DEFAULT";

      const item = products.find((p) => p.id === selectedItemId);
      if (item && item.pricing) {
        const pricing =
          item.pricing[scopeKey] ||
          item.pricing[Object.keys(item.pricing)[0]] ||
          {};
        let price = 0;

        if (tabType === "PIUTANG" || vendorSource === "INTERNAL") {
          price = pricing.sellingPrice || 0;
        } else {
          price = pricing.basePrice || 0;
        }

        setInputPriceText(String(price));
      }
    }
  }, [
    selectedItemId,
    header.outletId,
    header.regionId,
    header.companyId,
    vendorSource,
    tabType,
    products,
  ]);

  const handleAddToCart = () => {
    const finalQty = isExpense ? 1 : parseSmartNumber(inputQtyText);
    const finalPrice = parseSmartNumber(inputPriceText);

    if (!selectedItemId || finalPrice < 0 || (!isExpense && finalQty <= 0)) {
      setErrors((prev) => ({
        ...prev,
        cart: "Pilih item dan pastikan QTY & Harga valid.",
      }));
      return;
    }

    const item = products.find((p) => p.id === selectedItemId);
    if (!item) return;

    const newItem = {
      id: Date.now().toString(),
      itemId: item.id,
      name: item.name,
      isExpense,
      qty: finalQty,
      price: finalPrice,
      subtotal: finalQty * finalPrice,
    };

    setCart((prev) => [...prev, newItem]);
    setSelectedItemId("");
    setInputQtyText("1");
    setInputPriceText("0");
    setErrors((prev) => ({ ...prev, cart: "" }));

    setTimeout(() => {
      if (itemComboboxRef.current?.focus) {
        itemComboboxRef.current.focus();
      }
    }, 50);
  };

  const handleUpdateCartItem = (
    index: number,
    field: string,
    value: number,
  ) => {
    setCart((prev) => {
      const newCart = [...prev];
      newCart[index] = { ...newCart[index], [field]: value };
      newCart[index].subtotal =
        (newCart[index].qty || 1) * (newCart[index].price || 0);
      return newCart;
    });
  };

  const handleRemoveCart = (index: number) =>
    setCart((prev) => prev.filter((_, i) => i !== index));

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (cart.length === 0) {
      newErrors.cart = "Keranjang belanja kosong!";
    }

    if (tabType === "HUTANG" && vendorSource === "EXTERNAL") {
      if (!isCustomVendor && !header.vendorId) {
        newErrors.vendor = "Pilih vendor terlebih dahulu";
      }
      if (isCustomVendor && !customVendorName.trim()) {
        newErrors.customVendor = "Nama vendor baru tidak boleh kosong";
      }
    }

    if (tabType === "PIUTANG" && !header.outletId) {
      newErrors.outlet = "Pilih outlet tujuan";
    }

    if (!header.invoiceNumber && tabType !== "PETTYCASH") {
      newErrors.invoiceNumber = "Nomor referensi wajib diisi";
    }

    if (!header.date) {
      newErrors.date = "Tanggal wajib diisi";
    }

    if (tabType !== "PETTYCASH" && header.isTempo && !header.dueDate) {
      newErrors.dueDate = "Tanggal jatuh tempo wajib diisi";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      sysToast.error("Error", "Periksa kembali isian form");
      return;
    }
    // Hanya buka modal konfirmasi, TIDAK menjalankan mutasi database di sini
    setIsConfirmOpen(true);
  };

  // EKSEKUSI PENYIMPANAN RIIL (Dijalankan hanya saat tombol 'YA, SIMPAN' diklik)
  const handleConfirmSave = async () => {
    setIsSaving(true);
    try {
      let finalVendorId =
        vendorSource === "INTERNAL" ? header.regionId : header.vendorId;

      // 1. Jika vendor baru diketik manual (Hanya create saat dokumen baru)
      if (
        tabType === "HUTANG" &&
        vendorSource === "EXTERNAL" &&
        isCustomVendor
      ) {
        if (!isEditMode || !header.vendorId) {
          const generatedId = `VND_${ulid()}`;
          await globalCommandBus.execute({
            type: "CREATE_VENDOR",
            payload: {
              id: generatedId,
              companyId: header.companyId,
              regionId: header.regionId,
              name: customVendorName.toUpperCase().trim(),
            },
          });
          finalVendorId = generatedId;
        }
      }

      // 2. Simpan Dokumen Receiving ke Ledger
      if (isEditMode) {
        await globalCommandBus.execute({
          type: "UPDATE_RECEIVING",
          payload: {
            documentId: initialData.id,
            ...header,
            vendorId: finalVendorId,
            items: cart,
          },
        });
        sysToast.success(
          "Berhasil",
          `Perubahan dokumen ${header.invoiceNumber} berhasil disimpan.`,
        );
      } else {
        await globalCommandBus.execute({
          type: "CREATE_RECEIVING",
          payload: {
            ...header,
            vendorId: finalVendorId,
            documentType: tabType,
            items: cart,
          },
        });
        sysToast.success("Berhasil", `Dokumen ${tabType} berhasil disimpan.`);
      }

      setIsConfirmOpen(false);
      onClose();
    } catch (err: any) {
      sysToast.error("Gagal Menyimpan", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const outletOptions = outlets
    .filter((o) => o.regionId === localRegionId && o.status === "Aktif")
    .map((o) => ({ value: o.id, label: o.name }));

  const filteredProductsByExpense = products
    .filter(
      (p) =>
        p.status === "Aktif" &&
        p.approvalStatus !== "REJECTED" &&
        (isExpense ? p.isExpense === true : !p.isExpense),
    )
    .map((p) => ({ value: p.id, label: p.name }));

  const externalVendorOptions = vendors
    .filter((v) => v.status === "Aktif")
    .map((v) => ({ value: v.id, label: v.name }));

  const currentRegion = regions.find((r) => r.id === localRegionId);

  return (
    <form
      onSubmit={handleSaveDocument}
      className="flex flex-col h-full bg-(--bg-card)"
    >
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
        {/* HEADER TRANSAKSI */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-slate-800 dark:text-white font-black text-sm uppercase">
              <Receipt className="w-4 h-4 text-orange-500" />{" "}
              {isEditMode ? "EDIT DOKUMEN" : "BUAT DOKUMEN"} {tabType}
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20">
              {isOutletMachine ? "CABANG OUTLET" : "REGIONAL GUDANG PUSAT"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">
                TANGGAL NOTA
              </label>
              <input
                type="date"
                value={header.date}
                onChange={(e) =>
                  setHeader((prev) => ({ ...prev, date: e.target.value }))
                }
                required
                className={`w-full text-xs font-bold p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border rounded-lg outline-none dark:scheme-dark ${
                  errors.date
                    ? "border-rose-500"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              />
              {errors.date && (
                <p className="text-[10px] text-rose-500 font-bold mt-1">
                  {errors.date}
                </p>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">
                {tabType === "PETTYCASH"
                  ? "KETERANGAN PENGELUARAN"
                  : "NO. REFERENSI / NOTA"}
              </label>
              <input
                type="text"
                value={header.invoiceNumber}
                onChange={(e) =>
                  setHeader((prev) => ({
                    ...prev,
                    invoiceNumber: e.target.value.toUpperCase(),
                  }))
                }
                required
                disabled={tabType === "PIUTANG"}
                placeholder={
                  tabType === "PETTYCASH"
                    ? "Contoh: BELI GAS / SERVICE AC"
                    : "Contoh: INV-0822..."
                }
                className={`w-full text-xs font-bold p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border rounded-lg outline-none disabled:opacity-50 font-mono ${
                  errors.invoiceNumber
                    ? "border-rose-500"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              />
              {errors.invoiceNumber && (
                <p className="text-[10px] text-rose-500 font-bold mt-1">
                  {errors.invoiceNumber}
                </p>
              )}
            </div>
          </div>

          {/* TAB 1: FORM HUTANG */}
          {tabType === "HUTANG" && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              {isOutletMachine ? (
                <>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    SUMBER PEMASOK / VENDOR:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setVendorSource("EXTERNAL");
                        setHeader((p) => ({ ...p, vendorId: "" }));
                        setErrors((prev) => ({ ...prev, vendor: "" }));
                      }}
                      className={`py-2 px-3 text-xs font-black rounded-lg border flex items-center justify-center gap-2 transition cursor-pointer ${
                        vendorSource === "EXTERNAL"
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-600 shadow-xs"
                          : "border-slate-300 dark:border-slate-700 text-slate-500"
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" /> VENDOR EKSTERNAL
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVendorSource("INTERNAL");
                        setHeader((p) => ({ ...p, vendorId: localRegionId }));
                        setErrors((prev) => ({ ...prev, vendor: "" }));
                      }}
                      className={`py-2 px-3 text-xs font-black rounded-lg border flex items-center justify-center gap-2 transition cursor-pointer ${
                        vendorSource === "INTERNAL"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 shadow-xs"
                          : "border-slate-300 dark:border-slate-700 text-slate-500"
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" /> SUPLAI GUDANG PUSAT
                      (INTERNAL)
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  PEMASOK VENDOR EKSTERNAL
                </div>
              )}

              {vendorSource === "EXTERNAL" ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500">
                      PILIH VENDOR
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomVendor(!isCustomVendor);
                        setHeader((p) => ({ ...p, vendorId: "" }));
                        setCustomVendorName("");
                        setErrors((prev) => ({
                          ...prev,
                          vendor: "",
                          customVendor: "",
                        }));
                      }}
                      className="text-[10px] font-black text-orange-600 hover:underline cursor-pointer"
                    >
                      {isCustomVendor
                        ? "PILIH DARI DATA LAMA"
                        : "+ KETIK VENDOR BARU"}
                    </button>
                  </div>
                  {isCustomVendor ? (
                    <div>
                      <input
                        type="text"
                        value={customVendorName}
                        onChange={(e) =>
                          setCustomVendorName(e.target.value.toUpperCase())
                        }
                        required
                        placeholder="Ketik nama vendor baru..."
                        autoFocus
                        className={`w-full text-xs font-bold p-2.5 bg-orange-50 dark:bg-orange-950/30 border rounded-lg outline-none text-orange-800 dark:text-orange-200 ${
                          errors.customVendor
                            ? "border-rose-500"
                            : "border-orange-300 dark:border-orange-800"
                        }`}
                      />
                      {errors.customVendor && (
                        <p className="text-[10px] text-rose-500 font-bold mt-1">
                          {errors.customVendor}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <UniversalCombobox
                        options={externalVendorOptions}
                        value={header.vendorId}
                        onChange={(v) => {
                          setHeader((p) => ({ ...p, vendorId: v }));
                          setErrors((prev) => ({ ...prev, vendor: "" }));
                        }}
                        placeholder="Ketik lalu pilih nama vendor..."
                      />
                      {errors.vendor && (
                        <p className="text-[10px] text-rose-500 font-bold mt-1">
                          {errors.vendor}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center justify-between">
                  <span>
                    SUMBER: GUDANG PUSAT [
                    {currentRegion?.name || "REGIONAL HUB"}]
                  </span>
                  <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-black">
                    HARGA JUAL B2B
                  </span>
                </div>
              )}

              {/* JATUH TEMPO */}
              <div className="pt-1">
                <label className="block text-[10px] font-bold text-rose-500 uppercase mb-1 items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> TANGGAL JATUH TEMPO
                  (TEMPO)
                </label>
                <input
                  type="date"
                  value={header.dueDate}
                  onChange={(e) =>
                    setHeader((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                  required
                  className={`w-full text-xs font-bold p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-lg outline-none text-rose-600 font-mono dark:scheme-dark ${
                    errors.dueDate
                      ? "border-rose-500"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                />
                {errors.dueDate && (
                  <p className="text-[10px] text-rose-500 font-bold mt-1">
                    {errors.dueDate}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FORM PIUTANG */}
          {tabType === "PIUTANG" && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  OUTLET CABANG PENERIMA
                </label>
                <UniversalCombobox
                  options={outletOptions}
                  value={header.outletId || ""}
                  onChange={(v) => {
                    setHeader((p) => ({ ...p, outletId: v }));
                    setErrors((prev) => ({ ...prev, outlet: "" }));
                  }}
                  placeholder="Pilih outlet cabang tujuan..."
                />
                {errors.outlet && (
                  <p className="text-[10px] text-rose-500 font-bold mt-1">
                    {errors.outlet}
                  </p>
                )}
              </div>

              <div className="pt-1">
                <label className="block text-[10px] font-bold text-rose-500 uppercase mb-1 items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> TANGGAL JATUH TEMPO
                  (DISTRIBUSI TEMPO)
                </label>
                <input
                  type="date"
                  value={header.dueDate}
                  onChange={(e) =>
                    setHeader((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                  required
                  className={`w-full text-xs font-bold p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-lg outline-none text-rose-600 font-mono dark:scheme-dark ${
                    errors.dueDate
                      ? "border-rose-500"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                />
                {errors.dueDate && (
                  <p className="text-[10px] text-rose-500 font-bold mt-1">
                    {errors.dueDate}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FORM PETTYCASH */}
          {tabType === "PETTYCASH" && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase mb-1 items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" /> SUMBER DANA KAS KECIL (CASH
                  / LUNAS)
                </label>
                <select
                  value={header.paymentMethod}
                  onChange={(e) =>
                    setHeader((p) => ({ ...p, paymentMethod: e.target.value }))
                  }
                  className="w-full text-xs font-bold p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-emerald-500"
                >
                  {isOutletMachine ? (
                    <>
                      <option value="KASIR">
                        UANG LACI (KASIR POS) - PEMOTONG OMSET
                      </option>
                      <option value="KAS_BESAR">
                        KAS BESAR / OPERASIONAL TOKO
                      </option>
                      <option value="FINANCE">DANA FINANCE / PUSAT</option>
                    </>
                  ) : (
                    <>
                      <option value="KAS_BESAR">
                        KAS BESAR / OPERASIONAL GUDANG
                      </option>
                      <option value="FINANCE">DANA FINANCE / PUSAT</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* INPUT KERANJANG BELANJA */}
        <div className="bg-blue-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-blue-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-blue-700 dark:text-blue-400 font-black text-sm uppercase flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> KERANJANG ITEM
            </div>
            <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setIsExpense(false);
                  setSelectedItemId("");
                  setInputPriceText("0");
                }}
                className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer ${
                  !isExpense
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                PRODUK BARANG
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExpense(true);
                  setSelectedItemId("");
                  setInputPriceText("0");
                }}
                className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer ${
                  isExpense
                    ? "bg-rose-600 text-white"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                JASA / BIAYA
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">
              CARI {isExpense ? "JASA / BIAYA OPERASIONAL" : "PRODUK BARANG"}
            </label>
            <UniversalCombobox
              ref={itemComboboxRef}
              options={filteredProductsByExpense}
              value={selectedItemId}
              onChange={(v) => setSelectedItemId(v)}
              placeholder={`Ketik nama ${isExpense ? "jasa/biaya" : "barang"}...`}
            />
          </div>

          <div className="flex gap-2">
            {!isExpense && (
              <div className="w-28">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  QTY (DESIMAL)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputQtyText}
                  onChange={(e) => setInputQtyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const priceInput = document.getElementById(
                        "price-input",
                      ) as HTMLInputElement;
                      if (priceInput) priceInput.focus();
                    }
                  }}
                  placeholder="1 atau 2,5"
                  className="w-full text-sm font-bold p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg outline-none font-mono text-center"
                />
              </div>
            )}
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 mb-1">
                {isExpense ? "NOMINAL BIAYA (Rp)" : "HARGA SATUAN (Rp)"}
              </label>
              <input
                id="price-input"
                type="text"
                inputMode="decimal"
                value={inputPriceText}
                onChange={(e) => setInputPriceText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddToCart();
                  }
                }}
                className="w-full text-sm font-black p-2 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-slate-300 dark:border-slate-700 rounded-lg outline-none font-mono"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAddToCart}
                className="h-9.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg transition shadow-md cursor-pointer"
              >
                + TAMBAH
              </button>
            </div>
          </div>
          {errors.cart && (
            <p className="text-[10px] text-rose-500 font-bold">{errors.cart}</p>
          )}
        </div>

        {/* TABEL DAFTAR KERANJANG */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse bg-white dark:bg-slate-900">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase">
                <th className="p-2.5">Item</th>
                <th className="p-2.5 w-20 text-center">Qty</th>
                <th className="p-2.5 w-28 text-right">Harga</th>
                <th className="p-2.5 text-right">Subtotal</th>
                <th className="p-2.5 text-center w-8">X</th>
              </tr>
            </thead>
            <tbody className="text-xs font-semibold divide-y divide-slate-100 dark:divide-slate-800">
              {cart.map((c, i) => (
                <CartRow
                  key={c.id}
                  item={c}
                  index={i}
                  onUpdate={handleUpdateCartItem}
                  onRemove={handleRemoveCart}
                />
              ))}
              {cart.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center text-slate-400 italic"
                  >
                    Keranjang item masih kosong.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="bg-slate-50 dark:bg-slate-800 p-3.5 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span className="font-bold text-slate-500 text-xs">
              GRAND TOTAL
            </span>
            <span className="font-black text-emerald-600 dark:text-emerald-400 text-xl font-mono">
              Rp {cartTotal.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
        >
          BATAL
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xl flex items-center gap-2 cursor-pointer"
        >
          {isEditMode ? "SIMPAN PERUBAHAN" : "SIMPAN DOKUMEN"}{" "}
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </button>
      </div>

      {/* Modal Konfirmasi */}
      <ConfirmSubmitModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        isSaving={isSaving}
        documentType={tabType}
        invoiceNumber={header.invoiceNumber}
        total={cartTotal}
        itemCount={cart.length}
      />
    </form>
  );
};
