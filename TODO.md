# TODO - Resolver erros (conflitos) no code

## Plano aprovado
- Corrigir primeiro os erros que travam build/execução (TypeScript/ESLint `no-explicit-any`, `no-unused-expressions`, `no-empty`).
- Focar em arquivos com maior impacto: `src/contexts/AuthContext.tsx`, `src/hooks/useCanAct.ts`, e `src/pages/AdminDashboard.tsx`.
- Depois reduzir o volume de erros substituindo `any` por tipos explícitos e removendo expressões vazias.

## Passos (executar nesta ordem)
1. [ ] Atualizar `src/contexts/AuthContext.tsx`: remover `any` (ex.: `catch (err)` se necessário; há `catch (err: any)` e um campo `p.metadata` / casts).
2. [ ] Atualizar `src/hooks/useCanAct.ts`: remover `any` usando tipo correto para `email_confirmed_at`/`emailVerified`.
3. [ ] Atualizar `src/pages/AdminDashboard.tsx`: remover `any` (ex.: `.map((r: any) => ...)`, `new Map<string, any>()`, `upd: any`, `setter: Function`).
4. [ ] Corrigir `@typescript-eslint/no-unused-expressions` e `no-empty` nos mesmos arquivos, quando aparecerem.
5. [ ] Rodar `npm run lint` e `npx tsc -p tsconfig.json --noEmit` para verificar redução de erros.
6. [ ] Iterar para outros arquivos (AppHome/Notifications/SearchPage etc.) até cair para um nível aceitável.

## Progresso
- [ ] Iniciar correções começando por `AuthContext.tsx`.


