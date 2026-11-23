# AgriLink component contract

This contract is shared by the Web and Mobile clients. It defines equivalent
meaning and states, not shared markup or platform-specific navigation.

## Common rules

- Use the versioned values in `tokens.json`; adapters may translate token syntax,
  but must not introduce parallel brand, text, surface, or status colors.
- Keep actions, business rules, units, labels, and confirmation/error meanings
  consistent. Format currency and dates with the same locale and data.
- Every interactive control has a visible label or accessible name, a visible
  keyboard focus on Web, a native pressed state on Mobile, and a minimum 44 px
  touch target. Disabled and loading controls expose their state to assistive
  technology and cannot submit twice.
- Loading, success, warning, danger, information, empty, error, and offline
  states use their semantic token, an icon where appropriate, and explanatory
  text; color is never the only signal. Errors and offline state are not shown
  as successful or empty results.
- Respect text scaling, safe areas, reduced motion, keyboard navigation, and
  platform conventions. Do not copy hover behavior to touch interfaces.

## Component API and states

| Component | Conceptual properties and variants | Required states and behavior |
| --- | --- | --- |
| Button | `label`, `onPress`, `variant`: primary, secondary, quiet, destructive; optional leading/trailing icon | idle, pressed/focus, loading, disabled; loading prevents repeat activation |
| TextField / SearchField | `label`, `value`, `onChange`, `hint`, `error`, `leadingIcon`; search adds clear and submit actions | focused, filled, invalid, disabled; preserve entered text and expose validation |
| Select / Quantity / Date / Location | `label`, `value`, `options` or `onChange`, `hint`, `error`; quantity includes unit and bounds | open/selected, focused, invalid, disabled; use native picker/keyboard on Mobile |
| ProductCard / ProductMedia | product, price, unit, producer, availability, media, and product action | loading, available, unavailable, media-empty; never invent listing or availability data |
| UserIdentity / Avatar / Verification | user, display name, image, verification status | loading, image fallback, verified/unverified; use accessible name and explicit status |
| StatusLabel / InlineNotice | status, title, description, optional action | success, warning, danger, info; icon and text accompany semantic color |
| Tabs / Filter / Sort | options, selected value, `onChange`, optional result count | selected, focus/pressed, disabled; retain active filter and report result changes |
| ListRow / DataSummary | label, value, supporting text, optional icon/action | loading, populated, unavailable; keep related data grouped, not card-wrapped by default |
| Dialog / Sheet / Confirmation | title, description, actions, dismissibility | open, submitting, success, error; Web modal/popover, Mobile modal/bottom sheet/native alert |
| Empty / Loading / Error / Offline state | title, description, optional retry/action | distinct and truthful state; retry preserves the user's current context |
| NavigationItem / ContextualAction | destination/action, label, icon, selected state | selected, focus/pressed, disabled; Web header/sidebar, Mobile stack/bottom bar |

## Functional mapping

Web and Mobile must use the same terminology and state semantics for discovery,
search, product detail, profile, publication, orders, logistics, messages,
notifications, and account flows. Before migrating a screen, confirm that both
clients actually support the corresponding action; do not imply an unavailable
feature or change backend behavior as a visual shortcut.
