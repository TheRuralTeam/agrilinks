# Plano de integração isolada — Tracking GPS do motorista

## Identificação

- Repositório: `TheRuralTeam/agrilinks`
- Branch de integração: `feat/integrate-driver-gps-tracking`
- Branch base: `main`
- Commit exacto da base no momento da criação: `1047e14c009fa8b12af1e42edefc59be457fc7fe`
- Data: 27-11-2026
- Estado: **branch criada; documentação sincronizada; inventário inicial concluído; portabilidade de código ainda não iniciada**.

## Objectivo

Integrar exclusivamente o fluxo de recolha/handover, tracking GPS durante transporte, sincronização offline e visualização autorizada para comprador/Admin. A branch serve para portar e corrigir esse escopo sem incorporar alterações não relacionadas da branch original.

## Origem analisada

`feat/buyer-live-tracking-supplier-handover-receipt`

A comparação GitHub com `main` indicou 113 commits à frente e 19 atrás. A branch original contém alterações de checkout, pagamentos e distribuição de valores. Por isso, não será feito merge integral, rebase integral nem cherry-pick em massa.

## Regra de isolamento

A branch de integração foi criada directamente do SHA de `main` indicado acima. No momento da criação, não foram copiados commits, migrations ou ficheiros da branch de origem. Isto garante que o ponto de partida é o código actual de produção (branch principal), não a branch divergente.

## Escopo permitido para portar após revisão

- App Android do motorista e configuração Expo estritamente necessária ao tracking.
- Serviço de localização foreground/background e consentimento.
- Captura de localização apenas após evento de recolha/handover validado.
- Fila offline cifrada, sincronização idempotente, limites e política de retenção.
- RPCs, tabelas, índices, triggers e políticas RLS estritamente necessários ao tracking/handover.
- Storage privado para evidências de handover, com políticas por participante.
- Visualização de localização ao vivo para comprador e Admin autorizado.
- Testes unitários, SQL, integração e E2E para os fluxos acima.
- Documentação e instruções de QA/release.

Cada ficheiro e dependência deve ser comparado com `main` antes de ser portado. Se um ficheiro contiver alterações de pagamentos, checkout ou outros domínios, não deve ser copiado integralmente; extrair apenas a alteração necessária, com revisão manual.

## Fora do escopo

- Alterações de checkout e pagamento.
- Ledger, wallets, payout, distribuição de valores e reconciliação financeira.
- Alterações gerais do marketplace sem dependência demonstrada do tracking.
- Refactors amplos não necessários ao fluxo de entrega.

## Sequência de implementação

1. [x] Criar branch isolada a partir do SHA exacto de `main`.
2. [x] Registar a divergência da branch de origem e proibir merge integral.
3. [ ] Inventariar ficheiros e dependências do tracking na branch de origem.
4. [ ] Rever migrations/RPCs e políticas de acesso contra o schema actual de `main`.
5. [ ] Portar o fluxo de handover e evento de início de transporte.
6. [ ] Fazer o serviço Android iniciar/reconciliar após confirmação de recolha, sem depender de um botão tardio.
7. [ ] Encerrar tracking ao concluir/cancelar; separar posição ao vivo do histórico.
8. [ ] Definir limites, retenção, retry/backoff e recuperação da fila offline.
9. [ ] Validar autorização de comprador, motorista e Admin; testar acessos negativos.
10. [ ] Executar testes automatizados e build nativo Android.
11. [ ] Testar em dispositivos reais e redes intermitentes.
12. [ ] Abrir PR para `main`, com diff limitado e evidência de QA.

## Critérios para aceitar o PR

- Diff sem alterações financeiras/checkout não relacionadas.
- Migrations aditivas, reversíveis quando possível e validadas contra o schema de destino.
- Tracking começa apenas depois de recolha confirmada e consentimento/permissões válidos.
- Tracking termina em entrega concluída ou cancelamento.
- Dados offline são sincronizados sem duplicados e sem perda silenciosa.
- Posição antiga é identificada como desactualizada; não é apresentada como localização actual.
- RLS/RPC/Storage impedem leitura ou escrita por utilizadores não participantes.
- Testes cobrem rede, GPS, permissões, segundo plano, reinício e estados finais.
- Build Android e smoke tests documentados.
- SHA, PR, deployment e validação E2E registados separadamente.

## Estado e limites da confirmação

A criação da branch foi confirmada pela API GitHub. A branch contém inicialmente o mesmo conteúdo de `main` no SHA base indicado. A criação da branch **não** significa que o tracking esteja integrado, testado ou publicado. Não foram executados testes Android, SQL ou E2E nesta etapa.


## Actualização de execução — sincronização e inventário (27-11-2026)

