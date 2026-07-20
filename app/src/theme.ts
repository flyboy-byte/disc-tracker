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

export const opacity = {
  op1: 0.5,
  op2: 0.7,
  op3: 0.85,
} as const;
