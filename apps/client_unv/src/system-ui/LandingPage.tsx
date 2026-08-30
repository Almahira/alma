// File: apps/client_unv/src/system-ui/LandingPage.tsx
import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useScroll,
  useSpring,
  useTransform,
  HTMLMotionProps,
} from "framer-motion";
import { useNavigate } from "react-router-dom";

// =========================================================================
// LIQUID GLASS COMPONENT
// =========================================================================
interface LiquidGlassProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

const LiquidGlass: React.FC<LiquidGlassProps> = ({
  children,
  className = "",
  ...props
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const background = useMotionTemplate`radial-gradient(250px circle at ${mouseX}px ${mouseY}px, rgba(255, 255, 255, 0.15), transparent 80%)`;
  const borderHighlight = useMotionTemplate`radial-gradient(150px circle at ${mouseX}px ${mouseY}px, rgba(255, 165, 0, 0.3), transparent 80%)`;

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`relative overflow-hidden backdrop-blur-xl bg-white/2 border border-white/10 shadow-2xl ${className}`}
      {...props}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
        style={{
          background: borderHighlight,
          mixBlendMode: "overlay",
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),inset_0_-2px_4px_rgba(0,0,0,0.5)]" />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
};

// =========================================================================
// TIPE DATA PERBANDINGAN & MODUL
// =========================================================================
interface ComparisonItem {
  dimensi: string;
  alma: string;
  crud: string;
  advantage: string;
}

interface ModuleItem {
  icon: React.ElementType;
  name: string;
  badge: string;
  desc: string;
}

export interface LandingPageProps {
  onStartSetup?: (config?: {
    tier?: "FREE" | "PREMIUM" | "EXCLUSIVE";
    licenseKey?: string;
  }) => void;
}

