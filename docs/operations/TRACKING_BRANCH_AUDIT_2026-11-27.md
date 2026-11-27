# Auditoria técnica — branch de tracking GPS (27-11-2026)

## Âmbito e método

Revisão estática do código disponível na branch `feat/buyer-live-tracking-supplier-handover-receipt`, comparada com `main` no repositório `TheRuralTeam/agrilinks`. Foram inspeccionados os fluxos do cliente Android, fila offline, serviço de localização, mapa do comprador e migration de handover/localização.

Esta auditoria **não** executou a aplicação, testes SQL, APK/AAB, testes físicos, nem verificou a aplicação da migration em Supabase remoto. Não é uma aprovação para merge ou publicação.

## Estado da comparação

- Branch: `feat/buyer-live-tracking-supplier-handover-receipt`
- Base comparada: `main`
- Divergência devolvida pelo GitHub: **113 commits à frente e 19 atrás**.
- A branch contém alterações fora do âmbito de tracking, incluindo checkout, pagamentos e alocação/libertação de pagamentos do marketplace.
- Conclusão: **não fazer merge integral desta branch para main**. Isolar o escopo de tracking e reconciliar primeiro os commits posteriores de main.

## Componentes encontrados

- `apps/driver-android/App.tsx`: aplicação Android do motorista; carrega apenas cargas em estado `in_transit`; permite iniciar tracking através de acção manual.
- `apps/driver-android/src/tracking/trackingService.ts`: solicita permissões foreground/background e notificações, pede consentimento e inicia serviço de localização.
- `apps/driver-android/src/tracking/outbox.ts`: persiste amostras e envia lotes de até 100 via RPC `record_freight_load_location_batch`; remove da fila após resposta sem erro.
- `apps/driver-android/src/storage/trackingDatabase.ts`: SQLite com verificação de SQLCipher e chave em SecureStore; cria tabela local `gps_outbox`.
- `src/components/BuyerFreightTracking.tsx`: consulta localização, subscreve Realtime e faz polling de 30 segundos.
- `supabase/migrations/20261127100000_freight_handover_and_offline_location_samples.sql`: handover do fornecedor, confirmação do motorista, histórico GPS e RPC de sincronização em lote.

## Pontos implementados na branch (observação estática)

1. Existe uma aplicação Android separada para o motorista.
2. O serviço de localização usa Expo Location e uma notificação de foreground service.
3. O fluxo pede permissões de localização em primeiro e segundo plano e consentimento explícito.
4. A fila local usa SQLite, SecureStore e uma verificação de disponibilidade SQLCipher antes de abrir a base de dados.
5. A sincronização envia lotes limitados a 100 amostras e usa IDs de evento/sequência para permitir deduplicação no servidor.
6. A migration introduz comprovativo de entrega do fornecedor e RPC de confirmação do motorista; a transição para `in_transit` é protegida por trigger que exige comprovativo reconhecido.
7. O mapa do comprador distingue timestamp de captura/recepção e marca a posição como desactualizada após dois minutos.

## Bloqueios e riscos identificados

### P0 — início do tracking não está automatizado no evento de recolha

O cliente Android apresenta cargas já em `in_transit` e mostra o botão **Activar rastreamento GPS** quando o serviço não está activo. O serviço só pede permissões/consentimento e inicia quando essa acção manual é executada. A reconciliação automática apenas reinicia o serviço se já existir consentimento local.

Isto deixa uma janela operacional em que a carga já está em trânsito mas o tracking pode não ter começado. O fluxo desejado é preparar permissões e consentimento antes da recolha e iniciar/reconciliar automaticamente após a confirmação de handover/departura validada pelo backend. Nunca recolher nem partilhar antes desse evento.

### P0 — mapa do comprador não termina explicitamente a subscrição no estado final

O componente `BuyerFreightTracking` inicia consulta, Realtime e polling com base no ID da carga; o efeito não condiciona o ciclo de vida ao estado `in_transit`. O marcador pode continuar a ser apresentado quando a carga muda para `delivered` ou `cancelled`.

