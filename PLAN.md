# Disc Tracker — Engineering Hardening Plan

**Status: not started. Last updated 2026-08-21.**

This is the project's first root-level `PLAN.md` — until now, planning lived entirely in
`app/plan/` (mobile feature work) with nothing tracking cross-cutting engineering quality
across both the website and the app. This doc exists to fix that gap for one specific,
bounded body of work: the hardening track that came out of an external technical review
(ChatGPT, 2026-08-21) of the project at `v0.25`. It is not a replacement for
`app/plan/FRAMEWORK.md` (mobile feature phases) or `app/PORT_PLAN.md` (the mobile port's
own history) — those keep tracking feature work exactly as they do today.

**Read `app/plan/GRAVEYARD.md` before reviving anything below if it's been a while** — the
usual disclaim-and-recheck rule applies here too.

## Why this exists

The external review's core finding, and the one worth taking seriously: this project's
*test coverage and device-verification discipline* are real and materially reducing risk
(154/154 Jest, `tsc --noEmit` clean, real Pixel 7 verification before every release), but
its *enforcement* is entirely manual — nothing in CI runs any of it. Two real bugs shipped
in the last two releases (`SYSTEM_ALERT_WINDOW` undisclosed in every release build, v0.24's
full backup silently dropping swipe/learning state) were both caught by hand, after the
fact, by someone actually going and checking. Both are exactly the shape of bug an
automated check would catch on every single commit, not just when someone remembers to
look.

Separately, the review flagged real architectural debt: three independent implementations
(Python/Flask, vanilla JS, TypeScript/Expo) of the same flight-arc math and disc-suggestion
scoring, with "the website wins when they disagree" as a documentation claim, not a machine-
checked one. One genuine precedent already exists for the fix — `app/src/physics/sim/` (the
on-device physics-sim port) is already "parity-gated" against the vendored Python
`shotshaper` engine via `app/src/physics/sim/parity.test.ts`. Nothing else in the codebase
gets that treatment yet.

## What this plan does *not* cover

- **Release cadence / pace.** The review's "freeze around v0.25 for a while" recommendation
  is a judgment call about priorities, not an engineering task — explicitly Logan's to
  decide, not something this plan enacts. Nothing below assumes a freeze or assumes it
  doesn't happen.
- **New user-facing features.** Every track here is test/CI/tooling infrastructure. None of
  it changes app or website behavior.
- **A rewrite or a shared library.** The review explicitly recommended against this
  ("architecture astronautics") and this plan agrees — Track D below is fixtures, not a
  merged codebase.

## Tracks

Five independent tracks. Pick any order; none blocks another except where noted. Each has
a concrete Definition of Done — "done" here means a real CI run enforcing it, not a doc
saying it should exist.

---

### Track A — CI: enforce the existing test suite on every push

**Priority: P0 · Effort: S (half a day) · Depends on: nothing**

**Problem.** `.github/workflows/` currently only deploys GitHub Pages. The 154 Jest tests,
`tsc --noEmit`, and the website's own `physics.test.js` are real and passing today, but
that's only true because someone runs them by hand before a release — nothing stops a
broken commit from landing on `main`.

**Scope.**
- New workflow, mobile app: on every push/PR touching `app/`, run (in `app/`) `npm ci`,
  `tsc --noEmit`, `jest`. Matches the exact commands already used by hand every session —
  no new tooling, just running what already exists on a schedule instead of by memory.
- New workflow (or a job in the same file), website: on every push/PR touching root-level
  Python/JS files, run `node static/physics.test.js` and a Python syntax check
  (`python3 -m py_compile app.py`, matching what `deploy.sh` already does pre-deploy —
  this just moves that check earlier, to PR time, not just deploy time).
- Both jobs fail the check (red X on the commit/PR), don't just log a warning.

**Definition of done.** A deliberately broken PR (e.g. a wrong assertion in an existing
test) shows a failing check in the GitHub UI before merge, not after.

**Non-goals for this track.** Playwright (`tests/ui-smoke.spec.js`) is deliberately
excluded here — it needs a running Flask server + browser binaries, meaningfully heavier
CI setup than a plain `npm test`. That's Track E.

