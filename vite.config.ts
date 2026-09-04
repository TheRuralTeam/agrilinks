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
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('mapbox-gl') || id.includes('@mapbox')) return 'mapbox';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('react')) return 'react-vendor';
          if (id.includes('@radix') || id.includes('framer-motion') || id.includes('lucide-react') || id.includes('sonner') || id.includes('next-themes')) return 'ui';
          if (id.includes('react-slick') || id.includes('slick-carousel') || id.includes('html2canvas') || id.includes('jspdf')) return 'media';
          if (id.includes('recharts') || id.includes('d3') || id.includes('victory')) return 'charts';

          return 'vendor';
        },
      },
    },
  },
}));
