import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("/node_modules/")) return;

          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "framework";
          if (/\/node_modules\/@supabase\//.test(id)) return "supabase";
          if (/\/node_modules\/(leaflet|react-leaflet|mapbox-gl|react-map-gl|@mapbox)\//.test(id)) return "maps";
          if (/\/node_modules\/(recharts|d3-[^/]+)\//.test(id)) return "charts";
          if (/\/node_modules\/(jspdf|html2canvas|canvg|dompurify)\//.test(id)) return "documents";
          if (/\/node_modules\/@radix-ui\//.test(id)) return "radix-ui";
        },
      },
    },
  },
}));