---

### Track B — Backup round-trip test + a persistence registry

**Priority: P0 · Effort: M (1–2 days) · Depends on: nothing**

**Problem.** v0.24 fixed a real bug: full backup silently omitted the new
`suggest_demotions`/`suggest_learning` tables until someone noticed by hand. The backup
was "logically complete" right up until a new persistent feature shipped and nobody told
the serializer. Nothing structurally prevents this from recurring — there's no single
place that enumerates "everything persistent" against "everything the backup covers."

**Scope.**
1. **Round-trip test** (`app/src/utils/backup.test.ts`, extending the existing suite):
   seed one row in *every* persistent table (`discs`, `user_meta`, `rounds` + children,
   `custom_discs`, `suggest_demotions`, `suggest_learning`) via the real `db.ts` write
   functions (not hand-built fixtures — this must exercise the actual insert path), call
   `buildBackup()`, wipe every table, call `parseBackup()` + the real restore functions,
   assert the restored state matches the seeded state field-for-field.
2. **Persistence registry**: a single exported list/type in `db.ts` (or a new
   `src/db/persistence.ts`) enumerating every table that holds user data, each entry
   tagged with whether `backup.ts` currently covers it. The round-trip test in (1) iterates
   this list rather than a hand-maintained table name array — so adding a new persistent
   table without updating the registry is a compile error or an assertion failure, not a
   silent gap.

**Definition of done.** Deliberately add a new SQLite table via a migration, don't touch
`backup.ts` — the round-trip test fails, naming the table it doesn't know how to back up.

---

### Track C — CI: Android manifest permission allowlist

**Priority: P1 · Effort: M (1 day, mostly CI environment setup)· Depends on: nothing**

**Problem.** `SYSTEM_ALERT_WINDOW` shipped undisclosed in every release build for an
unknown number of releases before the 2026-08-20 privacy audit caught it by hand-reading
the manifest. `app.json`'s `blockedPermissions` and the `withAllowBackupDisabled` config
plugin fix the two known cases — they don't stop a *third*, not-yet-discovered case from
shipping the same way, since nothing currently re-checks the manifest fdroidserver-style,
i.e. after Expo's config-plugin merge, on every build.

**Scope.**
- CI job: `npx expo prebuild -p android --clean` (the exact regeneration step already
  proven this session to reveal what actually ships, vs. what a stale committed `android/`
  folder implies), then parse the resulting `android/app/src/main/AndroidManifest.xml`'s
  `<uses-permission>` list.
