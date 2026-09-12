import type { ViewStyle } from 'react-native';

/**
 * Ported from the PWA's `src/styles/theme.css` (`:root` block). Every value
 * here is the PWA's literal token value — when touching one, change the PWA
 * too, or the two apps drift apart visually.
 *
 * Not ported: the PWA's `[data-theme='dark']` palette and the toggle in its
 * SchoolSettings page. The Android app is light-only for now, so `colors`
 * holds the light theme unmixed.
 *
 * Typeface: the PWA sets `--font: 'Segoe UI', system-ui, …`. Segoe UI does not
 * exist on Android, so we deliberately do not set a fontFamily anywhere and
 * let the platform's system font (Roboto) apply — the native equivalent of the
 * PWA's `system-ui` fallback.
 */
export const colors = {
  // Brand
  maroon: '#8B2626', // --color-primary
  orange: '#EF6905', // --color-accent
  cream: '#F1E5A1', // --color-cream
  green: '#486C2F', // --color-green

  // Brand variants (the PWA uses these for hover states; on touch we use them
  // for pressed states and for the darker/lighter accents in chrome)
  maroonDark: '#6d1c1c', // --color-primary-dark
  maroonLight: '#a33a3a', // --color-primary-light
  orangeLight: '#ff8c33', // --color-accent-light

  // Surfaces and text
  background: '#fdfaf0', // --color-bg
  surface: '#ffffff', // --color-surface
  text: '#1a1a1a', // --color-text
  textMuted: '#5a5a5a', // --color-text-muted
  border: '#e8d9a8', // --color-border

  // Semantic. Note --color-danger is the *brand* maroon in the PWA, not a
  // Material red — destructive actions there are just maroon.
  success: '#486C2F', // --color-success
  danger: '#8B2626', // --color-danger
  warning: '#EF6905', // --color-warning

  // The score-grid HPS column tint (PWA `--hps-bg`)
  hpsBg: '#fff8e0',

  // Inline in the PWA wherever it shows an error box (pages/Login.tsx,
  // DuplicateRecords.tsx): `background: '#fce8e8'` with maroon text.
  errorBg: '#fce8e8',

  // The PWA's "info" accent, used for the duplicate/rename chips and the
  // learner report link (Dashboard.tsx:415-417, DuplicateRecords.tsx:86-88,
  // Learners.tsx:169,236).
  info: '#2b4a8b',
  infoBg: '#eef2fb',

  // The PWA's second red: failed totals, the weights error box and the
  // Emerging grade band (SchoolSettings.tsx:596,653, utils/gradeMeta.ts:12).
  dangerAlt: '#9c2b2b',

  // The PWA's learner-row divider — deliberately lighter than --color-border
  // (Learners.tsx:154,221).
  divider: '#f0e6c8',
} as const;

/**
 * The PWA builds its translucent tints with
 * `color-mix(in srgb, var(--color-X) N%, transparent)` (see `.badge-core` in
 * theme.css and ImportData.tsx). React Native has no `color-mix`, so each one
 * is written out as the equivalent rgba(). Keep the percentages in sync with
 * the PWA call sites.
 */
export const tints = {
  primary12: 'rgba(139, 38, 38, 0.12)', // ImportData: color-mix(primary 12%)
  primary15: 'rgba(139, 38, 38, 0.15)', // .badge-core
  accent15: 'rgba(239, 105, 5, 0.15)', // .badge-elective
  green15: 'rgba(72, 108, 47, 0.15)', // ImportData: color-mix(green 15%)
  dangerAlt08: 'rgba(156, 43, 43, 0.08)', // SchoolSettings weights error box tint
  overlay: 'rgba(0, 0, 0, 0.4)', // centered-modal backdrop
  overlaySheet: 'rgba(0, 0, 0, 0.45)', // bottom-sheet backdrop
  onPrimarySoft: 'rgba(255, 255, 255, 0.2)', // header action pill
} as const;

/** PWA `--radius: 12px` / `--radius-sm: 8px`, plus the 16px the PWA writes
 *  inline for its "hero" surfaces (login card, modal shells). */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

/**
 * PWA `--shadow` / `--shadow-md`. React Native needs the elevation hint for
 * Android on top of the iOS-style shadow props. The PWA tints its shadows with
 * the brand maroon; Android honours `shadowColor` for elevation on API 28+, so
 * keep passing it through rather than falling back to grey.
 */
export const shadows: Record<'card' | 'raised' | 'hero', ViewStyle> = {
  card: {
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  // Not a theme.css token: the PWA writes this one inline on the Login card
  // (`boxShadow: '0 8px 32px rgba(139,38,38,0.12)'` in pages/Login.tsx).
  hero: {
    shadowColor: colors.maroon,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 8,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
