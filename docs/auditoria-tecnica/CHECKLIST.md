# Checklist de execução — Auditoria técnica AgriLink

Esta checklist acompanha o [plano mestre](./README.md). Marcar tarefas como concluídas apenas depois de guardar evidência e resultado. A revisão estática já feita não equivale a teste funcional.

## 1. Preparação e segurança
- [x] Ler código versionado nos dois repositórios sem modificar aplicação.
- [x] Documentar factos, riscos e limitações.
- [x] Definir abordagem sem custos adicionais e sem alterações em produção.
- [ ] Confirmar commit/branch exatos usados na próxima ronda.
- [ ] Criar ambiente de teste isolado e sem dados pessoais reais.
- [ ] Definir quem autoriza testes remotos e quem revê resultados.

## 2. Dados
- [x] Confirmar mock de KPIs.
- [x] Confirmar mock de alertas.
- [x] Localizar fonte comum de dados simulados.
- [ ] Mapear todas as páginas/hooks/gráficos.
- [ ] Testar vazio, erro, offline e sessão expirada.
- [ ] Verificar moeda, datas, unidades e cálculos para Angola.

## 3. Segurança
- [x] Identificar fallback local no dashboard.
- [x] Identificar Edge Functions com `verify_jwt = false` na configuração.
- [x] Rever parcialmente migration local de hardening.
- [ ] Fazer matriz RLS/grants/RPC/roles.
- [ ] Testar chamadas diretas com utilizadores de vários papéis.
- [ ] Verificar todas as Edge Functions e fluxos de OTP/recuperação.
- [ ] Confirmar configurações publicadas sem revelar secrets.

## 4. Compras, sourcing, pagamentos e logística
- [x] Rever RPC de aceitação de proposta.
- [x] Documentar risco de concorrência não reproduzido.
- [x] Identificar atualização de pedido após inserção de proposta.
- [x] Localizar o encaminhamento do webhook financeiro.
- [ ] Testar duas aceitações concorrentes.
- [ ] Testar rollback e falhas parciais.
- [ ] Testar eventos de pagamento repetidos e fora de ordem.
- [ ] Documentar e testar transições de estado.
- [ ] Verificar dados de rota/GPS e tratamento de indisponibilidade.

## 5. Migrations
- [x] Rever o script local de auditoria.
- [x] Documentar que ele não consulta o ledger remoto.
- [ ] Comparar ledger remoto e migrations locais.
- [ ] Comparar schema, políticas, funções, triggers, índices e constraints.
- [ ] Testar sequência de migrations em base descartável.
- [ ] Rever rollback/restauro antes de aplicar alterações.

## 6. Email e notificações
- [x] Rever endpoint de recuperação de password.
- [x] Rever parcialmente o processador da fila de email.
- [x] Distinguir agendamento de entrega.
- [ ] Testar retry, deduplicação, dead-letter e falha de fornecedor.
- [ ] Validar expiração/uso único/redirects dos links.
- [ ] Verificar observabilidade sem expor tokens.

## 7. CI/CD, secrets e recuperação
- [x] Rever workflows versionados de CI/deploy.
- [ ] Verificar execuções recentes e proteções de branch.
- [ ] Rever permissões de workflow e secrets sem os expor.
- [ ] Confirmar backups e retenção disponíveis no plano atual.
- [ ] Confirmar backup separado de Storage.
- [ ] Demonstrar restauro em ambiente isolado.
- [ ] Documentar RPO/RTO.

## 8. UX e desempenho
- [x] Registar pontos estáticos de acessibilidade e responsividade.
- [x] Registar conflito no README do dashboard.
- [ ] Testar teclado, leitor de ecrã, zoom e movimento reduzido.
- [ ] Testar layouts em ecrãs estreitos e tabelas grandes.
- [ ] Inventariar consultas frequentes e volumes.
- [ ] Medir planos de consulta em dados de teste.
- [ ] Confirmar paginação e índices com evidência.

## Fecho
- [ ] Cada achado tem ficheiro/linha, severidade, reprodução e resultado.
- [ ] Todos os riscos críticos/altos têm decisão documentada.
- [ ] Correções futuras estão separadas da auditoria e em branches próprias.
- [ ] Nenhuma alteração foi aplicada à produção sem aprovação explícita.
