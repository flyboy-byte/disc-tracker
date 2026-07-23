// Ported verbatim from DISC_COLORS in templates/index.html.
export interface DiscColorOption {
  hex: string;
  label?: string;
}

export const DISC_COLORS: DiscColorOption[] = [
  { hex: '' },
  { hex: '#ffffff', label: 'White' },
  { hex: '#fef08a', label: 'Yellow' },
  { hex: '#fde047', label: 'Gold' },
  { hex: '#fb923c', label: 'Orange' },
  { hex: '#f87171', label: 'Red' },
  { hex: '#e11d48', label: 'Crimson' },
  { hex: '#f9a8d4', label: 'Pink' },
  { hex: '#e879f9', label: 'Magenta' },
  { hex: '#c084fc', label: 'Purple' },
  { hex: '#818cf8', label: 'Indigo' },
  { hex: '#60a5fa', label: 'Blue' },
  { hex: '#22d3ee', label: 'Cyan' },
  { hex: '#34d399', label: 'Green' },
  { hex: '#a3e635', label: 'Lime' },
  { hex: '#94a3b8', label: 'Gray' },
  { hex: '#475569', label: 'Slate' },
  { hex: '#1e293b', label: 'Black' },
];
