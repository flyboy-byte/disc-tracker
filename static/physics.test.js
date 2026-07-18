// Regression tests for static/physics.js — run with `node static/physics.test.js`.
// No test framework: no build step, no dependency in this repo's spirit.
const { stab, arcPoints, applyModifiers, clampN, STAB_META, MOD } = require('./physics.js');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', msg); }
}
function assertClose(a, b, msg, eps = 1e-6) {
  assert(Math.abs(a - b) < eps, `${msg} (got ${a}, want ${b})`);
}

// ── stab() classification ────────────────────────────────────────────────────
assert(stab({ turn: -2, fade: 1 }) === 'understable', 'turn -2 fade 1 (net -1) is understable');
assert(stab({ turn: 0, fade: 0 }) === 'stable', 'turn 0 fade 0 (net 0) is stable');
assert(stab({ turn: 0, fade: 1 }) === 'overstable', 'turn 0 fade 1 (net 1) is overstable');
assert(stab({}) === 'stable', 'missing turn/fade defaults to stable (net 0)');
assert(Object.keys(STAB_META).length === 3, 'STAB_META has exactly 3 stability classes');

// ── arcPoints() geometry ──────────────────────────────────────────────────────
const W = 220, H = 350;
const flat = { speed: 7, glide: 5, turn: 0, fade: 0 };
const p = arcPoints(flat, W, H, 'RHBH');
assert(p.sy > p.ey, 'start point is below end point (tee at bottom, landing at top)');
assertClose(p.sx, W / 2, 'start x is centered');

// Mirroring: RHFH/LHBH should mirror RHBH/LHFH around the centerline
const understable = { speed: 9, glide: 5, turn: -3, fade: 1 };
const bh = arcPoints(understable, W, H, 'RHBH');
const fh = arcPoints(understable, W, H, 'RHFH');
assertClose(bh.endX - W / 2, -(fh.endX - W / 2), 'RHFH mirrors RHBH around centerline');

// Overstable discs (turnAmt<0 after negation) apex at center, not turn-side
const overstable = { speed: 9, glide: 4, turn: 1, fade: 3 };
const po = arcPoints(overstable, W, H, 'RHBH');
assertClose(po.mx, W / 2, 'overstable disc apexes at center');

// fade=0 must not fall back to a default — regression guard for the ?? vs || bug class
const zeroFade = arcPoints({ speed: 7, glide: 5, turn: -1, fade: 0 }, W, H, 'RHBH');
const oneFade = arcPoints({ speed: 7, glide: 5, turn: -1, fade: 1 }, W, H, 'RHBH');
assert(zeroFade.endX !== oneFade.endX, 'fade=0 is treated as a real value, not a missing one');

// hyzerAngle shifts the launch tangent (Flight Shaper-only field)
const noHyzer = arcPoints({ speed: 9, glide: 5, turn: -2, fade: 1, hyzerAngle: 0 }, 280, 420, 'RHBH');
const withHyzer = arcPoints({ speed: 9, glide: 5, turn: -2, fade: 1, hyzerAngle: 20 }, 280, 420, 'RHBH');
assert(noHyzer.q0x !== withHyzer.q0x, 'hyzerAngle shifts the launch control point');

// ── applyModifiers() ──────────────────────────────────────────────────────────
const base = { speed: 9, glide: 5, turn: -2, fade: 1 };
const neutral = applyModifiers(base, { hyzer: 0, nose: 0, wind: 0, armSpeed: 100, spin: 100 });
assert(neutral.turn === base.turn && neutral.fade === base.fade, 'neutral sliders leave turn/fade unchanged');

const underpowered = applyModifiers(base, { hyzer: 0, nose: 0, wind: 0, armSpeed: 50, spin: 100 });
assert(underpowered.turn > base.turn, 'underpowering a disc reduces turn (more overstable-leaning)');
assert(underpowered.fade > base.fade, 'underpowering a disc increases fade');

const lowSpin = applyModifiers(base, { hyzer: 0, nose: 0, wind: 0, armSpeed: 100, spin: 50 });
assert(lowSpin.turn < base.turn, 'low spin makes the disc more understable (turn more negative) per inverse precession formula');

const clamped = applyModifiers({ speed: 9, glide: 5, turn: -6, fade: 0 }, { hyzer: -30, nose: -15, wind: -20, armSpeed: 100, spin: 100 });
assert(clamped.turn >= -6, 'turn never clamps below -6');
assert(clamped.fade >= 0, 'fade never clamps below 0');

assertClose(clampN(5, 0, 3), 3, 'clampN caps at high bound');
assertClose(clampN(-5, 0, 3), 0, 'clampN floors at low bound');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
