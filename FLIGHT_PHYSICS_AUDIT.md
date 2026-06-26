# Disc Golf Flight Path — Physics & Rendering Audit

> **Purpose**: Ground-truth documentation for the flight arc visualization used in the disc bag tracker. Intended as a briefing for audits, AI code review, or physics improvements. Covers what the code actually does, why decisions were made, what is physically sound, and what is openly guessed or approximated.

---

## 1. Context

This is a **stylized top-down SVG visualization**, not a ballistic simulation. The goal is:

- Show a recognizable flight *shape* that matches what a disc golfer expects to see
- Differentiate clearly between overstable, stable, and understable discs
- React meaningfully to throw conditions (hyzer, nose pitch, wind, arm speed, spin)

No differential equations are solved. No time-stepping occurs. The "physics" is a set of empirically tuned constants applied to disc flight ratings (manufacturer flight-number convention: speed, glide, turn, fade) to produce SVG bezier curves.

---

## 2. Coordinate System

```
SVG origin: top-left (0,0)
Disc flies from BOTTOM → TOP (tee at bottom, landing at top)

  ey = H * 0.075   ← landing zone (top of SVG)
  sy = H * 0.925   ← tee (bottom of SVG)
  cx = W / 2       ← aim line (vertical centerline)
  
  +x = RIGHT on screen
  -x = LEFT on screen
  
For RHBH (m=1): turn goes RIGHT (+x), fade goes LEFT (-x)
For RHFH (m=-1): turn goes LEFT (-x), fade goes RIGHT (+x)
```

The disc starts at `(cx, sy)` and lands at `(endX, ey)`. The aim line `cx` is drawn as a dashed vertical reference. The disc does **not** return to `cx` at landing — `endX` is offset based on net turn/fade physics.

---

## 3. Flight Number Sign Convention

| Rating | Typical range | Meaning |
|--------|--------------|---------|
| speed  | 1–14         | How fast the disc must fly to behave as rated |
| glide  | 1–7          | Lift/drag efficiency; high = longer turn phase |
| turn   | -5 to +1     | **Negative = turns** (understable, goes right RHBH); positive = resists turn (overstable) |
| fade   | 0–7          | **Positive = fades** (overstable finish, goes left RHBH) |

Internal conversion:
```javascript
const turnAmt = -(d.turn || 0);  // positive turnAmt = rightward for RHBH
const fadeAmt = d.fade || 2;     // positive fadeAmt = leftward for RHBH
```

So a Firebird (turn -1, fade 4): turnAmt=1 (barely turns right), fadeAmt=4 (strong left fade).  
A D3 (turn -2, fade 2): turnAmt=2 (turns right), fadeAmt=2 (moderate fade, roughly balanced).

---

## 4. Throw Style Mirror

```javascript
const m = (thr === 'RHFH' || thr === 'LHBH') ? -1 : 1;
```

| Throw | Spin | m | Turn direction | Fade direction |
|-------|------|---|----------------|----------------|
| RHBH  | CCW  | +1 | Right (+x)    | Left  (-x)     |
| LHFH  | CCW  | +1 | Right (+x)    | Left  (-x)     |
| RHFH  | CW   | -1 | Left  (-x)    | Right (+x)     |
| LHBH  | CW   | -1 | Left  (-x)    | Right (+x)     |

RHFH and LHBH are aerodynamically equivalent (both CW spin). RHBH and LHFH are equivalent (both CCW spin). All lateral offsets are multiplied by `m`.

---

## 5. Arc Rendering — Two-Phase Quadratic Bezier

### 5.1 Why Two Segments

A single cubic bezier cannot reliably produce both:
- An S-curve (understable: turns right, fades left, crossing centerline) 
- A late hook (overstable: goes mostly straight, dumps hard at end)

with meaningfully different visual shapes for different discs. The solution is two quadratic bezier segments meeting at an explicit **apex** point.

