# Qualidade de Código e Configuração TypeScript/ESLint

Resumo rápido:

- `tsconfig.json` e `tsconfig.app.json` têm `strict` desabilitado e várias regras de `noImplicitAny`/`noUnused` desativadas.
- `eslint.config.js` desliga várias regras importantes (`@typescript-eslint/no-unused-vars`, `no-empty`, `no-explicit-any`).
- Não há configuração de formatação automática (ex.: Prettier) nem hooks (`husky`) para garantir formatação/lint em commits.

Problemas encontrados:

- Seguranças de tipo enfraquecidas: `strict: false`, `noImplicitAny: false` — isso permite bugs sutis e reduz benefícios do TypeScript.
- `allowJs: true` — pode permitir arquivos JS sem tipagem num projeto que já usa TS; revisar necessidade.
- ESLint: regras importantes estão desligadas; isso facilita código sujo e dívidas técnicas.
- Falta de lint-staged, hooks pre-commit, e pipeline CI que valide lint/build.
- Ausência de testes automatizados robustos (há vitest, mas não há integração CI).

Recomendações de qualidade e steps técnicos:

1. Habilitar `strict: true` no `tsconfig.app.json` e corrigir erros gradualmente (usar `--noEmit` e `tsc --noEmit`).
2. Reativar regras ESLint e alinhar com `@typescript-eslint` configs. Ex.: `@typescript-eslint/no-explicit-any` como warning primeiro.
3. Adicionar Prettier (ou usar `eslint --fix`) e configurar `husky` + `lint-staged` para bloquear commits mal formatados.
4. Escrever guideline de componentes e patterns (Atomic Design / shadcn conventions).
5. Introduzir testes unitários/integração incrementais: começar por serviços críticos (auth, pagamentos, contratos).
6. Automatizar checagens em PRs (build, lint, testes) antes de merge.

Nota: realizar a migração para `strict` pode demandar esforço; estimar tempo e aplicar em etapas (ex.: turn on `strictNullChecks` primeiro).
