# Auditoria de baseline — ecossistema multiagente AgriLink

**Data:** 2026-10-14  
**Repositório:** `TheRuralTeam/agrilinks`  
**Base auditada:** ramo `main`, commit `5daa0ca5f5f75a0777fd8636724e418fdbb6b16f`  
**Supabase:** projeto `AgriLink`, ref `oqcrfqtlfqwrxxmsjpaf`, PostgreSQL 17.6  
**Âmbito:** leitura do repositório, migrations, rotas/permissões e metadados do esquema remoto. Não foram feitas alterações à base de dados nem deploy.

## Resumo executivo

O projeto já possui os principais domínios de negócio que a rede multiagente precisa de coordenar: utilizadores, produtos, sourcing e cotações, pré-compras/encomendas, faturas proforma, cargas, eventos e localizações GPS, notificações, conversas e estruturas de pagamentos. A abordagem correta é orquestrar os workflows existentes, não criar um segundo marketplace paralelo.

A primeira entrega deve ser uma fundação segura e aditiva: contratos de tarefas/eventos, autorização no backend, idempotência, auditoria e um centro de operações em modo de observação. A execução autónoma de alterações de negócio fica fora da primeira fase.

## Evidências observadas

### Código e navegação
- `src/App.tsx` usa React Router e rotas lazy-loaded; já há rotas de aplicação e administração.
- A rota `/admindashboard` usa `PermissionRoute` com `view_analytics`; a lixeira de pedidos usa `manage_orders` e admite suporte.
- `src/features/auth/authorization.ts` define as permissões administrativas: `manage_users`, `manage_products`, `manage_orders`, `manage_support`, `manage_sourcing`, `view_analytics`, `manage_admins`.
- O tipo de utilizador inclui os papéis humanos `agente`, `agricultor`, `comprador` e `motorista`; a administração também é representada por permissões/flags. Não reutilizar `user_type = agente` para agentes de software.
- `package.json` disponibiliza `lint`, `type-check:strict`, `test` e `build`; estes serão os gates mínimos de validação.
- Não foi identificado um módulo dedicado de orquestração multiagente no código pesquisado. Existem capacidades especializadas já implementadas, incluindo análise de mercado, notificações, sourcing, pagamentos e logística.

### Estado de Git
- HEAD de `main`: `5daa0ca5f5f75a0777fd8636724e418fdbb6b16f`, commit de 2026-10-14 09:57:34Z, mensagem “Corrige referência ambígua em proposta de frete”.
- A API de branches reportou `protected: false` e verificações obrigatórias desativadas para `main`. Isto aumenta o risco de alterações diretas sem gates obrigatórios. Não foi alterada a configuração do repositório.
- O ramo contém migrations recentes de sourcing, proformas, estado dos produtos e GPS/logística, incluindo a correção da ambiguidade em `submit_freight_quote`.

### Esquema remoto e migrações
- O projeto remoto está ativo e em PostgreSQL 17.6.
- A inspeção do esquema confirma tabelas de negócio como `users`, `products`, `orders`, `pre_orders`, `freight_loads`, `freight_load_events`, `freight_load_location_history`, `sourcing_requests`, `sourcing_supplier_quotes`, `proforma_invoices`, `notifications`, `conversations`, `payment_intents`, `transactions` e outras.
- O histórico remoto contém a migration `fix_ambiguous_id_submit_freight_quote` sob versão `20261014095710`, enquanto o ficheiro versionado correspondente tem prefixo `20261014170000`. Também existem diferenças semelhantes entre prefixos de migrations de logística. Os nomes correspondem, mas os IDs de versão não. Antes de `db push`, reset ou aplicação automática, é necessário reconciliar o ledger remoto com os ficheiros e confirmar os conteúdos aplicados; não assumir que a diferença é segura.
- O tipo `Database` em `src/integrations/supabase/types.ts` é gerado e volumoso. Deve ser comparado com os tipos gerados diretamente a partir do esquema remoto antes de adicionar novas entidades.
- A base tem várias funções `SECURITY DEFINER`, incluindo RPCs de administração, sourcing, pagamentos e logística. As funções existentes são o perímetro de execução das operações sensíveis e devem ser reutilizadas, com revisão individual de `search_path`, grants, validação de identidade e transições de estado.

