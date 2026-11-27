## Auditoria UI — Panorama inicial

Resumo rápido:
- Objetivo: revisar manualmente cada página UI e eliminar artefatos de design antigo, inline styles problemáticos e dependências de código `legacy/` que causem flashes ou inconsistência visual.
- Escopo inicial: pasta `src/pages/` e componentes relevantes em `src/components/`.

Principais tipos de achados (amostra):
- Uso extensivo de `style={{ ... }}` inline (cores, backgrounds, bordas, sombras) — encontrado em muitas páginas (AppHome, Login, MapView, MarketData, UserProfile, etc.).
- Imports ou arquivos dentro de `legacy/` (ex.: `legacy/src/pages/Login.tsx`, `legacy/src/components/...`) — existem wrappers, revisar se ainda são usados.
- Presença de tokens temáticos via objeto `T` (boa prática), mas aplicados inline em vez de via classes/CSS variables.
- Regras antigas de ocultação removidas (atendidas): não há mais `.initial-hidden` em `index.html`.

Riscos e recomendações:
- Inline styles dificultam consistência de tema e manutenção; recomendo extrair cores e backgrounds para CSS/Tailwind usando variáveis (`--bg`, `--card-bg`) e classes utilitárias.  
- Substituir gradientes e backgrounds por classes utilitárias (ou CSS variables) para garantir comportamento idêntico entre modo claro/escuro.
- Remover/atualizar referências a `legacy/` quando existirem equivalentes atualizados em `src/`.
- Validar manualmente fluxos críticos (Login, export PDF em `TechnicalSheet`) após mudanças.

Páginas prioritárias (ordem sugerida para revisão manual):
1. `src/pages/AppHome.tsx` — muitos `style=` e blocos de shimmer.
2. `src/pages/Login.tsx` (legacy copia em `legacy/`) — múltiplos backgrounds inline e elementos posicionados absolutamente.
3. `src/pages/MapView.tsx` — cartões e modais com `style=`.
4. `src/pages/MarketData.tsx` — badges e loaders com estilos inline.
5. `src/pages/UserProfile.tsx` — botões e cards com estilos inline.
6. `src/pages/TechnicalSheet.tsx` — export PDF (checar `jspdf` alteração após build).

Próximo passo proposto (manual, conforme solicitado):
- Abro `src/pages/AppHome.tsx`, removo/extraio `style=` mais críticos que definem `background`/`minHeight`/`borderRadius` e substituo por classes/Tokens CSS. Testo localmente (build) e crio commit por página.

Se autorizar, começo aplicando as mudanças em `src/pages/AppHome.tsx` e envio o patch.

— auditoria gerada automaticamente por análise de código (resumo inicial). Ajustes manuais serão feitos sob sua autorização.
