# Relatório de entrega unificada - AgriLink

## Estado geral

- Merge dos conflitos críticos concluído na branch `reunificar`.
- App compilada com sucesso em produção.
- Type-check estrito passou.
- ESLint passou sem warnings finais.
- 14 testes focados passaram.
- Auditoria local de migrations encontrou 198 ficheiros, sem versões duplicadas ou arquivos vazios.
- Não há marcadores de conflito `<<<<<<<`, `=======` ou `>>>>>>>` no código.
- O carrinho antigo e o botão flutuante antigo foram removidos da experiência principal.

## Correções realizadas

- Página de notificações em painel dividido no desktop e navegação directa no mobile.
- Destinos de comentários redirecionam para o produto e abrem os comentários.
- Página de compras individual em `/pagamento/:purchaseId`; `/carrinho` redireciona para o marketplace.
- Publicação automática da localização actual ao abrir o formulário de produto, com ajuste fino no mapa.
- Fornecedor continua a poder aceitar ou rejeitar a pré-compra.
- Negociação de frete limitada ao motorista e ao comprador.
- Motoristas com e-mail verificado e capacidade suficiente recebem cargas compatíveis.
- Motorista pode apresentar preço calculado ou manual e rever uma proposta recusada.
- Pagamento bloqueado até a proposta de frete ficar aprovada pelo comprador.
- P2P calcula produto + frete aprovado e usa o mesmo bloqueio financeiro.
- Comissão do fornecedor configurada em 8% do produto.
- Comissão do motorista configurada em 10% do frete.
- Ledger real de comissões criado no painel Financeiro.
- Painel Financeiro restrito ao proprietário `suporteagrilink@gmail.com` e aos visualizadores por ele autorizados.
- AdminUi e AdminFinance recuperados no caminho correcto.
- Aviso promocional do i18next desactivado.
- Service Worker desactivado no desenvolvimento para evitar reload automático durante HMR.
- Configurações Vite/Vitest migradas para resolução moderna de `src` sem `__dirname`.

## Migrações pendentes no Supabase

Ainda não foi aplicado SQL remoto. Aplicar, em ordem:

1. `20261124090000_notify_product_comments.sql`
2. `20261124120000_enable_recipient_notifications.sql`
3. `20261124170000_fanout_freight_quote_notifications.sql`
4. `20261124180000_three_party_freight_negotiation.sql`
5. `20261124190000_supplier_driver_commissions.sql`
6. `20261124200000_marketplace_commissions.sql`
7. `20261124210000_admin_finance_access_control.sql`

## Limitações residuais

- Nenhum provedor de gateway externo está configurado no registo actual; pagamentos EMIS/reais continuam indisponíveis até integrar e activar um adaptador seguro.
- Os repasses ao fornecedor e motorista ficam pendentes no ledger até existir uma liquidação operacional administrativa definida.
- O proprietário financeiro precisa confirmar a conta `suporteagrilink@gmail.com` com e-mail verificado no ambiente Supabase.
- A publicação usa geolocalização por navegador; sem permissão GPS, mantém o ajuste manual no mapa.
- A auditoria do Dashboard financeiro depende de comissões geradas após pagamento confirmado no backend.

## Deploy

- Build de produção concluído.
- Vercel CLI não estava disponível no ambiente no momento da auditoria.
- Supabase CLI não estava disponível no ambiente no momento da auditoria.
- O push para `origin/reunificar` e o deploy automático só devem prosseguir após commit local válido e credenciais remotas disponíveis.
