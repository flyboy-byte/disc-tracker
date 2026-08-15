// B1 — unified disc-suggestion scoring model (step 3).
//
// Replaces the old two-path logic (raw bagTest thresholds for the bag; stability-scalar filter +
// |stability - mid| sort for the library) with ONE scorer used for both bag and library discs.
// The model, ideal profiles, and skill presets are documented (and Logan-blessed) in
// plan/docs/suggest-model.md — this file is the executable form of that doc. The CLAUDE.md
// "don't change suggestion behavior" guard is explicitly lifted for this workstream
// (see plan/docs/direction-2026-07-29.md).
//
// turn uses the disc-golf sign convention: 0 = overstable-neutral, negative = understable
// (e.g. -3 very understable). fade is 0..5, positive.

import type { ScenarioDisc } from './disc';

export type SkillPreset = 'beginner' | 'intermediate' | 'advanced';
export type Band = 'great' | 'good' | 'marginal';

export interface Scored {
  disc: ScenarioDisc;
  score: number;
  band: Band;
}

interface FieldTarget {
  target: number;
  tol: number;
  wt: number;
  // Optional one-sided falloff. `tolHi` widens tolerance for actual > target (overshoot OK),
  // `tolLo` for actual < target (undershoot OK). Both default to `tol` (symmetric). This is
  // how "for a hyzer, MORE fade is still fine" or "for max distance, LESS fade is fine" is
  // encoded without penalizing the generous direction.
  tolLo?: number;
  tolHi?: number;
}
interface Profile {
  speed: FieldTarget;
  glide: FieldTarget;
  turn: FieldTarget;
  fade: FieldTarget;
}

// Authored at the Intermediate baseline. Mirrors the table in plan/docs/suggest-model.md;
// keep the two in lockstep.
// One-sided tolerances (tolLo/tolHi) encode the disc-golf asymmetries: for an overstable
// scenario MORE fade is still fine (fade.tolHi wide); for max distance LESS fade is fine
// (fade.tolLo wide); for understable scenarios MORE understable is fine (turn.tolLo wide, since
// more-understable = more-negative = below target). Symmetric where both directions genuinely
// break the shot (e.g. Dead Straight, Hyzer Flip). Mirrors plan/docs/suggest-model.md.
export const PROFILES: Record<string, Profile> = {
  straight:     { speed: { target: 7,  tol: 4,   wt: 0.5 }, glide: { target: 5, tol: 2, wt: 1   }, turn: { target: -1,   tol: 1,   wt: 2   },            fade: { target: 1,   tol: 1,   wt: 2   } },
  hyzer:        { speed: { target: 9,  tol: 4,   wt: 0.5 }, glide: { target: 4, tol: 2, wt: 0.5 }, turn: { target: 0,    tol: 1,   wt: 1   },            fade: { target: 3.5, tol: 1,   wt: 2.5, tolHi: 3   } },
  distance:     { speed: { target: 13, tol: 2,   wt: 1.5 }, glide: { target: 6, tol: 1, wt: 1.5 }, turn: { target: -1.5, tol: 1.5, wt: 1, tolLo: 2 },   fade: { target: 1.5, tol: 1,   wt: 0.5, tolLo: 2   } },
  headwind:     { speed: { target: 9,  tol: 3,   wt: 0.5 }, glide: { target: 3, tol: 2, wt: 0.5 }, turn: { target: 0,    tol: 1,   wt: 1.5 },            fade: { target: 4,   tol: 1,   wt: 2.5, tolHi: 2   } },
  tailwind:     { speed: { target: 10, tol: 3,   wt: 0.5 }, glide: { target: 5, tol: 2, wt: 1   }, turn: { target: -2.5, tol: 1,   wt: 2, tolLo: 1.5 }, fade: { target: 0.5, tol: 1,   wt: 1   } },
  turnover:     { speed: { target: 9,  tol: 3,   wt: 0.5 }, glide: { target: 5, tol: 2, wt: 1   }, turn: { target: -3.5, tol: 1,   wt: 2.5, tolLo: 1.5 }, fade: { target: 0.5, tol: 1,   wt: 1   } },
  forehand:     { speed: { target: 9,  tol: 4,   wt: 0.5 }, glide: { target: 4, tol: 2, wt: 0.5 }, turn: { target: 0,    tol: 1,   wt: 2   },            fade: { target: 2.5, tol: 1.5, wt: 1,   tolHi: 2   } },
  tomahawk:     { speed: { target: 11, tol: 3,   wt: 1   }, glide: { target: 3, tol: 2, wt: 0.5 }, turn: { target: 0,    tol: 1.5, wt: 1   },            fade: { target: 3.5, tol: 1.5, wt: 2,   tolHi: 2   } },
  approach:     { speed: { target: 4,  tol: 2,   wt: 1.5 }, glide: { target: 4, tol: 2, wt: 0.5 }, turn: { target: 0,    tol: 1.5, wt: 1   },            fade: { target: 1.5, tol: 1,   wt: 1.5, tolLo: 1.5 } },
  accurate_mid: { speed: { target: 5,  tol: 1.5, wt: 1.5 }, glide: { target: 5, tol: 2, wt: 0.5 }, turn: { target: -0.5, tol: 1,   wt: 1   },            fade: { target: 1.5, tol: 1,   wt: 1.5 } },
  hyzerflip:    { speed: { target: 9,  tol: 3,   wt: 1   }, glide: { target: 6, tol: 1, wt: 1   }, turn: { target: -2.5, tol: 1,   wt: 2   },            fade: { target: 1,   tol: 1,   wt: 1   } },
  roller:       { speed: { target: 10, tol: 3,   wt: 0.5 }, glide: { target: 6, tol: 1, wt: 1   }, turn: { target: -4,   tol: 1,   wt: 2.5, tolLo: 1.5 }, fade: { target: 0.5, tol: 1,   wt: 1   } },
  // Flex Shot (added post-B1): flat/anhyzer release that turns over at speed then fades back
  // straight — distinct from turnover (holds the anhyzer, barely fades) and hyzerflip (starts
  // hyzer, flips flat at fairway/mid speed). tolLo on turn: more understable still flexes fine;
  // tolHi on fade: a touch more fade still brings it back, it just doesn't hold turned as long.
  flex:         { speed: { target: 12, tol: 3,   wt: 1   }, glide: { target: 5, tol: 1.5, wt: 0.5 }, turn: { target: -2, tol: 1, wt: 2, tolLo: 1.5 }, fade: { target: 2, tol: 1, wt: 1.5, tolHi: 1.5 } },
};

