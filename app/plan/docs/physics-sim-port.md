# Physics-Sim Port — Scoping & Decision Doc

> **Status:** scoping only, no code written. Produced 2026-07-29 after Logan re-sequenced the
> roadmap: **the shotshaper physics sim comes before R5 (VPS sync).** This doc weighs the two
> ways to get it into the app so Logan can pick before any build. Call the chosen work **R4.5**
> (slots between the now-complete R4 and R5).

## What this is (and isn't)

The **"Physics sim" mode** in the website's Flight Shaper is a real rigid-body disc-flight
simulator — the vendored [shotshaper](https://github.com/kegiljarhus/shotshaper) engine
(GPLv3, "that other guy's" code), backed by wind-tunnel/CFD-derived lift/drag/moment
coefficients and two papers in `app/references/`. On the website it runs **server-side only**
(`POST /api/shotshaper_sim` in `app.py`) because it needs NumPy + SciPy.

**Do not confuse this with `physicsV2.ts`** (RESEARCH.md §7). That's a *different, unbuilt* thing:
an improved *empirical* timestep model tuned against real throws. This doc is **only** about
porting the shotshaper CFD sim — the vendored engine Logan has been emphatic about never
modifying (`vendor/shotshaper/` is untouched; every website refinement only changes the
*parameters* passed into its unmodified API).

It was cut from v1 scope for exactly one reason: **server dependency**, which collides with the
hard constraint *"do not make the app depend on the Flask server."* That collision is the whole
decision.

## How the server feature works today (the thing we're porting)

`POST /api/shotshaper_sim` (`app.py:440`) takes the disc's PDGA speed + the five slider values
(hyzer/nose/wind/crosswind/arm/spin) + arcView + weight, and:
1. Picks one of **4 driver archetypes** (`cd1`/`cd5`/`dd2`/`fd2`) — no putter/mid data exists
   upstream. The app's `pickArchetype()` equivalent would choose the nearest.
2. Approximates launch speed + spin from PDGA speed (calibrated to shotshaper's own example
   throw), clamps mass to 0.140–0.200 kg (real disc weight).
3. Sets a 3-axis wind vector (headwind = x, crosswind = y).
4. Calls the **unmodified** `DiscGolfDisc.shoot(...)`, which integrates the trajectory.
5. Returns `{points: [[x,y], …]}` — the app would draw these instead of the legacy Bézier arc.

The engine itself (`vendor/shotshaper/projectile.py`, ~600 lines) rides on:
- **`scipy.integrate.solve_ivp`** — adaptive RK45 ODE integration with **event functions**
  (`hit_ground`, `stopped`) that terminate the solve. This is the hard part to replace.
- **`scipy.interpolate.interp1d`** over the Cl/Cd/Cm coefficient curves loaded from the 4
  archetype **YAML files** (`vendor/shotshaper/discs/{cd1,cd5,dd2,fd2}.yaml`).
- Rigid-body frame transforms (`transforms.py`, ~68 lines) and `empirical_spin`.

---

## Path A — Opt-in call to the sim on your VPS  *(recommended)*

Mirror exactly the R4 pattern we just shipped: an **opt-in, off-by-default** Flight-Shaper
toggle that `POST`s to `/api/shotshaper_sim` on Logan's own server, renders the returned points,
and **degrades silently to the legacy Bézier arc** when off / offline / on error.

**Pros**
- **Keeps the real, validated engine untouched.** Zero risk of the ported model disagreeing
  with the paper-backed one — because it *is* the same engine. Honors "never change the physics
  model" completely.
- **Small, known effort.** The server route already exists. Work is: a toggle, a fetch, a
  point-renderer (the website's `renderSimPath` is the reference), archetype auto-select, the
  caveat banner for slow discs. Days, not weeks.
- **Architecturally consistent with where the roadmap is heading.** R5 (VPS sync) and R4
  already establish "opt-in, your own server, single host, degrade offline." This is a third
  instance of the same well-worn pattern, and it can share the server-URL config R5 needs.
- **F-Droid-clean** on the same terms as R4/R5: no request unless the user opts in and hits
  "simulate"; single host = the user's server; falls back offline.

**Cons**
- **This mode is not local-first.** It needs Logan's VPS reachable — won't work airplane-mode,
  and won't work at all for an F-Droid user who never sets a server. (Acceptable *if* framed as
  an explicitly-online "lab" mode, like the website treats it — but it's a real asterisk on the
  otherwise fully-offline app.)
- **Depends on the Flask server** — the one thing the hard constraints forbid for *core*
  features. Only defensible because it's opt-in and non-core (legacy arc remains the default,
  fully offline). Needs Logan's explicit blessing that "opt-in + degrades" satisfies the rule,
  same judgment call R4 required.
