/**
 * AgriLink Design System — single source of truth
 *
 * Extracted from the Notifications screen (reference design):
 * - Official green: #2c863b (the "Activar" button green). No other green tone is allowed.
 * - Background: always white / light canvas. Green is an accent only.
 * - Typography: Plus Jakarta Sans across the whole platform.
 */

export const FONT = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

/** The one and only AgriLink green */
export const PRIMARY_GREEN = '#2c863b';

export const T = {
  /* Greens — all collapsed onto the single official tone */
  g900: PRIMARY_GREEN,
  g700: PRIMARY_GREEN,
  g600: PRIMARY_GREEN,
  g500: PRIMARY_GREEN,
  g400: PRIMARY_GREEN,
  green: PRIMARY_GREEN,
  /* Tints (surfaces / borders derived from the same hue) */
  g100: '#E8F5E9',
  g50: '#F2FAF3',
  gBorder: '#C8E6CA',

  /* Earth (secondary, non-green accents) */
  e700: '#5C3317',
  e500: '#7B4F2E',
  e300: '#A0522D',
  ePale: '#FDF5EE',
  eBorder: '#EDD9C6',

  /* Neutrals — light canvas everywhere */
  ink: '#111714',
  mid: '#3D4D40',
  muted: '#758A79',
  faint: '#A8BAA9',
  canvas: '#F7F9F7',
  white: '#FFFFFF',
  rule: '#E5EDE6',

  /* Gold accent */
  gold: '#B07D0A',
  goldL: '#E5A020',
  goldMid: '#C9922A',
  goldDark: '#8B6020',
  goldDeep: '#8B6020',
  goldLight: '#E5A020',
  goldBg: '#FDF8F0',
  goldPale: '#FBF3E4',
  goldBorder: '#EDD9C6',

  /* Shadows */
  shadow: 'rgba(13,43,18,0.10)',
  shadowMd: 'rgba(13,43,18,0.15)',
  shadowLg: '0 8px 32px rgba(13,43,18,0.12)',
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