interface PresetCfg {
  speedCap: number;
  stabilityBias: number; // shifts the turn target (negative = nudge understable)
  glideBias: number;
}
export const PRESETS: Record<SkillPreset, PresetCfg> = {
  beginner:     { speedCap: 9,  stabilityBias: -0.5, glideBias: 0.5 },
  intermediate: { speedCap: 13, stabilityBias: 0,    glideBias: 0   },
  advanced:     { speedCap: 14, stabilityBias: 0.5,  glideBias: 0   },
};

// Throw style is a modifier applied on top of whichever scenario is active, not a scenario of
// its own — a forehand thrower doesn't just want "the Forehand scenario," they forehand
// turnovers, hyzer flips, flex shots, power hyzers, etc. Forehand power naturally overpowers
// turn and benefits from a touch more fade for control, so both targets nudge toward overstable
// (same additive-bias mechanism as PRESETS' stabilityBias/glideBias, just a second, independent
// axis). Backhand is the authored baseline — its bias is a deliberate no-op.
export type ThrowStyle = 'backhand' | 'forehand';
interface ThrowStyleCfg {
  turnBias: number;
  fadeBias: number;
}
export const THROW_STYLE_BIAS: Record<ThrowStyle, ThrowStyleCfg> = {
  backhand: { turnBias: 0, fadeBias: 0 },
  forehand: { turnBias: 0.5, fadeBias: 0.5 },
};

const BAND_GREAT = 0.75;
const BAND_GOOD = 0.55;
const BAND_MARGINAL = 0.35;

function fieldScore(actual: number, t: FieldTarget): number {
  const tol = actual >= t.target ? t.tolHi ?? t.tol : t.tolLo ?? t.tol;
  return Math.max(0, 1 - Math.abs(actual - t.target) / tol);
}

// Soft arm-speed gate: 1.0 at/below the cap, ramping down to a 0.3 floor by cap+3. A too-fast
// disc is demoted, never hard-excluded (fixes the baseline's brittle exclusions).
function speedCapPenalty(speed: number, cap: number): number {
  if (speed <= cap) return 1;
  return Math.max(0.3, 1 - ((speed - cap) / 3) * 0.7);
}

/** Score a disc 0..1 for a scenario at a skill level. Unknown scenario → 0. */
export function score(disc: ScenarioDisc, scenarioId: string, skill: SkillPreset, throwStyle: ThrowStyle = 'backhand'): number {
  const p = PROFILES[scenarioId];
  if (!p) return 0;
  const preset = PRESETS[skill];
  const throwBias = THROW_STYLE_BIAS[throwStyle];

  // Apply the preset's + throw-style's gentle biases on top of the authored (Intermediate,
  // Backhand) targets. Both are additive nudges on the same target — they compose rather than
  // fight (e.g. an advanced forehand thrower stacks both overstable nudges).
  const turnT: FieldTarget = { ...p.turn, target: p.turn.target + preset.stabilityBias + throwBias.turnBias };
  const glideT: FieldTarget = { ...p.glide, target: p.glide.target + preset.glideBias };
  const fadeT: FieldTarget = { ...p.fade, target: p.fade.target + throwBias.fadeBias };

  const num =
    p.speed.wt * fieldScore(disc.speed, p.speed) +
    glideT.wt * fieldScore(disc.glide, glideT) +
    turnT.wt * fieldScore(disc.turn, turnT) +
    fadeT.wt * fieldScore(disc.fade, fadeT);
  const den = p.speed.wt + glideT.wt + turnT.wt + fadeT.wt;
  const raw = num / den;

  return raw * speedCapPenalty(disc.speed, preset.speedCap);
}

export function bandFor(s: number): Band | null {
  if (s >= BAND_GREAT) return 'great';
  if (s >= BAND_GOOD) return 'good';
  if (s >= BAND_MARGINAL) return 'marginal';
  return null;
}

/**
 * Rank discs for a scenario at a skill level. Keeps only discs that reach at least the
 * `marginal` band. Deterministic order across JS engines: score desc, then closeness to the
 * scenario's target speed, then name — no reliance on sort stability (fixes baseline finding #2).
 */
export function rankDiscs(
  discs: ScenarioDisc[],
  scenarioId: string,
  skill: SkillPreset,
  limit = 15,
  throwStyle: ThrowStyle = 'backhand'
): Scored[] {
  const p = PROFILES[scenarioId];
  if (!p) return [];
  const scored: Scored[] = [];
  for (const disc of discs) {
    const s = score(disc, scenarioId, skill, throwStyle);
    const band = bandFor(s);
    if (band) scored.push({ disc, score: s, band });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = Math.abs(a.disc.speed - p.speed.target);
    const db = Math.abs(b.disc.speed - p.speed.target);
    if (da !== db) return da - db;
    return a.disc.name.localeCompare(b.disc.name);
  });
  return scored.slice(0, limit);
}
