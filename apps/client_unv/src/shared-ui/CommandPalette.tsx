// File: apps/client_unv/src/shared-ui/CommandPalette.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Command as CommandIcon,
  ArrowRight,
  Terminal,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MenuConfig } from "./UniversalLayout";

interface CommandPaletteProps {
  menus: MenuConfig[];
}

interface FlattenedCommand {
  id: string;
  title: string;
  subtitle?: string;
  path: string;
  icon: React.ReactNode;
  type: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ menus }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const navigate = useNavigate();

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  // 1. Pipihkan (Flatten) struktur menu menjadi daftar command linier
  const commands: FlattenedCommand[] = React.useMemo(() => {
    const list: FlattenedCommand[] = [];
    menus.forEach((menu) => {
      if (menu.path) {
        list.push({
          id: menu.id,
          title: menu.label,
          path: menu.path,
          icon: menu.icon,
          type: "Modul Utama",
        });
      }
      if (menu.children) {
        menu.children.forEach((child) => {
          list.push({
            id: child.id,
            title: child.label,
            subtitle: menu.label, // Konteks induk
            path: child.path,
            icon: child.icon || menu.icon,
            type: "Fasilitas",
          });
        });
      }
    });

    // =========================================================================
    // REGISTRASI FASILITAS SISTEM INTI (GEDUNG)
    // =========================================================================
    list.push({
      id: "sys_data_manager",
      title: "Data Manager",
      subtitle: "Master Dictionary",
      path: "/system/data-manager",
      icon: <CommandIcon className="w-4 h-4" />,
      type: "Sistem Inti",
    });

    // Tambahan rute baru untuk Diagnostik Log Terisolasi
    list.push({
      id: "sys_diagnostik_log",
      title: "Diagnostik & Audit Log Registry",
      subtitle: "System Infrastructure Monitoring",
      path: "/almaApp/diagnostik_log",
      icon: <Terminal className="w-4 h-4 text-orange-500" />, // Pastikan 'Terminal' diimpor dari lucide-react di bagian atas
      type: "Sistem Inti",
    });

    return list;
  }, [menus]);

  // 2. Global Event Listener untuk CTRL + K atau CMD + K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); // Cegah default browser search
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // 3. Reset state dan auto-focus saat modal terbuka
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setHighlightedIndex(0);
      // Timeout kecil agar render selesai sebelum di-focus
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // 4. Filter Real-time
  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(search.toLowerCase()) ||
      cmd.subtitle?.toLowerCase().includes(search.toLowerCase()) ||
      cmd.type.toLowerCase().includes(search.toLowerCase()),
  );

  // 5. Auto-scroll listbox
  useEffect(() => {
    if (isOpen && listboxRef.current && filteredCommands.length > 0) {
      const activeItem = listboxRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      if (activeItem) {
        const container = listboxRef.current;
        const itemTop = activeItem.offsetTop;
        const itemBottom = itemTop + activeItem.offsetHeight;
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;

        if (itemTop < containerTop) {
          container.scrollTop = itemTop;
        } else if (itemBottom > containerBottom) {
          container.scrollTop = itemBottom - container.clientHeight;
        }
      }
    }
  }, [highlightedIndex, isOpen, filteredCommands]);

  const executeCommand = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        executeCommand(filteredCommands[highlightedIndex].path);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-start justify-center pt-[15vh]">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative w-full max-w-2xl bg-(--bg-card) rounded-xl shadow-2xl border border-(--border-color) overflow-hidden flex flex-col"
          >
            {/* Input Header */}
            <div className="flex items-center px-4 py-4 border-b border-(--border-color) bg-(--bg-input)">
              <Search className="w-5 h-5 text-(--text-secondary) shrink-0 mr-3" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Cari modul, menu, atau tekan ESC untuk tutup..."
                className="flex-1 bg-transparent border-none outline-none text-lg text-(--text-primary) placeholder:text-(--text-secondary)/60 font-semibold"
                autoComplete="off"
                spellCheck="false"
              />
              <div className="flex items-center gap-1 shrink-0 ml-3">
                <kbd className="px-2 py-1 bg-(--surface-hover) border border-(--border-color) rounded text-[10px] font-bold text-(--text-secondary) font-mono">
                  ESC
                </kbd>
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-hidden">
              {filteredCommands.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <CommandIcon className="w-8 h-8 text-(--text-secondary) mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-semibold text-(--text-primary)">
                    Tidak ada menu atau rute yang ditemukan.
                  </p>
                  <p className="text-xs text-(--text-secondary) mt-1">
                    Coba kata kunci lain atau periksa modul yang aktif.
                  </p>
                </div>
              ) : (
                <ul
                  ref={listboxRef}
                  className="max-h-87.5 overflow-y-auto custom-scrollbar p-2"
                >
                  {filteredCommands.map((cmd, index) => {
                    const isHighlighted = index === highlightedIndex;
                    return (
                      <li
                        key={cmd.id}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => executeCommand(cmd.path)}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                          isHighlighted
                            ? "bg-orange-500/10 border border-orange-500/20"
                            : "bg-transparent border border-transparent hover:bg-(--surface-hover)"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 shadow-sm ${
                              isHighlighted
                                ? "bg-orange-500 text-white"
                                : "bg-(--surface-hover) border border-(--border-color) text-(--text-secondary)"
                            }`}
                          >
                            {/* Konversi icon agar memiliki style konsisten */}
                            {React.isValidElement(cmd.icon)
                              ? React.cloneElement(
                                  cmd.icon as React.ReactElement,
                                  {
                                    className: "w-4 h-4",
                                  },
                                )
                              : cmd.icon}
                          </div>
                          <div className="flex flex-col text-left">
                            <span
                              className={`text-sm font-bold ${
                                isHighlighted
                                  ? "text-orange-500"
                                  : "text-(--text-primary)"
                              }`}
                            >
                              {cmd.title}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-(--text-secondary) bg-(--bg-input) px-1.5 py-0.5 rounded border border-(--border-color)">
                                {cmd.type}
                              </span>
                              {cmd.subtitle && (
                                <span className="text-[11px] font-semibold text-(--text-secondary)">
                                  {cmd.subtitle}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isHighlighted && (
                          <ArrowRight className="w-4 h-4 text-orange-500 shrink-0 mr-2" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer Bantuan */}
            <div className="px-4 py-2 border-t border-(--border-color) bg-(--bg-input) flex items-center gap-4 text-[10px] font-bold text-(--text-secondary)">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-(--surface-hover) border border-(--border-color) rounded font-mono">
                  ↑
                </kbd>
                <kbd className="px-1.5 py-0.5 bg-(--surface-hover) border border-(--border-color) rounded font-mono">
                  ↓
                </kbd>
                <span>Navigasi</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-(--surface-hover) border border-(--border-color) rounded font-mono">
                  Enter
                </kbd>
                <span>Pilih</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
