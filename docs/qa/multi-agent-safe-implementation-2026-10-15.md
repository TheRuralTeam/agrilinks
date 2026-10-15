# Implementação inicial segura do núcleo multiagente

**Data:** 2026-10-15  
**Ramo:** `feat/multi-agent-core-audit`  
**Estado:** código preparado em branch; não implantado nem aplicado ao Supabase.

## O que foi implementado no código

### 1. Submissão autenticada — `agent-task-submit`

- Exige JWT válido de utilizador.
- Permite apenas cinco tipos de tarefa allowlisted: sourcing intake, descoberta de fornecedores, comparação de cotações, verificação de informação em falta e rascunho de notificação.
- Aceita apenas modos `observe` e `suggest`; o cliente não pode pedir execução autónoma.
- Limita o corpo a 32 KiB, valida objectos JSON e exige chave de idempotência.
- Limita a 10 tarefas activas por utilizador.
- A criação da tarefa e o evento inicial são efectuados pela RPC server-side `submit_agent_task` na mesma transacção.
- A chave de idempotência é única. Uma colisão de chave de outro utilizador não revela os dados da tarefa existente.

### 2. Worker consultivo — `agent-orchestrator-worker`

- Não exige JWT de utilizador final; exige o segredo interno `AGENT_WORKER_SECRET` no header `x-agent-worker-secret`.
- Usa a chave `service_role` exclusivamente no runtime da Edge Function, nunca no browser.
- Processa no máximo cinco tarefas por invocação.
- Só produz resultados consultivos: não envia mensagens, não contacta fornecedores, não altera produtos/stock, não aceita pré-compras/cargas e não confirma pagamentos.
- Sourcing e verificação de informação identificam campos em falta. Rascunhos de notificação ficam por enviar.
- Descoberta de fornecedores e comparação de cotações devolvem explicitamente `integration_required` enquanto não existir consulta a dados reais verificados.
- Regista eventos de claim, conclusão, rejeição e retry; os eventos são gravados na mesma transacção que a transição de estado final.
- Usa lease, bloqueio concorrente com `FOR UPDATE SKIP LOCKED`, até cinco tentativas e backoff de retry. Tarefas abandonadas após a última lease são marcadas como falhadas.

### 3. RPCs internas

As migrations propostas adicionam:
- `claim_agent_task`: reclama uma tarefa de forma atómica e cria lease.
- `submit_agent_task`: cria tarefa e evento inicial atomicamente.
- `finish_agent_task`: valida a lease do worker e grava transição de estado + evento numa transacção.
- Todas estas RPCs têm execução revogada para `PUBLIC`, `anon` e `authenticated`, sendo concedida apenas a `service_role`.

## O que ainda NÃO está activo

- Nenhuma migration foi aplicada a qualquer base de dados.
- Nenhuma Edge Function foi implantada.
- O segredo `AGENT_WORKER_SECRET` não foi criado nem configurado.
- Não existe ainda agendamento/cron para invocar o worker.
- Não existe integração real de descoberta de fornecedores ou preços.
- Não existe ainda interface de submissão nem centro de operações multiagente.
- A reconciliação do histórico de migrations continua pendente; não executar `db push` em produção.

## Validação necessária antes de activar

1. Confirmar CI verde no commit mais recente.
2. Reconciliar o histórico de migrations e preparar um ambiente de desenvolvimento isolado.
3. Aplicar as migrations apenas nesse ambiente.
4. Verificar grants e RLS por consultas read-only e executar testes de concorrência, idempotência, lease expirada, retry, payload inválido e JWT/segredo ausente.
5. Só depois implantar as Edge Functions no ambiente de desenvolvimento, definir o segredo interno e testar chamadas autenticadas.
6. Configurar invocação periódica apenas depois de confirmar que o worker é seguro e observável.
7. Manter o PR em draft até a validação completa.

## Limite importante

O CI de frontend pode não validar integralmente código Deno/Edge Functions nem executar SQL contra PostgreSQL. Um build verde não equivale a uma implantação segura. Esta implementação deve ser tratada como código candidato, não como funcionalidade disponível aos utilizadores.
