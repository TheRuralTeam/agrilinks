# Remediação de vulnerabilidades npm — 19/11/2026

## Resultado

- Auditoria inicial: **27 vulnerabilidades** — 3 críticas, 6 altas, 17 moderadas e 1 baixa.
- Auditoria final no GitHub Actions: **0 vulnerabilidades** — 0 críticas, 0 altas, 0 moderadas e 0 baixas.
- Execução validada: CI #1220, incluindo `npm ci`, `npm audit --audit-level=low`, Deno checks, lint, TypeScript strict, testes e build.
- O `package-lock.json` gerado no mesmo job foi gravado na branch após a validação.

## Dependências directas actualizadas

| Dependência | Versão |
|---|---:|
| `vite` | 8.3.8 |
| `@vitejs/plugin-react-swc` | 4.3.3 |
| `vitest` | 5.1.1 |
| `react-router-dom` / `react-router` | 7.18.6 |
| `zod` | 4.6.7 |
| `@hookform/resolvers` | 7.0.7 |
| `lint-staged` | 17.6.1 |
| `@tailwindcss/typography` | 0.5.4 |

## Dependências transitivas corrigidas

O lockfile contém, entre outras, versões corrigidas de `body-parser` 1.20.9, `brace-expansion` 5.0.13, `dompurify` 3.4.18, `follow-redirects` 1.16.3, `minimatch` 11.0.9, `postcss-selector-parser` 6.1.6, `proxy-addr` 2.0.8 e `qs` 6.17.1.

O override de `qs` mantém a versão 6.17.1 em toda a árvore de dependências.

## Controlos de supply chain

O Deno mantém a idade mínima padrão de 24 horas para dependências npm/JSR. A excepção é limitada aos pacotes `react-router` e `react-router-dom`, porque a versão 7.18.6 é a versão corrigida para os avisos recentes do React Router e ainda estava dentro da janela de 24 horas quando o CI foi executado. A excepção não desactiva a política para os restantes pacotes.

O CI foi tornado não-mutável depois da remediação: instala estritamente a partir do lockfile e falha se `npm audit --audit-level=low` encontrar qualquer vulnerabilidade. As actualizações de dependências deixam de ser aplicadas automaticamente durante builds futuros.

## Compatibilidade

O pipeline completo passou com as versões corrigidas:
- Deno type-check das Edge Functions de e-mail;
- Deno type-check das Edge Functions multiagente;
- testes de validação multiagente;
- ESLint;
- TypeScript strict;
- suite Vitest;
- build Vite.

As alterações permanecem na PR #67, ainda sem merge e sem deploy de Edge Functions ou migration na produção.
