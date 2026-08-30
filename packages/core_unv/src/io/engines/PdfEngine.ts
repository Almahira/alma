// File: packages/core_unv/src/io/engines/PdfEngine.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfTableConfig {
  title: string;
  subtitle?: string;
  filename: string;
  headers: string[];
  rows: any[][];
}

export class PdfEngine {
  public static exportTable(config: PdfTableConfig): void {
    const doc = new jsPDF("p", "pt", "a4");

    // Header Laporan
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(config.title, 40, 40);

    let startY = 50;

    if (config.subtitle) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(config.subtitle, 40, 55);
      startY = 70;
    }

    // Render Tabel
    autoTable(doc, {
      head: [config.headers],
      body: config.rows,
      startY: startY,
      theme: "striped",
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [249, 115, 22],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    const finalFilename = config.filename.endsWith(".pdf")
      ? config.filename
      : `${config.filename}.pdf`;
    doc.save(finalFilename);
  }
}
