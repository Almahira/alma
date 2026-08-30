// File: modules/mdl_receiving/src/client/features/pdf-receiving.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * 1. CETAK FAKTUR SATUAN (SINGLE INVOICE DETAIL)
 */
export const printSingleInvoicePdf = (
  doc: any,
  vendorName: string,
  locationName: string,
  bankInfo?: {
    bankName?: string;
    bankAccount?: string;
    bankAccountName?: string;
  },
) => {
  const pdf = new jsPDF("p", "pt", "a4");

  // Header Faktur
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("BUKTI PENERIMAAN BARANG / NOTA", 40, 45);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100);
  pdf.text(`No. Dokumen : ${doc.invoiceNumber}`, 40, 65);
  pdf.text(
    `Tanggal      : ${new Date(doc.date).toLocaleDateString("id-ID")}`,
    40,
    78,
  );
  pdf.text(`Lokasi       : ${locationName}`, 40, 91);

  pdf.text(`Vendor/Penyedia : ${vendorName}`, 320, 65);
  pdf.text(
    `Jatuh Tempo     : ${doc.dueDate ? new Date(doc.dueDate).toLocaleDateString("id-ID") : "CASH / LUNAS"}`,
    320,
    78,
  );
  if (bankInfo?.bankName) {
    pdf.text(
      `Rekening Bank   : ${bankInfo.bankName} - ${bankInfo.bankAccount || ""} (a.n ${bankInfo.bankAccountName || ""})`,
      320,
      91,
    );
  }

  // Tabel Rincian Barang
  const tableRows = (doc.items || []).map((item: any, idx: number) => [
    idx + 1,
    item.name || item.itemId,
    item.isExpense ? "JASA" : "BARANG",
    item.qty,
    `Rp ${(item.price || 0).toLocaleString()}`,
    `Rp ${(item.subtotal || 0).toLocaleString()}`,
  ]);

  autoTable(pdf, {
    head: [
      ["NO", "NAMA ITEM / JASA", "TIPE", "QTY", "HARGA SATUAN", "SUBTOTAL"],
    ],
    body: tableRows,
    startY: 110,
    theme: "striped",
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: { fontSize: 9, cellPadding: 5 },
  });

  const finalY = (pdf as any).lastAutoTable.finalY + 20;

  // Ringkasan Total & Sisa Tagihan
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(40);
  pdf.text(
    `TOTAL NILAI NOTA : Rp ${(doc.totalAmount || 0).toLocaleString()}`,
    340,
    finalY,
  );
  pdf.text(
    `SUDAH DIBAYAR    : Rp ${(doc.paidAmount || 0).toLocaleString()}`,
    340,
    finalY + 15,
  );
  pdf.setTextColor(225, 29, 72);
  pdf.text(
    `SISA KEKURANGAN  : Rp ${((doc.totalAmount || 0) - (doc.paidAmount || 0)).toLocaleString()}`,
    340,
    finalY + 30,
  );

  // Tanda Tangan
  pdf.setTextColor(40);
  pdf.setFont("helvetica", "normal");
  pdf.text("Penerima / Petugas Cabang,", 40, finalY + 60);
  pdf.text("( ________________________ )", 40, finalY + 110);

  pdf.text("Mengetahui (Supervisor / Manager),", 320, finalY + 60);
  pdf.text("( ________________________ )", 320, finalY + 110);

  pdf.save(`Faktur_${doc.invoiceNumber}.pdf`);
};

/**
 * 2. CETAK LAPORAN RINGKASAN PERIODE (UNTUK FINANCE / KASIR BESAR)
 */
