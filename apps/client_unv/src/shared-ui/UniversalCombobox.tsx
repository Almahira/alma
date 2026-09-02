// File: apps/client_unv/src/shared-ui/UniversalCombobox.tsx
import React, { useState, useRef, useEffect, forwardRef } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface UniversalComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onEnterPressed?: () => void;
  dropdownDirection?: "bottom" | "left" | "right";
}

export const UniversalCombobox = forwardRef<
  HTMLInputElement,
  UniversalComboboxProps
>(
  (
    {
      options,
      value,
      onChange,
      placeholder = "Pilih atau ketik...",
      disabled = false,
      onEnterPressed,
      dropdownDirection = "bottom",
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const listboxRef = useRef<HTMLUListElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    const filteredOptions = options.filter((opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    useEffect(() => {
      if (!isOpen) {
        setSearchTerm("");
        setHighlightedIndex(0);
      } else {
        const index = filteredOptions.findIndex((opt) => opt.value === value);
        setHighlightedIndex(index >= 0 ? index : 0);
      }
    }, [isOpen, value]);

    useEffect(() => {
      const handleOutsideClick = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleOutsideClick);
      return () =>
        document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    useEffect(() => {
      if (isOpen && listboxRef.current && filteredOptions.length > 0) {
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
    }, [highlightedIndex, isOpen, filteredOptions]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!isOpen) setIsOpen(true);
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (isOpen && filteredOptions.length > 0) {
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
          if (onEnterPressed) setTimeout(() => onEnterPressed(), 50);
        } else if (!isOpen) {
          if (onEnterPressed) onEnterPressed();
        }
      } else if (e.key === "Escape") {
        setIsOpen(false);
      } else if (e.key === "Tab") {
        setIsOpen(false);
      } else {
        if (!isOpen) setIsOpen(true);
      }
    };

    const handleSelect = (selectedValue: string) => {
      onChange(selectedValue);
      setIsOpen(false);
      if (onEnterPressed) setTimeout(() => onEnterPressed(), 50);
    };

    const dropdownPositionClass = {
      bottom: "top-full left-0 mt-1 w-full",
      left: "top-0 left-full ml-2 w-64",
      right: "top-0 right-full mr-2 w-64",
    }[dropdownDirection];

    return (
      <div ref={containerRef} className="relative w-full text-left">
        <div
          className={`relative flex items-center w-full px-3 py-2 bg-(--bg-input) border rounded-lg transition-colors focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500/50 ${
            disabled
              ? "opacity-50 cursor-not-allowed border-(--border-color)"
              : "border-(--border-color) cursor-text"
          }`}
          onClick={() => !disabled && setIsOpen(true)}
        >
          <input
            ref={ref}
            type="text"
            className="w-full bg-transparent border-none outline-none text-sm font-bold text-(--text-primary) placeholder:text-(--text-secondary) placeholder:font-normal"
            placeholder={selectedOption ? selectedOption.label : placeholder}
            value={
              isOpen ? searchTerm : selectedOption ? selectedOption.label : ""
            }
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setHighlightedIndex(0);
            }}
            onFocus={() => !disabled && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            autoComplete="off"
          />
          <ChevronDown
            className={`w-4 h-4 text-(--text-secondary) transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>

        {isOpen && (
          <div
            className={`absolute z-50 ${dropdownPositionClass} bg-(--bg-card) border border-(--border-color) rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150`}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-xs font-semibold text-(--text-secondary) text-center flex flex-col items-center gap-1">
                <Search className="w-4 h-4 opacity-50" />
                Data tidak ditemukan
              </div>
            ) : (
              <ul
                ref={listboxRef}
                className="max-h-50 overflow-y-auto custom-scrollbar py-1"
                role="listbox"
              >
                {filteredOptions.map((opt, index) => {
                  const isHighlighted = index === highlightedIndex;
                  const isSelected = opt.value === value;

                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(opt.value);
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`flex items-center justify-between px-3 py-2 text-sm font-bold cursor-pointer transition-colors ${
                        isHighlighted
                          ? "bg-orange-500/10 text-orange-500"
                          : "text-(--text-primary) hover:bg-(--surface-hover)"
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-orange-500 shrink-0" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  },
);

UniversalCombobox.displayName = "UniversalCombobox";
