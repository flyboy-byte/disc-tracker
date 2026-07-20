// Exact port of the stability/type classification logic in static/physics.js and the
// helper functions in templates/discsuggestion.html. Do not change formulas here — if a
// bug is found, prove it against the live website first (see CLAUDE.md).

export interface Disc {
  id?: number;
  mfr: string;
  mold: string;
  plastic?: string;
  weight?: string;
  speed: number;
  glide: number;
  turn: number;
  fade: number;
  use?: string;
  thr?: string;
  notes?: string;
  color?: string;
  inBag?: boolean;
}

export type Stability = 'overstable' | 'stable' | 'understable';
export type DiscType = 'putter' | 'mid' | 'fairway' | 'driver';

export const STAB_META: Record<Stability, { short: string; cls: string; color: string }> = {
  overstable: { short: 'OS', cls: 'stab-os', color: '#915EFF' },
  stable: { short: 'ST', cls: 'stab-st', color: '#4ade80' },
  understable: { short: 'US', cls: 'stab-us', color: '#fbbf24' },
};

export function stab(d: Pick<Disc, 'turn' | 'fade'>): Stability {
  const net = (d.turn ?? 0) + (d.fade ?? 0);
  if (net >= 1) return 'overstable';
  if (net <= -1) return 'understable';
  return 'stable';
}

export const TYPE_META: Record<DiscType, { short: string; label: string; word: string }> = {
  putter: { short: 'P', label: 'Putter', word: 'Putter' },
  mid: { short: 'M', label: 'Mid', word: 'Mid-range' },
  fairway: { short: 'FD', label: 'Fairway', word: 'Fairway Driver' },
  driver: { short: 'D', label: 'Driver', word: 'Distance Driver' },
};

export function discType(d: Pick<Disc, 'speed'>): DiscType {
  if (d.speed <= 3) return 'putter';
  if (d.speed <= 5) return 'mid';
  if (d.speed <= 8) return 'fairway';
  return 'driver';
}

// Ported from discsuggestion.html — net-value stability bucketing used by the scenario UI's
// bar/badge, independent of the STAB_META table above (same thresholds, different scale used
// for the -4..+7 stability bar).
export function stabClass(stability: number): 'stab-os' | 'stab-st' | 'stab-us' {
  if (stability >= 1) return 'stab-os';
  if (stability <= -1) return 'stab-us';
  return 'stab-st';
}

export function stabShort(stability: number): 'OS' | 'ST' | 'US' {
  if (stability >= 1) return 'OS';
  if (stability <= -1) return 'US';
  return 'ST';
}

// Master library's own type taxonomy (from discs_master.json) — distinct vocabulary from
// this file's putter/mid/fairway/driver keys, so translate rather than duplicate.
export const MASTER_TYPE_LABEL: Record<DiscType, string> = {
  putter: 'Putt & Approach',
  mid: 'Mid Range',
  fairway: 'Control Driver',
  driver: 'Distance Driver',
};

export function typeShort(type: string): string {
  if (type === 'Putt & Approach') return 'Putter';
  if (type === 'Mid Range') return 'Mid';
  if (type === 'Control Driver') return 'Fairway';
  if (type === 'Distance Driver') return 'Driver';
  return type;
}

export interface ScenarioDisc {
  name: string;
  mfr: string;
  type: string;
  stability: number;
  speed: number;
  glide: number;
  turn: number;
  fade: number;
}

// Convert a bag disc to the shape the scenario/library screens compare against.
export function bagToDisc(d: Disc): ScenarioDisc {
  return {
    name: d.mold,
    mfr: d.mfr,
    type: MASTER_TYPE_LABEL[discType(d)],
    stability: Math.round(((d.fade ?? 0) + (d.turn ?? 0)) * 10) / 10,
    speed: d.speed,
    glide: d.glide,
    turn: d.turn,
    fade: d.fade,
  };
}
