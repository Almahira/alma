// File: apps/client_unv/src/system-ui/DiagnostikDashboardSM.tsx
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
  Search,
  X,
} from "lucide-react";
import { globalLedger } from "../../../../packages/core_unv/src/ledger/UniversalLedger";
import { SystemLogDoc } from "../../../../packages/core_unv/src/ledger/schema";

export const DiagnostikDashboardSM: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"SYSTEM" | "DATA">("SYSTEM");
  const [logs, setLogs] = useState<SystemLogDoc[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<SystemLogDoc | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLogs = async () => {
    setIsRefreshing(true);
    try {
      const db = globalLedger.getRxDatabase();
      if (!db || !db.collections.system_logs) return;
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

  useEffect(() => {
    fetchLogs();
    setSelectedLog(null);
  }, [activeTab]);

  const clearAllLogs = async () => {
    if (!window.confirm("Hapus seluruh log diagnostik lokal ini?")) return;
    try {
      const db = globalLedger.getRxDatabase();
      if (!db || !db.collections.system_logs) return;
      const logsDocs = await db.collections.system_logs
        .find({ selector: { category: activeTab } })
        .exec();
      await db.collections.system_logs.bulkRemove(logsDocs.map((d) => d.primary));
      fetchLogs();
      setSelectedLog(null);
    } catch (error) {
      console.error("Gagal membersihkan log database:", error);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      log.message.toLowerCase().includes(term) ||
      (log.fileName && log.fileName.toLowerCase().includes(term)) ||
      (log.actorName && log.actorName.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono select-none overflow-hidden">
      {/* HEADER MOBILE */}
      <div className="p-3 bg-[#252526] border-b border-[#3c3c3c] shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-orange-500" />
            <div>
              <h1 className="text-xs font-bold text-white tracking-wider">
                CORE DIAGNOSTIK REGISTRY
              </h1>
              <span className="text-[9px] text-orange-400">
                Log Audit &amp; Event Trail
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchLogs}
              disabled={isRefreshing}
              className="p-1.5 bg-[#333333] hover:bg-[#444444] rounded text-white border border-[#444444]"
              title="Refresh Log"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-orange-400" : ""}`} />
            </button>
            <button
              onClick={clearAllLogs}
              className="p-1.5 bg-red-950/40 text-red-400 rounded border border-red-900/50"
              title="Bersihkan Log"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* TABS KATEGORI: SYSTEM vs DATA */}
        <div className="grid grid-cols-2 gap-1 bg-[#1e1e1e] p-1 rounded-xl border border-[#3c3c3c]">
          <button
            onClick={() => setActiveTab("SYSTEM")}
            className={`py-1.5 text-[10px] font-bold rounded flex items-center justify-center gap-1 transition ${
              activeTab === "SYSTEM"
                ? "bg-orange-500 text-white"
                : "text-[#858585]"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" /> SYSTEM LOGS
          </button>
          <button
            onClick={() => setActiveTab("DATA")}
            className={`py-1.5 text-[10px] font-bold rounded flex items-center justify-center gap-1 transition ${
              activeTab === "DATA"
                ? "bg-emerald-600 text-white"
                : "text-[#858585]"
            }`}
          >
            <Database className="w-3.5 h-3.5" /> DATA AUDIT
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#555555] absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Cari pesan log..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none placeholder-[#555555]"
          />
        </div>
      </div>

      {/* LIST DAFTAR LOG (CARD LIST MOBILE) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {filteredLogs.map((log) => {
          let levelColor = "text-blue-400 bg-blue-500/10 border-blue-500/20";
          if (log.level === "ERROR")
            levelColor = "text-red-400 bg-red-500/10 border-red-500/20";
          if (log.level === "WARN")
            levelColor = "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";

          return (
            <div
              key={log.id}
              onClick={() => setSelectedLog(log)}
              className="p-3 bg-[#252526] rounded-xl border border-[#333333] hover:border-orange-500/50 cursor-pointer space-y-1.5 active:scale-[0.99] transition"
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className={`px-1.5 py-0.2 rounded font-mono font-bold border ${levelColor}`}>
                  {log.level}
                </span>
                <span className="text-[#608b4e] font-mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <p className="text-xs font-semibold text-white line-clamp-2 leading-snug">
                {log.message}
              </p>

              {log.fileName && (
                <div className="text-[10px] text-[#858585] italic truncate">
                  {log.fileName.split("/").pop()}
                </div>
              )}
            </div>
          );
        })}

        {filteredLogs.length === 0 && (
          <div className="p-8 text-center text-[#555555] text-xs">
            -- Tidak ada catatan log terdeteksi --
          </div>
        )}
      </div>

      {/* MODAL DETAIL INSPECTOR LOG */}
      {selectedLog && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#252526] border border-[#3c3c3c] rounded-2xl w-full max-w-md p-4 space-y-3 text-xs overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b border-[#3c3c3c] pb-2">
              <span className="font-bold text-white uppercase flex items-center gap-1.5 text-xs">
                <ShieldAlert className="w-4 h-4 text-orange-500" /> Log Inspector
              </span>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar space-y-2 flex-1 pr-1">
              <div className="p-2 bg-[#1e1e1e] rounded-lg border border-[#3c3c3c]">
                <span className="text-[10px] text-[#858585] block">Waktu:</span>
                <span className="text-white font-mono">{new Date(selectedLog.timestamp).toLocaleString()}</span>
              </div>

              {activeTab === "SYSTEM" ? (
                <>
                  <div className="p-2 bg-[#1e1e1e] rounded-lg border border-[#3c3c3c]">
                    <span className="text-[10px] text-[#858585] block">Sumber File:</span>
                    <span className="text-[#ce9178] break-all font-mono text-[11px]">
                      {selectedLog.fileName || "Global Runtime Context"}
                    </span>
                  </div>

                  <div className="p-2 bg-[#1e1e1e] rounded-lg border border-[#3c3c3c]">
                    <span className="text-[10px] text-[#858585] block mb-1">Stack Trace:</span>
                    <pre className="text-[10px] text-red-300 leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono bg-[#0a0a0a] p-2 rounded max-h-48 border border-red-900/30">
                      {selectedLog.stackTrace || "No Stack Trace (Clean Exit)."}
                    </pre>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 bg-[#1e1e1e] rounded-lg border border-[#3c3c3c] space-y-1">
                    <span className="text-[10px] text-emerald-400 font-bold block">Lingkup Bisnis:</span>
                    <div className="text-[11px] space-y-0.5 font-mono">
                      <div>Holding: <span className="text-white">{selectedLog.companyId || "--"}</span></div>
                      <div>Region: <span className="text-white">{selectedLog.regionId || "--"}</span></div>
                      <div>Outlet: <span className="text-white">{selectedLog.outletId || "--"}</span></div>
                    </div>
                  </div>

                  <div className="p-2 bg-[#1e1e1e] rounded-lg border border-[#3c3c3c] space-y-1">
                    <span className="text-[10px] text-blue-400 font-bold block">Aktor:</span>
                    <div className="text-[11px] space-y-0.5 font-mono">
                      <div>Nama: <span className="text-orange-400 font-bold">{selectedLog.actorName || "SYSTEM"}</span></div>
                      <div>ID: <span className="text-white">{selectedLog.actorId || "--"}</span></div>
                      <div>Device: <span className="text-[#858585]">{selectedLog.deviceId || "UNKNOWN"}</span></div>
                    </div>
                  </div>

                  <div className="p-2 bg-[#1e1e1e] rounded-lg border border-[#3c3c3c]">
                    <span className="text-[10px] text-[#858585] block mb-1">Pesan Transaksi:</span>
                    <p className="text-emerald-400 font-semibold">{selectedLog.message}</p>
                  </div>
                </>
              )}
            </div>

            <div className="pt-2 border-t border-[#3c3c3c]">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full py-2 bg-[#333333] text-white font-bold text-xs rounded-lg"
              >
                TUTUP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
