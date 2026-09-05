// File: apps/client_unv/src/system-ui/maintenance/DesktopMaintenanceDashboard.tsx
import React, { useState } from "react";
import {
  Server,
  Database,
  Radio,
  Cpu,
  Clock,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Trash2,
  RotateCcw,
  Laptop,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Eye,
  Activity,
  Layers,
  Check,
  Zap,
  Wifi,
  WifiOff,
  Signal,
  Gauge,
  HardDrive,
} from "lucide-react";

export const DesktopMaintenanceDashboard: React.FC<{
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
  const [inspectEvent, setInspectEvent] = useState<any | null>(null);
  const [deviceFilter, setDeviceFilter] = useState<
    "ALL" | "ONLINE" | "OFFLINE"
  >("ALL");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const dbInfo = overview?.services?.database;
  const natsInfo = overview?.services?.nats;
  const qInfo = overview?.services?.quarantine;
  const hwInfo = overview?.hardware;

  const filteredDevices = devices.filter((d) => {
    if (deviceFilter === "ONLINE") return d.isOnline;
    if (deviceFilter === "OFFLINE") return !d.isOnline;
    return true;
  });

  const handleBroadcastResync = async () => {
    if (
      !window.confirm(
        "Kirim sinyal penyelarasan data (OTA) ke seluruh perangkat kasir/cabang yang sedang online?",
      )
    ) {
      return;
    }
    setIsBroadcasting(true);
    try {
      const serverUrl =
        localStorage.getItem("__unv_serverUrl") || "https://api.almazain.my.id";
      const res = await fetch(
        `${serverUrl.replace(/\/+$/, "")}/api/system-health/broadcast-resync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Penyelarasan Skema Desimal & Update Sistem",
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("Sukses! " + data.message);
    } catch (err: any) {
      alert("Gagal mengirim sinyal: " + err.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden relative">
      {/* Subtle background gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.08),transparent_70%),radial-gradient(ellipse_at_bottom_left,rgba(59,130,246,0.05),transparent_70%)] pointer-events-none" />

      {/* HEADER COCKPIT */}
      <header className="h-16 px-6 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800/80 flex items-center justify-between shrink-0 relative z-10 shadow-lg shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-orange-500 to-amber-500 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-orange-500/30 ring-1 ring-orange-400/30">
            Z
          </div>
          <div>
            <h1 className="text-base font-black text-white tracking-wide uppercase flex items-center gap-2">
              ALMA ENTERPRISE SRE MISSION CONTROL
              <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-semibold">
              Live Observability Cockpit Debian 12 Cluster &amp; Edge POS Mesh
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono shadow-inner">
            <Clock className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-slate-400">Server Uptime:</span>
            <span className="font-bold text-white">
              {Math.floor((hwInfo?.uptimeSeconds || 0) / 3600)}j{" "}
              {Math.floor(((hwInfo?.uptimeSeconds || 0) % 3600) / 60)}m
            </span>
          </div>

          {/* TOMBOL BROADCAST OTA RESYNC */}
          <button
            onClick={handleBroadcastResync}
            disabled={isBroadcasting}
            className="px-4 py-2 bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-orange-500/30 active:scale-95"
            title="Tembakkan perintah sinkronisasi otomatis ke seluruh tablet kasir secara bersamaan"
          >
            <Radio
              className={`w-3.5 h-3.5 ${isBroadcasting ? "animate-pulse" : ""}`}
            />
            {isBroadcasting ? "Mengirim Sinyal..." : "Broadcast Re-Sync Cabang"}
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 cursor-pointer shadow-md border border-slate-700/50 hover:border-slate-600 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-orange-400" : ""}`}
            />
            Refresh Status
          </button>
        </div>
      </header>

      {/* TOP STATS BAR */}
      <div className="p-6 pb-3 grid grid-cols-5 gap-4 shrink-0 relative z-10">
        {/* PostgreSQL */}
        <div className="p-4 bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors shadow-lg shadow-black/10 group">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1">
            <span>PostgreSQL DB</span>
            <Database className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg font-black font-mono text-emerald-400">
            {dbInfo?.status || "ONLINE"}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Ping: {dbInfo?.latencyMs || 0}ms | Sys:{" "}
            {dbInfo?.totalSystemEvents || 0} | Tx: {dbInfo?.totalTxEvents || 0}
          </div>
        </div>

        {/* NATS JetStream */}
        <div className="p-4 bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors shadow-lg shadow-black/10 group">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1">
            <span>NATS JetStream</span>
            <Radio className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg font-black font-mono text-blue-400">
            {natsInfo?.status || "ONLINE"}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Messages: {natsInfo?.streamMessages?.toLocaleString() || 0}
          </div>
        </div>

        {/* Quarantine DLQ */}
        <div className="p-4 bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors shadow-lg shadow-black/10 group">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1">
            <span>Karantina (DLQ)</span>
            <ShieldAlert className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div
            className={`text-lg font-black font-mono ${qInfo?.totalQuarantined ? "text-rose-400" : "text-emerald-400"}`}
          >
            {qInfo?.totalQuarantined || 0} Event
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            {qInfo?.totalQuarantined
              ? "⚠️ Butuh tindakan admin!"
              : "Semua transaksi tersinkron"}
          </div>
        </div>

        {/* RAM Usage */}
        <div className="p-4 bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors shadow-lg shadow-black/10 group">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1">
            <span>Heap / RSS Memory</span>
            <Gauge className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg font-black font-mono text-orange-400">
            {hwInfo?.heapUsedMb || 0} MB
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Total Heap: {hwInfo?.heapTotalMb || 0} MB | RSS:{" "}
            {hwInfo?.rssMb || 0} MB
          </div>
        </div>

        {/* Mesin Edge */}
        <div className="p-4 bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors shadow-lg shadow-black/10 group">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1">
            <span>Mesin Kasir Cabang</span>
            <Laptop className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-lg font-black font-mono text-white">
            <span className="text-emerald-400">
              {overview?.devices?.active || 0}
            </span>{" "}
            / {overview?.devices?.total || 0}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Offline: {overview?.devices?.offline || 0} unit
          </div>
        </div>
      </div>

      {/* 2 MAIN PANELS: QUARANTINE DLQ INSPECTOR + DEVICE RADAR */}
      <div className="flex-1 px-6 pb-6 grid grid-cols-12 gap-6 min-h-0 overflow-hidden relative z-10">
        {/* PANEL KIRI: DLQ QUARANTINE INSPECTOR (7 COLS) */}
        <div className="col-span-7 bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-800 flex flex-col min-h-0 overflow-hidden shadow-xl shadow-black/20">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0 bg-slate-900/50">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <h2 className="font-black text-xs uppercase tracking-wider text-white">
                INSPEKSI KARANTINA PERISTIWA (DLQ MONITOR)
              </h2>
            </div>
            {quarantine.length > 0 && (
              <button
                onClick={() => onPurgeQuarantine("", true)}
                className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold hover:bg-rose-500/20 cursor-pointer transition-colors"
              >
                Hapus Semua DLQ
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
            {quarantine.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500/40" />
                <p className="text-xs font-bold">
                  Luar biasa! Tidak ada antrean karantina data.
                </p>
                <p className="text-[10px] text-slate-600">
                  Seluruh transaksi 3-Way Merge berjalan sempurna.
                </p>
              </div>
            ) : (
              quarantine.map((q) => (
                <div
                  key={q.id}
                  className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-black text-xs text-rose-400 font-mono block">
                        {q.type}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        EventID: {q.id} | AggID: {q.aggregateId}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(q.quarantinedAt).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="p-2.5 bg-rose-950/20 border border-rose-900/40 rounded-xl text-xs text-rose-300 font-mono">
                    <strong className="text-rose-400">
                      Penyebab Karantina:
                    </strong>{" "}
                    {q.errorReason}
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <button
                      onClick={() => setInspectEvent(q)}
                      className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Lihat Isi JSON Payload
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onPurgeQuarantine(q.id)}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-black uppercase cursor-pointer flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Buang
                      </button>
                      <button
                        onClick={() => onRetryQuarantine(q.id)}
                        className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase cursor-pointer flex items-center gap-1 shadow-md hover:shadow-lg transition-all active:scale-95"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Retry Sync
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PANEL KANAN: RADAR PERANGKAT & OFFLINE DIAGNOSTICS (5 COLS) */}
        <div className="col-span-5 bg-slate-900/60 backdrop-blur-sm rounded-3xl border border-slate-800 flex flex-col min-h-0 overflow-hidden shadow-xl shadow-black/20">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0 bg-slate-900/50">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-teal-400" />
              <h2 className="font-black text-xs uppercase tracking-wider text-white">
                RADAR PERANGKAT ({devices.length})
              </h2>
            </div>
            <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[10px] font-bold">
              <button
                onClick={() => setDeviceFilter("ALL")}
                className={`px-2 py-1 rounded transition-colors ${deviceFilter === "ALL" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}
              >
                Semua
              </button>
              <button
                onClick={() => setDeviceFilter("ONLINE")}
                className={`px-2 py-1 rounded transition-colors ${deviceFilter === "ONLINE" ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:text-slate-200"}`}
              >
                Online
              </button>
              <button
                onClick={() => setDeviceFilter("OFFLINE")}
                className={`px-2 py-1 rounded transition-colors ${deviceFilter === "OFFLINE" ? "bg-rose-500/20 text-rose-400" : "text-slate-400 hover:text-slate-200"}`}
              >
                Offline
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2.5">
            {filteredDevices.map((d) => (
              <div
                key={d.id}
                className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-start gap-3 hover:border-slate-700 transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    d.isOnline
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {d.isOnline ? (
                    <Wifi className="w-4 h-4" />
                  ) : (
                    <WifiOff className="w-4 h-4" />
                  )}
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
                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                    Tier: {d.licenseTier}
                  </span>
                  {!d.isOnline && (
                    <div className="mt-1 text-[10px] text-rose-400 bg-rose-950/20 p-1.5 rounded-lg border border-rose-900/30">
                      <strong>Diagnosa:</strong> {d.offlineReason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL JSON PAYLOAD INSPECTOR */}
      {inspectEvent && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase font-mono">
                  Payload {inspectEvent.type}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {inspectEvent.id}
                </span>
              </div>
              <button
                onClick={() => setInspectEvent(null)}
                className="text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
            <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-emerald-400 font-mono text-xs max-h-96 overflow-y-auto custom-scrollbar">
              {JSON.stringify(inspectEvent.payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
