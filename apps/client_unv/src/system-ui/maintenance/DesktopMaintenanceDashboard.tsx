// File: apps/client_unv/src/features/maintenance/DesktopMaintenanceDashboard.tsx
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
import { getApiUrl } from "../../../../../packages/core_unv/src/config/env";

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
    const confirmationMessage =
      "🚨 PERINGATAN BROADCAST RE-SYNC MASAL (NON-OPERASIONAL) 🚨\n\n" +
      "1. WAKTU EKSEKUSI:\n" +
      "Pastikan proses ini dilakukan pada WAKTU NON-OPERASIONAL (saat outlet/kasir sudah tutup).\n\n" +
      "2. DAMPAK PADA TABLET CABANG:\n" +
      "• Seluruh data lokal IndexedDB di 16 cabang akan DIBERSIHKAN TOTAL.\n" +
      "• Setiap tablet otomatis mengunduh SNAPSHOT FISIK TERBARU dari PostgreSQL (Data 1:1 identik).\n" +
      "• Seluruh user cabang akan otomatis di-LOGOUT ke Halaman Login Standar.\n\n" +
      "3. KEAMANAN PERANGKAT:\n" +
      "• Kredensial mesin, Device ID, dan Lisensi Ed25519 TETAP AMAN (Perangkat TIDAK AKAN terlempar ke Setup Wizard).\n\n" +
      "Lanjutkan penerbitan sinyal Broadcast Re-Sync sekarang?";

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setIsBroadcasting(true);
    try {
      const res = await fetch(
        getApiUrl("/api/system-health/broadcast-resync"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason:
              "Penyelarasan Masal Non-Operasional & Rehidrasi Snapshot Fisik 1:1",
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(
        "✅ SUKSES!\n" +
          data.message +
          "\n\nSinyal telah disiarkan ke seluruh cabang.",
      );
      onRefresh();
    } catch (err: any) {
      alert("❌ Gagal menerbitkan sinyal broadcast: " + err.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 font-sans overflow-hidden relative">
      {/* Background gradient overlay */}
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
            {isRefreshing ? "Refreshing..." : "Refresh Status"}
          </button>
        </div>
      </header>

      {/* DASHBOARD BODY */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 custom-scrollbar">
        {/* ROW 1: METRICS TOP CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: PostgreSQL */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg backdrop-blur-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-400" />
                PostgreSQL Primary
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                  dbInfo?.status === "CONNECTED"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse"
                }`}
              >
                {dbInfo?.status || "UNKNOWN"}
              </span>
            </div>
            <div className="my-3">
              <div className="text-2xl font-black text-white">
                {dbInfo?.latencyMs ?? 0}{" "}
                <span className="text-xs font-medium text-slate-400">
                  ms latency
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Sys Events:{" "}
                <strong className="text-slate-200">
                  {dbInfo?.totalSystemEvents ?? 0}
                </strong>{" "}
                | Tx Events:{" "}
                <strong className="text-slate-200">
                  {dbInfo?.totalTxEvents ?? 0}
                </strong>
              </p>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${dbInfo?.status === "CONNECTED" ? "bg-emerald-500" : "bg-rose-500"}`}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Card 2: NATS JetStream */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg backdrop-blur-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-cyan-400" />
                NATS JetStream (ERP_STREAM)
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                  natsInfo?.status === "CONNECTED"
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse"
                }`}
              >
                {natsInfo?.status || "UNKNOWN"}
              </span>
            </div>
            <div className="my-3">
              <div className="text-2xl font-black text-white">
                {natsInfo?.streamMessages ?? 0}{" "}
                <span className="text-xs font-medium text-slate-400">
                  queued msgs
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Realtime Event Distribution Bus
              </p>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${natsInfo?.status === "CONNECTED" ? "bg-cyan-500" : "bg-rose-500"}`}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Card 3: Quarantine DLQ */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg backdrop-blur-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Quarantine DLQ
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
                  qInfo?.totalQuarantined > 0
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {qInfo?.totalQuarantined > 0 ? "ALERT" : "CLEAR"}
              </span>
            </div>
            <div className="my-3">
              <div className="text-2xl font-black text-white">
                {qInfo?.totalQuarantined ?? 0}{" "}
                <span className="text-xs font-medium text-slate-400">
                  events stuck
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {qInfo?.totalQuarantined > 0
                  ? "Ada transaksi yang ditahan di karantina"
                  : "Semua event mengalir lancar"}
              </p>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${qInfo?.totalQuarantined > 0 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Card 4: Hardware & Edge POS Mesh */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg backdrop-blur-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-purple-400" />
                Edge Devices Mesh
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {overview?.devices?.active || 0} /{" "}
                {overview?.devices?.total || 0} ACTIVE
              </span>
            </div>
            <div className="my-3">
              <div className="text-2xl font-black text-white">
                {hwInfo?.heapUsedMb ?? 0}{" "}
                <span className="text-xs font-medium text-slate-400">
                  MB RAM Used
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Heap Total: {hwInfo?.heapTotalMb ?? 0}MB | RSS:{" "}
                {hwInfo?.rssMb ?? 0}MB
              </p>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500"
                style={{
                  width: `${Math.min(100, Math.round(((hwInfo?.heapUsedMb || 1) / (hwInfo?.heapTotalMb || 100)) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* ROW 2: EDGE DEVICE MESH REGISTRY */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Laptop className="w-4 h-4 text-orange-400" />
                Edge POS Mesh Devices (16 Cabang &amp; Perangkat Terdaftar)
              </h2>
              <p className="text-xs text-slate-400">
                Monitoring status koneksi real-time, telemetry, dan lisensi
                perangkat kasir
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDeviceFilter("ALL")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  deviceFilter === "ALL"
                    ? "bg-orange-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                All ({devices.length})
              </button>
              <button
                onClick={() => setDeviceFilter("ONLINE")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  deviceFilter === "ONLINE"
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Online ({devices.filter((d) => d.isOnline).length})
              </button>
              <button
                onClick={() => setDeviceFilter("OFFLINE")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  deviceFilter === "OFFLINE"
                    ? "bg-rose-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Offline ({devices.filter((d) => !d.isOnline).length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Device Name &amp; Model</th>
                  <th className="py-2.5 px-3">Branch Scope</th>
                  <th className="py-2.5 px-3">License Tier</th>
                  <th className="py-2.5 px-3">Network Status</th>
                  <th className="py-2.5 px-3">Last Seen</th>
                  <th className="py-2.5 px-3">Device State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filteredDevices.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          d.isOnline
                            ? "bg-emerald-400 animate-pulse"
                            : "bg-slate-600"
                        }`}
                      />
                      {d.deviceName || d.id}
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({d.deviceModel || "Browser"})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {d.outletId || d.regionId || "HEAD_OFFICE"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
                        {d.licenseTier || "STANDARD"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {d.isOnline ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Wifi className="w-3 h-3" /> ONLINE
                        </span>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-1">
                          <WifiOff className="w-3 h-3 text-rose-400" /> OFFLINE
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {d.minutesAgo !== undefined
                        ? `${d.minutesAgo} menit lalu`
                        : "-"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        {d.status || "ACTIVE"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredDevices.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-6 text-slate-500 italic"
                    >
                      Tidak ada perangkat yang sesuai filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ROW 3: QUARANTINE DLQ SECTION */}
        {quarantine.length > 0 && (
          <div className="bg-slate-900/80 border border-amber-900/40 rounded-2xl p-5 shadow-lg backdrop-blur-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
                  Quarantine Dead-Letter Queue ({quarantine.length} Events
                  Ditahan)
                </h2>
                <p className="text-xs text-slate-400">
                  Event yang tertahan karena kegagalan JSON atau crash sistem
                </p>
              </div>
              <button
                onClick={() => onPurgeQuarantine("", true)}
                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Purge All DLQ
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Event ID</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Aggregate ID</th>
                    <th className="py-2.5 px-3">Error Reason</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {quarantine.map((q) => (
                    <tr
                      key={q.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-slate-300 font-bold">
                        {q.id}
                      </td>
                      <td className="py-2.5 px-3 text-orange-400">{q.type}</td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {q.aggregateId}
                      </td>
                      <td className="py-2.5 px-3 text-rose-400">
                        {q.errorReason}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        <button
                          onClick={() => onRetryQuarantine(q.id)}
                          className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Retry Sync
                        </button>
                        <button
                          onClick={() => onPurgeQuarantine(q.id)}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Dismiss
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