// =========================================================================
// CHECKOUT MODAL (MIDTRANS SNAP + HASIL SERIAL LISENSI)
// =========================================================================
const CheckoutModal: React.FC<{
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

  const price = tier === "EXCLUSIVE" ? "Rp 1.499.000" : "Rp 499.000";

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

      if (
        (window as any).snap &&
        data.token &&
        !data.token.startsWith("DEV_")
      ) {
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
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-slate-100 shadow-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-black text-sm text-white uppercase">
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
          <div className="space-y-4 py-2">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase">
                <CheckCircle2 className="w-4 h-4" /> Pembayaran Berhasil!
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {companyId
                  ? `Seluruh perangkat milik ${companyName} telah otomatis di-upgrade via sinyal OTA!`
                  : `Kunci lisensi kriptografis telah dikirim ke email Anda (${email}):`}
              </p>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[10px] break-all text-orange-400 select-all relative group">
                {issuedKey}
                <button
                  onClick={handleCopyKey}
                  className="absolute top-2 right-2 p-1.5 bg-slate-800 rounded-md hover:bg-slate-700 text-slate-300 cursor-pointer"
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
              className="w-full py-3.5 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
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
                className="w-full text-xs font-bold p-2.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-orange-500"
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
                className="w-full text-xs font-bold p-2.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                Email Penerima Lisensi
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@company.com"
                className="w-full text-xs font-bold p-2.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                No. WhatsApp
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08123456789"
                className="w-full text-xs font-bold p-2.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:border-orange-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-orange-500/25 mt-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading
                ? "Menghubungkan Midtrans..."
                : "Bayar via Midtrans (QRIS / VA)"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// KOMPONEN UTAMA LANDING PAGE
// =========================================================================
export const LandingPage: React.FC<LandingPageProps> = ({ onStartSetup }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "FILOSOFI" | "BANDING" | "MODUL" | "PAKET"
  >("FILOSOFI");
  const [checkoutTier, setCheckoutTier] = useState<
    "PREMIUM" | "EXCLUSIVE" | null
  >(null);
  const [upgradeCompanyId, setUpgradeCompanyId] = useState<string | null>(null);

  // DETEKSI URL QUERY UNTUK IN-APP UPGRADE BRIDGE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "upgrade") {
      const companyId = params.get("companyId");
      setUpgradeCompanyId(companyId);
      setActiveTab("PAKET");
      setCheckoutTier("EXCLUSIVE");
    }
  }, []);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const bgY1 = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const bgY2 = useTransform(scrollYProgress, [0, 1], ["0%", "-20%"]);
  const textY = useTransform(scrollYProgress, [0, 0.2], ["0%", "30%"]);

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

  const comparisons: ComparisonItem[] = [
    {
      dimensi: "Filosofi Data",
      alma: "Merekam setiap perubahan sebagai fakta abadi yang tidak dapat diubah (Immutable Events).",
      crud: "Hanya merekam keadaan terkini. Data lama ditimpa dan hilang selamanya.",
      advantage:
        "ALMA menyimpan sejarah lengkap; sistem konvensional hanya menyimpan 'foto' terakhir.",
    },
    {
      dimensi: "Audit Trail & Forensik",
      alma: "Fitur bawaan, lengkap dengan tanda tangan kriptografi digital, dan dapat diputar ulang (Time-Travel).",
      crud: "Fitur tambahan berupa log teks pasif yang mudah dihapus atau tidak lengkap.",
      advantage:
        "ALMA bisa 'memutar waktu' ke detik tertentu untuk investigasi ketidakberesan.",
    },
    {
      dimensi: "Sumber Kebenaran",
      alma: "Event Store Abadi (Append-Only Log) dengan rantai Hash SHA-256 anti-manipulasi.",
      crud: "Tabel database biasa yang baris datanya bisa di-update atau di-delete secara liar.",
      advantage:
        "Data ALMA tidak bisa dimanipulasi atau dihilangkan begitu saja.",
    },
    {
      dimensi: "Pemrosesan Performa",
      alma: "Arsitektur CQRS (Jalur Tulis Transaksi & Jalur Baca Laporan terpisah 100%).",
      crud: "Model tunggal untuk baca dan tulis pada tabel relasional yang sama.",
      advantage:
        "Transaksi kasir secepat kilat (O(1)) tanpa terhambat kalkulasi laporan bulanan.",
    },
    {
      dimensi: "Penanganan Benturan Data",
      alma: "Mesin 3-Way Merge Otomatis + Hybrid Logical Clock (HLC) terdistribusi.",
      crud: "Last-Write-Wins (Data perangkat terakhir menimpa perubahan sebelumnya tanpa jejak).",
      advantage:
        "ALMA tidak pernah menghilangkan data saat banyak kasir mengedit bersamaan.",
    },
    {
      dimensi: "Sinkronisasi Offline",
      alma: "Native Local-First: Berjalan berhari-hari tanpa internet, sinkronisasi otomatis saat online.",
      crud: "Bergantung pada koneksi internet aktif 24/7. Sangat rentan gangguan jaringan.",
      advantage:
        "Bisnis tetap melayani pelanggan 100% saat koneksi WiFi atau internet mati.",
    },
    {
      dimensi: "Keamanan Perangkat",
      alma: "Device Registry Kriptografis (Ed25519 Keypair) + Remote Kill Switch instan.",
      crud: "Hanya username & password standar database biasa tanpa proteksi fisik perangkat.",
      advantage:
        "Perangkat hilang/dicuri dapat dinonaktifkan seketika dari jarak jauh.",
    },
    {
      dimensi: "Skalabilitas Bisnis",
      alma: "Skalabilitas tanpa batas (Dari 1 kasir hingga 500 cabang multi-holding).",
      crud: "Mulai melambat saat transaksi membesar; membutuhkan upgrade server terus-menerus.",
      advantage: "Arsitektur ALMA siap bertumbuh bersama skala bisnis Anda.",
    },
    {
      dimensi: "Evolusi Skema Data",
      alma: "Upcaster Engine: Skema berkembang dari V1 ke V3 tanpa perlu mematikan sistem (Zero Downtime).",
      crud: "Migrasi database berisiko tinggi dan sering memerlukan waktu henti operasional.",
      advantage:
        "Pembaruan modul dan penambahan fitur baru berjalan mulus tanpa mengganggu kasir.",
    },
    {
      dimensi: "Disaster Recovery",
      alma: "Pemulihan Cepat 24 Jam: Tablet rusak diganti mesin baru, data pulih instan 30 detik.",
      crud: "Restore manual berjam-jam dari backup berkas mentah yang rentan korup.",
      advantage:
        "Operasional cabang kembali berjalan seketika saat terjadi musibah perangkat.",
    },
  ];

  const modulesList: ModuleItem[] = [
    {
      icon: Building2,
      name: "Struktur Organisasi & SDM",
      badge: "Fondasi Bisnis",
      desc: "Manajemen berjenjang multi-holding, regional hub, outlet cabang, penempatan divisi, jabatan, dan role guard keamanan.",
    },
    {
      icon: Package,
      name: "Master Item & Multi-Price",
      badge: "Katalog & Harga",
      desc: "Katalog barang fisik dan jasa, multi-tier pricing per wilayah, satuan (UOM), dan pusat validasi anti-duplikasi.",
    },
    {
      icon: Truck,
      name: "Pemasok & Hutang Dagang",
      badge: "Mitra & Vendor",
      desc: "Pangkalan data vendor terpercaya, rekening bank pembayaran, dokumen legalitas, dan jadwal jatuh tempo nota.",
    },
    {
      icon: ArrowDownToLine,
      name: "Penerimaan Barang (Receiving)",
      badge: "Transaksi Pembelian",
      desc: "Pencatatan faktur barang masuk, kas kecil (pettycash), dan histori cicilan hutang dengan audit lampiran transfer.",
    },
    {
      icon: CookingPot,
      name: "Gudang, Resep BOM & Spoil",
      badge: "Inventori & Produksi",
      desc: "Distribusi bahan ke divisi, formula resep masakan bertingkat (BOM), pencatatan kerugian spoil/waste, dan stok opname berkala.",
    },
    {
      icon: Wallet,
      name: "Rekap Penjualan (PLU Sales)",
      badge: "Timbangan Kasir",
      desc: "Rekonsiliasi omset harian, pencocokan setoran fisik kasir, settlement EDC/QRIS, dan deteksi selisih uang laci otomatis.",
    },
  ];

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-orange-500 selection:text-white overflow-x-hidden">
      {/* BACKGROUND ANIMASI */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-cover bg-center scale-110"
          style={{
            y: bgY1,
            backgroundImage:
              "url('https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=2832&auto=format&fit=crop')",
            filter: "brightness(0.3) contrast(1.2) saturate(1.2)",
          }}
        />
        <div className="absolute inset-0 bg-linear-to-b from-slate-950/80 via-slate-950/60 to-slate-950" />
        <motion.div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-150 h-150 rounded-full bg-orange-500/10 blur-3xl"
          style={{ y: bgY2 }}
        />
        <motion.div
          className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl"
          style={{ y: bgY1 }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-125 h-125 rounded-full bg-purple-500/10 blur-3xl"
          style={{ y: bgY2 }}
        />
      </div>

      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-linear-to-r from-orange-500 to-amber-400 origin-left z-60"
        style={{ scaleX }}
      />

      <div className="relative z-10">
        {/* NAVBAR */}
        <LiquidGlass className="sticky top-4 z-50 mx-4 mt-4 rounded-2xl! bg-slate-950/30!">
          <header className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <span className="font-black text-white text-xl">Z</span>
              </div>
              <div>
                <span className="font-black text-lg text-white tracking-wider">
                  ALMA
                </span>
                <span className="text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full font-bold ml-2 uppercase">
                  Cloud Portal
                </span>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-400">
              {["FILOSOFI", "BANDING", "MODUL", "PAKET"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`hover:text-orange-400 transition cursor-pointer ${
                    activeTab === tab ? "text-orange-400" : ""
                  }`}
                >
                  {tab === "BANDING"
                    ? "Perbandingan"
                    : tab === "MODUL"
                      ? "Modul Bisnis"
                      : tab === "PAKET"
                        ? "Paket & Lisensi"
                        : "Filosofi"}
                </button>
              ))}
            </nav>
            <button
              onClick={() => handleGoToSetup()}
              className="px-5 py-2.5 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg flex items-center gap-2 cursor-pointer"
            >
              Aktivasi Mesin Kasir <ArrowRight className="w-4 h-4" />
            </button>
          </header>
        </LiquidGlass>

        {/* HERO SECTION */}
        <section className="relative pt-24 pb-24 px-6 overflow-hidden">
          <motion.div
            className="max-w-5xl mx-auto text-center relative z-10 space-y-6"
            style={{ y: textY }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/50 border border-white/10 backdrop-blur-md text-[11px] font-bold text-orange-400 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span>
                ARSITEKTUR EVENT SOURCING &amp; LOCAL-FIRST TERDISTRIBUSI
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white leading-tight">
              Bisnis Punya{" "}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-400 via-orange-500 to-amber-300">
                Sejarah.
              </span>
            </h1>
            <p className="text-base md:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed font-medium">
              Satu-satunya platform ERP yang mencatat setiap perubahan sebagai{" "}
              <strong className="text-white">
                fakta abadi yang tidak dapat ditimpa (immutable)
              </strong>
              . Menjawab bukan hanya <em>"Berapa stok sekarang?"</em>, melainkan{" "}
              <em>"Bagaimana cerita di balik angka tersebut?"</em>.
            </p>

            {/* 3 Keunggulan Utama */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto pt-8 text-left">
              {[
                {
                  icon: Wifi,
                  color: "emerald",
                  title: "100% Kebal Internet Mati",
                  desc: "Kasir & gudang tetap melayani transaksi saat jaringan putus total.",
                },
                {
                  icon: ShieldCheck,
                  color: "orange",
                  title: "Jejak Audit Anti-Manipulasi",
                  desc: "Dilindungi rantai Hash SHA-256 dan identitas perangkat Ed25519.",
                },
                {
                  icon: Zap,
                  color: "blue",
                  title: "Pemulihan Instan 30 Detik",
                  desc: "Tablet rusak? Ganti mesin baru, data 24 jam terakhir pulih seketika.",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                >
                  <LiquidGlass className="p-5 rounded-2xl group h-full">
                    <div className="flex items-center gap-2 font-black text-xs mb-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${item.color}-500/20 border border-${item.color}-500/30`}
                      >
                        <item.icon
                          className={`w-4 h-4 text-${item.color}-400`}
                        />
                      </div>
                      <span className={`text-${item.color}-400`}>
                        {item.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </LiquidGlass>
                </motion.div>
              ))}
            </div>

            <div className="pt-8 flex justify-center gap-4">
              <button
                onClick={() => handleGoToSetup()}
                className="px-8 py-4 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-orange-500/30 flex items-center gap-2 cursor-pointer"
              >
                Mulai Konfigurasi Mesin <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </section>

        {/* SIMULASI VISUAL */}
        <section className="py-16 px-6">
          <div className="max-w-6xl mx-auto space-y-8">
            <motion.div
              className="text-center space-y-2"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-black text-white uppercase tracking-wide">
                Ilustrasi Sederhana: Bagaimana Angka Tercipta?
              </h2>
              <p className="text-sm text-slate-400 font-medium max-w-2xl mx-auto">
                Perbedaan mendasar antara sistem yang hanya menyimpan foto data
                terakhir vs sistem yang merekam seluruh rangkaian peristiwa
                sejarah.
              </p>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* Sistem Konvensional */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <LiquidGlass className="p-6 rounded-3xl h-full flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                      <span className="font-black text-xs text-rose-400 uppercase tracking-wider">
                        Sistem Konvensional (CRUD)
                      </span>
                      <XCircle className="w-5 h-5 text-rose-500" />
                    </div>
                    <div className="py-6 text-center space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase block">
                        Data di Tabel Database:
                      </span>
                      <div className="text-5xl font-black font-mono text-slate-200">
                        Stok: 80 Porsi
                      </div>
                      <p className="text-xs text-rose-400 font-medium mt-4">
                        ⚠️ Anda hanya tahu stoknya 80, tapi tidak tahu bagaimana
                        bisa menjadi 80, siapa yang mengubah, atau apakah ada
                        kecurangan.
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950/50 rounded-xl text-[11px] text-slate-500 font-mono border border-white/5">
                    &gt; UPDATE items SET stock = 80 WHERE id = 'AYAM_01'; (Data
                    lama tertimpa permanen)
                  </div>
                </LiquidGlass>
              </motion.div>

              {/* Sistem ALMA */}
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <LiquidGlass className="p-6 rounded-3xl h-full flex flex-col justify-between group border-orange-500/30 shadow-xl shadow-orange-500/10">
                  <div>
                    <div className="flex items-center justify-between border-b border-orange-500/20 pb-3 mb-4">
                      <span className="font-black text-xs text-orange-400 uppercase tracking-wider">
                        Sistem ALMA (Event Sourcing)
                      </span>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="py-3 space-y-3 text-xs">
                      <span className="text-[10px] font-black text-slate-400 uppercase block">
                        Rangkaian Sejarah Fakta Bisnis Abadi:
                      </span>
                      <div className="space-y-2 font-mono">
                        {[
                          {
                            seq: "#1",
                            text: "1. +100 Pembelian (Receiving Masuk)",
                            color: "text-emerald-400",
                          },
                          {
                            seq: "#2",
                            text: "2. -15 Penjualan Kasir POS",
                            color: "text-rose-400",
                          },
                          {
                            seq: "#3",
                            text: "3. -5 Spoil/Basi Terbuang (QC Dapur)",
                            color: "text-amber-400",
                          },
                        ].map((e, i) => (
                          <div
                            key={i}
                            className="p-2 bg-slate-950/50 rounded-lg border border-white/5 flex justify-between"
                          >
                            <span className={e.color}>{e.text}</span>
                            <span className="text-slate-600 text-[10px]">
                              Seq {e.seq}
                            </span>
                          </div>
                        ))}
                        <div className="p-2.5 bg-linear-to-r from-orange-500/20 to-amber-500/20 rounded-lg border border-orange-500/40 flex justify-between font-black text-white text-sm">
                          <span>= SISA STOK AKHIR: 80 PORSI</span>
                          <span className="text-orange-400 font-bold text-xs">
                            Verified
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-400 font-medium mt-4">
                    ✓ Setiap angka memiliki silsilah yang jelas, dapat
                    ditelusuri ke aktor aslinya, dan sah secara audit.
                  </p>
                </LiquidGlass>
              </motion.div>
            </div>
          </div>
        </section>

        {/* TABEL PERBANDINGAN */}
        <section className="py-16 px-6 max-w-7xl mx-auto">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
              ALMA vs ERP Konvensional
            </h2>
            <p className="text-sm text-slate-400 max-w-2xl mx-auto">
              Mengapa arsitektur modern berbasis peristiwa menjadi standar baru
              bagi bisnis yang membutuhkan keandalan tanpa kompromi.
            </p>
          </div>
          <LiquidGlass className="rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase font-black tracking-wider text-slate-400 bg-white/5">
                    <th className="p-4 w-48">Dimensi Kritis</th>
                    <th className="p-4 text-orange-400 bg-orange-500/5">
                      ALMA (Event Sourcing &amp; CQRS)
                    </th>
                    <th className="p-4 text-slate-400">
                      ERP Konvensional (CRUD)
                    </th>
                    <th className="p-4 text-emerald-400">Keunggulan ALMA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {comparisons.map((c, i) => (
                    <motion.tr
                      key={i}
                      className="hover:bg-white/3 transition"
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <td className="p-4 font-bold text-white whitespace-nowrap">
                        {c.dimensi}
                      </td>
                      <td className="p-4 text-slate-200 bg-orange-500/5 font-semibold leading-relaxed">
                        {c.alma}
                      </td>
                      <td className="p-4 text-slate-500 leading-relaxed">
                        {c.crud}
                      </td>
                      <td className="p-4 text-emerald-400 font-bold leading-relaxed">
                        {c.advantage}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </LiquidGlass>
        </section>

        {/* MODUL BISNIS */}
        <section className="py-16 px-6">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
                Ekosistem Modul Bisnis
              </h2>
              <p className="text-sm text-slate-400 max-w-xl mx-auto">
                Seluruh modul terhubung secara reaktif tanpa jeda, siap
                menggerakkan seluruh lini operasional holding hingga unit
                cabang.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {modulesList.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <LiquidGlass className="p-6 rounded-2xl h-full group hover:border-orange-500/40">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-linear-to-br from-orange-500/20 to-orange-500/5 border border-orange-500/30 text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <m.icon className="w-6 h-6" />
                      </div>
                      <span className="text-[9px] font-black uppercase text-slate-400 bg-white/5 px-2 py-1 rounded border border-white/10">
                        {m.badge}
                      </span>
                    </div>
                    <h3 className="font-black text-base text-white mb-2">
                      {m.name}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {m.desc}
                    </p>
                  </LiquidGlass>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* PAKET & LISENSI */}
        <section className="py-16 px-6 max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
              Pilihan Paket &amp; Lisensi
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Mulai dari versi gratisan mandiri hingga paket enterprise
              berlisensi kriptografis lengkap dengan kecerdasan buatan.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* Tier Free */}
            <LiquidGlass className="p-7 rounded-3xl h-full flex flex-col justify-between group">
              <div className="space-y-4">
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase">
                  COMMUNITY / OPEN-SOURCE
                </span>
                <h3 className="text-2xl font-black text-white">Paket Free</h3>
                <p className="text-xs text-slate-400">
                  Cocok untuk UMKM, toko tunggal, dan bisnis rintisan yang
                  membutuhkan sistem kasir &amp; inventori tangguh tanpa biaya.
                </p>
                <div className="space-y-2 text-xs font-semibold text-slate-300 pt-2">
                  {[
                    "100% Gratis Selamanya",
                    "7 Modul Bisnis Inti Lengkap",
                    "Offline-First Tanpa Kunci Lisensi",
                    "Export Excel & Cetak PDF",
                  ].map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleGoToSetup({ tier: "FREE" })}
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider transition mt-6 cursor-pointer"
              >
                Mulai Gratis
              </button>
            </LiquidGlass>

            {/* Tier Premium */}
            <LiquidGlass className="p-7 rounded-3xl h-full flex flex-col justify-between relative border-2 border-orange-500/50 shadow-2xl shadow-orange-500/20 group">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-linear-to-r from-orange-500 to-amber-500 text-white text-[9px] font-black uppercase rounded-full shadow">
                PALING POPULER
              </div>
              <div className="space-y-4">
                <span className="px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full text-[10px] font-black uppercase">
                  ENTERPRISE OFFLINE
                </span>
                <h3 className="text-2xl font-black text-white">
                  Paket Premium
                </h3>
                <div className="text-2xl font-black font-mono text-orange-400">
                  Rp 499.000{" "}
                  <span className="text-xs text-slate-400 font-normal">
                    / tahun
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Untuk grup bisnis multi-cabang, manufaktur, dan perusahaan
                  yang membutuhkan fitur lanjutan berlisensi kriptografis.
                </p>
                <div className="space-y-2 text-xs font-semibold text-slate-300 pt-2">
                  {[
                    "Semua Fitur Paket Free",
                    "Modul Multi-Gudang & Transfer",
                    "Modul Manufaktur & Produksi",
                    "Kunci Lisensi Ed25519 (Offline Safe)",
                  ].map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-orange-400" /> {t}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setCheckoutTier("PREMIUM")}
                className="w-full py-3 bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg mt-6 cursor-pointer"
              >
                Beli Lisensi Premium
              </button>
            </LiquidGlass>

            {/* Tier Exclusive AI */}
            <LiquidGlass className="p-7 rounded-3xl h-full flex flex-col justify-between group">
              <div className="space-y-4">
                <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-[10px] font-black uppercase">
                  AI CLOUD PLATFORM
                </span>
                <h3 className="text-2xl font-black text-white">
                  Paket Eksklusif
                </h3>
                <div className="text-2xl font-black font-mono text-blue-400">
                  Rp 1.499.000{" "}
                  <span className="text-xs text-slate-400 font-normal">
                    / tahun
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Dilengkapi asisten kecerdasan buatan untuk prediksi omset,
                  audit struk belanja otomatis, dan gateway notifikasi.
                </p>
                <div className="space-y-2 text-xs font-semibold text-slate-300 pt-2">
                  {[
                    "Semua Fitur Premium",
                    "AI Sales & Stock Forecasting",
                    "AI OCR Pindai Struk Pembelian",
                    "WhatsApp Gateway Otomatis",
                  ].map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" /> {t}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setCheckoutTier("EXCLUSIVE")}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition mt-6 cursor-pointer"
              >
                Beli Lisensi Eksklusif AI
              </button>
            </LiquidGlass>
          </div>
        </section>

        {/* FOUNDER & KONTAK */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-orange-500 to-amber-500 flex items-center justify-center mx-auto shadow-xl shadow-orange-500/30">
              <span className="font-black text-white text-3xl">Z</span>
            </div>
            <blockquote className="text-lg md:text-2xl font-bold text-slate-200 italic max-w-2xl mx-auto">
              "Data hari ini adalah hasil dari kejadian kemarin. ALMA mengingat
              semuanya."
            </blockquote>
            <div className="space-y-1">
              <div className="text-sm font-black text-white tracking-wide">
                Rendi Faizal Dat
              </div>
              <div className="text-xs text-orange-400 font-bold font-mono">
                System Architect &amp; Founder of ALMA
              </div>
            </div>
            <LiquidGlass className="p-6 rounded-2xl max-w-lg mx-auto group">
              <div className="flex flex-col sm:flex-row items-center justify-around gap-4 text-xs font-mono">
                <a
                  href="mailto:rendifaizaldat@gmail.com"
                  className="flex items-center gap-2 text-slate-300 hover:text-orange-400 transition"
                >
                  <Mail className="w-4 h-4 text-orange-500" />{" "}
                  rendifaizaldat@gmail.com
                </a>
                <div className="hidden sm:block h-4 w-px bg-white/10" />
                <a
                  href="https://wa.me/6285722027326"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition"
                >
                  <Phone className="w-4 h-4 text-emerald-500" /> 0857-2202-7326
                </a>
              </div>
            </LiquidGlass>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="py-6 px-6 text-center text-slate-600 text-xs font-mono border-t border-white/5 mt-10 backdrop-blur-sm">
          © {new Date().getFullYear()} ALMA Enterprise Platform. Designed for
          uninterrupted business continuity.
        </footer>
      </div>

      {/* CHECKOUT MODAL */}
      {checkoutTier && (
        <CheckoutModal
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
