// File: apps/client_unv/src/shared-ui/UniversalToast.tsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { useToastStore, ToastType } from "./useToastStore";

export const UniversalToast: React.FC = () => {
  const { id, title, message, type, isOpen, closeToast } = useToastStore();

  // Pemetaan ikon dan warna berdasarkan tipe notifikasi
  const getConfig = (toastType: ToastType) => {
    switch (toastType) {
      case "SUCCESS":
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
          borderColor: "border-emerald-500/30",
          bgColor: "bg-emerald-500/10",
          titleColor: "text-emerald-500",
        };
      case "WARN":
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
          borderColor: "border-amber-500/30",
          bgColor: "bg-amber-500/10",
          titleColor: "text-amber-500",
        };
      case "ERROR":
        return {
          icon: <XCircle className="w-5 h-5 text-rose-500" />,
          borderColor: "border-rose-500/30",
          bgColor: "bg-rose-500/10",
          titleColor: "text-rose-500",
        };
      case "INFO":
      default:
        return {
          icon: <Info className="w-5 h-5 text-blue-500" />,
          borderColor: "border-blue-500/30",
          bgColor: "bg-blue-500/10",
          titleColor: "text-blue-500",
        };
    }
  };

  const config = getConfig(type);

  return (
    <div className="fixed bottom-6 right-6 z-200 w-87.5 pointer-events-none">
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key={id || "empty"} // 'key={id}' memaksa transisi animasi berjalan setiap kali konten berubah
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`pointer-events-auto flex items-start gap-3 p-4 bg-(--bg-card) border ${config.borderColor} rounded-xl shadow-2xl overflow-hidden`}
          >
            {/* Indikator Latar Belakang Warna Tipis */}
            <div
              className={`absolute inset-y-0 left-0 w-1.5 ${config.titleColor.replace("text-", "bg-")}`}
            />

            {/* Bagian Ikon */}
            <div className="shrink-0 mt-0.5">{config.icon}</div>

            {/* Bagian Konten Teks */}
            <div className="flex-1 min-w-0 text-left">
              <h4
                className={`text-xs font-black tracking-wider ${config.titleColor}`}
              >
                {title}
              </h4>
              <p className="text-xs font-bold text-(--text-primary) mt-1 leading-relaxed wrap-break-word">
                {message}
              </p>
            </div>

            {/* Tombol Tutup Manual */}
            <button
              onClick={closeToast}
              className="shrink-0 text-(--text-secondary) hover:text-(--text-primary) transition-colors p-0.5 rounded-md hover:bg-(--surface-hover)"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
