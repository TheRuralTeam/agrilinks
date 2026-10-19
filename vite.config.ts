import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function offlinePrecacheManifest(): Plugin {
  return {
    name: "agrilink-offline-precache",
    generateBundle(_options, bundle) {
      // Pré-cache apenas o grafo estático do ponto de entrada. Chunks de rotas
      // carregadas sob demanda (mapas, gráficos, PDFs e áreas administrativas)
      // são guardados pela estratégia runtime quando o utilizador os visita.
      // Assim, a primeira instalação offline não descarrega toda a aplicação.
      const staticChunks = new Set<string>();
      const visitStaticChunk = (fileName: string) => {
        if (staticChunks.has(fileName)) return;
        const output = bundle[fileName];
        if (!output || output.type !== "chunk") return;
        staticChunks.add(fileName);
        output.imports.forEach(visitStaticChunk);
      };

      for (const output of Object.values(bundle)) {
        if (output.type === "chunk" && output.isEntry) {
          visitStaticChunk(output.fileName);
        }
      }

      const assets = Object.keys(bundle).filter((file) => {
        const output = bundle[file];
        if (output?.type === "chunk") return staticChunks.has(file);
        // Estilos, fontes e imagens estáticas são pequenos recursos do shell.
        // Os chunks JS dinâmicos não entram nesta lista.
        return /\.(?:css|woff2?|ttf|svg|png|jpe?g|webp|ico)$/i.test(file);
      }).map((file) => `/${file}`);

      this.emitFile({
        type: "asset",
        fileName: "precache-manifest.json",
        source: JSON.stringify([...new Set(assets)]),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    offlinePrecacheManifest(),
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
          if (/\/node_modules\/(leaflet|react-leaflet|mapbox-gl|react-map-gl|@mapbox|@react-google-maps)\//.test(id)) return "maps";
          if (/\/node_modules\/(recharts|d3-[^/]+)\//.test(id)) return "charts";
          if (/\/node_modules\/(jspdf|html2canvas|canvg|dompurify)\//.test(id)) return "documents";
          if (/\/node_modules\/@fortawesome\//.test(id)) return "icons";
          if (/\/node_modules\/framer-motion\//.test(id)) return "motion";
          if (/\/node_modules\/(react-slick|slick-carousel)\//.test(id)) return "carousel";
          if (/\/node_modules\/@radix-ui\//.test(id)) return "radix-ui";
        },
      },
    },
  },
}));