```
Segment 1 (gray):   tee (sx, sy)  →  apex (mx, my)   [turn phase]
Segment 2 (color):  apex (mx, my) →  landing (endX, ey) [fade phase]
```

### 5.2 Landing Position

```javascript
const endX = clamp(cx + m*(turnAmt - fadeAmt*1.25)*sc, pad, W-pad);
```

Turn pulls the disc one way; fade pulls it the other. The `1.25` coefficient weights fade slightly heavier than turn on the landing position, which empirically matches how fade dominates most discs' final resting spot. 

**Known approximation**: This is a linear net of two forces that are actually sequential (turn happens at high speed, fade at low speed). The true landing depends on the ratio of flight time spent in each phase, not just the raw ratings.

Scale: `sc = W / 50`. For a 220px-wide SVG, 1 rating unit ≈ 4.4px.

### 5.3 Turn Apex

```javascript
const apexFrac = Math.min(0.55, 0.30 + glide*0.025);  // fraction of field height
const my = sy - HR * apexFrac;
const mx = clamp(cx + m * Math.max(turnAmt, 0.15) * sc * 3.5, pad, W-pad);
```

- **Vertical position**: High glide = apex further downfield (disc maintains turn longer before fading). Glide 1 → 32.5% of field. Glide 7 → 47.5%. Capped at 55%.
- **Lateral position**: Proportional to `turnAmt * 3.5`. A disc with turn=-3 (turnAmt=3) reaches 3× further sideways than a disc with turn=-1. The `Math.max(turnAmt, 0.15)` floor ensures even zero-turn discs have a minimal apex offset so they don't produce a degenerate vertical line.

**Academic grounding**: Kamaruddin et al. (2018) show that CL/CD ratio peaks at intermediate AOA and that higher CL/CD corresponds to longer sustained turn phase before the disc enters the fade-dominant regime. This maps well to glide ≈ CL/CD and justifies glide controlling apex Y position.

### 5.4 Segment 1 Control Point

```javascript
const q0x = clamp(cx + m * Math.max(turnAmt, 0.15) * sc * 1.3, pad, W-pad);
const q0y = sy - HR * 0.12;
```

