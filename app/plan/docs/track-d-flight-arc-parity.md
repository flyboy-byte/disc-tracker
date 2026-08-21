# Track D, sub-tracks 1–2 — flight-arc + stability parity fixtures

**Status: done, 2026-08-21.** Part of `PLAN.md`'s engineering-hardening track.

## What this closes

`static/physics.js` (website, canonical per `CLAUDE.md`) and `app/src/utils/legacyPhysics.ts`
(app port) were hand-verified identical at port time, but nothing kept asserting that — a
future edit to one side with the other forgotten would ship silently. Same gap existed for
`stab()` (turn+fade → overstable/stable/understable), duplicated in `static/physics.js` and
`app/src/utils/disc.ts`.

## How it works

- `static/generate-flight-arc-fixture.js` — generates vectors straight from `physics.js`
  (the canonical implementation) across 8 representative disc archetypes × 8 slider
  combinations × 4 arc views, plus a stability case per archetype. Run directly to regenerate:
  ```
  node static/generate-flight-arc-fixture.js > fixtures/flight-arc-vectors.json
  ```
- `fixtures/flight-arc-vectors.json` — the checked-in output, 529 vectors.
- `static/physics.fixture.test.js` — website side. Re-runs the generator and diffs against the
  checked-in fixture. A mismatch means `physics.js` changed behavior without regenerating the
  fixture (verified to actually fail on a deliberate tamper, then confirmed clean).
- `app/src/utils/legacyPhysics.fixture.test.ts` — app side. Loads the **same** JSON file and
  asserts `legacyPhysics.ts`'s `applyModifiers`/`arcPoints` and `disc.ts`'s `stab()` reproduce
  every vector within `1e-6`. 264 assertions, all passing as of this fixture.

Same pattern as the existing `app/src/physics/sim/parity.test.ts` precedent (physics-sim vs.
vendored `shotshaper`) — extended here to the legacy flight-arc math instead of inventing a new
approach.

Both CI workflows run their side: `website-ci.yml` runs `physics.fixture.test.js`; `app-ci.yml`'s
plain `jest` run picks up `legacyPhysics.fixture.test.ts` automatically.

## Sub-track 3 (Disc Suggest scoring) — deliberately NOT started

`PLAN.md` already flags this: `templates/discsuggestion.html`'s scoring is still the pre-B1
12-scenario boolean-threshold model; `app/src/utils/suggestScore.ts` is the full B1-era rewrite
(continuous scoring, bands, skill/throw-style modifiers, 13 scenarios including Flex Shot). This
is a **real, confirmed divergence**, not a hypothetical gap — fixture-based parity testing can't
apply until Logan decides whether to backport the unified scorer to the website (closing the gap)
or explicitly document it as an intentional exception. Not implemented here; flagged for a
separate decision.
