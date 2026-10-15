# Arquitetura Multiagente AgriLink

**Estado:** proposta de arquitetura; ainda não implementada em produção  
**Data da auditoria inicial:** 2026-10-14  
**Repositório base:** `TheRuralTeam/agrilinks`

## Objetivo

Coordenar agricultores/fornecedores, compradores, motoristas, agentes humanos e administradores através de workflows rastreáveis. Os agentes de IA apoiam tarefas específicas; não substituem a autorização de negócio nem escrevem diretamente nas tabelas operacionais.

## Princípios não negociáveis

1. **PostgreSQL é a fonte de verdade.** Um agente nunca inventa disponibilidade, preços, pagamentos, localização ou estado de uma encomenda.
2. **Identidade humana separada da identidade do agente.** `user_type = agente` representa um agente humano; agentes de software são capacidades internas registadas no código e nos workflows.
3. **Autorização no servidor.** A interface pode esconder ações, mas toda a ação é novamente validada no backend. Nunca confiar apenas no papel enviado pelo cliente.
4. **Mínimo privilégio.** Tabelas de orquestração não recebem políticas abertas para `anon` ou `authenticated`; a leitura do centro de operações é feita por endpoints que aplicam autorização e filtragem por entidade.
5. **Autonomia limitada por política.** Leituras, classificação, resumos, deteção de dados em falta e preparação de propostas podem ser automatizados. Alterar stock, aceitar encomendas/cargas, aprovar preços, confirmar pagamentos, alterar permissões, suspender contas ou executar operações financeiras requer uma regra determinística e, quando aplicável, aprovação humana.
6. **Idempotência e concorrência.** Eventos e tarefas têm chaves de idempotência, transições de estado validadas e bloqueios transacionais quando necessário.
7. **Auditoria imutável por append.** Registar autor, agente, ação, entidade, resultado, motivo, timestamp e correlação do workflow; não guardar tokens, segredos ou conteúdo pessoal desnecessário.
8. **Sem execução livre de SQL por LLM.** Os agentes chamam ferramentas de negócio explicitamente autorizadas com schemas validados.
9. **Falhas seguras.** Timeout, resposta inválida ou indisponibilidade de IA devem deixar a operação em estado recuperável, nunca marcar uma encomenda como concluída.
10. **Compatibilidade retroativa.** Não substituir os workflows existentes de sourcing, pré-compra, pagamentos, faturas proforma e GPS; integrar através de eventos e funções bem definidas.

## Componentes propostos

### 1. Orquestrador

Recebe um objetivo de negócio, verifica o contexto autorizado, cria tarefas com dependências, encaminha para agentes especializados e acompanha os resultados. Não possui poder de negócio implícito: cada ferramenta tem a sua própria autorização.

### 2. Catálogo de capacidades

Definições versionadas no código: nome, descrição, entradas/saídas validadas, permissões necessárias, nível de risco, timeout, limites de custo e ações permitidas. Não permitir que utilizadores criem prompts executáveis ou atribuam permissões a agentes.

### 3. Motor de workflows

Estados propostos para tarefas: `queued`, `running`, `waiting_approval`, `completed`, `failed`, `cancelled`. Requer tentativas limitadas, `available_at`, lease/timeout, chave de idempotência, `correlation_id` e registo de transições.

### 4. Camada de política e aprovação

- **Baixo risco:** consultas autorizadas, resumos, deteção de campos em falta, classificação, criação de rascunhos e notificações operacionais permitidas.
- **Risco moderado:** criação de tarefas internas, pedido de confirmação ao utilizador e preparação de propostas; limites definidos por regra.
- **Alto risco:** dinheiro, pagamentos, stock reservado, publicação/remoção, aceitação de encomenda/carga, preço final de frete, documentos legais, verificação de identidade, permissões e suspensão de contas. Exigir função de negócio existente e/ou aprovação explícita.

### 5. Pontes de entidades

Cada workflow tem um identificador de correlação e liga referências tipadas para `product`, `sourcing_request`, `pre_order`, `freight_load`, `proforma_invoice` e `user`. Só guardar os IDs necessários; verificar a relação entre cada participante e a entidade antes de revelar dados.

