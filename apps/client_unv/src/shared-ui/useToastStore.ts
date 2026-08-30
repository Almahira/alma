// File: apps/client_unv/src/shared-ui/useToastStore.ts
import { create } from "zustand";

export type ToastType = "SUCCESS" | "WARN" | "ERROR" | "INFO";

interface ToastState {
  id: string | null;
  title: string | null;
  message: string | null;
  type: ToastType;
  isOpen: boolean;
  showToast: (params: {
    title: string;
    message: string;
    type?: ToastType;
  }) => void;
  closeToast: () => void;
}

// PERBAIKAN: Menggunakan ReturnType<typeof setTimeout> menggantikan NodeJS.Timeout agar ramah browser environment
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set, get) => ({
  id: null,
  title: null,
  message: null,
  type: "INFO",
  isOpen: false,

  showToast: ({ title, message, type = "INFO" }) => {
    // 1. Jika ada timer penutupan sebelumnya yang sedang berjalan, batalkan (Anti-Spam Debounce)
    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    // 2. Perbarui konten di dalam wadah yang sama dan set status terbuka
    set({
      id: Math.random().toString(36).substring(7), // ID acak baru memicu transisi animasi teks internal
      title: title.toUpperCase(),
      message: message,
      type: type,
      isOpen: true,
    });

    // 3. Pasang timer baru untuk menutup toast otomatis setelah 3 detik (3000ms)
    toastTimer = setTimeout(() => {
      get().closeToast();
    }, 3000);
  },

  closeToast: () => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    set({ isOpen: false });
  },
}));

/**
 * Utilitas ekspor global yang bisa langsung dipanggil oleh file JavaScript/TypeScript non-komponen
 * (Misal: Dipanggil dari dalam Command Bus, Outbox Daemon, atau file Core murni)
 */
export const sysToast = {
  success: (title: string, message: string) =>
    useToastStore.getState().showToast({ title, message, type: "SUCCESS" }),
  warn: (title: string, message: string) =>
    useToastStore.getState().showToast({ title, message, type: "WARN" }),
  error: (title: string, message: string) =>
    useToastStore.getState().showToast({ title, message, type: "ERROR" }),
  info: (title: string, message: string) =>
    useToastStore.getState().showToast({ title, message, type: "INFO" }),
};
