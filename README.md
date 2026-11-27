# AgriLink

Plataforma AgriTech de ligação entre produtores, fornecedores, compradores e operadores logísticos em Angola.

Este README é o ponto central de acompanhamento técnico e operacional do projecto. **As tarefas abaixo distinguem o que já foi integrado, o que está em desenvolvimento e o que ainda depende de validação ou de acesso externo.** Um merge no GitHub ou um Preview `Ready` na Vercel não significa, por si só, que a funcionalidade esteja publicada e validada em produção.

## Estado geral

| Área | Estado | Observação |
|---|---|---|
| Caixa de entrada de pré-compras do fornecedor | Backend aplicado; frontend integrado em `main` | Falta confirmar deployment e teste ponta a ponta na aplicação publicada |
| Gestão operacional de entregas no Admin | Integrada em `main` | Executar validação funcional com perfis e permissões reais |
| Compromisso do motorista e manutenção do veículo | Integrado em `main` | Validar cenários de aceitação, compromissos simultâneos e validade da manutenção |
| Validação de distância/rota rural | Correcções integradas em `main` | Repetir testes com coordenadas rurais reais e casos-limite |
| Tracking GPS do motorista para comprador e Admin | Em desenvolvimento numa branch própria | Requisitos offline detalhados; falta revisão técnica e validação E2E em Android |
| Deployment de produção da versão mais recente | Pendente de confirmação | A equipa proprietária da Vercel precisa executar/autorizar a publicação |

## Tarefas prioritárias — executar por ordem

### P0 — Publicação e validação da caixa de entrada de pré-compras

- [x] Criar política RLS para o fornecedor consultar pré-compras dos seus próprios produtos.
- [x] Criar notificação `pre_order_received` quando uma nova pré-compra é registada.
- [x] Criar backfill de notificações para pré-compras pendentes existentes sem notificação correspondente.
- [x] Adicionar `pre_orders` à publicação Supabase Realtime, quando necessário.
- [x] Integrar listeners Realtime na página de pedidos do fornecedor e no perfil.
- [x] Integrar a alteração do frontend na branch `main` através do PR #79.
- [x] Aplicar a migration correspondente no projecto Supabase de produção.
- [ ] **Vercel:** publicar a versão mais recente da branch `main` no ambiente Production. O deployment tem de usar o commit actual de `main`, não um Preview antigo nem uma branch de feature.
- [ ] **Comprador → fornecedor:** criar uma pré-compra real de teste e confirmar que o registo é criado com o produto e fornecedor correctos.
- [ ] **Notificação:** confirmar que o fornecedor recebe exactamente uma notificação e que o link abre a área de pedidos recebidos.
- [ ] **Visibilidade:** confirmar que o pedido aparece no perfil e na página de pedidos do fornecedor, incluindo após actualizar a página.
- [ ] **Resposta:** aceitar e rejeitar pedidos de teste, confirmando estado persistido e notificação ao comprador.
- [ ] **Segurança:** confirmar que um fornecedor não consegue consultar pré-compras de produtos pertencentes a outro fornecedor.
- [ ] **Regressão:** confirmar que o comprador continua a consultar o histórico e o estado das suas próprias pré-compras.

