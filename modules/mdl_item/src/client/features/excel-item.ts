// File: modules/mdl_item/src/client/features/excel-item.ts
import { ExcelEngine } from "../../../../../packages/core_unv/src/io/engines/ExcelEngine";
import { ExcelTemplateSchema } from "../../../../../packages/core_unv/src/io/types";

export const productExcelSchema: ExcelTemplateSchema = {
  entityType: "PRODUK ITEM",
  sheetName: "DATA_PRODUK",
  instructionNote:
    "Isi data produk dengan lengkap. Jika barang dibeli dalam kemasan (misal: KARUNG / DUS / JERIGEN), isi kolom 'ISI KONVERSI' dan 'SATUAN KONVERSI' (contoh: Isi 25, Satuan KG).",
  columns: [
    {
      header: "NAMA PRODUK (WAJIB)",
      key: "name",
      example: "BERAS PANDAN WANGI",
      required: true,
    },
    {
      header: "KATEGORI (WAJIB)",
      key: "categoryName",
      example: "BAHAN POKOK",
      required: true,
    },
    {
      header: "SATUAN UTAMA / UOM (WAJIB)",
      key: "uomName",
      example: "KARUNG",
      required: true,
    },
    {
      header: "ISI KONVERSI (OPSIONAL)",
      key: "conversionValue",
      example: 25,
    },
    {
      header: "SATUAN KONVERSI (OPSIONAL)",
      key: "conversionUom",
      example: "KG",
    },
    { header: "HARGA BELI (HPP)", key: "basePrice", example: 350000 },
    { header: "MARGIN (%)", key: "marginPercentage", example: 10 },
    { header: "HARGA JUAL", key: "sellingPrice", example: 385000 },
  ],
};

export const downloadTemplateExcel = () => {
  ExcelEngine.downloadTemplate(productExcelSchema, "Template_Import_Produk");
};

export const exportExcelItem = (
  products: any[],
  categories: any[],
  uoms: any[],
  getPriceDisplay: Function,
) => {
  const mappedData = products.map((p) => {
    const defaultConv =
      Array.isArray(p.uomConversions) && p.uomConversions.length > 0
        ? p.uomConversions.find((c: any) => c.isDefault) || p.uomConversions[0]
        : null;

    return {
      name: p.name,
      categoryName: categories.find((c) => c.id === p.categoryId)?.name || "-",
      uomName: uoms.find((u) => u.id === p.uomId)?.name || "-",
      conversionValue: defaultConv ? defaultConv.value : "-",
      conversionUom: defaultConv ? defaultConv.uom : "-",
      basePrice: getPriceDisplay(p, "basePrice"),
      marginPercentage: getPriceDisplay(p, "marginPercentage"),
      sellingPrice: getPriceDisplay(p, "sellingPrice"),
    };
  });

  ExcelEngine.exportData(productExcelSchema, mappedData, "Export_Data_Produk");
};
