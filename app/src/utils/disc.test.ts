// Assertions come straight from PORT_PLAN.md §0A (Stability Classification Fixtures).
import { stab, discType, stabShort } from './disc';

describe('stab (Phase 0 §0A fixtures)', () => {
  it.each([
    ['Aviar', { turn: 0, fade: 1 }, 'overstable'],
    ['Leopard3', { turn: -2, fade: 1 }, 'understable'],
    ['Destroyer', { turn: -1, fade: 3 }, 'overstable'],
    ['Sonic (putter)', { turn: 0, fade: 4 }, 'overstable'],
    ['Roadrunner', { turn: -4, fade: 1 }, 'understable'],
    ['Buzz', { turn: -1, fade: 2 }, 'overstable'],
    ['River', { turn: -1, fade: 1 }, 'stable'],
  ] as const)('%s -> %s', (_name, disc, expected) => {
    expect(stab(disc)).toBe(expected);
  });
});

describe('discType', () => {
  it.each([
    [2, 'putter'],
    [3, 'putter'],
    [4, 'mid'],
    [5, 'mid'],
    [6, 'fairway'],
    [8, 'fairway'],
    [9, 'driver'],
    [12, 'driver'],
  ] as const)('speed %d -> %s', (speed, expected) => {
    expect(discType({ speed })).toBe(expected);
  });
});

describe('stabShort', () => {
  it('matches the OS/ST/US thresholds used by stab()', () => {
    expect(stabShort(1)).toBe('OS');
    expect(stabShort(0)).toBe('ST');
    expect(stabShort(-1)).toBe('US');
  });
});
