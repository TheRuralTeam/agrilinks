# Runbook — tracking GPS, entregas e operação do motorista

> **Prioridade actual (27-11-2026):** especificar e validar o acompanhamento da localização exacta do motorista pelo comprador durante o transporte, incluindo perda de cobertura, recolha da carga, sincronização posterior e supervisão pelo Admin. Este documento descreve requisitos e critérios de aceitação; não declara funcionalidades como concluídas sem evidência de implementação e testes.

## 1. Objectivo e âmbito

O comprador deve conseguir acompanhar no mapa a localização do motorista responsável pela sua entrega enquanto a carga estiver em transporte. O Admin deve dispor de acompanhamento operacional das entregas, respeitando as permissões administrativas. O sistema deve continuar coerente quando o telemóvel fica sem cobertura, perde GPS, encerra a aplicação ou recupera a ligação.

O tracking é associado a uma **entrega/carga concreta**, não apenas ao perfil do motorista. Um motorista pode ter mais do que uma entrega activa, desde que cumpra as regras de capacidade, compromisso e manutenção já definidas para a operação.

Branch de trabalho identificada no histórico: `feat/buyer-live-tracking-supplier-handover-receipt`. Um Preview anteriormente partilhado foi reportado como Ready; isso não prova merge em `main`, publicação em Production ou funcionamento E2E.

## 2. Regra de início e fim do tracking

### Início

1. O motorista aceita a entrega segundo as regras de elegibilidade e capacidade.
2. A aceitação, por si só, **não inicia a localização visível ao comprador**.
3. O motorista confirma que recebeu/recolheu a carga, através do evento operacional autorizado.
4. O backend valida a transição e grava o evento com timestamp, utilizador e entrega.
5. Só depois dessa confirmação o tracking dessa entrega passa a activo e as posições podem ser recolhidas/partilhadas para esse fim.

O primeiro ponto GPS pode chegar alguns instantes depois da confirmação. Nesse intervalo, a interface deve indicar “A aguardar primeira localização”, nunca inventar ou reutilizar uma coordenada como se fosse actual.

### Fim

O tracking visível ao comprador termina quando a entrega é concluída ou cancelada por uma transição autorizada. A aplicação deve deixar de transmitir posições para essa entrega. A política de retenção, acesso histórico e eliminação de coordenadas deve ser definida e aplicada no backend; não presumir retenção ilimitada.

Eventos de recolha, saída, chegada, tentativa de entrega, conclusão e cancelamento devem ser temporalmente auditáveis quando fizerem parte do fluxo implementado.

## 3. Requisitos do mapa do comprador

- Mostrar a posição mais recente recebida para o motorista/entrega autorizados.
- Actualizar a posição enquanto o transporte estiver activo e houver dados novos.
- Mostrar a hora da última actualização e, quando disponível, precisão GPS e estado de conectividade.
- Distinguir visualmente **actualização em tempo real**, **última posição conhecida**, **sem sinal/sem actualização** e **localização indisponível**.
- Nunca apresentar uma posição antiga como localização actual ou mover o marcador com coordenadas estimadas/inventadas.
- Não revelar a localização do motorista antes da recolha, depois do fim da entrega ou a compradores sem relação com a entrega.
- Se ainda não existir ponto GPS, explicar que o tracking foi iniciado mas aguarda a primeira posição.

O painel do Admin deve permitir acompanhar entregas e estados operacionais autorizados, identificar a última actualização e distinguir ausência de sinal de entrega concluída. O acesso administrativo também deve ser validado no servidor, não apenas escondido na interface.

## 4. Funcionamento sem cobertura e recuperação

A ausência de rede não pode fazer o sistema perder silenciosamente todo o percurso nem criar a falsa impressão de que o mapa está actualizado.

### No dispositivo do motorista

- Recolher posições apenas durante uma entrega com tracking activo e permissões válidas.
- Quando não houver rede, guardar temporariamente os pontos numa fila local limitada, protegida e com política de expiração.
- Cada ponto deve incluir identificador idempotente, identificador da entrega, timestamp da captura, latitude/longitude e precisão quando disponível.
- Guardar a hora de captura separada da hora em que o servidor recebeu o ponto.
- Ao recuperar a ligação, sincronizar a fila de forma segura, idempotente e ordenada; confirmar a recepção antes de remover os pontos locais.
- Evitar crescimento ilimitado da fila, duplicação de pontos e consumo excessivo de bateria/dados.
- Se a aplicação for encerrada ou o dispositivo reiniciar, recuperar a fila de forma segura e reconciliar o estado actual da entrega antes de retomar.
- Não transmitir retroactivamente posições de uma entrega já concluída/cancelada como se fossem posições actuais.

### No mapa do comprador e no Admin

- Enquanto não chegam novos pontos, manter a última posição conhecida identificada como tal e apresentar o timestamp.
- Exibir um estado claro como “Sem actualização — última posição recebida às …”.
- Quando os pontos offline forem sincronizados, actualizar o histórico/trajecto respeitando os timestamps originais; não animar o marcador como se o motorista estivesse naquele local naquele momento.
- Se a rede do comprador estiver indisponível, informar que o mapa não consegue actualizar. A última posição em cache deve continuar identificada como desactualizada.

### Limite importante

“Funciona offline” não significa que o comprador consiga ver em tempo real um dispositivo sem cobertura. Significa que o dispositivo do motorista consegue guardar pontos localmente com segurança e enviá-los quando a ligação regressar, enquanto os restantes utilizadores vêem claramente a idade da última posição recebida.

## 5. GPS, permissões e ciclo de vida Android

