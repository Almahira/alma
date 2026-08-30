import { ExcelEngine } from "../../../../../packages/core_unv/src/io/engines/ExcelEngine";
import { ExcelTemplateSchema } from "../../../../../packages/core_unv/src/io/types";

export const productExcelSchema: ExcelTemplateSchema = {
  entityType: "PRODUK ITEM",
  sheetName: "DATA_PRODUK",
  instructionNote:
    "Isi data produk dengan lengkap. Kategori dan UOM akan dibuat otomatis jika belum tersedia di sistem.",
  columns: [
    {
      header: "NAMA PRODUK (WAJIB)",
      key: "name",
      example: "KOPI ARABICA 1KG",
      required: true,
    },
    {
      header: "KATEGORI (WAJIB)",
      key: "categoryName",
      example: "MINUMAN",
      required: true,
    },
    {
      header: "SATUAN / UOM (WAJIB)",
      key: "uomName",
      example: "PCS",
      required: true,
    },
    { header: "HARGA BELI", key: "basePrice", example: 100000 },
    { header: "MARGIN (%)", key: "marginPercentage", example: 20 },
    { header: "HARGA JUAL", key: "sellingPrice", example: 120000 },
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
    return {
      name: p.name,
      categoryName: categories.find((c) => c.id === p.categoryId)?.name || "-",
      uomName: uoms.find((u) => u.id === p.uomId)?.name || "-",
      basePrice: getPriceDisplay(p, "basePrice"),
      marginPercentage: getPriceDisplay(p, "marginPercentage"),
      sellingPrice: getPriceDisplay(p, "sellingPrice"),
    };
  });

  ExcelEngine.exportData(productExcelSchema, mappedData, "Export_Data_Produk");
};
