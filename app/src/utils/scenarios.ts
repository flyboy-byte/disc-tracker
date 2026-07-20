// Exact port of the SCENARIOS array and filter logic in templates/discsuggestion.html.
// Do not change any bagTest predicate or threshold without proving a bug against the live
// website first (see CLAUDE.md) — these were hand-verified against the real site during
// Phase 0 (see PORT_PLAN.md §0D).

import type { Disc, ScenarioDisc } from './disc';

export interface Scenario {
  id: string;
  icon: string;
  title: string;
  desc: string;
  stabMin?: number;
  stabMax?: number;
  speedMin?: number;
  types?: string[];
  bagTest: (d: Disc) => boolean;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'straight',
    icon: '➡',
    title: 'Dead Straight',
    desc: "Turn and fade cancel out — holds the line",
    stabMin: -1,
    stabMax: 1,
    types: ['Control Driver', 'Mid Range'],
    bagTest: (d) => d.fade + d.turn >= -1 && d.fade + d.turn <= 1 && d.speed >= 4,
  },
  {
    id: 'hyzer',
    icon: '↙',
    title: 'Reliable Hyzer',
    desc: "Finishes hard left, won't turn over",
    stabMin: 2,
    types: ['Control Driver', 'Distance Driver', 'Mid Range'],
    bagTest: (d) => d.fade >= 3 && d.turn >= -1,
  },
  {
    id: 'distance',
    icon: '🚀',
    title: 'Max Distance',
    desc: 'Turns and carries — not a fade pile-driver',
    stabMin: -1,
    stabMax: 2,
    speedMin: 11,
    bagTest: (d) => d.speed >= 11 && d.fade <= 3 && d.turn <= -0.5,
  },
  {
    id: 'headwind',
    icon: '🌬',
    title: 'Into Headwind',
    desc: "Won't flip even in a strong headwind",
    stabMin: 2.5,
    types: ['Control Driver', 'Distance Driver'],
    bagTest: (d) => d.fade >= 3 && d.turn >= -0.5 && d.speed >= 7,
  },
  {
    id: 'tailwind',
    icon: '💨',
    title: 'Tailwind',
    desc: 'Tailwind makes discs fly OS — go understable to compensate',
    stabMin: -2,
    stabMax: 0,
    speedMin: 9,
    types: ['Control Driver', 'Distance Driver'],
    bagTest: (d) => d.speed >= 9 && d.turn <= -1 && d.fade + d.turn <= 0,
  },
  {
    id: 'turnover',
    icon: '↗',
    title: 'Turnover',
    desc: 'Holds an anhyzer — turns and stays turned',
    stabMax: -1.5,
    types: ['Control Driver', 'Distance Driver'],
    bagTest: (d) => d.turn <= -2 && d.fade <= 2 && d.fade + d.turn <= -1,
  },
  {
    id: 'forehand',
    icon: '✋',
    title: 'Forehand',
    desc: "Won't flip on a sidearm release",
    stabMin: 2,
    types: ['Control Driver', 'Distance Driver', 'Mid Range'],
    bagTest: (d) => d.fade >= 2 && d.turn >= -0.5 && d.speed >= 6,
  },
  {
    id: 'tomahawk',
    icon: '🪓',
    title: 'Tomahawk',
    desc: 'High fade spikes; slight US carries farther inverted',
    stabMin: 1,
    stabMax: 4,
    types: ['Control Driver', 'Distance Driver'],
    bagTest: (d) => d.speed >= 7 && d.fade >= 2 && d.turn >= -2,
  },
  {
    id: 'approach',
    icon: '🎯',
    title: 'Approach',
    desc: 'Controlled & accurate into the green',
    stabMin: -1,
    stabMax: 2.5,
    types: ['Putt & Approach', 'Mid Range'],
    bagTest: (d) => d.speed <= 6 && d.fade <= 3 && d.turn >= -2 && d.fade + d.turn >= -1,
  },
  {
    id: 'accurate_mid',
    icon: '⊙',
    title: 'Accurate Mid',
    desc: 'Predictable mid — slight fade, hits the gap',
    stabMin: 0,
    stabMax: 2,
    types: ['Mid Range'],
    bagTest: (d) => d.speed >= 4 && d.speed <= 6 && d.fade + d.turn >= 0 && d.fade + d.turn <= 2,
  },
  {
    id: 'hyzerflip',
    icon: '↪',
    title: 'Hyzer Flip',
    desc: 'Starts hyzer, flips flat, holds straight',
    stabMin: -2,
    stabMax: 0,
    types: ['Control Driver', 'Distance Driver'],
    bagTest: (d) =>
      d.speed >= 7 && d.speed <= 12 && d.turn <= -1 && d.turn >= -2 && d.fade >= 1 && d.fade <= 2 && d.fade + d.turn <= 0,
  },
  {
    id: 'roller',
    icon: '⟳',
    title: 'Roller',
    desc: 'Very US with low fade — runs straight on the ground',
    stabMax: -2.5,
    types: ['Control Driver', 'Distance Driver'],
    bagTest: (d) => d.turn <= -3 && d.fade <= 1,
  },
];

export function filterBag(sc: Scenario, bagDiscs: Disc[]): Disc[] {
  return bagDiscs.filter((d) => sc.bagTest(d));
}

export function filterLibrary(sc: Scenario, allDiscs: ScenarioDisc[]): ScenarioDisc[] {
  return allDiscs
    .filter((d) => {
      if (sc.stabMin !== undefined && d.stability < sc.stabMin) return false;
      if (sc.stabMax !== undefined && d.stability > sc.stabMax) return false;
      if (sc.speedMin !== undefined && d.speed < sc.speedMin) return false;
      if (sc.types && !sc.types.includes(d.type)) return false;
      return true;
    })
    .sort((a, b) => {
      const mid = ((sc.stabMin ?? -4) + (sc.stabMax ?? 7)) / 2;
      return Math.abs(a.stability - mid) - Math.abs(b.stability - mid);
    })
    .slice(0, 15);
}
