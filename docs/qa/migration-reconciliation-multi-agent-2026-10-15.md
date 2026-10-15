# Reconciliação de migrations — AgriLink

**Data:** 2026-10-15  
**Project ref:** `oqcrfqtlfqwrxxmsjpaf`

## Estado actual

As quatro migrations abaixo foram aplicadas com sucesso no Supabase de produção e o ledger remoto foi consultado depois da aplicação:

| Versão remota | Migration | Estado |
| --- | --- | --- |
| `20261015211625` | `restrict_internal_freight_rpc_execution` | Aplicada e verificada |
| `20261015211638` | `create_multi_agent_orchestration_tables` | Aplicada e verificada |
| `20261015211647` | `add_agent_task_claim_rpc` | Aplicada e verificada |
| `20261015211704` | `atomic_agent_task_submission` | Aplicada e verificada |

Os ficheiros locais foram alinhados com estas versões remotas. A consulta read-only confirmou RLS activo e sem SELECT para `anon`/`authenticated` nas tabelas `agent_tasks`, `agent_events` e `agent_approvals`. Também confirmou que as RPCs internas de tarefas só podem ser executadas por `service_role`, e que as RPCs sensíveis de frete/moderação já não permitem execução por `anon`.

## Colisões históricas ainda por resolver

O histórico anterior continua a ter colisões locais e diferenças de nomes/versões remotas. As correspondências abaixo não devem ser renomeadas automaticamente sem comparação do histórico Git, SQL e esquema actual:

| Prefixo local em colisão | Ficheiros |
| --- | --- |
| `20261007090000` | `fix_pre_order_acceptance_terms`; `functional_hardening_signup_identity_notifications` |
| `20261008130000` | `add_p2p_beneficiary_marketplace`; `endurecer_execucao_funcoes_internas` |
| `20261013100000` | `create_proforma_invoices`; `fix_marketplace_pre_order_result_types` |
| `20261013120000` | `admin_only_proformas`; `fix_freight_load_buyer_reference` |

Correspondências conhecidas no ledger remoto incluem `20261008124445`, `20261013083057`, `20261013083950`, `20261013093538` e `20261013094717`. O nome semelhante não prova equivalência de conteúdo.

## Limites operacionais

- Não executar `supabase db push` enquanto as colisões históricas não forem reconciliadas.
- Não foi criada branch Supabase, projecto, infraestrutura ou serviço pago.
- As Edge Functions multiagente ainda não foram implantadas; o worker não está activo.
- A implantação do worker exige configurar com segurança o segredo `AGENT_WORKER_SECRET`; a ferramenta disponível nesta sessão não permite gerir segredos de Edge Functions.
- Descoberta de fornecedores e comparação de cotações continuam sem integração a dados reais.

## Próximos passos

1. Reconciliar as migrations históricas restantes sem alterar o ledger manualmente.
2. Configurar `AGENT_WORKER_SECRET` no gestor de segredos do Supabase.
3. Implantar as Edge Functions e testar autenticação, idempotência, lease/retry e fluxos de erro.
4. Só depois ligar a submissão à interface da AgriLink e activar invocação do worker; não criar cron/serviço adicional sem necessidade validada.
5. Confirmar CI no último commit antes de integrar o código em `main`.
