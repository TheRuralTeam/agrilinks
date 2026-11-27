# Próximos passos após correção de imports

Resumo rápido
- Branch atual: `restauracao` (push feito). PR ativo: "Corrige vulnerabilidade jspdf e move código legado para legacy/".
- Situação atual: conversão automática de imports concluída; `npm install` em andamento no agente — build/test pendentes.

Comandos que você deve executar localmente (recomendado):

1) Instalar dependências
```bash
npm install
```

2) Build
```bash
npm run build
```

3) Executar testes
```bash
npm test
```

Se qualquer comando falhar, capture o log completo (por exemplo `npm run build 2>&1 | tee build.log`) e cole aqui.

Verificações críticas a fazer após o build
- Abrir a página que gera PDFs (`src/pages/TechnicalSheet.tsx`) e testar a ação "Exportar PDF".
- Verificar console do browser por erros relacionados a `jspdf` (import, métodos ou fontes).
- Testar fluxos principais da UI (login, publicar produto, ver contratos) para checar regressões visuais.

Rollback rápido
- Se o build ou testes falharem por causa dos imports automáticos, podemos reverter o commit específico que converteu os imports (eu posso fazer isso se você autorizar).

Contato
- Quando terminar os comandos, cole aqui os logs ou peça que eu os analise; eu então aplico correções específicas (ex.: ajustar `jspdf` calls, reinstaurar wrappers, corrigir assets).