- A documentação de referência foi sincronizada com o conteúdo actual de `main` nos ficheiros `docs/README.md` e `docs/operations/PROJECT_STATUS_AND_RELEASE.md`; o `FREIGHT_TRACKING_RUNBOOK.md` já estava igual.
- A comparação de `main` com a branch isolada confirma que as diferenças permanecem documentais: o plano desta branch e as actualizações de índice/estado. Não foi introduzido código funcional da branch de origem.
- Nova comparação da origem com `main`: 113 commits à frente e 26 atrás. O diff contém 50 ficheiros, incluindo app Android, componentes de tracking/handover, migrations e testes, mas também checkout, pagamentos, payout e alterações gerais que ficam excluídas.
- Inventário inicial dos componentes de tracking concluído: `apps/driver-android` (App, serviço GPS, outbox SQLite/SQLCipher), `src/components/BuyerFreightTracking.tsx`, migrations `20261127100000...` e `20261127110000...`, e teste SQL de handover/localização.
- Riscos confirmados para correcção antes de portar: activação Android depende de acção manual na primeira utilização; fila offline não tem limite explícito de registos/bytes/expiração; o mapa não condiciona explicitamente polling/Realtime ao estado `in_transit`; a RPC batch aceita sincronização tardia de cargas entregues (necessário manter o histórico sem reactivar o tracking); e a RPC legada de localização deve ser revista para impedir regressão temporal.
- A migration de segurança altera privilégios de leitura em `freight_loads`; requer comparação cuidadosa com políticas e colunas do schema actual antes de qualquer aplicação.
- Nenhuma migration foi aplicada em Supabase nesta etapa. Nenhum APK/AAB foi construído ou testado num dispositivo físico. Nenhuma alteração foi publicada em Production.

**Próximo passo técnico:** comparar as migrations e as dependências de schema/RLS com `main`, identificar os pontos de integração do evento de recolha já existentes e só então portar ficheiros pequenos e isolados.

## Revisão de compatibilidade com o schema actual de main — 27-11-2026

### Fluxo já existente em main

- `freight_load_locations` e as políticas base já existem; a leitura actual contempla criador/motorista e, numa migration posterior, fornecedor/comprador/Admin.
- A RPC `advance_freight_load_status` já executa as transições `accepted → at_pickup → in_transit → delivered`, valida motorista atribuído, pagamento e aprovação do preço de transporte.
- A migration de tracking de Outubro já contém `record_freight_load_location`; a versão actual actualiza a posição mais recente sem comparar timestamp de captura.
- O Admin já consulta eventos e localizações; a área do comprador já possui um componente de tracking no branch de origem, mas ainda precisa de ciclo de vida limitado a `in_transit`.

### Incompatibilidade bloqueante identificada

A migration de origem instala um trigger que impede qualquer transição para `in_transit` sem prova de entrega do fornecedor e confirmação do motorista. A RPC existente `advance_freight_load_status` tenta fazer precisamente essa transição sem passar pelo novo recibo. Logo, aplicar apenas a migration, sem migrar os chamadores e o fluxo de UI, pode bloquear a passagem legítima de cargas para transporte.

A integração tem de escolher um único caminho transaccional: o motorista confirma o recibo de entrega do fornecedor e essa RPC valida a prova, muda o estado para `in_transit` e regista o evento. A RPC antiga deve ser ajustada ou explicitamente impedida de fazer essa transição, sem deixar um caminho alternativo que contorne a prova.

### Outros pontos que exigem correcção

1. A migration de origem substitui a constraint de `freight_load_events.event_type`; antes de portar, enumerar todos os tipos efectivamente usados em `main` e preservar os existentes, para não quebrar operações Admin/entrega.
2. A RPC batch aceita amostras de cargas `in_transit` e `delivered` para permitir sincronização offline tardia. Isso é aceitável apenas para histórico com timestamp original; a posição ao vivo não pode ser reactivada nem retroceder após entrega.
3. A RPC legada `record_freight_load_location` ainda faz upsert sem condição temporal. A integração deve impor comparação de `captured_at` e evitar que chamadas legadas substituam uma posição mais recente.
4. A política de leitura actual de localizações deve ser mantida e testada com comprador real (incluindo `buyer_id`/pré-compra), fornecedor, motorista atribuído e Admin; não substituir por política mais restritiva sem avaliar fluxos existentes.
5. A migration de origem que revoga SELECT geral em `freight_loads` e concede SELECT por coluna é uma alteração transversal. Não portar automaticamente: inventariar todos os selects existentes, confirmar colunas necessárias e separar hardening de segurança do escopo GPS quando não for indispensável.
6. A fila SQLite cifra dados se SQLCipher estiver realmente presente no binário; a verificação em runtime é positiva, mas ainda falta provar num APK/AAB gerado. Também faltam limites de capacidade, retenção e backoff.

### Decisão de portabilidade

Não copiar a migration de origem integralmente. Criar migrations pequenas e sequenciais para (a) handover e transição segura, (b) ingestão offline/idempotente e protecção temporal, e (c) permissões estritamente necessárias. Portar componentes de UI/Android depois de os contratos SQL estarem estabilizados. A migration de segurança de leitura geral de `freight_loads` fica fora do port inicial, salvo justificação independente e auditoria completa de dependências.

**Estado:** revisão de compatibilidade iniciada; nenhuma migration foi aplicada remotamente; nenhuma funcionalidade foi ainda portada para esta branch.
