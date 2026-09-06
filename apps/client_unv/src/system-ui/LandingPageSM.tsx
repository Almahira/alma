// File: apps/client_unv/src/system-ui/LandingPageSM.tsx
import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Building2,
  ArrowRight,
  Wifi,
  Sparkles,
  CheckCircle2,
  XCircle,
  Zap,
  Mail,
  Phone,
  Package,
  Truck,
  ArrowDownToLine,
  Wallet,
  CookingPot,
  X,
  Copy,
  Check,
  ChevronDown,
  Layers,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface LandingPageSMProps {
  onStartSetup?: (config?: {
    tier?: "FREE" | "PREMIUM" | "EXCLUSIVE";
    licenseKey?: string;
  }) => void;
}

// =========================================================================
// CHECKOUT MODAL MOBILE (MIDTRANS SNAP + SERIAL LISENSI)
// =========================================================================
const CheckoutModalSM: React.FC<{
  tier: "PREMIUM" | "EXCLUSIVE";
  companyId?: string | null;
  onClose: () => void;
  onSuccess?: (licenseKey: string, tier: "PREMIUM" | "EXCLUSIVE") => void;
}> = ({ tier, companyId, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const price = "Rp 5.489.000";

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const serverUrl =
        localStorage.getItem("__unv_serverUrl") || "http://localhost:5000";
      const res = await fetch(
        `${serverUrl.replace(/\/+$/, "")}/api/payment/create-snap`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tier,
            companyId: companyId || undefined,
            companyName,
            customerName,
            email,
            phone,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const loadSnapScript = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          if ((window as any).snap) return resolve();
          const script = document.createElement("script");
          script.src = "https://app.midtrans.com/snap/snap.js";
          script.setAttribute("data-client-key", "Mid-client-7ZHoQPtcHnpcwglB");
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error("Gagal memuat sistem pembayaran Midtrans."));
          document.body.appendChild(script);
        });
      };

      if (data.token && !data.token.startsWith("DEV_")) {
        await loadSnapScript();
        (window as any).snap.pay(data.token, {
          onSuccess: async () => {
            const statusRes = await fetch(
              `${serverUrl.replace(/\/+$/, "")}/api/payment/order-status/${data.orderId}`,
            );
            const statusData = await statusRes.json();
            setIssuedKey(statusData.licenseKey);
            if (onSuccess && statusData.licenseKey) {
              onSuccess(statusData.licenseKey, tier);
            }
          },
          onPending: () => alert("Menunggu konfirmasi pembayaran..."),
          onError: () => alert("Pembayaran gagal diproses."),
        });
      } else {
        const statusRes = await fetch(
          `${serverUrl.replace(/\/+$/, "")}/api/payment/order-status/${data.orderId}`,
        );
        const statusData = await statusRes.json();
        setIssuedKey(statusData.licenseKey);
        if (onSuccess && statusData.licenseKey) {
          onSuccess(statusData.licenseKey, tier);
        }
      }
    } catch (err: any) {
      alert("Gagal memproses pembayaran: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (issuedKey) {
      navigator.clipboard.writeText(issuedKey);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full text-slate-100 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-black text-xs text-white uppercase tracking-wide">
              {issuedKey
                ? "Kunci Lisensi Terbit"
                : companyId
                  ? `Upgrade Paket ${tier}`
                  : `Beli Lisensi ${tier}`}
            </h3>
            <span className="text-orange-400 font-mono font-black text-xs">
              {price} / Tahun
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {issuedKey ? (
          <div className="space-y-3 py-1">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase">
                <CheckCircle2 className="w-4 h-4" /> Pembayaran Berhasil!
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {companyId
                  ? `Seluruh perangkat milik ${companyName} telah otomatis di-upgrade via OTA!`
                  : `Kunci lisensi telah dikirim ke email (${email}):`}
              </p>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[10px] break-all text-orange-400 select-all relative pr-8">
                {issuedKey}
                <button
                  onClick={handleCopyKey}
                  className="absolute top-2 right-2 p-1.5 bg-slate-800 rounded-md hover:bg-slate-700 text-slate-300"
                  title="Salin kunci"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                navigate("/setup");
              }}
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2"
            >
              Buka Portal Setup Perangkat <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleCheckout} className="space-y-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                Nama Perusahaan / Bisnis
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value.toUpperCase())}
                placeholder="PT ALMA NUSANTARA"
                className="w-full text-xs font-bold p-2.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                Nama Penanggung Jawab
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                placeholder="RENDI FAIZAL"
                className="w-full text-xs font-bold p-2.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                Email Penerima Lisensi
              </label>
              <input
                type="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@company.com"
                className="w-full text-xs font-bold p-2.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                No. WhatsApp
              </label>
              <input
                type="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08123456789"
                className="w-full text-xs font-bold p-2.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-orange-500 text-white font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-orange-500/25 mt-2 disabled:opacity-50"
            >
              {isLoading ? "Menghubungkan..." : "Bayar via Midtrans (QRIS / VA)"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// KOMPONEN UTAMA LANDING PAGE MOBILE
// =========================================================================
export const LandingPageSM: React.FC<LandingPageSMProps> = ({ onStartSetup }) => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<"FILOSOFI" | "BANDING" | "MODUL" | "PAKET">("FILOSOFI");
  const [checkoutTier, setCheckoutTier] = useState<"PREMIUM" | "EXCLUSIVE" | null>(null);
  const [upgradeCompanyId, setUpgradeCompanyId] = useState<string | null>(null);
  const [expandedDimIdx, setExpandedDimIdx] = useState<number | null>(0);

  // Deteksi URL Query untuk In-App Upgrade Bridge
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "upgrade") {
      const companyId = params.get("companyId");
      setUpgradeCompanyId(companyId);
      setActiveSection("PAKET");
      setCheckoutTier("EXCLUSIVE");
    }
  }, []);

  const handleGoToSetup = (config?: {
    tier?: "FREE" | "PREMIUM" | "EXCLUSIVE";
    licenseKey?: string;
  }) => {
    if (onStartSetup) {
      onStartSetup(config);
    } else {
      navigate("/setup");
    }
  };

  const handleLaunchDemo = () => {
    localStorage.clear();
    localStorage.setItem("__unv_is_demo", "true");
    sessionStorage.setItem("__alma_demo_session", "true");
    localStorage.setItem("__unv_serverUrl", "http://127.0.0.1:0");
    localStorage.setItem("__unv_deviceToken", "DEMO_TOKEN_GUEST");
    localStorage.setItem("__unv_nodeId", "NODE_DEMO_BROWSER");
    localStorage.setItem("__unv_companyId", "COMP_DEMO_RESTO");
    localStorage.setItem("__unv_regionId", "REG_DEMO_PUSAT");
    localStorage.setItem("__unv_outletId", "OUT_DEMO_CABANG");
    localStorage.setItem("__unv_license_tier", "EXCLUSIVE");
    localStorage.setItem(
      "__unv_allowed_modules",
      JSON.stringify([
        "mdl_organization",
        "mdl_item",
        "mdl_vendor",
        "mdl_receiving",
        "mdl_warehouse",
        "mdl_plusales",
        "mdl_executivepanel",
      ]),
    );
    localStorage.setItem(
      "__unv_activeUser",
      JSON.stringify({
        id: "USR_DEMO",
        employeeId: "EMP_DEMO",
        username: "demo.owner@almazain.my.id",
        fullName: "DEMO GUEST USER",
        role: "SUPER_ADMIN",
      }),
    );
    window.location.href = "/app";
  };

  const scrollTo = (id: string, tab: "FILOSOFI" | "BANDING" | "MODUL" | "PAKET") => {
    setActiveSection(tab);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const comparisons = [
    {
      dimensi: "Filosofi Data",
      alma: "Merekam setiap perubahan sebagai fakta abadi yang tidak dapat diubah (Immutable Events).",
      crud: "Hanya merekam keadaan terkini. Data lama ditimpa dan hilang selamanya.",
      advantage: "ALMA menyimpan silsilah lengkap; CRUD hanya menyimpan foto terakhir.",
    },
    {
      dimensi: "Audit Trail & Forensik",
      alma: "Fitur bawaan dengan tanda tangan kriptografi digital & pemutaran waktu (Time-Travel).",
      crud: "Log teks pasif yang mudah dihapus atau tidak lengkap.",
      advantage: "Dapat memutar ulang transaksi ke detik tertentu saat audit.",
    },
    {
      dimensi: "Sumber Kebenaran",
      alma: "Event Store Abadi (Append-Only Log) dengan rantai Hash SHA-256 anti-manipulasi.",
      crud: "Tabel biasa yang baris datanya bisa di-update/delete secara bebas.",
      advantage: "Fakta transaksi terlindungi dari manipulasi diam-diam.",
    },
    {
      dimensi: "Kecepatan Kasir",
      alma: "Arsitektur CQRS (Jalur Tulis Transaksi & Jalur Baca Laporan terpisah 100%).",
      crud: "Model tunggal untuk baca dan tulis pada tabel relasional yang sama.",
      advantage: "Kasir secepat kilat (O(1)) tanpa terhambat kalkulasi laporan bulanan.",
    },
    {
      dimensi: "Offline-First",
      alma: "Native Local-First: Berjalan berhari-hari tanpa internet, sync otomatis saat online.",
      crud: "Bergantung pada koneksi internet aktif 24/7. Rentan gangguan jaringan.",
      advantage: "Kasir tetap melayani pelanggan 100% meski WiFi/internet padam.",
    },
    {
      dimensi: "Benturan Data Multi-Kasir",
      alma: "Mesin 3-Way Merge Otomatis + Hybrid Logical Clock (HLC) terdistribusi.",
      crud: "Last-Write-Wins (Data kasir terakhir menimpa perubahan sebelumnya tanpa jejak).",
      advantage: "Tidak pernah kehilangan data saat banyak kasir menginput bersamaan.",
    },
    {
      dimensi: "Keamanan Perangkat",
      alma: "Device Registry Kriptografis (Ed25519 Keypair) + Remote Kill Switch instan.",
      crud: "Hanya username & password standar tanpa proteksi mesin fisik.",
      advantage: "Tablet hilang/dicuri dapat langsung dibekukan dari jarak jauh.",
    },
    {
      dimensi: "Disaster Recovery",
      alma: "Ganti mesin baru, data 24 jam terakhir langsung pulih seketika dalam 30 detik.",
      crud: "Restore manual berjam-jam dari berkas backup yang rentan korup.",
      advantage: "Operasional cabang pulih instan saat terjadi musibah perangkat.",
    },
  ];

  const modulesList = [
    {
      icon: Building2,
      name: "Struktur Organisasi & SDM",
      badge: "Holding & Cabang",
      desc: "Hierarki perusahaan, regional, outlet, divisi, penugasan karyawan & dokumen KTP/NPWP.",
    },
    {
      icon: Package,
      name: "Master Item & Multi-Price",
      badge: "Katalog & Harga",
      desc: "Katalog produk dan jasa, multi-tier pricing per wilayah, satuan (UOM), dan varian konversi.",
    },
    {
      icon: Truck,
      name: "Pemasok & Hutang Dagang",
      badge: "Vendor Pemasok",
      desc: "Database vendor, rekening bank transfer, jadwal jatuh tempo nota, dan arsip dokumen legal.",
    },
    {
      icon: ArrowDownToLine,
      name: "Penerimaan Barang (Receiving)",
      badge: "Pembelian Masuk",
      desc: "Faktur pembelian bahan, kas kecil (pettycash), dan histori cicilan hutang dengan bukti transfer.",
    },
    {
      icon: CookingPot,
      name: "Gudang, Resep BOM & Spoil",
      badge: "Inventori & Dapur",
      desc: "Distribusi ke divisi, formula resep berjenjang (BOM), stok opname, dan pencatatan spoil/waste.",
    },
    {
      icon: Wallet,
      name: "Rekap Penjualan (PLU Sales)",
      badge: "Timbangan Kasir",
      desc: "Rekonsiliasi omset harian, pencocokan setoran fisik kasir, settlement EDC, dan deteksi selisih.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-orange-500 selection:text-white pb-20">
      {/* Top Header Mobile */}
      <header className="sticky top-0 z-50 px-4 py-3 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center font-black text-white text-base shadow-md">
            Z
          </div>
          <div>
            <span className="font-black text-sm text-white tracking-wider">ALMA</span>
            <span className="text-[9px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.2 rounded-full font-bold ml-1.5 uppercase">
              Mobile
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLaunchDemo}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition shadow-md flex items-center gap-1"
          >
            Demo <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Nav Pills Ringkas */}
      <div className="sticky top-13 z-40 px-3 py-2 bg-slate-950/90 backdrop-blur-md border-b border-white/5 flex gap-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => scrollTo("section-filosofi", "FILOSOFI")}
          className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
            activeSection === "FILOSOFI"
              ? "bg-orange-500 text-white font-black"
              : "text-slate-400 bg-white/5"
          }`}
        >
          Filosofi
        </button>
        <button
          onClick={() => scrollTo("section-perbandingan", "BANDING")}
          className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
            activeSection === "BANDING"
              ? "bg-orange-500 text-white font-black"
              : "text-slate-400 bg-white/5"
          }`}
        >
          Bandingkan
        </button>
        <button
          onClick={() => scrollTo("section-modul", "MODUL")}
          className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
            activeSection === "MODUL"
              ? "bg-orange-500 text-white font-black"
              : "text-slate-400 bg-white/5"
          }`}
        >
          6 Modul
        </button>
        <button
          onClick={() => scrollTo("section-paket", "PAKET")}
          className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
            activeSection === "PAKET"
              ? "bg-orange-500 text-white font-black"
              : "text-slate-400 bg-white/5"
          }`}
        >
          Paket & Harga
        </button>
      </div>

      {/* 1. HERO SECTION */}
      <section id="section-filosofi" className="px-4 pt-6 pb-8 space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-black text-orange-400 uppercase tracking-wide">
          <Sparkles className="w-3 h-3" /> Event Sourcing & Local-First ERP
        </div>

        <h1 className="text-3xl font-black text-white leading-tight tracking-tight">
          Bisnis Punya{" "}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-400 via-orange-500 to-amber-300">
            Sejarah.
          </span>
        </h1>

        <p className="text-xs text-slate-300 leading-relaxed font-medium">
          Platform ERP yang mencatat setiap mutasi kasir dan gudang sebagai{" "}
          <strong className="text-white">fakta abadi yang tidak dapat ditimpa</strong>. Menjawab bukan hanya{" "}
          <em>"Berapa sisa stok sekarang?"</em>, melainkan{" "}
          <em>"Bagaimana cerita di balik angka tersebut?"</em>.
        </p>

        {/* 3 Keunggulan Sentral */}
        <div className="space-y-2.5 pt-2">
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 flex items-start gap-3 backdrop-blur-md">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-xs text-white uppercase">100% Kebal Internet Mati</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Kasir & dapur tetap bisa catat transaksi saat WiFi mati. Sync otomatis saat online.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 flex items-start gap-3 backdrop-blur-md">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-xs text-white uppercase">Audit Trail Anti-Manipulasi</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Fakta bisnis dilindungi rantai Hash SHA-256 dan kunci kriptografi Ed25519 per mesin.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 flex items-start gap-3 backdrop-blur-md">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-xs text-white uppercase">Ganti Mesin Cepat 30 Detik</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Tablet kasir rusak? Ganti HP/mesin baru, data transaksi 24 jam terakhir langsung pulih.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <button
            onClick={() => handleGoToSetup()}
            className="w-full py-3.5 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
          >
            Mulai Setup Mesin Ini <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 2. PERBANDINGAN ALMA VS CRUD (CARD ACCORDION VIEW) */}
      <section id="section-perbandingan" className="px-4 py-6 border-t border-white/10 space-y-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            ALMA vs ERP Konvensional
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">
            Ketuk dimensi untuk melihat perbandingan mendalam
          </p>
        </div>

        <div className="space-y-2">
          {comparisons.map((c, idx) => {
            const isOpen = expandedDimIdx === idx;
            return (
              <div
                key={idx}
                className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md"
              >
                <button
                  type="button"
                  onClick={() => setExpandedDimIdx(isOpen ? null : idx)}
                  className="w-full p-3.5 flex items-center justify-between text-left transition hover:bg-white/5"
                >
                  <span className="font-black text-xs text-white uppercase flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    {c.dimensi}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      isOpen ? "rotate-180 text-orange-400" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3.5 space-y-2 text-xs border-t border-white/5 pt-2 animate-in fade-in">
                    <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 space-y-1">
                      <span className="text-[9px] font-black text-orange-400 uppercase tracking-wider block">
                        ALMA ERP (Event Sourcing)
                      </span>
                      <p className="text-[11px] text-slate-200 leading-relaxed font-semibold">
                        {c.alma}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                        ERP Konvensional (CRUD)
                      </span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {c.crud}
                      </p>
                    </div>

                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 font-bold text-[10px]">
                      Keunggulan: {c.advantage}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. MODUL BISNIS */}
      <section id="section-modul" className="px-4 py-6 border-t border-white/10 space-y-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            Ekosistem 6 Modul Bisnis
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">
            Terhubung reaktif tanpa jeda dari holding ke cabang
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {modulesList.map((m, i) => (
            <div
              key={i}
              className="p-3.5 bg-slate-900/80 border border-white/10 rounded-2xl flex items-start gap-3 backdrop-blur-md"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                <m.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="font-black text-xs text-white uppercase truncate">{m.name}</h3>
                  <span className="text-[8px] bg-white/5 text-slate-400 border border-white/10 px-1.5 py-0.2 rounded uppercase shrink-0">
                    {m.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {m.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. PAKET & LISENSI */}
      <section id="section-paket" className="px-4 py-6 border-t border-white/10 space-y-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            Pilihan Paket & Lisensi
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">
            Transparan, tanpa biaya tersembunyi per transaksi
          </p>
        </div>

        <div className="space-y-4">
          {/* Paket Free */}
          <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl space-y-3 backdrop-blur-md">
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[9px] font-black uppercase">
              Community / Gratis
            </span>
            <div>
              <h3 className="text-lg font-black text-white">Paket Free</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Cocok untuk UMKM, toko tunggal, dan kasir mandiri offline.
              </p>
            </div>
            <div className="space-y-1.5 text-xs text-slate-300 font-semibold pt-1">
              {["100% Gratis Selamanya", "7 Modul Bisnis Inti Lengkap", "Offline-First Tanpa Lisensi", "Export Excel & Cetak PDF"].map(
                (t, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{t}</span>
                  </div>
                ),
              )}
            </div>
            <button
              onClick={() => handleGoToSetup({ tier: "FREE" })}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider"
            >
              Mulai Gratis
            </button>
          </div>

          {/* Paket Premium */}
          <div className="p-4 bg-slate-900/90 border-2 border-orange-500/60 rounded-2xl space-y-3 relative shadow-xl shadow-orange-500/10 backdrop-blur-md">
            <div className="flex justify-between items-center">
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full text-[9px] font-black uppercase">
                Enterprise Offline
              </span>
              <span className="text-[8px] bg-linear-to-r from-orange-500 to-amber-500 text-white px-2 py-0.5 rounded-full font-black uppercase">
                Hemat 1 Bulan
              </span>
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Paket Premium</h3>
              <div className="text-xl font-black font-mono text-orange-400 mt-1">
                Rp 5.489.000{" "}
                <span className="text-xs text-slate-400 font-normal">/ tahun</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
                Setara Rp 457.000/bulan
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300 font-semibold pt-1">
              {[
                "Semua Fitur Paket Free",
                "Kunci Lisensi Ed25519 Offline-Safe",
                "Kuota Hingga 50 Perangkat / Kasir",
                "Sinkronisasi Antar-Cabang Otomatis",
                "Priority Support Sistem",
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span>{t}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setCheckoutTier("PREMIUM")}
              className="w-full py-3 bg-linear-to-r from-orange-500 to-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-orange-500/25"
            >
              Beli Lisensi Premium
            </button>
          </div>

          {/* Paket Custom Enterprise */}
          <div className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl space-y-3 backdrop-blur-md">
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-[9px] font-black uppercase">
              Enterprise & AI
            </span>
            <div>
              <h3 className="text-lg font-black text-white">Konsultasi Khusus</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Integrasi SOP Holding, AI Forecasting & Onboarding Langsung.
              </p>
            </div>
            <a
              href="https://wa.me/6285722027326?text=Halo%20Alma,%20saya%20ingin%20konsultasi%20langsung%20terkait%20solusi%20Enterprise%20ALMA%20ERP"
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
            >
              <Phone className="w-4 h-4" /> Hubungi via WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* 5. FOUNDER & KONTAK */}
      <section className="px-4 py-8 border-t border-white/10 text-center space-y-3">
        <blockquote className="text-sm font-bold text-slate-200 italic max-w-sm mx-auto">
          "Data hari ini adalah hasil dari kejadian kemarin. ALMA mengingat semuanya."
        </blockquote>
        <div className="text-xs font-black text-white">Rendi Faizal Dat</div>
        <div className="text-[10px] text-orange-400 font-mono">System Architect of ALMA</div>

        <div className="pt-2 flex justify-center gap-4 text-xs">
          <a
            href="mailto:rendifaizaldat@gmail.com"
            className="flex items-center gap-1.5 text-slate-300 hover:text-orange-400 font-mono text-[11px]"
          >
            <Mail className="w-3.5 h-3.5 text-orange-400" /> Email
          </a>
          <span className="text-slate-700">•</span>
          <a
            href="https://wa.me/6285722027326"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 font-mono text-[11px]"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400" /> 0857-2202-7326
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-4 px-4 text-center text-slate-600 text-[10px] font-mono border-t border-white/5">
        © {new Date().getFullYear()} ALMA Enterprise Platform. Mobile Edition.
      </footer>

      {/* CHECKOUT MODAL */}
      {checkoutTier && (
        <CheckoutModalSM
          tier={checkoutTier}
          companyId={upgradeCompanyId}
          onClose={() => {
            setCheckoutTier(null);
            setUpgradeCompanyId(null);
          }}
        />
      )}
    </div>
  );
};
