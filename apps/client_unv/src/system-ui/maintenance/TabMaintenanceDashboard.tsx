// File: apps/client_unv/src/system-ui/maintenance/TabMaintenanceDashboard.tsx
import React, { useState } from "react";
import {
  Server,
  Database,
  Radio,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Cpu,
  Clock,
  Laptop,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

export const TabMaintenanceDashboard: React.FC<{
  overview: any;
  devices: any[];
  quarantine: any[];
  onRefresh: () => void;
  isRefreshing: boolean;
  onRetryQuarantine: (id: string) => Promise<void>;
  onPurgeQuarantine: (id: string, purgeAll?: boolean) => Promise<void>;
}> = ({
  overview,
  devices,
  quarantine,
  onRefresh,
  isRefreshing,
  onRetryQuarantine,
  onPurgeQuarantine,
}) => {
  const [activeTab, setActiveTab] = useState<
    "STATUS" | "QUARANTINE" | "DEVICES"
  >("STATUS");
  const [operatingId, setOperatingId] = useState<string | null>(null);

  const dbInfo = overview?.services?.database;
  const natsInfo = overview?.services?.nats;
  const qInfo = overview?.services?.quarantine;
  const hwInfo = overview?.hardware;

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 font-sans p-5 overflow-hidden">
      {/* HEADER TABLET */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-orange-500/20">
            Z
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white uppercase">
              ALMA SYSTEM MISSION CONTROL (TABLET)
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Monitoring Real-Time Infrastruktur &amp; Mesin
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setActiveTab("STATUS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition cursor-pointer ${
                activeTab === "STATUS"
                  ? "bg-orange-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Layanan &amp; Mesin
            </button>
            <button
              onClick={() => setActiveTab("QUARANTINE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "QUARANTINE"
                  ? "bg-orange-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              DLQ ({quarantine.length})
              {quarantine.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("DEVICES")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition cursor-pointer ${
                activeTab === "DEVICES"
                  ? "bg-orange-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Device ({devices.length})
            </button>
          </div>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin text-orange-500" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* KONTEN TABEL */}
      <div className="flex-1 overflow-y-auto pt-4 custom-scrollbar">
        {activeTab === "STATUS" && (
          <div className="space-y-4">
            {/* 4 KARTU STATS UTAMA */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                  <span>Database</span>
                  <Database className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-black font-mono text-emerald-400">
                  {dbInfo?.status || "OK"}
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  Latency: {dbInfo?.latencyMs || 0}ms
                </span>
              </div>
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                  <span>NATS Stream</span>
                  <Radio className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-xl font-black font-mono text-blue-400">
                  {natsInfo?.status || "OK"}
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {natsInfo?.streamMessages || 0} msgs
                </span>
              </div>
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                  <span>Karantina (DLQ)</span>
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                </div>
                <div
                  className={`text-xl font-black font-mono ${qInfo?.totalQuarantined ? "text-rose-400" : "text-emerald-400"}`}
                >
                  {qInfo?.totalQuarantined ?? 0}
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  Tabrakan Data
                </span>
              </div>
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
                  <span>RAM Heap</span>
                  <Cpu className="w-4 h-4 text-orange-400" />
                </div>
                <div className="text-xl font-black font-mono text-orange-400">
                  {hwInfo?.heapUsedMb || 0} MB
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  Total: {hwInfo?.heapTotalMb || 0} MB
                </span>
              </div>
            </div>

            {/* TOTAL EVENT DAN RINGKASAN */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3">
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-300">
                  Volume Jurnal Peristiwa
                </h3>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400">
                      System Master Data Events:
                    </span>
                    <span className="font-black text-white">
                      {dbInfo?.totalSystemEvents?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400">
                      Transaction Journal Events:
                    </span>
                    <span className="font-black text-orange-400">
                      {dbInfo?.totalTxEvents?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-3">
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-300">
                  Ringkasan Perangkat
                </h3>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400">
                      Mesin Kasir Online (Real-time):
                    </span>
                    <span className="font-black text-emerald-400">
                      {overview?.devices?.active || 0}
                    </span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400">
                      Mesin Kasir Offline (Tutup/Putus):
                    </span>
                    <span className="font-black text-slate-400">
                      {overview?.devices?.offline || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "QUARANTINE" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2">
              <span className="text-xs font-bold text-slate-400">
                Daftar Event yang Gagal Merge / Rusak
              </span>
              {quarantine.length > 0 && (
                <button
                  onClick={() => onPurgeQuarantine("", true)}
                  className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold hover:bg-rose-500/20 cursor-pointer"
                >
                  Bersihkan Semua DLQ
                </button>
              )}
            </div>
            {quarantine.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs italic bg-slate-900/40 rounded-2xl border border-slate-800">
                Bersih! Tidak ada antrean karantina saat ini.
              </div>
            ) : (
              quarantine.map((q) => (
                <div
                  key={q.id}
                  className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-black text-sm text-rose-400 font-mono">
                        {q.type}
                      </span>
                      <span className="text-xs text-slate-400 font-mono block">
                        Aggregate ID: {q.aggregateId}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      {new Date(q.quarantinedAt).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl text-xs font-mono text-slate-300 border border-slate-800">
                    {q.errorReason}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => onPurgeQuarantine(q.id)}
                      disabled={operatingId === q.id}
                      className="px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl text-xs font-black uppercase cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                    <button
                      onClick={() => onRetryQuarantine(q.id)}
                      disabled={operatingId === q.id}
                      className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase cursor-pointer flex items-center gap-1.5 shadow-md"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Coba Ulang (Retry)
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "DEVICES" && (
          <div className="grid grid-cols-2 gap-3">
            {devices.map((d) => (
              <div
                key={d.id}
                className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-start gap-3"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    d.isOnline
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  <Laptop className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white truncate">
                      {d.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                        d.isOnline
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {d.isOnline ? "ONLINE" : "OFFLINE"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                    ID: {d.id}
                  </span>
                  {!d.isOnline && (
                    <span className="text-[10px] text-rose-400 font-medium block mt-1 leading-snug">
                      ⚠️ {d.offlineReason}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
