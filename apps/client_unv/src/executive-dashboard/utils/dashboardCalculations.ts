// File: apps/client_unv/src/executive-dashboard/utils/dashboardCalculations.ts

export interface DashboardFilterState {
  month: string; // "YYYY-MM"
  companyId?: string;
  regionId: string;
  outletId: string;
  dateStart: string;
  dateEnd: string;
  showTaxService: boolean;
  devidenPosition: "TOP_NET_SALES" | "BOTTOM_OWNER";
}

export function calculateExecutiveFinancials(
  filters: DashboardFilterState,
  plusalesDocs: any[],
  receivingDocs: any[],
  warehouseDistributions: any[],
  spoilWastes: any[],
  executiveTargets: Record<string, any>,
  allocations: any[],
  ownerLedgers: any[],
  outlets: any[],
  itemCategories: any[],
  products: any[],
) {
  const activeCompanyId =
    filters.companyId ||
    (typeof window !== "undefined"
      ? localStorage.getItem("__unv_companyId")
      : "") ||
    "";
  // 1. REVENUE DARI PLUSALES
  const filteredSales = (plusalesDocs || []).filter((d) => {
    const matchCompany =
      !activeCompanyId ||
      d.companyId === activeCompanyId ||
      d.organization?.companyId === activeCompanyId;
    const matchMonth =
      !filters.month || (d.date && d.date.startsWith(filters.month));
    const matchOutlet = !filters.outletId || d.outletId === filters.outletId;
    const matchRegion = !filters.regionId || d.regionId === filters.regionId;
    const matchActive = d.isActive !== false;
    const matchDateStart = !filters.dateStart || d.date >= filters.dateStart;
    const matchDateEnd = !filters.dateEnd || d.date <= filters.dateEnd;
    return (
      matchCompany &&
      matchMonth &&
      matchOutlet &&
      matchRegion &&
      matchActive &&
      matchDateStart &&
      matchDateEnd
    );
  });

  const totalGrossSales = filteredSales.reduce(
    (sum, d) => sum + (d.grossSales || 0),
    0,
  );
  const totalDiscount = filteredSales.reduce(
    (sum, d) => sum + (d.discount || 0),
    0,
  );
  const totalNetSales = filteredSales.reduce(
    (sum, d) => sum + (d.netSales || 0),
    0,
  );
  const totalTax = filteredSales.reduce((sum, d) => sum + (d.tax || 0), 0);
  const totalService = filteredSales.reduce(
    (sum, d) => sum + (d.service || 0),
    0,
  );

  // 2. TARGET CONFIG (DITARIK DARI TARGET & KUOTA OUTLET)
  const targetKey = `${filters.outletId || outlets[0]?.id || "DEFAULT"}_${filters.month}`;
  const targetConfig = (executiveTargets || {})[targetKey] || {
    targetSales: 0,
    foodSalesTargetPct: 85,
    beverageSalesTargetPct: 15,
    cogsBudgetPct: 35,
    opexBudgetLimit: 0,
    payrollBudgetLimit: 0,
    bankFeePct: 0.7,
  };

  const foodSalesPct = Number(targetConfig.foodSalesTargetPct ?? 85) / 100;
  const beverageSalesPct =
    Number(targetConfig.beverageSalesTargetPct ?? 15) / 100;

  const foodSales = Math.round(totalNetSales * foodSalesPct);
  const beverageSales = Math.round(totalNetSales * beverageSalesPct);
  const chargeSales = Math.max(0, totalNetSales - foodSales - beverageSales);
  const nettBeforeDiscount = totalNetSales + totalDiscount;

  // 3. INISIALISASI KATEGORI PENDUKUNG DARI item_categories
  const dynamicPendukungMap: Record<
    string,
    { categoryName: string; amount: number; items: any[] }
  > = {};

  (itemCategories || []).forEach((cat) => {
    const catName = (cat.name || "").trim();
    const catUpper = catName.toUpperCase();
    const isCogs =
      catUpper.includes("FOOD") ||
      catUpper.includes("MAKANAN") ||
      catUpper.includes("BEVERAGE") ||
      catUpper.includes("MINUMAN");
    const isPrive = catUpper.includes("PRIVE") || catUpper.includes("OWNER");
    const isEdr =
      catUpper.includes("EDR") ||
      catUpper.includes("MAKAN KARYAWAN") ||
      catUpper.includes("EMPLOYEE");

    if (
      !isCogs &&
      !isPrive &&
      !isEdr &&
      cat.status !== "Arsip" &&
      cat.isActive !== false
    ) {
      dynamicPendukungMap[catName] = {
        categoryName: catName,
        amount: 0,
        items: [],
      };
    }
  });

  // 4. BELANJA RECEIVING
  const filteredReceiving = (receivingDocs || []).filter((d) => {
    const matchCompany =
      !activeCompanyId ||
      d.companyId === activeCompanyId ||
      d.organization?.companyId === activeCompanyId;
    const matchMonth =
      !filters.month || (d.date && d.date.startsWith(filters.month));
    const matchOutlet = !filters.outletId || d.outletId === filters.outletId;
    const matchRegion = !filters.regionId || d.regionId === filters.regionId;
    const matchActive = d.status !== "CANCELLED" && d.isActive !== false;
    const matchDateStart = !filters.dateStart || d.date >= filters.dateStart;
    const matchDateEnd = !filters.dateEnd || d.date <= filters.dateEnd;
    return (
      matchCompany &&
      matchMonth &&
      matchOutlet &&
      matchRegion &&
      matchActive &&
      matchDateStart &&
      matchDateEnd
    );
  });

  let foodCost = 0;
  let beverageCost = 0;
  let totalPriveKasirFromReceiving = 0;
  let totalEdrFromReceiving = 0;

  filteredReceiving.forEach((doc) => {
    (doc.items || []).forEach((item: any) => {
      const subtotal =
        Number(item.subtotal) ||
        Number(item.qty || 1) * Number(item.price || 0);
      const productObj = (products || []).find((p) => p.id === item.itemId);
      const categoryId = item.categoryId || productObj?.categoryId || "";
      const categoryObj = (itemCategories || []).find(
        (c) => c.id === categoryId,
      );
      const rawCatName = (
        categoryObj?.name ||
        item.categoryName ||
        (productObj?.isExpense ? "Biaya Operasional" : "FOOD")
      ).trim();
      const catUpper = rawCatName.toUpperCase();
      const nameUpper = (item.name || "").toUpperCase();

      if (
        catUpper.includes("PRIVE") ||
        nameUpper.includes("PRIVE") ||
        nameUpper.includes("PAK HAJI") ||
        nameUpper.includes("BU HAJI")
      ) {
        totalPriveKasirFromReceiving += subtotal;
        return;
      }
      if (
        catUpper.includes("EDR") ||
        catUpper.includes("MAKAN KARYAWAN") ||
        catUpper.includes("EMPLOYEE") ||
        nameUpper.includes("EDR")
      ) {
        totalEdrFromReceiving += subtotal;
        return;
      }
      if (
        catUpper.includes("BEVERAGE") ||
        catUpper.includes("MINUMAN") ||
        catUpper.includes("BAR") ||
        nameUpper.includes("MINUM") ||
        nameUpper.includes("SIRUP")
      ) {
        beverageCost += subtotal;
        return;
      }
      if (
        catUpper.includes("FOOD") ||
        catUpper.includes("MAKANAN") ||
        (!item.isExpense && !productObj?.isExpense)
      ) {
        foodCost += subtotal;
        return;
      }

      if (!dynamicPendukungMap[rawCatName]) {
        dynamicPendukungMap[rawCatName] = {
          categoryName: rawCatName,
          amount: 0,
          items: [],
        };
      }
      dynamicPendukungMap[rawCatName].amount += subtotal;
      dynamicPendukungMap[rawCatName].items.push({
        name: item.name || item.itemId,
        subtotal,
        invoiceNumber: doc.invoiceNumber,
        date: doc.date,
      });
    });
  });

  const totalEdrFromWarehouse = (warehouseDistributions || [])
    .filter((d) => {
      const matchCompany =
        !activeCompanyId ||
        d.companyId === activeCompanyId ||
        d.organization?.companyId === activeCompanyId;
      const matchMonth =
        !filters.month || (d.date && d.date.startsWith(filters.month));
      const matchOutlet = !filters.outletId || d.outletId === filters.outletId;
      const divUpper = (d.divisionName || "").toUpperCase();
      const isEdr =
        divUpper.includes("KARYAWAN") ||
        divUpper.includes("EDR") ||
        divUpper.includes("EMPLOYEE");
      return (
        matchCompany &&
        matchMonth &&
        matchOutlet &&
        isEdr &&
        d.isActive !== false
      );
    })
    .reduce((sum, d) => sum + (d.totalCost || 0), 0);

  const totalEmployeeMeals = totalEdrFromReceiving + totalEdrFromWarehouse;

  const filteredSpoilWaste = (spoilWastes || []).filter((sw) => {
    const matchCompany =
      !activeCompanyId ||
      sw.companyId === activeCompanyId ||
      sw.organization?.companyId === activeCompanyId;
    const matchMonth =
      !filters.month || (sw.date && sw.date.startsWith(filters.month));
    const matchOutlet = !filters.outletId || sw.outletId === filters.outletId;
    const matchActive = sw.isActive !== false;
    return matchCompany && matchMonth && matchOutlet && matchActive;
  });

  const totalSpoilLoss = filteredSpoilWaste.reduce(
    (sum, sw) => sum + (sw.totalLossCost || 0),
    0,
  );

  const totalBelanjaDapur = foodCost + beverageCost;
  const usageBelanjaDapur = totalBelanjaDapur + totalSpoilLoss;

  const totalBelanjaPendukung =
    Object.values(dynamicPendukungMap).reduce((sum, c) => sum + c.amount, 0) +
    totalEmployeeMeals;
  const usagePendukung = totalBelanjaPendukung;
  const totalUsageAll = usageBelanjaDapur + usagePendukung;

  // 5. BUDGETING & GAJI & BANK FEE DARI TARGET CONFIG
  const targetSales = Number(targetConfig.targetSales) || 0;
  const cogsBudgetLimit = Math.round(
    targetSales * (Number(targetConfig.cogsBudgetPct || 35) / 100),
  );
  const opexBudgetLimit = Number(targetConfig.opexBudgetLimit) || 0;

  const alokasiGaji = Math.round(totalNetSales * 0.15);
  const realisasiGaji = Number(targetConfig.payrollBudgetLimit) || 0;
  const savingGaji = alokasiGaji - realisasiGaji;

  const bankFeeRate = Number(targetConfig.bankFeePct ?? 0.7) / 100;
  const bankFee = Math.round(totalNetSales * bankFeeRate);

  // 6. OWNER & DEVIDEN
  const filteredOwnerLedgers = (ownerLedgers || []).filter((o) => {
    const matchCompany =
      !activeCompanyId ||
      o.companyId === activeCompanyId ||
      o.organization?.companyId === activeCompanyId;
    const matchMonth =
      !filters.month || (o.date && o.date.startsWith(filters.month));
    const matchOutlet =
      !filters.outletId || !o.outletId || o.outletId === filters.outletId;
    return matchCompany && matchMonth && matchOutlet && o.isActive !== false;
  });

  const devidenMitraDoc = filteredOwnerLedgers.find(
    (o) => o.category === "DEVIDEN_MITRA",
  );

  const devidenMitraTotal = filteredOwnerLedgers
    .filter((o) => o.category === "DEVIDEN_MITRA")
    .reduce(
      (sum, o) =>
        sum +
        (o.percentage > 0
          ? Math.round(totalNetSales * (o.percentage / 100))
          : o.amount),
      0,
    );

  const priveTotal =
    filteredOwnerLedgers
      .filter((o) => o.category === "PRIVE")
      .reduce(
        (sum, o) =>
          sum +
          (o.percentage > 0
            ? Math.round(totalNetSales * (o.percentage / 100))
            : o.amount),
        0,
      ) + totalPriveKasirFromReceiving;

  const gajiHoldingTotal = filteredOwnerLedgers
    .filter((o) => o.category === "GAJI_HOLDING")
    .reduce(
      (sum, o) =>
        sum +
        (o.percentage > 0
          ? Math.round(totalNetSales * (o.percentage / 100))
          : o.amount),
      0,
    );

  const proyekTotal = filteredOwnerLedgers
    .filter((o) => o.category === "PROYEK")
    .reduce(
      (sum, o) =>
        sum +
        (o.percentage > 0
          ? Math.round(totalNetSales * (o.percentage / 100))
          : o.amount),
      0,
    );

  const filteredAllocations = (allocations || []).filter(
    (a) => a.month === filters.month,
  );

  const alokasiUmroh =
    filteredAllocations
      .filter((a) => a.name.includes("UMROH"))
      .reduce(
        (sum, a) =>
          sum +
          (a.percentage > 0
            ? Math.round(totalNetSales * (a.percentage / 100))
            : a.nominal),
        0,
      ) || Math.round(totalNetSales * 0.02);

  const alokasiThr =
    filteredAllocations
      .filter((a) => a.name.includes("THR"))
      .reduce(
        (sum, a) =>
          sum +
          (a.percentage > 0
            ? Math.round(totalNetSales * (a.percentage / 100))
            : a.nominal),
        0,
      ) || Math.round(totalNetSales * 0.01);

  const complimentTotal = filteredSales.reduce((sum, d) => {
    const comp = (d.dynamicItems || []).filter((it: any) =>
      it.name?.includes("COMPLIMENT"),
    );
    return (
      sum + comp.reduce((s: number, c: any) => s + Math.abs(c.amount || 0), 0)
    );
  }, 0);

  // 7. KALKULASI LABA BERSIH (GOP & FINAL OWNER PROFIT)
  let grossOperatingProfit = 0;
  let totalOwnerExpenses = 0;

  if (filters.devidenPosition === "TOP_NET_SALES") {
    const netAfterSharing = totalNetSales - devidenMitraTotal;
    grossOperatingProfit =
      netAfterSharing - totalUsageAll - realisasiGaji - bankFee;
    totalOwnerExpenses =
      priveTotal +
      gajiHoldingTotal +
      proyekTotal +
      complimentTotal +
      alokasiUmroh +
      alokasiThr;
  } else {
    grossOperatingProfit =
      totalNetSales - totalUsageAll - realisasiGaji - bankFee;
    totalOwnerExpenses =
      priveTotal +
      gajiHoldingTotal +
      devidenMitraTotal +
      proyekTotal +
      complimentTotal +
      alokasiUmroh +
      alokasiThr;
  }

  const finalProfitOwner = grossOperatingProfit - totalOwnerExpenses;
  const isNomplok = finalProfitOwner < 0;

  // 8. PERFORMA OUTLET
  const outletPerformance = (outlets || [])
    .filter((out) => !activeCompanyId || out.companyId === activeCompanyId)
    .map((out) => {
      const salesOfOutlet = (plusalesDocs || [])
        .filter(
          (d) =>
            d.outletId === out.id &&
            d.date &&
            d.date.startsWith(filters.month) &&
            d.isActive !== false,
        )
        .reduce((sum, d) => sum + (d.netSales || 0), 0);
      return {
        outletId: out.id,
        outletName: out.name,
        netSales: salesOfOutlet,
      };
    })
    .sort((a, b) => b.netSales - a.netSales);

  const totalRestoExpenses = totalUsageAll + realisasiGaji + bankFee;

  return {
    revenue: {
      foodSales,
      beverageSales,
      chargeSales,
      nettBeforeDiscount,
      discount: totalDiscount,
      netSales: totalNetSales,
      tax: totalTax,
      service: totalService,
      grossSales: totalGrossSales,
    },
    salesSharing: {
      recipientName: devidenMitraDoc?.recipientName || "Mitra Kerja Sama",
      amount: devidenMitraTotal,
      percentage:
        totalNetSales > 0
          ? parseFloat(((devidenMitraTotal / totalNetSales) * 100).toFixed(1))
          : 0,
      position: filters.devidenPosition,
    },
    cogs: {
      foodCost,
      beverageCost,
      totalBelanjaDapur,
      spoilLoss: totalSpoilLoss,
      usageBelanjaDapur,
    },
    pendukung: {
      categories: dynamicPendukungMap,
      employeeMeals: totalEmployeeMeals,
      totalBelanjaPendukung,
      usagePendukung,
    },
    summaryUsage: {
      totalUsageAll,
      totalRestoExpenses,
    },
    expenses: {
      totalRestoExpenses,
      totalCogs: usageBelanjaDapur,
      restoOpex: usagePendukung,
      payroll: realisasiGaji,
    },
    payroll: {
      alokasiGaji,
      realisasiGaji,
      savingGaji,
      bankFee,
      bankFeePct: Number(targetConfig.bankFeePct ?? 0.7),
    },
    gop: {
      grossOperatingProfit,
      gopPercentage:
        totalNetSales > 0
          ? parseFloat(
              ((grossOperatingProfit / totalNetSales) * 100).toFixed(2),
            )
          : 0,
    },
    ownerExpenses: {
      prive: priveTotal,
      gajiHolding: gajiHoldingTotal,
      savingPengembangan: proyekTotal,
      compliment: complimentTotal,
      alokasiUmroh,
      alokasiThr,
      devidenMitra:
        filters.devidenPosition === "BOTTOM_OWNER" ? devidenMitraTotal : 0,
      totalOwnerExpenses,
    },
    finalProfit: {
      finalProfitOwner,
      finalProfitPercentage:
        totalNetSales > 0
          ? parseFloat(((finalProfitOwner / totalNetSales) * 100).toFixed(2))
          : 0,
      isNomplok,
    },
    profitability: {
      restoNetProfit: grossOperatingProfit,
      finalRetainedCash: finalProfitOwner,
      isNomplok,
    },
    budgeting: {
      targetSales,
      salesAchievedPct:
        targetSales > 0
          ? Math.min(
              100,
              parseFloat(((totalNetSales / targetSales) * 100).toFixed(1)),
            )
          : 0,
      cogsLimit: cogsBudgetLimit,
      cogsUsedPct:
        cogsBudgetLimit > 0
          ? parseFloat(((usageBelanjaDapur / cogsBudgetLimit) * 100).toFixed(1))
          : 0,
      cogsRemaining: cogsBudgetLimit - usageBelanjaDapur,
      opexLimit: opexBudgetLimit,
      opexUsedPct:
        opexBudgetLimit > 0
          ? parseFloat(((usagePendukung / opexBudgetLimit) * 100).toFixed(1))
          : 0,
      opexRemaining: opexBudgetLimit - usagePendukung,
    },
    outletPerformance,
  };
}
