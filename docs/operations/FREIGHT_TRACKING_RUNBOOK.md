# Runbook — entregas, motoristas e tracking GPS

## Escopo funcional

O fluxo de transporte deve permitir ao comprador acompanhar a entrega atribuída ao motorista e ao Admin acompanhar a operação, respeitando a autorização por entrega. O tracking começa no evento operacional confirmado de recolha da carga, não apenas quando o motorista abre a aplicação ou aceita uma proposta.

Branch de trabalho identificada no histórico: `feat/buyer-live-tracking-supplier-handover-receipt`. O Preview anteriormente partilhado foi reportado como Ready; a integração e publicação em Production não estão comprovadas por esse facto.

## Requisitos funcionais de tracking

- Associar cada posição GPS a motorista, entrega/carga e timestamp.
- Só iniciar partilha operacional depois da confirmação de recolha da carga.
- Comprador só consulta a localização da entrega a que tem direito.
- Admin autorizado pode acompanhar a operação no painel administrativo.
- Mostrar última posição conhecida, timestamp, precisão/qualidade quando disponível e estado de conectividade.
- Não apresentar uma posição antiga como se fosse posição actual.
- Parar a partilha quando a entrega termina ou é cancelada, conforme política de retenção.
- Registar eventos operacionais importantes para auditoria.

## Cenários offline e falhas

A implementação deve especificar e testar:
- Sem cobertura de rede: guardar posições localmente de forma limitada e segura; sincronizar quando a rede regressar.
- Sem GPS/permissão: informar que a localização não está disponível; não inventar coordenadas.
- Aplicação em segundo plano: validar permissões e limitações Android; comunicar pausas de recolha.
- Processo encerrado/reiniciado: recuperar apenas a fila local segura e retomar conforme estado da entrega.
- Posições fora de ordem: ordenar por timestamp do dispositivo e hora de recepção do servidor; rejeitar/assinalar anomalias.
- Duplicados: usar chave idempotente/evento para não duplicar pontos.
- Baixa precisão ou salto geográfico impossível: marcar como suspeito e não substituir silenciosamente uma posição melhor.
- Bateria baixa: reduzir frequência de recolha de forma explícita, sem prometer precisão constante.
- Sem rede prolongadamente: expor timestamp da última posição e estado “sem actualização”.

Não afirmar suporte offline até haver testes em dispositivo Android real, incluindo modo avião e sincronização posterior.

## Aceitação de cargas e manutenção

As alterações integradas no histórico indicam:
- Remoção do limite artificial de uma carga por motorista por dia.
- Aceitação baseada na capacidade e compromisso do motorista de cumprir as entregas activas.
- Requisitos de manutenção/validade do veículo antes de aceitar cargas.
- Controlos operacionais de entregas no Admin.

A validação deve ocorrer no backend/RPC, além da interface. Confirmar que um motorista não consegue contornar limites de capacidade, compromisso, validade ou autorização através de chamadas directas.

## Matriz de testes

| Cenário | Resultado esperado |
|---|---|
| Motorista confirma recolha | Tracking da entrega inicia e fica associado à carga correcta |
| Comprador abre mapa | Só vê a entrega da sua compra |
| Admin autorizado abre painel | Vê entregas e localização dentro das permissões |
| Utilizador não relacionado tenta consultar GPS | Acesso negado |
| Rede cai durante transporte | Posições são guardadas/estado offline exposto |
| Rede regressa | Sincronização idempotente e ordenada |
| GPS desligado | Estado indisponível, sem coordenada inventada |
| Permissão revogada | Interface informa a limitação |
| App reinicia | Estado da entrega e fila segura são reconciliados |
| Entrega concluída | Tracking termina conforme regra definida |
| Motorista aceita várias cargas compatíveis | Aceitação permitida com compromisso válido |
| Motorista excede capacidade | Operação bloqueada no servidor |
| Manutenção expirada/inválida | Nova aceitação bloqueada |
| Admin sem permissão operacional | Acesso negado |

## Evidência a guardar

- Commit/PR e migrations relacionadas.
- Matriz de permissões RLS/RPC.
- Capturas de estados online/offline e timestamps.
- Logs de sincronização sem dados pessoais desnecessários.
- Resultado dos testes Android reais.
- URL e SHA do deployment Production.

## Critério de conclusão

Não marcar tracking como concluído enquanto não houver revisão do diff, migrations aplicadas, isolamento de dados confirmado, testes offline/online em dispositivos reais, validação do Admin e teste E2E da recolha até à entrega.
