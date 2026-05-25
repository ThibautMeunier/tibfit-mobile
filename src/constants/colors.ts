// Re-export design tokens so both Colors and C are usable from this module
export { Colors, Radii, FontSize, Spacing, Gradients } from './tokens';

export const C = {
  bg: '#0A0A0F',
  bg2: '#12121A',
  bg3: '#1A1A26',
  card: '#16161F',
  cardHover: '#1E1E2A',
  border: 'rgba(255,255,255,0.07)',
  blue: '#3B82F6',
  blueLight: 'rgba(59,130,246,0.15)',
  blueGlow: 'rgba(59,130,246,0.25)',
  green: '#16A34A',
  greenLight: 'rgba(22,163,74,0.15)',
  orange: '#F97316',
  orangeLight: 'rgba(249,115,22,0.15)',
  red: '#EF4444',
  yellow: '#EAB308',
  flame: '#FB923C',
  flameYel: '#FBBF24',
  orangeDeep: '#EA580C',
  text: '#F0F0F8',
  text2: 'rgba(240,240,248,0.6)',
  text3: 'rgba(240,240,248,0.35)',
} as const;

// Named session color palette — shared with LLM prompts
export const SESSION_COLORS: { name: string; hex: string }[] = [
  { name: 'bleu',   hex: '#3B82F6' },
  { name: 'violet', hex: '#8B5CF6' },
  { name: 'rose',   hex: '#EC4899' },
  { name: 'rouge',  hex: '#EF4444' },
  { name: 'orange', hex: '#F97316' },
  { name: 'jaune',  hex: '#EAB308' },
  { name: 'vert',   hex: '#16A34A' },
  { name: 'cyan',   hex: '#06B6D4' },
];

export function sessionColor(couleur: string | null | undefined): string {
  if (!couleur) return SESSION_COLORS[0].hex;
  return SESSION_COLORS.find((c) => c.name === couleur)?.hex ?? SESSION_COLORS[0].hex;
}

export const ZONE_COLORS: Record<string, string> = {
  Z1: '#94A3B8',
  Z2: C.green,
  Z3: '#EAB308',
  Z4: C.orange,
  Z5: C.red,
};
