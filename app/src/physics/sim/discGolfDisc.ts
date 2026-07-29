// Faithful port of the DiscGolfDisc class from vendor/shotshaper/projectile.py. Only that class
// is ported — the shot-put/soccer/table-tennis projectiles in the same source file are unrelated.
// The state vector y is 9-D: [x, y, z, u, v, w, phi, theta, psi] (position, velocity, attitude).
// advance(t, y, omega) is the RHS dy/dt handed to the RK45 integrator (rk45.ts).
import { COEFFS, type Archetype, type CoeffTable } from './coeffs';
import { windAbl, type Environment } from './environment';
import { cross3, matVec, norm3, type Vec3 } from './linalg';
import { T_12, T_14, T_23, T_31, T_34, T_41 } from './transforms';

const { PI, sin, cos, atan2, sqrt } = Math;
const radians = (d: number): number => (d * PI) / 180;
const degrees = (r: number): number => (r * 180) / PI;

// Python-style indexing so the negative indices in _flip's second loop port verbatim.
function at(arr: number[], i: number): number {
  return arr[i < 0 ? arr.length + i : i];
}

// Port of DiscGolfDisc._flip: the stored tables cover -90..90 deg; expand to -180..180 using the
// source's exact symmetry rules (incl. its numpy negative indexing). Returns strictly-increasing
// alpha nodes so a plain linear scan interpolates them.
function flipCoeffs(a: number[], cl: number[], cd: number[], cm: number[]) {
  const n = a.length;
  let idx = 0;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    if (Math.abs(a[i]) < best) {
      best = Math.abs(a[i]);
      idx = i;
    }
  }
  const a2 = new Array(2 * n).fill(0);
  const cl2 = new Array(2 * n).fill(0);
  const cd2 = new Array(2 * n).fill(0);
  const cm2 = new Array(2 * n).fill(0);
  for (let i = 0; i < n; i++) {
    a2[idx + i] = a[i];
    cl2[idx + i] = cl[i];
    cd2[idx + i] = cd[i];
    cm2[idx + i] = cm[i];
  }
  for (let i = 0; i < idx; i++) {
    a2[i] = -(180 + a[idx - i]);
    cl2[i] = -cl[idx - i];
    cd2[i] = cd[idx - i];
    cm2[i] = -cm[idx - i];
  }
  for (let i = idx + n; i < 2 * n; i++) {
    a2[i] = 180 - at(a, idx + n - i - 2);
    cl2[i] = -at(cl, idx + n - i - 2);
    cd2[i] = at(cd, idx + n - i - 2);
    cm2[i] = -at(cm, idx + n - i - 2);
  }
  return { alpha: a2, Cl: cl2, Cd: cd2, Cm: cm2 };
}

// Linear interpolation matching scipy interp1d(kind='linear'). The disc's normalized angle of
// attack is always within the table's [-180, 180+] node range (see _normalize_angle), so this
// clamps at the endpoints rather than extrapolating — defensive against float round-off at ±180.
function interpLinear(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  const last = xs.length - 1;
  if (x >= xs[last]) return ys[last];
  // Binary search for the bracketing interval.
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + t * (ys[hi] - ys[lo]);
}

export class DiscGolfDisc {
  readonly name: Archetype;
  readonly diameter: number;
  readonly mass: number;
  readonly area: number;
  readonly I_xy: number;
  readonly I_z: number;
  private readonly env: Environment;
  private readonly alpha: number[];
  private readonly Cl_tab: number[];
  private readonly Cd_tab: number[];
  private readonly Cm_tab: number[];

  constructor(name: Archetype, mass: number, env: Environment) {
    const data: CoeffTable = COEFFS[name];
    this.name = name;
    this.diameter = data.diameter;
    this.mass = mass;
    this.area = (PI * data.diameter * data.diameter) / 4.0;
    this.I_xy = mass * data.J_xy;
    this.I_z = mass * data.J_z;
    this.env = env;
    const flipped = flipCoeffs(data.alpha, data.Cl, data.Cd, data.Cm);
    this.alpha = flipped.alpha;
    this.Cl_tab = flipped.Cl;
    this.Cd_tab = flipped.Cd;
    this.Cm_tab = flipped.Cm;
  }