`q0` is set at 12% of field height above the tee, and pulled laterally at `1.3×` the turn amount (less than the apex's `3.5×` so the disc curves smoothly toward the apex rather than overshoooting immediately).

The ratio 1.3/3.5 ≈ 0.37 means the quadratic control is at about 37% of the apex's lateral deflection — this produces a gradual curve that accelerates toward the apex, which is more realistic than immediately going hard sideways.

### 5.5 Segment 2 Control Point — G1 Smooth Joint

The kink problem: if `q2` is placed independently (e.g., anchored to `endX`), the two segments arrive and depart the apex at different angles, creating a visible corner. Fix: place `q2` on the **same tangent line** as the segment 1 approach.

```javascript
const k = Math.min(1.5, fadeAmt*0.3 + glide*0.05);
const q2x = clamp(mx + k*(mx - q0x), pad, W-pad);
const q2y = Math.max(ey + HR*0.03, my + k*(my - q0y));
```

This is `q2 = apex + k*(apex - q0)`: the disc continues in the turn direction for a distance proportional to `k` past the apex before the fade hook forces it toward `endX`.

**Physical interpretation**: `k` models "fade lag" — at the apex the disc is still traveling in the turn direction and doesn't immediately reverse. High fade + high glide → larger `k` → disc overshoots the apex further in the turn direction → more pronounced hook shape when it sweeps back to `endX`. The `1.5` cap prevents unrealistic overshooting.

**G1 continuity**: Since `q0`, `apex`, and `q2` are collinear by construction, the two quadratic segments share a tangent at the apex. The path is smooth — no visible corner. **Caveat**: this guarantee holds only if `q2x` and `q2y` are not clamped; the `clamp()` and `Math.max()` bounds applied to `q2` can break the collinearity and introduce a subtle kink. In practice the clamp triggers only at the layout edges.

### 5.6 Arrowhead Tangent

```javascript
const dx = endX - q2x, dy = ey - q2y;
```

The tangent direction at the endpoint of a quadratic bezier `Q q2 endX` is `endX - q2`. This is exact (not an approximation) for quadratic beziers. For RHBH Firebird: `q2` is to the right of `endX`, so `dx` is negative → arrowhead points left → disc arrives going leftward. Correct.

---

## 6. Shape Examples (W=50 thumbnail)

`sc=1.0, cx=25, sy=74, ey=6, HR=68`

### Firebird — 9/3/-1/4 (RHBH)

| Quantity | Value |
|----------|-------|
| turnAmt  | 1     |
| fadeAmt  | 4     |
| endX     | 21 (left of aim)  |
| apexFrac | 0.375 |
| apex     | (28.5, 48.5) |
| q0       | (26.3, 65.8) |
| k        | 1.35  |
| q2       | (31.5, 25.1) |

Path: center → barely right → apex(28.5) — disc traveling slightly right → continues right to q2(31.5) → sweeps hard left to land at 21. **Straight-then-hook** shape. ✓

### D3 — 12/5/-2/2 (RHBH)

| Quantity | Value |
|----------|-------|
| turnAmt  | 2     |
| fadeAmt  | 2     |
| endX     | 24.5 (barely left of aim) |
| apexFrac | 0.425 |
| apex     | (32, 45.1) |
| q0       | (27.6, 65.8) |
| k        | 0.85  |
| q2       | (35.7, 27.5) |

Path: center → right → apex(32) — disc traveling further right → continues right to q2(35.7) → sweeps back left to land at 24.5. The arc **crosses toward center**, producing the S-curve. ✓

### Aviar — 2/3/0/2 (RHBH)

turnAmt=0 → apex at (25.5, 49.2), q0 at (25.2, 65.8). Both barely offset. The path is nearly vertical with a moderate leftward hook. Correct for a putter. ✓

---

## 7. Physics Modifiers

Applied in `applyModifiers()` before `arcPoints()`. Modifiers change the **effective turn and fade** that the arc is drawn with.

```
rawTurn = base.turn + Σ(MOD.x_turn × input)
rawFade = base.fade + Σ(MOD.x_fade × input)
```

Results clamped: turn ∈ [-6, 3], fade ∈ [0, 7].

### 7.1 Modifier Table

| Slider | Unit | MOD_turn | MOD_fade | Physical reasoning |
|--------|------|----------|----------|--------------------|
| hyzer  | degrees (+= hyzer) | +0.07 | +0.06 | Tilting the disc toward the fade side suppresses turn (gyroscopic precession resists the tilt), increases effective fade. Physically sound. |
| nose   | degrees (+= nose up) | **-0.08** | **-0.03** | Nose up → higher AOA → disc acts more understable (more turn, less fade). Physically: gyroscopic precession from the nose-up lift moment pushes the disc in the understable direction (Kamaruddin/Potts). Note: extreme nose-up stall behavior is not modeled — this captures moderate AOA effect only. |
| wind   | mph-ish (+= headwind) | -0.08 | +0.02 | Headwind increases effective airspeed → disc acts faster than rated → more turn (understable) at equivalent arm speed. Small fade increase from quicker deceleration. |
| arm    | % of rated speed | +0.03/unit-under | +0.03/unit-under | Underpowering (arm < 100%) → disc never reaches turn speed → acts overstable. **Speed-normalized**: coefficient scaled by `speed/9` so underpowering a fast disc hurts proportionally more than underpowering a putter. |
| spin   | % (50–100, 100=max) | +0.008 | -0.008 | Gyroscopic stability via `p = M/(I×Ω)` — halving Ω doubles precession rate. Slider uses inverse formula: `spinEffect = -(100/spin - 1) × 100`, giving −33 at 75% and −100 at 50% (vs. linear −25/−50). Aerodynamic spin contribution is negligible (Kamaruddin et al.); effect is purely gyroscopic. |

### 7.2 Arm Speed Normalization

Slider range: **50–100%** (100% = perfect throw, disc performs as rated).

```javascript
const speedNorm = Math.max(0.5, (base.speed ?? 7) / 9);
const underArm  = Math.max(0, 100 - armSpeed) * speedNorm;  // no cap — 50-100 range prevents runaway
```

No artificial cap is applied; the 50–100 slider range already limits max underArm:
- Speed-14 at 50%: `50 × 1.56 = 78` → turn penalty `78 × 0.03 = 2.34` (severe underpowering of a distance driver)
- Speed-9 at 50%: `50 × 1.0 = 50` → turn penalty `1.50`
- Speed-4 putter at 50%: `50 × 0.5 = 25` → turn penalty `0.75`

**Physical basis**: Fast discs require higher release speed to achieve the high-speed phase (turn). If you can't reach that speed, the disc skips the turn phase entirely and goes overstable. The speedNorm multiplier reflects that underpowering a distance driver is much more consequential than underpowering a putter.

---

## 8. Hyzer Launch Visual Effect

In `flightshape.html` only (not in the bag/field view — bags don't store release angle):

```javascript
const hyzerLaunch = (d.hyzerAngle || 0) * 0.09;
const q0x = clamp(cx + m*turnAmt*sc*1.3 - m*hyzerLaunch*sc, pad, W-pad);
```

`hyzerAngle` is the raw hyzer slider value (already used in `applyModifiers` to shift turn/fade). The second use here shifts `q0` toward the fade side — visually the disc launches already biased toward the fade direction, rather than starting straight-down the center.

**Consequence on G1 smoothness**: Since `q2 = apex + k*(apex - q0)`, shifting `q0` sideways also rotates the tangent at the apex, which slightly shifts `q2`. For large hyzer values this can slightly distort the arc shape. Acceptable for the slider range (±30°).

---

## 9. Stability Badge

```javascript
function stab(d) {
  const net = d.turn + d.fade;
  if (net >= 3) return 'overstable';
  if (net <= 0) return 'understable';
  return 'stable';
}
```

This is `fade + turn` (where turn is negative for understable discs). Net ≥ 3 = overstable (fade wins), net ≤ 0 = understable (turn wins or cancels), otherwise stable.

Examples: Firebird (−1+4=3) = overstable. Leopard (−2+1=−1) = understable. Buzzz (−1+2=1) = stable.

**Known limitation**: Does not account for speed. A low-speed putter with fade=3 and a high-speed driver with fade=3 are both "overstable" by this metric, but they fly very differently in practice. Speed affects whether the disc even reaches the turn phase.

---

## 10. Known Approximations and Open Questions

### Sound / Validated
- **Glide ≈ CL/CD**: Kamaruddin et al. show CL/CD peaks at intermediate AOA and governs how long the disc maintains the turn phase. Using glide to control apex vertical position is justified.
- **Spin's aerodynamic contribution is negligible**: Same paper confirms AOA is the dominant factor. Spin only affects flight through gyroscopic precession (`p = M/IΩ`). The inverse spin formula models this correctly — halving spin doubles precession rate. Coefficients are 0.008.
- **Headwind increases effective speed / understable behavior**: Physically obvious — disc sees faster airflow at same arm speed → same effect as throwing harder.
- **G1 continuity at apex**: Holds when q2 is not clamped (the common case). Clamping at layout edges can break collinearity.
- **RHFH/LHBH mirror logic**: Gyroscopic precession direction reverses with spin direction. The ×(−1) mirror is correct.

### Approximations / Educated Guesses
- **Linear modifier model**: `rawTurn = base.turn + Σ(coeff × input)` is linear. Real aerodynamic effects are nonlinear (especially nose pitch — small nose-up angles barely matter, large angles cause violent stall). The linear model is good for small deviations.
- **Modifier magnitudes**: All `MOD.*` values (0.07, 0.10, 0.08, etc.) are tuned by feel, not derived from wind tunnel data. They produce plausible visual changes but are not calibrated to real discs.
- **Landing position formula** `(turnAmt - fadeAmt*1.25)`: The 1.25 weighting of fade is empirical. Real landing offset depends on the ratio of time spent in each flight phase, disc mass, and air density — none of which are modeled.
- **Apex lateral coefficient 3.5**: Where `mx = cx + m*turnAmt*sc*3.5`. The `3.5` was chosen visually to make the S-curve and hook shapes look distinct. No physical derivation.
- **k coefficient** `fadeAmt*0.3 + glide*0.05`: Controls how far the disc continues in the turn direction past the apex. Tuned visually. Higher fade + higher glide = more "overshoot" before the hook. Directionally correct (overstable discs have a more pronounced late fade) but the magnitudes are guessed.
- **Nose pitch effect sign (recently corrected)**: Was `+0.08` (making nose up = more overstable). Corrected to `−0.10` (nose up = more understable). The old sign was physically wrong and has been fixed. Magnitudes are still guessed.

### Not Modeled At All
- Disc mass / moment of inertia
- Air density / altitude
- Temperature effects on disc flex
- Wobble / gyroscopic precession dynamics (only the net outcome is approximated)
- Wind direction (only headwind/tailwind; crosswind not modeled)
- Disc worn-in vs. new (beat plastic becomes more understable over time)
- Release height / field slope
- Actual throw distance — `estimateDist()` gives an approximation (`80 + speed×25` ft base, scaled by power and glide factor), but it is not physics-based; it is a rough heuristic useful for relative comparison only
- Crosswind drift

---

## 11. Rendering Sizes

| Context | W × H | sc | arc stroke |
|---------|-------|----|------------|
| Bag list thumbnail | 50 × 80 | 1.0 | 2px |
| Bag detail modal | 220 × 350 | 4.4 | 3px |
| Field view overlay | 400 × 380 | 8.0 | 2.5px |
| Flight Shaper main | 280 × 420 | 5.6 | 3.5px |

The same `arcPoints()` function runs for all sizes. All geometry scales linearly with `sc = W/50`.

---

## 12. Files

| File | Role |
|------|------|
| `templates/index.html` | Bag view, field view, bag-arc thumbnails and detail modal. Contains `arcPoints()` without hyzerLaunch or modifier sliders. |
| `templates/flightshape.html` | Flight Shaper page. Contains `arcPoints()` with `hyzerLaunch`, modifier sliders, ghost arc, release angle reference diagrams. |
| `templates/discsuggestion.html` | Disc suggestion page (nav only, no arc rendering). |
| `app.py` | Flask backend — serves templates, handles auth, CRUD for bag/library. No physics. |
| `disc_tracker.db` | SQLite — users, discs, library. |

---

## 13. Suggested Improvement Areas (Priority Order)

1. **Calibrate modifier magnitudes** against real disc footage or PDGA data. The current values are plausible but untested. Even finding 3–4 known "throw nose-up with this disc → it flips" cases and verifying the modifier produces a matching arc would be a meaningful check.

2. **Nonlinear nose pitch model**: Below ~5° nose up the effect is minimal; above ~12° the disc stalls violently. A sigmoid or piecewise function would be more accurate than the linear coefficient.

3. **Speed-aware landing offset**: The current `(turnAmt - fadeAmt*1.25)` doesn't account for speed. A disc that's too slow to reach the turn phase (low arm speed, high disc speed) should have a landing that only reflects fade. This partially exists in the arm speed modifier but isn't baked into the endX formula directly.

4. **Crosswind**: Currently omitted. A crosswind would shift the entire flight path laterally — visually a horizontal translation of the arc, not a change in shape.

5. ~~**Turn/fade phase timing via glide**~~ — **Done**: `k = fadeAmt×0.3 + glide×0.05 + turnAmt×0.08` now includes `turnAmt`, so understable discs (high turnAmt) produce a more pronounced S-curve overshoot past the apex.
