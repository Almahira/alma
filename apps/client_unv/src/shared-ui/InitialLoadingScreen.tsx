import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { ServerCog } from "lucide-react";

interface InitialLoadingScreenProps {
  onFinish: () => void;
  duration?: number;
}

export const InitialLoadingScreen: React.FC<InitialLoadingScreenProps> = ({
  onFinish,
  duration = 5,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, duration * 1000);

    return () => clearTimeout(timer);
  }, [onFinish, duration]);

  // Konfigurasi gelembung udara dalam cairan
  const bubbles = Array.from({ length: 6 });

  // Konfigurasi tetesan percikan (Splashes)
  const splashes = Array.from({ length: 4 });

  return (
    <motion.div
      className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden bg-slate-950"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
    >
      {/* ========================================================================= */}
      {/* BACKGROUND CAIR (Glow & Refraksi) */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-200 rounded-full bg-orange-500/20 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl"
          animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* ========================================================================= */}
      {/* LOGO KACA HIDUP (Liquid Glass) */}
      {/* ========================================================================= */}
      <motion.div
        initial={{ scale: 0, rotate: -180, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
        className="relative mb-8"
      >
        {/* Ring Pulse Tenggelam */}
        <motion.div
          className="absolute inset-0 rounded-3xl border border-orange-500/50"
          initial={{ opacity: 0.8, scale: 1 }}
          animate={{ opacity: 0, scale: 2.5 }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />

        {/* Kotak Kaca */}
        <div className="relative w-24 h-24 rounded-3xl backdrop-blur-xl bg-white/3 border border-white/20 flex items-center justify-center shadow-2xl overflow-hidden">
          {/* Refraksi dalam kaca */}
          <div className="absolute -inset-2 bg-linear-to-br from-orange-500/30 via-transparent to-blue-500/20 opacity-50 blur-md"></div>
          <div className="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/20 to-transparent rounded-t-3xl"></div>

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="relative z-10"
          >
            <ServerCog className="w-12 h-12 text-orange-400 drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]" />
          </motion.div>
        </div>
      </motion.div>

      {/* ========================================================================= */}
      {/* TEKS & JUDUL */}
      {/* ========================================================================= */}
      <motion.h1
        className="text-4xl font-extrabold tracking-tight text-white relative z-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{ textShadow: "0 0 20px rgba(249, 115, 22, 0.3)" }}
      >
        Alma{" "}
        <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-400 to-amber-300">
          Zain
        </span>
      </motion.h1>

      <motion.p
        className="text-[10px] font-bold text-slate-400 tracking-[0.3em] uppercase mt-3 relative z-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        Provisioning Liquid System
      </motion.p>

      {/* ========================================================================= */}
      {/* LIQUID GLASS PROGRESS BAR (Tabung Kaca Berisi Air Mengalir) */}
      {/* ========================================================================= */}
      <motion.div
        className="absolute bottom-16 w-80 max-w-[80vw] z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        {/* Struktur Tabung Kaca */}
        <div className="relative w-full h-10 rounded-full overflow-hidden backdrop-blur-md bg-white/2 border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),inset_0_-2px_4px_rgba(0,0,0,0.5)]">
          {/* Cairan / Water Fill */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-orange-600 via-orange-500 to-amber-400 shadow-[0_0_20px_rgba(249,115,22,0.6)]"
            initial={{ height: "0%" }}
            animate={{ height: "100%" }}
            transition={{ duration: duration, ease: "easeInOut" }}
          >
            {/* Permukaan Gelombang Air (SVG) */}
            <div className="absolute -top-3 left-0 right-0 h-6 w-[200%] overflow-hidden">
              <motion.svg
                className="absolute h-full w-full"
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
                animate={{ x: ["0%", "-50%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                style={{ fill: "url(#liquid-gradient)" }}
              >
                <path d="M0,10 Q25,0 50,10 T100,10 T150,10 T200,10 V20 H0 Z" />
                <defs>
                  <linearGradient
                    id="liquid-gradient"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
              </motion.svg>

              {/* Gelombang Kedua untuk efek lapisan (Lebih transparan) */}
              <motion.svg
                className="absolute h-full w-full opacity-50"
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
                animate={{ x: ["-50%", "0%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                fill="rgba(255,255,255,0.4)"
              >
                <path d="M0,10 Q25,20 50,10 T100,10 T150,10 T200,10 V20 H0 Z" />
              </motion.svg>
            </div>

            {/* Gelembung Udara dalam Air */}
            {bubbles.map((_, i) => (
              <motion.div
                key={i}
                className="absolute bottom-0 rounded-full bg-white/40 backdrop-blur-sm"
                style={{
                  width: `${Math.random() * 6 + 4}px`,
                  height: `${Math.random() * 6 + 4}px`,
                  left: `${Math.random() * 90 + 5}%`,
                }}
                animate={{
                  y: ["0%", "-500%"],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: Math.random() * 2 + 1.5,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                  ease: "easeOut",
                }}
              />
            ))}
          </motion.div>

          {/* Percikan Tetesan Air (Splashes) - Muncul seiring naiknya cairan */}
          {splashes.map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_5px_rgba(251,191,36,0.8)]"
              style={{ left: `${15 + i * 25}%` }}
              initial={{ bottom: "10%", opacity: 0 }}
              animate={{
                bottom: ["10%", `${Math.random() * 40 + 40}%`, "10%"],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.4 + 0.5,
                ease: "easeOut",
              }}
            />
          ))}

          {/* Highlight Kaca di Tengah Tabung */}
          <div className="absolute inset-y-0 left-2 w-1/4 bg-linear-to-r from-white/20 to-transparent pointer-events-none"></div>
        </div>

        {/* Persentase Loading */}
        <motion.div
          className="absolute -top-6 right-0 text-xs font-mono font-bold text-orange-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <CountUp duration={duration} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

// Komponen Kecil untuk Animasi Angka Persentase
const CountUp: React.FC<{ duration: number }> = ({ duration }) => {
  const [count, setCount] = React.useState(0);

  useEffect(() => {
    const end = 100;
    const startTime = Date.now();

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // Easing function untuk membuat angka berjalan natural
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(eased * end));

      if (progress >= 1) clearInterval(timer);
    }, 30);

    return () => clearInterval(timer);
  }, [duration]);

  return <span>{count}%</span>;
};
