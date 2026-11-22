# AgriLink — sistema de design unificado Web + Mobile

> Estado: especificação de alinhamento e auditoria inicial; não representa implementação concluída.
> Web: `TheRuralTeam/agrilinks` (repositório principal e fonte de referência visual atual).
> Mobile: `TheRuralTeam/mobileagri` (Expo / React Native).
> Exclusão: `TheRuralTeam/agrilink-dashboard` não faz parte desta unificação.

## 1. Objetivo

Web e Mobile devem parecer e comportar-se como duas superfícies do mesmo produto AgriLink. O utilizador deve reconhecer a marca, os padrões e os estados sem reaprender a interface ao trocar de dispositivo.

**Unificar não significa duplicar o layout.** A Web pode usar navegação lateral, grelhas e painéis amplos; o Mobile pode usar navegação inferior, folhas, listas compactas e gestos nativos. A identidade, a semântica e as regras de interação devem permanecer consistentes.

## 2. Fonte de verdade visual existente

A Web já declara uma fundação em `src/lib/brand.ts`:
- verde principal atual: `#2c863b`;
- fonte: Plus Jakarta Sans;
- tokens `T` e escala de raios `R`.

O `src/index.css` e `tailwind.config.ts` expõem variáveis CSS e aliases semânticos. Esta implementação é a referência inicial a consolidar, não uma prova de que todos os ecrãs já a seguem.

O Mobile tem divergências visíveis na leitura estática:
- verde `#218B4A` em `src/constants/roleActions.ts` e outros componentes;
- textos `#16231C`, fundos `#F3F6F2` e outras cores locais;
- mistura de NativeWind, `StyleSheet` e valores inline.

**Decisão de alinhamento:** usar a identidade oficial da Web como ponto de partida e migrar o Mobile para os mesmos valores e significados após validar contraste, legibilidade e acessibilidade. Não escolher uma terceira paleta nem preservar divergências acidentais.

## 3. O que deve ser igual

1. Marca: logótipo, símbolo, proporções e uso de verde institucional.
2. Tipografia: Plus Jakarta Sans, com escala e pesos equivalentes.
3. Cores semânticas: marca, texto, fundo, superfície, borda, foco, sucesso, aviso, erro e informação.
4. Espaçamento: escala comum e regras de densidade.
5. Formas: raios, contornos, elevação e separadores.
6. Ícones: uma linguagem visual consistente, tamanhos e significados equivalentes.
7. Componentes: botões, campos, pesquisa, filtros, cartões de produto, etiquetas de estado, diálogos, listas e estados vazios/erro.
8. Conteúdo e microcopy: mesmos termos de negócio, unidades, estados, formatação monetária e datas.
9. Comportamento: estados de loading, disabled, focus, pressed, success, error, offline e confirmação do backend.
10. Acessibilidade: contraste, alvos de toque, nomes acessíveis, foco e texto ampliado.

## 4. O que deve adaptar-se por plataforma

| Elemento | Web | Mobile |
|---|---|---|
| Navegação | sidebar/header, breadcrumbs e menus | navegação inferior, stack e ações contextuais |
| Conteúdo | grelhas e painéis com largura limitada | coluna, listas e grelhas compactas |
| Formulários | campos e validação web | teclado nativo, pickers e safe areas |
| Diálogos | modal/popover | modal, bottom sheet ou alert nativo |
| Mapas | painel/mapa adaptado ao viewport | mapa tátil e controlos adequados ao toque |
| Interação | hover, focus-visible e teclado | pressed, gestos e leitores de ecrã |
| Layout | breakpoints e colunas | classes de tamanho, orientação e dimensões |

Não reproduzir no Mobile hover states inexistentes nem forçar a navegação Web para caber num telemóvel.

## 5. Contrato de tokens partilhados

Manter um manifesto versionado e agnóstico de plataforma, com a mesma estrutura e valores nos dois repositórios. O manifesto deve cobrir:

- `color.brand.primary`, `color.brand.onPrimary`;
- `color.text.primary/secondary/disabled`;
- `color.surface.canvas/card/raised`;
- `color.border.default/strong/focus`;
- `color.status.success/warning/danger/info` e respetivas cores de texto;
- tipografia: família, escala, pesos, line-height e tracking;
- spacing: escala base;
- radius: control, card, panel e pill;
- elevation: níveis documentados;
- control: altura mínima, tamanho de ícone e alvo de toque;
- breakpoints/size classes e safe-area rules.

O manifesto é a fonte de verdade. Web e Mobile podem ter adaptadores nativos, mas não devem manter valores paralelos independentes.

### Regra importante para cores semânticas

Na Web atual, os aliases `success`, `warning` e `destructive` convergem para o mesmo verde. Isso não comunica estados de forma suficiente e deve ser revisto antes de declarar o sistema acessível. Verde de marca não deve substituir erro, aviso ou informação. Os estados devem ser distinguíveis por cor, ícone e texto, com contraste validado.

