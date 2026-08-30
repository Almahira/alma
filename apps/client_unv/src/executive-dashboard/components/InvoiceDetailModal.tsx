// File: apps/client_unv/src/executive-dashboard/components/InvoiceDetailModal.tsx
import React from "react";
import { X, Receipt, Building2, Calendar, FileText } from "lucide-react";

export const InvoiceDetailModal: React.FC<{
  doc: any;
  onClose: () => void;
}> = ({ doc, onClose }) => {
  const items = doc.items || [];
  const sisaHutang = (doc.totalAmount || 0) - (doc.paidAmount || 0);

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-slate-900 text-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-orange-500" />
            <h3 className="font-black text-sm uppercase tracking-wide">
              Rincian Dokumen Faktur: {doc.invoiceNumber}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Tipe Tagihan:
              </span>
              <span className="font-black text-orange-400">
                {doc.documentType}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mt-2">
                Tanggal Faktur:
              </span>
              <span className="font-bold">
                {new Date(doc.date).toLocaleDateString("id-ID")}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Jatuh Tempo:
              </span>
              <span className="font-bold text-rose-400">
                {doc.dueDate
                  ? new Date(doc.dueDate).toLocaleDateString("id-ID")
                  : "CASH / LUNAS"}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mt-2">
                Status Pembayaran:
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${doc.paymentStatus === "PAID" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}
              >
                {doc.paymentStatus}
              </span>
            </div>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-[10px] uppercase font-black text-slate-400 border-b border-slate-800">
                  <th className="p-2.5">Nama Item / Jasa</th>
                  <th className="p-2.5 text-center">Qty</th>
                  <th className="p-2.5 text-right">Harga</th>
                  <th className="p-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {items.map((it: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold">{it.name || it.itemId}</td>
                    <td className="p-2.5 text-center font-mono">
                      {it.qty || 1}
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      Rp {(it.price || 0).toLocaleString()}
                    </td>
                    <td className="p-2.5 text-right font-mono font-black text-emerald-400">
                      Rp {(it.subtotal || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs font-bold">
            <div>
              <span className="text-slate-400 block text-[10px]">
                TOTAL NOTA: Rp {(doc.totalAmount || 0).toLocaleString()}
              </span>
              <span className="text-emerald-400 block text-[10px]">
                SUDAH BAYAR: Rp {(doc.paidAmount || 0).toLocaleString()}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-rose-400 uppercase font-black block">
                SISA HUTANG / TAGIHAN:
              </span>
              <span className="text-base font-black font-mono text-rose-400">
                Rp {sisaHutang.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
          >
            TUTUP
          </button>
        </div>
      </div>
    </div>
  );
};
