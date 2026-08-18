# Disc-Suggestion Scoring Model (B1, step 2)

> **Status:** BLESSED 2026-07-29 (Logan signed off on the caps/nudges/targets). Implemented as
> `src/utils/suggestScore.ts` (steps 3 + 6 done, 98/98 tests green). This doc is the source of
> truth for the numbers; keep it and `suggestScore.ts` in lockstep.
>
> **2026-08-15 addition (Phase 1 of `suggest-engine-plan.md`):** added a 13th scenario, **Flex
> Shot**, and a **throw-style modifier** (Backhand/Forehand, `user_meta.throw_style`) applied on
> top of whichever scenario is active — see the two new sections below. Also added a per-owned-
> disc **personal stability adjustment** (`discs.stability_adj`, -2..+2) that shifts `turn`/`fade`
> together before scoring, so a specific owned specimen (lightweight run, beat-in, etc.) can score
> differently from its own library entry — implemented in `disc.ts` `bagToDisc()`, not in this
> file (it doesn't touch `PROFILES`, just the disc passed in). Full context/roadmap:
> `plan/docs/suggest-engine-plan.md`.
>
> **Refinement found during step-6 validation:** symmetric tolerances wrongly penalized *overshoot*
> — a fade-4/5 disc scored ~0 for "Reliable Hyzer," excluding Firebird-class discs. Fixed by adding
> **one-sided tolerances** (`tolLo`/`tolHi`): overstable scenarios let fade overshoot freely, max
> distance lets fade undershoot freely, understable scenarios let turn go more-negative freely.
> After the fix the top picks are recognizable real discs (Heat/Jade for hyzer flip, Archangel for
> roller, FD3 for forehand, VRoc for approach). See the tolerance columns below.
>
> Replaces the old two-path logic (raw `bagTest` thresholds for the bag; `stability`-scalar filter
> + `|stability − mid|` sort for the library) with **one** scoring function used for both. The
> CLAUDE.md "don't change suggestion behavior" guard is explicitly lifted for this workstream
> (see `archive/direction-2026-07-29.md`).

## How scoring works (the shape step 3 implements)

`score(disc, scenario, skill) → 0..1`, one function, same for a bag disc and a library disc.

```
For each of the 4 flight numbers {speed, glide, turn, fade}:
    fieldScore = max(0, 1 − |actual − target| / tolerance)
score_raw   = Σ (weight_field · fieldScore) / Σ weight_field        // weighted mean, 0..1
score       = score_raw · speedCapPenalty                            // multiplicative gate
```

- **`speedCapPenalty`** enforces the skill preset's arm-speed ceiling *softly*: `1.0` at/below the
  cap, ramping down to `0.3` by `cap+3`, floored there (never a hard 0 — a too-fast disc is
  demoted, not deleted, matching how a real player *can* throw it, just not well). This directly
  fixes the baseline's brittle hard exclusions (finding #3 / problem #3).
- **Bands:** `great ≥ 0.75`, `good ≥ 0.55`, `marginal ≥ 0.35`, below → not shown. Bands (not a
  single hard filter) fix the "binary pass/fail" defect (problem #2). Bag and library ranked the
  same way (fixes problem #1).
- **Ties** broken by `score` first, then closeness-to-target-speed, then name — deterministic
  across engines (kills baseline finding #2).

`turn` uses the disc-golf sign convention (0 = overstable-neutral, negative = understable, e.g.
−3 = very understable). `fade` is 0..5, positive.

## Skill presets (thrower model — Logan's pick 2026-07-29)

Persisted in `user_meta.skill` like `arcView`. Default **Intermediate**. The preset's **dominant**
effect is the speed cap (arm speed is the real physical limiter); the stability/glide biases are
gentle nudges layered on top of each scenario's own targets — they must **not** flip an overstable
scenario understable, only soften it.

| Preset | `speedCap` | `stabilityBias` (added to net turn+fade target) | `glideBias` (added to glide target) | Rationale |
|--------|-----------|--------------------------------------------------|--------------------------------------|-----------|
| **Beginner** | 9 | **−0.5** (nudge understable) | **+0.5** | Low arm speed: high-speed/OS discs fade out early; US + glide = distance and control |
| **Intermediate** | 13 | 0 (targets as written below) | 0 | Baseline the profiles are authored at |
| **Advanced** | 14 | **+0.5** (nudge overstable) | 0 | High arm speed flips US discs; can hold more OS/fast discs on line |

`stabilityBias` is applied by shifting the `turn` target by the bias (keeping fade target fixed) —
so Beginner pulls the ideal turn ~0.5 more negative, Advanced ~0.5 more positive, and an overstable
scenario like Headwind (turn target 0, fade 4) stays overstable for everyone.

## Ideal profiles — authored at the Intermediate baseline

Targets are the *ideal* disc for the shot; tolerances set how fast score falls off; weights say
which numbers define the shot (higher = matters more). Sourced from flight-number consensus, not
vibes; validated against the step-1 baseline picks in step 6.

| Scenario | speed (tgt/tol/wt) | glide (tgt/tol/wt) | turn (tgt/tol/wt) | fade (tgt/tol/wt) | Notes — what defines the shot |
|----------|------|------|------|------|------|
| **Dead Straight** | 7 / 4 / 0.5 | 5 / 2 / 1 | −1 / 1 / **2** | 1 / 1 / **2** | net stability ≈ 0; turn+fade dominate, speed loose |
| **Reliable Hyzer** | 9 / 4 / 0.5 | 4 / 2 / 0.5 | 0 / 1.5 / 1 | 3.5 / 1 / **2.5** | *fade* is the point (finishes left) |
| **Max Distance** | 13 / 2 / **1.5** | 6 / 1 / **1.5** | −1.5 / 1.5 / 1 | 1.5 / 1.5 / 0.5 | high speed + glide, slightly US, not a fade bomb |
| **Into Headwind** | 9 / 3 / 0.5 | 3 / 2 / 0.5 | 0 / 1 / **1.5** | 4 / 1 / **2.5** | max overstable, low glide holds into wind |
| **Tailwind** | 10 / 3 / 0.5 | 5 / 2 / 1 | −2.5 / 1 / **2** | 0.5 / 1 / 1 | understable to counter the tailwind's OS push |
| **Turnover** | 9 / 3 / 0.5 | 5 / 2 / 1 | −3.5 / 1 / **2.5** | 0.5 / 1 / 1 | holds an anhyzer line — very US, low fade |
| **Forehand** | 9 / 4 / 0.5 | 4 / 2 / 0.5 | 0 / 1 / **2** | 2.5 / 1.5 / 1 | resists sidearm's added turn → *turn* dominates (vs. hyzer's fade) |
| **Tomahawk** | 11 / 3 / 1 | 3 / 2 / 0.5 | 0 / 1.5 / 1 | 3.5 / 1.5 / **2** | overhead: fast + overstable, low glide |
| **Approach** | 4 / 2 / **1.5** | 4 / 2 / 0.5 | 0 / 1.5 / 1 | 1.5 / 1 / **1.5** | slow, controlled, gentle fade into the green |
| **Accurate Mid** | 5 / 1.5 / **1.5** | 5 / 2 / 0.5 | −0.5 / 1 / 1 | 1.5 / 1 / **1.5** | predictable mid, slight fade, hits gaps |
| **Hyzer Flip** | 9 / 3 / 1 | 6 / 1 / 1 | −2.5 / 1 / **2** | 1 / 1 / 1 | US enough to flip up, glide to hold flat |
| **Roller** | 10 / 3 / 0.5 | 6 / 1 / 1 | −4 / 1.5 / **2.5** | 0.5 / 1 / 1 | very US, low fade → runs on the ground |
| **Flex Shot** | 12 / 3 / 1 | 5 / 1.5 / 0.5 | −2 / 1 / **2** | 2 / 1 / 1.5 | turns on release, fades back straight — distinct from Turnover (holds anhyzer, barely fades) and Hyzer Flip (starts hyzer, flips flat at fairway speed) |

## Throw style — a modifier, not a 13th competing scenario (added 2026-08-15)

A forehand-dominant thrower doesn't just want "the Forehand scenario" — they forehand turnovers,
hyzer flips, flex shots, power hyzers, everything. So instead of adding more forehand-flavored
scenarios, throw style is a second, independent bias axis layered on **whichever** scenario is
active, the same mechanism as the skill-preset biases above (additive shift on the authored
target). Persisted in `user_meta.throw_style`, editable in Settings next to Skill Level.

| Style | `turnBias` | `fadeBias` | Rationale |
|-------|-----------|-----------|-----------|
| **Backhand** | 0 | 0 | The authored baseline — deliberate no-op, existing behavior unchanged |
| **Forehand** | **+0.5** | **+0.5** | Forehand power naturally overpowers turn and benefits from a touch more fade for control — nudges every scenario's ideal a bit more overstable |

The pre-existing `forehand` scenario card (row above) is unchanged and stays — it's still a useful
"forehand power/hyzer" shortcut on its own. Whether it should later be renamed or folded away now
that the toggle exists is an open call, not decided yet (see `suggest-engine-plan.md`).

### Distinctions the model deliberately encodes (that the baseline lost)
- **Hyzer vs. Forehand** — baseline returned *identical* library lists. Here: Hyzer weights **fade**
  (2.5) with a loose turn; Forehand weights **turn** (2.0) with less fade (2.5 target vs 3.5). Now
  they rank differently.
- **Max Distance** weights speed+glide (1.5 each) and only *lightly* penalizes fade, so a long
  *stable* driver ranks well instead of being hard-excluded by the old `turn ≤ −0.5` gate.
- **Approach vs. Accurate Mid** — both slow/controlled, separated by target speed (4 vs 5) and
  Approach's tighter low-fade emphasis.

## Open questions for review (fast to answer)
1. **Preset speed caps** — Beginner 9 / Intermediate 13 / Advanced 14 reasonable? (Beginner 9 = "up
   to a fairway driver"; some would say 7–8.)
2. **Beginner stabilityBias −0.5** — right direction and magnitude, or should beginners get a
   *stronger* understable pull (−1)?
3. **Any scenario target that reads wrong to you** as a disc golfer — the table is where your eyes
   matter most. Everything downstream (scorer, tests) is mechanical once these numbers are blessed.
