# Arquitetura de pagamentos enterprise — AgriLink

## Estado
Sem PSP activo. O sistema deve permanecer sem pagamentos reais até existir provedor, credenciais, contrato e sandbox/produção aprovados.

## Domínio financeiro
```text
Comprador
   ↓
Pré-compra aceite
   ↓
Checkout Summary (servidor)
   ↓
Payment Intent
   ↓
Provider Adapter
   ├── checkout
   ├── webhook verification
   ├── status/reconciliation
   └── refund
   ↓
PSP
   ↓
Webhook verificado
   ↓
Payment Webhook Event (idempotente)
   ↓
Payment Intent = succeeded
   ↓
Pré-compra = paid
   ↓
Pedido / Frete liberado
   ↓
Entrega
   ↓
Allocations / Settlement / Ledger
```

## Separação obrigatória
- `payment_intents`: intenção comercial de pagamento.
- `payment_attempts`: tentativas individuais contra o PSP.
- `payment_webhook_events`: inbox de eventos externos, com deduplicação.
- `payment_allocations`: distribuição financeira entre participantes.
- `payment_refunds`: reembolsos.
- `transactions`: ledger interno.
- `wallets`: saldo interno; não deve ser requisito para comprar no marketplace.
- `payment_providers`: catálogo/configuração operacional do PSP.

## Idempotência
Todo pedido de criação de pagamento e reembolso recebe uma chave única. Webhooks usam `provider_id + provider_event_id` como identidade externa e verificam hash do payload.

PSPs podem reenviar webhooks e eventos podem chegar fora de ordem. Por isso o estado final deve ser determinado no backend e nunca pelo retorno da página de checkout. Esta abordagem segue as boas práticas actuais de processamento idempotente de webhooks e retries de PSPs. 

## Segurança
- Segredos ficam exclusivamente em secrets/env do runtime.
- Frontend nunca recebe service role nem credenciais do PSP.
- Webhook deve verificar assinatura/autenticidade antes da persistência financeira.
- Valor e moeda recebidos do PSP são comparados com o Payment Intent.
- Nenhum endpoint público pode marcar uma pré-compra como paga.
- Nenhum modo mock/simulador deve estar activo em produção.

## Ambientes
### Development
Provider desligado ou sandbox local. Sem dinheiro real.

### Test
PSP sandbox. Webhooks de teste. Testes automatizados.

### Staging
Configuração semelhante à produção, mas com contas e credenciais sandbox.

### Production
Somente PSP contratado, credenciais live, webhook HTTPS, observabilidade, reconciliação e aprovação operacional.

## Quando o PSP for escolhido
Implementar somente o adapter correspondente. A lógica de checkout, pedidos, frete, tracking e entrega permanece inalterada.

## Critério de produção
Não basta o checkout abrir. Para considerar pagamentos enterprise funcionais é necessário provar:
1. criação idempotente;
2. pagamento pendente;
3. sucesso via webhook verificado;
4. falha/cancelamento;
5. timeout/retry;
6. webhook duplicado;
7. webhook fora de ordem;
8. divergência de valor/moeda;
9. refund total/parcial;
10. reconciliação PSP ↔ AgriLink;
11. auditoria;
12. liberação do frete somente após pagamento confirmado.