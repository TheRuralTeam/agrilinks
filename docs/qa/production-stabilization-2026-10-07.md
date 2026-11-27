# AgriLink — Production Stabilization & E2E QA Baseline

Data: 2026-10-07

## Objetivo
Esta branch é dedicada à estabilização da produção e à validação ponta a ponta. Não adicionar funcionalidades novas enquanto os fluxos críticos não estiverem comprovados.

## Estado observado

### Deploy
- HEAD auditado: 47d088c
- Vercel: failure
- Motivo reportado pelo check: build-rate-limit
- Último commit encontrado com Vercel success: 16cb496e
- Diferença entre esse último sucesso e HEAD: 6 commits

Regra: nenhuma alteração em main deve ser considerada publicada até o SHA de produção ser confirmado.

### Dados operacionais
- utilizadores: 114
- produtos: 2
- pre_orders: 12
- orders: 0
- transactions: 0
- payment_intents: 0
- payment_attempts: 0
- payment_webhook_events: 0
- freight_loads: 1
- push_subscriptions: 1

Isto significa que a infraestrutura existe, mas os fluxos transacionais ainda precisam de prova E2E.

## Bloqueadores P0
1. Recuperar o pipeline Vercel.
2. Confirmar o SHA efetivamente servido em produção.
3. Executar smoke test de autenticação.
4. Executar publicação de produto.
5. Executar pre-order.
6. Executar checkout/payment intent.
7. Executar webhook e promoção para order.
8. Executar freight load → motorista → pickup → in_transit → delivered.
9. Confirmar settlement/auditoria.
10. Remover indicadores de logística que não sejam derivados de dados reais.

## P1 — Segurança
Auditar individualmente SECURITY DEFINER acessíveis a anon/authenticated, tabelas internas sem RLS, policies duplicadas/permissivas e rate limits.

## P1 — Dados artificiais identificados
src/pages/MapView.tsx contém indicadores que não devem ser apresentados como estado operacional real:
- Tempo estimado: 4–8h
- Próximas 24h
- progresso fixo de 60%
- contador de trânsito calculado a partir de filteredProducts.

Até existir uma fonte real de freight tracking, a UI deve mostrar estado neutro/aguardando dados em vez de inventar progresso.

## P1 — Pontos de agregação
A landing apresenta 3 pontos de agregação. As coordenadas de alguns pontos estão marcadas no código como aproximadas/pendentes de confirmação.

Não apresentar um ponto como operacional confirmado até a equipa de operações validar nome, endereço e coordenadas.

## E2E mínimo
### E2E-01 Publicação
Agricultor → login → perfil → produto → 3 imagens → localização → submissão → aprovação → marketplace.
### E2E-02 Compra
Comprador → produto → quantidade → pre-order → reserva → checkout → payment intent → provider → webhook → order.
### E2E-03 Logística
Order → freight load → motorista → aceite → pickup → localização → in_transit → delivered.
### E2E-04 Liquidação
Delivered → confirmação → allocation → transaction/wallet → auditoria → notificações.

## Critério de aprovação
Um fluxo só pode ser marcado como FUNCIONAL quando funciona na UI, persiste o estado correto no Supabase, a transição seguinte lê esse estado real, autorização impede ações indevidas, refresh/relogin mantém o estado e erros não deixam estado parcialmente gravado.

## Classificação
- 🟢 Funcional comprovado
- 🟡 Implementado, mas não comprovado E2E
- 🟠 Parcial / depende de integração
- 🔴 Quebrado ou com comportamento enganoso
- ⚪ Ainda não testado

## Regra de publicação
Não fazer merge de correções de produção diretamente sem build/CI aprovado, smoke test e confirmação do SHA publicado.