### Segurança/RLS
- RLS está ativo em tabelas de negócio inspecionadas.
- O advisor de segurança reportou 19 tabelas com RLS ativo e sem políticas (nível INFO). Algumas parecem ser tabelas internas de filas, limites, cache, códigos de verificação ou configuração. Isto não é, por si só, prova de vulnerabilidade: é necessário confirmar grants e uso exclusivo por Edge Functions/RPCs antes de adicionar políticas.
- O inventário de políticas mostra políticas em tabelas de utilizadores, mensagens, notificações, produtos, encomendas, pré-compras e sourcing. Algumas usam o papel SQL `public`; a segurança depende da expressão completa da política e dos privilégios de tabela. Não conceder permissões novas de forma ampla.
- O centro de operações não deve consultar tabelas internas diretamente a partir do browser. A leitura e as ações devem passar por endpoints autenticados que confirmem permissões e filtrem por entidade/participante.
- Não foram executadas ações de mutação, DDL ou deploy durante esta auditoria.


### Revisão adicional de grants e RPCs

A consulta de privilégios no projeto remoto identificou **9 funções `SECURITY DEFINER` com argumentos que são executáveis pelo papel SQL `anon`**: `accept_freight_load`, `admin_set_product_status`, `advance_freight_load`, `confirm_freight_handover`, `confirm_freight_receipt`, `create_freight_settlement_if_ready`, `submit_public_contact`, `update_freight_tracking_location` e `validate_agent_code`.

Isto **não demonstra, por si só, que as funções permitam operações não autorizadas**: algumas podem validar `auth.uid()` internamente e outras, como contacto público ou validação de código, podem ter uma razão legítima para acesso anónimo. Contudo, as funções de logística e administração devem ser revistas individualmente e o acesso `anon` revogado quando não for um requisito explícito. Não alterar grants em massa sem validar os clientes que as invocam e os checks internos.

A consulta também encontrou privilégios de tabela concedidos a `anon` em algumas tabelas, incluindo `admin_permissions`, `audit_logs`, `freight_loads`, `products` e `sourcing_requests`. A política RLS pode impedir a operação, mas o princípio de mínimo privilégio exige verificar a combinação de GRANT + RLS. Exemplo: a política de leitura de `audit_logs` exige `has_role(auth.uid(), 'admin')`; por isso o grant sozinho não é prova de leitura anónima. A tabela `freight_loads` tem política de leitura ampla para o papel `authenticated`, que deve ser avaliada quanto à exposição de dados operacionais, mantendo a intenção comercial de listar cargas abertas.

Contagem remota: 163 funções `SECURITY DEFINER` no schema `public`; a consulta não encontrou nenhuma sem configuração explícita de `search_path`. Isto é uma baseline de metadados, não uma auditoria completa do corpo das 163 funções. O foco da próxima revisão deve ser a matriz de EXECUTE grants, validação de identidade/entidade, transições de estado e funções chamadas por workflows de agentes.


### Achados concretos de maior prioridade

1. **RPC legado `advance_freight_load(uuid)`** — o corpo remoto permite que o motorista atribuído passe de `accepted` diretamente para `in_transit` e depois para `delivered`. Não valida `payment_status = paid`, aprovação da proposta de frete nem a etapa explícita `at_pickup`. A pesquisa no frontend encontrou a chamada ao RPC mais recente `advance_freight_load_status(uuid,text)`, não ao RPC legado. Antes de revogar a função, confirmar todos os consumidores (incluindo automações externas); se não houver consumidor legítimo, revogar `EXECUTE` de `PUBLIC`, `anon` e `authenticated` numa migration separada e testada.
2. **RPC interno `create_freight_settlement_if_ready(uuid)`** — é `SECURITY DEFINER`, executável por `anon` e não verifica `auth.uid()`. A lógica só cria a liquidação se a carga tiver todas as confirmações exigidas e preço positivo, e usa `ON CONFLICT DO NOTHING`; mesmo assim, deve ser apenas uma função interna chamada por funções de confirmação autorizadas. Rever grants e revogar acesso direto de cliente depois de verificar triggers/consumidores.
3. **RPCs de negócio com EXECUTE concedido a `anon`** — `accept_freight_load`, `admin_set_product_status`, `advance_freight_load`, `confirm_freight_handover`, `confirm_freight_receipt`, `create_freight_settlement_if_ready` e `update_freight_tracking_location` exigem revisão/grants mínimos. A maioria valida autenticação ou papel dentro do corpo, mas isso não substitui a remoção de privilégios desnecessários. `submit_public_contact` e `validate_agent_code` podem precisar de acesso público limitado e devem ser avaliadas separadamente.

