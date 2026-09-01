// Color tokens ported 1:1 from the website's static/style.css :root block.
// Keep these in sync by hand — there's no shared build step between the two.
export const colors = {
  bg: '#0b0e1a',
  card: '#141829',
  cardHover: '#1a1f36',
  border: '#252b45',
  text: '#e8eaf2',
  muted: '#8b91ad',
  accent: '#915EFF',
  os: '#915EFF',
  st: '#4ade80',
  us: '#fbbf24',
  danger: '#f87171',
  sim: '#38bdf8',
} as const;

// Selected-state fills for the two "pick one of N" control families (ui-audit-plan.md T2-1).
// Both are `accent` at a fixed alpha — written out longhand rather than composed at runtime so
// they stay greppable and match what the five hand-rolled treatments they replace already used
// (0.16 for segmented controls, 0.28 for the heavier filter pills).
export const tints = {
  accentTint: 'rgba(145,94,255,0.16)',
  accentTintStrong: 'rgba(145,94,255,0.28)',
} as const;

export const opacity = {
  op1: 0.5,
  op2: 0.7,
  op3: 0.85,
} as const;

// Subtle purple gradient for primary CTAs / active surfaces — a light violet → deep purple
// diagonal that adds depth without leaving the established accent identity. Endpoints bracket
// `accent` (#915EFF) so a flat-accent fallback anywhere still reads as the same colour.
export const gradients = {
  accent: ['#A574FF', '#7C48F0'] as const,
} as const;
