# Núcleo multiagente AgriLink — implementação e estado

**Data:** 2026-10-15  
**Estado:** esquema/RPCs aplicados; ambas as Edge Functions activas em produção; integração inicial do formulário B2B de sourcing implementada.

## Submissão autenticada — `agent-task-submit`

- Exige JWT válido de utilizador.
- Permite cinco tipos de tarefa: sourcing intake, descoberta de fornecedores, comparação de cotações, verificação de informação em falta e rascunho de notificação.
- Aceita apenas `observe` e `suggest`; não aceita execução autónoma pedida pelo cliente.
- Limita o corpo a 32 KiB, valida objectos JSON, exige chave de idempotência e limita a 10 tarefas activas por utilizador.
- A tarefa e o evento inicial são criados pela RPC `submit_agent_task` na mesma transacção.
- Após a submissão, a função agenda a invocação do worker em segundo plano com `EdgeRuntime.waitUntil`; o segredo permanece apenas no runtime servidor.
- Chaves de idempotência de outros utilizadores não revelam informação privada.

## Worker consultivo — `agent-orchestrator-worker`

- Exige o segredo interno `AGENT_WORKER_SECRET` no header `x-agent-worker-secret`.
- Usa `service_role` apenas no runtime da Edge Function.
- Processa no máximo cinco tarefas por invocação; usa leases, `FOR UPDATE SKIP LOCKED`, até cinco tentativas e backoff.
- Só produz resultados consultivos. Não envia mensagens, contacta fornecedores, altera produtos/stock, aceita pré-compras/cargas ou confirma pagamentos.
- Descoberta e comparação consultam apenas fornecedores confirmados e cotações confirmadas e ainda válidas já registadas na base de dados. Não contactam fornecedores nem criam cotações.

## Base de dados — aplicado e verificado

Foram aplicadas as migrations `20261015211625`, `20261015211638`, `20261015211647` e `20261015211704`.

- `agent_tasks`, `agent_events` e `agent_approvals` têm RLS activo e não permitem SELECT a `anon` ou `authenticated`.
- `submit_agent_task`, `claim_agent_task` e `finish_agent_task` são executáveis apenas por `service_role`.
- As RPCs sensíveis auditadas de frete/moderação já não permitem execução por `anon`; as operações de utilizadores autenticados mantêm os grants previstos.
- O histórico de migrations anteriores ainda tem colisões locais. Não executar `db push` até concluir a reconciliação histórica.

## Verificações pendentes

- As duas funções estão activas, mas ainda não existe evidência de um teste funcional ponta a ponta com uma tarefa real de sourcing; não foi criado um pedido comercial artificial em produção.
- O formulário B2B submete o pedido comercial primeiro e, separadamente, tenta enfileirar a tarefa. Se a submissão do agente falhar, o pedido de sourcing mantém-se válido e a interface informa que a verificação automática não foi iniciada.
- Não existe agendamento periódico. O worker é activado após uma submissão; uma falha de invocação deixa a tarefa persistida em fila até uma nova tentativa de activação.
- Descoberta de fornecedores e comparação de preços reais continuam dependentes de integrações verificadas.

## Próximos passos

1. Validar runtime com testes autenticados e não autenticados, segredo incorrecto, idempotência concorrente, lease expirada e retries.
2. Confirmar build/CI do commit de integração e testar uma solicitação de sourcing controlada, com autorização operacional.
3. Reconciliar as migrations históricas restantes antes de usar `db push`.

A implantação activa não substitui testes de runtime nem comprova a integração com dados reais.

O CI verde valida código e build, mas não substitui testes de runtime das Edge Functions nem comprova a integração com dados reais.


## Actualização de validação — 2026-10-15

- A validação dos campos de sourcing passou para `supabase/functions/_shared/agent-task-validation.ts` e tem testes unitários incluídos no CI.
- O worker foi actualizado e está activo na versão 3.
- A verificação de produção continuou sem tarefas em `agent_tasks`; por isso, a execução ponta a ponta continua pendente e não é declarada concluída.
- Foi criado o checklist operacional `docs/qa/multi-agent-operational-checklist-2026-10-15.md` com critérios de aceitação e passos para teste controlado.
