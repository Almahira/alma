// File: packages/core_unv/src/io/config.ts

export const IO_CONFIG = {
  NETWORK: {
    REQUEST_TIMEOUT_MS: 120000, // 120 detik
    CONCURRENT_UPLOADS: 3, // 3 file sekaligus
  },
  LIMITS: {
    IMAGE: 5 * 1024 * 1024, // 5MB
    DOCUMENT: 20 * 1024 * 1024, // 20MB (PDF, DOCX)
    SPREADSHEET: 20 * 1024 * 1024, // 20MB (Excel, CSV)
    ARCHIVE: 100 * 1024 * 1024, // 100MB (ZIP)
    BACKUP: 200 * 1024 * 1024, // 200MB (Database Dump)
  },
  CACHE_NAMES: {
    SYSTEM: "ALMA-unv-system-cache-v1", // Wadah Permanen (Master Data)
    TRANSACTION: "ALMA-unv-tx-cache-v1", // Wadah Sementara (Dibersihkan per bulan)
  },
};

export function getFileTypeCategory(
  mimeType: string,
  fileName: string,
): keyof typeof IO_CONFIG.LIMITS {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (
    mimeType === "application/pdf" ||
    fileName.endsWith(".docx") ||
    fileName.endsWith(".doc")
  )
    return "DOCUMENT";
  if (
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".csv") ||
    fileName.endsWith(".xls")
  )
    return "SPREADSHEET";
  if (mimeType === "application/zip" || fileName.endsWith(".zip"))
    return "ARCHIVE";
  if (fileName.endsWith(".bak") || fileName.endsWith(".sql")) return "BACKUP";
  return "DOCUMENT"; // Default fallback
}
