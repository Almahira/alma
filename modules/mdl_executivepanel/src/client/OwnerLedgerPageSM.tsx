// File: modules/mdl_executivepanel/src/client/OwnerLedgerPageSM.tsx
import React, { useState, useMemo } from "react";
import {
  Wallet,
  Trash2,
  Calendar,
  Building2,
  Coins,
  Receipt,
  Plus,
  ArrowRightLeft,
  ChevronDown,
} from "lucide-react";
import { useExecutivePanelStore } from "./store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { usePlusalesStore } from "../../../mdl_plusales/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";

export function OwnerLedgerPageSM() {
  const { allocations, ownerLedgers } = useExecutivePanelStore();
  const { outlets } = useOrgStore();
  const { documents: plusalesDocs } = usePlusalesStore();

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedOutletId, setSelectedOutletId] = useState<string>(
    outlets[0]?.id || "",
  );

  const [activeTab, setActiveTab] = useState<"ALLOCATION" | "WITHDRAWAL">("ALLOCATION");

  // HITUNG TOTAL NET SALES BULAN TERPILIH
  const totalNetSalesMonth = useMemo(() => {
    return plusalesDocs
      .filter((d) => {
        const matchMonth = d.date && d.date.startsWith(selectedMonth);
        const matchOutlet =
          !selectedOutletId || d.outletId === selectedOutletId;
        const matchActive = d.isActive !== false;
        return matchMonth && matchOutlet && matchActive;
      })
      .reduce((sum, d) => sum + (d.netSales || 0), 0);
  }, [plusalesDocs, selectedMonth, selectedOutletId]);

  // 1. STATE ALOKASI CADANGAN
  const [allocName, setAllocName] = useState("");
  const [allocPct, setAllocPct] = useState<number | "">("");
  const [allocNominal, setAllocNominal] = useState<number | "">("");

  const handleAllocPctChange = (pctVal: number | "") => {
    setAllocPct(pctVal);
    if (pctVal === "" || Number(pctVal) <= 0) {
      setAllocNominal("");
    } else if (totalNetSalesMonth > 0) {
      setAllocNominal(Math.round(totalNetSalesMonth * (Number(pctVal) / 100)));
    }
  };

  const handleAllocNominalChange = (nomVal: number | "") => {
    setAllocNominal(nomVal);
    if (nomVal === "" || Number(nomVal) <= 0 || totalNetSalesMonth <= 0) {
      setAllocPct("");
    } else {
      setAllocPct(
        parseFloat(((Number(nomVal) / totalNetSalesMonth) * 100).toFixed(2)),
      );
    }
  };

  const handleSaveAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocName.trim()) {
      return sysToast.error("Error", "Nama alokasi wajib diisi!");
    }
    if (
      (!allocPct || Number(allocPct) <= 0) &&
      (!allocNominal || Number(allocNominal) <= 0)
    ) {
      return sysToast.error("Error", "Isi persentase (%) atau nominal (Rp)!");
    }
    const companyId = localStorage.getItem("__unv_companyId") || "";
    try {
      await globalCommandBus.execute({
        type: "SET_EXECUTIVE_ALLOCATION",
        payload: {
          companyId,
          outletId: selectedOutletId || null,
          month: selectedMonth,
          name: allocName.toUpperCase().trim(),
          percentage: Number(allocPct) || 0,
          nominal: Number(allocNominal) || 0,
        },
      });
      sysToast.success(
        "Alokasi Disimpan",
        `Cadangan ${allocName.toUpperCase()} berhasil diset.`,
      );
      setAllocName("");
      setAllocPct("");
      setAllocNominal("");
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  // 2. STATE PENARIKAN OWNER / DEVIDEN
  const [withdrawDate, setWithdrawDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [withdrawCategory, setWithdrawCategory] = useState<
    "PRIVE" | "GAJI_HOLDING" | "DEVIDEN_MITRA" | "PROYEK"
  >("PRIVE");
  const [recipientName, setRecipientName] = useState("PEMILIK / DIREKSI");
  const [withdrawPct, setWithdrawPct] = useState<number | "">("");
  const [withdrawAmount, setWithdrawAmount] = useState<number | "">("");
  const [sourceFund, setSourceFund] = useState("TRANSFER_BANK");
  const [withdrawNotes, setWithdrawNotes] = useState("");

  const handleWithdrawPctChange = (pctVal: number | "") => {
    setWithdrawPct(pctVal);
    if (pctVal === "" || Number(pctVal) <= 0) {
      setWithdrawAmount("");
    } else if (totalNetSalesMonth > 0) {
      setWithdrawAmount(
        Math.round(totalNetSalesMonth * (Number(pctVal) / 100)),
      );
    }
  };

  const handleWithdrawAmountChange = (amtVal: number | "") => {
    setWithdrawAmount(amtVal);
    if (amtVal === "" || Number(amtVal) <= 0 || totalNetSalesMonth <= 0) {
      setWithdrawPct("");
    } else {
      setWithdrawPct(
        parseFloat(((Number(amtVal) / totalNetSalesMonth) * 100).toFixed(2)),
      );
    }
  };

  const handleSaveWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      return sysToast.error("Error", "Nama penerima wajib diisi!");
    }
    const hasPct = withdrawPct !== "" && Number(withdrawPct) > 0;
    const hasAmt = withdrawAmount !== "" && Number(withdrawAmount) > 0;
    if (!hasPct && !hasAmt) {
      return sysToast.error(
        "Error",
        "Isi persentase (%) atau nominal (Rp)!",
      );
    }
    const companyId = localStorage.getItem("__unv_companyId") || "";
    const finalAmount = hasAmt
      ? Number(withdrawAmount)
      : hasPct
        ? Math.round(totalNetSalesMonth * (Number(withdrawPct) / 100))
        : 0;
    try {
      await globalCommandBus.execute({
        type: "CREATE_OWNER_LEDGER",
        payload: {
          companyId,
          outletId: selectedOutletId || null,
          date: withdrawDate,
          category: withdrawCategory,
          recipientName: recipientName.toUpperCase().trim(),
          percentage: Number(withdrawPct) || 0,
          amount: finalAmount,
          sourceFund,
          notes: withdrawNotes.trim()
            ? withdrawNotes.toUpperCase().trim()
            : null,
        },
      });
      sysToast.success(
        "Penarikan Dicatat",
        `${withdrawCategory} berhasil dicatat.`,
      );
      setWithdrawAmount("");
      setWithdrawPct("");
      setWithdrawNotes("");
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  // Filter Alokasi
  const filteredAllocations = useMemo(() => {
    return allocations.filter(
      (a) =>
        a.month === selectedMonth &&
        (!selectedOutletId || !a.outletId || a.outletId === selectedOutletId),
    );
  }, [allocations, selectedMonth, selectedOutletId]);

  const totalAllocNominal = useMemo(() => {
    return filteredAllocations.reduce((sum, a) => {
      const nominal =
        a.percentage > 0
          ? Math.round(totalNetSalesMonth * (a.percentage / 100))
          : a.nominal || 0;
      return sum + nominal;
    }, 0);
  }, [filteredAllocations, totalNetSalesMonth]);

  const totalAllocPct = useMemo(() => {
    return filteredAllocations.reduce((sum, a) => sum + (a.percentage || 0), 0);
  }, [filteredAllocations]);

  // Filter Penarikan
  const filteredWithdrawals = useMemo(() => {
    return ownerLedgers.filter((o) => {
      const matchMonth = o.date && o.date.startsWith(selectedMonth);
      const matchActive = o.isActive !== false;
      const matchOutlet =
        !selectedOutletId || !o.outletId || o.outletId === selectedOutletId;
      return matchMonth && matchActive && matchOutlet;
    });
  }, [ownerLedgers, selectedMonth, selectedOutletId]);

  const totalWithdrawalPeriod = useMemo(() => {
    return filteredWithdrawals.reduce((sum, o) => {
      const amount =
        o.percentage && o.percentage > 0
          ? Math.round(totalNetSalesMonth * (o.percentage / 100))
          : o.amount || 0;
      return sum + amount;
    }, 0);
  }, [filteredWithdrawals, totalNetSalesMonth]);

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card) text-(--text-primary)">
      {/* HEADER MOBILE */}
      <div className="p-3 bg-(--bg-card) border-b border-(--border-color) shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide">
                Buku Kas Pemilik
              </h2>
              <span className="text-[10px] text-(--text-secondary) font-bold">
                Prive, Deviden &amp; Alokasi
              </span>
            </div>
          </div>

          <div className="px-2.5 py-1 bg-orange-500/10 border border-orange-500/30 rounded-xl text-xs font-bold text-orange-500 flex items-center gap-1 font-mono">
            <Receipt className="w-3.5 h-3.5" />
            <span>Rp {(totalNetSalesMonth / 1000000).toFixed(1)}Jt</span>
          </div>
        </div>

        {/* SELECTOR OUTLET & BULAN */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1 bg-(--bg-input) border border-(--border-color) rounded-xl px-2 py-1">
            <Building2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="bg-transparent text-xs font-bold text-(--text-primary) outline-none w-full"
            >
              <option value="">-- SEMUA OUTLET --</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-(--bg-input) border border-(--border-color) rounded-xl px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-(--text-primary) outline-none font-mono w-full"
            />
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="grid grid-cols-2 gap-1 bg-(--bg-input) p-1 rounded-xl border border-(--border-color)">
          <button
            type="button"
            onClick={() => setActiveTab("ALLOCATION")}
            className={`py-1.5 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === "ALLOCATION"
                ? "bg-orange-500 text-white shadow-xs"
                : "text-(--text-secondary)"
            }`}
          >
            <Coins className="w-3.5 h-3.5" /> 1. CADANGAN OPSIONAL
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("WITHDRAWAL")}
            className={`py-1.5 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === "WITHDRAWAL"
                ? "bg-emerald-500 text-white shadow-xs"
                : "text-(--text-secondary)"
            }`}
          >
            <Wallet className="w-3.5 h-3.5" /> 2. PENARIKAN OWNER
          </button>
        </div>
      </div>

      {/* BODY KONTEN */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {activeTab === "ALLOCATION" ? (
          /* ========================================================= */
          /* TAB 1: CADANGAN OPSIONAL OWNER                           */
          /* ========================================================= */
          <div className="space-y-3">
            {/* Form Alokasi Cadangan */}
            <form
              onSubmit={handleSaveAllocation}
              className="p-3 bg-(--surface-hover) rounded-xl border border-(--border-color) space-y-2.5"
            >
              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Nama Alokasi Cadangan Laba
                </label>
                <input
                  type="text"
                  required
                  value={allocName}
                  onChange={(e) => setAllocName(e.target.value.toUpperCase())}
                  placeholder="e.g. UMROH / THR / DANA DARURAT..."
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none text-(--text-primary)"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-orange-500 uppercase mb-0.5">
                    % Net Sales
                  </label>
                  <input
                    type="number"
                    step="any"
                    min={0.01}
                    value={allocPct}
                    onChange={(e) =>
                      handleAllocPctChange(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="2%"
                    className="w-full text-xs font-mono font-black text-center p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none text-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-emerald-500 uppercase mb-0.5">
                    Nominal Terhitung (Rp)
                  </label>
                  <input
                    type="number"
                    value={allocNominal}
                    onChange={(e) =>
                      handleAllocNominalChange(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="100000"
                    className="w-full text-xs font-mono font-black text-right p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none text-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase rounded-lg shadow-sm"
              >
                + Set Alokasi Cadangan
              </button>
            </form>

            {/* List Cadangan Bulan Ini */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-(--text-secondary) uppercase tracking-wider block">
                Daftar Cadangan Bulan Ini:
              </span>
              {filteredAllocations.map((a) => {
                const liveNominal =
                  a.percentage > 0
                    ? Math.round(totalNetSalesMonth * (a.percentage / 100))
                    : a.nominal || 0;
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-2.5 bg-(--bg-card) rounded-xl border border-(--border-color) text-xs"
                  >
                    <div>
                      <div className="font-bold text-(--text-primary)">{a.name}</div>
                      <span className="text-[10px] text-orange-500 font-mono font-semibold">
                        {a.percentage > 0
                          ? `[${a.percentage}% dari Net Sales]`
                          : "[Nominal Tetap]"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-emerald-500 text-xs">
                        Rp {liveNominal.toLocaleString()}
                      </span>
                      <button
                        onClick={async () => {
                          await globalCommandBus.execute({
                            type: "ARCHIVE_EXECUTIVE_ALLOCATION",
                            payload: { id: a.id },
                          });
                          sysToast.success("Berhasil", "Alokasi dinonaktifkan.");
                        }}
                        className="text-(--text-secondary) hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredAllocations.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-xs italic">
                  Belum ada alokasi cadangan untuk bulan ini.
                </div>
              )}
            </div>

            {/* Total Cadangan Banner */}
            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl flex justify-between items-center text-xs font-bold">
              <div>
                <span className="text-[9px] font-black uppercase text-orange-500 block">
                  Total Cadangan:
                </span>
                <span className="text-[9px] text-(--text-secondary)">
                  {totalAllocPct.toFixed(1)}% dari Net Sales
                </span>
              </div>
              <span className="font-mono font-black text-sm text-orange-500">
                Rp {totalAllocNominal.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* TAB 2: REALISASI PENARIKAN OWNER & DEVIDEN                */
          /* ========================================================= */
          <div className="space-y-3">
            {/* Form Penarikan */}
            <form
              onSubmit={handleSaveWithdrawal}
              className="p-3 bg-(--surface-hover) rounded-xl border border-(--border-color) space-y-2.5"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={withdrawDate}
                    onChange={(e) => setWithdrawDate(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none text-(--text-primary)"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                    Kategori
                  </label>
                  <select
                    value={withdrawCategory}
                    onChange={(e) => setWithdrawCategory(e.target.value as any)}
                    className="w-full text-xs font-black p-2 bg-(--bg-input) text-orange-500 border border-(--border-color) rounded-lg outline-none"
                  >
                    <option value="PRIVE">PRIVE OWNER</option>
                    <option value="GAJI_HOLDING">GAJI HOLDING</option>
                    <option value="DEVIDEN_MITRA">DEVIDEN MITRA</option>
                    <option value="PROYEK">PROYEK / CABANG</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Nama Penerima
                </label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value.toUpperCase())}
                  placeholder="PAK HAJI / MITRA..."
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none text-(--text-primary)"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-orange-500 uppercase mb-0.5">
                    % Net Sales
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={withdrawPct}
                    onChange={(e) =>
                      handleWithdrawPctChange(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="e.g. 5%"
                    className="w-full text-xs font-mono font-black text-center p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none text-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-rose-500 uppercase mb-0.5">
                    Nominal Tarik (Rp)
                  </label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) =>
                      handleWithdrawAmountChange(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="0"
                    className="w-full text-xs font-mono font-black text-right p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none text-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Sumber Kas
                </label>
                <select
                  value={sourceFund}
                  onChange={(e) => setSourceFund(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
                >
                  <option value="TRANSFER_BANK">TRANSFER BANK UTAMA</option>
                  <option value="KAS_BESAR">KAS BESAR TOKO</option>
                  <option value="KASIR">LACI KASIR (PRIVE KASIR)</option>
                </select>
              </div>

              <div>
                <input
                  type="text"
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  placeholder="Catatan keperluan penarikan..."
                  className="w-full text-xs font-bold p-2 bg-(--bg-input) border border-(--border-color) rounded-lg outline-none placeholder:text-[10px]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase rounded-lg shadow-sm"
              >
                Simpan Penarikan Kas
              </button>
            </form>

            {/* List Riwayat Penarikan */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-(--text-secondary) uppercase tracking-wider block">
                Riwayat Penarikan Bulan Ini:
              </span>
              {filteredWithdrawals.map((doc) => {
                const liveAmount =
                  doc.percentage && doc.percentage > 0
                    ? Math.round(totalNetSalesMonth * (doc.percentage / 100))
                    : doc.amount || 0;
                return (
                  <div
                    key={doc.id}
                    className="p-2.5 bg-(--bg-card) border border-(--border-color) rounded-xl text-xs space-y-1"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-orange-500/10 text-orange-500 border border-orange-500/20">
                          {doc.category}
                        </span>
                        <div className="font-bold text-xs text-(--text-primary) mt-0.5">
                          {doc.recipientName}
                        </div>
                      </div>
                      <span className="font-mono text-[9px] text-(--text-secondary)">
                        {new Date(doc.date).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-(--border-color)">
                      <span className="font-mono text-xs font-black text-rose-500">
                        Rp {liveAmount.toLocaleString()}
                      </span>
                      <button
                        onClick={async () => {
                          await globalCommandBus.execute({
                            type: "ARCHIVE_OWNER_LEDGER",
                            payload: { id: doc.id },
                          });
                          sysToast.success("Berhasil", "Catatan penarikan diarsipkan.");
                        }}
                        className="text-(--text-secondary) hover:text-rose-500 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredWithdrawals.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-xs italic">
                  Belum ada catatan penarikan untuk bulan ini.
                </div>
              )}
            </div>

            {/* Total Penarikan Banner */}
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex justify-between items-center text-xs font-bold">
              <span className="text-[10px] font-black uppercase text-rose-500">
                Total Penarikan Bulan Ini:
              </span>
              <span className="font-mono font-black text-sm text-rose-500">
                Rp {totalWithdrawalPeriod.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