  // arctan2(sin, cos) — wrap to (-pi, pi], exactly as _normalize_angle.
  private normalizeAngle(a: number): number {
    return atan2(sin(a), cos(a));
  }

  Cd(alphaRad: number): number {
    return interpLinear(this.alpha, this.Cd_tab, degrees(this.normalizeAngle(alphaRad)));
  }
  Cl(alphaRad: number): number {
    return interpLinear(this.alpha, this.Cl_tab, degrees(this.normalizeAngle(alphaRad)));
  }
  Cm(alphaRad: number): number {
    return interpLinear(this.alpha, this.Cm_tab, degrees(this.normalizeAngle(alphaRad)));
  }

  empiricalSpin(speed: number): number {
    return 5.2 * speed;
  }

  // Port of forces(): resolve velocity through Body → zero-side-slip → wind axes, get alpha/beta,
  // then aero forces + gravity in wind axes. Returns the pieces advance() needs.
  private forces(x: Vec3, u: Vec3, a: Vec3): { alpha: number; beta: number; Fd: number; Fl: number; M: number; g4: Vec3 } {
    const wind = windAbl(this.env, x[2]);
    const urel: Vec3 = [u[0] - wind[0], u[1] - wind[1], u[2] - wind[2]];
    const u2 = matVec(T_12(a), urel);
    const beta = -atan2(u2[1], u2[0]);
    const u3 = matVec(T_23(beta), u2);
    const alpha = -atan2(u3[2], u3[0]);
    const u4 = matVec(T_34(alpha), u3);

    const g: Vec3 = [0, 0, this.mass * this.env.g];
    const g4 = T_14(g, a, beta, alpha);

    const q = 0.5 * this.env.rho * u4[0] * u4[0];
    const S = this.area;
    const D = this.diameter;
    const Fd = q * S * this.Cd(alpha);
    const Fl = q * S * this.Cl(alpha);
    const M = q * S * D * this.Cm(alpha);
    return { alpha, beta, Fd, Fl, M, g4 };
  }

  // Port of advance(): the RHS dy/dt for the integrator. `omega` is the (scalar) spin rate.
  advance(_t: number, vec: number[], omega: number): number[] {
    const x: Vec3 = [vec[0], vec[1], vec[2]];
    const u: Vec3 = [vec[3], vec[4], vec[5]];
    const a: Vec3 = [vec[6], vec[7], vec[8]];

    const { alpha, beta, Fd, Fl, M, g4 } = this.forces(x, u, a);
    const m = this.mass;
    const dudt = (-Fd + g4[0]) / m;
    const dvdt = g4[1] / m;
    const dwdt = (Fl + g4[2]) / m;
    const acc4: Vec3 = [dudt, dvdt, dwdt];
    const dphidt = -M / (omega * (this.I_xy - this.I_z));
    const angvel3: Vec3 = [dphidt, 0, 0];

    const acc1 = T_41(acc4, a, beta, alpha);
    const angvel1 = T_31(angvel3, a, beta);
    return [u[0], u[1], u[2], acc1[0], acc1[1], acc1[2], angvel1[0], angvel1[1], angvel1[2]];
  }

  // Port of DiscGolfDisc.initialize_shot: build the 9-D initial state from the launch params.
  initializeShot(params: {
    speed: number;
    pitch: number; // deg
    nose_angle: number; // deg (theta)
    roll_angle: number; // deg (phi)
    position: Vec3;
  }): number[] {
    const U = params.speed;
    const pitch = radians(params.pitch);
    const yaw = 0.0;
    const rollAngle = radians(params.roll_angle);
    const noseAngle = radians(params.nose_angle);
    const [x, y, z] = params.position;

    const xy = cos(pitch);
    const u = U * xy * cos(yaw);
    const v = U * xy * sin(-yaw);
    const w = U * sin(pitch);

    // attitude = [phi, theta, 0], then add the launch-pitch contribution through the body frame.
    let attitude: Vec3 = [rollAngle, noseAngle, 0];
    const add = matVec(T_12(attitude), [0, pitch, 0]);
    attitude = [attitude[0] + add[0], attitude[1] + add[1], attitude[2] + add[2]];
    const [phi, theta, psi] = attitude;
    return [x, y, z, u, v, w, phi, theta, psi];
  }
}

// Bare module-level helpers exported for unit tests.
export const _testing = { flipCoeffs, interpLinear };
export { sqrt };
