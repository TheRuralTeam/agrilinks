# Segurança - Achados e Recomendações

ATENÇÃO: este projeto contém segredos committed no repositório. É crítico agir rápido.

Achados imediatos:

- Arquivo `.env` no repositório com chaves sensíveis (VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_URL, VITE_VAPID_PUBLIC_KEY, VITE_VAPID_PRIVATE_KEY). Veja [/.env](.env#L1-L5).
- VAPID private key commitada: chave privada usada para web-push exposta — compromete notificações push e permite envio indevido.
- Supabase publishable key e project id expostos; mesmo chaves "publicáveis" podem facilitar enumeração e riscos adicionais.
- GitHub Actions utiliza `SUPABASE_ACCESS_TOKEN` via secrets, isso está correto — mas o resto do projeto expõe chaves em `.env`.

Riscos imediatos:

- Chaves comprometidas permitem interação indesejada com backend (dependendo das regras do Supabase), abuso de push notifications e exposição de dados.
- Chaves privadas no histórico git permanecem mesmo após remoção do arquivo; é necessário limpar o histórico.

Passos de remediação imediatos (ordem crítica):

1. Rotacionar todas as chaves expostas agora (Supabase, VAPID). Invalide tokens e crie novos. Faça isso antes de qualquer outra alteração.
2. Remover `.env` do repositório e verificar `.gitignore` para incluí-lo. Se `.env` já estiver no git, remova do histórico com `git filter-repo` ou `git filter-branch` (preferível `git filter-repo`).
3. Substituir chaves no repositório por referências a variáveis de ambiente e usar secrets do provedor de hospedagem (Vercel, Supabase) e do CI.
4. Auditar logs de acessos e rebuscar por atividades suspeitas (deploys, API calls incomuns).

Recomendações de segurança gerais:

- Adotar scanning de dependências (Dependabot, Renovate) e integração com Snyk ou GitHub Advanced Security para CVE.
- Adotar análise estática de segurança (ESLint plugin for security, semgrep rules) para encontrar padrões vulneráveis.
- Segmentar permissões do Supabase (políticas RLS) para minimizar o impacto de chaves comprometidas.
- Não commit de chaves VAPID privadas nem outras credenciais; gerar e armazenar via secrets manager.
- Adicionar política de expiração para chaves e rotação regular.
