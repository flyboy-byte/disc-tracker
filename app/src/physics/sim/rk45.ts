// Faithful reimplementation of scipy.integrate.solve_ivp(method='RK45', dense_output=True,
// events=...) — enough of it to reproduce vendor/shotshaper's _shoot() exactly. This is the
// fidelity-critical piece: the Dormand-Prince 5(4) tableau, scipy's adaptive step-size controller,
// its select_initial_step, FSAL, the RK45 dense-output interpolant, and terminal-event
// root-finding (Brent). Constants are scipy's own (scipy/integrate/_ivp/rk.py, BSD-3). The port's
// parity test gates TS trajectories against the real engine's, so any divergence here is caught.

// ── Dormand-Prince 5(4) tableau (scipy RK45) ───────────────────────────────────
const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1];
const A: number[][] = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
];
const B = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84];
const E = [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40];
// Dense-output interpolation matrix P (7x4).
const P: number[][] = [
  [1, -8048581381 / 2820520608, 8663915743 / 2820520608, -12715105075 / 11282082432],
  [0, 0, 0, 0],
  [0, 131558114200 / 32700410799, -68118460800 / 10900136933, 87487479700 / 32700410799],
  [0, -1754552775 / 470086768, 14199869525 / 1410260304, -10690763975 / 1880347072],
  [0, 127303824393 / 49829197408, -318862633887 / 49829197408, 701980252875 / 199316789632],
  [0, -282668133 / 205662961, 2019193451 / 616988883, -1453857185 / 822651844],
  [0, 40617522 / 29380423, -110615467 / 29380423, 69997945 / 29380423],
];
const N_STAGES = 6;
const ERROR_EST_ORDER = 4;
const ERROR_EXPONENT = -1 / (ERROR_EST_ORDER + 1);
const SAFETY = 0.9;
const MIN_FACTOR = 0.2;
const MAX_FACTOR = 10.0;
const RTOL = 1e-3;
const ATOL = 1e-6;

type Deriv = (t: number, y: number[]) => number[];

export interface SimEvent {
  fn: (t: number, y: number[]) => number;
  terminal: boolean;
  direction: number; // -1, 0, or +1
}

interface Segment {
  t0: number;
  t1: number;
  h: number;
  yOld: number[];
  Q: number[][]; // n x 4
}

const rmsNorm = (x: number[]): number => {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / x.length);
};

function selectInitialStep(fun: Deriv, t0: number, y0: number[], f0: number[], tBound: number): number {
  const n = y0.length;
  const scale = y0.map((v) => ATOL + Math.abs(v) * RTOL);
  const d0 = rmsNorm(y0.map((v, i) => v / scale[i]));
  const d1 = rmsNorm(f0.map((v, i) => v / scale[i]));
  let h0: number;
  if (d0 < 1e-5 || d1 < 1e-5) h0 = 1e-6;
  else h0 = 0.01 * (d0 / d1);
  const y1 = y0.map((v, i) => v + h0 * f0[i]);
  const f1 = fun(t0 + h0, y1);
  const d2 = rmsNorm(f1.map((v, i) => (v - f0[i]) / scale[i])) / h0;
  let h1: number;
  if (d1 <= 1e-15 && d2 <= 1e-15) h1 = Math.max(1e-6, h0 * 1e-3);
  else h1 = Math.pow(0.01 / Math.max(d1, d2), 1 / (ERROR_EST_ORDER + 1));
  void n;
  return Math.min(100 * h0, h1, Math.abs(tBound - t0));
}

// One Dormand-Prince step from (t, y) with current derivative f. Returns y_new, f_new (FSAL),
// and the full K (7 stages) for error estimate + dense output.
function rkStep(fun: Deriv, t: number, y: number[], f: number[], h: number): { yNew: number[]; fNew: number[]; K: number[][] } {
  const n = y.length;
  const K: number[][] = new Array(N_STAGES + 1);
  K[0] = f;
  for (let s = 1; s < N_STAGES; s++) {
    const dy = new Array(n).fill(0);
    for (let j = 0; j < s; j++) {
      const a = A[s][j];
      if (a === 0) continue;
      for (let i = 0; i < n; i++) dy[i] += a * K[j][i];
    }
    const yStage = y.map((v, i) => v + h * dy[i]);
    K[s] = fun(t + C[s] * h, yStage);
  }
  const yNew = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let s = 0; s < N_STAGES; s++) acc += B[s] * K[s][i];
    yNew[i] = y[i] + h * acc;
  }
  const fNew = fun(t + h, yNew);
  K[N_STAGES] = fNew;
  return { yNew, fNew, K };
}

function estimateErrorNorm(K: number[][], h: number, scale: number[]): number {
  const n = scale.length;
  const err = new Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let s = 0; s < N_STAGES + 1; s++) acc += K[s][i] * E[s];
    err[i] = (acc * h) / scale[i];
  }
  return rmsNorm(err);
}

// Dense-output Q = K^T @ P (n x 4) for an accepted step.
function computeQ(K: number[][], n: number): number[][] {
  const Q: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = new Array(4).fill(0);
    for (let k = 0; k < 4; k++) {
      let acc = 0;
      for (let s = 0; s < N_STAGES + 1; s++) acc += K[s][i] * P[s][k];
      row[k] = acc;
    }
    Q[i] = row;
  }
  return Q;
}

function evalSegment(seg: Segment, t: number): number[] {
  const x = (t - seg.t0) / seg.h;
  const p = [x, x * x, x * x * x, x * x * x * x];
  const n = seg.yOld.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = 0; k < 4; k++) acc += seg.Q[i][k] * p[k];
    out[i] = seg.yOld[i] + seg.h * acc;
  }
  return out;
}

