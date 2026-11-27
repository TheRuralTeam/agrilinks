# UI/UX e Identidade Visual

Observações gerais:

- Projeto usa Tailwind com sistema de variáveis CSS (cores e tokens em `tailwind.config.ts`) — isso é bom para manter identidade visual consistente.
- Utiliza `shadcn-ui` e Radix UI, o que facilita componentes acessíveis e consistentes.

Achados e oportunidades:

- Apesar da variávelção temática, não há documentação centralizada de tokens/design-system. Recomendo criar um `design-tokens.md` ou criar um pacote `ui/` com componentes base.
- Verificar consistência de espaçamentos, tipografia e estados (hover/focus) entre componentes (por exemplo, `ProductCard`, `Header`, `Footer`).
- Mapas e elementos ricos (Mapbox) podem quebrar identidade visual — padronizar estilos e interações de mapas para manter coesão.

Recomendações práticas:

1. Criar um pequeno design system/kit dentro do repo (`src/ui/` ou `packages/ui`) com componentes base e tokens exportáveis.
2. Documentar guidelines de cores/contraste para não quebrar identidade ao crescer a interface.
3. Implementar um Storybook leve para validar visualmente componentes e estados (permite QA e designers colaborarem).
