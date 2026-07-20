// Assertions come straight from PORT_PLAN.md §0B (Distance) and §0C (Adjusted Stability),
// both corrected against the real source during Phase 0 — see the plan doc for the
// verification note on the distance table (rounding) and the Leopard3 fix (§0D, N/A here).
import { estimateDist, applyModifiers } from './legacyPhysics';
import { stab } from './disc';

describe('estimateDist (Phase 0 §0B fixtures)', () => {
  it.each([
    ['Aviar spd2', { speed: 2 }, 100, 0, 3, 0, 0, 120],
    ['Leopard3 spd7', { speed: 7 }, 100, 0, 5, 0, 0, 260],
    ['Destroyer spd12', { speed: 12 }, 100, 0, 5, 0, 0, 380],
    ['Destroyer 50% arm', { speed: 12 }, 50, 0, 5, 0, 0, 190],
    ['Destroyer +15 headwind', { speed: 12 }, 100, 15, 5, 0, 0, 330],
    ['Destroyer +10 nose', { speed: 12 }, 100, 0, 5, 10, 0, 320],
    ['Destroyer +30 hyzer', { speed: 12 }, 100, 0, 5, 0, 30, 310],
  ] as const)('%s -> %dft', (_name, base, arm, wind, glide, nose, hyzer, expected) => {
    expect(estimateDist(base, arm, wind, glide, nose, hyzer)).toBe(expected);
  });
});

describe('applyModifiers + stab (Phase 0 §0C fixtures)', () => {
  it.each([
    [
      'Destroyer 100/0/0/0/100',
      { speed: 12, glide: 5, turn: -1, fade: 3 },
      { hyzer: 0, nose: 0, wind: 0, armSpeed: 100, spin: 100 },
      'overstable',
    ],
    [
      'Destroyer 40% arm (underpowered)',
      { speed: 12, glide: 5, turn: -1, fade: 3 },
      { hyzer: 0, nose: 0, wind: 0, armSpeed: 40, spin: 100 },
      'overstable', // "More OS" than the 100%-arm baseline — both are already OS, see net comparison below
    ],
    [
      'Roadrunner 100/0/0/0/100',
      { speed: 9, glide: 5, turn: -4, fade: 1 },
      { hyzer: 0, nose: 0, wind: 0, armSpeed: 100, spin: 100 },
      'understable',
    ],
    [
      'Roadrunner +20 hyzer (counters turn)',
      { speed: 9, glide: 5, turn: -4, fade: 1 },
      { hyzer: 20, nose: 0, wind: 0, armSpeed: 100, spin: 100 },
      'stable',
    ],
    [
      'Roadrunner +15 headwind (reveals turn)',
      { speed: 9, glide: 5, turn: -4, fade: 1 },
      { hyzer: 0, nose: 0, wind: 15, armSpeed: 100, spin: 100 },
      'understable',
    ],
    [
      'Leopard3 30% spin (less gyro)',
      { speed: 7, glide: 5, turn: -2, fade: 1 },
      { hyzer: 0, nose: 0, wind: 0, armSpeed: 100, spin: 30 },
      'understable',
    ],
  ] as const)('%s -> %s', (_name, base, sliders, expected) => {
    const adj = applyModifiers(base, sliders);
    expect(stab(adj)).toBe(expected);
  });

  it('underpowering a fast disc pushes it further overstable (Destroyer 40% vs 100% arm)', () => {
    const base = { speed: 12, glide: 5, turn: -1, fade: 3 };
    const full = applyModifiers(base, { hyzer: 0, nose: 0, wind: 0, armSpeed: 100, spin: 100 });
    const underpowered = applyModifiers(base, { hyzer: 0, nose: 0, wind: 0, armSpeed: 40, spin: 100 });
    expect(underpowered.turn + underpowered.fade).toBeGreaterThan(full.turn + full.fade);
  });

  it('hyzer counters turn on an understable disc (Roadrunner net moves toward zero)', () => {
    const base = { speed: 9, glide: 5, turn: -4, fade: 1 };
    const flat = applyModifiers(base, { hyzer: 0, nose: 0, wind: 0, armSpeed: 100, spin: 100 });
    const hyzered = applyModifiers(base, { hyzer: 20, nose: 0, wind: 0, armSpeed: 100, spin: 100 });
    expect(hyzered.turn + hyzered.fade).toBeGreaterThan(flat.turn + flat.fade);
  });

  it('headwind reveals more turn on an understable disc (Roadrunner net moves more negative)', () => {
    const base = { speed: 9, glide: 5, turn: -4, fade: 1 };
    const calm = applyModifiers(base, { hyzer: 0, nose: 0, wind: 0, armSpeed: 100, spin: 100 });
    const windy = applyModifiers(base, { hyzer: 0, nose: 0, wind: 15, armSpeed: 100, spin: 100 });
    expect(windy.turn + windy.fade).toBeLessThan(calm.turn + calm.fade);
  });
});
