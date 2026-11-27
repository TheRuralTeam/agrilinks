# AgriLink Motorista — Android

Aplicação nativa separada do frontend web da AgriLink. O objectivo é manter o rastreamento GPS durante entregas activas, mesmo quando o motorista muda de aplicação ou bloqueia o ecrã, e guardar posições localmente quando não existe rede.

## Estado

Esta pasta contém a primeira implementação técnica do cliente Android. **Ainda não é uma versão pronta para distribuição.** Falta gerar o lockfile, compilar um development build e executar os testes em dispositivos físicos. O Expo Go não suporta o serviço de localização foreground necessário.

## Arquitectura

- Expo SDK 58 / React Native 0.88.
- Supabase Auth com sessão guardada numa base SQLite protegida por SQLCipher.
- Fila GPS local cifrada por SQLCipher; a chave é guardada no Android Keystore através do Expo SecureStore.
- expo-location + expo-task-manager registam a tarefa de localização no âmbito global da aplicação.
- Serviço foreground Android com notificação persistente e permissões foreground/background.
- Sincronização idempotente através de record_freight_load_location_batch(uuid, uuid, jsonb).
- Um único fluxo GPS pode alimentar várias cargas em trânsito do mesmo motorista. Cada amostra conserva UUID, sequência do dispositivo e hora de captura.
- Os registos não sincronizados permanecem na fila quando a rede falha. A aplicação tenta sincronizar ao receber novas posições, ao regressar ao primeiro plano e quando a conectividade é restabelecida.

## Configuração

1. Copiar .env.example para .env.
2. Definir EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY usando as credenciais públicas do projecto Supabase AgriLink.
3. Instalar dependências e validar versões:

~~~bash
npm install
npx expo install --check
npm run typecheck
npx expo-doctor
~~~

4. Gerar o projecto Android nativo e compilar um development build:

~~~bash
npx expo prebuild --platform android
npx expo run:android
~~~

Também é possível gerar um APK de teste através do perfil preview do EAS Build, depois de associar o projecto a uma conta Expo. O EAS Build tem quotas próprias; não é necessário activar qualquer serviço pago da AgriLink para a aplicação falar com o Supabase já existente.

## Permissões e privacidade

O motorista deve conceder localização precisa em primeiro plano e em segundo plano, além de permitir a notificação do serviço. O rastreamento só deve iniciar com cargas atribuídas em estado in_transit e consentimento explícito no dispositivo. A notificação informa que a localização está a ser partilhada.

O aplicativo não contém service-role key. A autorização final é sempre feita pelo Supabase usando a sessão do motorista e a RPC que valida a atribuição da carga.

## Limites da plataforma

- A aplicação não recolhe GPS quando o telefone está desligado, sem fix GPS, sem permissões ou quando o utilizador força a paragem da aplicação nas definições do Android.
- Fabricantes Android podem aplicar optimizações de bateria agressivas. O comportamento deve ser validado em cada modelo de dispositivo utilizado pelos motoristas.
- Se o Android terminar o processo da aplicação, a API estável do Expo não garante que a aplicação seja iniciada automaticamente por um novo evento de localização. Ao abrir novamente a aplicação, a sessão, as cargas activas e a fila local são recuperadas e o serviço pode ser registado de novo. Um force-stop nas definições impede a execução até o utilizador abrir a aplicação.
- A ausência de posições deve aparecer como intervalo sem sinal, nunca como uma localização inventada.

## Plano obrigatório de testes físicos

- Permissão precisa e permissão de segundo plano concedidas/negadas.
- Ecrã bloqueado durante 30–60 minutos.
- Mudança para outras aplicações.
- Processo terminado pelo sistema e reabertura da aplicação.
- Reinício do dispositivo e recuperação da sessão/fila.
- Modo avião e perda de cobertura durante o percurso.
- Recuperação de rede e envio repetido do mesmo lote (idempotência).
- Revogação de permissões, GPS desligado e optimização de bateria.
- Duas ou mais cargas simultâneas do mesmo motorista.
- Carga entregue enquanto ainda existem amostras offline por sincronizar.

Nenhum teste físico ou publicação Play Store é declarado concluído nesta fase.
