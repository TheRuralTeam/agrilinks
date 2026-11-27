# Runbook — pré-compras e caixa de entrada do fornecedor

## Fluxo esperado

1. Comprador escolhe um produto publicado e submete uma pré-compra.
2. O registo é persistido em `public.pre_orders` com referência ao produto e comprador.
3. O fornecedor proprietário do produto consegue consultar o pedido.
4. É criada notificação `pre_order_received` para o fornecedor.
5. O fornecedor abre a página de pedidos recebidos ou o perfil e vê o pedido.
6. O fornecedor aceita ou rejeita através do fluxo de resposta existente.
7. O estado fica persistido e o comprador consegue acompanhar a resposta.

## Componentes identificados

- Tabela: `public.pre_orders`.
- Relação de propriedade: `pre_orders.product_id → products.id`; o fornecedor é `products.user_id`.
- RPC de resposta existente: `respond_to_pre_order(uuid,text)`. Não substituir nem enfraquecer as validações de propriedade sem revisão específica.
- Migration: `supabase/migrations/20261126180000_supplier_preorder_inbox.sql`.
- Frontend integrado pelo PR [#79](https://github.com/TheRuralTeam/agrilinks/pull/79).
- Páginas com actualização Realtime: `src/pages/SupplierOrders.tsx` e `src/pages/Profile.tsx`.
- Notificações: `src/pages/Notifications.tsx`.

## Segurança e autorização

- O fornecedor só pode ler pré-compras dos seus próprios produtos.
- A política deve verificar a propriedade através de `products.user_id = auth.uid()`.
- Registos eliminados logicamente não devem aparecer na caixa de entrada.
- Não permitir que o cliente altere livremente o estado da pré-compra por escrita directa.
- A operação de aceitar/rejeitar deve passar pela RPC validada no servidor.
- Não confiar em product_id, supplier_id ou status enviados pelo cliente sem validação de propriedade.

## Notificação e Realtime

A migration cria trigger após INSERT para notificar o fornecedor e inclui `pre_orders` na publicação `supabase_realtime` quando necessário. Também contém backfill para pedidos pendentes sem notificação correspondente.

O backfill foi reportado como tendo gerado notificações para 7 pedidos existentes. Antes de repetir qualquer backfill, confirmar deduplicação por pedido/tipo/destinatário para não gerar notificações duplicadas.

Realtime é uma optimização de actualização imediata; a consulta inicial e o refresh manual continuam necessários para recuperação após desconexão.

## Teste E2E obrigatório

Preparar duas contas de teste: comprador A e fornecedor B, com um produto pertencente a B.

| Passo | Acção | Resultado esperado |
|---|---|---|
| 1 | Comprador A submete pré-compra | Um registo novo em `pre_orders` |
| 2 | Consultar notificações do fornecedor B | Uma notificação `pre_order_received` |
| 3 | Abrir perfil/pedidos do fornecedor B | Pedido aparece com produto, quantidade e comprador |
| 4 | Abrir a mesma página noutro separador e inserir novo pedido | Lista actualiza via Realtime |
| 5 | Actualizar página ou reconectar | Pedido continua visível via consulta inicial |
| 6 | Fornecedor B aceita pedido de teste | Estado esperado persistido; sem escrita directa pelo cliente |
| 7 | Repetir com outro pedido e rejeitar | Estado de rejeição persistido |
| 8 | Comprador A consulta histórico | Estado actualizado visível ao comprador |
| 9 | Fornecedor C tenta consultar pedido de B | Acesso negado/nenhum registo exposto |
| 10 | Fornecedor C tenta responder ao pedido de B | RPC rejeita por falta de propriedade |

## Diagnóstico

- Pedido não aparece, mas registo existe: verificar RLS e associação do produto ao fornecedor.
- Pedido aparece após refresh, mas não imediatamente: verificar publicação Realtime, subscription e filtros.
- Pedido existe, notificação não: verificar trigger, função, recipient_id e erros SQL.
- Notificação existe, link falha: verificar rota `/pedidos-fornecedor` e estado de autenticação.
- Aceitação/rejeição falha: verificar resposta RPC, estado actual e autorização do fornecedor.

## Critério de conclusão

Marcar como validado apenas após executar o fluxo com duas contas distintas, confirmar isolamento entre fornecedores, testar aceitação e rejeição e verificar o comportamento na versão de Production publicada.
