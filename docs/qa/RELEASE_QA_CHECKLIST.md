# Checklist QA e critérios de release

## Antes de abrir PR

- [ ] Descrever problema, causa raiz e comportamento esperado.
- [ ] Identificar componentes frontend, funções backend, migrations e variáveis.
- [ ] Definir perfis afectados e fronteiras de autorização.
- [ ] Adicionar testes unitários/integrados relevantes.
- [ ] Testar loading, vazio, erro, sucesso, timeout e reconexão.
- [ ] Confirmar acessibilidade básica e layouts mobile/desktop.
- [ ] Verificar que não foram introduzidos segredos.

## CI e validações locais

Scripts existentes em `package.json`:
- `npm ci`
- `npm run lint`
- `npm test -- --run` (Vitest; confirmar argumentos suportados pelo projecto)
- `npm run build`
- `npm run type-check:strict`
- `npm run audit:migrations`
- `npm run design:check`

A existência dos scripts não prova que foram executados na release actual. Registar os resultados e logs.

## Testes por perfil

- [ ] Anónimo: só conteúdo público.
- [ ] Comprador: só os seus pedidos, pagamentos e entregas.
- [ ] Fornecedor: só produtos e pré-compras próprias.
- [ ] Motorista: só cargas atribuídas/aceites e dados operacionais necessários.
- [ ] Admin: módulos permitidos pelas permissões efectivas.
- [ ] Financeiro: acesso restrito conforme política financeira.

## Regressão marketplace

- [ ] Listagem e detalhe de produto.
- [ ] Publicação/edição de produto.
- [ ] Pré-compra e consistência de stock.
- [ ] Notificação e histórico de pedidos.
- [ ] Aceitação/rejeição pelo fornecedor.
- [ ] Cálculo e negociação de frete.
- [ ] Pagamento e estado financeiro sem falsa confirmação.
- [ ] Entrega, tracking e comprovativo.

## Critérios de release

Só publicar quando:
- CI aplicável está verde ou excepções estão justificadas e aprovadas;
- migrations foram revistas e aplicadas no ambiente correcto;
- deployment de Production termina Ready;
- smoke tests passam no domínio de produção;
- fluxos E2E críticos passam;
- permissões e isolamento de dados foram testados;
- plano de rollback é conhecido;
- README e registo de release são actualizados.

## Modelo de evidência

Para cada teste, registar:
- ID do teste;
- ambiente e data/hora;
- perfil utilizado (sem expor dados pessoais);
- passos executados;
- resultado esperado e obtido;
- estado PASS/FAIL/BLOCKED;
- referência a log, PR, commit ou captura sanitizada;
- responsável pela validação.