- Compare against an explicit allowlist committed in the repo (start with exactly the 4
  permissions `docs/privacy.html` already discloses: `INTERNET`,
  `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `VIBRATE`). Fail the build if the
  merged manifest contains anything not on that list.
- Needs Android SDK + the `expo` CLI available in the CI runner — heavier setup than
  Track A's plain Node job (a `setup-android`-style GitHub Action, or reusing a prebuilt
  image). This is why it's scoped as its own track rather than folded into Track A.

**Definition of done.** Manually add `SYSTEM_ALERT_WINDOW` back to `main/AndroidManifest.xml`
in a test branch — the CI job fails, naming the unapproved permission, without needing a
human to think to check.

---

### Track D — Canonical cross-language test fixtures

**Priority: P1 · Effort: L (multi-day, ongoing) · Depends on: nothing, but benefits from
Track A existing first (so the new fixture tests actually run on every push)**

**Problem.** "The website wins when Python/JS and TypeScript disagree" is a sentence in
`CLAUDE.md`, not something any test asserts. Flight-arc math (`static/physics.js` ↔
`legacyPhysics.ts`), stability classification, and Disc Suggest scoring
(`suggestScore.ts` has no Python/JS counterpart to check against, since the website's own
scoring logic — check whether the website even has an equivalent scorer or only the app
does) all exist in more than one implementation with no shared ground truth.

**Precedent already in the codebase, extend it rather than inventing a new pattern:**
`app/src/physics/sim/parity.test.ts` already does exactly this for the on-device
physics-sim engine against the vendored Python `shotshaper` — it's the one place in this
codebase where "matches the reference implementation" is a real assertion, not a claim.

**Scope (do these in order, each independently shippable):**
1. **Flight-arc parity**: generate a JSON fixture file (`fixtures/flight-arc-vectors.json`
   or similar) — N representative `(speed, glide, turn, fade, hyzer, nose, wind, arm,
   spin)` input tuples with their expected output arc points, computed once from the
   website's `static/physics.js` (the acknowledged canonical implementation). Add a test
   on the website side (`static/physics.test.js`) and one on the app side
   (`legacyPhysics.test.ts`) that both load the *same* fixture file and assert their own
   implementation reproduces it within a documented tolerance.
2. **Stability classification parity**: same pattern, smaller surface — `(turn, fade) →
   OS/ST/US` should be trivially identical everywhere; a fixture makes that provable
   instead of assumed.
3. **Disc Suggest scoring — confirmed already diverged, verified 2026-08-21.**
   `templates/discsuggestion.html`'s `SCENARIOS` array still uses the pre-B1 baseline
   model: 12 hand-tuned boolean `bagTest` threshold functions per scenario (e.g.
   `d => d.fade >= 3 && d.turn >= -1`), no bands, no skill presets, no throw-style bias,
   no Flex Shot scenario. `app/src/utils/suggestScore.ts` (mobile) is a full B1-era
   rewrite: one continuous scoring function, great/good/marginal bands, skill/throw-style
   modifiers, 13 scenarios. This is not a hypothetical parity gap to check for — it's a
   real, already-confirmed one. Fixture-based parity testing can't apply here until a
   real decision is made: either backport the unified scorer to the website (closing the
   gap, matching "website is canonical" going forward) or explicitly document this one
   feature as an intentional exception to that rule. Flag to Logan before starting this
   sub-track — it's a scope decision, not a testing task.

**Definition of done, per sub-track.** A fixture file exists, is loaded (not
copy-pasted) by test files on both sides of the language boundary, and a deliberately
introduced discrepancy in one implementation fails that implementation's test — not the
other one's.

---

### Track E — Website test coverage (`tests/` beyond one Playwright spec)

**Priority: P2 · Effort: L (ongoing) · Depends on: Track A (CI) existing to actually run
these on push, not just locally**

**Problem.** The review's framing is accurate: "your port has stronger automated
protection than your spec." `tests/ui-smoke.spec.js` is the only Playwright coverage for
the website — the *canonical* implementation per this project's own stated architecture.

**Scope (not fully speced here — this is the one track this plan deliberately leaves as a
direction, not a checklist, since it should be driven by what's actually fragile rather
than covering everything uniformly):**
- Start from what `ui-smoke.spec.js` already covers (card `data-id`/drag-reorder, filter
  pills, physics-sim crosswind/dir-hint sync, CSV export/import round-trip) and identify
  the highest-value gaps — candidates: the CSRF-protected POST routes, the Marshall
  Street image-proxy fallback behavior, multi-user profile switching, the `/api/data`
  full-export/import round-trip (website's own version of Track B's backup test).
- Each new spec should target a specific fragility class already documented in this
  project's own history (e.g. `risks.md`'s technical section), not just "more coverage
  for its own sake."

**Definition of done.** No single fixed target — track progress as "specs added, each
tied to a named risk it closes," reviewed periodically rather than checked off once.

---

## Sequencing

No hard dependencies between A/B/C/D's first sub-track — any could go first. Recommended
order, if picking one: **A, then C, then B, then D, then E** — A is the cheapest and makes
every other track's tests actually enforced once written (not just runnable), C directly
closes the exact gap the review called out as this session's "most useful recent
failure," B closes the exact gap that caused the v0.24 bug, D is the largest and most
open-ended so benefits from A/B/C's smaller wins landing first, E is explicitly ongoing
rather than a one-time deliverable.

## Out of scope, explicitly, per the review's own framing

Course maps, friends/social, public profiles, tournament discovery, cloud sync — none of
that is in this plan, and none of it should be. This plan is entirely about making the
*existing* scope more provably correct, not expanding scope. See `app/plan/GRAVEYARD.md`
for the project's existing discipline around declining scope creep — this plan is the same
discipline applied to engineering process instead of features.
