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
| Tracking GPS do motorista para comprador e Admin | Em desenvolvimento numa branch própria | Não considerar concluído nem publicado em produção até merge, deployment e testes |
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

### P1 — Tracking GPS e comprovativo de entrega

Branch de trabalho identificada: `feat/buyer-live-tracking-supplier-handover-receipt`.

- [ ] Rever o diff completo da branch face à `main`; identificar dependências, migrations, variáveis de ambiente e alterações de permissões.
- [ ] Garantir que o comprador só acompanha o motorista associado à sua entrega e apenas no período autorizado do transporte.
- [ ] Iniciar/activar o tracking no evento correcto de recolha/entrega da carga, com registo temporal e associação inequívoca à entrega.
- [ ] Confirmar que o Admin tem acesso ao painel operacional e às localizações autorizadas.
- [ ] Implementar e validar persistência local/armazenamento temporário de posições quando o dispositivo fica sem rede, com sincronização posterior e ordenação por timestamp.
- [ ] Definir claramente o comportamento quando o GPS está desligado, a aplicação está em segundo plano, o dispositivo fica offline ou não tem permissões de localização.
- [ ] Exibir no mapa a última posição conhecida e a hora da última actualização; nunca apresentar uma posição antiga como localização em tempo real.
- [ ] Tratar perda de sinal, posições duplicadas, posições fora de ordem, baixa precisão, bateria reduzida e encerramento/reabertura da aplicação.
- [ ] Validar autenticação, autorização por entrega, retenção de dados e protecção das coordenadas.
- [ ] Validar o comprovativo de entrega e a transição de estado apenas após confirmação autorizada.
- [ ] Executar testes em dispositivos Android reais, com rede estável, rede intermitente, modo avião e GPS desligado.
- [ ] Só depois de revisão, testes e migrations validadas, abrir PR para `main`, integrar e publicar em Production.

**Referência de Preview conhecida:** [Preview do tracking](https://agrilink-76dhddwya-agrilink-s-projects.vercel.app/). O Preview foi reportado como `Ready`; isso não comprova que a branch esteja integrada na `main` ou publicada em produção.

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
