import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    cssMinify: true,
    rollupOptions: {
      output: {
        // Split heavy libraries into their own chunks so map pages don't
        // pay for blog/analytics deps and vice versa. Keeps the initial
        // landing-page payload tight while still letting the browser cache
        // each vendor chunk across route loads.
        manualChunks: {
          leaflet: ["leaflet", "supercluster"],
          charts: ["recharts"],
          motion: ["framer-motion"],
          markdown: ["react-markdown", "remark-gfm"],
        },
      },
    },
  },
}));