Testar explicitamente:
- GPS desligado ou indisponível;
- permissão de localização negada, limitada ou revogada durante a viagem;
- localização aproximada em vez de precisa;
- aplicação em segundo plano, ecrã bloqueado e optimização de bateria;
- aplicação terminada pelo sistema, encerrada pelo utilizador ou reinício do dispositivo;
- bateria fraca e longos períodos de transporte;
- rede móvel intermitente, Wi-Fi sem Internet e modo avião.

A interface deve explicar o problema e orientar o motorista a corrigir permissões quando possível. O backend deve distinguir “sem ponto novo”, “GPS indisponível”, “sem rede” e “tracking terminado”. Não prometer recolha contínua em segundo plano sem validar as limitações e permissões da versão Android efectivamente suportada.

## 6. Integridade e qualidade dos pontos GPS

Cada ponto deve ser validado no servidor. Considerar:
- coordenadas dentro dos limites geográficos válidos;
- timestamp plausível e tolerância a relógio do dispositivo incorrecto;
- precisão reportada pelo sensor;
- pontos duplicados (idempotência);
- pontos fora de ordem;
- saltos geográficos/velocidades fisicamente implausíveis;
- pontos muito antigos recebidos após reconexão.

Pontos suspeitos devem ser assinalados ou rejeitados segundo regras explícitas; não substituir silenciosamente uma posição recente e válida por uma posição antiga ou de baixa qualidade. O histórico deve preservar a distinção entre hora de captura e hora de recepção.

## 7. Segurança e privacidade

- Autorizar leitura de pontos por entrega: comprador apenas para a sua compra/entrega; motorista apenas para as entregas que lhe estão atribuídas; Admin apenas com permissão operacional.
- Aplicar autorização em RLS/RPC/backend. A filtragem no frontend não é controlo de acesso.
- Não aceitar do cliente uma alteração arbitrária de `driver_id`, `delivery_id` ou estado de tracking sem validar a relação e a transição no servidor.
- Proteger a fila local e o transporte dos dados; não guardar tokens ou coordenadas em logs de diagnóstico desnecessários.
- Limitar frequência e volume de pontos; aplicar rate limiting/limites de payload adequados.
- Definir retenção, acesso ao histórico e eliminação de dados de localização.
- Auditar início, fim, consulta administrativa e eventos relevantes sem expor coordenadas a perfis não autorizados.

## 8. Aceitação de cargas e manutenção do veículo

As alterações descritas no histórico do projecto indicam:
- remoção do limite artificial de uma carga por motorista por dia;
- aceitação conforme preferências e capacidade real do motorista;
- compromisso de cumprir todas as entregas activas aceites;
- verificação da manutenção/validade do veículo;
- controlo operacional das entregas no Admin.

A validação deve existir no backend/RPC, além da interface. Confirmar que não é possível contornar capacidade, compromisso, manutenção, atribuição ou autorização por chamadas directas.

## 9. Matriz de testes obrigatória

| Cenário | Resultado esperado |
|---|---|
| Motorista aceita uma carga, ainda sem recolha | Comprador não vê localização; tracking não está activo |
| Motorista confirma recolha | Backend regista evento; tracking da entrega é activado |
| Ainda não chegou ponto GPS | Mapa mostra “A aguardar primeira localização” |
| Chega ponto GPS válido | Comprador autorizado vê posição e timestamp |
| Comprador de outra entrega tenta consultar | Acesso negado no servidor |
| Admin autorizado consulta | Vê estado, última posição e timestamp |
| Admin sem permissão consulta | Acesso negado |
| Motorista perde cobertura | Pontos ficam em fila local limitada; mapa assinala última actualização |
| Cobertura regressa | Pontos sincronizam sem duplicados e com timestamps originais |
| App é encerrada/reiniciada | Estado é reconciliado e fila segura é recuperada |
| GPS desligado/permissão revogada | Estado indisponível explicado; nenhuma coordenada inventada |
| Ponto duplicado/fora de ordem | Idempotência/ordenação preservadas |
| Ponto antigo chega após reconexão | Histórico recebe ponto com hora original; marcador actual não retrocede |
| Entrega concluída/cancelada | Tracking termina e novas posições são recusadas para essa entrega |
| Motorista aceita entregas compatíveis | Aceitação permitida com compromisso válido |
| Capacidade insuficiente/manutenção inválida | Nova aceitação bloqueada no servidor |

## 10. Evidências exigidas antes de declarar concluído

- Diff revisto da branch face à `main`, com lista de ficheiros e dependências.
- Migrations e políticas RLS/RPC identificadas e aplicadas no ambiente correcto.
- Testes de autorização comprador/motorista/Admin, incluindo tentativa de acesso cruzado.
- Testes em Android real: recolha, segundo plano, ecrã bloqueado, modo avião, perda/recuperação de rede, GPS desligado e reinício.
- Evidência de sincronização offline sem duplicação e sem regressão temporal.
- Verificação de consumo de bateria, dados e crescimento da fila local.
- Teste E2E desde a confirmação de recolha até à conclusão da entrega.
- Commit/PR, SHA, URL e estado do deployment Production, caso publicado.

## 11. Critério de conclusão

O tracking só pode ser marcado como **Concluído e validado** quando:
1. a recolha activa o tracking no servidor;
2. comprador e Admin vêem apenas entregas autorizadas;
3. o mapa distingue posição actual de última posição conhecida;
4. a fila offline sincroniza de forma segura, ordenada e idempotente;
5. os estados de GPS, permissões, segundo plano e falhas são claros;
6. o tracking termina com a entrega e não continua a recolher/partilhar indevidamente;
7. os testes Android e E2E passam;
8. a versão está publicada no ambiente pretendido e o deployment foi confirmado.

Até lá, manter o estado como **Em desenvolvimento / validação pendente**. Um Preview Ready, código existente ou migration versionada não constitui prova de conclusão.
