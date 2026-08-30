// File: modules/mdl_executivepanel/src/client/OwnerLedgerPage.tsx
import React, { useState, useMemo } from "react";
import {
  Wallet,
  Trash2,
  Calendar,
  Building2,
  Coins,
  Receipt,
  Percent,
} from "lucide-react";
import { useExecutivePanelStore } from "./store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { usePlusalesStore } from "../../../mdl_plusales/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";

export function OwnerLedgerPage() {
  const { allocations, ownerLedgers } = useExecutivePanelStore();
  const { outlets } = useOrgStore();
  const { documents: plusalesDocs } = usePlusalesStore();

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedOutletId, setSelectedOutletId] = useState<string>(
    outlets[0]?.id || "",
  );

  // =========================================================================
  // HITUNG TOTAL NET SALES BULAN TERPILIH (BASIS REAL-TIME PERSENTASE)
  // =========================================================================
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

  // =========================================================================
  // 1. PANEL KIRI: FORM ALOKASI CADANGAN OPSIONAL
  // =========================================================================
  const [allocName, setAllocName] = useState("");
  const [allocPct, setAllocPct] = useState<number | "">("");
  const [allocNominal, setAllocNominal] = useState<number | "">("");

  // Input % -> Hitung Nominal (Jika ada revenue)
  const handleAllocPctChange = (pctVal: number | "") => {
    setAllocPct(pctVal);
    if (pctVal === "" || Number(pctVal) <= 0) {
      setAllocNominal("");
    } else if (totalNetSalesMonth > 0) {
      setAllocNominal(Math.round(totalNetSalesMonth * (Number(pctVal) / 100)));
    }
  };

  // Input Nominal -> Hitung %
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

  // =========================================================================
  // 2. PANEL KANAN: FORM PENARIKAN OWNER / DEVIDEN / GAJI HOLDING
  // =========================================================================
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
      return sysToast.error("Error", "Nama penerima penarikan wajib diisi!");
    }

    const hasPct = withdrawPct !== "" && Number(withdrawPct) > 0;
    const hasAmt = withdrawAmount !== "" && Number(withdrawAmount) > 0;

    if (!hasPct && !hasAmt) {
      return sysToast.error(
        "Error",
        "Isi persentase (%) atau nominal penarikan (Rp)!",
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
        `${withdrawCategory} berhasil dicatat untuk ${recipientName}.`,
      );
      setWithdrawAmount("");
      setWithdrawPct("");
      setWithdrawNotes("");
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  // =========================================================================
  // DAFTAR ALOKASI (REAL-TIME REAKTIF TERHADAP NET SALES)
  // =========================================================================
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

  // =========================================================================
  // DAFTAR PENARIKAN (REAL-TIME REAKTIF TERHADAP NET SALES)
  // =========================================================================
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
      {/* TOOLBAR ATAS: FILTER BULAN, OUTLET & LIVE NET SALES */}
      <div className="p-4 bg-(--surface-hover) border-b border-(--border-color) flex items-center justify-between shrink-0 shadow-xs flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Wallet className="w-5 h-5 text-orange-500" />
          <h2 className="text-sm font-black uppercase tracking-wider text-(--text-primary)">
            Buku Kas Pemilik &amp; Deviden Investor
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* PEMILIH OUTLET */}
          <div className="flex items-center gap-2 bg-(--bg-input) border border-(--border-color) rounded-xl px-3 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-orange-500" />
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="bg-transparent text-xs font-bold text-(--text-primary) outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-white">
                -- SEMUA OUTLET (HOLDING) --
              </option>
              {outlets.map((o) => (
                <option
                  key={o.id}
                  value={o.id}
                  className="bg-slate-900 text-white"
                >
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          {/* PEMILIH BULAN */}
          <div className="flex items-center gap-2 bg-(--bg-input) border border-(--border-color) rounded-xl px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-orange-500" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-(--text-primary) outline-none font-mono cursor-pointer"
            />
          </div>

          {/* LIVE NET SALES BADGE */}
          <div className="px-3.5 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-xl text-xs font-bold text-orange-500 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" />
            <span>Net Sales:</span>
            <span className="font-mono font-black">
              Rp {totalNetSalesMonth.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 2 PANEL KONTEN UTAMA */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 overflow-hidden">
        {/* ========================================================================= */}
        {/* PANEL KIRI: 1. ALOKASI CADANGAN OPSIONAL OWNER (5 COLS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 bg-(--bg-card) p-4 rounded-2xl border border-(--border-color) shadow-xs flex flex-col justify-between overflow-hidden">
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <div className="border-b border-(--border-color) pb-2 flex items-center justify-between shrink-0">
              <span className="font-black text-xs uppercase tracking-wider text-orange-500 flex items-center gap-1.5">
                <Coins className="w-4 h-4" /> 1. ALOKASI CADANGAN OPSIONAL
              </span>
              <span className="text-[9px] bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded font-black uppercase">
                Kebijakan Laba
              </span>
            </div>

            {/* FORM ALOKASI */}
            <form
              onSubmit={handleSaveAllocation}
              className="p-3 bg-(--bg-input)/50 rounded-xl border border-(--border-color) space-y-2 shrink-0"
            >
              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Nama Alokasi Cadangan
                </label>
                <input
                  type="text"
                  required
                  value={allocName}
                  onChange={(e) => setAllocName(e.target.value.toUpperCase())}
                  placeholder="e.g. ALOKASI UMROH / KURBAN / DANA DARURAT..."
                  className="w-full text-xs font-bold p-1.5 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-(--text-primary)"
                />
              </div>

              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
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
                    className="w-full text-xs font-mono font-black text-center p-1.5 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-orange-500"
                  />
                </div>

                <div className="col-span-6">
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
                    className="w-full text-xs font-mono font-black text-right p-1.5 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-emerald-500"
                  />
                </div>

                <div className="col-span-2">
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-lg transition shadow-md cursor-pointer"
                  >
                    + SET
                  </button>
                </div>
              </div>
            </form>

            {/* DAFTAR ALOKASI REAKTIF */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
              <span className="text-[9px] font-black text-(--text-secondary) uppercase block mb-1">
                DAFTAR ALOKASI CADANGAN BULAN INI:
              </span>
              {filteredAllocations.map((a) => {
                const liveNominal =
                  a.percentage > 0
                    ? Math.round(totalNetSalesMonth * (a.percentage / 100))
                    : a.nominal || 0;

                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-2 bg-(--bg-input) rounded-lg text-xs font-bold border border-(--border-color)"
                  >
                    <div>
                      <div className="text-(--text-primary) font-black">
                        {a.name}
                      </div>
                      <div className="text-[10px] text-orange-500 font-mono">
                        {a.percentage > 0
                          ? `[${a.percentage}% dari Net Sales]`
                          : "[Nominal Tetap]"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-emerald-500 font-black">
                        Rp {liveNominal.toLocaleString()}
                      </span>
                      <button
                        onClick={async () => {
                          await globalCommandBus.execute({
                            type: "ARCHIVE_EXECUTIVE_ALLOCATION",
                            payload: { id: a.id },
                          });
                          sysToast.success(
                            "Dihapus",
                            `Alokasi ${a.name} dinonaktifkan.`,
                          );
                        }}
                        className="text-(--text-secondary) hover:text-rose-500 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredAllocations.length === 0 && (
                <div className="text-center py-4 text-[11px] text-(--text-secondary) italic">
                  Belum ada alokasi cadangan untuk bulan ini.
                </div>
              )}
            </div>
          </div>

          {/* FOOTER TOTAL ALOKASI */}
          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl flex justify-between items-center text-xs font-bold shrink-0 mt-3">
            <div>
              <span className="text-[9px] font-black uppercase text-orange-500 block">
                TOTAL CADANGAN:
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

        {/* ========================================================================= */}
        {/* PANEL KANAN: 2. REALISASI PENARIKAN & DEVIDEN (7 COLS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 bg-(--bg-card) p-4 rounded-2xl border border-(--border-color) shadow-xs flex flex-col justify-between overflow-hidden">
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
            <div className="border-b border-(--border-color) pb-2 flex items-center justify-between shrink-0">
              <span className="font-black text-xs uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                <Wallet className="w-4 h-4" /> 2. REALISASI PENARIKAN OWNER
                &amp; DEVIDEN
              </span>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-black uppercase">
                Arus Kas Keluar
              </span>
            </div>

            {/* FORM PENARIKAN (BISA INPUT % ATAU NOMINAL SECARA FLEKSIBEL) */}
            <form
              onSubmit={handleSaveWithdrawal}
              className="p-3 bg-(--bg-input)/50 rounded-xl border border-(--border-color) space-y-2.5 shrink-0"
            >
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                    Tanggal Penarikan
                  </label>
                  <input
                    type="date"
                    required
                    value={withdrawDate}
                    onChange={(e) => setWithdrawDate(e.target.value)}
                    className="w-full text-xs font-bold p-1.5 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-(--text-primary)"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                    Kategori Arus
                  </label>
                  <select
                    value={withdrawCategory}
                    onChange={(e) => setWithdrawCategory(e.target.value as any)}
                    className="w-full text-xs font-black p-1.5 bg-(--bg-card) text-orange-500 border border-(--border-color) rounded-lg outline-none cursor-pointer"
                  >
                    <option value="PRIVE" className="bg-slate-900 text-white">
                      💼 PRIVE OWNER
                    </option>
                    <option
                      value="GAJI_HOLDING"
                      className="bg-slate-900 text-white"
                    >
                      🏢 GAJI HOLDING
                    </option>
                    <option
                      value="DEVIDEN_MITRA"
                      className="bg-slate-900 text-white"
                    >
                      🤝 DEVIDEN MITRA
                    </option>
                    <option value="PROYEK" className="bg-slate-900 text-white">
                      🏗️ PROYEK / CABANG
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                    Sumber Dana
                  </label>
                  <select
                    value={sourceFund}
                    onChange={(e) => setSourceFund(e.target.value)}
                    className="w-full text-xs font-bold p-1.5 bg-(--bg-card) text-(--text-primary) border border-(--border-color) rounded-lg outline-none cursor-pointer"
                  >
                    <option
                      value="TRANSFER_BANK"
                      className="bg-slate-900 text-white"
                    >
                      TRANSFER BANK UTAMA
                    </option>
                    <option
                      value="KAS_BESAR"
                      className="bg-slate-900 text-white"
                    >
                      KAS BESAR TOKO
                    </option>
                    <option value="KASIR" className="bg-slate-900 text-white">
                      LACI KASIR (PRIVE KASIR)
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                    Nama Penerima / Pemilik
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) =>
                      setRecipientName(e.target.value.toUpperCase())
                    }
                    placeholder="PAK HAJI / MITRA INVESTOR..."
                    className="w-full text-xs font-bold p-1.5 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-(--text-primary)"
                  />
                </div>

                <div className="col-span-3">
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
                    className="w-full text-xs font-mono font-black text-center p-1.5 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-orange-500"
                  />
                </div>

                <div className="col-span-4">
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
                    className="w-full text-xs font-mono font-black text-right p-1.5 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-rose-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  placeholder="Catatan / keterangan keperluan..."
                  className="flex-1 text-xs font-bold p-1.5 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none placeholder:text-[10px]"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-lg transition shadow-md cursor-pointer shrink-0"
                >
                  SIMPAN PENARIKAN
                </button>
              </div>
            </form>

            {/* TABEL DAFTAR PENARIKAN (REAL-TIME REAKTIF) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar border border-(--border-color) rounded-xl overflow-hidden min-h-24">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-(--surface-hover) border-b border-(--border-color) text-[9px] uppercase font-black text-(--text-secondary)">
                    <th className="p-2">Tgl</th>
                    <th className="p-2 text-center">Kategori</th>
                    <th className="p-2">Penerima</th>
                    <th className="p-2 text-right">Nominal Realisasi</th>
                    <th className="p-2 text-right w-10">X</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border-color)">
                  {filteredWithdrawals.map((doc) => {
                    const liveAmount =
                      doc.percentage && doc.percentage > 0
                        ? Math.round(
                            totalNetSalesMonth * (doc.percentage / 100),
                          )
                        : doc.amount || 0;

                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-(--surface-hover) transition"
                      >
                        <td className="p-2 font-mono text-[11px]">
                          {new Date(doc.date).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </td>
                        <td className="p-2 text-center">
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-orange-500/10 text-orange-500 border border-orange-500/20">
                            {doc.category}
                          </span>
                        </td>
                        <td className="p-2 font-bold text-(--text-primary)">
                          {doc.recipientName}
                          {doc.percentage > 0 && (
                            <span className="text-[9px] font-mono text-orange-500 block font-normal">
                              [{doc.percentage}% dari Net Sales]
                            </span>
                          )}
                          {doc.notes && (
                            <span className="text-[9px] text-(--text-secondary) block font-normal italic">
                              "{doc.notes}"
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-right font-mono font-black text-rose-500">
                          Rp {liveAmount.toLocaleString()}
                        </td>
                        <td className="p-2 text-right">
                          <button
                            onClick={async () => {
                              await globalCommandBus.execute({
                                type: "ARCHIVE_OWNER_LEDGER",
                                payload: { id: doc.id },
                              });
                              sysToast.success(
                                "Dihapus",
                                "Catatan penarikan diarsipkan.",
                              );
                            }}
                            className="text-(--text-secondary) hover:text-rose-500 p-0.5 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredWithdrawals.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-4 text-center text-(--text-secondary) italic text-[11px]"
                      >
                        Belum ada riwayat penarikan owner / deviden bulan ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* FOOTER TOTAL REALISASI PENARIKAN */}
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex justify-between items-center text-xs font-bold shrink-0 mt-3">
            <div>
              <span className="text-[9px] font-black uppercase text-rose-500 block">
                TOTAL REALISASI PENARIKAN:
              </span>
              <span className="text-[9px] text-(--text-secondary)">
                {filteredWithdrawals.length} Transaksi Tercatat
              </span>
            </div>
            <span className="font-mono font-black text-sm text-rose-500">
              Rp {totalWithdrawalPeriod.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
