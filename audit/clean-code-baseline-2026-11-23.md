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

### 3. Dois ecrãs de autenticação
`src/App.tsx` carrega `src/pages/LoginPage.tsx`. Existe também `src/pages/Login.tsx`, com implementação própria. Os dois contêm fluxos de login/registo, mas não são equivalentes: LoginPage inclui acesso de visitante, redirecionamento de retorno, magic link/reset e outros estados; Login contém implementação diferente de autenticação e confirmação. Não remover nenhum até verificar todas as rotas, imports dinâmicos, links externos e histórico de produto. A rota de produção observada aponta para LoginPage.

Prioridade: alta. Ação proposta: comparar os fluxos e decidir uma única implementação canónica, preservando todas as capacidades necessárias.

### 4. Formulários Farmer
`src/pages/FarmerForm.tsx` e `src/pages/FarmerFormWithAuth.tsx` partilham estrutura visual e campos, mas o primeiro aparenta ser um formulário legado/demonstrativo: o submit mostra sucesso local e redireciona, sem persistência no Supabase. O segundo valida autenticação, carrega fotografias e insere registo na tabela `products`. Não são intercambiáveis. Verificar rotas e referências antes de arquivar/remover o formulário legado; não substituir a implementação autenticada.

Prioridade: alta. Ação proposta: rastrear consumidores e, se confirmado sem uso, remover o legado em commit isolado após testes.

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
