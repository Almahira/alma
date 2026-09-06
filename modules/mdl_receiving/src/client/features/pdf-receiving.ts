// File: modules/mdl_receiving/src/client/features/pdf-receiving.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface InvoicePrintContext {
  doc: any;
  vendorName: string;
  locationName: string;
  companyName?: string;
  regionName?: string;
  regionAddress?: string;
  activeActorName?: string;
  activeActorPhone?: string;
  bankInfo?: {
    bankName?: string;
    bankAccount?: string;
    bankAccountName?: string;
  };
}

/**
 * 1. CETAK INVOICE DARI BARIS AKSI (ICON PRINT)
 * Menghasilkan tampilan Invoice elegan persis template HTML/CSS heksagon merah-hitam.
 */
export const printSingleInvoicePdf = (context: InvoicePrintContext) => {
  const {
    doc,
    vendorName,
    locationName,
    companyName = "ALMA ENTERPRISE",
    regionName = "JAWA BARAT",
    regionAddress = "Bandung, Jawa Barat",
    activeActorName = "Rendi Faizal",
    activeActorPhone = "0812-3456-7890",
    bankInfo,
  } = context;

  const isPiutang = doc.documentType === "PIUTANG";
  const items = doc.items || [];
  const formattedDate = new Date(doc.date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const totalAmountNum = Math.round(Number(doc.totalAmount || 0));

  // Render baris tabel HTML
  const itemsHtml = items
    .map((it: any) => {
      const price = Math.round(Number(it.price) || 0);
      const subtotal = Math.round(Number(it.subtotal || it.qty * price) || 0);
      return `
      <tr>
        <td style="text-align: left;">${it.name || it.itemId}${it.isExpense ? " [BIAYA]" : ""}</td>
        <td>Rp ${price.toLocaleString("id-ID")}</td>
        <td>${it.qty || 1}</td>
        <td>Rp ${subtotal.toLocaleString("id-ID")}</td>
      </tr>
    `;
    })
    .join("");

  const bankNameText = bankInfo?.bankName || "-";
  const bankAccountText = bankInfo?.bankAccount || "-";
  const bankOwnerText = bankInfo?.bankAccountName || "-";

  // HTML Template Sesuai Blueprint Rendi
  const fullHtml = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <title>Invoice - ${doc.invoiceNumber}</title>
    <style>
      :root {
        --primary: #e60012;
        --dark: #1a1a1a;
        --gray: #2b2b2b;
        --light-bg: #f8fafc;
        --text-color: #1e293b;
      }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        background: #e2e8f0;
        margin: 0;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .invoice-container {
        width: 210mm;
        min-height: 297mm;
        background: white;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        position: relative;
        overflow: hidden;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .bg-header-red {
        position: absolute;
        top: 0;
        left: 0;
        width: 35%;
        height: 160px;
        background: var(--primary);
        clip-path: polygon(0 0, 80% 0, 100% 50%, 80% 100%, 0 100%);
        z-index: 1;
      }
      .bg-header-dark {
        position: absolute;
        top: 40px;
        left: 24%;
        width: 12%;
        height: 80px;
        background: var(--gray);
        clip-path: polygon(0 0, 70% 0, 100% 50%, 70% 100%, 0 100%, 30% 50%);
        z-index: 3;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .bg-header-black {
        position: absolute;
        top: 40px;
        right: 0;
        width: 70%;
        height: 80px;
        background: var(--dark);
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-left: 90px;
        padding-right: 40px;
      }
      .company-branding { color: white; display: flex; flex-direction: column; }
      .company-name { font-size: 16px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
      .company-tagline { font-size: 9px; color: #cbd5e1; letter-spacing: 0.5px; margin-top: 2px; }
      .invoice-title { font-size: 28px; font-weight: 900; color: white; letter-spacing: 2px; }
      .bg-footer-black {
        position: absolute;
        bottom: 40px;
        right: 0;
        width: 100%;
        height: 60px;
        background: var(--dark);
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .bg-footer-dark {
        position: absolute;
        bottom: 40px;
        left: 0;
        width: 15%;
        height: 60px;
        background: var(--gray);
        clip-path: polygon(0 0, 100% 0, 60% 50%, 100% 100%, 0 100%);
        z-index: 2;
      }
      .bg-footer-red {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 35%;
        height: 120px;
        background: var(--primary);
        clip-path: polygon(20% 0, 100% 0, 100% 100%, 20% 100%, 0 50%);
        z-index: 2;
      }
      .thank-you { color: #f1f5f9; font-size: 11px; letter-spacing: 0.5px; font-weight: 500; z-index: 3; position: relative; }
      .content {
        position: absolute;
        top: 170px;
        left: 0;
        right: 0;
        bottom: 120px;
        padding: 0 40px;
        display: flex;
        flex-direction: column;
        z-index: 10;
      }
      .billing-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
      .billing-to h4 { margin: 0 0 6px 0; font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; }
      .billing-to h2 { margin: 0 0 4px 0; font-size: 18px; color: var(--primary); font-weight: 800; }
      .meta-table { width: 240px; border-collapse: collapse; font-size: 11px; }
      .meta-table td { padding: 5px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; }
      .meta-table td:last-child { text-align: right; color: var(--dark); font-weight: bold; }
      .invoice-table { width: 100%; border-collapse: collapse; font-size: 11px; text-align: center; margin-bottom: 15px; }
      .invoice-table th { background: var(--primary); color: white; padding: 10px; font-weight: bold; text-transform: uppercase; font-size: 10px; }
      .invoice-table td { padding: 9px 10px; color: #334155; border-bottom: 1px solid #f1f5f9; }
      .invoice-table tr:nth-child(even) td { background: var(--light-bg); }
      .totals-section { display: flex; justify-content: flex-end; margin-bottom: 20px; }
      .totals-box { width: 260px; }
      .totals-box table { width: 100%; border-collapse: collapse; font-size: 11px; }
      .totals-box td { padding: 6px 8px; text-align: right; }
      .totals-box td:first-child { text-align: left; font-weight: bold; color: #475569; }
      .net-total-row td { background: var(--primary); color: white; font-weight: 900; font-size: 13px; }
      .bottom-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; margin-bottom: 15px; }
      .left-info { display: flex; flex-direction: column; gap: 15px; width: 55%; }
      .payment-info h4, .deal-with-us h4 { margin: 0 0 6px 0; font-size: 11px; font-weight: bold; color: var(--dark); text-transform: uppercase; }
      .payment-info table { font-size: 10px; line-height: 1.6; color: #475569; }
      .payment-info td:first-child { width: 120px; font-weight: bold; color: #1e293b; }
      .deal-with-us p { margin: 3px 0; font-size: 10px; color: #475569; display: flex; align-items: center; gap: 6px; }
      .signature { text-align: center; font-size: 11px; color: var(--text-color); width: 180px; }
      .signature-name { font-family: "Brush Script MT", "Segoe Script", cursive; font-size: 24px; margin-bottom: 5px; border-bottom: 1px solid #1e293b; padding: 0 15px; display: inline-block; color: #0f172a; }
      @media print {
        body { margin: 0; padding: 0; background: white; }
        .invoice-container { box-shadow: none; border: none; }
        @page { margin: 0; size: A4; }
      }
    </style>
  </head>
  <body>
    <div class="invoice-container">
      <div class="bg-header-red"></div>
      <div class="bg-header-dark">
        <svg viewBox="0 0 40 40" width="34" height="34">
          <polygon points="20,2 38,12 38,28 20,38 2,28 2,12" fill="none" stroke="#e60012" stroke-width="2.5" />
          <polygon points="20,10 30,16 30,24 20,30 10,24 10,16" fill="none" stroke="#fff" stroke-width="2.5" />
        </svg>
      </div>
      <div class="bg-header-black">
        <div class="company-branding">
          <div class="company-name">${companyName}</div>
          <div class="company-tagline">${regionName}</div>
        </div>
        <div class="invoice-title">${isPiutang ? "INVOICE" : "INVOICE"}</div>
      </div>

      <div class="bg-footer-dark"></div>
      <div class="bg-footer-black">
        <div class="thank-you">Dokumen ini diterbitkan otomatis oleh Sistem ALMA.</div>
      </div>
      <div class="bg-footer-red"></div>

      <div class="content">
        <div class="billing-section">
          <div class="billing-to">
            <h4>${isPiutang ? "DITAGIHKAN KEPADA (OUTLET):" : "DITAGIHKAN OLEH (VENDOR):"}</h4>
            <h2>${vendorName.toUpperCase()}</h2>
            <p>${isPiutang ? "Unit Cabang Operasional" : "Penyedia / Vendor Mitra"}</p>
          </div>
          <div>
            <table class="meta-table">
              <tr>
                <td>No. Dokumen:</td>
                <td>${doc.invoiceNumber}</td>
              </tr>
              <tr>
                <td>Tanggal:</td>
                <td>${formattedDate}</td>
              </tr>
              <tr>
                <td>Jatuh Tempo:</td>
                <td>${doc.dueDate ? new Date(doc.dueDate).toLocaleDateString("id-ID") : "CASH / LUNAS"}</td>
              </tr>
            </table>
          </div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th style="text-align: left;">Nama Barang / Item</th>
              <th>Harga Unit</th>
              <th>Kuantitas</th>
              <th>Sub Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || '<tr><td colspan="4" style="padding: 20px;">Tidak ada rincian barang</td></tr>'}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-box">
            <table>
              <tr>
                <td>Sub Total:</td>
                <td>Rp ${totalAmountNum.toLocaleString("id-ID")}</td>
              </tr>
              <tr class="net-total-row">
                <td>Net Total:</td>
                <td>Rp ${totalAmountNum.toLocaleString("id-ID")}</td>
              </tr>
            </table>
          </div>
        </div>

        <div class="bottom-section">
          <div class="left-info">
            <div class="payment-info">
              <h4>Informasi Pembayaran:</h4>
              <table>
                <tr>
                  <td>No Rekening:</td>
                  <td>${bankAccountText}</td>
                </tr>
                <tr>
                  <td>Pemilik Rekening:</td>
                  <td>${bankOwnerText}</td>
                </tr>
                <tr>
                  <td>Bank:</td>
                  <td>${bankNameText}</td>
                </tr>
              </table>
            </div>
            <div class="deal-with-us">
              <h4>Hubungi Kami:</h4>
              <p>📍 ${regionAddress}</p>
              <p>📞 ${activeActorPhone}</p>
            </div>
          </div>

          <div class="signature">
            <div class="signature-name">${activeActorName}</div>
            <p>${isPiutang ? "Petugas Gudang Pengirim" : "Penanggung Jawab"}</p>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

  // Buka jendela cetak A4 langsung
  const printWindow = window.open("", "_blank", "width=900,height=1100");
  if (printWindow) {
    printWindow.document.write(fullHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  } else {
    // Fallback iframe jika popup browser terblokir
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const frameDoc = iframe.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(fullHtml);
      frameDoc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1500);
      }, 400);
    }
  }
};

/**
 * 2. CETAK LAPORAN REKAP PERIODE DARI HEADER (SURAT JALAN & REKAP FINANCE)
 */
export const printSummaryPeriodPdf = (
  groupedDocs: Record<string, any>,
  dateStart: string,
  dateEnd: string,
  outletName: string = "SEMUA CABANG",
) => {
  const firstGroup = Object.values(groupedDocs)[0];
  const isPiutang = firstGroup?.docs?.[0]?.documentType === "PIUTANG";

  const pdf = new jsPDF("p", "pt", "a4");

  // Header Laporan Modern
  pdf.setFillColor(
    isPiutang ? 14 : 234,
    isPiutang ? 165 : 88,
    isPiutang ? 233 : 12,
  );
  pdf.rect(0, 0, 595, 6, "F");

  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 41, 59);
  pdf.text(
    isPiutang
      ? "REKAPITULASI SURAT JALAN & DISTRIBUSI CABANG"
      : "PENGAJUAN PEMBAYARAN VENDOR (REKAP FINANCE)",
    40,
    45,
  );

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100);
  pdf.text(
    `${isPiutang ? "Gudang Pengirim" : "Unit / Lokasi"} : ${outletName}`,
    40,
    62,
  );
  pdf.text(
    `Periode : ${dateStart ? new Date(dateStart).toLocaleDateString("id-ID") : "Awal"} s/d ${dateEnd ? new Date(dateEnd).toLocaleDateString("id-ID") : "Sekarang"}`,
    40,
    75,
  );

  let currentY = 95;

  Object.entries(groupedDocs).forEach(([_, group]) => {
    if (group.docs.length === 0) return;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(
      isPiutang ? 14 : 234,
      isPiutang ? 165 : 88,
      isPiutang ? 233 : 12,
    );
    pdf.text(
      `${isPiutang ? "CABANG PENERIMA (KONSUMEN): " : "VENDOR: "}${group.title.toUpperCase()}`,
      40,
      currentY,
    );

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
          "DIBAYAR",
          "TOTAL",
        ],
      ],
      body: rows,
      startY: currentY + 12,
      theme: "grid",
      headStyles: {
        fillColor: isPiutang ? [14, 165, 233] : [30, 41, 59],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: { fontSize: 8, cellPadding: 4 },
    });

    currentY = (pdf as any).lastAutoTable.finalY + 15;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(15, 23, 42);
    pdf.text(
      `TOTAL ${group.title.toUpperCase()} : Rp ${(group.total || 0).toLocaleString("id-ID")}`,
      300,
      currentY,
    );
    currentY += 25;

    if (currentY > 750) {
      pdf.addPage();
      currentY = 45;
    }
  });

  pdf.save(
    `${isPiutang ? "Rekap_Surat_Jalan_Distribusi" : "Rekap_Finance"}_${Date.now()}.pdf`,
  );
};

/**
 * 3. CETAK LAPORAN RINCIAN DETAIL PERIODE DARI HEADER
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

  pdf.setFillColor(
    isPiutang ? 14 : 234,
    isPiutang ? 165 : 88,
    isPiutang ? 233 : 12,
  );
  pdf.rect(0, 0, 595, 6, "F");

  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(30, 41, 59);
  pdf.text(
    isPiutang
      ? "LAPORAN RINCIAN SURAT JALAN & PENGIRIMAN CABANG"
      : "LAPORAN RINCIAN PENERIMAAN BARANG & NOTA (AUDIT)",
    40,
    45,
  );

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100);
  pdf.text(
    `Unit : ${outletName} | Periode : ${dateStart || "Awal"} s/d ${dateEnd || "Sekarang"}`,
    40,
    62,
  );

  let currentY = 85;

  Object.entries(groupedDocs).forEach(([_, group]) => {
    if (group.docs.length === 0) return;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(
      isPiutang ? 14 : 234,
      isPiutang ? 165 : 88,
      isPiutang ? 233 : 12,
    );
    pdf.text(
      `${isPiutang ? "OUTLET PENERIMA: " : "VENDOR: "}${group.title.toUpperCase()}`,
      40,
      currentY,
    );
    currentY += 16;

    group.docs.forEach((d: any) => {
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 41, 59);
      pdf.text(
        `▶ Nota: ${d.invoiceNumber} | Tgl: ${new Date(d.date).toLocaleDateString("id-ID")} | Total: Rp ${(d.totalAmount || 0).toLocaleString("id-ID")}`,
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
        head: [["NO", "NAMA ITEM / JASA", "TIPE", "QTY", "HARGA", "SUBTOTAL"]],
        body: itemRows,
        startY: currentY + 6,
        theme: "striped",
        headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 7.5 },
        styles: { fontSize: 7.5, cellPadding: 3 },
      });

      currentY = (pdf as any).lastAutoTable.finalY + 14;

      if (currentY > 750) {
        pdf.addPage();
        currentY = 45;
      }
    });

    currentY += 10;
  });

  pdf.save(`Laporan_Detail_Receiving_${Date.now()}.pdf`);
};
