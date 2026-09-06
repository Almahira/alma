// File: modules/mdl_receiving/src/client/features/pdf-receiving.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * 1. CETAK FAKTUR SATUAN / SURAT JALAN (SINGLE INVOICE DETAIL)
 */
export const printSingleInvoicePdf = (
  doc: any,
  entityName: string, // Nama Vendor (pada Hutang) ATAU Nama Outlet (pada Piutang)
  locationName: string, // Lokasi Unit yang sedang aktif / login
  bankInfo?: {
    bankName?: string;
    bankAccount?: string;
    bankAccountName?: string;
  },
) => {
  const isPiutang = doc.documentType === "PIUTANG";
  const pdf = new jsPDF("p", "pt", "a4");

  // Header Dokumen Resmi
  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text(
    isPiutang
      ? "SURAT JALAN & DISTRIBUSI CABANG (PIUTANG)"
      : doc.documentType === "PETTYCASH"
        ? "BUKTI PENGELUARAN KAS KECIL (PETTYCASH)"
        : "BUKTI PENERIMAAN BARANG / NOTA (HUTANG)",
    40,
    45,
  );

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100);
  pdf.text(`No. Dokumen : ${doc.invoiceNumber}`, 40, 65);
  pdf.text(
    `Tanggal      : ${new Date(doc.date).toLocaleDateString("id-ID")}`,
    40,
    78,
  );

  // =========================================================================
  // PENYELARASAN IDENTITAS PENYEDIA (PENGIRIM) VS KONSUMEN (PENERIMA)
  // =========================================================================
  if (isPiutang) {
    // Pada Piutang: Gudang Region = Pengirim (Penyedia), Outlet Cabang = Penerima (Konsumen)
    pdf.text(`Gudang Pengirim (Penyedia) : ${locationName}`, 40, 91);
    pdf.text(`Cabang Penerima (Konsumen) : ${entityName}`, 320, 65);
    pdf.text(
      `Jatuh Tempo Pembayaran     : ${doc.dueDate ? new Date(doc.dueDate).toLocaleDateString("id-ID") : "TEMPO INTERNAL"}`,
      320,
      78,
    );
  } else {
    // Pada Hutang: Vendor = Penyedia, Outlet/Gudang = Penerima
    pdf.text(`Unit Penerima   : ${locationName}`, 40, 91);
    pdf.text(`Vendor/Penyedia : ${entityName}`, 320, 65);
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
  }

  // Tabel Rincian Barang
  const tableRows = (doc.items || []).map((item: any, idx: number) => [
    idx + 1,
    item.name || item.itemId,
    item.isExpense ? "JASA" : "BARANG",
    item.qty,
    `Rp ${(item.price || 0).toLocaleString("id-ID")}`,
    `Rp ${(item.subtotal || 0).toLocaleString("id-ID")}`,
  ]);

  autoTable(pdf, {
    head: [
      ["NO", "NAMA ITEM / JASA", "TIPE", "QTY", "HARGA SATUAN", "SUBTOTAL"],
    ],
    body: tableRows,
    startY: 110,
    theme: "striped",
    headStyles: {
      fillColor: isPiutang ? [14, 165, 233] : [249, 115, 22], // Biru untuk Piutang, Oranye untuk Hutang
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
    `TOTAL NILAI DOKUMEN : Rp ${(doc.totalAmount || 0).toLocaleString("id-ID")}`,
    340,
    finalY,
  );
  pdf.text(
    `SUDAH DIBAYAR       : Rp ${(doc.paidAmount || 0).toLocaleString("id-ID")}`,
    340,
    finalY + 15,
  );
  pdf.setTextColor(225, 29, 72);
  pdf.text(
    `SISA KEKURANGAN     : Rp ${((doc.totalAmount || 0) - (doc.paidAmount || 0)).toLocaleString("id-ID")}`,
    340,
    finalY + 30,
  );

  // Tanda Tangan Sesuai Jenis Dokumen
  pdf.setTextColor(40);
  pdf.setFont("helvetica", "normal");
  if (isPiutang) {
    pdf.text("Pengirim (Petugas Gudang Pusat),", 40, finalY + 60);
    pdf.text("( ________________________ )", 40, finalY + 110);

    pdf.text("Penerima (Petugas Cabang Outlet),", 320, finalY + 60);
    pdf.text("( ________________________ )", 320, finalY + 110);
  } else {
    pdf.text("Penerima / Petugas Cabang,", 40, finalY + 60);
    pdf.text("( ________________________ )", 40, finalY + 110);

    pdf.text("Mengetahui (Supervisor / Manager),", 320, finalY + 60);
    pdf.text("( ________________________ )", 320, finalY + 110);
  }

  pdf.save(
    `${isPiutang ? "SuratJalan_Distribusi" : "Faktur"}_${doc.invoiceNumber}.pdf`,
  );
};

/**
 * 2. CETAK LAPORAN RINGKASAN PERIODE (UNTUK FINANCE / REKAP TAGIHAN)
 */
export const printSummaryPeriodPdf = (
  groupedDocs: Record<string, any>,
  dateStart: string,
  dateEnd: string,
  outletName: string = "SEMUA CABANG",
) => {
  // Cek apakah data ini rumpun Piutang Distribusi
  const firstGroup = Object.values(groupedDocs)[0];
  const isPiutang = firstGroup?.docs?.[0]?.documentType === "PIUTANG";

  const pdf = new jsPDF("p", "pt", "a4");

  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text(
    isPiutang
      ? "REKAPITULASI DISTRIBUSI & PIUTANG CABANG (FINANCE)"
      : "PENGAJUAN PEMBAYARAN VENDOR (RINGKASAN FINANCE)",
    40,
    40,
  );

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100);
  pdf.text(
    `${isPiutang ? "Gudang Pengirim (Pusat)" : "Cabang / Unit"} : ${outletName}`,
    40,
    58,
  );
  pdf.text(
    `Periode       : ${dateStart ? new Date(dateStart).toLocaleDateString("id-ID") : "Awal"} s/d ${dateEnd ? new Date(dateEnd).toLocaleDateString("id-ID") : "Sekarang"}`,
    40,
    71,
  );

  let currentY = 90;

  Object.entries(groupedDocs).forEach(([_, group]) => {
    if (group.docs.length === 0) return;

    // Header Grup (Vendor vs Outlet Penerima)
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(
      isPiutang ? 14 : 234,
      isPiutang ? 165 : 88,
      isPiutang ? 233 : 12,
    );
    pdf.text(
      `${isPiutang ? "CABANG PENERIMA (KONSUMEN): " : ""}${group.title.toUpperCase()}`,
      40,
      currentY,
    );

    pdf.setFontSize(8.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(70);
    if (group.bankInfo && !isPiutang) {
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
      `Rp ${(d.paidAmount || 0).toLocaleString("id-ID")}`,
      `Rp ${(d.totalAmount || 0).toLocaleString("id-ID")}`,
    ]);

    autoTable(pdf, {
      head: [
        [
          "TANGGAL",
          isPiutang ? "NO. SURAT JALAN" : "NO. INVOICE",
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
        fillColor: isPiutang ? [14, 165, 233] : [51, 65, 85],
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
      `TOTAL ${isPiutang ? "TAGIHAN " : "PENGAJUAN "}${group.title.toUpperCase()} : Rp ${(group.total || 0).toLocaleString("id-ID")}`,
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

  pdf.save(
    `${isPiutang ? "Rekap_Piutang_Cabang" : "Rekap_Finance"}_${outletName}_${Date.now()}.pdf`,
  );
};

/**
 * 3. CETAK LAPORAN RINCIAN DETAIL PERIODE (UNTUK AUDIT & OPERASIONAL GUDANG)
 */
export const printDetailedPeriodPdf = (
  groupedDocs: Record<string, any>,
  dateStart: string,
  dateEnd: string,
  outletName: string = "SEMUA CABANG",
) => {
  const firstGroup = Object.values(groupedDocs)[0];
  const isPiutang = firstGroup?.docs?.[0]?.documentType === "PIUTANG";

  const pdf = new jsPDF("p", "pt", "a4");

  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text(
    isPiutang
      ? "LAPORAN RINCIAN PENGIRIMAN & DISTRIBUSI CABANG (AUDIT)"
      : "LAPORAN RINCIAN PENERIMAAN BARANG (OPERASIONAL & AUDIT)",
    40,
    40,
  );

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100);
  pdf.text(
    `${isPiutang ? "Gudang Pengirim" : "Cabang / Unit"} : ${outletName}`,
    40,
    58,
  );
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
    pdf.setTextColor(
      isPiutang ? 14 : 234,
      isPiutang ? 165 : 88,
      isPiutang ? 233 : 12,
    );
    pdf.text(
      `${isPiutang ? "CABANG TUJUAN (KONSUMEN): " : "VENDOR: "}${group.title.toUpperCase()}`,
      40,
      currentY,
    );

    if (group.bankInfo && !isPiutang) {
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
        `  ▶ ${isPiutang ? "Surat Jalan" : "Invoice"}: ${d.invoiceNumber} | Tgl: ${new Date(d.date).toLocaleDateString("id-ID")} | Total: Rp ${(d.totalAmount || 0).toLocaleString("id-ID")}`,
        40,
        currentY,
      );

      const itemRows = (d.items || []).map((it: any, idx: number) => [
        idx + 1,
        it.name || it.itemId,
        it.isExpense ? "JASA" : "BARANG",
        it.qty,
        `Rp ${(it.price || 0).toLocaleString("id-ID")}`,
        `Rp ${(it.subtotal || 0).toLocaleString("id-ID")}`,
      ]);

      autoTable(pdf, {
        head: [
          ["NO", "NAMA BARANG / JASA", "TIPE", "QTY", "HARGA", "SUBTOTAL"],
        ],
        body: itemRows,
        startY: currentY + 6,
        theme: "striped",
        headStyles: {
          fillColor: isPiutang ? [14, 165, 233] : [71, 85, 105],
          textColor: 255,
          fontSize: 7.5,
        },
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

  pdf.save(
    `${isPiutang ? "Rekap_Detail_Distribusi" : "Rekap_Detail_Operasional"}_${outletName}_${Date.now()}.pdf`,
  );
};
