// File: packages/core_unv/src/io/types.ts

export interface ExcelColumnDef {
  header: string; // Nama kolom di baris 1 (Contoh: "NAMA VENDOR (WAJIB)")
  key: string; // Key JSON untuk hasil parse (Contoh: "name")
  example: string | number; // Contoh pengisian di baris 2
  required?: boolean; // Validasi wajib isi
  isText?: boolean; // Paksa format teks di Excel (agar angka seperti 0812 tidak hilang 0-nya)
}

export interface ExcelTemplateSchema {
  entityType: string;
  sheetName: string;
  columns: ExcelColumnDef[];
  instructionNote?: string;
}