Corrigir o ciclo de vida: só manter tracking activo durante `in_transit`; ao terminar/cancelar, parar polling e Realtime e mostrar estado final. Se existir histórico pós-entrega, apresentá-lo separadamente como histórico, nunca como localização ao vivo.

### P1 — fila offline sem limite/expiração/backpressure visíveis

A tabela `gps_outbox` não declara limite de quantidade, bytes ou idade. A rotina de sincronização percorre os registos pendentes em lotes, mas não há política explícita para crescimento ilimitado, armazenamento esgotado ou retenção. Definir limites, métricas, alerta e backpressure. Não eliminar amostras não confirmadas pelo servidor silenciosamente.

### P1 — permissões e recuperação de sessão

O fluxo exige permissão de segundo plano e notificações. É necessário testar a experiência real em cada versão Android suportada, incluindo negação/revogação, restrições de bateria, force-stop, reboot e comportamento do serviço após o processo ser terminado. O código estático não prova que o SO permita execução contínua em todos estes cenários.

### P1 — validação do binário nativo

A aplicação verifica `PRAGMA cipher_version` e falha se SQLCipher não estiver disponível, o que é uma salvaguarda útil. Ainda assim, é obrigatório confirmar a biblioteca e a cifragem num APK/AAB gerado e instalado; configuração Expo ou CI verde não é prova suficiente.

### P1 — sincronização após conclusão

A RPC de lote aceita cargas `in_transit` e `delivered`, validando a janela temporal da amostra contra `delivered_at`. Isto pode ser necessário para descarregar amostras capturadas antes da conclusão, mas precisa de teste para garantir que nenhuma posição capturada depois da conclusão é aceite e que o marcador ao vivo não regride.

### P0 — autorização de leitura e publicação

A migration e as políticas de leitura de cargas/localizações devem ser revistas em conjunto com todas as queries da aplicação. Testar comprador da entrega, comprador alheio, motorista atribuído, motorista não atribuído e Admin com/sem permissão. Não activar Realtime nem alargar SELECT sem confirmar que campos sensíveis, como tokens de QR, não ficam expostos.

### P0 — escopo da branch

A divergência e as alterações financeiras/checkout tornam o merge integral inseguro. Criar uma branch de integração limpa a partir do HEAD actual de `main` e portar apenas commits/ficheiros necessários ao tracking, depois de verificar dependências e conflitos. Não cherry-pickar commits sem inspeccionar se contêm alterações de outros domínios.

## Plano de trabalho priorizado

1. [ ] Congelar o merge integral da branch actual.
2. [ ] Mapear dependências do fluxo: estados de carga, handover, RPCs, tabelas, RLS, Storage, Realtime, Android e mapa comprador/Admin.
3. [ ] Criar branch limpa a partir do `main` actual e portar apenas o escopo de tracking.
4. [ ] Ligar o início/reconciliação do serviço ao evento de recolha confirmado no backend, com permissões e consentimento preparados antecipadamente.
5. [ ] Implementar limite, retenção, backpressure e recuperação segura da fila offline.
6. [ ] Encerrar tracking ao concluir/cancelar e separar histórico de localização ao vivo.
7. [ ] Auditar RLS, RPC, Storage e Realtime com testes negativos entre perfis.
8. [ ] Executar testes unitários/SQL/E2E e produzir APK/AAB de validação.
9. [ ] Testar em Android físico: ecrã bloqueado, segundo plano, force-stop, reboot, modo avião, perda/recuperação de rede, GPS desligado, permissões revogadas e bateria optimizada.
10. [ ] Abrir PR isolado, rever diff, aguardar CI e aprovação.
11. [ ] Só depois solicitar aplicação de migrations e publicação no ambiente autorizado; confirmar SHA, URL e smoke tests.

## Critério de conclusão

A tarefa permanece **Em desenvolvimento — validação pendente**. Código presente, migration versionada, CI ou Preview Ready não provam funcionamento E2E nem publicação em Production.
