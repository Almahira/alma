// File: apps/client_unv/src/shared-ui/VirtualNumpad.tsx
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Delete } from "lucide-react";
import { useLocation } from "react-router-dom";

export const VirtualNumpad: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [activeInput, setActiveInput] = useState<HTMLInputElement | null>(null);

  const numpadRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Refs untuk drag: bertahan di antara render
  const positionRef = useRef(position);
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
  });

  // Sinkronkan positionRef setiap kali position berubah
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const moduleKey = location.pathname.split("/")[1] || "global";
  const storageKey = `__unv_numpad_pos_${moduleKey}`;

  // 1. DETEKSI FOCUS UNTUK MEMBUKA NUMPAD
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" &&
        (target.getAttribute("type") === "number" ||
          target.getAttribute("data-unv-numpad") === "true")
      ) {
        setActiveInput(target as HTMLInputElement);
        setIsOpen(true);

        const savedPos = localStorage.getItem(storageKey);
        if (savedPos) {
          try {
            const parsed = JSON.parse(savedPos);
            setPosition(parsed);
            positionRef.current = parsed;
          } catch (error) {
            console.error("Gagal membaca posisi numpad", error);
          }
        }
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    return () => document.removeEventListener("focusin", handleFocusIn);
  }, [storageKey]);

  // 2. DETEKSI SUBMIT FORM & KLIK DI LUAR UNTUK MENUTUP NUMPAD
  useEffect(() => {
    if (!isOpen) return;

    const handleFormSubmit = () => setIsOpen(false);

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (numpadRef.current && numpadRef.current.contains(target)) return;
      if (activeInput && activeInput.contains(target)) return;

      if (target.closest('button[type="submit"]')) {
        setIsOpen(false);
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener("submit", handleFormSubmit);
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("submit", handleFormSubmit);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, activeInput]);

  // 3. LOGIKA DRAG & DROP YANG SUDAH DIPERBAIKI
  useEffect(() => {
    const handleElement = dragRef.current;
    if (!handleElement || !isOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      dragStateRef.current.isDragging = true;
      dragStateRef.current.startX = e.clientX - positionRef.current.x;
      dragStateRef.current.startY = e.clientY - positionRef.current.y;
      document.body.style.userSelect = "none";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current.isDragging) return;

      const newX = e.clientX - dragStateRef.current.startX;
      const newY = e.clientY - dragStateRef.current.startY;

      positionRef.current = { x: newX, y: newY };
      setPosition({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      if (!dragStateRef.current.isDragging) return;

      dragStateRef.current.isDragging = false;
      document.body.style.userSelect = "";
      localStorage.setItem(storageKey, JSON.stringify(positionRef.current));
    };

    handleElement.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      handleElement.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
    };
  }, [isOpen, storageKey]); // Jangan bergantung pada `position`

  // 4. EKSEKUSI PENGETIKAN
  const handleKeyPress = (char: string) => {
    if (!activeInput) return;

    let currentValue = activeInput.value;
    let newValue = currentValue;

    if (char === "BACKSPACE") {
      newValue = currentValue.slice(0, -1);
    } else {
      newValue = currentValue + char;
    }

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    nativeInputValueSetter?.call(activeInput, newValue);

    const event = new Event("input", { bubbles: true });
    activeInput.dispatchEvent(event);
    activeInput.focus();
  };

  if (!isOpen) return null;

  // 5. CREATE PORTAL AGAR NUMPAD KELUAR DARI JEBAKAN Z-INDEX PARENT
  return createPortal(
    <div
      ref={numpadRef}
      className="fixed shadow-2xl rounded-lg overflow-hidden flex flex-col w-65"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxWidth: "100vw",
        maxHeight: "100vh",
        zIndex: 9999,
        backgroundColor: "var(--bg-card, #1f2937)", // fallback agar tidak transparan
        border: "1px solid var(--border-color, #374151)",
      }}
    >
      {/* Header Tipis & Handle Drag */}
      <div
        ref={dragRef}
        className="h-8 flex items-center justify-between px-2 cursor-move select-none"
        style={{
          backgroundColor: "var(--bg-input, #111827)",
          borderBottom: "1px solid var(--border-color, #374151)",
        }}
      >
        <div className="flex items-center gap-1.5 opacity-50">
          <div
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: "var(--text-secondary, #9ca3af)" }}
          />
          <div
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: "var(--text-secondary, #9ca3af)" }}
          />
          <div
            className="w-1 h-1 rounded-full"
            style={{ backgroundColor: "var(--text-secondary, #9ca3af)" }}
          />
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-red-500 transition-colors p-1"
          title="Tutup Numpad"
          style={{ color: "var(--text-secondary, #9ca3af)" }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Grid Layout Numpad */}
      <div
        className="p-1 grid grid-cols-5 gap-1"
        style={{ backgroundColor: "var(--bg-card, #1f2937)" }}
      >
        <Key char="1" onClick={handleKeyPress} />
        <Key char="2" onClick={handleKeyPress} />
        <Key char="3" onClick={handleKeyPress} />
        <Key
          char="BACKSPACE"
          label={<Delete className="w-5 h-5" />}
          colSpan={2}
          onClick={handleKeyPress}
          variant="action"
        />

        <Key char="4" onClick={handleKeyPress} />
        <Key char="5" onClick={handleKeyPress} />
        <Key char="6" onClick={handleKeyPress} />
        <Key char="x" onClick={handleKeyPress} variant="operator" />
        <Key char=":" onClick={handleKeyPress} variant="operator" />

        <Key char="7" onClick={handleKeyPress} />
        <Key char="8" onClick={handleKeyPress} />
        <Key char="9" onClick={handleKeyPress} />
        <Key char="+" onClick={handleKeyPress} variant="operator" />
        <Key char="-" onClick={handleKeyPress} variant="operator" />

        <Key char="*" onClick={handleKeyPress} variant="operator" />
        <Key char="0" onClick={handleKeyPress} />
        <Key char="#" onClick={handleKeyPress} variant="operator" />
        <Key char="." onClick={handleKeyPress} variant="operator" />
        <Key char="," onClick={handleKeyPress} variant="operator" />
      </div>
    </div>,
    document.body,
  );
};

