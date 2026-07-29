// Faithful port of vendor/shotshaper/environment.py. In Python this module holds process-global
// mutable state (winddir, Uref) that the server mutates per request under a lock. Here we pass an
// Environment object explicitly into the sim instead of using a module global — same values, same
// wind_abl math, but no shared mutable state (cleaner, and there's no server-style concurrency).
import type { Vec3 } from './linalg';

export interface Environment {
  g: number;
  rho: number;
  mu: number;
  winddir: Vec3;
  z0: number;
  Uref: number;
  zref: number;
  kappa: number;
}

// Defaults verbatim from environment.py.
export function defaultEnvironment(): Environment {
  return { g: -9.81, rho: 1.225, mu: 1.81e-5, winddir: [1, 0, 0], z0: 0.1, Uref: 0.0, zref: 1.5, kappa: 0.41 };
}

// Atmospheric boundary-layer wind at height z (log profile). Verbatim from wind_abl().
export function windAbl(env: Environment, z: number): Vec3 {
  if (z < 0.0) z = 0.0;
  const ustar = (env.Uref * env.kappa) / Math.log((env.zref + env.z0) / env.z0);
  const u = (ustar / env.kappa) * Math.log((z + env.z0) / env.z0);
  return [u * env.winddir[0], u * env.winddir[1], u * env.winddir[2]];
}
