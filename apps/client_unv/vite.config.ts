// File: apps/client_unv/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import packageJson from "./package.json";

const now = new Date();
const buildDate = now.toISOString().slice(0, 10).replace(/-/g, "");

export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    __APP_VERSION__: JSON.stringify((packageJson as any).version || "2.1.0"),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  server: {
    port: 3010,
    strictPort: true,
  },
  esbuild: {
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
  },
});
