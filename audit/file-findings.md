# Achados por arquivo

- [package.json](package.json#L1-L108): dependências e scripts básicos; `lint` definido, não há `format` ou `test` script explícito; `devDependencies` contêm `lovable-tagger` (dev-only). Verificar versão de `react` e `typescript`.
- [tsconfig.json](tsconfig.json#L1-L24) / [tsconfig.app.json](tsconfig.app.json#L1-L34): `strict` desabilitado, `allowJs: true` e outras flags relaxadas.
- [vite.config.ts](vite.config.ts#L1-L23): plugin `lovable-tagger` ativo em `development` — lembra que Lovable pode inserir modificações automáticas.
- [tailwind.config.ts](tailwind.config.ts#L1-L145): tokens e variáveis bem definidas — boa base para identidade visual.
- [.env](.env#L1-L5): contém chaves sensíveis (VITE_SUPABASE_*, VITE_VAPID_PRIVATE_KEY) — ação imediata requerida.
- [README.md](README.md#L1-L74): indica uso de Lovable e instruções básicas.
- [vercel.json](vercel.json#L1-L10): configuração de build e rewrites para SPA.
- [.github/workflows/deploy-supabase-functions.yml](.github/workflows/deploy-supabase-functions.yml#L1-L28): workflow para deploy de Supabase Edge Functions; usa secrets para `SUPABASE_ACCESS_TOKEN`.
- [eslint.config.js](eslint.config.js#L1-L31): regras que desativam várias verificações TypeScript/JS importantes.

Seções seguintes do relatório sumarizam impacto e propostas de remediação para cada grupo de arquivos.
