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
    // Adicione estas opções para debug
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, warn) {
        // Mostrar todos os warnings
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return;
        }
        console.log(`[Rollup Warning]: ${warning.message}`);
        warn(warning);
      },
    },
  },
  logLevel: 'info', // Mostrar mais logs
}));