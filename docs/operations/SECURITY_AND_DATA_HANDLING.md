# Segurança e tratamento de dados — AgriLink

## Princípios

- Aplicar menor privilégio por perfil e por recurso.
- Validar autorização no servidor; a interface não é uma fronteira de segurança.
- Não expor dados de comprador, fornecedor, motorista ou localização a terceiros.
- Não guardar segredos em código, commits, issues, logs ou documentação.
- Registar operações críticas com identidade, timestamp, recurso e resultado, sem guardar credenciais.

## Perfis e fronteiras de acesso

| Perfil | Acesso esperado |
|---|---|
| Comprador | Produtos públicos e os seus pedidos, pagamentos e entregas |
| Fornecedor | Os seus produtos, pré-compras recebidas e entregas relacionadas |
| Motorista | Cargas atribuídas/aceites e operações necessárias às suas entregas |
| Administrador | Apenas módulos administrativos autorizados pelo papel/permissão |
| Financeiro | Dados financeiros segundo autorização específica; não presumir que todo Admin tem acesso |

Todas as queries e RPCs devem aplicar a mesma fronteira de autorização.

## Localização GPS

- Coordenadas são dados operacionais sensíveis.
- Acesso deve ser limitado a comprador da entrega e operadores Admin autorizados.
- Expor apenas a localização necessária durante o transporte activo.
- Encerrar ou restringir o acesso após conclusão/cancelamento, segundo política de retenção.
- Mostrar a hora da última actualização.
- Não colocar coordenadas completas em notificações, URLs públicas ou logs de analytics.
- Não usar service-role key no frontend.
- Rever RLS, RPCs, Realtime e canais de subscrição para impedir leitura cruzada entre entregas.

## Pagamentos e liquidação

- Não afirmar que existe integração de gateway real sem credenciais, callbacks e reconciliação testados.
- Não aceitar confirmação de pagamento baseada apenas no frontend.
- Eventos de pagamento devem ser autenticados, idempotentes e auditáveis.
- Valores retidos e repasses devem seguir estados financeiros explícitos; não simular liquidação.
- Nunca guardar dados de cartão ou credenciais bancárias não necessárias.

## Segredos e ambiente

- Variáveis de ambiente devem ser configuradas no gestor de segredos da plataforma.
- Não incluir `.env`, tokens, passwords, OTP, chaves privadas ou service-role keys no Git.
- Se um segredo for exposto, revogar/rotacionar imediatamente e avaliar impacto histórico.
- Redigir logs e relatórios para remover dados pessoais e tokens de uso único.
- Não pedir ao utilizador para partilhar credenciais em chat.

## Revisão de segurança antes do release

- [ ] RLS habilitada nas tabelas com dados privados.
- [ ] Policies testadas com cada perfil e com utilizador não relacionado.
- [ ] RPCs SECURITY DEFINER com search_path fixo e EXECUTE restrito.
- [ ] Realtime limitado por autorização e filtros adequados.
- [ ] Operações críticas idempotentes.
- [ ] Segredos fora do repositório e sem exposição em logs.
- [ ] Uploads validados por tipo, tamanho e autorização.
- [ ] GPS e dados financeiros com retenção e acesso documentados.
- [ ] Erros não revelam informação interna nem dados de outros utilizadores.
