// File: modules/mdl_warehouse/src/client/features/pdf-warehouse.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * 1. CETAK LEMBAR CHECKLIST KERTAS FISIK (BLANK OPNAME SHEET)
 */
export const printBlankOpnameChecklistPdf = (
  products: any[],
  uoms: any[],
  categories: any[],
  outletName: string = "OUTLET",
) => {
  const pdf = new jsPDF("p", "pt", "a4");

  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text("LEMBAR CHECKLIST FISIK STOK OPNAME", 40, 40);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80);
  pdf.text(
    `Outlet / Lokasi : ${outletName} | Tanggal: ${new Date().toLocaleDateString("id-ID")}`,
    40,
    56,
  );
  pdf.text(
    "Petunjuk: Tuliskan jumlah fisik riil yang ada di rak/chiller pada kolom [HITUNGAN FISIK].",
    40,
    69,
  );

  const tableRows = products
    .filter((p) => p.status === "Aktif" && !p.isExpense)
    .map((p, idx) => {
      const uomName = uoms.find((u) => u.id === p.uomId)?.name || "PCS";
      const catName =
        categories.find((c) => c.id === p.categoryId)?.name || "-";
      return [
        idx + 1,
        p.name,
        catName,
        uomName,
        "[           ]",
        "....................................",
      ];
    });

  autoTable(pdf, {
    head: [
      [
        "NO",
        "NAMA BARANG",
        "KATEGORI",
        "UOM",
        "HITUNGAN FISIK",
        "CATATAN KONDISI",
      ],
    ],
    body: tableRows,
    startY: 85,
    theme: "grid",
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 8.5, cellPadding: 6 },
  });

  const finalY = (pdf as any).lastAutoTable.finalY + 30;
  pdf.setFontSize(8.5);
  pdf.text("Petugas Hitung Fisik,", 40, finalY);
  pdf.text("( _____________________ )", 40, finalY + 45);

  pdf.text("Saksi / Head Chef,", 350, finalY);
  pdf.text("( _____________________ )", 350, finalY + 45);

  pdf.save(`Checklist_Blank_Opname_${outletName}.pdf`);
};

/**
 * 2. CETAK BERITA ACARA RESMI HASIL STOK OPNAME
 */
export const printStockOpnameReportPdf = (
  opnameDoc: any,
  outletName: string = "OUTLET",
) => {
  const pdf = new jsPDF("p", "pt", "a4");

  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text("BERITA ACARA HASIL STOK OPNAME", 40, 40);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80);
  pdf.text(`Outlet / Unit : ${outletName}`, 40, 56);
  pdf.text(
    `Tanggal Opname: ${new Date(opnameDoc.date).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}`,
    40,
    69,
  );
  pdf.text(`No. Dokumen   : ${opnameDoc.documentNumber}`, 340, 56);

  const tableRows = (opnameDoc.items || []).map((it: any, idx: number) => [
    idx + 1,
    it.itemName,
    `${it.systemStock} ${it.uomName}`,
    `${it.physicalStock} ${it.uomName}`,
    `${it.varianceQty > 0 ? "+" : ""}${it.varianceQty} ${it.uomName}`,
    `Rp ${(it.unitCost || 0).toLocaleString()}`,
    `Rp ${(it.varianceCost || 0).toLocaleString()}`,
    it.notes || "-",
  ]);

  autoTable(pdf, {
    head: [
      [
        "NO",
        "NAMA BARANG",
        "SISTEM",
        "FISIK",
        "SELISIH",
        "HPP BELI",
        "NILAI SELISIH",
        "CATATAN",
      ],
    ],
    body: tableRows,
    startY: 85,
    theme: "striped",
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: { fontSize: 8, cellPadding: 4 },
  });

  const finalY = (pdf as any).lastAutoTable.finalY + 20;

  pdf.setFontSize(9.5);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30);
  pdf.text(
    `TOTAL ITEM DIHITUNG : ${opnameDoc.totalItemsCounted || (opnameDoc.items || []).length} Item`,
    40,
    finalY,
  );
  pdf.text(
    `TOTAL NILAI SELISIH  : Rp ${(opnameDoc.totalVarianceCost || 0).toLocaleString()}`,
    340,
    finalY,
  );

  const signY = finalY + 45;
  pdf.setFontSize(8.5);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(60);

  pdf.text("Petugas Opname,", 40, signY);
  pdf.text("( _____________________ )", 40, signY + 45);

  pdf.text("Head Chef / Supervisor,", 230, signY);
  pdf.text("( _____________________ )", 230, signY + 45);

  pdf.text("Manager Outlet,", 420, signY);
  pdf.text("( _____________________ )", 420, signY + 45);

  pdf.save(`Berita_Acara_Opname_${opnameDoc.documentNumber}.pdf`);
};

/**
 * 3. CETAK DISTRIBUSI
 */
export const printDistributionReportPdf = (
  items: any[],
  dateStart: string,
  dateEnd: string,
  divisionFilter: string,
  outletName: string = "OUTLET",
) => {
  const pdf = new jsPDF("p", "pt", "a4");

  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text("LAPORAN DISTRIBUSI & SERAPAN BAHAN BAKU", 40, 40);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80);
  pdf.text(`Outlet / Lokasi : ${outletName}`, 40, 56);
  pdf.text(
    `Periode         : ${dateStart ? new Date(dateStart).toLocaleDateString("id-ID") : "Awal"} s/d ${dateEnd ? new Date(dateEnd).toLocaleDateString("id-ID") : "Sekarang"}`,
    40,
    69,
  );
  pdf.text(`Divisi Target   : ${divisionFilter || "SEMUA DIVISI"}`, 40, 82);

  const tableRows = items.map((it: any, idx: number) => [
    idx + 1,
    new Date(it.date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    }),
    it.divisionName,
    it.itemName,
    `${it.qty} ${it.uomName}`,
    `Rp ${(it.unitCost || 0).toLocaleString()}`,
    `Rp ${(it.totalCost || 0).toLocaleString()}`,
    it.notes || "-",
  ]);

  autoTable(pdf, {
    head: [
      [
        "NO",
        "TANGGAL",
        "DIVISI",
        "NAMA BARANG",
        "QTY",
        "HPP SATUAN",
        "TOTAL BIAYA",
        "CATATAN",
      ],
    ],
    body: tableRows,
    startY: 95,
    theme: "striped",
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: { fontSize: 8, cellPadding: 4 },
  });

  const finalY = (pdf as any).lastAutoTable.finalY + 20;
  const totalAbsorption = items.reduce(
    (sum, it) => sum + (it.totalCost || 0),
    0,
  );

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30);
  pdf.text(
    `TOTAL NILAI SERAPAN BIAYA HPP: Rp ${totalAbsorption.toLocaleString()}`,
    40,
    finalY,
  );

  const signY = finalY + 40;
  pdf.setFontSize(8.5);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(60);

  pdf.text("Petugas Gudang Outlet,", 40, signY);
  pdf.text("( _____________________ )", 40, signY + 45);

  pdf.text("Kepala Divisi / Head Chef,", 230, signY);
  pdf.text("( _____________________ )", 230, signY + 45);

  pdf.text("Manager Outlet,", 420, signY);
  pdf.text("( _____________________ )", 420, signY + 45);

  pdf.save(`Laporan_Distribusi_${outletName}_${Date.now()}.pdf`);
};
