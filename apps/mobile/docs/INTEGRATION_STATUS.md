# Integração da aplicação mobile AgriLink

Data: 27-11-2026

## Origem e destino

- Origem: `TheRuralTeam/mobileagri`, branch `main`, commit importado `f1a381517057ef0027486ebeeae80b32d3e96c29` (último commit da origem em 12-10-2026).
- Destino: `TheRuralTeam/agrilinks`, branch `feat/integrate-driver-gps-tracking`.
- Directório: `apps/mobile/`.
- O código web permanece na raiz; a aplicação mobile Expo Router mantém o seu próprio `package.json`, `package-lock.json`, configuração Expo e ciclo de build.

## Conteúdo importado

Foram importados 135 ficheiros versionados da aplicação mobile, incluindo:

- Rotas Expo Router: autenticação, home, pesquisa, produtos, perfil, notificações, mensagens, entregas, rastreamento, pagamentos, Pontos Verdes e área administrativa.
- Componentes, contexto de papéis, internacionalização PT-AO/FR, mapas e integração Supabase.
- Assets de marca, ícones, imagens e configurações Expo/EAS.
- Migrações SQL e templates que existiam no repositório mobile, preservados em `apps/mobile/supabase/` como histórico de origem.

## Exclusões intencionais

Não foram copiados:

- `.env` do repositório de origem: contém configuração sensível e não deve ser replicado.
- `.expo-final-audit-web/`: artefacto gerado/export web, não código-fonte.
- `supabase/.temp/`: estado local do Supabase CLI, específico do ambiente.
- Configurações pessoais de editor/assistente.

Foi criado `.env.example` apenas com nomes de variáveis e placeholders. Nunca colocar service-role keys, passwords ou tokens no bundle mobile.

## Arquitectura e dependências

- App: Expo Router, React Native, TypeScript, NativeWind.
- SDK declarado pela origem: Expo SDK 57, React Native 0.86.3, React 19.2.3.
- Backend: Supabase JS, com URL e anon key injectadas por variáveis `EXPO_PUBLIC_*`.
- Localização em segundo plano: Expo Location + Task Manager.

A aplicação mobile é um pacote separado e não foi adicionada como dependência da aplicação Vite da raiz. Não actualizar React, Expo, Vite ou Supabase automaticamente durante esta importação.

## Incompatibilidades que exigem integração

1. O serviço GPS original usa a RPC `update_freight_tracking_location` e a tabela `freight_tracking_locations`. O contrato de tracking actualmente mantido no web usa `freight_load_locations`, `freight_load_location_history` e a RPC de sincronização batch `record_freight_load_location_batch`. Estes contratos ainda não estão unificados.
2. O código mobile consulta `freight_loads` para cargas `in_transit` e envia pontos directamente. Deve ser migrado para o fluxo de handover confirmado, fila offline idempotente e timestamps de captura definido no plano `docs/operations/ISOLATED_TRACKING_INTEGRATION.md`.
3. As migrações em `apps/mobile/supabase/migrations/` são uma cópia histórica da origem. Não são migrações activas da raiz e **não devem ser aplicadas em produção** sem reconciliação com `supabase/migrations/` do repositório principal.
4. A configuração EAS aponta para o projecto Expo configurado na origem. A associação e as permissões desse projecto ainda não foram validadas nesta integração.
5. A origem contém um ficheiro `.env` versionado. Foi excluído do destino; os responsáveis devem verificar/rodar credenciais caso o ficheiro de origem tenha contido chaves reais.

## Verificações pendentes

- [ ] Instalar dependências em `apps/mobile` e executar `npm ci`.
- [ ] Executar `npm run doctor`, `npm run check:expo-deps`, `npm run typecheck`.
- [ ] Confirmar que as variáveis Supabase apontam para o projecto AgriLink correcto.
- [ ] Auditar cada RPC/tabela usada pela app contra o schema canónico em `supabase/migrations/`.
- [ ] Unificar o rastreamento mobile/web no contrato de handover e outbox offline.
- [ ] Rever autenticação, RLS, permissões de localização e comportamento em background.
- [ ] Gerar APK EAS e testar em dispositivo Android físico.
- [ ] Não promover para `main` nem Production até concluir as verificações.

## Estado

**Código-fonte importado para a branch de integração. Backend, GPS, build Android e publicação ainda não foram validados.**