## Riscos e decisões

| ID | Risco | Tratamento proposto |
|---|---|---|
| A-01 | IDs de versão do ledger remoto não coincidem com prefixos de alguns ficheiros locais | Fazer reconciliação migration a migration e validar estado/definições antes de qualquer `db push`. |
| A-02 | `main` não tem proteção/CI obrigatório reportado pela API | Recomendar proteção de branch e checks obrigatórios antes do primeiro merge de código executável. |
| A-03 | Funções `SECURITY DEFINER` atravessam fronteiras de autorização | Inventariar grants, `search_path`, `auth.uid()`, checks de papel e validação de entidade para cada RPC que o agente possa invocar. |
| A-04 | Advisor assinala 19 tabelas RLS sem políticas | Confirmar privilégios efetivos e se o acesso é exclusivamente server-side; não adicionar políticas indiscriminadas. |
| A-05 | Dados de sourcing, preço, pagamentos e GPS têm sensibilidade operacional | Guardar no payload dos agentes apenas IDs e campos mínimos; obter dados atuais através de funções autorizadas. |
| A-06 | Eventos repetidos ou concorrentes podem duplicar efeitos | Idempotency key, transições condicionais e testes de concorrência antes de ativar automação. |


## Segunda passagem — reconciliação do ledger de migrations

A comparação por nome entre os 165 ficheiros locais em `supabase/migrations` e as 184 entradas do ledger remoto encontrou:

- **4 versões locais duplicadas**, cada uma usada por dois ficheiros.
- **79 correspondências por nome** entre ficheiros locais e entradas remotas; **42 dessas correspondências têm versão diferente**.
- **63 entradas remotas sem nome de migration** e vários ficheiros locais sem correspondência nominal no ledger. Os nomes em falta incluem migrations históricas identificadas por UUID, pelo que uma comparação só por nome não pode classificá-las com segurança.
- Exemplos recentes: `fix_ambiguous_id_submit_freight_quote` está remoto em `20261014095710`, mas o ficheiro local começa por `20261014170000`; o mesmo padrão existe em várias migrations de sourcing, proforma e logística.
- Duplicados locais:
  - `20261007090000`: `fix_pre_order_acceptance_terms` e `functional_hardening_signup_identity_notifications`.
  - `20261008130000`: `add_p2p_beneficiary_marketplace` e `endurecer_execucao_funcoes_internas`.
  - `20261013100000`: `create_proforma_invoices` e `fix_marketplace_pre_order_result_types`.
  - `20261013120000`: `admin_only_proformas` e `fix_freight_load_buyer_reference`.

### Decisão de segurança

**Não renomear automaticamente migrations nem executar `db push` nesta fase.** Uma renomeação de migration já aplicada pode levar o CLI a tentar executar DDL novamente; escolher um timestamp arbitrário para uma migration não aplicada pode alterar a ordem de dependências. O ledger remoto não contém checksums suficientes para provar equivalência de conteúdo.

### Próxima ação de reconciliação

