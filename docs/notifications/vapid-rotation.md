# Rotação das chaves VAPID da AgriLink

## Por que é necessária

O relatório de auditoria do repositório registou uma chave privada VAPID num ficheiro de ambiente anteriormente versionado. Mesmo que o ficheiro já não exista na branch actual, uma chave que esteve no histórico Git deve ser considerada comprometida.

## Gerar um novo par

1. Num computador de confiança, na pasta do projecto, execute localmente `node generateVapidKeys.js`.
2. Guarde os dois valores num gestor de segredos. Não os coloque em commits, issues, screenshots, mensagens, logs de CI ou ficheiros `VITE_*` além da chave pública.
3. A chave pública e a privada têm de pertencer ao mesmo par.

## Configurar os serviços

- **Vercel:** definir `VITE_VAPID_PUBLIC_KEY` com a nova chave pública nos ambientes necessários (Production, Preview e Development) e publicar novamente a aplicação.
- **Supabase Edge Functions:** definir `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` com o mesmo par novo nos secrets do projecto `oqcrfqtlfqwrxxmsjpaf`. A chave privada deve existir apenas no servidor.
- Voltar a publicar as Edge Functions depois de confirmar os secrets.

Nunca criar `VITE_VAPID_PRIVATE_KEY`: variáveis com prefixo `VITE_` são incluídas no bundle do navegador.

## Reinscrição dos dispositivos

Quando a chave pública muda, as subscrições do navegador associadas à chave anterior deixam de corresponder. O hook da aplicação compara a chave configurada com a subscrição local, remove apenas o endpoint antigo deste utilizador e pede uma nova activação. Depois da publicação, cada utilizador deve abrir **Notificações** e activar novamente as notificações push no dispositivo.

## Verificação após a rotação

1. Confirmar que a aplicação foi publicada com a nova `VITE_VAPID_PUBLIC_KEY`.
2. Confirmar que os dois secrets VAPID estão definidos no Supabase e correspondem entre si.
3. Num dispositivo de teste, activar as notificações e verificar que a subscrição fica registada em `push_subscriptions` com o utilizador correcto.
4. Criar uma notificação de teste para esse utilizador e confirmar entrega push, destino interno correcto e ausência de erros VAPID nos logs da Edge Function.
5. Não reactivar nem reutilizar o par antigo.

**Limitação operacional:** a conta ligada à integração Vercel não tem actualmente autorização para consultar/alterar o projecto `agrilink` no âmbito `agrilink-s-projects` (resposta 403). Por isso, a rotação real dos secrets tem de ser concluída por uma sessão autorizada do proprietário do projecto; o código já trata a reinscrição após a troca da chave pública.
