// Ported 1:1 from the PWA's styles/theme.css brand tokens.
export const colors = {
  maroon: '#8B2626',
  orange: '#EF6905',
  cream: '#F1E5A1',
  green: '#486C2F',

  background: '#FFFDF7',
  surface: '#FFFFFF',
  border: '#E6DCB8',
  text: '#2A2118',
  textMuted: '#7A6F5C',
  danger: '#B3261E',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;
