// Top-level shotshaper sim entry points, ported to run fully on-device (no server).
//   shoot()        — mirrors DiscGolfDisc.shoot + _Projectile._shoot: integrate, then resample the
//                    dense solution to N_STEP evenly-spaced points, exactly like the Python.
//   simulateShot() — mirrors app.py's /api/shotshaper_sim orchestration: turn the PDGA speed +
//                    slider values into launch speed / spin / mass / wind, run the sim, return the
//                    2-D [[x, y], …] point list the Flight Shaper draws.
// This is the app's replacement for the server round-trip — same inputs, same outputs, offline.
import { DiscGolfDisc } from './discGolfDisc';
import { defaultEnvironment, type Environment } from './environment';
import type { Vec3 } from './linalg';
import { integrate, type SimEvent } from './rk45';
import type { Archetype } from './coeffs';

const T_END = 60;
const N_STEP = 200;

// hit_ground: z crosses zero descending (terminal, direction -1). stopped: speed → 0 (terminal).
function events(): SimEvent[] {
  return [
    { fn: (_t, y) => y[2], terminal: true, direction: -1 },
    { fn: (_t, y) => Math.hypot(y[3], y[4], y[5]) - 1e-4, terminal: true, direction: -1 },
  ];
}

export interface Trajectory {
  tEnd: number;
  x: number[];
  y: number[];
  z: number[];
}

// Engine-level shot: explicit launch params, matches DiscGolfDisc.shoot(...). Used by the parity
// test and by simulateShot below.
export function shoot(
  disc: DiscGolfDisc,
  params: { speed: number; omega: number; pitch: number; nose_angle: number; roll_angle: number; position: Vec3 }
): Trajectory {
  const y0 = disc.initializeShot(params);
  const omega = params.omega;
  const res = integrate((t, y) => disc.advance(t, y, omega), y0, events(), T_END);

  const x: number[] = new Array(N_STEP);
  const y: number[] = new Array(N_STEP);
  const z: number[] = new Array(N_STEP);
  const tFinal = res.tFinal;
  for (let i = 0; i < N_STEP; i++) {
    const t = (tFinal * i) / (N_STEP - 1); // linspace(0, tFinal, N_STEP)
    const f = res.sample(t);
    x[i] = f[0];
    y[i] = f[1];
    z[i] = f[2];
  }
  return { tEnd: tFinal, x, y, z };
}

export interface SimInput {
  archetype: Archetype;
  pdgaSpeed: number;
  hyzer: number;
  nose: number;
  wind: number;
  crosswind: number;
  armSpeed: number;
  spin: number;
  arcView: 'RHBH' | 'RHFH' | 'LHBH' | 'LHFH';
  weightG?: number | null;
}

// Full orchestration — keep in lockstep with app.py:shotshaper_sim. Returns [[x, y], …] rounded to
// 2 dp, same as the server route the app used to call.
export function simulateShot(input: SimInput): { points: [number, number][]; archetype: Archetype } {
  const mirror = input.arcView === 'RHFH' || input.arcView === 'LHBH' ? -1 : 1;

  const baseLaunchSpeed = 6.0 + input.pdgaSpeed * 1.3;
  const U = Math.max(4.0, baseLaunchSpeed * (input.armSpeed / 100.0));

  let massKg: number;
  const w = typeof input.weightG === 'number' ? input.weightG : NaN;
  massKg = Number.isFinite(w) ? w / 1000.0 : 0.175;
  massKg = Math.max(0.14, Math.min(0.2, massKg));

  const env: Environment = defaultEnvironment();
  const disc = new DiscGolfDisc(input.archetype, massKg, env);
  const omega = Math.max(disc.empiricalSpin(U) * (input.spin / 100.0), 1.0);

  // Headwind (wind>0) opposes +x; crosswind is the y-component of the same 3-axis wind vector.
  const vx = Math.abs(input.wind) * 0.45 * (input.wind <= 0 ? 1.0 : -1.0);
  const vy = Math.abs(input.crosswind) * 0.45 * mirror * (input.crosswind >= 0 ? 1.0 : -1.0);
  env.Uref = Math.sqrt(vx * vx + vy * vy);
  const nrm = env.Uref || 1.0;
  env.winddir = [vx / nrm, vy / nrm, 0.0] as Vec3;

  const traj = shoot(disc, {
    speed: U,
    omega,
    pitch: 15.0,
    nose_angle: input.nose,
    roll_angle: mirror * input.hyzer,
    position: [0.0, 0.0, 1.3],
  });

  const points: [number, number][] = traj.x.map((px, i) => [round2(px), round2(traj.y[i])]);
  return { points, archetype: input.archetype };
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
