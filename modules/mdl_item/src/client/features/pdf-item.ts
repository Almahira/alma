import {
  PdfEngine,
  PdfTableConfig,
} from "../../../../../packages/core_unv/src/io/engines/PdfEngine";

export const exportPdfItem = (
  products: any[],
  categories: any[],
  uoms: any[],
  getPriceDisplay: Function,
  companyName: string = "PERUSAHAAN",
  reportType: "PRODUK" | "EXPENSE" = "PRODUK",
) => {
  const isExpense = reportType === "EXPENSE";

  const rows = products.map((p, idx) => {
    const cat = categories.find((c) => c.id === p.categoryId)?.name || "-";
    const uom = uoms.find((u) => u.id === p.uomId)?.name || "-";
    const basePrice = getPriceDisplay(p, "basePrice");
    const sellPrice = getPriceDisplay(p, "sellingPrice");

    if (isExpense) {
      return [idx + 1, p.name, cat, `Rp ${basePrice.toLocaleString()}`];
    }
    return [idx + 1, p.name, cat, uom, `Rp ${sellPrice.toLocaleString()}`];
  });

  const config: PdfTableConfig = {
    title: isExpense
      ? "LAPORAN JASA & BIAYA OPERASIONAL"
      : "LAPORAN KATALOG PRODUK BARANG",
    subtitle: `Unit/Perusahaan : ${companyName} | Tanggal: ${new Date().toLocaleDateString("id-ID")}`,
    filename: isExpense ? "Laporan_Jasa_Biaya" : "Katalog_Produk",
    headers: isExpense
      ? ["NO", "NAMA JASA / BIAYA", "KATEGORI", "ESTIMASI BIAYA (HPP)"]
      : ["NO", "NAMA PRODUK", "KATEGORI", "UOM", "HARGA JUAL"],
    rows: rows,
  };

  PdfEngine.exportTable(config);
};
