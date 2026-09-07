# Relatório resumido do `npm audit`

Resumo dos resultados (gerado automaticamente):

- Total de vulnerabilidades: **32**
- Critical: **1**
- High: **19**
- Moderate: **11**
- Low: **1**
- Info: **0**

Dependências notáveis com problemas (exemplos):

- `jspdf` — várias CVEs, incluindo **critical** (HTML injection). Existe fix disponível (ex.: `jspdf@4.2.1`) mas pode ser breaking.
- `postcss` — múltiplas vulnerabilidades (XSS/path traversal) com correções disponíveis.
- `react-router-dom` / `react-router` — vulnerabilidades de redirecionamento (moderate/high). Atualizar para versões seguras.
- `lodash`, `nanoid`, `minimatch`, `picomatch` — várias vulnerabilidades de ReDoS / prototype-pollution / integer overflow; fix disponível em versões mais novas.
- `vite`, `rollup` — alertas relacionados a tooling; atualizar para versões sem problemas reportados.

Recomendações imediatas:

1. Rodar `npm audit fix` para aplicar correções não-breakings automaticamente.

```bash
npm audit fix
```

2. Revisar manualmente pacotes que exigem atualização major (`npm audit` indica quando `fixAvailable` é semver-major) — testar e validar.

3. Se necessário, usar `npm audit fix --force` apenas após testes completos (pode aplicar updates major e quebrar código).

```bash
npm audit fix --force
```

4. Para dependências transitivas sem correção publicada, considere usar `overrides`/`resolutions` em `package.json` (ou patch-package) para aplicar correções temporárias.

5. Habilitar Dependabot/ Renovate e integração com Snyk/GitHub security alerts para PRs automáticos.

6. Priorizar correção para a vulnerabilidade `critical` em `jspdf` imediatamente: atualizar ou remover o uso de `jspdf` se não for crítico para produto.

Localização do resultado bruto: a execução foi registrada no ambiente; se quiser eu insiro o JSON bruto em `audit/npm-audit.json` no repositório. Deseja que eu salve o JSON completo aqui? (recomendado)
