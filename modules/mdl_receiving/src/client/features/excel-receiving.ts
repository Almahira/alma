// File: modules/mdl_receiving/src/client/features/excel-receiving.ts
import { ExcelEngine } from "../../../../../packages/core_unv/src/io/engines/ExcelEngine";
import { ExcelTemplateSchema } from "../../../../../packages/core_unv/src/io/types";

export const receivingExcelSchema: ExcelTemplateSchema = {
  entityType: "REKAP TRANSAKSI PENERIMAAN",
  sheetName: "REKAP_TRANSAKSI",
  columns: [
    { header: "TANGGAL", key: "date", example: "2026-08-22", required: true },
    {
      header: "NO INVOICE",
      key: "invoiceNumber",
      example: "INV-001",
      required: true,
    },
    { header: "TIPE", key: "documentType", example: "HUTANG" },
    {
      header: "VENDOR / SUMBER",
      key: "entityName",
      example: "PT SUMBER SEGAR",
    },
    { header: "JATUH TEMPO", key: "dueDate", example: "2026-08-29" },
    { header: "STATUS", key: "status", example: "COMPLETED" },
    { header: "TOTAL NOTA", key: "totalAmount", example: 2000000 },
    { header: "SUDAH DIBAYAR", key: "paidAmount", example: 1000000 },
    { header: "SISA HUTANG", key: "remainingAmount", example: 1000000 },
  ],
};

export const exportExcelReceiving = (
  docs: any[],
  getEntityName: (d: any) => string,
) => {
  const mapped = docs.map((d) => ({
    date: new Date(d.date).toLocaleDateString("id-ID"),
    invoiceNumber: d.invoiceNumber,
    documentType: d.documentType,
    entityName: getEntityName(d),
    dueDate: d.dueDate
      ? new Date(d.dueDate).toLocaleDateString("id-ID")
      : "CASH",
    status: d.status,
    totalAmount: d.totalAmount || 0,
    paidAmount: d.paidAmount || 0,
    remainingAmount: (d.totalAmount || 0) - (d.paidAmount || 0),
  }));

  ExcelEngine.exportData(
    receivingExcelSchema,
    mapped,
    `Rekap_Transaksi_${Date.now()}`,
  );
};