### 6. Centro de Operações Multiagente

Adicionar uma secção ao painel administrativo existente, protegida por `view_analytics` para observação e permissões específicas para cada ação. Mostrar:
- tarefas pendentes, em execução, bloqueadas e falhadas;
- workflow e entidades relacionados;
- razão da recomendação e evidências consultadas;
- ações aguardando aprovação;
- tentativas, duração e erros sanitizados;
- histórico de eventos e responsável humano.

Não mostrar cadeia de pensamento privada do modelo; mostrar explicações concisas, evidências, política aplicada e resultado verificável.

## Modelo de dados proposto (apenas após reconciliação de migrações)

- `agent_tasks`: tarefas e estado, tipo de tarefa allowlisted, requerente, entidade/correlação, payload mínimo validado, resultado sanitizado, tentativas e timestamps.
- `agent_events`: eventos append-only com `task_id`, `correlation_id`, ator humano/agente/sistema, tipo, entidade, resultado e metadata minimizada.
- `agent_approvals`: ação proposta, política, requerente, revisor, decisão, motivo e timestamps.
- Opcionalmente, uma tabela de outbox para publicação fiável de eventos, apenas se a infraestrutura existente não cobrir o requisito.

Não criar uma tabela de agentes que permita configurar livremente prompts, permissões ou acesso à base de dados. O catálogo de capacidades começa versionado no código.

## Plano de implementação

### Fase 0 — auditoria e reconciliação (obrigatória)
1. Comparar migrações versionadas no Git com o histórico remoto e validar por nome/conteúdo quais foram aplicadas.
2. Comparar esquema remoto com `src/integrations/supabase/types.ts` e as migrations existentes.
3. Rever funções `SECURITY DEFINER`, `search_path`, grants de execução e políticas RLS nas entidades operacionais.
4. Definir matriz de permissões por entidade e por ação.
5. Registar a baseline de CI e os bugs operacionais existentes; não misturar correções de logística/pagamentos com a fundação de agentes.

### Fase 1 — núcleo mínimo
1. Adicionar migração aditiva e reversível para tarefas/eventos/aprovações, após concluir a fase 0.
2. Manter as tabelas internas inacessíveis diretamente aos clientes; usar Edge Functions autenticadas e endpoints com autorização.
3. Implementar catálogo de capacidades, schema validation, idempotência e logging.
4. Criar testes de permissões, isolamento entre utilizadores, duplicação de eventos e transições inválidas.

### Fase 2 — centro de operações em modo de observação
1. Adicionar rota lazy-loaded ao painel administrativo atual.
2. Mostrar métricas e tarefas sem permitir ações de risco elevado.
3. Testar com dados sintéticos e uma conta de teste antes de habilitar dados reais.

### Fase 3 — primeiro workflow ponta a ponta
Começar com um workflow de sourcing: pedido existente → verificar campos → encontrar ofertas existentes → preparar resumo/proposta → pedir confirmação humana. Não alterar stock, preço, pedido nem pagamento autonomamente.

### Fase 4 — pontes de logística e execução limitada
Integrar eventos existentes de aceitação, recolha, GPS e entrega. Só avançar estado através das RPCs de negócio já autorizadas; localização apenas com consentimento e durante a operação.

### Fase 5 — expansão
Suporte, agentes de campo, reconciliação financeira assistida e inteligência de mercado com métricas de qualidade, custo, latência e falsos alertas.

## Critérios de aceitação

- Nenhuma regressão nos fluxos atuais de sourcing, pré-compra, proforma, pagamentos e GPS.
- Todas as ações sensíveis são autorizadas no servidor e auditadas.
- Um utilizador nunca consulta tarefas, mensagens ou dados de outro utilizador sem uma relação autorizada.
- Repetir um evento não duplica efeitos.
- Falhas de IA não alteram estados de negócio.
- CI: lint, type-check estrito, testes, build e revisão das migrations.
- Migrações testadas numa branch/base de desenvolvimento antes de qualquer aplicação em produção.