### Temas

A Web declara uma classe `.dark`, mas os valores encontrados mantêm superfícies brancas. Não assumir que existe um tema escuro funcional. A primeira entrega unificada deve definir e validar um tema claro consistente; tema escuro só deve ser declarado disponível depois de auditado nas duas plataformas.

## 6. Componentes partilhados — contrato visual e funcional

Criar equivalentes nativos com a mesma API conceptual, não necessariamente o mesmo código:

- Button: primary, secondary, quiet, destructive, loading e disabled;
- TextField / SearchField / Select / Quantity / Date / Location;
- ProductCard e ProductMedia;
- UserIdentity / Avatar / Verification;
- StatusLabel / InlineNotice;
- Tabs / Filter / Sort;
- ListRow / DataSummary;
- Dialog / Sheet / Confirmation;
- EmptyState / LoadingState / ErrorState / OfflineState;
- NavigationItem / ContextualAction.

Cada componente precisa de especificação de propriedades, variantes permitidas, conteúdo, acessibilidade, estados, comportamento e exemplos. Não criar um cartão para cada bloco por hábito; usar cartões apenas quando agrupam informação relacionada.

## 7. Mapeamento funcional de ecrãs equivalentes

| Área de produto | Web | Mobile | Elementos que devem coincidir |
|---|---|---|---|
| Feed / descoberta | feed marketplace | Home | hierarquia, produto, preço, produtor, disponibilidade |
| Pesquisa | pesquisa e filtros | Search | campos, filtros, ordenação e vazio |
| Produto | detalhe e ações | Product detail | informação, galeria, contacto e pré-encomenda |
| Perfil | perfil e edição | Profile | identidade, dados públicos/privados e ações |
| Publicação | publicar produto | Publicar produto | rótulos, validação, unidades e estados |
| Pedidos | pré-compra/checkout | fluxos de compra e fichas | estados e linguagem do negócio |
| Logística | cargas/mapa/rastreio | Entregas/Mapa/Rastreamento | estados, localização e eventos |
| Mensagens | conversas | Conversations/Messages | participantes, mensagens e anexos |
| Notificações | centro de notificações | Notifications | categorias, leitura e estados |
| Conta | autenticação/segurança | Login/Registo/Segurança | campos, validação e mensagens |

Antes de redesenhar, confirmar as rotas e funcionalidades realmente presentes em cada cliente. Não inventar equivalência funcional quando uma plataforma ainda não disponibiliza determinada ação.

## 8. Responsividade e acessibilidade

Validar a Web em viewport estreito, médio e largo; Mobile em telemóveis compactos/grandes e tablets. Testar:
- conteúdo longo e traduções;
- aumento de fonte;
- teclado aberto e campos focados;
- orientação e safe areas;
- ausência de overflow, clipping e sobreposição;
- contraste e foco visível;
- TalkBack e VoiceOver;
- alvos de toque e navegação por teclado na Web.

Usar WCAG 2.2 AA como referência de aceitação, com adaptações aos controlos nativos.

## 9. Plano seguro de execução

1. Inventariar os componentes, tokens, rotas e screenshots atuais dos dois clientes.
2. Auditar a fundação Web e decidir tokens semânticos finais; corrigir aliases de estado antes de os propagar.
3. Criar o manifesto agnóstico de tokens e a especificação de componentes.
4. Implementar adaptadores de tokens nos dois clientes, sem alterar regras de negócio ou backend.
5. Validar um fluxo de referência: Feed → detalhe de produto → contacto/pré-encomenda.
6. Comparar capturas Web e Mobile em tamanhos equivalentes.
7. Migrar os restantes ecrãs por domínio funcional, com testes de regressão.
8. Fazer revisão de acessibilidade, TypeScript, lint, testes e build.
9. Abrir PRs separados; não fazer merge nem deploy automaticamente.

## 10. Guardrails

- Não alterar schema, RLS, RPC, Auth ou integrações para uma tarefa puramente visual.
- Não remover nem simplificar ações existentes para facilitar o layout.
- Não apresentar mock/demo como dados reais.
- Não introduzir serviços pagos ou dependências comerciais.
- Não criar um terceiro sistema visual nem manter valores divergentes sem justificação documentada.
- Não declarar 100% responsivo ou funcional sem matriz de dispositivos e testes reais.
- Não mexer em `TheRuralTeam/agrilink-dashboard`; o escopo é o repositório principal Web e o repositório Mobile.

## 11. Critérios de conclusão

- tokens equivalentes e versionados nos dois clientes;
- componentes visualmente equivalentes e acessíveis;
- mesma linguagem, terminologia e estados de negócio;
- diferenças de layout justificadas por plataforma;
- fluxos existentes preservados;
- capturas comparativas por viewport/dispositivo;
- checks automatizados e testes manuais documentados;
- PRs separados, revisáveis e sem deploy não autorizado.
