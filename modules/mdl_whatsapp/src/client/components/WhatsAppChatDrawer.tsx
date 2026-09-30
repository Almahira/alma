// File: modules/mdl_whatsapp/src/client/components/WhatsAppChatDrawer.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  QrCode,
  RefreshCw,
  X,
  ArrowLeft,
  CheckCircle2,
  ShoppingCart,
  Truck,
  Building2,
  MessageSquare,
} from "lucide-react";
import { getApiUrl } from "../../../../../packages/core_unv/src/config/env";
import { useNavigate } from "react-router-dom";
import { sysToast } from "../../../../../apps/client_unv/src/shared-ui/useToastStore";
import { useWhatsAppImportStore } from "../useWhatsAppImportStore";

export const WhatsAppChatDrawer: React.FC<{
  isOpen: boolean;
  isInline?: boolean; // Jika true, render berdampingan. Jika false, render melayang (absolute/fixed)
  onClose: () => void;
}> = ({ isOpen, isInline, onClose }) => {
  const [status, setStatus] = useState<any>({ status: "DISCONNECTED" });
  const [inbox, setInbox] = useState<any[]>([]);
  const [selectedJid, setSelectedJid] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);

  // State untuk Keranjang PO (Checkbox)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
    new Set(),
  );

  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // State Paginasi Infinite Scroll
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Deteksi Tipe Mesin (Outlet Cabang vs Gudang Region)
  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";
  const isOutletMachine = Boolean(localOutletId);

  const fetchInbox = () => {
    fetch(getApiUrl("/api/whatsapp/inbox"))
      .then((res) => res.json())
      .then((data) => setInbox(data))
      .catch(() => {});
  };

  // 1. Ambil 30 pesan terbaru saat kontak dipilih
  const fetchMessages = () => {
    if (!selectedJid) return;
    setHasMore(true);
    fetch(getApiUrl(`/api/whatsapp/messages?jid=${selectedJid}&limit=30`))
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMessages(data);
          if (data.length < 30) setHasMore(false);
          setTimeout(() => chatEndRef.current?.scrollIntoView(), 100);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchMessages();
  }, [selectedJid]);

  // 2. Muat pesan lebih lama saat user scroll mendekati bagian atas (Infinite Scroll)
  const loadOlderMessages = async () => {
    if (!selectedJid || isLoadingMore || !hasMore || messages.length === 0)
      return;

    const oldestMsg = messages[0];
    if (!oldestMsg?.timestamp) return;

    setIsLoadingMore(true);
    const container = chatContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;

    try {
      const res = await fetch(
        getApiUrl(
          `/api/whatsapp/messages?jid=${selectedJid}&limit=30&before=${encodeURIComponent(
            new Date(oldestMsg.timestamp).toISOString(),
          )}`,
        ),
      );
      const olderData = await res.json();

      if (Array.isArray(olderData)) {
        if (olderData.length === 0) {
          setHasMore(false);
        } else {
          if (olderData.length < 30) setHasMore(false);
          setMessages((prev) => [...olderData, ...prev]);

          // Pertahankan posisi scroll agar tampilan tidak meloncat
          requestAnimationFrame(() => {
            if (container) {
              container.scrollTop = container.scrollHeight - prevScrollHeight;
            }
          });
        }
      }
    } catch (err) {
      console.error("[WA INFINITE SCROLL ERROR]:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    if (chatContainerRef.current.scrollTop <= 40 && hasMore && !isLoadingMore) {
      loadOlderMessages();
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchInbox();

    let pollingTimer: any;
    const checkStatus = () => {
      fetch(getApiUrl("/api/whatsapp/status"))
        .then((res) => res.json())
        .then((data) => {
          setStatus(data);
          if (data.status !== "CONNECTED") {
            pollingTimer = setTimeout(checkStatus, 3000);
          } else {
            setIsRequesting(false);
          }
        })
        .catch(() => {});
    };
    checkStatus();

    const handleStatus = (e: any) => setStatus(e.detail);
    const handleNewMsg = (e: any) => {
      const msg = e.detail;
      fetchInbox();
      if (
        msg.remoteJid === selectedJid ||
        msg.remoteJid.includes(selectedJid)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(
          () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          100,
        );
      }
    };

    window.addEventListener("UNV_WA_STATUS", handleStatus);
    window.addEventListener("UNV_WA_MESSAGE", handleNewMsg);

    return () => {
      clearTimeout(pollingTimer);
      window.removeEventListener("UNV_WA_STATUS", handleStatus);
      window.removeEventListener("UNV_WA_MESSAGE", handleNewMsg);
    };
  }, [isOpen, selectedJid]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedJid) return;
    const textToSend = inputText.trim();
    setInputText("");

    const tempId = `TEMP_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        remoteJid: selectedJid,
        senderName: "Saya",
        text: textToSend,
        fromMe: true,
        timestamp: new Date().toISOString(),
      },
    ]);
    setTimeout(
      () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );

    try {
      await fetch(getApiUrl("/api/whatsapp/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetJid: selectedJid, text: textToSend }),
      });
      fetchInbox();
    } catch (err) {
      console.error("Gagal kirim pesan:", err);
    }
  };

  const handleRequestQR = () => {
    setIsRequesting(true);
    fetch(getApiUrl("/api/whatsapp/connect"), { method: "POST" }).catch(() =>
      setIsRequesting(false),
    );
  };

  const toggleMessageSelection = (msgId: string) => {
    setSelectedMessageIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(msgId)) newSet.delete(msgId);
      else newSet.add(msgId);
      return newSet;
    });
  };

  // Kloning isi teks pesan terpilih ke WhatsAppPage tanpa menutup Drawer
  const handleImportToReceiving = () => {
    const selectedMsgs = messages.filter((m) => selectedMessageIds.has(m.id));
    if (selectedMsgs.length === 0) return;

    // 1. Simpan pesan terpilih ke store kloning
    useWhatsAppImportStore.getState().setImportPayload({
      messageIds: Array.from(selectedMessageIds),
      messages: selectedMsgs,
      remoteJid: selectedJid,
      senderName: selectedMsgs[0]?.senderName || "Kontak WhatsApp",
    });

    sysToast.success(
      "Pesan Dikloning",
      `${selectedMsgs.length} pesan PO berhasil disalin ke lembar kerja Receiving.`,
    );

    // 2. Navigasi ke halaman utama integrasi WhatsApp
    navigate("/integrasi/whatsapp");

    // 3. Reset centangan di drawer (CATATAN: Drawer TETAP TERBUKA, onClose() TIDAK dipanggil)
    setSelectedMessageIds(new Set());
  };

  if (!isOpen) return null;

  return (
    <div
      className={`flex flex-col h-full bg-(--bg-card) border-l border-(--border-color) z-30 transition-all shadow-[-10px_0_30px_rgba(0,0,0,0.1)] ${
        isInline ? "w-100 shrink-0" : "fixed top-16 bottom-0 right-0 w-100"
      }`}
    >
      {/* HEADER DRAWER */}
      <div className="flex items-center justify-between px-4 py-3 bg-(--surface-hover) border-b border-(--border-color) shrink-0">
        <div className="flex items-center gap-2 text-(--text-primary) font-black text-sm">
          <MessageSquare className="w-4 h-4 text-emerald-500" />
          WhatsApp Gateway
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-(--text-secondary) hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* KONDISI 1: BELUM CONNECT */}
      {status.status !== "CONNECTED" ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 text-center">
          <h2 className="text-sm font-bold text-(--text-primary)">
            Menunggu Autentikasi
          </h2>
          {status.qrCode ? (
            <div className="space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="p-3 bg-white rounded-xl shadow-lg inline-block">
                <img src={status.qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
              <p className="text-[10px] font-bold text-(--text-secondary)">
                Buka WhatsApp HP &rarr; Perangkat Tertaut &rarr; Scan QR
              </p>
            </div>
          ) : (
            <button
              onClick={handleRequestQR}
              disabled={isRequesting}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer transition flex items-center gap-2 text-xs shadow-md"
            >
              {isRequesting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              {isRequesting ? "Menyiapkan QR..." : "Tampilkan QR Code"}
            </button>
          )}
          <p className="text-[9px] text-(--text-secondary) font-mono uppercase tracking-wider">
            STATUS: {status.status}
          </p>
        </div>
      ) : (
        /* KONDISI 2: CONNECTED */
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* TAMPILAN INBOX (Jika belum pilih chat) */}
          {!selectedJid ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-[10px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Aktif (+{status.phoneNumber})
              </div>
              {inbox.map((chat) => (
                <div
                  key={chat.jid}
                  onClick={() => setSelectedJid(chat.jid)}
                  className="p-3.5 border-b border-(--border-color) cursor-pointer transition hover:bg-(--surface-hover)"
                >
                  <h4 className="font-bold text-xs text-(--text-primary) truncate">
                    {chat.name || chat.jid.split("@")[0]}
                  </h4>
                  <p className="text-[10px] text-(--text-secondary) font-mono truncate mt-0.5">
                    {chat.jid}
                  </p>
                </div>
              ))}
              {inbox.length === 0 && (
                <div className="p-8 text-center text-xs text-(--text-secondary) italic">
                  Belum ada riwayat pesan.
                </div>
              )}
            </div>
          ) : (
            /* TAMPILAN DALAM CHAT */
            <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
              {/* Header Chat */}
              <div className="px-3 py-2 bg-(--surface-hover) border-b border-(--border-color) flex items-center gap-3 shrink-0">
                <button
                  onClick={() => {
                    setSelectedJid("");
                    setSelectedMessageIds(new Set()); // Bersihkan seleksi saat kembali
                  }}
                  className="p-1.5 rounded-md hover:bg-(--bg-card) text-(--text-secondary) hover:text-(--text-primary) transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs text-(--text-primary) truncate">
                    {inbox.find((c) => c.jid === selectedJid)?.name ||
                      selectedJid.split("@")[0]}
                  </div>
                </div>
              </div>

              {/* AREA CHAT LIST (INFINITE SCROLL) */}
              <div
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3 custom-scrollbar"
              >
                {/* Indikator Loading Pesan Riwayat Lama */}
                {isLoadingMore && (
                  <div className="flex items-center justify-center py-2 text-[10px] text-emerald-500 font-bold gap-1.5 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Memuat riwayat chat lama...
                  </div>
                )}
                {messages.map((m) => {
                  const isSelected = selectedMessageIds.has(m.id);
                  const isAlreadyParsed = m.isPoParsed || m.is_po_parsed;

                  return (
                    <div
                      key={m.id}
                      className={`flex ${m.fromMe ? "justify-end" : "justify-start"} group`}
                    >
                      <div className="flex items-center gap-2 max-w-[85%]">
                        {/* Area Checkbox PO */}
                        {!m.fromMe && (
                          <div className="shrink-0 w-5 flex justify-center mt-1">
                            {isAlreadyParsed ? (
                              <span
                                title="Telah diproses ke Receiving"
                                className="cursor-help"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              </span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleMessageSelection(m.id)}
                                className={`w-3.5 h-3.5 rounded border-(--border-color) text-orange-500 focus:ring-orange-500 cursor-pointer transition-opacity ${
                                  isSelected
                                    ? "opacity-100"
                                    : "opacity-0 group-hover:opacity-100"
                                }`}
                                title="Pilih untuk diubah menjadi PO"
                              />
                            )}
                          </div>
                        )}

                        {/* Bubble Pesan */}
                        <div
                          className={`p-2.5 text-xs shadow-sm transition-all ${
                            m.fromMe
                              ? "bg-emerald-600 text-white rounded-2xl rounded-tr-sm"
                              : "bg-(--bg-input) border border-(--border-color) text-(--text-primary) rounded-2xl rounded-tl-sm"
                          } ${isSelected ? "ring-2 ring-orange-500 shadow-[0_0_15px_rgba(244,121,62,0.3)]" : ""}`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {m.text}
                          </p>
                          <span
                            className={`text-[9px] block mt-1 text-right font-mono ${m.fromMe ? "text-emerald-100" : "text-(--text-secondary)"}`}
                          >
                            {new Date(m.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* ACTION BAR PO TERPILIH (Floating/Sticky) */}
              {selectedMessageIds.size > 0 ? (
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-(--surface-hover) border-t border-orange-500/50 shadow-[0_-10px_20px_rgba(0,0,0,0.2)] animate-in slide-in-from-bottom-5 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-2.5 px-1">
                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-wider">
                      <ShoppingCart className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                      {selectedMessageIds.size} Pesan Dipilih
                    </span>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={handleImportToReceiving}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white text-xs font-black py-2.5 px-4 rounded-xl transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      IMPORT KE RECEIVING ({selectedMessageIds.size} PESAN
                      DIPILIH)
                    </button>
                  </div>
                </div>
              ) : (
                /* Form Input Normal */
                <form
                  onSubmit={handleSend}
                  className="p-3 bg-(--bg-card) border-t border-(--border-color) flex items-end gap-2 shrink-0"
                >
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }}
                    placeholder="Balas pesan..."
                    rows={1}
                    className="flex-1 bg-(--bg-input) text-(--text-primary) px-3 py-2.5 rounded-xl outline-none text-xs border border-(--border-color) focus:border-emerald-500 transition resize-none custom-scrollbar max-h-24"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 h-9 w-10 flex items-center justify-center rounded-xl transition cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
