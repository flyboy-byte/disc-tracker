// Disc flight physics — shared by index.html (bag view) and flightshape.html (Flight Shaper).
// Pure functions only: no DOM, no globals besides what's passed in. This is the extraction
// point for a future legacyPhysics.ts port — keep it that way.

const STAB_META = {
  overstable:  { short:'OS', cls:'stab-os', color:'#915EFF' },
  stable:      { short:'ST', cls:'stab-st', color:'#4ade80' },
  understable: { short:'US', cls:'stab-us', color:'#fbbf24' },
};

function stab(d) {
  const net = (d.turn ?? 0) + (d.fade ?? 0);
  if (net >= 1)  return 'overstable';
  if (net <= -1) return 'understable';
  return 'stable';
}

const TYPE_META = {
  putter:  { short:'P',  label:'Putter',  word:'Putter'          },
  mid:     { short:'M',  label:'Mid',     word:'Mid-range'        },
  fairway: { short:'FD', label:'Fairway', word:'Fairway Driver'   },
  driver:  { short:'D',  label:'Driver',  word:'Distance Driver'  },
};

function discType(d) {
  if (d.speed <= 3) return 'putter';
  if (d.speed <= 5) return 'mid';
  if (d.speed <= 8) return 'fairway';
  return 'driver';
}

// arcView: 'RHBH' | 'RHFH' | 'LHBH' | 'LHFH'
function arcPoints(d, W, H, arcView) {
  const cx = W / 2;
  const pad = W * 0.1;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const f = v => +v.toFixed(1);
  const thr = arcView.toUpperCase();
  const m = (thr === 'RHFH' || thr === 'LHBH') ? -1 : 1;
  const sx = cx, sy = f(H * 0.925), ey = f(H * 0.075);
  const sc = W / 50;
  const HR = sy - ey;
  const turnAmt = -(d.turn ?? 0);
  const fadeAmt = d.fade ?? 2;   // ?? not || : fade=0 is valid and must not fall back to 2
  const glide = d.glide ?? 5;
  const hyzerLaunch = (d.hyzerAngle || 0) * 0.09;
  const endX = f(clamp(cx + m*(turnAmt - fadeAmt*1.25)*sc, pad, W-pad));  // 1.25: empirical — fade lands farther opposite than 1:1 weight
  // Apex: where disc peaks in the turn direction
  const apexFrac = Math.min(0.55, 0.30 + glide*0.025);
  const my = f(sy - HR*apexFrac);
  const effTurn = Math.max(turnAmt, 0);  // overstable discs (turnAmt<0) apex at center, not turn-side
  const mx = f(clamp(cx + m*effTurn*sc*3.5, pad, W-pad));
  // Segment 1 control: gentle ramp toward apex. Hyzer shifts launch toward the fade side.
  const q0x = f(clamp(cx + m*effTurn*sc*1.3 - m*hyzerLaunch*sc, pad, W-pad));
  const q0y = f(sy - HR*0.12);
  // Segment 2 control: placed on the same tangent line as the apex approach (G1 smooth joint)
  // q2 = apex + k*(apex - q0): disc continues in the turn direction briefly before the fade hook
  const k = Math.min(1.5, fadeAmt*0.3 + glide*0.05 + turnAmt*0.08);
  const q2x = f(clamp(mx + k*(mx - q0x), pad, W-pad));
  const q2y = f(Math.max(ey + HR*0.03, my + k*(my - q0y)));
  const dx = endX-q2x, dy = ey-q2y, len = Math.sqrt(dx*dx+dy*dy)||1;
  return { sx,sy,ey,endX,mx,my,q0x,q0y,q2x,q2y,nx:dx/len,ny:dy/len,cx };
}

// ── Flight Shaper modifiers ─────────────────────────────────────────────────
// Renderer uses standard flight-number sign convention:
//   more negative turn  → arc turns right (understable) for RHBH
//   higher positive fade → arc fades left  (overstable)  for RHBH
// All modifiers are applied to turn/fade before passing to arcPoints().
const MOD = {
  hyzer_turn: +0.07,  // hyzer > 0: more positive turn → less understable (counters turn)
  pitch_turn: -0.08,  // nose up > 0: more turn (higher AOA = more understable per gyroscopic precession; Kamaruddin/Potts)
  wind_turn:  -0.08,  // headwind > 0: more negative turn → more understable (acts faster)
  arm_turn:   +0.03,  // underArm > 0: more positive turn → less understable (can't reach speed)
  spin_turn:  +0.008, // spinEffect: inverse formula amplifies low-spin more (p = M/IΩ → p doubles at 50% spin)

  hyzer_fade: +0.06,  // hyzer > 0: more fade (disc finishes harder on hyzer)
  pitch_fade: -0.03,  // nose up > 0: marginal fade reduction (disc flying more understable overall)
  wind_fade:  +0.02,  // headwind > 0: slight fade increase (drag slows disc into fade sooner)
  arm_fade:   +0.03,  // underArm > 0: more fade (underpowered disc fades earlier)
  spin_fade:  -0.008, // spinEffect: inverse formula — less spin → slightly more fade
};

function clampN(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function applyModifiers(base, { hyzer, nose, wind, armSpeed, spin }) {
  // Underpowering a fast disc hurts far more than underpowering a putter
  const speedNorm = Math.max(0.5, (base.speed ?? 7) / 9);
  // 50-100 slider range caps max underArm naturally — no artificial cap needed
  // Speed-14 at 50% arm: 50 * 1.56 = 78 → turn shift 2.3 (severe underpowering is severe)
  const underArm = Math.max(0, 100 - armSpeed) * speedNorm;
  // Inverse spin formula from p = M/(I*Ω): halving spin doubles precession rate
  // At 100%: spinEffect=0  At 75%: −33  At 50%: −100 (vs linear: −50)
  const spinEffect = -(100 / Math.max(spin, 1) - 1) * 100;
  const rawTurn = base.turn
    + MOD.hyzer_turn * hyzer
    + MOD.pitch_turn * nose
    + MOD.wind_turn  * wind
    + MOD.arm_turn   * underArm
    + MOD.spin_turn  * spinEffect;
  const rawFade = base.fade
    + MOD.hyzer_fade * hyzer
    + MOD.pitch_fade * nose
    + MOD.wind_fade  * wind
    + MOD.arm_fade   * underArm
    + MOD.spin_fade  * spinEffect;
  return {
    speed: base.speed,
    glide: base.glide,
    turn:  Math.round(clampN(rawTurn, -6, 3) * 10) / 10,
    fade:  Math.round(clampN(rawFade,  0, 7) * 10) / 10,
    hyzerAngle: hyzer,  // raw angle for launch-direction effect in arcPoints
  };
}

// Node (tests) vs browser (plain <script> tag, no module system)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STAB_META, stab, TYPE_META, discType, arcPoints, MOD, applyModifiers, clampN };
}
