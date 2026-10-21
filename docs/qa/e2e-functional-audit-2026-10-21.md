# Auditoria funcional ponta a ponta — AgriLink

**Branch:** `audit/e2e-functional-hardening`  
**Base auditada:** `main` no commit `3aad79dcb66087bc17fd560632cc8935e2a03cda`  
**Modo:** revisão estática e rastreio de fluxos por código. Não foram usados dados de clientes nem executadas operações de escrita na base de produção.

## Objetivo e limites

Inventariar acções visíveis e fluxos críticos desde entrada, autenticação, utilização por papel, operações de negócio e logout. Não marcar uma funcionalidade como concluída só por compilar. Os testes de browser com sessão real e as verificações no Supabase/Vercel são necessários para confirmar o comportamento de ponta a ponta.

## Evidências estáticas iniciais

### 1. Entrada, autenticação e sessão
- O ponto de entrada usa React Router, carregamento lazy e `AuthProvider`; as rotas usam `ProtectedRoute`, `OpenRoute`, `RoleRoute` e `PermissionRoute`.
- Login, registo, OAuth Google, confirmação de email, recuperação de senha e logout estão centralizados em `src/contexts/AuthContext.tsx`.
- O perfil é guardado em `localStorage` e carregado em paralelo com as permissões. É necessário testar sessão expirada, erro de leitura do perfil, confirmação pendente, utilizador sem perfil, logout, troca de utilizador no mesmo browser e deep links protegidos.
- A função `verifyEmail` no contexto devolve sucesso sem validar token; o comentário diz que a confirmação ocorre exclusivamente em `/auth/callback`. Confirmar que nenhum ecrã chama esta função como se tivesse validado um token.
- A recuperação de senha tem listener de `SIGNED_OUT` e uma verificação tardia de sessão/hash. É um ponto de teste prioritário para evitar redirecionamento prematuro quando Supabase está a processar o link.
- O login tenta sincronizar `sync_user_email_verified`; a chamada está envolvida em try/catch, mas a resposta de erro Supabase deve ser observada explicitamente porque o cliente pode devolver `error` sem lançar excepção.
- A confirmação de email e o envio de email dependem de configurações/serviços Supabase; não é possível provar entrega de email apenas pelo código.

### 2. Navegação e links sem destino real
- `src/components/Footer.tsx` contém links sociais com `href="#"`, links legais com `href="#"` e ligações rápidas cujos fragmentos são gerados a partir do texto (por exemplo `#como-funciona`) sem evidência de correspondência com IDs reais da landing.
- O footer apresenta `/credits`; confirmar que existe uma rota correspondente antes de manter a ligação.
- A landing `src/pages/Index.tsx` tem IDs reais como `tecnologia`, `produto`, `agregacao`, `faq`, `equipa` e `contacto`. As ligações devem apontar para esses destinos ou para rotas realmente registadas.
- Não se devem inventar URLs de redes sociais nem apresentar páginas legais inexistentes como funcionais. Itens não configurados devem ser removidos da navegação activa ou claramente apresentados como indisponíveis.

### 3. Rotas e autorização
- Há rotas específicas para comprador (`/carrinho`, `/minhas-compras`) e motorista (`/cargas`); outras operações dependem de permissões administrativas.
- Algumas rotas são públicas/abertas e dependem de guardas internos da própria página para impedir operações sem autenticação. Testar direct URLs, recarregamento da página, sessão ausente, email não confirmado e papel errado.
- A rota `/carteira` redirecciona para `/perfil`; isso pode ser intencional, mas a interface não deve prometer uma carteira independente se não existe.
- Confirmar a preservação do destino original após login e o retorno correcto depois de logout.

### 4. Publicação de produto
- `src/pages/PublishProduct.tsx` usa validação de negócio, autenticação, verificação de identidade, upload para Storage e inserção com estado `pending_approval`.
- O caminho de convidado guarda rascunho local e solicita autenticação; isto não equivale a publicação remota e deve continuar explícito na interface.
- Testes necessários: upload parcial/falhado e limpeza dos ficheiros enviados, 3–10 imagens, campos obrigatórios, coordenadas, sessão expirada, RLS, duplicação por reenvio e publicação sem confirmação de email.
- A chamada de verificação de ficha técnica é fire-and-forget; falha dessa verificação não deve ser confundida com falha ou aprovação da publicação.

