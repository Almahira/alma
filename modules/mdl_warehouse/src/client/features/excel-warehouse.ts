// File: modules/mdl_warehouse/src/client/features/excel-warehouse.ts
import { ExcelEngine } from "../../../../../packages/core_unv/src/io/engines/ExcelEngine";
import { ExcelTemplateSchema } from "../../../../../packages/core_unv/src/io/types";

export const stockOpnameExcelSchema: ExcelTemplateSchema = {
  entityType: "HASIL STOK OPNAME",
  sheetName: "STOK_OPNAME",
  columns: [
    {
      header: "NAMA BARANG",
      key: "itemName",
      example: "BAWANG MERAH",
      required: true,
    },
    { header: "SATUAN (UOM)", key: "uomName", example: "KG" },
    { header: "STOK AWAL", key: "initialStock", example: 10 },
    { header: "STOK MASUK", key: "stockIn", example: 20 },
    { header: "STOK KELUAR", key: "stockOut", example: 5 },
    { header: "SISA SISTEM", key: "systemStock", example: 25 },
    { header: "STOK FISIK", key: "physicalStock", example: 24, required: true },
    { header: "SELISIH QTY", key: "varianceQty", example: -1 },
    { header: "HPP TERBARU", key: "unitCost", example: 15000 },
    { header: "NILAI SELISIH (RP)", key: "varianceCost", example: -15000 },
    { header: "CATATAN", key: "notes", example: "Susut timbangan" },
  ],
};

export const exportExcelStockOpname = (items: any[], date: string) => {
  const mapped = items.map((it) => ({
    itemName: it.itemName,
    uomName: it.uomName,
    initialStock: it.initialStock || 0,
    stockIn: it.stockIn || 0,
    stockOut: it.stockOut || 0,
    systemStock: it.systemStock || 0,
    physicalStock: it.physicalStock || 0,
    varianceQty: it.varianceQty || 0,
    unitCost: it.unitCost || 0,
    varianceCost: it.varianceCost || 0,
    notes: it.notes || "-",
  }));

  ExcelEngine.exportData(
    stockOpnameExcelSchema,
    mapped,
    `Hasil_Stok_Opname_${date}`,
  );
};

export const warehouseDistributionExcelSchema: ExcelTemplateSchema = {
  entityType: "REKAP DISTRIBUSI BARANG",
  sheetName: "DISTRIBUSI_DIVISI",
  columns: [
    { header: "TANGGAL", key: "date", example: "2026-08-25", required: true },
    {
      header: "NO SURAT JALAN",
      key: "documentNumber",
      example: "DST-20260825-001",
    },
    {
      header: "DIVISI TUJUAN",
      key: "divisionName",
      example: "KITCHEN",
      required: true,
    },
    {
      header: "NAMA BARANG",
      key: "itemName",
      example: "BAWANG MERAH",
      required: true,
    },
    { header: "JUMLAH (QTY)", key: "qty", example: 2, required: true },
    { header: "SATUAN (UOM)", key: "uomName", example: "KG", required: true },
    { header: "HPP SATUAN", key: "unitCost", example: 15000 },
    { header: "TOTAL BIAYA", key: "totalCost", example: 30000 },
    { header: "CATATAN", key: "notes", example: "Untuk stok masak siang" },
  ],
};

export const exportExcelDistribution = (items: any[]) => {
  const mapped = items.map((it) => ({
    date: new Date(it.date).toLocaleDateString("id-ID"),
    documentNumber: it.documentNumber,
    divisionName: it.divisionName,
    itemName: it.itemName,
    qty: it.qty,
    uomName: it.uomName,
    unitCost: it.unitCost || 0,
    totalCost: it.totalCost || 0,
    notes: it.notes || "-",
  }));

  ExcelEngine.exportData(
    warehouseDistributionExcelSchema,
    mapped,
    `Rekap_Distribusi_Barang_${Date.now()}`,
  );
};
