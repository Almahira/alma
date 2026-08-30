import {
  PdfEngine,
  PdfTableConfig,
} from "../../../../../packages/core_unv/src/io/engines/PdfEngine";

export const exportPdfItem = (
  products: any[],
  categories: any[],
  uoms: any[],
  getPriceDisplay: Function,
  companyName: string = "UNIVERSAL",
) => {
  const rows = products.map((p) => {
    const cat = categories.find((c) => c.id === p.categoryId)?.name || "-";
    const uom = uoms.find((u) => u.id === p.uomId)?.name || "-";
    const sell = getPriceDisplay(p, "sellingPrice");

    return [p.name, cat, uom, `Rp ${sell.toLocaleString()}`];
  });

  const config: PdfTableConfig = {
    title: "LAPORAN KATALOG PRODUK",
    subtitle: `Dicetak dari: ${companyName} | Tanggal: ${new Date().toLocaleDateString("id-ID")}`,
    filename: "Katalog_Produk",
    headers: ["NAMA PRODUK", "KATEGORI", "UOM", "HARGA JUAL"],
    rows: rows,
  };

  PdfEngine.exportTable(config);
};
