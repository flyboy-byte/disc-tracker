// Assertions come straight from PORT_PLAN.md §0D (Scenario Filter Fixtures), including the
// Leopard3/Turnover correction made during Phase 0 (was wrongly marked ❌, is actually ✅).
import { SCENARIOS } from './scenarios';
import type { Disc } from './disc';

const TEST_DISCS: Record<'A' | 'B' | 'C' | 'D' | 'E', Disc> = {
  A: { mfr: '', mold: 'Aviar', speed: 2, glide: 3, turn: 0, fade: 1 },
  B: { mfr: '', mold: 'Buzz', speed: 5, glide: 4, turn: -1, fade: 2 },
  C: { mfr: '', mold: 'Leopard3', speed: 7, glide: 5, turn: -2, fade: 1 },
  D: { mfr: '', mold: 'Destroyer', speed: 12, glide: 5, turn: -1, fade: 3 },
  E: { mfr: '', mold: 'Roadrunner', speed: 9, glide: 5, turn: -4, fade: 1 },
};

// [scenarioId, {disc: expectedMatch}]
const EXPECTED: [string, Partial<Record<keyof typeof TEST_DISCS, boolean>>][] = [
  ['straight', { A: false, B: true, C: true, D: false, E: false }],
  ['hyzer', { A: false, B: false, C: false, D: true, E: false }],
  ['distance', { A: false, B: false, C: false, D: true, E: false }],
  ['tailwind', { A: false, B: false, C: false, D: false, E: true }],
  ['turnover', { A: false, B: false, C: true, D: false, E: true }],
  ['roller', { A: false, B: false, C: false, D: false, E: true }],
];

describe('scenario bagTest predicates (Phase 0 §0D fixtures)', () => {
  it.each(EXPECTED)('%s', (scenarioId, expectations) => {
    const sc = SCENARIOS.find((s) => s.id === scenarioId);
    expect(sc).toBeDefined();
    for (const [key, expected] of Object.entries(expectations) as [keyof typeof TEST_DISCS, boolean][]) {
      expect(sc!.bagTest(TEST_DISCS[key])).toBe(expected);
    }
  });
});

it('SCENARIOS has all 12 scenarios from the website, not just the 6 sampled above', () => {
  expect(SCENARIOS).toHaveLength(12);
});
