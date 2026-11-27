# Design unification — initial implementation status

The `tokens.json` manifest and component contract are version 1.0.0. The Web
and Mobile manifests are kept byte-identical and are adapted using each
platform's native styling system. This is the first design-foundation delivery,
not a completed visual migration or accessibility certification.

## What is wired

- Web `src/lib/brand.ts` and Mobile `src/constants/theme.ts` read the shared
  contract rather than defining their own brand and semantic color values.
- Web Tailwind semantic colors, responsive breakpoints, and radii derive from
  the manifest; its CSS custom-property adapter is checked against the manifest.
- Mobile NativeWind palette, responsive breakpoints, role actions, shared UI
  colors, and navigation surfaces use the manifest adapter.
- Mobile loads Plus Jakarta Sans regular through extra-bold and waits for font
  assets before showing the app.
- Success, warning, danger, and information colors are distinct, with explicit
  foregrounds and tinted surfaces. The automated token check verifies WCAG AA
  normal-text contrast ratios and adapter consistency.
- Platform-neutral component API, state, accessibility, and layout guidance
  is documented in `components.md`.

## Route inventory (static)

| Capability | Web route(s) | Mobile route(s) | Notes |
| --- | --- | --- | --- |
| Discovery/feed | `/app` | `/home` | Screen layouts remain platform-specific. |
| Search | `/search` | `/search` | Verify filter and sort parity during screen migration. |
| Product detail | `/produto/:id` | `/product/:id` | Verify product media and actions against backend data. |
| Profile | `/perfil`, `/perfil/:id` | `/profile`, `/profile/:id` | Web also has company profiles at `/empresa/:id`. |
| Product publication | `/publicar-produto` | `/publicar-produto` | Preserve validation and units. |
| Purchases / pre-orders | `/carrinho`, `/minhas-compras` | No matching route identified | Do not imply feature parity until mapped. |
| Logistics / maps | `/cargas`, `/mapa`, `/mapa-app` | `/entregas`, `/mapa`, `/rastreamentos`, `/rastreamento/:id` | Verify event, permission, and location semantics. |
| Messages | `/listamensagens`, `/messages/:id` | `/conversations`, `/messages` | Verify attachment and conversation states. |
| Notifications | `/notificacoes` | `/notifications` | Verify categories and read state. |
| Authentication | `/login`, `/cadastro`, `/confirmar-email`, `/reset-password` | `/login`, `/register`, `/verify-otp`, `/forgot-password`, `/reset-password` | Native and web authentication routes differ. |

This table is a source-code route inventory only. It does not claim that every
listed flow has equivalent behavior. Dashboard and `agrilink-dashboard` are
outside the cross-client migration scope.

## Remaining work / acceptance gates

- Replace local colors and typography in screens by domain; many mobile screens
  and older Web components still contain inline/utility literals.
- Validate the core flow (feed → product detail → contact/pre-order), including
  any feature gap recorded in the route table.
- Capture and compare equivalent Web and Mobile screens at compact, medium, and
  wide viewport/device sizes. Test large text, keyboard, orientation, safe area,
  screen readers, focus, touch targets, and offline/error states on devices.
- Do not describe the clients as fully unified, WCAG-certified, or fully
  responsive until those manual checks and all migrated screens are complete.
- Keep reviewable changes and pull requests separate per repository; do not
  merge or deploy as part of this work.