// Brent's method root of g on [a,b] with g(a), g(b) opposite signs. Mirrors scipy's brentq use
// in event location; xtol tight enough that the located event time is exact to trajectory scale.
function brent(g: (t: number) => number, a: number, b: number): number {
  let fa = g(a);
  let fb = g(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  const xtol = 1e-12;
  const rtol = 4 * Number.EPSILON;
  for (let iter = 0; iter < 100; iter++) {
    if (fb !== 0 && Math.sign(fa) === Math.sign(fb)) {
      a = c;
      fa = fc;
      d = b - a;
      e = d;
    }
    if (Math.abs(fa) < Math.abs(fb)) {
      c = b;
      b = a;
      a = c;
      fc = fb;
      fb = fa;
      fa = fc;
    }
    const tol = 2 * rtol * Math.abs(b) + xtol;
    const m = 0.5 * (a - b);
    if (Math.abs(m) <= tol || fb === 0) return b;
    if (Math.abs(e) < tol || Math.abs(fc) <= Math.abs(fb)) {
      d = m;
      e = m;
    } else {
      let s = fb / fc;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * m * s;
        q = 1 - s;
      } else {
        q = fc / fa;
        const r = fb / fa;
        p = s * (2 * m * q * (q - r) - (b - c) * (r - 1));
        q = (q - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      else p = -p;
      if (2 * p < Math.min(3 * m * q - Math.abs(tol * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = m;
        e = m;
      }
    }
    c = b;
    fc = fb;
    b += Math.abs(d) > tol ? d : m > 0 ? tol : -tol;
    fb = g(b);
  }
  return b;
}

export interface IntegrateResult {
  tFinal: number;
  sample: (t: number) => number[]; // global dense interpolant
}

// Integrate y' = fun(t, y, ...args) from 0 to tEnd with RK45 + dense output + terminal events.
// Direction is always forward (+1), matching _shoot's [0, T_END].
export function integrate(
  derivative: (t: number, y: number[]) => number[],
  y0: number[],
  events: SimEvent[],
  tEnd: number
): IntegrateResult {
  const fun = derivative;
  let t = 0;
  let y = y0.slice();
  let f = fun(t, y);
  let hAbs = selectInitialStep(fun, t, y, f, tEnd);

  const segments: Segment[] = [];
  let gPrev = events.map((ev) => ev.fn(t, y));
  let tFinal = tEnd;

  const maxSteps = 100000;
  for (let step = 0; step < maxSteps; step++) {
    if (t >= tEnd) break;
    const minStep = 10 * Math.abs(Math.max(Math.abs(t), 1) * Number.EPSILON);
    if (hAbs < minStep) hAbs = minStep;

    let stepAccepted = false;
    let stepRejected = false;
    let tNew = t;
    let yNew: number[] = y;
    let fNew: number[] = f;
    let K: number[][] = [];
    let h = 0;

    while (!stepAccepted) {
      if (hAbs < minStep) {
        // Can't make progress — stop where we are.
        return buildResult(segments, t);
      }
      h = hAbs;
      tNew = t + h;
      if (tNew > tEnd) tNew = tEnd;
      h = tNew - t;
      hAbs = Math.abs(h);
      const stepRes = rkStep(fun, t, y, f, h);
      yNew = stepRes.yNew;
      fNew = stepRes.fNew;
      K = stepRes.K;
      const scale = y.map((v, i) => ATOL + Math.max(Math.abs(v), Math.abs(yNew[i])) * RTOL);
      const errorNorm = estimateErrorNorm(K, h, scale);
      if (errorNorm < 1) {
        let factor: number;
        if (errorNorm === 0) factor = MAX_FACTOR;
        else factor = Math.min(MAX_FACTOR, SAFETY * Math.pow(errorNorm, ERROR_EXPONENT));
        if (stepRejected) factor = Math.min(1, factor);
        hAbs *= factor;
        stepAccepted = true;
      } else {
        hAbs *= Math.max(MIN_FACTOR, SAFETY * Math.pow(errorNorm, ERROR_EXPONENT));
        stepRejected = true;
      }
    }

    const Q = computeQ(K, y.length);
    const seg: Segment = { t0: t, t1: tNew, h, yOld: y, Q };

    // ── Event detection over [t, tNew] using this step's dense interpolant ──
    const gNew = events.map((ev) => ev.fn(tNew, yNew));
    let earliestTerminal = Infinity;
    for (let e = 0; e < events.length; e++) {
      const ev = events[e];
      const g0 = gPrev[e];
      const g1 = gNew[e];
      const up = g0 <= 0 && g1 >= 0;
      const down = g0 >= 0 && g1 <= 0;
      const triggered = (up && ev.direction > 0) || (down && ev.direction < 0) || ((up || down) && ev.direction === 0);
      if (triggered && !(g0 === 0 && g1 === 0)) {
        const root = brent((tt) => ev.fn(tt, evalSegment(seg, tt)), t, tNew);
        if (ev.terminal && root < earliestTerminal) earliestTerminal = root;
      }
    }

    segments.push(seg);
    if (earliestTerminal < Infinity) {
      tFinal = earliestTerminal;
      break;
    }

    t = tNew;
    y = yNew;
    f = fNew;
    gPrev = gNew;
    if (t >= tEnd) {
      tFinal = tEnd;
      break;
    }
  }

  return buildResult(segments, tFinal);
}

function buildResult(segments: Segment[], tFinal: number): IntegrateResult {
  const sample = (tq: number): number[] => {
    if (segments.length === 0) return [];
    // Find the segment containing tq (last one inclusive of its end).
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tq <= segments[mid].t1) hi = mid;
      else lo = mid + 1;
    }
    return evalSegment(segments[lo], tq);
  };
  return { tFinal, sample };
}
