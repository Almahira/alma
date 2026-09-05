// File: apps/client_unv/src/system-ui/maintenance/PhoneMaintenanceDashboard.tsx
import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Server,
  Zap,
  Activity,
  ArrowRight,
  Terminal,
  Clock,
  Trash2,
  RotateCcw,
} from "lucide-react";

export const PhoneMaintenanceDashboard: React.FC<{
  urgencyData: any;
  onRefresh: () => void;
  isRefreshing: boolean;
  onRetryQuarantine: (id: string) => Promise<void>;
  onPurgeQuarantine: (id: string) => Promise<void>;
}> = ({
  urgencyData,
  onRefresh,
  isRefreshing,
  onRetryQuarantine,
  onPurgeQuarantine,
}) => {
  const isHealthy = urgencyData?.systemStatus === "HEALTHY";
  const isCritical = urgencyData?.systemStatus === "CRITICAL";
  const alerts = urgencyData?.alerts || [];
  const recentQ = urgencyData?.recentQuarantined || [];

  const [operatingId, setOperatingId] = useState<string | null>(null);

  const handleRetry = async (id: string) => {
    setOperatingId(id);
    await onRetryQuarantine(id);
    setOperatingId(null);
  };

  const handlePurge = async (id: string) => {
    if (!window.confirm("Hapus event karantina ini secara permanen?")) return;
    setOperatingId(id);
    await onPurgeQuarantine(id);
    setOperatingId(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 pb-20 space-y-4">
      {/* HEADER TANGGAP DARURAT */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black shadow-lg ${
              isCritical
                ? "bg-rose-500 shadow-rose-500/40 text-white animate-pulse"
                : isHealthy
                  ? "bg-emerald-500 shadow-emerald-500/30 text-white"
                  : "bg-amber-500 shadow-amber-500/30 text-white"
            }`}
          >
            {isCritical ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <Server className="w-5 h-5" />
            )}
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wide uppercase">
              ALMA SENTRY
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              Mobile Emergency Guard
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing ? "animate-spin text-orange-500" : ""}`}
          />
        </button>
      </div>

      {/* STATUS UTAMA BESAR (SEKILAS PANDANG) */}
      <div
        className={`p-5 rounded-3xl border-2 flex items-center justify-between shadow-2xl transition-all ${
          isCritical
            ? "bg-rose-950/40 border-rose-500/80 shadow-rose-500/20"
            : isHealthy
              ? "bg-emerald-950/30 border-emerald-500/60 shadow-emerald-500/10"
              : "bg-amber-950/40 border-amber-500/80 shadow-amber-500/20"
        }`}
      >
        <div>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
            KONDISI SERVER
          </span>
          <div
            className={`text-2xl font-black tracking-tight mt-0.5 ${
              isCritical
                ? "text-rose-400 animate-pulse"
                : isHealthy
                  ? "text-emerald-400"
                  : "text-amber-400"
            }`}
          >
            {isCritical
              ? "ADA MASALAH KRITIS"
              : isHealthy
                ? "SEMUA AMAN (100%)"
                : "PERINGATAN"}
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
            Uptime: {Math.floor((urgencyData?.uptimeSeconds || 0) / 3600)} jam{" "}
            {Math.floor(((urgencyData?.uptimeSeconds || 0) % 3600) / 60)} menit
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 uppercase font-black block">
            Karantina
          </span>
          <span
            className={`text-3xl font-black font-mono ${
              urgencyData?.quarantineCount > 0
                ? "text-rose-400"
                : "text-emerald-400"
            }`}
          >
            {urgencyData?.quarantineCount ?? 0}
          </span>
        </div>
      </div>

      {/* DAFTAR ALARM KRITIS AKTIF */}
      <div className="space-y-2">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-orange-500" /> ALARM TERDETEKSI
          ({alerts.length})
        </span>

        {alerts.length === 0 ? (
          <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 text-center text-xs text-slate-400 font-medium flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Tidak ada alarm aktif saat ini.
          </div>
        ) : (
          alerts.map((al: any, idx: number) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                al.level === "CRITICAL"
                  ? "bg-rose-950/30 border-rose-500/40 text-rose-300"
                  : "bg-amber-950/30 border-amber-500/40 text-amber-300"
              }`}
            >
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black uppercase">{al.title}</div>
                <div className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                  {al.message}
                </div>
                <div className="text-[9px] opacity-60 font-mono mt-1">
                  {new Date(al.timestamp).toLocaleTimeString("id-ID")}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* PANEL AKSI CEPAT KARANTINA (JIKA ADA EVENT BENTROK) */}
      {recentQ.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> TINDAKAN CEPAT EVENT DLQ
          </span>
          {recentQ.map((q: any) => (
            <div
              key={q.id}
              className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-2 text-xs"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-black text-rose-400 block font-mono">
                    {q.type}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    AggID: {q.aggregateId}
                  </span>
                </div>
                <span className="text-[9px] text-slate-500 font-mono">
                  {new Date(q.quarantinedAt).toLocaleTimeString("id-ID")}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                {q.errorReason}
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => handlePurge(q.id)}
                  disabled={operatingId === q.id}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-[10px] font-black uppercase cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Buang
                </button>
                <button
                  onClick={() => handleRetry(q.id)}
                  disabled={operatingId === q.id}
                  className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase cursor-pointer flex items-center gap-1 shadow-md"
                >
                  <RotateCcw className="w-3 h-3" /> Coba Ulang
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
