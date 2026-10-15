# Checklist operacional — sourcing e núcleo multiagente AgriLink

**Data da preparação:** 2026-10-15  
**Âmbito:** pedido de sourcing B2B → tarefa consultiva → resultado auditável  
**Restrições:** sem tarefa comercial artificial em produção, sem agendamento pago e sem activar acções comerciais automáticas.

## Estado confirmado

- [x] As funções `agent-task-submit` e `agent-orchestrator-worker` estão activas no Supabase.
- [x] A submissão exige JWT válido; o worker usa autenticação própria por segredo interno.
- [x] As tabelas de tarefas, eventos e aprovações têm RLS activo e não expõem SELECT directo a `anon`/utilizadores autenticados.
- [x] A criação da tarefa e do evento inicial usa uma RPC atómica.
- [x] O worker mantém comportamento consultivo e não altera stock, produtos, pré-compras, frete, pagamentos ou mensagens.
- [x] A validação do pedido de sourcing foi extraída para um módulo reutilizável e foram adicionados testes unitários ao CI.
- [x] O worker foi actualizado para a versão 3 com a mesma validação partilhada.
- [ ] Ainda não foi concluído um teste ponta a ponta com um utilizador autenticado.
- [ ] A tabela `agent_tasks` estava vazia na verificação de 2026-10-15; não há ainda resultado real para inspeccionar.
- [ ] Não há agendamento periódico: a activação depende de uma submissão ou re-tentativa que invoque o worker.

## Teste controlado — executar apenas com um utilizador autorizado

1. Entrar na AgriLink com uma conta de comprador de teste autorizada.
2. Abrir um perfil B2B e submeter uma solicitação real/consentida com produto agrícola do catálogo, quantidade positiva, unidade, província/município e data de entrega válidos.
3. Confirmar na interface que o pedido foi registado. Se o envio da tarefa falhar, o pedido comercial deve continuar registado e a interface deve informar que a verificação automática não arrancou.
4. Consultar `public.sourcing_requests` em modo somente leitura e confirmar que existe uma única solicitação correspondente ao pedido submetido.
5. Consultar `public.agent_tasks` em modo somente leitura e confirmar uma tarefa `sourcing_intake` com a mesma chave `sourcing-<id-do-pedido>`.
6. Consultar `public.agent_events` e confirmar os eventos de criação, aquisição e conclusão da tarefa.
7. Confirmar que a tarefa termina em estado de sucesso e que o resultado indica `ready_for_human_review` quando os campos obrigatórios estão presentes.
8. Repetir o mesmo envio apenas se for um retry do mesmo pedido; a chave de idempotência não deve criar uma segunda tarefa.
9. Confirmar que um pedido sem JWT válido é recusado e que uma chamada ao worker sem segredo válido recebe `401`. Não expor segredos nos registos nem em ferramentas de browser.
10. Verificar os logs das duas funções para erros de autenticação, RPC, despacho e execução.

## Critérios de aceitação

- O pedido comercial não desaparece se o serviço de agentes estiver indisponível.
- Um pedido válido gera no máximo uma tarefa por chave de idempotência.
- O resultado é auditável por tarefa e eventos.
- Falhas transitórias podem ser re-tentadas segundo o mecanismo existente; uma tarefa em fila não deve ser considerada processada sem um resultado persistido.
- A interface não afirma que fornecedores foram contactados nem que preços foram consultados. Essas capacidades só podem ser activadas depois de integrar fontes reais e verificáveis.
- Nenhum segredo de serviço é enviado ao browser, incluído no payload do cliente ou escrito nos logs.

## Limitações e próximos passos

- Sem scheduler, uma falha no despacho pode deixar uma tarefa em fila até outra invocação. A opção actual evita custos adicionais; a recuperação operacional deve ser observada e re-tentada por um mecanismo autorizado.
- Descoberta de fornecedores e comparação de cotações continuam a devolver `integration_required` até existirem integrações reais.
- A reconciliação histórica das migrations permanece incompleta. Não executar `supabase db push` até concluir a auditoria das versões e confirmar equivalência SQL.
- Os avisos de segurança do Supabase devem ser analisados por finding. Não adicionar políticas de leitura pública a tabelas internas apenas para silenciar o aviso de RLS sem políticas.
- A aprovação de um check de Vercel valida o deploy web correspondente; não prova o teste ponta a ponta das Edge Functions.
