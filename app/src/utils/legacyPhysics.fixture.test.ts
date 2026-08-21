// PLAN.md Track D — loads the SAME fixture file physics.fixture.test.js (website side) checks
// against static/physics.js, and asserts legacyPhysics.ts (this port) reproduces every vector.
// Extends the existing parity pattern already proven in src/physics/sim/parity.test.ts, applied
// here to the flight-arc/stability math instead of the physics-sim engine. A mismatch means
// legacyPhysics.ts has drifted from its own stated contract ("exact port of static/physics.js"
// — see the file's own header comment), not a fixture problem.
import fixture from '../../../fixtures/flight-arc-vectors.json';
import { arcPoints, applyModifiers } from './legacyPhysics';
import { stab } from './disc';

const EPS = 1e-6;

function expectCloseDeep(got: unknown, want: unknown, path: string) {
  if (typeof want === 'number') {
    expect(typeof got).toBe('number');
    expect(Math.abs((got as number) - want)).toBeLessThan(EPS);
    return;
  }
  if (want && typeof want === 'object') {
    for (const key of Object.keys(want as Record<string, unknown>)) {
      expectCloseDeep((got as Record<string, unknown>)[key], (want as Record<string, unknown>)[key], `${path}.${key}`);
    }
    return;
  }
  expect(got).toBe(want);
}

describe('legacyPhysics.ts parity vs. the canonical static/physics.js fixture', () => {
  for (const v of fixture.vectors as Array<Record<string, any>>) {
    it(`reproduces "${v.name}" (${v.kind})`, () => {
      if (v.kind === 'stability') {
        expect(stab(v.input)).toBe(v.expected.stability);
        return;
      }
      const { disc, sliders, W, H, arcView } = v.input;
      const adjusted = applyModifiers(disc, sliders);
      expectCloseDeep(adjusted, v.expected.adjusted, 'adjusted');
      const arc = arcPoints(adjusted, W, H, arcView);
      expectCloseDeep(arc, v.expected.arc, 'arc');
    });
  }
});
