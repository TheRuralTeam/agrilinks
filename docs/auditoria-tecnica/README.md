# AgriLink — Plano de auditoria técnica profunda

> **Estado:** auditoria estática inicial documentada; validação dinâmica e de produção pendente.  
> **Modo:** somente leitura durante a auditoria. Não aplicar migrations, alterar dados, fazer deploy, revelar segredos nem ativar serviços pagos.  
> **Repositórios abrangidos:** [marketplace](https://github.com/TheRuralTeam/agrilinks) e [dashboard administrativo](https://github.com/TheRuralTeam/agrilink-dashboard).  
> **Público:** equipa de engenharia, revisores e futuros contribuidores.

## Objetivo

Transformar as observações da revisão de código numa lista de trabalho verificável, com evidências, severidade, testes de aceitação e limites claros. A prioridade é proteger dados reais, autenticação, compras/pagamentos e capacidade de recuperação antes de alterações funcionais.

## Regras de trabalho

- [x] Fazer a revisão inicial de código e documentação versionados em ambos os repositórios.
- [x] Registar evidências por ficheiro e distinguir factos do código de riscos ainda não reproduzidos.
- [x] Não modificar código de aplicação, schema, dados ou configuração de produção durante a auditoria.
- [x] Manter o plano numa branch de documentação para revisão por outros programadores.
- [ ] Obter autorização explícita antes de executar testes que consultem sistemas remotos ou dados reais.
- [ ] Fazer testes dinâmicos apenas em ambiente isolado, com dados sintéticos e sem serviços pagos.
- [ ] Não marcar uma tarefa como concluída sem evidência reproduzível e resultado registado.
- [ ] Não incluir tokens, credenciais, dados pessoais reais ou URLs de recuperação nos relatórios.

## Legenda de estado

- [x] **Concluído — revisão estática:** ficheiro/código lido e observação documentada. Não significa que o teste dinâmico tenha passado.
- [ ] **Por fazer:** necessita de verificação, teste, evidência adicional ou correção futura.
- **Severidade Crítica/Alta/Média/Baixa:** prioridade técnica preliminar, não confirmação de exploração.
- **Não verificado:** não foi possível confirmar no ambiente remoto ou através de execução.

## Resumo da revisão estática já feita

| Área | Evidência inicial | Severidade preliminar | Estado real |
|---|---|---:|---|
| Dados reais vs. simulados | Dashboard: `src/hooks/useKPIs.js`, `src/hooks/useAlerts.js`, `src/data/mockData.js` | Alta | Código de demonstração confirmado; alcance completo por inventariar |
| Autenticação dashboard | `src/pages/Login.jsx`, `src/lib/supabase.js`, `src/store/useAuth.js` | Alta se acessível em produção | Fallback local observado; configuração publicada não verificada |
| JWT e Edge Functions | `supabase/config.toml` | Alta dependendo da função | `verify_jwt = false` observado em várias funções; autorização interna precisa de revisão |
| RLS/RPCs | `supabase/migrations/20261006220000_production_security_and_index_hardening.sql` e funções referidas na auditoria | Alta | Código local revisto parcialmente; políticas remotas não verificadas |
| Sourcing/concorrência | Dashboard: `src/pages/Sourcing.jsx`, `supabase/migrations/20261010000100_sourcing_workflow.sql` na branch `feature/sourcing-workflow` | Alta | Possível condição de corrida inferida do SQL; não reproduzida |
| Operações parciais | `src/pages/Sourcing.jsx` | Alta | Caminho insert + update observado; falha parcial não reproduzida |
| Pagamentos | `supabase/functions/payment-webhook/index.ts` e handler partilhado | Alta | Encaminhamento para RPC observado; fluxo financeiro end-to-end não testado |
| Migrations | `scripts/audit-migrations.mjs` | Alta | Script local não compara ledger remoto (limitação declarada no próprio script) |
| Email/recuperação | `supabase/functions/send-password-reset/index.ts`, `process-email-outbox/index.ts` | Alta para recuperação de conta | Fila e rate limit observados; entrega/retry/recuperação não verificados |
| CI/CD | `.github/workflows/ci.yml`, `.github/workflows/deploy-supabase-functions.yml` | Média/Alta | Workflows versionados; última execução e proteção de branches não revalidadas nesta tarefa |
| Backups/restauro | Não foi obtida evidência operacional suficiente | Alta para continuidade | Não verificado; não concluir que não existem backups |
| Acessibilidade/UX | `DataTable.jsx`, `Sidebar.jsx`, `Header.jsx`, CSS e componentes UI | Média | Pontos a testar por inspeção estática; sem execução de navegador |
| Desempenho | Consultas de sourcing e migrations de índices | Média | Sem benchmark ou plano de execução |

## Plano de trabalho e checklist

### A. Dados reais, simulados e integridade

- [x] Identificar hooks do dashboard que usam `mockKPIs` e `mockAlerts`.
- [x] Identificar `src/data/mockData.js` como fonte de dados demonstrativos.
- [ ] Inventariar **todas** as páginas, gráficos, contadores, tabelas e alertas e classificá-los: real / simulado / misto / desconhecido.
- [ ] Para cada indicador, documentar tabela/API de origem, filtros, moeda, unidade, fuso horário e regra de cálculo.
- [ ] Testar respostas vazias, erro de rede, sessão expirada e permissões insuficientes; nenhum destes casos deve parecer dado real válido.
- [ ] Confirmar que dados demonstrativos têm rótulo explícito e não aparecem em produção como métricas operacionais.
- **Critério de aceitação:** cada valor operacional tem origem rastreável; falhas e ausência de dados são distintas de valores zero ou mock.

### B. Autenticação, autorização, RLS e RPCs

- [x] Registar o fallback local de login e o estado de autenticação Zustand em memória.
- [x] Inventariar funções no `supabase/config.toml` com `verify_jwt = false` observadas na revisão.
- [x] Rever parcialmente a migration local de hardening de segurança.
- [ ] Confirmar configuração do dashboard publicado sem divulgar valores de variáveis ou secrets.
- [ ] Rever **cada** Edge Function pública: autenticação alternativa, autorização, validação de entrada, rate limiting, CORS e tratamento de erros.
- [ ] Inventariar tabelas/vistas, estado RLS, políticas por operação, grants, funções `SECURITY DEFINER`, proprietários e `search_path`.
- [ ] Testar anon, utilizador autenticado comum, utilizador de outro registo e administrador através da API direta.
- [ ] Verificar que operações administrativas não dependem só de esconder botões no frontend.
- [ ] Testar abuso/repetição de OTP, recuperação, magic links e limites de taxa.
- **Critério de aceitação:** matriz de papéis e permissões validada com testes negativos; nenhum acesso indevido por chamadas diretas à API.

### C. Sourcing, compras, pagamentos e logística

- [x] Rever a implementação de `accept_sourcing_offer` na migration da branch de sourcing.
- [x] Registar risco potencial de concorrência: bloqueio da proposta não garante exclusividade por pedido.
- [x] Identificar fluxo de criação de proposta seguido de atualização do pedido na UI.
- [x] Identificar encaminhamento do webhook de pagamento para `apply_wallet_payment_webhook`.
- [ ] Executar teste concorrente com duas propostas do mesmo pedido em ambiente isolado.
- [ ] Confirmar constraint de base de dados que garanta uma única compra ativa por pedido, se essa for a regra de negócio.
- [ ] Testar rollback/atomicidade se uma etapa de uma operação multi-tabela falhar.
- [ ] Testar idempotência com pedidos repetidos, timeouts e retries.
- [ ] Testar eventos de pagamento duplicados, fora de ordem, divergentes, recusados e revertidos.
- [ ] Documentar máquina de estados permitida para pedido, proposta, compra, pagamento, carteira e frete.
- [ ] Validar autorizações de cada transição no backend e não apenas no frontend.
- [ ] Confirmar que rotas, GPS, clima e disponibilidade exibem fonte, frescura e estado de indisponibilidade sem inventar dados.
- **Critério de aceitação:** invariantes de negócio protegidas no backend; testes concorrentes e de falha passam sem compras/pagamentos duplicados nem estados contraditórios.

### D. Histórico remoto e migrations

- [x] Rever o script `scripts/audit-migrations.mjs` e a sua limitação explícita: apenas analisa ficheiros locais.
- [x] Registar que a migration de sourcing não foi aplicada durante esta auditoria.
- [ ] Exportar a lista de versões do ledger remoto por método aprovado e comparar com as migrations versionadas.
- [ ] Comparar schema remoto com o esperado: tabelas, colunas, constraints, índices, triggers, funções, políticas e grants.
- [ ] Investigar versões duplicadas, migrations divergentes, alterações manuais e migrations aplicadas parcialmente.
- [ ] Testar a sequência num projeto/base de dados descartável com versão inicial representativa.
- [ ] Rever migrations destrutivas e documentar rollback/restauro antes de qualquer aplicação.
- **Critério de aceitação:** divergências explicadas e reconciliadas num plano revisto; nenhuma migration aplicada por tentativa/erro em produção.

### E. Email, notificações e recuperação de falhas

- [x] Rever parcialmente `send-password-reset/index.ts` e `process-email-outbox/index.ts`.
- [x] Registar que `queued: true` indica agendamento, não entrega.
- [ ] Mapear estados da fila, tentativas, backoff, deduplicação, locks de jobs, dead-letter e alertas.
- [ ] Testar falha temporária e permanente do fornecedor, timeout ambíguo, reprocessamento e mensagem duplicada.
- [ ] Confirmar que erros não expõem tokens, links secretos ou informação pessoal.
- [ ] Validar allowlist de redirects, expiração e uso único de links de autenticação/recuperação.
- [ ] Definir estados honestos para agendado/enviado/entregue/rejeitado/falhado conforme os eventos realmente disponíveis.
- [ ] Verificar logs de entrega sem enviar emails reais em testes; usar provider fake ou ambiente sandbox sem custo.
- **Critério de aceitação:** falhas são observáveis e recuperáveis; a interface nunca declara entrega sem evidência do fornecedor.

### F. CI/CD, segredos, backups e recuperação

- [x] Rever a estrutura versionada de CI e deployment de Edge Functions do marketplace.
- [ ] Confirmar execuções recentes de CI, resultados e cobertura dos testes relevantes.
- [ ] Rever permissões de GitHub Actions, proteção de branches, revisão obrigatória e escopo dos secrets sem revelar os valores.
- [ ] Confirmar ambientes de destino e proteções contra deploy acidental.
- [ ] Inventariar segredos por localização e finalidade; nunca copiar valores para issues/logs.
- [ ] Confirmar a existência, frequência, retenção e independência dos backups disponíveis no plano atual.
- [ ] Verificar exportação/backup de Storage separadamente da base de dados.
- [ ] Fazer restauro controlado para ambiente isolado e verificar integridade funcional.
- [ ] Registar RPO/RTO pretendidos, responsáveis e procedimento de recuperação.
- **Critério de aceitação:** CI e deploy com gates conhecidos; restauro documentado e demonstrado sem expor dados reais.

### G. Responsividade, acessibilidade e consistência visual

- [x] Registar os pontos estáticos identificados em tabelas, sidebar, cabeçalho, tokens de cor e animações.
- [x] Identificar marcadores de conflito Git no README do dashboard.
- [ ] Testar viewport móvel, tablet, desktop, zoom 200% e conteúdo muito longo.
- [ ] Testar navegação por teclado, foco visível, Escape, foco preso/restaurado em diálogos e leitores de ecrã.
- [ ] Verificar contraste, labels, erros de formulário, ordenação acessível de tabelas e preferência por movimento reduzido.
- [ ] Testar estados de carregamento, vazio, erro, sem autorização e offline.
- [ ] Uniformizar semântica de sucesso/aviso/erro e documentação de design tokens entre projetos, sem refatoração prematura.
- **Critério de aceitação:** fluxos críticos utilizáveis sem rato, sem informação cortada e com estados de falha compreensíveis.

### H. Consultas, índices e desempenho

- [x] Identificar consultas de sourcing com `select('*')` e ordenação por data sem paginação explícita no trecho revisto.
- [x] Registar alterações a índices na migration de hardening para validação por evidência.
- [ ] Inventariar consultas frequentes e respetivos volumes, filtros, ordenações e limites.
- [ ] Verificar paginação no servidor para listas potencialmente grandes.
- [ ] Rever índices usados por filtros, joins, foreign keys e políticas RLS.
- [ ] Medir planos de consulta e latência em dados sintéticos representativos.
- [ ] Verificar carregamento paralelo, cancelamento de pedidos, re-renderizações e consultas repetidas.
- [ ] Não adicionar índices sem medir consultas e custo de escrita/armazenamento.
- **Critério de aceitação:** benchmarks repetíveis, paginação funcional e índices sustentados por planos de consulta.

## Ordem recomendada

1. **P0 — Confiança e segurança:** dados simulados, fallback de login, RLS/RPCs e autorização das Edge Functions.
2. **P1 — Integridade comercial:** concorrência de sourcing, transições de estado, atomicidade e idempotência financeira.
3. **P1 — Integridade de schema:** reconciliação do histórico remoto antes de qualquer migration.
4. **P1 — Recuperação:** email/outbox, backups e restauro demonstrado.
5. **P2 — Qualidade operacional:** acessibilidade, responsividade, observabilidade e desempenho.

As prioridades são provisórias e devem ser reavaliadas após testes. Não significam que qualquer falha já tenha sido explorada.

## Modelo para registar cada achado

Para cada issue/achado futuro, incluir:
- **ID / data / responsável**
- **Repositório, branch, commit e ficheiro/linhas**
- **Severidade e impacto**
- **Facto observado vs. hipótese**
- **Passos mínimos para reproduzir**
- **Ambiente e dados de teste**
- **Resultado esperado e observado**
- **Correção proposta**
- **Testes de regressão**
- **Risco de rollout/rollback**
- **Estado:** por verificar / reproduzido / correção proposta / implementado em branch / validado / fechado

## Limitações atuais

Esta documentação reflete uma revisão estática inicial. Não foram executados builds, testes automatizados, browser, testes concorrentes, consultas à base remota, operações financeiras, deploys ou restauros. Não foi feita uma verificação atual de secrets nem dos dados operacionais. Não se deve afirmar que produção está segura ou insegura sem as verificações pendentes.

## Referências de código

- [Marketplace: CI](https://github.com/TheRuralTeam/agrilinks/blob/main/.github/workflows/ci.yml)
- [Marketplace: deploy de Edge Functions](https://github.com/TheRuralTeam/agrilinks/blob/main/.github/workflows/deploy-supabase-functions.yml)
- [Marketplace: configuração Supabase](https://github.com/TheRuralTeam/agrilinks/blob/main/supabase/config.toml)
- [Marketplace: auditoria local de migrations](https://github.com/TheRuralTeam/agrilinks/blob/main/scripts/audit-migrations.mjs)
- [Dashboard: sourcing](https://github.com/TheRuralTeam/agrilink-dashboard/blob/feature/sourcing-workflow/src/pages/Sourcing.jsx)
- [Dashboard: migration de sourcing](https://github.com/TheRuralTeam/agrilink-dashboard/blob/feature/sourcing-workflow/supabase/migrations/20261010000100_sourcing_workflow.sql)
- [Dashboard: mock data](https://github.com/TheRuralTeam/agrilink-dashboard/blob/main/src/data/mockData.js)
- [Dashboard: autenticação local](https://github.com/TheRuralTeam/agrilink-dashboard/blob/main/src/pages/Login.jsx)
