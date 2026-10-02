# Plano para concluir as traduções do OrbisLink

**Auditoria das chaves JSON:** 2 de outubro de 2026
**Objetivo:** permitir que qualquer idioma disponível seja selecionado sem conteúdo visível ausente, texto no idioma errado ou interface quebrada.

## Estado verificado

O catálogo de idiomas em `src/i18n/index.ts` registra 12 opções: português, inglês, francês, espanhol, Lingala, Kikongo, Kimbundu, Umbundu, chinês/mandarim, russo, italiano e árabe.

A comparação das chaves JSON encontrou 470 chaves no português, usado como referência:

| Idioma | Chaves existentes | Cobertura estrutural | Pendência |
| --- | ---: | ---: | ---: |
| Português (`pt`) | 470/470 | 100% | Revisar ortografia, terminologia e consistência regional |
| Inglês (`en`) | 470/470 | 100% | Revisão editorial e funcional |
| Francês (`fr`) | 470/470 | 100% | Revisão editorial e funcional |
| Espanhol (`es`) | 215/470 | 45,7% | 255 chaves ausentes |
| Lingala (`ln`) | 65/470 | 13,8% | 405 chaves ausentes |
| Kikongo (`kik`) | 65/470 | 13,8% | 405 chaves ausentes |
| Kimbundu (`kmb`) | 65/470 | 13,8% | 405 chaves ausentes |
| Umbundu (`umb`) | 65/470 | 13,8% | 405 chaves ausentes |
| Chinês (`zh`) | 65/470 | 13,8% | 405 chaves ausentes |
| Russo (`ru`) | 65/470 | 13,8% | 405 chaves ausentes |
| Italiano (`it`) | 65/470 | 13,8% | 405 chaves ausentes |
| Árabe (`ar`) | 65/470 | 13,8% | 405 chaves ausentes |

A porcentagem mede apenas a presença das mesmas chaves do JSON português; não comprova que a tradução esteja correta ou natural. Como o i18next usa fallback para `pt` e `en`, as chaves ausentes podem aparecer nesses idiomas quando outro idioma está selecionado. Portanto, a cobertura atual ainda não garante uma experiência integralmente traduzida.

## Trabalho pendente

### 1. Completar e revisar os catálogos

- Traduzir todas as chaves dos arquivos `src/i18n/locales/*.json` para cada idioma publicado no seletor.
- Incluir novas chaves em todos os catálogos no mesmo pull request em que forem introduzidas.
- Revisar a tradução por falantes competentes, com atenção especial às línguas nacionais angolanas; não tratar traduções automáticas como texto aprovado.
- Definir um glossário comum para produto agrícola, fornecedor, comprador, agente, pedido, entrega, carteira, pagamento e termos específicos do sistema.
- Definir variantes regionais quando necessário (por exemplo, português de Angola e português do Brasil), em vez de misturar vocabulário sem critério.
- Confirmar o nome exibido, o código de locale e a escrita nativa de cada idioma. Padronizar os códigos de Kikongo, Kimbundu e Umbundu com base no padrão de locale escolhido e manter aliases legados para valores já salvos.

### 2. Eliminar texto fora do i18n

- Buscar textos visíveis e acessíveis codificados diretamente em JSX/TSX: títulos, botões, placeholders, mensagens de validação, notificações, estados vazios, diálogos, tooltips, `aria-label`, `title` e texto alternativo.
- Migrar esses textos para chaves com namespace e substituir o conteúdo direto por chamadas `t(...)`.
- Auditar mensagens vindas de funções Supabase, erros de API, validações, e-mails e conteúdo gerado dinamicamente. Traduzir no cliente quando apropriado; não presumir que traduzir a interface traduz dados fornecidos por usuários.
- Não traduzir identificadores técnicos, nomes próprios, códigos, URLs ou valores fornecidos pelo usuário.

### 3. Formalizar regras de tradução

- Definir pluralização e interpolação com os recursos do i18next; verificar que placeholders como `{{count}}` e variáveis de conteúdo sejam idênticos entre idiomas.
- Usar namespaces para dividir catálogos grandes quando isso facilitar manutenção, sem alterar as chaves públicas sem um plano de migração.
- Especificar o fallback de forma deliberada. Durante a conclusão, permitir fallback para encontrar lacunas; antes de declarar um idioma completo, configurar CI para falhar se houver chave ausente ou extra e conferir que a tela não depende de fallback.
- Atualizar a troca de idioma por uma única função compartilhada que aguarde `i18n.changeLanguage`, persista a escolha com tratamento para indisponibilidade de `localStorage` e atualize a configuração regional associada. Evitar chamadas diretas divergentes ao i18next espalhadas pelas telas.

### 4. Garantir layout e acessibilidade

- Ao mudar idioma, atualizar `document.documentElement.lang`; para árabe, aplicar `dir="rtl"` e remover essa direção ao voltar a um idioma LTR.
- Revisar CSS e componentes RTL: alinhamento, ordem de navegação, setas, ícones direcionais, breadcrumbs, menus, formulários e animações. Não espelhar ícones neutros ou de marca.
- Testar rótulos longos e escritas diferentes em mobile e desktop, com quebra de linha ou truncamento somente quando apropriado; impedir sobreposição, recorte e deslocamento de ícones.
- Validar fontes e glifos para árabe, chinês, russo e as línguas africanas selecionadas, incluindo fallback de fonte e renderização em dispositivos suportados.
- Preservar nomes de marca, valores numéricos e conteúdo de dados; formatar datas, números, moedas e unidades com APIs de locale, como `Intl`, quando aplicável.

### 5. Automatizar a qualidade e validar com pessoas

- Criar um teste que compare recursivamente todas as chaves de cada locale com o catálogo de referência, verificando chaves ausentes, extras e tipo de valor incompatível.
- Validar interpolação, pluralização, aliases, códigos BCP 47 e persistência da escolha de idioma.
- Adicionar a verificação de paridade dos catálogos ao pipeline de CI para impedir novas lacunas.
- Fazer testes de interface nos fluxos principais: cadastro/login, navegação, publicação, pedidos, perfil, pagamentos e administração, em cada idioma e em RTL.
- Realizar revisão humana por idioma, registrando aprovador e versão do glossário. A paridade de chaves não substitui revisão semântica.

## Critérios para declarar 100%

Um idioma só pode ser marcado como completo quando todos os critérios abaixo forem atendidos:

1. Tem exatamente as mesmas chaves e tipos do catálogo de referência; a checagem automatizada passa sem lacunas nem extras.
2. Nenhuma mensagem visível ou acessível relevante permanece hardcoded ou aparece em um idioma de fallback ao selecionar esse idioma.
3. Placeholders, plurais, validações e mensagens de erro funcionam com valores reais.
4. Textos e termos foram revisados por pessoa competente no idioma e aprovados no glossário do produto.
5. Fluxos críticos foram testados; a interface não apresenta texto cortado, sobreposto ou desalinhado. Árabe também passa nos testes RTL.
6. A preferência persiste após recarregar e o atributo `lang`/`dir` reflete o idioma ativo.

## Sequência recomendada

1. Implementar teste de paridade de catálogos e inventário de textos hardcoded.
2. Corrigir a arquitetura de troca de idioma, códigos/aliases e comportamento `lang`/RTL.
3. Completar primeiro espanhol, depois os oito catálogos adicionais, com revisão humana paralela por idioma.
4. Migrar textos hardcoded e normalizar pluralização, erros e formatação local.
5. Executar CI, testes visuais e aprovação linguística; liberar cada idioma somente após cumprir os critérios acima.
