/**
 * AgriLink Design System — single source of truth
 *
 * Extracted from the Notifications screen (reference design):
 * - Brand palette: black text, white surfaces, and AgriLink green (#2c863b).
 * - Transparency may be used to create tints without adding palette colors.
 * - Typography: Plus Jakarta Sans across the whole platform.
 */

import designTokens from "../../design-system/tokens.json";

export const FONT = `'${designTokens.typography.family}', ${designTokens.typography.fallback.join(", ")}`;

export const PRIMARY_GREEN = designTokens.color.brand.primary;

const { color, radius, elevation } = designTokens;
const status = color.status;

export const SEMANTIC_COLORS = {
  success: status.success.color,
  successText: status.success.text,
  successSurface: status.success.surface,
  warning: status.warning.color,
  warningText: status.warning.text,
  warningSurface: status.warning.surface,
  danger: status.danger.color,
  dangerText: status.danger.text,
  dangerSurface: status.danger.surface,
  info: status.info.color,
  infoText: status.info.text,
  infoSurface: status.info.surface,
} as const;

export const T = {
  /* Compatibility aliases retained while screens migrate to shared tokens. */
  g900: PRIMARY_GREEN,
  g700: PRIMARY_GREEN,
  g600: PRIMARY_GREEN,
  g500: PRIMARY_GREEN,
  g400: PRIMARY_GREEN,
  green: PRIMARY_GREEN,
  g100: status.success.surface,
  g50: status.success.surface,
  gBorder: color.border.default,

  /* Legacy earth-tone aliases now resolve to the brand palette. */
  e700: PRIMARY_GREEN,
  e500: PRIMARY_GREEN,
  e300: PRIMARY_GREEN,
  ePale: color.surface.subtle,
  eBorder: color.border.default,

  /* Text hierarchy stays neutral; green is reserved for brand emphasis. */
  ink: '#000000',
  mid: color.text.secondary,
  muted: color.text.secondary,
  faint: color.text.disabled,
  canvas: color.surface.canvas,
  subtle: color.surface.subtle,
  white: color.surface.card,
  rule: color.border.default,

  /* Legacy gold aliases now resolve to the brand palette. */
  gold: status.warning.text,
  goldL: status.warning.text,
  goldMid: status.warning.text,
  goldDark: status.warning.text,
  goldDeep: status.warning.text,
  goldLight: status.warning.text,
  goldBg: status.warning.surface,
  goldPale: status.warning.surface,
  goldBorder: color.border.default,
  blue: status.info.text,
  blueBg: status.info.surface,
  danger: status.danger.text,
  dangerBg: status.danger.surface,
  charcoal: color.text.primary,
  cream: color.surface.subtle,
  soft: color.surface.subtle,
  greenLight: PRIMARY_GREEN,
  greenPale: status.success.surface,

  /* Shadows */
  shadow: 'rgba(0,0,0,0.08)',
  shadowMd: 'rgba(0,0,0,0.12)',
  shadowLg: elevation.floating.web,
} as const;

/** Shared radii / spacing scale */
export const R = {
  sm: radius.control,
  md: radius.card,
  lg: radius.panel,
  xl: radius.panel,
  pill: radius.pill,
} as const;

export type BrandTokens = typeof T;
export default T;
