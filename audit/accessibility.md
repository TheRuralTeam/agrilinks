# Acessibilidade (a11y)

Checklist inicial e achados:

- Rodar ferramentas: `axe`, `pa11y`, `Lighthouse` e `react-axe` em dev para detectar problemas.
- Verificar se imagens têm `alt` descritivo e se elementos interativos têm `aria-*` apropriados.
- Conferir foco visível e navegação por teclado em componentes como menus, modais e mapas.

Recomendações:

1. Executar uma auditoria automatizada com `axe-core` e produzir um relatório de problemas por página.
2. Garantir contraste mínimo AA para textos normais (4.5:1) e grande (3:1).
3. Revisar componentes Radix/Headless para garantir uso correto de atributos e estados acessíveis.
4. Adicionar testes E2E que verifiquem navegação por teclado e leitura de leitores de tela em fluxos críticos.