- Rides on R5's infra long-pole anyway: the VPS is bare-IP `http://` today, so any
  token/one-real-host story wants TLS + a domain first (see [[project-track-priorities]]).

## Path B — Reimplement the engine on-device in TypeScript

Port `projectile.py` (+ `transforms.py` + the 4 YAML coefficient tables) to TS so the sim runs
fully offline with no server.

**Pros**
- **Truly local-first** — no server, works airplane-mode, works on F-Droid with no config.
  The philosophically "right" answer for a FOSS local-first app.
- No new network surface at all.

**Cons**
- **It re-derives the model Logan has protected.** The constraint isn't just "don't edit the
  vendored files" — it's "don't rewrite the physics model." A TS reimplementation *is* a rewrite,
  and any divergence (integrator tolerances, interpolation kind, coefficient rounding) changes
  results in ways that are hard to prove faithful.
- **No SciPy in JS.** Must hand-roll (or add a dep for) an **adaptive RK45 `solve_ivp` with
  event detection** — the terminate-on-ground/stopped logic is the crux and the easiest thing
  to get subtly wrong. Plus `interp1d` (linear/cubic) over the coefficient curves. Realistically
  ~700 lines of physics + a validated ODE solver + bundling/parsing the YAML tables as JSON.
- **Weeks, not days**, and it needs a fixture harness proving the TS output matches the Python
  engine within tolerance across the scenario grid before it could be trusted — otherwise it's
  a *worse* sim wearing the same badge.
- Adds bundle weight (coefficient tables) and a nontrivial maintenance surface, against the
  F-Droid "keep deps + code minimal" posture.
- **Still driver-only.** Upstream has no putter/mid coefficients — so even done perfectly, the
  slow-disc caveat banner stays. The extra effort doesn't buy more coverage.

---

## The model-agreement finding bears on this

CLAUDE.md already records a one-off diagnostic: the legacy Bézier arc and the shotshaper sim
**disagree most at the neutral baseline**, and they're different first principles (empirical
curve-fit vs. integrated CFD) that "will keep disagreeing on shape regardless of input — not a
bug in either engine." So the sim isn't a "more accurate legacy arc"; it's a *different lens*.
That reframes the port as **"give the app the same experimental second-opinion lens the website
has,"** not "upgrade the app's arc." Which argues for the cheapest faithful route (Path A) over
an expensive reimplementation (Path B) whose whole value proposition is fidelity to an engine
you could just call directly.

## Recommendation

**Path A (opt-in VPS call).** It honors "never rewrite the model" outright, matches the R4/R5
pattern, is days of work, and treats the sim as the explicitly-online lab mode it already is on
the website. Path B's only real win — offline/F-Droid-native — is undercut by the fact that it
must reimplement a protected model and still can't cover putters/mids. Revisit Path B only if a
future "sim works with no server, ever" requirement becomes a hard goal.

## Open questions for Logan before building Path A

1. **Constraint blessing:** OK to treat an *opt-in, off-by-default, degrades-offline* server
   call as compatible with "don't depend on the Flask server," exactly like R4/R5? (If not →
   Path B or shelve.)
2. **Infra ordering:** do this against the current bare-IP `http://` VPS for now, or wait for
   the R5 TLS+domain work so the sim and sync share one hardened server config? (Leaning: share
   the config — build the server-URL setting once, in R5, and have the sim reuse it.)
3. **F-Droid framing:** the store build ships with no server set → the sim toggle is simply
   unavailable/greyed with a "needs your server" note. Acceptable?
4. **UX placement:** reuse R2's Flight-Shaper layout — sim toggle + archetype picker + caveat
   banner next to the arc-view selector, swapping `renderSimPath` points for the Bézier arc,
   exactly as the website does?
