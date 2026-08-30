// File: apps/server_unv/src/routes/executiveDashboard.ts
import express, { Router, Request, Response } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../config/db.js";

// Skema Database
import {
  plusalesDocuments,
  plusalesDynamicItems,
} from "../../../../modules/mdl_plusales/src/server/schema.js";
import {
  receivingDocuments,
  receivingItems,
  receivingPayments,
} from "../../../../modules/mdl_receiving/src/server/schema.js";
import {
  warehouseDistributions,
  warehouseSpoilWastes,
} from "../../../../modules/mdl_warehouse/src/server/schema.js";
import {
  executiveTargets,
  executiveAllocations,
  executiveOwnerLedger,
} from "../../../../modules/mdl_executivepanel/src/server/schema.js";
import {
  outlets,
  regions,
  companies,
} from "../../../../modules/mdl_organization/src/server/schema.js";
import {
  itemCategories,
  itemProducts,
} from "../../../../modules/mdl_item/src/server/schema.js";
import { vendors } from "../../../../modules/mdl_vendor/src/server/schema.js";

const router = express.Router();

// =========================================================================
// GET /api/executive/financials - KONSOLIDASI FINANSIAL AIR TERJUN P&L
// =========================================================================
router.get("/financials", async (req: Request, res: Response) => {
  try {
    const month =
      (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const regionId = (req.query.regionId as string) || "";
    const outletId = (req.query.outletId as string) || "";
    const devidenPosition =
      (req.query.devidenPosition as string) || "TOP_NET_SALES";
    const showTaxService = req.query.showTaxService === "true";

    // 1. QUERY MASTER DATA (OUTLETS, CATEGORIES, PRODUCTS)
    const [allOutlets, allRegions, allCategories, allProducts] =
      await Promise.all([
        db.select().from(outlets).where(eq(outlets.isActive, true)),
        db.select().from(regions).where(eq(regions.isActive, true)),
        db
          .select()
          .from(itemCategories)
          .where(eq(itemCategories.isActive, true)),
        db.select().from(itemProducts).where(eq(itemProducts.isActive, true)),
      ]);

    // 2. QUERY TRANSAKSI PENJUALAN (PLUSALES) DARI POSTGRESQL
    const salesConditions = [
      eq(plusalesDocuments.isActive, true),
      sql`TO_CHAR(${plusalesDocuments.date}, 'YYYY-MM') = ${month}`,
    ];
    if (outletId)
      salesConditions.push(eq(plusalesDocuments.outletId, outletId));
    if (regionId)
      salesConditions.push(eq(plusalesDocuments.regionId, regionId));

    const salesDocs = await db
      .select()
      .from(plusalesDocuments)
      .where(and(...salesConditions));

    const salesIds = salesDocs.map((s) => s.id);
    let dynamicItems: any[] = [];
    if (salesIds.length > 0) {
      dynamicItems = await db
        .select()
        .from(plusalesDynamicItems)
        .where(sql`${plusalesDynamicItems.documentId} IN ${salesIds}`);
    }

    const totalGrossSales = salesDocs.reduce(
      (sum, d) => sum + (d.grossSales || 0),
      0,
    );
    const totalDiscount = salesDocs.reduce(
      (sum, d) => sum + (d.discount || 0),
      0,
    );
    const totalNetSales = salesDocs.reduce(
      (sum, d) => sum + (d.netSales || 0),
      0,
    );
    const totalTax = salesDocs.reduce((sum, d) => sum + (d.tax || 0), 0);
    const totalService = salesDocs.reduce(
      (sum, d) => sum + (d.service || 0),
      0,
    );

    // 3. QUERY EXECUTIVE TARGETS & ALLOCATIONS TERLEBIH DAHULU
    const targetConditions = [
      eq(executiveTargets.isActive, true),
      eq(executiveTargets.month, month),
    ];
    if (outletId)
      targetConditions.push(eq(executiveTargets.outletId, outletId));

    const targetsList = await db
      .select()
      .from(executiveTargets)
      .where(and(...targetConditions));

    const targetConfig = targetsList[0] || {
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

    // 4. QUERY RECEIVING / BELANJA
    const rcvConditions = [
      eq(receivingDocuments.isActive, true),
      sql`${receivingDocuments.status} != 'CANCELLED'`,
      sql`TO_CHAR(${receivingDocuments.date}, 'YYYY-MM') = ${month}`,
    ];
    if (outletId) rcvConditions.push(eq(receivingDocuments.outletId, outletId));
    if (regionId) rcvConditions.push(eq(receivingDocuments.regionId, regionId));

    const rcvDocs = await db
      .select()
      .from(receivingDocuments)
      .where(and(...rcvConditions));

    const rcvIds = rcvDocs.map((r) => r.id);
    let rcvItemsList: any[] = [];
    if (rcvIds.length > 0) {
      rcvItemsList = await db
        .select()
        .from(receivingItems)
        .where(sql`${receivingItems.documentId} IN ${rcvIds}`);
    }

    const dynamicPendukungMap: Record<
      string,
      { categoryName: string; amount: number; items: any[] }
    > = {};

    allCategories.forEach((cat) => {
      const catUpper = (cat.name || "").toUpperCase().trim();
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

      if (!isCogs && !isPrive && !isEdr) {
        dynamicPendukungMap[cat.name] = {
          categoryName: cat.name,
          amount: 0,
          items: [],
        };
      }
    });

    let foodCost = 0;
    let beverageCost = 0;
    let totalPriveKasirFromReceiving = 0;
    let totalEdrFromReceiving = 0;

    rcvItemsList.forEach((item) => {
      const subtotal =
        Number(item.subtotal) ||
        Number(item.qty || 1) * Number(item.price || 0);
      const productObj = allProducts.find((p) => p.id === item.itemId);
      const categoryId = productObj?.categoryId || "";
      const categoryObj = allCategories.find((c) => c.id === categoryId);
      const rawCatName = (
        categoryObj?.name ||
        (productObj?.isExpense ? "Biaya Operasional" : "FOOD")
      ).trim();
      const catUpper = rawCatName.toUpperCase();
      const nameUpper = (productObj?.name || "").toUpperCase();

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
        name: productObj?.name || item.itemId,
        subtotal,
      });
    });

    // 5. QUERY WAREHOUSE DISTRIBUTIONS & SPOIL/WASTE
    const distConditions = [
      eq(warehouseDistributions.isActive, true),
      sql`TO_CHAR(${warehouseDistributions.date}, 'YYYY-MM') = ${month}`,
    ];
    if (outletId)
      distConditions.push(eq(warehouseDistributions.outletId, outletId));

    const distributionsList = await db
      .select()
      .from(warehouseDistributions)
      .where(and(...distConditions));

    const totalEdrFromWarehouse = distributionsList
      .filter((d) => {
        const divUpper = (d.divisionName || "").toUpperCase();
        return (
          divUpper.includes("KARYAWAN") ||
          divUpper.includes("EDR") ||
          divUpper.includes("EMPLOYEE")
        );
      })
      .reduce((sum, d) => sum + Number(d.totalCost || 0), 0);

    const totalEmployeeMeals = totalEdrFromReceiving + totalEdrFromWarehouse;

    const spoilConditions = [
      eq(warehouseSpoilWastes.isActive, true),
      sql`TO_CHAR(${warehouseSpoilWastes.date}, 'YYYY-MM') = ${month}`,
    ];
    if (outletId)
      spoilConditions.push(eq(warehouseSpoilWastes.outletId, outletId));

    const spoilList = await db
      .select()
      .from(warehouseSpoilWastes)
      .where(and(...spoilConditions));

    const totalSpoilLoss = spoilList.reduce(
      (sum, sw) => sum + Number(sw.totalLossCost || 0),
      0,
    );

    const totalBelanjaDapur = foodCost + beverageCost;
    const usageBelanjaDapur = totalBelanjaDapur + totalSpoilLoss;

    const totalBelanjaPendukung =
      Object.values(dynamicPendukungMap).reduce((sum, c) => sum + c.amount, 0) +
      totalEmployeeMeals;

    const totalUsageAll = usageBelanjaDapur + totalBelanjaPendukung;

    // 6. BUDGETING & PAYROLL & BANK FEE DARI TARGET CONFIG
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

    // 7. QUERY OWNER LEDGERS & ALOKASI DEVIDEN
    const ownerConditions = [
      eq(executiveOwnerLedger.isActive, true),
      sql`TO_CHAR(${executiveOwnerLedger.date}, 'YYYY-MM') = ${month}`,
    ];
    if (outletId)
      ownerConditions.push(eq(executiveOwnerLedger.outletId, outletId));

    const ownerList = await db
      .select()
      .from(executiveOwnerLedger)
      .where(and(...ownerConditions));

    const devidenMitraDoc = ownerList.find(
      (o) => o.category === "DEVIDEN_MITRA",
    );

    const devidenMitraTotal = ownerList
      .filter((o) => o.category === "DEVIDEN_MITRA")
      .reduce(
        (sum, o) =>
          sum +
          (Number(o.percentage || 0) > 0
            ? Math.round(totalNetSales * (Number(o.percentage) / 100))
            : Number(o.amount || 0)),
        0,
      );

    const priveTotal =
      ownerList
        .filter((o) => o.category === "PRIVE")
        .reduce(
          (sum, o) =>
            sum +
            (Number(o.percentage || 0) > 0
              ? Math.round(totalNetSales * (Number(o.percentage) / 100))
              : Number(o.amount || 0)),
          0,
        ) + totalPriveKasirFromReceiving;

    const gajiHoldingTotal = ownerList
      .filter((o) => o.category === "GAJI_HOLDING")
      .reduce(
        (sum, o) =>
          sum +
          (Number(o.percentage || 0) > 0
            ? Math.round(totalNetSales * (Number(o.percentage) / 100))
            : Number(o.amount || 0)),
        0,
      );

    const proyekTotal = ownerList
      .filter((o) => o.category === "PROYEK")
      .reduce(
        (sum, o) =>
          sum +
          (Number(o.percentage || 0) > 0
            ? Math.round(totalNetSales * (Number(o.percentage) / 100))
            : Number(o.amount || 0)),
        0,
      );

    const allocList = await db
      .select()
      .from(executiveAllocations)
      .where(
        and(
          eq(executiveAllocations.isActive, true),
          eq(executiveAllocations.month, month),
        ),
      );

    const alokasiUmroh =
      allocList
        .filter((a) => a.name.includes("UMROH"))
        .reduce(
          (sum, a) =>
            sum +
            (Number(a.percentage || 0) > 0
              ? Math.round(totalNetSales * (Number(a.percentage) / 100))
              : Number(a.nominal || 0)),
          0,
        ) || Math.round(totalNetSales * 0.02);

    const alokasiThr =
      allocList
        .filter((a) => a.name.includes("THR"))
        .reduce(
          (sum, a) =>
            sum +
            (Number(a.percentage || 0) > 0
              ? Math.round(totalNetSales * (Number(a.percentage) / 100))
              : Number(a.nominal || 0)),
          0,
        ) || Math.round(totalNetSales * 0.01);

    const complimentTotal = dynamicItems
      .filter((it) => it.name?.includes("COMPLIMENT"))
      .reduce((sum, c) => sum + Math.abs(Number(c.amount || 0)), 0);

    // 8. KALKULASI LABA BERSIH (GOP & FINAL OWNER PROFIT)
    let grossOperatingProfit = 0;
    let totalOwnerExpenses = 0;

    if (devidenPosition === "TOP_NET_SALES") {
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

    // 9. PERFORMA OUTLET (KONSOLIDASI)
    const outletPerformance = allOutlets
      .map((out) => {
        const salesOfOutlet = salesDocs
          .filter((d) => d.outletId === out.id)
          .reduce((sum, d) => sum + (d.netSales || 0), 0);
        return {
          outletId: out.id,
          outletName: out.name,
          netSales: salesOfOutlet,
        };
      })
      .sort((a, b) => b.netSales - a.netSales);

    const totalRestoExpenses = totalUsageAll + realisasiGaji + bankFee;

    const payload = {
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
        position: devidenPosition,
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
        usagePendukung: totalBelanjaPendukung,
      },
      summaryUsage: {
        totalUsageAll,
        totalRestoExpenses,
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
          devidenPosition === "BOTTOM_OWNER" ? devidenMitraTotal : 0,
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
            ? parseFloat(
                ((usageBelanjaDapur / cogsBudgetLimit) * 100).toFixed(1),
              )
            : 0,
        cogsRemaining: cogsBudgetLimit - usageBelanjaDapur,
        opexLimit: opexBudgetLimit,
        opexUsedPct:
          opexBudgetLimit > 0
            ? parseFloat(
                ((totalBelanjaPendukung / opexBudgetLimit) * 100).toFixed(1),
              )
            : 0,
        opexRemaining: opexBudgetLimit - totalBelanjaPendukung,
      },
      outletPerformance,
    };

    res.status(200).json(payload);
  } catch (error: any) {
    console.error("[EXECUTIVE FINANCIALS ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
});

// =========================================================================
// GET /api/executive/raw-context - AMBIL REFERENSI REGIONS, OUTLETS, VENDORS, NOTA
// =========================================================================
router.get("/raw-context", async (req: Request, res: Response) => {
  try {
    const [allRegions, allOutlets, allVendors, allReceivingDocs] =
      await Promise.all([
        db.select().from(regions).where(eq(regions.isActive, true)),
        db.select().from(outlets).where(eq(outlets.isActive, true)),
        db.select().from(vendors).where(eq(vendors.isActive, true)),
        db
          .select()
          .from(receivingDocuments)
          .where(
            and(
              eq(receivingDocuments.isActive, true),
              sql`${receivingDocuments.status} != 'CANCELLED'`,
            ),
          ),
      ]);

    res.status(200).json({
      regions: allRegions,
      outlets: allOutlets,
      vendors: allVendors,
      receivingDocs: allReceivingDocs,
    });
  } catch (error: any) {
    console.error("[EXECUTIVE CONTEXT ERROR]:", error);
    res.status(500).json({ error: error.message });
  }
});

export const executiveDashboardRouter: Router = router;
