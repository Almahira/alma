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
  Trash2,
} from "lucide-react";
import { getApiUrl } from "../../../../../packages/core_unv/src/config/env";
import { useNavigate } from "react-router-dom";
import { sysToast } from "../../../../../apps/client_unv/src/shared-ui/useToastStore";
import { useWhatsAppImportStore } from "../useWhatsAppImportStore";
import {
  pruneWhatsAppLocalStorage,
  getStoredMessages,
  saveStoredMessage,
  getStoredInbox,
  markStoredMessagesAsParsed,
} from "../utils/waStorage";

export const WhatsAppChatDrawer: React.FC<{
  isOpen: boolean;
  isInline?: boolean;
  onClose: () => void;
}> = ({ isOpen, isInline, onClose }) => {
  const [status, setStatus] = useState<any>({ status: "DISCONNECTED" });
  const [inbox, setInbox] = useState<any[]>([]);
  const [selectedJid, setSelectedJid] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);

  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
    new Set(),
  );

  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const localRegionId = localStorage.getItem("__unv_regionId") || "";
  const localOutletId = localStorage.getItem("__unv_outletId") || "";
  const isOutletMachine = Boolean(localOutletId);

  const fetchInbox = () => {
    setInbox(getStoredInbox());
  };

  const fetchMessages = () => {
    if (!selectedJid) return;
    const jid = selectedJid;
    setHasMore(false);
    const localMsgs = getStoredMessages(jid);
    setMessages(localMsgs);
    setTimeout(() => chatEndRef.current?.scrollIntoView(), 100);

    let isActive = true;
    fetch(getApiUrl(`/api/whatsapp/messages?jid=${encodeURIComponent(jid)}`))
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Gagal menyinkronkan status pesan (${res.status})`);
        }
        return res.json();
      })
      .then((serverMessages) => {
        if (!isActive) return;
        if (!Array.isArray(serverMessages)) {
          throw new Error("Respons sinkronisasi pesan tidak valid");
        }

        const parsedIds = serverMessages
          .filter((message: any) => message.isPoParsed || message.is_po_parsed)
          .map((message: any) => message.id);
        if (parsedIds.length === 0) return;

        markStoredMessagesAsParsed(parsedIds);
        setMessages((prev) =>
          prev.map((message) =>
            parsedIds.includes(message.id)
              ? { ...message, isPoParsed: true, is_po_parsed: true }
              : message,
          ),
        );
      })
      .catch((err) => {
        if (isActive) {
          console.error("[WA MESSAGE STATUS SYNC ERROR]:", err);
        }
      });

    return () => {
      isActive = false;
    };
  };

  useEffect(() => {
    if (!isOpen) return;
    return fetchMessages();
  }, [isOpen, selectedJid]);

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

    const handleStatus = (e: any) => {
      const newStatus = e.detail;
      setStatus(newStatus);

      if (newStatus?.status === "DISCONNECTED") {
        pruneWhatsAppLocalStorage();
        setInbox([]);
        setMessages([]);
        setSelectedJid("");
      }
    };

    const handleNewMsg = (e: any) => {
      const msg = e.detail;
      saveStoredMessage(msg);
      fetchInbox();

      if (
        msg.remoteJid === selectedJid ||
        msg.remoteJid.includes(selectedJid)
      ) {
        setMessages((prev) => {
          // 1. Jika ID pesan resmi ini sudah ada di state, abaikan
          if (prev.some((m) => m.id === msg.id)) return prev;

          // 2. Jika pesan dari diri kita sendiri (fromMe), cari pesan TEMP_ yang cocok dan GANTIKAN
          if (msg.fromMe) {
            const tempIndex = prev.findIndex(
              (m) => m.id.startsWith("TEMP_") && m.text === msg.text,
            );
            if (tempIndex !== -1) {
              const updated = [...prev];
              updated[tempIndex] = msg; // Timpa pesan TEMP dengan pesan resmi WhatsApp
              return updated;
            }
          }

          // 3. Pesan baru dari lawan bicara
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

  useEffect(() => {
    const handleMessagesProcessed = (e: any) => {
      const processedIds: string[] = e.detail?.messageIds || [];
      if (processedIds.length > 0) {
        markStoredMessagesAsParsed(processedIds);
        setMessages((prev) =>
          prev.map((m) =>
            processedIds.includes(m.id)
              ? { ...m, isPoParsed: true, is_po_parsed: true }
              : m,
          ),
        );
      }
    };

    window.addEventListener(
      "UNV_WA_MESSAGES_PROCESSED",
      handleMessagesProcessed,
    );
    return () => {
      window.removeEventListener(
        "UNV_WA_MESSAGES_PROCESSED",
        handleMessagesProcessed,
      );
    };
  }, []);

  const handleSend = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedJid) return;
    const textToSend = inputText.trim();
    setInputText("");

    const tempId = `TEMP_${Date.now()}`;
    const outgoingMsg = {
      id: tempId,
      remoteJid: selectedJid,
      senderName: "Saya",
      text: textToSend,
      fromMe: true,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, outgoingMsg]);

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
    } catch (err) {
      console.error("Gagal kirim pesan:", err);
    }
  };

  const handleRequestQR = () => {
    pruneWhatsAppLocalStorage();
    setInbox([]);
    setMessages([]);
    setSelectedJid("");

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

  const handleImportToReceiving = () => {
    const selectedMsgs = messages.filter((m) => selectedMessageIds.has(m.id));
    if (selectedMsgs.length === 0) return;

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

    navigate("/integrasi/whatsapp");

    setSelectedMessageIds(new Set());
  };

  const handleClearChatHistory = async () => {
    if (!selectedJid) return;
    if (
      !window.confirm(
        "Apakah Anda yakin ingin membersihkan seluruh riwayat chat kontak ini?",
      )
    ) {
      return;
    }

    try {
      // 1. Bersihkan dari Local Storage klien
      const raw = localStorage.getItem("unv_wa_messages");
      if (raw) {
        const all = JSON.parse(raw);
        delete all[selectedJid];
        localStorage.setItem("unv_wa_messages", JSON.stringify(all));
      }

      // 2. Kosongkan state di antarmuka
      setMessages([]);
      setSelectedMessageIds(new Set());
      fetchInbox();

      // 3. Fallback request ke server
      await fetch(getApiUrl("/api/whatsapp/messages/clear"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jid: selectedJid, clearAll: true }),
      }).catch(() => {});

      sysToast.success("Sukses", "Riwayat chat berhasil dibersihkan.");
    } catch (err: any) {
      sysToast.error("Gagal", err.message || "Gagal membersihkan chat.");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`flex flex-col h-full bg-(--bg-card) border-l border-(--border-color) z-30 transition-all shadow-[-10px_0_30px_rgba(0,0,0,0.1)] ${
        isInline ? "w-100 shrink-0" : "fixed top-16 bottom-0 right-0 w-100"
      }`}
    >
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
        <div className="flex-1 flex flex-col overflow-hidden relative">
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
            <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
              <div className="px-3 py-2 bg-(--surface-hover) border-b border-(--border-color) flex items-center gap-3 shrink-0">
                <button
                  onClick={() => {
                    setSelectedJid("");
                    setSelectedMessageIds(new Set());
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleClearChatHistory}
                    title="Bersihkan riwayat chat kontak ini"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3 custom-scrollbar"
              >
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

                        <div
                          className={`text-xs transition-all ${
                            m.mediaType === "sticker"
                              ? "bg-transparent border-0 shadow-none p-0"
                              : `p-2.5 shadow-sm rounded-2xl ${
                                  m.fromMe
                                    ? "bg-emerald-600 text-white rounded-tr-sm"
                                    : "bg-(--bg-input) border border-(--border-color) text-(--text-primary) rounded-tl-sm"
                                }`
                          } ${isSelected ? "ring-2 ring-orange-500 shadow-[0_0_15px_rgba(244,121,62,0.3)]" : ""}`}
                        >
                          {/* GAMBAR */}
                          {m.mediaType === "image" && m.mediaUrl && (
                            <div className="mb-1 rounded-lg overflow-hidden border border-black/10 max-w-65">
                              <img
                                src={getApiUrl(m.mediaUrl)}
                                alt="WA Image"
                                className="w-full h-auto object-cover cursor-pointer hover:opacity-90 transition"
                                onClick={() =>
                                  window.open(getApiUrl(m.mediaUrl), "_blank")
                                }
                              />
                            </div>
                          )}

                          {/* STIKER (Transparan, tanpa background bubble) */}
                          {m.mediaType === "sticker" && m.mediaUrl && (
                            <div className="p-1">
                              <img
                                src={getApiUrl(m.mediaUrl)}
                                alt="Sticker"
                                className="w-28 h-28 object-contain"
                              />
                            </div>
                          )}

                          {/* DOKUMEN */}
                          {m.mediaType === "document" && m.mediaUrl && (
                            <a
                              href={getApiUrl(m.mediaUrl)}
                              download={m.mediaFileName || "dokumen"}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-3 p-2.5 mb-1.5 rounded-lg bg-black/5 hover:bg-black/10 transition border border-black/10"
                            >
                              <div className="p-2 rounded bg-rose-500/10 text-rose-600 font-bold text-[10px] uppercase">
                                {m.mediaFileName?.split(".").pop() || "FILE"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold truncate text-(--text-primary)">
                                  {m.mediaFileName || "Unduh Dokumen"}
                                </div>
                                <div className="text-[10px] text-(--text-secondary)">
                                  Klik untuk mengunduh
                                </div>
                              </div>
                            </a>
                          )}

                          {/* TEKS (Hanya render jika ada teks) */}
                          {m.text ? (
                            <p className="whitespace-pre-wrap leading-relaxed">
                              {m.text}
                            </p>
                          ) : null}

                          <span
                            className={`text-[9px] block mt-1 text-right font-mono ${
                              m.mediaType === "sticker"
                                ? "text-(--text-secondary)"
                                : m.fromMe
                                  ? "text-emerald-100"
                                  : "text-(--text-secondary)"
                            }`}
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
