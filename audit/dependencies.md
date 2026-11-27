# Dependências e Gestão de Versões

Resumo:

- O `package.json` contém muitas dependências (UI primitives, Radix, Mapbox, Supabase, react-query, charting libs, etc.). Veja [package.json](package.json#L1-L108).
- Há `bun.lockb` e `package-lock.json` no repositório — isso pode indicar uso múltiplo de gestores (npm, bun). Padronize para um único gerenciador.

Problemas e riscos:

- Possível drift entre lockfiles e gerenciadores; isso pode causar builds diferentes em ambientes distintos.
- Dependências com versões maiores recentes podem ter breaking changes; não há estratégia visível de upgrade automático (Dependabot/renovate).
- nenhum passo automatizado para `npm audit` ou verificação de CVEs no CI.

Recomendações:

1. Padronizar o gerenciador de pacotes (npm, pnpm ou bun). Remover lockfile(s) não usados e documentar o fluxo de instalação.
2. Habilitar Dependabot ou Renovate para PRs automáticos de atualização de dependências e monitoramento de vulnerabilidades.
3. Executar `npm audit` e/ou usar `snyk` para avaliar CVEs; corrigir dependências críticas rapidamente.
4. Consolidar versões de libs e remover dependências não utilizadas (rodar `depcheck` ou ferramenta equivalente).