### 5. Operações críticas de negócio
- O repositório contém módulos para carrinho, pré-compra, pagamentos, sourcing, contratos, frete/GPS, mensagens, notificações e administração. Cada fluxo precisa de rastreio UI → função/RPC/tabela → estado persistido → feedback da UI.
- A presença de código ou de uma migration não prova que a migration esteja aplicada no ambiente activo, nem que o serviço externo esteja configurado.
- Não activar pagamentos, IA, meteorologia comercial, SMS, emails externos ou outros serviços pagos sem aprovação e sem confirmar custo zero para o piloto.
- Não usar dados de exemplo para disfarçar estados vazios; os ecrãs devem distinguir dados reais, vazio, carregamento, erro, indisponibilidade e acção pendente.

## Matriz de validação obrigatória

- [ ] Entrada pública e navegação principal; links e fragmentos não quebram.
- [ ] Registo de cada papel permitido, validação de campos, duplicados, erro de rede e confirmação real de email.
- [ ] Login correcto/incorreto, email não confirmado, refresh, sessão expirada, deep link e logout.
- [ ] Recuperação de senha: pedir link, abrir link real, actualizar senha, entrar com senha nova e rejeitar link inválido/expirado.
- [ ] Perfil: leitura real, edição, upload de avatar, identidade, província/município e estado de erro.
- [ ] Catálogo/pesquisa/filtros: resultados reais, vazio, paginação/limites, erro de consulta e navegação para detalhe.
- [ ] Publicação: formulário, localização, fotos, Storage, insert, estado pendente, feedback e limpeza em falha.
- [ ] Compras/carrinho/pré-compra: quantidades, disponibilidade, destino, idempotência, estados e isolamento por utilizador.
- [ ] Sourcing: pedido, cotação, comparação, aceitação e acompanhamento com esquema real.
- [ ] Pagamentos: estado só muda por confirmação do servidor/webhook; testar apenas ambiente de teste e sem PSP pago activo.
- [ ] Frete: atribuição, recolha, confirmação do fornecedor, GPS real, entrega e confirmação do comprador.
- [ ] Mensagens/notificações: permissões, destinatário correcto, leitura, marcação como lida e rotas de navegação.
- [ ] Administração: permissões reais por acção, tentativas sem permissão, alterações auditadas e ausência de dados inventados.
- [ ] Responsividade, acessibilidade de teclado, labels, estados de loading/erro e ausência de botões sem acção.
- [ ] CI: lint, type-check, testes e build; verificar deploy Preview e SHA exacto publicado.
- [ ] Verificação manual em browser com contas de teste autorizadas e dados de teste; não testar com clientes reais.

## Achados concretos confirmados nesta primeira passagem

1. **P2 — links fictícios no footer:** vários `href="#"` e fragmentos calculados sem ligação garantida a secções existentes. Corrigir antes de declarar navegação completa.
2. **P1 — fluxo de autenticação necessita de testes de browser:** a confirmação, OAuth e recuperação dependem de callback/configuração Supabase; não foi possível validar a entrega do email nem a sessão real nesta revisão estática.
3. **P1 — verificação de perfil/permissões tem falhas silenciosas:** falhas de consulta são registadas e podem deixar o perfil/permissões anteriores ou ausentes; validar e melhorar os estados sem conceder permissões por omissão.
4. **P1 — fluxos de negócio não podem ser certificados só por CI:** o histórico de PRs já identifica fluxos de sourcing, frete, mapa e pagamentos que dependem de migrations/serviços e testes reais antes da produção.
5. **P0 operacional — não existe evidência neste trabalho de um E2E completo autenticado** com todas as funções e papéis. Não afirmar que tudo está funcional até executar a matriz com ambiente autorizado.

## Estratégia de execução

1. Corrigir os links comprovadamente sem destino e manter apenas acções configuradas.
2. Adicionar testes automatizados focados nos fluxos de autenticação e navegação, sem mocks que simulem sucesso de backend como prova de produção.
3. Auditar cada área de negócio por papel, corrigindo apenas falhas reproduzíveis e mantendo alterações isoladas nesta branch.
4. Executar CI e browser tests em ambiente de teste autorizado; verificar estado de migrations e configuração Supabase/Vercel em modo de leitura.
5. Preparar PR com evidências, limitações e checklist; não fazer merge nem alterar produção sem validação explícita.

## Fora do âmbito desta primeira passagem
Não foram executados logins com contas reais, compras, pagamentos, uploads na Storage remota, mudanças de estado de cargas, operações administrativas, migrations ou deploys. Esses passos requerem ambiente de teste e contas autorizadas.