1. Gerar inventário com nome, versão, conteúdo SQL e dependências de cada ficheiro local.
2. Para cada entrada remota com nome, confirmar se o SQL local é o que produziu o estado remoto, comparando funções, tabelas, constraints, índices, triggers, grants e políticas.
3. Identificar migrations locais sem equivalente remoto e verificar se estão pendentes ou se o seu conteúdo foi aplicado sob outra versão.
4. Corrigir as quatro colisões de versão numa alteração isolada, preservando a ordem lógica e documentando as versões remotas já aplicadas.
5. Só então validar `supabase migration list` / `db diff` num ambiente de desenvolvimento e avançar para a fundação multiagente.

Esta passagem encontrou um bloqueio real ao avanço seguro: a reconciliação deve preceder a primeira migration do ecossistema de agentes.

## Plano incremental

### P0 — reconciliação (antes de DDL)
- Comparar migrations locais/remotas por nome, definição e versão.
- Gerar e comparar tipos TypeScript a partir do esquema remoto.
- Inventariar policies, grants e funções privilegiadas envolvidas em sourcing, encomendas, fretes e administração.
- Estabelecer testes de regressão dos fluxos existentes e registar os erros já conhecidos separadamente.

### P1 — núcleo interno de tarefas
- Introduzir, numa migration aditiva, tarefas, eventos append-only e aprovações; sem alterar tabelas de negócio existentes.
- Tabelas internas com RLS e sem acesso direto a `anon`/`authenticated`; endpoints server-side validam o utilizador e aplicam o filtro de acesso.
- Catálogo de capacidades versionado no código, schemas de entrada/saída e política por risco.
- Testes de isolamento, grants, idempotência, transições e auditoria.

### P2 — centro de operações em modo de observação
- Rota lazy-loaded dentro do painel administrativo.
- Acesso de leitura com `view_analytics`; ações futuras exigem permissões específicas como `manage_orders` ou `manage_sourcing`.
- Mostrar estados, evidências, política aplicada, resultados e erros sanitizados; não expor chain-of-thought, segredos nem dados de outras entidades.

### P3 — primeiro workflow controlado
- Workflow de sourcing apenas consultivo: validar pedido, identificar campos em falta, consultar ofertas existentes e preparar proposta.
- O utilizador confirma a proposta. Nenhuma alteração autónoma de stock, preço, pedido, pagamento ou estado de carga.

### P4 — integração de logística
- Consumir eventos e RPCs existentes para aceitação, recolha, viagem e entrega.
- Não aceitar uma carga, alterar preço, iniciar viagem nem confirmar entrega em nome de um utilizador sem regra explícita e autorização.
- Localização ativa apenas durante a operação e com as permissões aplicáveis.

## Critérios de aceitação da primeira entrega executável

- `lint`, `type-check:strict`, testes e `build` aprovados.
- Migração aplicada primeiro num ambiente/branch de desenvolvimento após reconciliar o ledger.
- RLS e grants testados por papel; nenhum acesso cruzado entre entidades.
- Idempotência demonstrada por testes de repetição e concorrência.
- Sem regressões em sourcing, pré-compra, proforma, pagamento e GPS.
- Nenhum deploy de produção declarado sem resultado verificável.


## Terceira passagem — evidência por migration e ferramenta preventiva

Foi feita uma verificação direcionada dos quatro grupos de prefixos duplicados, comparando os nomes dos ficheiros com as entradas disponíveis no ledger remoto. O resultado confirma que alguns ficheiros têm correspondências remotas sob versões diferentes; não permite concluir, apenas pelo ledger, que o conteúdo local é idêntico ao SQL aplicado.

