# Testes e CI/CD

Achados:

- `vitest` está configurado (`vitest.config.ts`) e `test/setup.ts` existe; porém não há GitHub Actions que rodem testes/lint/build para PRs (apenas workflow para deploy de funções Supabase).
- Não há regras de proteção de branch visíveis (exigir checks) no repositório.

Recomendações:

1. Criar workflow de CI que rode: `npm ci`, `npm run lint`, `npm test`, `npm run build` em PRs e no main antes do deploy.
2. Adicionar cobertura de testes e falhar PRs quando cobertura cair abaixo do limiar (ex.: 70%).
3. Implementar `husky` + `lint-staged` para prevenir commits que quebrem lint/tests localmente.
4. Adicionar testes end-to-end (Playwright) para fluxos críticos como login, publish product e checkout.
