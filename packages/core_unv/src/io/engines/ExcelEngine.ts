// File: packages/core_unv/src/io/engines/ExcelEngine.ts
import * as XLSX from "xlsx";
import * as fileSaver from "file-saver";
const saveAs = fileSaver.saveAs || (fileSaver as any).default || fileSaver;
import { ExcelTemplateSchema } from "../types";

export class ExcelEngine {
  /**
   * MENGUNDUH TEMPLATE KOSONG (EXPORT)
   */
  public static downloadTemplate(
    schema: ExcelTemplateSchema,
    filename: string,
  ): void {
    const wb = XLSX.utils.book_new();

    // 1. Buat Sheet PANDUAN (Jika ada catatan instruksi)
    if (schema.instructionNote) {
      const guideData = [
        ["PANDUAN PENGISIAN DATA " + schema.entityType],
        [],
        [schema.instructionNote],
        [],
        ["PERHATIAN: Jangan merubah nama kolom (Baris 1) pada sheet DATA."],
      ];
      const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
      XLSX.utils.book_append_sheet(wb, wsGuide, "PANDUAN");
    }

    // 2. Buat Sheet DATA
    const headers = schema.columns.map((c) => c.header);
    const examples = schema.columns.map((c) => c.example);

    const wsData = XLSX.utils.aoa_to_sheet([headers, examples]);

    // Konfigurasi Lebar Kolom
    wsData["!cols"] = schema.columns.map(() => ({ wch: 25 }));

    XLSX.utils.book_append_sheet(wb, wsData, "DATA");

    // 3. Simpan File
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    saveAs(blob, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
  }

  /**
   * EXPORT DATA (Mengekspor JSON Array menjadi Excel)
   */
  public static exportData(
    schema: ExcelTemplateSchema,
    data: any[],
    filename: string,
  ): void {
    const wb = XLSX.utils.book_new();

    // Map JSON ke Array berdasarkan urutan kolom skema
    const headers = schema.columns.map((c) => c.header);
    const rows = data.map((item) => {
      return schema.columns.map((col) => item[col.key] || "");
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = schema.columns.map(() => ({ wch: 25 }));

    XLSX.utils.book_append_sheet(wb, ws, schema.sheetName || "Data");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    saveAs(blob, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
  }

  /**
   * MENGIMPOR DAN MEMVALIDASI FILE EXCEL (IMPORT)
   */
  public static async parseFile(
    file: File,
    schema: ExcelTemplateSchema,
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });

          // Selalu ambil sheet bernama "DATA" (atau sheet pertama jika tidak ada panduan)
          const targetSheetName = wb.SheetNames.includes("DATA")
            ? "DATA"
            : wb.SheetNames[0];
          const ws = wb.Sheets[targetSheetName];

          // Convert ke JSON Matrix (Array of Arrays)
          const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

          if (rawData.length < 2) {
            throw new Error(
              "File kosong atau tidak memiliki baris data (hanya header).",
            );
          }

          const fileHeaders = rawData[0];
          const result: any[] = [];
          const errors: string[] = [];

          // Looping mulai dari baris ke-2 (Index 1) mengabaikan header (Index 0)
          for (let rowIndex = 1; rowIndex < rawData.length; rowIndex++) {
            const row = rawData[rowIndex];

            // Lewati baris contoh (Jika isinya sama persis dengan contoh di skema)
            const isExampleRow = schema.columns.every(
              (col, colIdx) => row[colIdx] === col.example,
            );
            if (isExampleRow) continue;

            // Lewati baris yang benar-benar kosong
            if (
              row.length === 0 ||
              row.every(
                (cell) => cell === undefined || cell === null || cell === "",
              )
            )
              continue;

            const rowData: any = {};

            // Map berdasarkan skema
            schema.columns.forEach((col, colIdx) => {
              // Cari index kolom aktual berdasarkan nama header
              const actualColIdx = fileHeaders.findIndex(
                (h: string) => h === col.header,
              );
              const cellValue =
                actualColIdx !== -1 ? row[actualColIdx] : undefined;

              if (
                col.required &&
                (cellValue === undefined || cellValue === "")
              ) {
                errors.push(
                  `Baris ${rowIndex + 1}: Kolom "${col.header}" wajib diisi.`,
                );
              }

              rowData[col.key] =
                cellValue !== undefined ? String(cellValue).trim() : "";
            });

            result.push(rowData);
          }

          if (errors.length > 0) {
            throw new Error("Validasi Gagal:\n" + errors.join("\n"));
          }

          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () =>
        reject(new Error("Gagal membaca file fisik Excel"));
      reader.readAsArrayBuffer(file);
    });
  }
}
