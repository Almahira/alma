// File: modules/mdl_plusales/src/client/features/pdf-plusales.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * 1. CETAK LEMBAR LAPORAN MANAGER ON DUTY (MOD) PDF RESMI
 */
export const printModReportPdf = (
  doc: any,
  outletName: string,
  pettycashDetails: any[] = [],
  companyName: string = "COMPANY GROUP",
) => {
  const pdf = new jsPDF("p", "pt", "a4");

  // Header Laporan
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("LAPORAN MANAGER ON DUTY (MOD)", 40, 45);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80);
  pdf.text(`Perusahaan  : ${companyName}`, 40, 62);
  pdf.text(`Unit Cabang : ${outletName}`, 40, 75);
  pdf.text(
    `Tanggal     : ${new Date(doc.date).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}`,
    40,
    88,
  );
  pdf.text(`No. Dokumen : ${doc.documentNumber}`, 340, 62);
  pdf.text(`Waktu Cetak : ${new Date().toLocaleTimeString("id-ID")}`, 340, 75);

  // TABEL 1: RINGKASAN REVENUE (SISI STATIS)
  const staticRows = [
    [
      "1",
      "GROSS SALES (PENJUALAN KOTOR)",
      `Rp ${(doc.grossSales || 0).toLocaleString()}`,
    ],
    ["2", "POTONGAN DISKON", `- Rp ${(doc.discount || 0).toLocaleString()}`],
    ["3", "PAJAK RESTO (PB1 10%)", `- Rp ${(doc.tax || 0).toLocaleString()}`],
    ["4", "SERVICE CHARGE", `- Rp ${(doc.service || 0).toLocaleString()}`],
    [
      "",
      "NET SALES / MENU SOLD (OMSET MURNI)",
      `Rp ${(doc.netSales || 0).toLocaleString()}`,
    ],
  ];

  autoTable(pdf, {
    head: [["NO", "KOMPONEN OMSET PENJUALAN (POS)", "NILAI (RP)"]],
    body: staticRows,
    startY: 105,
    theme: "striped",
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: { fontSize: 8.5, cellPadding: 4 },
  });

  let currentY = (pdf as any).lastAutoTable.finalY + 15;

  // TABEL 2: RINCIAN REALISASI PEMBAYARAN & KAS (SISI DINAMIS)
  const dynamicRows: any[] = [];
  let rowNo = 1;

  (doc.dynamicItems || []).forEach((item: any) => {
    dynamicRows.push([
      rowNo++,
      item.name,
      item.category === "DEDUCTION"
        ? "PENGURANG OMSET"
        : "SETTLEMENT / NON-TUNAI",
      item.category === "DEDUCTION"
        ? `- Rp ${Math.abs(item.amount || 0).toLocaleString()}`
        : `Rp ${(item.amount || 0).toLocaleString()}`,
    ]);
  });

  // Pengeluaran Kasir (Pettycash)
  dynamicRows.push([
    rowNo++,
    "PENGELUARAN KAS KASIR (PETTYCASH)",
    "PENGURANG LACI KAS",
    `- Rp ${(doc.totalPettycash || 0).toLocaleString()}`,
  ]);

  // Cash on Hand
  dynamicRows.push([
    rowNo++,
    "UANG FISIK KASIR (CASH ON HAND)",
    "SETORAN TUNAI LACI",
    `Rp ${(doc.cashOnHand || 0).toLocaleString()}`,
  ]);

  autoTable(pdf, {
    head: [
      ["NO", "KOMPONEN REALISASI KAS & PEMBAYARAN", "KATEGORI", "NILAI (RP)"],
    ],
    body: dynamicRows,
    startY: currentY,
    theme: "grid",
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 8.5, cellPadding: 4 },
  });

  currentY = (pdf as any).lastAutoTable.finalY + 15;

  // STATUS TIMBANGAN & SELISIH
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30);
  pdf.text(
    `TOTAL OMSET NET SALES    : Rp ${(doc.netSales || 0).toLocaleString()}`,
    40,
    currentY,
  );
  pdf.text(
    `TOTAL REALISASI PEMBAYARAN: Rp ${(doc.totalSettlement + doc.cashOnHand - doc.totalPettycash).toLocaleString()}`,
    40,
    currentY + 14,
  );

  const diff = doc.balanceDifference || 0;
  if (diff === 0) {
    pdf.setTextColor(16, 185, 129);
    pdf.text(
      "STATUS TIMBANGAN KASIR   : BALANCE (SELISIH Rp 0)",
      40,
      currentY + 28,
    );
  } else if (diff < 0) {
    pdf.setTextColor(225, 29, 72);
    pdf.text(
      `STATUS TIMBANGAN KASIR   : KURANG (SHORTAGE) Rp ${Math.abs(diff).toLocaleString()}`,
      40,
      currentY + 28,
    );
  } else {
    pdf.setTextColor(37, 99, 235);
    pdf.text(
      `STATUS TIMBANGAN KASIR   : LEBIH (OVERAGE) Rp ${diff.toLocaleString()}`,
      40,
      currentY + 28,
    );
  }

  if (doc.discrepancyNote) {
    pdf.setFontSize(8.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100);
    pdf.text(`Catatan Selisih: "${doc.discrepancyNote}"`, 40, currentY + 44);
    currentY += 15;
  }

  // KOTAK TANDA TANGAN RESMI
  const signY = currentY + 60;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(50);

  pdf.text("Kasir yang Bertugas,", 50, signY);
  pdf.text("( _____________________ )", 50, signY + 50);

  pdf.text("Manager on Duty (MOD),", 230, signY);
  pdf.text("( _____________________ )", 230, signY + 50);

  pdf.text("Finance & Owner,", 420, signY);
  pdf.text("( _____________________ )", 420, signY + 50);

  pdf.save(
    `MOD_Report_${outletName}_${new Date(doc.date).toISOString().slice(0, 10)}.pdf`,
  );
};

