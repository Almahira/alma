// File: modules/mdl_vendor/src/client/features/excel-vendor.ts
import { ExcelEngine } from "../../../../../packages/core_unv/src/io/engines/ExcelEngine";
import { ExcelTemplateSchema } from "../../../../../packages/core_unv/src/io/types";

export const vendorExcelSchema: ExcelTemplateSchema = {
  entityType: "DATA VENDOR",
  sheetName: "DATA_VENDOR",
  instructionNote:
    "Isi data vendor pemasok dengan lengkap. Informasi kontak dan nomor rekening akan dicatat otomatis ke dalam sistem.",
  columns: [
    {
      header: "NAMA VENDOR (WAJIB)",
      key: "name",
      example: "PT SUMBER SEGAR UTAMA",
      required: true,
    },
    {
      header: "NOMOR KONTAK",
      key: "contactNumber",
      example: "081234567890",
      isText: true,
    },
    { header: "NAMA BANK", key: "bankName", example: "BCA" },
    {
      header: "NOMOR REKENING",
      key: "bankAccount",
      example: "1234567890",
      isText: true,
    },
    {
      header: "ATAS NAMA REKENING",
      key: "bankAccountName",
      example: "PT SUMBER SEGAR",
    },
  ],
};

export const downloadTemplateVendorExcel = () => {
  ExcelEngine.downloadTemplate(vendorExcelSchema, "Template_Import_Vendor");
};

export const exportExcelVendor = (vendors: any[]) => {
  const mappedData = vendors.map((v) => ({
    name: v.name,
    contactNumber: v.contactNumber || "-",
    bankName: v.bankName || "-",
    bankAccount: v.bankAccount || "-",
    bankAccountName: v.bankAccountName || "-",
  }));
  ExcelEngine.exportData(vendorExcelSchema, mappedData, "Export_Data_Vendor");
};
