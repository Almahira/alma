import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  MailOpen,
  Link as LinkIcon,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { globalLedger } from "../../../../packages/core_unv/src/ledger/UniversalLedger";

export interface SyncLog {
  id: string;
  title: string;
  message: string;
  status: "SUCCESS" | "FAILED" | "WARNING";
  isRead: boolean;
  linkPath?: string;
  createdAt: number;
}

interface ActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityDrawer: React.FC<ActivityDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Subscribe ke RxDB secara reaktif
  useEffect(() => {
    let subscription: any;

    const initRealtimeLog = async () => {
      const rxdb = globalLedger.getRxDatabase();
      if (!rxdb || !rxdb.collections.sync_logs) return;

      subscription = rxdb.collections.sync_logs
        .find({ sort: [{ createdAt: "desc" }] })
        .$ // Observable aliran data real-time
        .subscribe((documents: any[]) => {
          setLogs(documents.map((doc) => doc.toJSON() as SyncLog));
        });
    };

    if (isOpen) {
      initRealtimeLog();
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [isOpen]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === logs.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(logs.map((l) => l.id)));
  };

  const handleDeleteSelected = async () => {
    const rxdb = globalLedger.getRxDatabase();
    if (!rxdb || !rxdb.collections.sync_logs) return;

    const ids = Array.from(selectedIds);
    // Hapus permanen dari database
    const docs = await rxdb.collections.sync_logs
      .find({ selector: { id: { $in: ids } } })
      .exec();
    for (const doc of docs) {
      await doc.remove();
    }
    setSelectedIds(new Set());
  };

  const toggleReadStatus = async (id: string, currentStatus: boolean) => {
    const rxdb = globalLedger.getRxDatabase();
    if (!rxdb || !rxdb.collections.sync_logs) return;

    const doc = await rxdb.collections.sync_logs.findOne(id).exec();
    if (doc) {
      await doc.patch({ isRead: !currentStatus }); // Update hanya field isRead
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "SUCCESS")
      return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (status === "WARNING")
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    return <XCircle className="w-5 h-5 text-rose-500" />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
          >
            <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-slate-700" />
                <h2 className="font-bold text-slate-800">
                  Aktivitas Sinkronisasi
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                {selectedIds.size > 0 && selectedIds.size === logs.length ? (
                  <CheckSquare className="w-4 h-4 text-orange-500" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                Pilih Semua
              </button>

              <AnimatePresence>
                {selectedIds.size > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-600 text-xs font-bold rounded-md hover:bg-rose-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus ({selectedIds.size})
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <MailOpen className="w-12 h-12 mb-3 opacity-20" />
                  <p className="font-semibold text-sm">Tidak ada aktivitas</p>
                </div>
              ) : (
                logs.map((log) => (
                  <motion.div
                    layout
                    key={log.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                      log.isRead
                        ? "bg-white border-slate-200 opacity-70"
                        : "bg-white border-orange-200 shadow-sm"
                    }`}
                  >
                    <button
                      onClick={() => toggleSelect(log.id)}
                      className="mt-1 shrink-0 text-slate-400 hover:text-orange-500 transition-colors"
                    >
                      {selectedIds.has(log.id) ? (
                        <CheckSquare className="w-4 h-4 text-orange-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="shrink-0 mt-0.5">
                      {getStatusIcon(log.status)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4
                          className={`text-sm font-bold truncate ${log.isRead ? "text-slate-700" : "text-slate-900"}`}
                        >
                          {log.title}
                        </h4>
                        <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {log.message}
                      </p>

                      <div className="flex items-center gap-3 mt-3">
                        <button
                          onClick={() => toggleReadStatus(log.id, log.isRead)}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-orange-500 transition-colors cursor-pointer"
                        >
                          {log.isRead ? (
                            <Mail className="w-3.5 h-3.5" />
                          ) : (
                            <MailOpen className="w-3.5 h-3.5" />
                          )}
                          {log.isRead ? "Tandai Belum Dibaca" : "Tandai Dibaca"}
                        </button>

                        {log.linkPath && (
                          <button
                            onClick={() => {
                              onClose();
                              navigate(log.linkPath!);
                            }}
                            className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                            Lihat Data
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
