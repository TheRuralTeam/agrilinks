# Checklist de validação do `jspdf` e exportação de PDF

Objetivo: confirmar que `jspdf` atualizado (corrigida vulnerabilidade) funciona nos fluxos que geram PDF.

Passos de verificação
1. Confirme a importação no(s) arquivo(s) que geram PDF:
```ts
import { jsPDF } from "jspdf";
```

2. Teste manual (modo dev):
- `npm run dev`
- Acesse a página que contém o botão de export (ex.: `/meus-contratos` ou `TechnicalSheet`).
- Clique em "Exportar PDF" e veja se o download é iniciado sem erros.

3. Logs e erros comuns
- Erro de import: verifique se há múltiplas versões de `jspdf` no `package-lock.json`/`bun.lockb`.
- Erro em métodos (`doc.save`): a API principal ainda suporta `doc.save('nome.pdf')` — se mudar, tente `doc.output('blob')` + download manual.
- Fonts e estilos: fontes customizadas podem exigir `addFileToVFS` + `addFont` na API do `jspdf`.

Exemplo mínimo de geração (para testar isoladamente):
```ts
import { jsPDF } from 'jspdf'

export function simplePdf() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.setFontSize(12)
  doc.text('Teste de PDF - AgriLink', 40, 60)
  return doc
}

// usar: simplePdf().save('teste.pdf')
```

4. Ajustes possíveis
- Se `new jsPDF()` lançar erro no runtime, trocar para `const { jsPDF } = await import('jspdf')` (lazy import) e instanciar no clique.
- Se o PDF gerar, mas o conteúdo estiver truncado, validar o layout/width em pontos (`pt`) e chamada de `html` → `doc.html(...)` se necessário.

5. Após validação
- Se tudo OK, atualizar `audit/` com evidência (screenshot, build.log) e fechar a issue de `jspdf`.
- Se falhar, cole o erro aqui e eu proponho o patch (ex.: adaptar chamadas, usar wrapper que detecta versão e aplica compat shim).