**Referências:** PR [#79](https://github.com/TheRuralTeam/agrilinks/pull/79) · commit de integração [680934a](https://github.com/TheRuralTeam/agrilinks/commit/680934a2df90a2bbb7b5a6faf98f0014f298098f).

**Nota de produção:** foi registada a aplicação da migration no Supabase de produção. O backfill foi reportado como tendo criado notificações para 7 pré-compras pendentes existentes. Recontar os registos antes de qualquer operação manual; não reenviar nem duplicar notificações sem verificar a tabela.

### P0 — Deployment de produção da aplicação

Responsável: pessoa/equipa que administra o projecto Vercel `agrilink` na equipa `agrilink-s-projects`.

- [ ] Confirmar que o projecto Vercel está ligado ao repositório `TheRuralTeam/agrilinks`.
- [ ] Confirmar que a Production Branch está definida como `main`.
- [ ] Rever a configuração **Ignored Build Step**. Um deployment anterior foi marcado como `Ignored`; determinar se a regra está a impedir a publicação do commit pretendido.
- [ ] Abrir o deployment Production com estado `Error` e corrigir a causa a partir dos **Build Logs**. Não assumir que o erro é causado pelo código das pré-compras sem ler os logs.
- [ ] Iniciar um novo deployment Production a partir do HEAD actual de `main`.
- [ ] Confirmar estado final `Ready`, commit SHA, URL de produção e aliases/domínio de produção.
- [ ] Abrir a aplicação pelo domínio de produção e validar autenticação, páginas principais e fluxos alterados.
- [ ] Registar neste README a data, commit SHA, URL e resultado da publicação.

**Atenção:** um Preview com estado `Ready` não actualiza automaticamente o domínio de produção. O Preview anteriormente partilhado para tracking pertence à branch `feat/buyer-live-tracking-supplier-handover-receipt` e não substitui o deployment da `main`.

### P1 — Tracking GPS durante a entrega (prioridade da sessão de 27-11-2026)

**Objectivo:** depois de o motorista confirmar que recebeu/recolheu a carga, o comprador deve acompanhar no mapa a localização do motorista associado àquela entrega. O Admin deve conseguir acompanhar a operação dentro das suas permissões. O comportamento tem de ser explícito mesmo quando o motorista fica sem cobertura ou o GPS deixa de fornecer posições.

Branch de trabalho identificada: `feat/buyer-live-tracking-supplier-handover-receipt`. O Preview anteriormente partilhado foi reportado como `Ready`; não é prova de merge, publicação em Production ou validação funcional.

**Regras funcionais obrigatórias**
- [ ] A aceitação da carga não inicia a partilha de localização com o comprador.
- [ ] A confirmação autorizada de recolha activa o tracking da entrega no backend, com timestamp e associação inequívoca à carga.
- [ ] Se ainda não houver coordenadas, o mapa apresenta “A aguardar primeira localização”.
- [ ] Durante o transporte, o comprador acompanha apenas a entrega a que está associado; o Admin acompanha as entregas autorizadas.
- [ ] O mapa apresenta a última posição recebida e a hora da actualização. Nunca apresenta uma posição antiga como se fosse actual.
- [ ] Ao concluir/cancelar a entrega, o tracking termina e novas posições deixam de ser aceites para essa entrega.

**Sem cobertura, sincronização e recuperação**
- [ ] O dispositivo do motorista guarda temporariamente posições numa fila local limitada e protegida quando não há rede.
- [ ] Cada ponto preserva identificador idempotente, entrega, timestamp de captura, coordenadas e precisão quando disponível; o servidor regista também a hora de recepção.
- [ ] Quando a rede regressa, os pontos são sincronizados sem duplicação e ordenados pelos timestamps originais.
- [ ] O mapa mostra “Sem actualização” e a hora da última posição recebida enquanto não chegam novos pontos.
- [ ] Uma posição antiga sincronizada não faz o marcador actual retroceder nem é apresentada como localização em tempo real.
- [ ] Encerramento/reinício da aplicação recupera a fila segura e reconcilia o estado da entrega.
- [ ] GPS desligado, permissão revogada, segundo plano e bateria reduzida produzem estados claros; nunca são inventadas coordenadas.

**Segurança e testes de aceitação**
- [ ] Aplicar autorização no backend/RLS/RPC: comprador só consulta as suas entregas; motorista só as atribuídas; Admin só com permissão operacional.
- [ ] Validar duplicados, pontos fora de ordem, baixa precisão, saltos geográficos e timestamps inválidos.
- [ ] Testar em Android real: recolha, ecrã bloqueado/segundo plano, perda de rede, modo avião, recuperação de rede, GPS desligado, permissões revogadas e reinício.
- [ ] Testar ponta a ponta desde a confirmação de recolha até à conclusão, incluindo comprador, motorista e Admin.
- [ ] Rever consumo de bateria/dados, limites da fila local, retenção de coordenadas e logs.
- [ ] Rever o diff e migrations da branch antes de abrir PR para `main`; integrar e publicar só depois de QA.
- [ ] Registar PR, commit SHA, migrations aplicadas, evidência Android e deployment Production.

**Limite operacional:** um dispositivo sem cobertura não consegue transmitir localização em tempo real. O requisito offline é guardar os pontos localmente com segurança e sincronizá-los quando a ligação regressar; durante a interrupção, comprador e Admin têm de ver a última posição recebida identificada como desactualizada.

**Critério de conclusão:** tracking só passa a concluído depois de a recolha activar o tracking no servidor, as permissões por entrega estarem verificadas, o fluxo offline sincronizar correctamente, os testes Android/E2E passarem e a publicação no ambiente pretendido estar confirmada.

### P1 — Entregas, motoristas e manutenção do veículo

- [x] Remover o limite artificial de uma carga aceite por motorista por dia.
- [x] Permitir que o motorista aceite entregas de acordo com a sua capacidade e preferências.
- [x] Exigir compromisso explícito de cumprimento das entregas activas antes de aceitar novas cargas.
- [x] Exigir dados de manutenção/validade do veículo e bloquear aceitação quando os requisitos aplicáveis não forem cumpridos.
- [x] Disponibilizar controlo operacional de entregas no Admin.
- [ ] Testar motorista com várias entregas simultâneas, sobreposição de horários e capacidade insuficiente.
- [ ] Testar manutenção expirada, dados em falta, actualização de veículo e tentativa de contornar validações pelo cliente.
- [ ] Confirmar que as validações críticas são aplicadas no servidor/RPC e não apenas na interface.
- [ ] Confirmar que o Admin consegue localizar, filtrar e acompanhar entregas sem expor dados a utilizadores não autorizados.

### P1 — Cotações e cálculo de rotas

- [x] Corrigir validação da distância rodoviária com pontos ajustados à estrada (snapped points).
- [x] Guardar e submeter os pontos ajustados usados no cálculo da rota.
- [ ] Testar rotas em zonas rurais, estradas secundárias, coordenadas afastadas da via e falhas do serviço de routing.
- [ ] Confirmar que distância em linha recta, distância rodoviária e distância ajustada não são confundidas na interface nem nas regras de preço.
- [ ] Confirmar mensagens de erro accionáveis para coordenadas inválidas ou sem rota disponível.

### P2 — Verificação de qualidade e segurança

- [ ] Executar build de produção e testes automatizados disponíveis sobre o commit que será publicado.
- [ ] Rever migrations pendentes e confirmar que foram aplicadas no projecto Supabase correcto.
- [ ] Rever RLS das tabelas de pedidos, entregas, GPS, notificações e comprovativos.
- [ ] Testar separação de permissões entre comprador, fornecedor, motorista e administrador.
- [ ] Confirmar que operações financeiras e mudanças de estado sensíveis são idempotentes e auditáveis.
- [ ] Rever logs de erros após o deployment e corrigir regressões antes de declarar a release concluída.

## Regras de release

1. Não fazer commits directamente em `main` para funcionalidades grandes sem revisão.
2. Não marcar uma tarefa como concluída apenas porque o código foi escrito ou o PR foi integrado.
3. Distinguir sempre **Integrado**, **Migration aplicada**, **Preview Ready**, **Production Ready** e **Validado E2E**.
4. Não afirmar que uma funcionalidade funciona offline sem testes de desconexão e sincronização.
5. Não expor coordenadas GPS ou dados de pedidos a utilizadores sem autorização.
6. Não duplicar migrations, notificações, pagamentos ou operações de entrega ao repetir testes.
7. Toda a publicação deve registar commit SHA, ambiente, resultado do build e testes efectuados.

## Critério para declarar uma tarefa concluída

Uma tarefa só passa a **Concluída** quando:
- o código está integrado na branch correcta;
- migrations e configurações necessárias estão aplicadas no ambiente correcto;
- o deployment do ambiente pretendido está em estado `Ready`;
- o fluxo foi testado com os perfis relevantes;
- os casos de erro e permissões foram verificados;
- não existem regressões conhecidas por resolver.

## Repositório

- GitHub: [TheRuralTeam/agrilinks](https://github.com/TheRuralTeam/agrilinks)
- Branch principal: `main`
- Pull Request da caixa de entrada de pré-compras: [#79](https://github.com/TheRuralTeam/agrilinks/pull/79)

## Documentação técnica e operacional completa

O README mantém o painel de prioridades. Os procedimentos detalhados, requisitos, matrizes de teste, segurança e publicação estão organizados em `docs/`.

- [Índice geral da documentação](docs/README.md)
- [Estado operacional e plano de release](docs/operations/PROJECT_STATUS_AND_RELEASE.md)
- [Runbook de publicação Vercel](docs/operations/VERCEL_PRODUCTION_RUNBOOK.md)
- [Runbook de pré-compras do fornecedor](docs/operations/SUPPLIER_PREORDERS_RUNBOOK.md)
- [Runbook de entregas e tracking GPS](docs/operations/FREIGHT_TRACKING_RUNBOOK.md)
- [Segurança e tratamento de dados](docs/operations/SECURITY_AND_DATA_HANDLING.md)
- [Checklist QA e release](docs/qa/RELEASE_QA_CHECKLIST.md)

**Regra:** actualizar o painel deste README e o documento especializado correspondente sempre que houver alteração de implementação, migration, configuração, teste, deployment ou decisão operacional. Estados sem evidência devem permanecer como pendentes.


## Auditoria técnica do tracking GPS — 27-11-2026

A revisão estática da branch `feat/buyer-live-tracking-supplier-handover-receipt` identificou pontos positivos e bloqueios que impedem a integração directa:

- HEAD auditado: `278724cc3f1dd228597f216dba13d57a70463bc6`.
- Comparação com `main`: branch divergente, 113 commits à frente e 12 atrás; merge-base `9f7e5baab42e5eec9420278cc87ca37cb36902e2`.
- O diff contém alterações de tracking, comprovativos, checkout e liquidação financeira; não integrar o conjunto sem separação e revisão.
- Android Driver CI e CI geral reportaram sucesso para o HEAD auditado (runs 45982697956 e 45982697663). Isto não comprova testes num dispositivo físico nem publicação.
- A configuração Android declara `useSQLCipher: true`; confirmar o APK/AAB nativo efectivamente gerado antes de considerar a fila cifrada validada em dispositivo.
- A activação inicial do tracking ainda depende do botão manual do motorista após a carga estar em trânsito. Preparar permissões/consentimento antes da recolha e iniciar automaticamente após confirmação autorizada de recolha.
- A fila local Android ainda precisa de limite de capacidade, política de retenção/expiração e comportamento explícito quando o limite é atingido.
- O componente do comprador ainda consulta e pode renderizar a última posição depois de a entrega sair do estado `in_transit`. Encerrar a consulta e ocultar a localização de tracking activo após conclusão/cancelamento, mantendo eventual histórico apenas segundo política autorizada.
- A sincronização offline, a autorização por perfil e o ciclo de vida Android continuam pendentes de testes E2E e dispositivo real.

**Estado após auditoria:** Em desenvolvimento — não integrar nem publicar até corrigir os bloqueios acima, reconciliar a divergência com `main`, rever migrations/RLS e concluir QA.

**Evidência da revisão:** [HEAD da branch](https://github.com/TheRuralTeam/agrilinks/commit/278724cc3f1dd228597f216dba13d57a70463bc6) · [Comparação com main](https://github.com/TheRuralTeam/agrilinks/compare/main...feat/buyer-live-tracking-supplier-handover-receipt) · [Run Android CI](https://github.com/TheRuralTeam/agrilinks/actions/runs/45982697956) · [Run CI](https://github.com/TheRuralTeam/agrilinks/actions/runs/45982697663).
