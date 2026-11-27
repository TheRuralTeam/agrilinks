# Performance e Build

Observações:

- Projeto usa Vite (rápido em dev) e `vite build` para produção. Configuração básica está em `vite.config.ts`.
- Uso de bibliotecas pesadas (Mapbox, recharts, jspdf) pode inflar bundle sem otimizações.

Recomendações de otimização:

1. Analisar bundle com `rollup-plugin-visualizer` / `vite build --stats` para identificar maiores dependências.
2. Aplicar lazy-loading em rotas/páginas pesadas (React.lazy + Suspense) e code-splitting em componentes que usam Mapbox/Charts.
3. Otimizar imagens: usar formatos modernos (WebP/AVIF) e gerar múltiplas resoluções.
4. Habilitar compressão e caching no CDN (headers) e configurar `vite build` para gerar assets com content-hash.
5. Remover polyfills desnecessários e verificar configuração `target` em `tsconfig` para balancear compatibilidade vs bundle.
