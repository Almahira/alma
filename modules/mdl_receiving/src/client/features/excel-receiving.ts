// File: modules/mdl_receiving/src/client/features/excel-receiving.ts
import * as XLSX from "xlsx";
import * as fileSaver from "file-saver";

const saveAs =
  (fileSaver as any).saveAs || (fileSaver as any).default || fileSaver;

/**
 * EXPORT EXCEL BERSTRUKTUR DETAIL (PER OUTLET / VENDOR & PER TANGGAL)
 * Sesuai format permintaan:
 * Nama Outlet / Vendor : [Nama]
 * Tanggal : [Tanggal 1]
 * | NO | NAMA BARANG / JASA | QTY | HARGA | SUB TOTAL |
 */
export const exportDetailedExcelReceiving = (
  groupedDocs: Record<string, any>,
  locationName: string = "CABANG",
) => {
  const wb = XLSX.utils.book_new();
  const aoaData: any[][] = [];

  // 1. Header Judul Laporan
  aoaData.push(["LAPORAN DETAIL RINCIAN PENERIMAAN & BELANJA"]);
  aoaData.push([
    `UNIT / LOKASI: ${locationName.toUpperCase()} | TANGGAL CETAK: ${new Date().toLocaleDateString("id-ID")}`,
  ]);
  aoaData.push([]); // Baris kosong

  let grandTotalSemua = 0;

  // 2. Iterasi per Grup (Vendor atau Outlet)
  Object.entries(groupedDocs).forEach(([_, group]) => {
    if (!group.docs || group.docs.length === 0) return;

    const isPiutang = group.docs[0]?.documentType === "PIUTANG";

    // Baris Nama Outlet / Vendor
    aoaData.push([
      `${isPiutang ? "NAMA OUTLET PENERIMA" : "NAMA VENDOR / PENYEDIA"}: ${group.title.toUpperCase()}`,
    ]);
    if (group.bankInfo && !isPiutang) {
      aoaData.push([
        `Info Rekening: ${group.bankInfo.bankName || "-"} - ${group.bankInfo.bankAccount || "-"} (a.n ${group.bankInfo.bankAccountName || "-"})`,
      ]);
    }
    aoaData.push([]);

    // 3. Kelompokkan dokumen berdasarkan tanggal di dalam grup ini
    const dateMap: Record<string, any[]> = {};
    group.docs.forEach((d: any) => {
      const dateKey = new Date(d.date).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      if (!dateMap[dateKey]) dateMap[dateKey] = [];
      dateMap[dateKey].push(d);
    });

    // 4. Iterasi per Tanggal
    Object.entries(dateMap).forEach(([dateStr, docsOnDate]) => {
      aoaData.push([`Tanggal: ${dateStr}`]);

      // Header Kolom Tabel Rincian Barang
      aoaData.push([
        "NO",
        "NO. NOTA / SURAT JALAN",
        "NAMA BARANG / JASA",
        "QTY",
        "HARGA (RP)",
        "SUB TOTAL (RP)",
      ]);

      let totalPerTanggal = 0;
      let rowNo = 1;

      docsOnDate.forEach((doc: any) => {
        const items = doc.items || [];
        if (items.length === 0) {
          aoaData.push();
          totalPerTanggal += doc.totalAmount;
        } else {
          items.forEach((it: any) => {
            const itemPrice = Math.round(Number(it.price) || 0);
            const itemSubtotal = Math.round(
              Number(it.subtotal || it.qty * itemPrice) || 0,
            );

            aoaData.push([
              rowNo++,
              doc.invoiceNumber,
              it.name || it.itemId,
              it.qty || 1,
              itemPrice,
              itemSubtotal,
            ]);
            totalPerTanggal += itemSubtotal;
          });
        }
      });

      // Baris Subtotal per Tanggal
      aoaData.push(["", "", "", "", `TOTAL TGL ${dateStr}:`, totalPerTanggal]);
      aoaData.push([]); // Baris pemisah antar tanggal
      grandTotalSemua += totalPerTanggal;
    });

    aoaData.push([
      "=========================================================================",
    ]);
    aoaData.push([]);
  });

  // 5. Total Akhir Keseluruhan
  aoaData.push(["", "", "", "", "GRAND TOTAL KESELURUHAN:", grandTotalSemua]);

  // Buat Worksheet & Atur Lebar Kolom
  const ws = XLSX.utils.aoa_to_sheet(aoaData);
  ws["!cols"] = [
    { wch: 6 }, // NO
    { wch: 24 }, // NO NOTA
    { wch: 35 }, // NAMA BARANG
    { wch: 12 }, // QTY
    { wch: 18 }, // HARGA
    { wch: 22 }, // SUB TOTAL
  ];

  XLSX.utils.book_append_sheet(wb, ws, "DETAIL_PENERIMAAN");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  saveAs(blob, `Rincian_Detail_Receiving_${Date.now()}.xlsx`);
};

export const exportExcelReceiving = exportDetailedExcelReceiving;
