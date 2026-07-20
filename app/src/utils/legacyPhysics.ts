// Exact port of static/physics.js's flight modifiers/arc geometry + templates/flightshape.html's
// estimateDist(). Do not rewrite the physics model here — port only, improve via a separate
// physicsV2.ts later (see CLAUDE.md / RESEARCH.md §7).

export interface BaseDisc {
  speed?: number;
  glide?: number;
  turn: number;
  fade: number;
}

export interface SliderValues {
  hyzer: number;
  nose: number;
  wind: number;
  armSpeed: number;
  spin: number;
}

export interface AdjustedDisc {
  speed?: number;
  glide?: number;
  turn: number;
  fade: number;
  hyzerAngle: number;
}

export const MOD = {
  hyzer_turn: 0.07, // hyzer > 0: more positive turn → less understable (counters turn)
  pitch_turn: -0.08, // nose up > 0: more turn (higher AOA = more understable per gyroscopic precession; Kamaruddin/Potts)
  wind_turn: -0.08, // headwind > 0: more negative turn → more understable (acts faster)
  arm_turn: 0.03, // underArm > 0: more positive turn → less understable (can't reach speed)
  spin_turn: 0.008, // spinEffect: inverse formula amplifies low-spin more (p = M/IΩ → p doubles at 50% spin)

  hyzer_fade: 0.06, // hyzer > 0: more fade (disc finishes harder on hyzer)
  pitch_fade: -0.03, // nose up > 0: marginal fade reduction (disc flying more understable overall)
  wind_fade: 0.02, // headwind > 0: slight fade increase (drag slows disc into fade sooner)
  arm_fade: 0.03, // underArm > 0: more fade (underpowered disc fades earlier)
  spin_fade: -0.008, // spinEffect: inverse formula — less spin → slightly more fade
} as const;

export function clampN(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function applyModifiers(base: BaseDisc, { hyzer, nose, wind, armSpeed, spin }: SliderValues): AdjustedDisc {
  // Underpowering a fast disc hurts far more than underpowering a putter
  const speedNorm = Math.max(0.5, (base.speed ?? 7) / 9);
  // 50-100 slider range caps max underArm naturally — no artificial cap needed
  const underArm = Math.max(0, 100 - armSpeed) * speedNorm;
  // Inverse spin formula from p = M/(I*Ω): halving spin doubles precession rate
  const spinEffect = -(100 / Math.max(spin, 1) - 1) * 100;
  const rawTurn =
    base.turn +
    MOD.hyzer_turn * hyzer +
    MOD.pitch_turn * nose +
    MOD.wind_turn * wind +
    MOD.arm_turn * underArm +
    MOD.spin_turn * spinEffect;
  const rawFade =
    base.fade +
    MOD.hyzer_fade * hyzer +
    MOD.pitch_fade * nose +
    MOD.wind_fade * wind +
    MOD.arm_fade * underArm +
    MOD.spin_fade * spinEffect;
  return {
    speed: base.speed,
    glide: base.glide,
    turn: Math.round(clampN(rawTurn, -6, 3) * 10) / 10,
    fade: Math.round(clampN(rawFade, 0, 7) * 10) / 10,
    hyzerAngle: hyzer,
  };
}

// baseFt: speed rating to rough ft ceiling (speed 4→180, speed 9→305, speed 14→430)
// glideFactor: CL/CD proxy — paper confirms glide is primary distance driver
// powerFactor: launch speed scales distance; at AdvR=0.5, spin also scales with power
// noseFactor: nose up → high AOA → high drag → shorter; nose down → also slightly shorter
// hyzerFactor: extreme angle (either direction) is a controlled line, not a distance throw
export interface ArcPoints {
  sx: number;
  sy: number;
  ey: number;
  endX: number;
  mx: number;
  my: number;
  q0x: number;
  q0y: number;
  q2x: number;
  q2y: number;
  nx: number;
  ny: number;
  cx: number;
}

// SVG arc control points for the flight-path curve. W/H are the render surface's own
// dimensions (whatever the screen passes in — pixels on web, layout units on native), not a
// DOM dependency; the function itself is pure arithmetic.
export function arcPoints(
  d: BaseDisc & { hyzerAngle?: number },
  W: number,
  H: number,
  arcView: 'RHBH' | 'RHFH' | 'LHBH' | 'LHFH'
): ArcPoints {
  const cx = W / 2;
  const pad = W * 0.1;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const f = (v: number) => +v.toFixed(1);
  const thr = arcView.toUpperCase();
  const m = thr === 'RHFH' || thr === 'LHBH' ? -1 : 1;
  const sx = cx,
    sy = f(H * 0.925),
    ey = f(H * 0.075);
  const sc = W / 50;
  const HR = sy - ey;
  const turnAmt = -(d.turn ?? 0);
  const fadeAmt = d.fade ?? 2; // ?? not || : fade=0 is valid and must not fall back to 2
  const glide = d.glide ?? 5;
  const hyzerLaunch = (d.hyzerAngle || 0) * 0.09;
  const endX = f(clamp(cx + m * (turnAmt - fadeAmt * 1.25) * sc, pad, W - pad)); // 1.25: empirical — fade lands farther opposite than 1:1 weight
  // Apex: where disc peaks in the turn direction
  const apexFrac = Math.min(0.55, 0.3 + glide * 0.025);
  const my = f(sy - HR * apexFrac);
  const effTurn = Math.max(turnAmt, 0); // overstable discs (turnAmt<0) apex at center, not turn-side
  const mx = f(clamp(cx + m * effTurn * sc * 3.5, pad, W - pad));
  // Segment 1 control: gentle ramp toward apex. Hyzer shifts launch toward the fade side.
  const q0x = f(clamp(cx + m * effTurn * sc * 1.3 - m * hyzerLaunch * sc, pad, W - pad));
  const q0y = f(sy - HR * 0.12);
  // Segment 2 control: placed on the same tangent line as the apex approach (G1 smooth joint)
  // q2 = apex + k*(apex - q0): disc continues in the turn direction briefly before the fade hook
  const k = Math.min(1.5, fadeAmt * 0.3 + glide * 0.05 + turnAmt * 0.08);
  const q2x = f(clamp(mx + k * (mx - q0x), pad, W - pad));
  const q2y = f(Math.max(ey + HR * 0.03, my + k * (my - q0y)));
  const dx = endX - q2x,
    dy = ey - q2y,
    len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { sx, sy, ey, endX, mx, my, q0x, q0y, q2x, q2y, nx: dx / len, ny: dy / len, cx };
}

export function estimateDist(
  base: { speed?: number },
  armSpeed: number,
  wind: number,
  glide: number,
  nose: number,
  hyzer: number
): number {
  const baseFt = 80 + (base.speed ?? 7) * 25;
  const powerFactor = armSpeed / 100;
  const glideFactor = 0.85 + (glide ?? 5) * 0.03;
  const windFactor = 1 - wind * 0.008;
  const noseFactor = 1 - Math.max(0, nose ?? 0) * 0.015 - Math.max(0, -(nose ?? 0)) * 0.005;
  const hyzerFactor = 1 - (Math.abs(hyzer ?? 0) / 30) * 0.18;
  return Math.round((baseFt * powerFactor * glideFactor * windFactor * noseFactor * hyzerFactor) / 10) * 10;
}
