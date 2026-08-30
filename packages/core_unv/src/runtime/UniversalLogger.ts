// File: packages/core_unv/src/runtime/UniversalLogger.ts
import { globalLedger } from "../ledger/UniversalLedger";
import { ulid } from "ulidx";

interface LogContext {
  companyId?: string;
  regionId?: string;
  outletId?: string;
  actorId?: string;
  actorName?: string;
}

export class UniversalLogger {
  private static currentContext: LogContext = {};

  /**
   * Set konteks global saat user login atau berganti outlet/perusahaan
   */
  public static setContext(context: LogContext) {
    this.currentContext = { ...this.currentContext, ...context };
  }

  /**
   * Menangkap log kategori ERROR (Sistem / Kode) beserta lokasi file
   */
  public static error(message: string, errorObj?: any) {
    let fileName = "Unknown";
    let stackTrace = "";

    if (errorObj instanceof Error) {
      stackTrace = errorObj.stack || "";
      // Ekstrak nama file dari stack trace secara sederhana
      const stackLines = stackTrace.split("\n");
      if (stackLines.length > 1) {
        fileName = stackLines[1].trim();
      }
    }

    this.writeLog("ERROR", "SYSTEM", message, { fileName, stackTrace });
  }

  /**
   * Menangkap log kategori DATA (Aktivitas Modul / Audit Trail)
   */
  public static audit(message: string, bizContext?: LogContext) {
    const mergedContext = { ...this.currentContext, ...bizContext };
    this.writeLog("INFO", "DATA", message, {}, mergedContext);
  }

  public static info(message: string) {
    this.writeLog("INFO", "SYSTEM", message);
  }

  public static warn(message: string) {
    this.writeLog("WARN", "SYSTEM", message);
  }

  private static async writeLog(
    level: "DEBUG" | "INFO" | "WARN" | "ERROR",
    category: "SYSTEM" | "DATA",
    message: string,
    sysMeta: { fileName?: string; stackTrace?: string } = {},
    bizMeta: LogContext = this.currentContext,
  ) {
    try {
      const db = globalLedger.getRxDatabase();
      if (!db || !db.collections.system_logs) {
        // Fallback jika database belum siap
        console.log(`[${level}][${category}] ${message}`);
        return;
      }

      const deviceId = localStorage.getItem("__unv_nodeId") || "UNKNOWN";

      await db.collections.system_logs.insert({
        id: `LOG_${ulid()}`,
        level,
        category,
        message,
        timestamp: Date.now(),
        deviceId,
        fileName: sysMeta.fileName,
        stackTrace: sysMeta.stackTrace,
        companyId: bizMeta.companyId,
        regionId: bizMeta.regionId,
        outletId: bizMeta.outletId,
        actorId: bizMeta.actorId,
        actorName: bizMeta.actorName,
      });

      // Tetap munculkan di console untuk kebutuhan development local
      if (level === "ERROR") {
        console.error(`[SYSTEM LOG ERROR] ${message}`, sysMeta.stackTrace);
      }
    } catch (err) {
      console.error("Gagal menulis log ke Universal Ledger:", err);
    }
  }
}
