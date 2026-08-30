// File: apps/client_unv/src/system-ui/DiagnostikDashboard.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  Terminal,
  Database,
  ShieldAlert,
  RefreshCw,
  Trash2,
  FileCode,
  Clock,
  Building2,
  User,
} from "lucide-react";
import { globalLedger } from "../../../../packages/core_unv/src/ledger/UniversalLedger";
import { SystemLogDoc } from "../../../../packages/core_unv/src/ledger/schema";

export const DiagnostikDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"SYSTEM" | "DATA">("SYSTEM");
  const [logs, setLogs] = useState<SystemLogDoc[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<SystemLogDoc | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // 1. Muat Log secara Real-time dari RxDB Ledger Core
  const fetchLogs = async () => {
    setIsRefreshing(true);
    try {
      const db = globalLedger.getRxDatabase();
      if (!db || !db.collections.system_logs) return;

      // Ambil log berdasarkan tab kategori aktif, urutkan dari waktu terbaru
      const logsDocs = await db.collections.system_logs
        .find({
          selector: { category: activeTab },
          sort: [{ timestamp: "desc" }],
        })
        .exec();

      setLogs(logsDocs.map((doc) => doc.toJSON() as SystemLogDoc));
    } catch (error) {
      console.error("Gagal mengambil log dari core ledger:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Trigger ulang jika tab berganti
  useEffect(() => {
    fetchLogs();
    setSelectedLog(null);
  }, [activeTab]);

  // Fungsi hapus seluruh riwayat log lokal (Maintenance)
  const clearAllLogs = async () => {
    if (
      !window.confirm(
        "Apakah Anda yakin ingin menghapus seluruh log diagnostik lokal ini?",
      )
    )
      return;
    try {
      const db = globalLedger.getRxDatabase();
      if (!db || !db.collections.system_logs) return;

      const logsDocs = await db.collections.system_logs
        .find({ selector: { category: activeTab } })
        .exec();
      await db.collections.system_logs.bulkRemove(
        logsDocs.map((d) => d.primary),
      );
      fetchLogs();
      setSelectedLog(null);
    } catch (error) {
      console.error("Gagal membersihkan log database:", error);
    }
  };

  // Filter pencarian data di memori dashboard
  const filteredLogs = logs.filter((log) => {
    const matchSearch =
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.fileName &&
        log.fileName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.actorName &&
        log.actorName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchSearch;
  });

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-[#d4d4d4] font-mono select-none overflow-hidden">
      {/* HEADER UTAMA DASHBOARD */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-orange-500" />
          <h1 className="text-sm font-bold tracking-wider text-[#ffffff]">
            UNIVERSAL CORE LOG DIAGNOSTIK REGISTRY
          </h1>
          <span className="text-[10px] bg-[#333333] px-2 py-0.5 rounded border border-[#444444] text-orange-400 font-bold">
            PORTAL INTEL: 3010
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-[#333333] hover:bg-[#444444] rounded border border-[#444444] active:scale-95 transition-all text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            REFRESH
          </button>
          <button
            onClick={clearAllLogs}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-red-950/40 hover:bg-red-900/40 text-red-400 rounded border border-red-900/50 active:scale-95 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            CLEAR LOG
          </button>
        </div>
      </header>

      {/* SUB-HEADER / TAB KATEGORI SEPARASI USER */}
      <div className="flex items-center justify-between px-4 bg-[#2d2d2d] border-b border-[#3c3c3c] shrink-0">
        <div className="flex">
          <button
            onClick={() => setActiveTab("SYSTEM")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === "SYSTEM"
                ? "border-orange-500 bg-[#1e1e1e] text-white"
                : "border-transparent text-[#858585] hover:text-[#d4d4d4]"
            }`}
          >
            <FileCode className="w-4 h-4 text-blue-400" />
            SYSTEM INFRASTRUCTURE LOG (IT MANAGER)
          </button>
          <button
            onClick={() => setActiveTab("DATA")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === "DATA"
                ? "border-orange-500 bg-[#1e1e1e] text-white"
                : "border-transparent text-[#858585] hover:text-[#d4d4d4]"
            }`}
          >
            <Database className="w-4 h-4 text-emerald-400" />
            BUSINESS AUDIT DATA TRAIL (OWNER SYSTEM)
          </button>
        </div>

        {/* INPUT FILTER DATA CEPAT */}
        <div className="px-2 py-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded flex items-center w-75">
          <input
            type="text"
            placeholder="Ketik filter kata kunci..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs text-[#d4d4d4] placeholder-[#555555] font-mono"
          />
        </div>
      </div>

      {/* CONTAINER DUA PANEL (SPLIT SCREEN VIEW) */}
      <div className="flex flex-1 overflow-hidden">
        {/* PANEL KIRI: DAFTAR DATA LOG */}
        <div className="w-7/12 border-r border-[#3c3c3c] overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-[#555555] text-xs">
              -- Tidak ada baris log pencatatan terdeteksi --
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#252526] text-[#858585] border-b border-[#3c3c3c] sticky top-0">
                  <th className="p-2 font-bold w-35">TIMESTAMP</th>
                  <th className="p-2 font-bold w-20">LEVEL</th>
                  <th className="p-2 font-bold">DESKRIPSI LOG / INFORMASI</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  let levelColor = "text-blue-400";
                  if (log.level === "ERROR")
                    levelColor = "text-red-400 font-black animate-pulse";
                  if (log.level === "WARN")
                    levelColor = "text-yellow-500 font-bold";

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`border-b border-[#2d2d2d] cursor-pointer hover:bg-[#2a2d2e] transition-colors ${
                        isSelected ? "bg-[#37373d] text-white" : ""
                      }`}
                    >
                      <td className="p-2 text-[#608b4e] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td
                        className={`p-2 font-mono tracking-wider ${levelColor}`}
                      >
                        [{log.level}]
                      </td>
                      <td className="p-2 max-w-0 truncate font-semibold">
                        {log.message}
                        {log.fileName && (
                          <span className="ml-2 text-[#858585] italic font-normal text-[11px]">
                            at {log.fileName.split("/").pop()}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <div ref={bottomRef} />
              </tbody>
            </table>
          )}
        </div>

        {/* PANEL KANAN: DETIL STACK TRACE & METADATA MULTI-TENANT */}
        <div className="w-5/12 bg-[#151515] overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
          {selectedLog ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-[#3c3c3c] pb-2">
                <ShieldAlert className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-bold tracking-widest text-[#ffffff] uppercase">
                  LOG INSPECTOR DETIL
                </span>
              </div>

              {/* TAMPILAN JIKA KATEGORI ADALAH LOG SISTEM / ERROR CODE */}
              {activeTab === "SYSTEM" && (
                <div className="flex flex-col gap-2">
                  <div className="bg-[#1e1e1e] p-3 rounded border border-[#3c3c3c]">
                    <div className="text-[11px] text-[#858585] mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> WAKTU EKSEKUSI:
                    </div>
                    <div className="text-xs font-bold text-[#9cdcfe]">
                      {new Date(selectedLog.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-[#1e1e1e] p-3 rounded border border-[#3c3c3c]">
                    <div className="text-[11px] text-[#858585] mb-1 flex items-center gap-1">
                      <FileCode className="w-3 h-3" /> FILE SUMBER ERROR:
                    </div>
                    <div className="text-xs font-bold text-[#ce9178] break-all">
                      {selectedLog.fileName || "N/A (Global Runtime Context)"}
                    </div>
                  </div>

                  <div className="bg-[#1e1e1e] p-3 rounded border border-[#3c3c3c] flex flex-col flex-1">
                    <div className="text-[11px] text-[#858585] mb-2">
                      STACK TRACE KODE (VSCODE STYLE):
                    </div>
                    <pre className="text-[11px] text-red-300 leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono bg-[#0a0a0a] p-2 rounded border border-red-900/30 max-h-75">
                      {selectedLog.stackTrace ||
                        "No Stack Trace Generated (Clean Exit)."}
                    </pre>
                  </div>
                </div>
              )}

              {/* TAMPILAN JIKA KATEGORI ADALAH LOG DATA / AUDIT TRAIL OWNER */}
              {activeTab === "DATA" && (
                <div className="flex flex-col gap-2">
                  <div className="bg-[#1e1e1e] p-3 rounded border border-[#3c3c3c] flex flex-col gap-1.5">
                    <div className="text-[11px] text-[#858585] flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-emerald-400" />{" "}
                      DATA CAKUPAN STRUKTUR BISNIS:
                    </div>
                    <div className="grid grid-cols-1 gap-1 text-xs border-t border-[#2d2d2d] pt-1.5 mt-1">
                      <div>
                        <span className="text-[#858585]">PERUSAHAAN :</span>{" "}
                        <span className="font-bold text-white">
                          {selectedLog.companyId || "--"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#858585]">WILAYAH/REG :</span>{" "}
                        <span className="font-bold text-white">
                          {selectedLog.regionId || "--"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#858585]">OUTLET/CABANG:</span>{" "}
                        <span className="font-bold text-white">
                          {selectedLog.outletId || "--"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1e1e1e] p-3 rounded border border-[#3c3c3c] flex flex-col gap-1.5">
                    <div className="text-[11px] text-[#858585] flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-blue-400" /> IDENTITAS
                      AKTOR PELAKSANA:
                    </div>
                    <div className="grid grid-cols-1 gap-1 text-xs border-t border-[#2d2d2d] pt-1.5 mt-1">
                      <div>
                        <span className="text-[#858585]">NAMA AKTOR :</span>{" "}
                        <span className="font-bold text-orange-400">
                          {selectedLog.actorName || "SYSTEM PROCESS"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#858585]">ID AKTOR :</span>{" "}
                        <span className="font-mono text-white">
                          {selectedLog.actorId || "--"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#858585]">ID PERANGKAT:</span>{" "}
                        <span className="font-mono text-xs text-[#858585]">
                          {selectedLog.deviceId || "UNKNOWN"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1e1e1e] p-3 rounded border border-[#3c3c3c]">
                    <div className="text-[11px] text-[#858585] mb-1">
                      PESAN/AKTIVITAS BISNIS BERHASIL:
                    </div>
                    <p className="text-xs text-emerald-400 font-bold leading-relaxed">
                      {selectedLog.message}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-[#555555] text-xs">
              Pilih salah satu baris log di sisi kiri untuk melakukan inspeksi
              detil metadata.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
