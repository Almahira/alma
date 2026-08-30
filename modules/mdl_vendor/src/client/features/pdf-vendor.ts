// File: modules/mdl_vendor/src/client/features/pdf-vendor.ts
import {
  PdfEngine,
  PdfTableConfig,
} from "../../../../../packages/core_unv/src/io/engines/PdfEngine";

export const exportPdfVendor = (
  vendors: any[],
  companyName: string = "COMPANY UNIVERSAL",
) => {
  const rows = vendors.map((v) => [
    v.name,
    v.contactNumber || "-",
    v.bankName ? `${v.bankName} - ${v.bankAccount || ""}` : "-",
    v.bankAccountName || "-",
  ]);

  const config: PdfTableConfig = {
    title: "LAPORAN DATA VENDOR & PEMASOK",
    subtitle: `Dicetak dari: ${companyName} | Tanggal: ${new Date().toLocaleDateString("id-ID")}`,
    filename: "Laporan_Vendor",
    headers: ["NAMA VENDOR", "KONTAK", "REKENING BANK", "ATAS NAMA"],
    rows: rows,
  };
  PdfEngine.exportTable(config);
};
