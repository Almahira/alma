// File: apps/client_unv/src/shared-ui/useUniversalSort.tsx
import React, { useState, useMemo } from "react";
import { ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

/**
 * 1. UNIVERSAL HOOK: Mengurutkan array objek apa pun secara cerdas
 */
export function useUniversalSort<T>(
  items: T[],
  defaultConfig: SortConfig = { key: "", direction: null },
) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(defaultConfig);

  const requestSort = (key: string) => {
    let direction: SortDirection = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    } else if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = null; // Reset ke urutan default
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return items;
    }

    return [...items].sort((a: any, b: any) => {
      // Ambil nilai (mendukung nested key seperti "reference.invoiceNumber")
      const valA = sortConfig.key.split(".").reduce((obj, k) => obj?.[k], a);
      const valB = sortConfig.key.split(".").reduce((obj, k) => obj?.[k], b);

      if (valA === valB || (valA == null && valB == null)) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      // 1. Pengecekan Tanggal
      const dateA = Date.parse(valA);
      const dateB = Date.parse(valB);
      const isDate =
        !isNaN(dateA) &&
        !isNaN(dateB) &&
        typeof valA === "string" &&
        (valA.includes("-") || valA.includes("/"));
      if (isDate) {
        return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
      }

      // 2. Pengecekan Angka (Rupiah / QTY)
      if (typeof valA === "number" && typeof valB === "number") {
        return sortConfig.direction === "asc" ? valA - valB : valB - valA;
      }

      // 3. Pengecekan Teks (String Abjad)
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortConfig.direction === "asc"
        ? strA.localeCompare(strB, "id-ID")
        : strB.localeCompare(strA, "id-ID");
    });
  }, [items, sortConfig]);

  return { sortedItems, sortConfig, requestSort };
}

/**
 * 2. UNIVERSAL HEADER COMPONENT: Kepala Kolom Table dengan Panah Interaktif
 */
export const SortHeader: React.FC<{
  label: string;
  sortKey: string;
  currentSort: SortConfig;
  onSort: (key: string) => void;
  className?: string;
  align?: "left" | "center" | "right";
}> = ({
  label,
  sortKey,
  currentSort,
  onSort,
  className = "",
  align = "left",
}) => {
  const isActive =
    currentSort.key === sortKey && currentSort.direction !== null;

  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-4 py-3 cursor-pointer select-none transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${className}`}
    >
      <div
        className={`flex items-center gap-1.5 ${
          align === "right"
            ? "justify-end"
            : align === "center"
              ? "justify-center"
              : "justify-start"
        } ${isActive ? "text-orange-500 font-black" : ""}`}
      >
        <span>{label}</span>
        {isActive ? (
          currentSort.direction === "asc" ? (
            <ChevronUp className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 shrink-0 group-hover:opacity-100" />
        )}
      </div>
    </th>
  );
};