export const printSummaryPeriodPdf = (
  groupedDocs: Record<string, any>,
  dateStart: string,
  dateEnd: string,
  outletName: string = "SEMUA CABANG",
) => {
  const pdf = new jsPDF("p", "pt", "a4");

  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text("PENGAJUAN PEMBAYARAN VENDOR (RINGKASAN FINANCE)", 40, 40);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100);
  pdf.text(`Cabang / Unit : ${outletName}`, 40, 58);
  pdf.text(
    `Periode       : ${dateStart ? new Date(dateStart).toLocaleDateString("id-ID") : "Awal"} s/d ${dateEnd ? new Date(dateEnd).toLocaleDateString("id-ID") : "Sekarang"}`,
    40,
    71,
  );

  let currentY = 90;

  Object.entries(groupedDocs).forEach(([_, group]) => {
    if (group.docs.length === 0) return;

    // Header Grup Vendor + Info Rekening Bank
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(234, 88, 12);
    pdf.text(`${group.title.toUpperCase()}`, 40, currentY);

    pdf.setFontSize(8.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(70);
    if (group.bankInfo) {
      pdf.text(
        `Rekening: ${group.bankInfo.bankName || "-"} | No: ${group.bankInfo.bankAccount || "-"} | a.n: ${group.bankInfo.bankAccountName || "-"}`,
        40,
        currentY + 13,
      );
    }

    const rows = group.docs.map((d: any) => [
      new Date(d.date).toLocaleDateString("id-ID"),
      d.invoiceNumber,
      d.dueDate ? new Date(d.dueDate).toLocaleDateString("id-ID") : "CASH",
      d.totalAmount - d.paidAmount <= 0 ? "LUNAS" : "BELUM LUNAS",
      `Rp ${(d.paidAmount || 0).toLocaleString()}`,
      `Rp ${(d.totalAmount || 0).toLocaleString()}`,
    ]);

    autoTable(pdf, {
      head: [
        [
          "TANGGAL",
          "NO. INVOICE",
          "TEMPO",
          "STATUS",
          "SUDAH DIBAYAR",
          "TOTAL NILAI",
        ],
      ],
      body: rows,
      startY: currentY + 20,
      theme: "grid",
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: 255,
        fontStyle: "bold",
      },
      styles: { fontSize: 8, cellPadding: 4 },
    });

    currentY = (pdf as any).lastAutoTable.finalY + 15;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(15, 23, 42);
    pdf.text(
      `TOTAL PENGAJUAN ${group.title.toUpperCase()} : Rp ${(group.total || 0).toLocaleString()}`,
      260,
      currentY,
    );
    currentY += 25;

    // Cek ganti halaman jika sudah di ujung bawah
    if (currentY > 750) {
      pdf.addPage();
      currentY = 40;
    }
  });

  pdf.save(`Rekap_Finance_${outletName}_${Date.now()}.pdf`);
};

/**
 * 3. CETAK LAPORAN RINCIAN DETAIL PERIODE (UNTUK OPERATIONAL MANAGER / AUDIT)
 */
export const printDetailedPeriodPdf = (
  groupedDocs: Record<string, any>,
  dateStart: string,
  dateEnd: string,
  outletName: string = "SEMUA CABANG",
) => {
  const pdf = new jsPDF("p", "pt", "a4");

  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text("LAPORAN RINCIAN PENERIMAAN BARANG (OPERASIONAL & AUDIT)", 40, 40);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100);
  pdf.text(`Cabang / Unit : ${outletName}`, 40, 58);
  pdf.text(
    `Periode       : ${dateStart ? new Date(dateStart).toLocaleDateString("id-ID") : "Awal"} s/d ${dateEnd ? new Date(dateEnd).toLocaleDateString("id-ID") : "Sekarang"}`,
    40,
    71,
  );

  let currentY = 90;

  Object.entries(groupedDocs).forEach(([_, group]) => {
    if (group.docs.length === 0) return;

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(234, 88, 12);
    pdf.text(`VENDOR: ${group.title.toUpperCase()}`, 40, currentY);

    if (group.bankInfo) {
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(80);
      pdf.text(
        `Bank: ${group.bankInfo.bankName || "-"} | No: ${group.bankInfo.bankAccount || "-"} | a.n: ${group.bankInfo.bankAccountName || "-"}`,
        40,
        currentY + 13,
      );
    }

    currentY += 22;

    group.docs.forEach((d: any) => {
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 41, 59);
      pdf.text(
        `▶ Invoice: ${d.invoiceNumber} | Tgl: ${new Date(d.date).toLocaleDateString("id-ID")} | Total: Rp ${(d.totalAmount || 0).toLocaleString()}`,
        40,
        currentY,
      );

      const itemRows = (d.items || []).map((it: any, idx: number) => [
        idx + 1,
        it.name || it.itemId,
        it.isExpense ? "JASA" : "BARANG",
        it.qty,
        `Rp ${(it.price || 0).toLocaleString()}`,
        `Rp ${(it.subtotal || 0).toLocaleString()}`,
      ]);

      autoTable(pdf, {
        head: [
          ["NO", "NAMA BARANG / JASA", "TIPE", "QTY", "HARGA", "SUBTOTAL"],
        ],
        body: itemRows,
        startY: currentY + 6,
        theme: "striped",
        headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 7.5 },
        styles: { fontSize: 7.5, cellPadding: 3 },
      });

      currentY = (pdf as any).lastAutoTable.finalY + 15;

      if (currentY > 750) {
        pdf.addPage();
        currentY = 40;
      }
    });

    currentY += 15;
  });

  pdf.save(`Rekap_Detail_Operasional_${outletName}_${Date.now()}.pdf`);
};
