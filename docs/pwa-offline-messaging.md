# PWA e mensagens offline — AgriLink

## Ícone da aplicação

O manifesto PWA e o ícone Apple apontam para `/agrilink-icon.svg`, que incorpora o logótipo oficial da AgriLink. O service worker inclui o ícone na cache e usa-o nas notificações push.

## Mensagens sem ligação

- Mensagens de texto enviadas sem Internet são guardadas numa caixa de saída IndexedDB.
- O conteúdo da caixa de saída é cifrado localmente com AES-GCM; não é guardado em texto simples no IndexedDB.
- A mensagem mantém um identificador estável, usado no envio para evitar duplicados em tentativas repetidas.
- A caixa de saída sincroniza ao regressar a ligação, ao abrir novamente o chat e quando a página volta a ficar visível.
- Quando o destinatário está offline, mensagens enviadas com ligação continuam a ser gravadas no Supabase; o destinatário recebe-as quando voltar a abrir/ligar o chat.
- Anexos continuam bloqueados no chat até existir um fluxo de cifragem e desencriptação de ficheiros implementado e validado.

## Limites importantes

O navegador não consegue entregar uma mensagem ao servidor enquanto o dispositivo remetente não tiver conectividade. Neste caso, a mensagem fica pendente no dispositivo e é enviada quando a aplicação recuperar a ligação e executar a sincronização. O envio em segundo plano com a aplicação completamente fechada depende de suporte específico de Background Sync e de uma arquitetura de sincronização autenticada; não é prometido por esta implementação.

A sincronização depende de uma sessão autenticada válida e das políticas RLS existentes da tabela `messages`. A entrega de notificações push ao destinatário depende também de a subscrição push desse utilizador estar configurada.

## Validação

Antes de integrar na branch de base, testar: instalar o PWA, verificar o ícone; enviar mensagem online para destinatário offline; desligar a rede, enviar texto, fechar e reabrir o chat offline; voltar a ligar e confirmar que a mensagem chega uma única vez; repetir após recarregar a página.
