# Reconciliação de migrations — AgriLink

**Data:** 2026-10-15  
**Project ref:** `oqcrfqtlfqwrxxmsjpaf`

## Estado verificado

Foram aplicadas em produção e verificadas as quatro migrations da orquestração multiagente:

| Versão remota | Migration | Estado |
| --- | --- | --- |
| `20261015211625` | `restrict_internal_freight_rpc_execution` | Aplicada e verificada |
| `20261015211638` | `create_multi_agent_orchestration_tables` | Aplicada e verificada |
| `20261015211647` | `add_agent_task_claim_rpc` | Aplicada e verificada |
| `20261015211704` | `atomic_agent_task_submission` | Aplicada e verificada |

As versões locais foram alinhadas com o ledger remoto para cinco migrations antigas:

| Versão remota | Ficheiro activo |
| --- | --- |
| `20261008124445` | `20261008124445_endurecer_execucao_funcoes_internas.sql` |
| `20261013083057` | `20261013083057_create_proforma_invoices.sql` |
| `20261013083950` | `20261013083950_fix_marketplace_pre_order_result_types.sql` |
| `20261013093538` | `20261013093538_fix_freight_load_buyer_reference.sql` |
| `20261013094717` | `20261013094717_admin_only_proformas.sql` |

Os ficheiros SQL foram preservados durante a renomeação. Três migrations com prefixos duplicados e sem correspondência directa de versão no ledger foram movidas para `docs/qa/migration-archive/`, fora da pasta activa do Supabase CLI. A decisão baseou-se na verificação read-only da produção: as dez tabelas P2P alvo e respectivas políticas existem; as funções actuais de pré-compra, identidade e notificações existem com lógica posterior e triggers adicionais. Os ficheiros arquivados são preservados para auditoria e **não devem ser reaplicados** sobre o esquema actual.

## Verificações de segurança

- `agent_tasks`, `agent_events` e `agent_approvals` têm RLS activo e não concedem SELECT a `anon`/ `authenticated`.
- As RPCs internas `submit_agent_task`, `claim_agent_task` e `finish_agent_task` estão limitadas a `service_role`.
- As RPCs sensíveis de frete identificadas na auditoria não permitem execução por `anon`.

## Divergência histórica ainda existente

O ledger remoto contém 184 entradas e a árvore local tinha 165 ficheiros SQL antes desta reconciliação. As três migrations arquivadas continuam preservadas, mas ficam fora do conjunto activo. Permanecem entradas históricas remotas sem ficheiro SQL correspondente no repositório; não é seguro reconstruir o seu conteúdo apenas a partir dos nomes do ledger.

Por isso:
- **Não executar `supabase db push`** até recuperar/reconciliar as migrations históricas em falta e comparar o SQL, o histórico Git e o esquema actual.
- Não editar manualmente o ledger remoto nem marcar migrations como aplicadas sem evidência.
- Não criar projecto/branch Supabase, infraestrutura ou serviços pagos.

## Activação dos agentes

As tabelas e RPCs estão aplicadas e as Edge Functions `agent-task-submit` e `agent-orchestrator-worker` estão activas em produção. O utilizador confirmou a criação do segredo `AGENT_WORKER_SECRET`. A função de submissão foi actualizada para activar o worker em segundo plano após a criação de uma tarefa. O formulário B2B de sourcing também foi ligado à submissão consultiva, sem tornar o sucesso do pedido comercial dependente do agente. Ainda falta comprovar o fluxo ponta a ponta com uma tarefa real; os registos consultados não mostram chamadas das funções no intervalo verificado. Não existe agendamento periódico e não foi criada infraestrutura paga.

## Próximos passos

1. Recuperar do histórico Git/backup as migrations remotas sem ficheiro local e confirmar equivalência por SQL/esquema.
2. Executar testes de runtime para autenticação, segredo incorrecto, idempotência concorrente, leases e retries.
3. Validar uma solicitação de sourcing controlada e confirmar evento, resultado e estado final da tarefa.
4. Não criar cron/worker pago ou infraestrutura adicional sem necessidade validada.