/**
 * 2. CETAK REKAPITULASI REVENUE BULANAN
 */
export const printMonthlyRevenuePdf = (
  docs: any[],
  monthLabel: string,
  outletName: string,
  allocations: any[] = [],
) => {
  const pdf = new jsPDF("p", "pt", "a4");

  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text(
    `REKAPITULASI REVENUE BULANAN (${monthLabel.toUpperCase()})`,
    40,
    40,
  );

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(90);
  pdf.text(
    `Outlet / Unit : ${outletName} | Dicetak pada: ${new Date().toLocaleDateString("id-ID")}`,
    40,
    56,
  );

  const tableRows = docs.map((d: any, idx: number) => [
    idx + 1,
    new Date(d.date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    }),
    `Rp ${(d.grossSales || 0).toLocaleString()}`,
    `Rp ${(d.discount || 0).toLocaleString()}`,
    `Rp ${(d.tax || 0).toLocaleString()}`,
    `Rp ${(d.service || 0).toLocaleString()}`,
    `Rp ${(d.netSales || 0).toLocaleString()}`,
    `Rp ${(d.cashOnHand || 0).toLocaleString()}`,
  ]);

  autoTable(pdf, {
    head: [
      [
        "NO",
        "TANGGAL",
        "GROSS",
        "DISKON",
        "PB1",
        "SERVICE",
        "NET SALES",
        "CASH ON HAND",
      ],
    ],
    body: tableRows,
    startY: 75,
    theme: "striped",
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: { fontSize: 8, cellPadding: 4 },
  });

  const finalY = (pdf as any).lastAutoTable.finalY + 15;
  const totalNet = docs.reduce((sum, d) => sum + (d.netSales || 0), 0);

  // ALOKASI BUDGETING TERHITUNG DARI TOTAL NET SALES
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(20);
  pdf.text(
    `TOTAL NET SALES BULAN INI : Rp ${totalNet.toLocaleString()}`,
    40,
    finalY,
  );

  let budgetY = finalY + 18;
  pdf.setFontSize(8.5);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(70);

  allocations.forEach((b: any) => {
    const nominal =
      b.percentage > 0
        ? Math.round(totalNet * (b.percentage / 100))
        : b.nominal || 0;
    pdf.text(
      `• Alokasi ${b.name} (${b.percentage}%): Rp ${nominal.toLocaleString()}`,
      50,
      budgetY,
    );
    budgetY += 12;
  });

  pdf.save(`Rekap_Revenue_${monthLabel}_${outletName}.pdf`);
};
