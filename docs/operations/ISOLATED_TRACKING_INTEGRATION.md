# Plano de integração isolada — Tracking GPS do motorista

## Identificação

- Repositório: `TheRuralTeam/agrilinks`
- Branch de integração: `feat/integrate-driver-gps-tracking`
- Branch base: `main`
- Commit exacto da base no momento da criação: `1047e14c009fa8b12af1e42edefc59be457fc7fe`
- Data: 27-11-2026
- Estado: **branch criada; isolamento confirmado; portabilidade de código ainda não iniciada**.

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
12. [ ] Abrir PR para `main), com diff limitado e evidência de QA.

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
