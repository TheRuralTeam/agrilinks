# Arquitetura e Estrutura do Projeto

Resumo rápido:

- Aplicação single-page React com Vite: front-end SPA em `src/`.
- Backend leve terceirizado: usa Supabase para backend/DB e Edge Functions (há workflow em `.github/workflows`).
- Deploy em Vercel (arquivo `vercel.json`) e integração com Lovable — fluxo de CI/CD não padronizado.

Observações detalhadas:

- Estrutura: a pasta `src/` contém `components/`, `pages/`, `layouts/`, `contexts/`, `features/` e `integrations/`. Isso é bom como ponto de partida, mas não há separação clara entre domínios (ex.: módulos de negócio, serviços, contratos/clients).
- Monolito front-end: componentes e páginas parecem misturar lógica de UI com lógica de negócio e integrações externas (Supabase, Mapbox). Recomendação: aplicar separação em camadas (UI → estado/feature → integração/clients).
- Deploy e infra: `vercel.json` define build/output; há GitHub Action para deploy de funções Supabase. Não há workflows para lint/test/build em PRs.
- Integração Lovable: o README indica que mudanças via Lovable são aplicadas automaticamente e podem sobrescrever o repositório. Isso pode causar inconsistência entre o que os desenvoladores alteram localmente e o que o sistema aplica.

Riscos arquiteturais:

- Ausência de contratos claros (OpenAPI/typed clients) entre frontend e backend — aumenta fragilidade em mudanças.
- Segredos e VAPID keys commitadas (ver `audit/security.md`) fazem a aplicação vulnerável.
- Sem CI de verificação em PR, regressões chegam ao main com facilidade.

Recomendações arquiteturais (próximos passos):

1. Documentar arquitetura: diagrama de componentes, fluxos de dados e mapa de integrações.
2. Definir boundaries por domínio (ex.: `features/products`, `features/auth`) com `services/*` responsáveis por comunicação externa.
3. Introduzir um cliente HTTP/SDK centralizado para Supabase e Mapbox e tipar todas as respostas com `zod`/tipos TS.
4. Bloquear deploys diretos de Lovable até que haja uma pipeline de validação (lint/tests) em PR.
5. Criar ambientes separados (dev/staging/prod) com configuração de secrets por ambiente.
