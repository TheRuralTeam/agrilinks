/**
 * AgriLink Design System — single source of truth
 *
 * Extracted from the Notifications screen (reference design):
 * - Brand palette: black text, white surfaces, and AgriLink green (#2c863b).
 * - Transparency may be used to create tints without adding palette colors.
 * - Typography: Plus Jakarta Sans across the whole platform.
 */

export const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

/** The one and only AgriLink green */
export const PRIMARY_GREEN = '#2c863b';

export const T = {
  /* Compatibility aliases retained while screens migrate to shared tokens. */
  g900: PRIMARY_GREEN,
  g700: PRIMARY_GREEN,
  g600: PRIMARY_GREEN,
  g500: PRIMARY_GREEN,
  g400: PRIMARY_GREEN,
  green: PRIMARY_GREEN,
  /* Green tints use transparency so the palette remains white and green. */
  g100: 'rgba(44, 134, 59, 0.08)',
  g50: 'rgba(44, 134, 59, 0.04)',
  gBorder: 'rgba(44, 134, 59, 0.24)',

  /* Legacy earth-tone aliases now resolve to the brand palette. */
  e700: PRIMARY_GREEN,
  e500: PRIMARY_GREEN,
  e300: PRIMARY_GREEN,
  ePale: '#FFFFFF',
  eBorder: 'rgba(44, 134, 59, 0.24)',

  /* Text hierarchy stays neutral; green is reserved for brand emphasis. */
  ink: '#000000',
  mid: '#000000',
  muted: '#000000',
  faint: '#000000',
  canvas: '#FFFFFF',
  white: '#FFFFFF',
  rule: 'rgba(44, 134, 59, 0.24)',

  /* Legacy gold aliases now resolve to the brand palette. */
  gold: PRIMARY_GREEN,
  goldL: PRIMARY_GREEN,
  goldMid: PRIMARY_GREEN,
  goldDark: PRIMARY_GREEN,
  goldDeep: PRIMARY_GREEN,
  goldLight: PRIMARY_GREEN,
  goldBg: '#FFFFFF',
  goldPale: '#FFFFFF',
  goldBorder: 'rgba(44, 134, 59, 0.24)',

  /* Shadows */
  shadow: 'rgba(44,134,59,0.10)',
  shadowMd: 'rgba(44,134,59,0.15)',
  shadowLg: '0 8px 32px rgba(44,134,59,0.12)',
} as const;

/** Shared radii / spacing scale */
export const R = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export type BrandTokens = typeof T;
export default T;
