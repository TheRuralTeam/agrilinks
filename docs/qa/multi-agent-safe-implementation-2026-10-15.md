# Núcleo multiagente AgriLink — implementação e estado

**Data:** 2026-10-15  
**Estado:** esquema e RPCs aplicados em produção; Edge Functions ainda não implantadas.

## Submissão autenticada — `agent-task-submit`

- Exige JWT válido de utilizador.
- Permite cinco tipos de tarefa: sourcing intake, descoberta de fornecedores, comparação de cotações, verificação de informação em falta e rascunho de notificação.
- Aceita apenas `observe` e `suggest`; não aceita execução autónoma pedida pelo cliente.
- Limita o corpo a 32 KiB, valida objectos JSON, exige chave de idempotência e limita a 10 tarefas activas por utilizador.
- A tarefa e o evento inicial são criados pela RPC `submit_agent_task` na mesma transacção.
- Chaves de idempotência de outros utilizadores não revelam informação privada.

## Worker consultivo — `agent-orchestrator-worker`

- Exige o segredo interno `AGENT_WORKER_SECRET` no header `x-agent-worker-secret`.
- Usa `service_role` apenas no runtime da Edge Function.
- Processa no máximo cinco tarefas por invocação; usa leases, `FOR UPDATE SKIP LOCKED`, até cinco tentativas e backoff.
- Só produz resultados consultivos. Não envia mensagens, contacta fornecedores, altera produtos/stock, aceita pré-compras/cargas ou confirma pagamentos.
- Descoberta de fornecedores e comparação de cotações devolvem `integration_required` até existir integração a dados reais verificados.

## Base de dados — aplicado e verificado

Foram aplicadas as migrations `20261015211625`, `20261015211638`, `20261015211647` e `20261015211704`.

- `agent_tasks`, `agent_events` e `agent_approvals` têm RLS activo e não permitem SELECT a `anon` ou `authenticated`.
- `submit_agent_task`, `claim_agent_task` e `finish_agent_task` são executáveis apenas por `service_role`.
- As RPCs sensíveis auditadas de frete/moderação já não permitem execução por `anon`; as operações de utilizadores autenticados mantêm os grants previstos.
- O histórico de migrations anteriores ainda tem colisões locais. Não executar `db push` até concluir a reconciliação histórica.

## Ainda por activar

- As Edge Functions não foram implantadas.
- `AGENT_WORKER_SECRET` não foi configurado; a ferramenta disponível nesta sessão não permite gerir segredos de Edge Functions.
- Não existe agendamento do worker nem interface de submissão ligada ao núcleo.
- Não há integração real de descoberta de fornecedores/preços.

## Próximos passos

1. Configurar o segredo interno no Supabase.
2. Implantar e testar as duas Edge Functions, incluindo JWT inválido, segredo ausente, idempotência concorrente, lease expirada e retries.
3. Integrar a submissão na interface apenas depois dos testes.
4. Reconciliar as migrations históricas restantes antes de usar `db push`.

O CI verde valida código e build, mas não substitui testes de runtime das Edge Functions nem comprova a integração com dados reais.