// Komponen Sub untuk Tombol (Key)
interface KeyProps {
  char: string;
  label?: React.ReactNode;
  colSpan?: number;
  variant?: "default" | "action" | "operator";
  onClick: (char: string) => void;
}

const Key: React.FC<KeyProps> = ({
  char,
  label,
  colSpan = 1,
  variant = "default",
  onClick,
}) => {
  const style: React.CSSProperties = {
    gridColumn: `span ${colSpan} / span ${colSpan}`,
    height: "3rem", // setara h-12
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "1.125rem",
    borderRadius: "0.25rem",
    border: "1px solid var(--border-color, #374151)",
    backgroundColor: "var(--bg-input, #111827)",
    color: "var(--text-primary, #f9fafb)",
    cursor: "pointer",
    userSelect: "none",
    transition: "transform 0.15s, background-color 0.15s",
  };

  if (variant === "action") {
    style.backgroundColor = "rgba(249, 115, 22, 0.1)";
    style.borderColor = "rgba(249, 115, 22, 0.2)";
    style.color = "var(--text-primary, #f97316)";
  } else if (variant === "operator") {
    style.backgroundColor = "rgba(100, 116, 139, 0.1)";
    style.borderColor = "rgba(100, 116, 139, 0.2)";
    style.color = "var(--text-secondary, #94a3b8)";
    style.fontFamily = "monospace";
  }

  return (
    <div
      style={style}
      className="active:scale-95 transition-transform"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick(char);
      }}
    >
      {label || char}
    </div>
  );
};
