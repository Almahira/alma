// File: modules/mdl_executivepanel/src/client/TargetConfigPageSM.tsx
import React, { useState, useEffect } from "react";
import {
  Target,
  Building2,
  Calendar,
  CheckCircle2,
  Utensils,
  CreditCard,
} from "lucide-react";
import { useExecutivePanelStore } from "./store";
import { useOrgStore } from "../../../mdl_organization/src/client/store";
import { globalCommandBus } from "../../../../packages/core_unv/src/cqrs/CommandBus";
import { sysToast } from "../../../../apps/client_unv/src/shared-ui/useToastStore";

export function TargetConfigPageSM() {
  const { targets } = useExecutivePanelStore();
  const { outlets } = useOrgStore();
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedOutletId, setSelectedOutletId] = useState<string>(
    outlets[0]?.id || "",
  );

  const activeTargetKey = `${selectedOutletId}_${selectedMonth}`;
  const existingConfig = targets[activeTargetKey];

  const [targetSales, setTargetSales] = useState<number | "">(
    existingConfig?.targetSales || 500000000,
  );
  const [foodSalesTargetPct, setFoodSalesTargetPct] = useState<number>(
    existingConfig?.foodSalesTargetPct ?? 85,
  );
  const [beverageSalesTargetPct, setBeverageSalesTargetPct] = useState<number>(
    existingConfig?.beverageSalesTargetPct ?? 15,
  );
  const [cogsBudgetPct, setCogsBudgetPct] = useState<number>(
    existingConfig?.cogsBudgetPct ?? 35,
  );
  const [opexBudgetLimit, setOpexBudgetLimit] = useState<number | "">(
    existingConfig?.opexBudgetLimit ?? 50000000,
  );
  const [payrollBudgetLimit, setPayrollBudgetLimit] = useState<number | "">(
    existingConfig?.payrollBudgetLimit ?? 100000000,
  );
  const [bankFeePct, setBankFeePct] = useState<number>(
    existingConfig?.bankFeePct ?? 0.7,
  );

  useEffect(() => {
    const cfg = targets[activeTargetKey];
    if (cfg) {
      setTargetSales(cfg.targetSales);
      setFoodSalesTargetPct(cfg.foodSalesTargetPct ?? 85);
      setBeverageSalesTargetPct(cfg.beverageSalesTargetPct ?? 15);
      setCogsBudgetPct(cfg.cogsBudgetPct ?? 35);
      setOpexBudgetLimit(cfg.opexBudgetLimit);
      setPayrollBudgetLimit(cfg.payrollBudgetLimit);
      setBankFeePct(cfg.bankFeePct ?? 0.7);
    } else {
      setTargetSales(500000000);
      setFoodSalesTargetPct(85);
      setBeverageSalesTargetPct(15);
      setCogsBudgetPct(35);
      setOpexBudgetLimit(50000000);
      setPayrollBudgetLimit(100000000);
      setBankFeePct(0.7);
    }
  }, [activeTargetKey, targets]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutletId)
      return sysToast.error("Error", "Pilih outlet terlebih dahulu!");
    const companyId = localStorage.getItem("__unv_companyId") || "";
    try {
      await globalCommandBus.execute({
        type: "SET_EXECUTIVE_TARGET",
        payload: {
          companyId,
          outletId: selectedOutletId,
          month: selectedMonth,
          targetSales: Number(targetSales) || 0,
          foodSalesTargetPct: Number(foodSalesTargetPct) || 85,
          beverageSalesTargetPct: Number(beverageSalesTargetPct) || 15,
          cogsBudgetPct: Number(cogsBudgetPct) || 35,
          opexBudgetLimit: Number(opexBudgetLimit) || 0,
          payrollBudgetLimit: Number(payrollBudgetLimit) || 0,
          bankFeePct: Number(bankFeePct) || 0.7,
        },
      });
      sysToast.success(
        "Target Disimpan",
        `Target & Kuota bulan ${selectedMonth} berhasil dikonfigurasi.`,
      );
    } catch (err: any) {
      sysToast.error("Gagal", err.message);
    }
  };

  const estimatedCogsNominal = Math.round(
    (Number(targetSales) || 0) * (cogsBudgetPct / 100),
  );

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-(--bg-card)">
      {/* HEADER */}
      <div className="p-3 bg-(--bg-card) border-b border-(--border-color) shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-orange-500" />
          <div>
            <h2 className="text-sm font-black text-(--text-primary) uppercase tracking-wide">
              Target &amp; Kuota Biaya
            </h2>
            <p className="text-[10px] text-(--text-secondary) font-bold">
              Baseline Rencana vs Realita
            </p>
          </div>
        </div>
      </div>

      {/* FORM BODY */}
      <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {/* Outlet & Bulan */}
          <div className="grid grid-cols-2 gap-2 bg-(--surface-hover) p-3 rounded-xl border border-(--border-color)">
            <div>
              <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                Pilih Outlet
              </label>
              <select
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none"
              >
                {outlets
                  .filter((o) => o.status === "Aktif")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                Bulan Target
              </label>
              <input
                type="month"
                required
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full text-xs font-bold p-2 bg-(--bg-input) text-(--text-primary) border border-(--border-color) rounded-lg outline-none font-mono"
              />
            </div>
          </div>

          {/* 1. Target Net Sales */}
          <div className="p-3 bg-orange-500/5 rounded-xl border border-orange-500/20 space-y-2.5">
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-wide block">
              1. TARGET NET SALES &amp; OMSET
            </span>

            <div>
              <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                Target Omset Murni (Rp)
              </label>
              <input
                type="number"
                required
                value={targetSales}
                onChange={(e) =>
                  setTargetSales(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                placeholder="500000000"
                className="w-full text-base font-black p-2.5 bg-(--bg-card) border border-(--border-color) rounded-xl outline-none font-mono text-orange-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Food Sales (%)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="any"
                    min={0}
                    max={100}
                    value={foodSalesTargetPct}
                    onChange={(e) => setFoodSalesTargetPct(Number(e.target.value))}
                    className="w-full text-xs font-mono font-black p-2 bg-(--bg-card) border border-(--border-color) rounded-lg text-center text-(--text-primary)"
                  />
                  <span className="text-xs font-bold text-(--text-secondary)">%</span>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                  Beverage Sales (%)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="any"
                    min={0}
                    max={100}
                    value={beverageSalesTargetPct}
                    onChange={(e) =>
                      setBeverageSalesTargetPct(Number(e.target.value))
                    }
                    className="w-full text-xs font-mono font-black p-2 bg-(--bg-card) border border-(--border-color) rounded-lg text-center text-(--text-primary)"
                  />
                  <span className="text-xs font-bold text-(--text-secondary)">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Jatah & Kuota Biaya */}
          <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20 space-y-2.5">
            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide block">
              2. JATAH &amp; KUOTA PENGELUARAN (BUDGET LIMIT)
            </span>

            <div>
              <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                Jatah Belanja Bahan / CoGS (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={cogsBudgetPct}
                  onChange={(e) => setCogsBudgetPct(Number(e.target.value))}
                  className="w-20 text-xs font-mono font-black p-2 bg-(--bg-card) border border-(--border-color) rounded-lg text-center text-(--text-primary)"
                />
                <span className="text-xs font-mono text-emerald-500 font-bold">
                  ≈ Rp {estimatedCogsNominal.toLocaleString()}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                Kuota Operasional &amp; Utilitas (OPEX) (Rp)
              </label>
              <input
                type="number"
                value={opexBudgetLimit}
                onChange={(e) =>
                  setOpexBudgetLimit(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                placeholder="50000000"
                className="w-full text-xs font-mono font-black p-2 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-(--text-primary)"
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                Kuota Gaji Karyawan &amp; THR (Rp)
              </label>
              <input
                type="number"
                value={payrollBudgetLimit}
                onChange={(e) =>
                  setPayrollBudgetLimit(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                placeholder="100000000"
                className="w-full text-xs font-mono font-black p-2 bg-(--bg-card) border border-(--border-color) rounded-lg outline-none text-(--text-primary)"
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-(--text-secondary) uppercase mb-0.5">
                Biaya MDR / EDC Bank Fee (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={bankFeePct}
                  onChange={(e) => setBankFeePct(Number(e.target.value))}
                  className="w-20 text-xs font-mono font-black p-2 bg-(--bg-card) border border-(--border-color) rounded-lg text-center text-(--text-primary)"
                />
                <span className="text-xs font-bold text-(--text-secondary)">% dari Net Sales</span>
              </div>
            </div>
          </div>
        </div>

        {/* STICKY SUBMIT FOOTER */}
        <div className="p-3 bg-(--surface-hover) border-t border-(--border-color) shrink-0">
          <button
            type="submit"
            className="w-full py-3 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Simpan Target &amp; Kuota
          </button>
        </div>
      </form>
    </div>
  );
}