| Ficheiro local | Entrada no ledger remoto | Conclusão segura |
|---|---|---|
| `20261007090000_fix_pre_order_acceptance_terms.sql` | Não encontrada correspondência nominal direta na amostra consultada | Estado por confirmar; comparar o corpo de `respond_to_pre_order` e `admin_update_pre_order_status` com as definições remotas. |
| `20261007090000_functional_hardening_signup_identity_notifications.sql` | Não encontrada correspondência nominal direta na amostra consultada | Estado por confirmar; inspecionar triggers, `handle_new_user`, `admin_set_user_type` e validação de identidade. |
| `20261008130000_add_p2p_beneficiary_marketplace.sql` | Existem migrations P2P remotas com nomes diferentes; não foi provada equivalência integral | Não marcar como aplicada sem comparar tabelas, constraints, índices, políticas e funções P2P. |
| `20261008130000_endurecer_execucao_funcoes_internas.sql` | `20261008124445`, nome remoto `20261008130000_endurecer_execucao_funcoes_internas` | Há correspondência nominal sob versão diferente. O conteúdo local revoga EXECUTE em funções ligadas a triggers e funções internas; confirmar privilégios atuais e conteúdo antes de qualquer reparação. |
| `20261013100000_create_proforma_invoices.sql` | `20261013083057`, nome remoto `20261013100000_create_proforma_invoices` | Correspondência nominal sob versão diferente. A migration posterior de políticas administrativas também existe no ledger. |
| `20261013100000_fix_marketplace_pre_order_result_types.sql` | `20261013083950`, nome remoto `fix_marketplace_pre_order_result_types` | Correspondência por nome sob versão diferente; confirmar definição remota de `create_marketplace_pre_order`. |
| `20261013120000_admin_only_proformas.sql` | `20261013094717`, nome remoto `20261013120000_admin_only_proformas` | Correspondência nominal sob versão diferente; comparar as políticas remotas de `proforma_invoices`. |
| `20261013120000_fix_freight_load_buyer_reference.sql` | `20261013093538`, nome remoto `fix_freight_load_buyer_reference` | Correspondência por nome sob versão diferente; confirmar a definição remota do trigger `set_freight_load_order_participants`. |

### Ferramenta preventiva adicionada ao ramo de auditoria

Foi adicionado `scripts/audit-migrations.mjs` e o comando `npm run audit:migrations`. A ferramenta é **somente de leitura** e reporta:
- prefixos de versão duplicados;
- nomes que não seguem `YYYYMMDDHHMMSS_nome.sql`;
- ficheiros SQL vazios.

Com `npm run audit:migrations -- --check`, os achados fazem o comando terminar com código diferente de zero, útil para uma futura verificação de CI. O modo normal é apenas informativo para não bloquear já o repositório enquanto os duplicados históricos não forem reconciliados.

**Limite importante:** esta ferramenta não consulta o Supabase nem decide se uma migration foi aplicada. Não altera, renomeia ou executa SQL. A validação de execução e o estado do CI ainda têm de ser confirmados no ramo/PR.

### Próximos passos seguros

1. Comparar as definições remotas das funções e políticas listadas acima com os ficheiros locais (não apenas os nomes).
2. Inspecionar migrations locais sem correspondência nominal e as entradas remotas históricas sem nome, procurando evidência estrutural.
3. Executar a auditoria local e os gates existentes (`lint`, `type-check:strict`, `test`, `build`) num ambiente de desenvolvimento.
4. Só depois propor um plano explícito de reconciliação do ledger, sem `db push` nem alteração de produção nesta fase.


### Comparação de definições atuais: pré-compra e proformas

A consulta read-only ao catálogo PostgreSQL confirmou quatro definições remotas relevantes: `create_marketplace_pre_order`, `respond_to_pre_order`, `admin_update_pre_order_status` e `set_freight_load_order_participants`, além das políticas RLS de `proforma_invoices`.

- A definição remota de `create_marketplace_pre_order` corresponde funcionalmente ao ficheiro local de correção de tipos nos elementos centrais observados: valida autenticação, quantidade, localização, coordenadas, stock, vendedor, origem GPS e idempotência; devolve os tipos da RPC esperados.
- A definição remota atual de `respond_to_pre_order` contém verificações de estado de pagamento e reserva de stock que não aparecem na versão inicial de `20261007090000_fix_pre_order_acceptance_terms.sql` consultada. A função remota também atualiza subtotal/total e regista auditoria. Isto mostra que o ficheiro local, isoladamente, não representa toda a evolução posterior da função; é preciso localizar as migrations que a alteraram antes de classificar o histórico.
- A versão remota de `admin_update_pre_order_status` verifica permissões administrativas/de suporte, pagamento não liquidado, disponibilidade e reserva de stock. Não assumir que o corpo do ficheiro duplicado local é o corpo final em produção.
- A função remota `set_freight_load_order_participants` usa `pre_orders.user_id` para identificar o comprador e atribui `buyer_id`/ `supplier_id` à carga, coerente com o propósito declarado na migration local.
- As políticas atuais de `proforma_invoices` são as políticas administrativas de SELECT/INSERT/UPDATE/DELETE; as políticas iniciais de acesso pelo emissor não aparecem na lista atual. A alteração posterior parece estar refletida no esquema remoto consultado.

