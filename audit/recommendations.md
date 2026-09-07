# Recomendações e Plano de Remediação

Prioridades imediatas (executar em até 24-72h):

1. Rotacionar e invalidar todas as chaves expostas e VAPID private key (ver `audit/security.md`).
2. Remover `.env` do repositório e limpar histórico git (usar `git filter-repo`).
3. Adicionar `.gitignore` e documentar como armazenar secrets (Vercel/Supabase secrets/CI secrets manager).

Prioridades de curto/medio prazo (1-4 semanas):

1. Habilitar `strict` no TypeScript em etapas e corrigir erros.
2. Introduzir CI: workflow de PR que roda lint, tests e build.
3. Configurar Dependabot/Renovate e rodar `npm audit` com remediação automática quando possível.
4. Adotar `husky` + `lint-staged` + Prettier para garantir estilo consistente.

Prioridades de médio/longo prazo (4-12 semanas):

1. Documentar arquitetura e criar um design system leve (componentes base + tokens).
2. Implementar cobertura de testes e criar testes E2E para fluxos críticos.
3. Otimizar bundle e aplicar lazy-loading em partes pesadas (mapas, charts).

Observação sobre Lovable: se continuar usando, crie uma etapa de validação automática no pipeline que valida PRs gerados por Lovable (lint, testes), e mantenha um processo de revisão humana antes de permitir merges automáticos.
