# AgriLink — auditoria inicial de Clean Code

Data: 2026-11-23  
Branch de trabalho: `refactor/clean-code-baseline`  
Base: `main`  
Escopo: auditoria estática e read-only do código e configuração. Nenhuma alteração na aplicação, banco de dados ou produção foi realizada nesta etapa.

## Resumo executivo

A auditoria encontrou duplicações e inconsistências reais, mas nem todos os pares de ficheiros aparentemente semelhantes são substitutos seguros. A refatoração deve consolidar responsabilidades sem apagar fluxos de negócio distintos.

## Achados confirmados

### 1. Regras duplicadas no .gitignore
O ficheiro contém regras repetidas para `node_modules`, `dist`, `.vscode`, `.idea`, `.DS_Store` e padrões de logs. A consolidação é de baixo risco, desde que se preserve a exceção `!.vscode/extensions.json`, `.vercel`, ficheiros locais e padrões de ambiente.

Prioridade: baixa. Ação proposta: normalizar o ficheiro sem alterar o comportamento de exclusão.

### 2. Reexportação redundante de use-toast
`src/components/ui/use-toast.ts` apenas reexporta `useToast` e `toast` de `src/hooks/use-toast.ts`. O toaster visual importa diretamente do hook central. A existência do wrapper pode ser mantida temporariamente para compatibilidade; migrar consumidores e removê-lo só depois de uma pesquisa completa de imports e validação.

Prioridade: baixa. Risco: baixo se for feita migração compatível e verificada.

### 3. Ecrã de autenticação duplicado
`src/App.tsx` carrega `src/pages/LoginPage.tsx`. A pesquisa completa por referências no código não encontrou consumidores de `src/pages/Login.tsx`; a rota `/login` usa LoginPage. O ficheiro `Login.tsx` foi removido da branch de refatoração. `Registration.tsx` continua a ser uma questão separada: existe uma importação lazy em App, mas a rota `/cadastro` redireciona para `/login?mode=signup`; a sua função de registo completo (documento, localização e código de agente) não deve ser descartada sem decisão funcional.

Prioridade: alta. Ação proposta: avaliar a unificação de LoginPage e Registration preservando acesso de visitante, redirecionamento, confirmação, recuperação de senha e registo completo.

### 4. Formulários Farmer sem consumidores
A pesquisa de referências não encontrou imports, rotas ou consumidores de `src/pages/FarmerForm.tsx` nem de `src/pages/FarmerFormWithAuth.tsx`. São implementações distintas: a primeira apenas simula sucesso no cliente; a segunda faz upload de fotografias e grava em `products`. Como nenhuma está ligada ao router atual, ambas foram removidas apenas da branch de refatoração. A funcionalidade ativa de publicação não foi alterada: `/publicar-produto` continua a apontar para `PublishProduct`.

Prioridade: concluída nesta etapa. A remoção será considerada validada após CI.

### 5. Dependências react-slick / slick-carousel
As dependências aparecem no `package.json`, nos lockfiles, na configuração de chunks do Vite e em CSS dedicado (`.slick-slider`). A pesquisa inicial não encontrou import JavaScript direto, mas a pesquisa textual não é prova suficiente de ausência de uso (pode existir import indireto, CSS ou referência dinâmica). Não remover ainda. Fazer análise de AST/import graph e build após confirmar.

Prioridade: média. Ação proposta: validar uso efetivo antes de remover dependências, CSS e chunk dedicado em conjunto.

### 6. Gestão de dependências e lockfiles
O repositório tem `package-lock.json` e `bun.lock`; referências antigas de auditoria mencionam `bun.lockb`, mas a existência atual desse ficheiro ainda precisa de confirmação. A documentação recente de remediação de dependências refere execução de `npm ci`, `npm audit` e CI com build/lint/type-check/testes. Portanto, não apagar lockfiles com base apenas na presença de Bun. Confirmar workflows e configurações Vercel completas antes de padronizar.

Prioridade: alta. Ação proposta: manter npm como candidato principal até validar CI/Vercel e a geração de lockfile usada na execução real.

## Riscos transversais observados

- `tsconfig.json` desativa `strictNullChecks`, `noImplicitAny` e verificações de variáveis/parâmetros não usados. Existe `type-check:strict`, mas o relatório versionado de erros é antigo e precisa ser reexecutado na branch atual.
- `src/App.tsx` concentra rotas, gates de autenticação/autorização, preview de mapa e inicialização global. A extração em módulos pode melhorar manutenção, mas exige testes de regressão de rotas, guest mode, email confirmado, perfil incompleto e permissões administrativas.
- Supabase apresenta alertas de advisors previamente recolhidos (RLS/políticas/funções/índices). São sinais para investigação, não autorização para alterar políticas ou permissões sem análise de chamadas e backup validado.

## Plano de execução seguro

1. Completar inventário de workflows, imports, rotas, serviços, Edge Functions, migrations e testes.
2. Registar baseline de CI: instalação limpa, lint, TypeScript strict, testes e build. Não declarar validação sem execução real.
3. Fazer limpeza de baixo risco primeiro (.gitignore e imports compatíveis), em commits pequenos.
4. Consolidar componentes/serviços apenas após provar equivalência de comportamento e mapear todos os consumidores.
5. Rever dependências e lockfiles com evidência do CI e Vercel.
6. Auditar Supabase separadamente; nenhuma alteração de schema, RLS, função ou trigger antes de backup verificável e plano de rollback.
7. Abrir PR para revisão; não fazer merge automático nem alterar `main` sem aprovação explícita.

## Limitações desta auditoria

Esta etapa foi estática e parcial, baseada em ficheiros e pesquisas GitHub. Não foi executado build, lint, testes, análise AST, teste end-to-end, nem alterações de Supabase. Os relatórios antigos em `audit/` não devem ser tratados como baseline atual.

## Critério de conclusão

Uma refatoração só será considerada concluída quando cada alteração tiver: motivo, mapa de consumidores, diff revisto, testes relevantes executados, resultado documentado e confirmação de que os fluxos funcionais foram preservados.


## Alterações realizadas na branch nesta etapa
- `.gitignore`: regras repetidas consolidadas e agrupadas por categoria; mantida a exceção explícita para `.vscode/extensions.json`.
- Removidos `src/pages/Login.tsx`, `src/pages/FarmerForm.tsx` e `src/pages/FarmerFormWithAuth.tsx` após pesquisa sem referências no código.
- Criada PR draft #74 para executar CI sem integrar alterações na `main`.
- Estado de CI observado após o último commit: checks `build`, `Analyze (actions)` e `Analyze (javascript-typescript)` em fila; ainda sem conclusão. Vercel Preview Comments passou; Supabase Preview foi ignorado por não existir branch Supabase associada. Isso não é validação do build.

### 7. Route guards e tipagem em App.tsx
Na branch, foi removida a declaração lazy não utilizada de `Registration` (a página foi mantida para decisão funcional posterior), `isProfileComplete` deixou de aceitar `any` e passou a receber apenas os campos de perfil necessários, e `RoleRoute.allowedRole` passou a usar o tipo de papel de utilizador definido no modelo. São alterações de tipagem/limpeza sem mudança intencional de fluxo. A validação depende do CI da PR.
