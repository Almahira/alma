// File: modules/mdl_plusales/src/client/features/excel-plusales.ts
import { ExcelEngine } from "../../../../../packages/core_unv/src/io/engines/ExcelEngine";
import { ExcelTemplateSchema } from "../../../../../packages/core_unv/src/io/types";

export const plusalesExcelSchema: ExcelTemplateSchema = {
  entityType: "REKAP PENJUALAN POS",
  sheetName: "REKAP_SALES",
  columns: [
    { header: "TANGGAL", key: "date", example: "2026-08-25", required: true },
    {
      header: "NO DOKUMEN",
      key: "documentNumber",
      example: "SLS-20260825-001",
    },
    { header: "GROSS SALES", key: "grossSales", example: 10000000 },
    { header: "DISKON", key: "discount", example: 100000 },
    { header: "PB1 (TAX)", key: "tax", example: 1100000 },
    { header: "SERVICE", key: "service", example: 500000 },
    { header: "NET SALES", key: "netSales", example: 8300000 },
    { header: "CASH ON HAND", key: "cashOnHand", example: 4000000 },
    { header: "PETTYCASH KASIR", key: "totalPettycash", example: 100000 },
    { header: "SELISIH", key: "balanceDifference", example: 0 },
    { header: "STATUS", key: "status", example: "COMPLETED" },
  ],
};

export const exportExcelPlusales = (docs: any[]) => {
  const mapped = docs.map((d) => ({
    date: new Date(d.date).toLocaleDateString("id-ID"),
    documentNumber: d.documentNumber,
    grossSales: d.grossSales || 0,
    discount: d.discount || 0,
    tax: d.tax || 0,
    service: d.service || 0,
    netSales: d.netSales || 0,
    cashOnHand: d.cashOnHand || 0,
    totalPettycash: d.totalPettycash || 0,
    balanceDifference: d.balanceDifference || 0,
    status: d.status,
  }));

  ExcelEngine.exportData(
    plusalesExcelSchema,
    mapped,
    `Rekap_Sales_POS_${Date.now()}`,
  );
};
