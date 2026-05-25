// Design tokens — TibFit UI Kit. Source of truth for all visual values.

export const Colors = {
  background:   '#06060A',
  surface:      '#12121A',
  surface2:     '#1A1A26',
  border:       'rgba(255,255,255,0.07)',
  borderSubtle: 'rgba(255,255,255,0.04)',

  text:      '#F0F0F8',
  textMuted: 'rgba(240,240,248,0.60)',
  textFaint: 'rgba(240,240,248,0.35)',
  textGhost: 'rgba(240,240,248,0.20)',

  blue:      '#3B82F6',
  indigo:    '#6366F1',
  green:     '#22C55E',
  greenDeep: '#16A34A',
  orange:    '#F97316',
  red:       '#EF4444',
  purple:    '#A855F7',
  yellow:    '#EAB308',
  cyan:      '#06B6D4',
  pink:      '#EC4899',
} as const;

export const Gradients = {
  primary: ['#3B82F6', '#6366F1'] as [string, string],
  streak:  ['#F97316', '#FF4D4D'] as [string, string],
} as const;

// r-pill=999, r-input=14, r-icon=10/12, r-card=16, r-sheet=20
export const Radii = {
  pill:   999,
  input:  14,
  iconSm: 10,
  iconMd: 12,
  card:   16,
  sheet:  20,
} as const;

// Button heights
export const ButtonHeight = { sm: 36, md: 48, lg: 56 } as const;
export const ButtonPaddingX = { sm: 14, md: 18, lg: 22 } as const;
export const ButtonIconGap = { sm: 6, md: 8, lg: 10 } as const;
export const ButtonFontSize = { sm: 14, md: 14, lg: 16 } as const;

export const FontSize = {
  display:      28,
  navTitle:     17,
  sheetTitle:   18,
  body:         15,
  bodySmall:    14,
  sectionLabel: 11,
  caption:      12,
} as const;

export const Spacing = {
  container:    20,
  containerMin: 16,
  gap:          10,
  gapSm:        8,
  gapLg:        12,
  sectionGap:   24,
  sectionGapSm: 20,
} as const;
