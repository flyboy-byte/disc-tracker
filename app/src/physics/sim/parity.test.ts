// Parity harness: the TS shotshaper port must reproduce the REAL vendored engine's trajectories.
// Fixtures in __fixtures__/ are generated from vendor/shotshaper (numpy/scipy) by
// app/plan/tools/gen_physics_fixtures.py. If this passes, the port is faithful to the validated
// model — which is the whole reason to port rather than hand-wave. Tolerances are tight (cm-scale
// on trajectories that run tens of metres): the two engines agree to well within display accuracy.
import { DiscGolfDisc } from './discGolfDisc';
import { defaultEnvironment } from './environment';
import type { Vec3 } from './linalg';
import { shoot, simulateShot } from './simulateShot';
import type { Archetype } from './coeffs';
import engineFixtures from './__fixtures__/engine.json';
import serverFixtures from './__fixtures__/server.json';

interface EngineCase {
  params: {
    archetype: Archetype;
    mass_kg: number;
    speed: number;
    omega: number;
    pitch: number;
    nose: number;
    roll: number;
    uref: number;
    winddir: [number, number, number];
  };
  result: { t_end: number; x: number[]; y: number[]; z: number[] };
}

interface ServerCase {
  params: {
    archetype: Archetype;
    pdgaSpeed: number;
    hyzer: number;
    nose: number;
    wind: number;
    crosswind: number;
    armSpeed: number;
    spin: number;
    arcView: 'RHBH' | 'RHFH' | 'LHBH' | 'LHFH';
    weightG: number;
  };
  points: [number, number][];
}

// Max abs deviation across a coordinate array.
function maxAbsDiff(a: number[], b: number[]): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

describe('shotshaper port — engine-level parity vs. vendored numpy/scipy', () => {
  const cases = engineFixtures as unknown as Record<string, EngineCase>;

  for (const [name, c] of Object.entries(cases)) {
    it(`matches the reference trajectory: ${name}`, () => {
      const env = defaultEnvironment();
      env.Uref = c.params.uref;
      env.winddir = c.params.winddir as Vec3;
      const disc = new DiscGolfDisc(c.params.archetype, c.params.mass_kg, env);
      const traj = shoot(disc, {
        speed: c.params.speed,
        omega: c.params.omega,
        pitch: c.params.pitch,
        nose_angle: c.params.nose,
        roll_angle: c.params.roll,
        position: [0, 0, 1.3],
      });

      // Flight time to the same landing.
      expect(traj.tEnd).toBeCloseTo(c.result.t_end, 3);
      // Trajectory agreement: within 5 cm anywhere along paths that fly 30-90 m.
      expect(maxAbsDiff(traj.x, c.result.x)).toBeLessThan(0.05);
      expect(maxAbsDiff(traj.y, c.result.y)).toBeLessThan(0.05);
      expect(maxAbsDiff(traj.z, c.result.z)).toBeLessThan(0.05);
    });
  }
});

describe('shotshaper port — end-to-end orchestration parity vs. /api/shotshaper_sim', () => {
  const cases = serverFixtures as unknown as Record<string, ServerCase>;

  for (const [name, c] of Object.entries(cases)) {
    it(`matches the reference points: ${name}`, () => {
      const { points } = simulateShot(c.params);
      expect(points.length).toBe(c.points.length);
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const refX = c.points.map((p) => p[0]);
      const refY = c.points.map((p) => p[1]);
      // Server rounds to 2 dp; allow 5 cm for float-path divergence on top of that.
      expect(maxAbsDiff(xs, refX)).toBeLessThan(0.05);
      expect(maxAbsDiff(ys, refY)).toBeLessThan(0.05);
    });
  }
});