Esta comparação é de metadados/definições, não um teste de execução. Ainda falta localizar todas as migrations posteriores que modificaram estas funções e comparar o SQL completo de cada uma.

### Estado da validação automatizada

O estado do ramo foi consultado após as atualizações documentadas; confirmar o HEAD e o estado de CI diretamente no PR antes de usar estes dados como gate de merge. A consulta ao estado de CI devolveu `pending` sem verificações individuais registadas; por isso, não se declara build, lint ou testes aprovados. O PR #30 continua aberto em draft.


## Quarta passagem — privilégios RPC e primeira migration aditiva (não aplicada)

### Privilégios remotos observados

A consulta a `has_function_privilege` e aos corpos das funções confirmou:

- `create_freight_settlement_if_ready(uuid)` está executável por `anon` e `authenticated`, apesar de funcionar como helper interno chamado por `confirm_freight_handover` e `confirm_freight_receipt`. A função só cria um registo de settlement quando as confirmações já existem e o frete é positivo, mas a exposição direta é desnecessária e pode permitir invocações arbitrárias/repetidas do helper.
- A RPC legada `advance_freight_load(uuid)` também está executável por `anon` e `authenticated`. O frontend encontrado usa `advance_freight_load_status(uuid,text)`; a função legada faz transições automáticas accepted → in_transit → delivered sem as validações adicionais do fluxo atual.
- `accept_freight_load`, `confirm_freight_handover`, `confirm_freight_receipt` e `update_freight_tracking_location` também aceitam execução de `anon` ao nível de privilégios, embora os corpos verifiquem `auth.uid()` e identidade/atribuição. O acesso anónimo não é necessário para estas ações autenticadas.
- As funções de processamento da fila de email e o rate limiter interno estão corretamente limitados a `service_role` na consulta.

### Migration de hardening preparada

Foi criado `20261014190000_restrict_internal_freight_rpc_execution.sql`, que:
1. revoga execução da RPC logística legada a clientes;
2. torna `create_freight_settlement_if_ready` interno, mantendo `service_role` como executor direto;
3. restringe as RPCs de aceite, confirmações e localização a utilizadores autenticados.

O frontend consultado não chama a RPC logística legada. As funções de confirmação continuam a invocar o helper internamente como funções `SECURITY DEFINER`, pelo que a revogação de privilégios de cliente não elimina essas chamadas internas.

### Migration aditiva de orquestração preparada

Foi criado `20261014191000_create_multi_agent_orchestration_tables.sql`, ainda **não aplicado**, com:
- `agent_tasks`: fila idempotente de tarefas, risco, modo de autonomia, tentativas e resultado;
- `agent_events`: registo append-only de eventos;
- `agent_approvals`: pedidos de aprovação humana e decisão;
- índices de despacho, histórico e aprovações pendentes;
- RLS ativa e sem políticas para `anon`/`authenticated`, com privilégios explícitos apenas para `service_role`.

A migration é aditiva e não altera as tabelas comerciais existentes. Ainda requer validação num projeto de desenvolvimento antes de qualquer aplicação. O worker/Edge Function, a máquina de estados, a idempotência operacional e os testes ainda não foram implementados.

### Bloqueio de execução continua válido

As duas migrations foram adicionadas apenas ao ramo de trabalho. **Não foram executadas contra Supabase, não houve deploy funcional e não se afirma que estejam testadas.** Devido às colisões históricas e às divergências de versões do ledger, não aplicar estas migrations até validar o histórico num ambiente de desenvolvimento e confirmar o estado do CI.
