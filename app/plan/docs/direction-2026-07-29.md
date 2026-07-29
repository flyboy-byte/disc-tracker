# Direction — 2026-07-29 re-plan (post-R4.5 pivot)

> Supersedes the R5-centric tail of the Post-v1 Roadmap in `../../PORT_PLAN.md`. Written after
> Logan reconsidered whether VPS sync is worth building and raised two new priorities. R1–R4.5 are
> done and shipped (`mobile-preview-0.9`). This doc is the current build direction; the roadmap
> table in PORT_PLAN.md is updated to match.

## The pivot in one line

**Stop treating sync as the next feature.** Portability is already solved by CSV. The two things
that actually make the app better are **handling bigger collections** and **making disc
suggestions good enough to trust**. Distribution (Play → F-Droid) is still the endgame.

---

## Decision 1 — VPS sync: DEFERRED, kept researched-and-ready (not killed)

**Logan's steer (2026-07-29):** sync is genuinely cool and personally useful — it's **not being
cut.** But it's also not obviously the next thing to build, so it stays where it's been: *deferred,
researched, and ready to implement* when we choose to, rather than on the immediate path. These are
the questions that put it there:

- CSV export/import already ships on both app and website — that already covers backup, new-phone
  migration, and interop. So sync's *unique* value is narrower than it first looks: live web↔app
  convergence, mostly for **desktop use** (which Logan does want personally).
- Against that value sits real cost: an always-on server dependency, a Play **Data Safety**
  declaration + privacy-policy section, an F-Droid network-feature review, and ops.
- So the honest status is **"valued, designed, and parked one step back"** — it can move *toward*
  implementation again (as it has before) whenever the desktop-convergence itch outweighs that cost,
  or a real multi-device / shared-bag need appears.

**What "researched-and-ready" means concretely:** `sync-design.md` stays the living design (manual
backup/restore, single `SYNC_TOKEN` in secure-store, HTTPS, plaintext-at-rest). Two loose ends to
close *when* it's picked up, not now: (1) confirm what's actually in front of `51.81.80.126`
(probe suggests a domain + TLS proxy already — see the correction below), and (2) the Data Safety /
privacy wording. Nothing else blocks it; it's a code task the day it's chosen.

**Correction folded in:** the old claim that the VPS is "bare IP, no TLS" and that this was sync's
blocker was an unverified assumption. A 2026-07-29 probe suggests a reverse proxy + Host-based
routing (likely a domain + cert already). Fixed in `sync-design.md`.

**Meanwhile, CSV is the shipping portability story.** Optional cheap hardening if we ever want it:
a round-trip fidelity check (every field incl. `in_bag`/color/notes survives export→import on both
app and web, and the two CSV dialects match). No work needed unless a gap turns up.

---

## Decision 2 — Big collections (scope: ~200 discs)

Today's fixtures are 3 discs; the app is bag-centric (the website's model). A 200-disc *collection*
is a different mode from a ~15-disc *bag*, and two real cliffs appear well before 200.

### Performance (measure first, then fix only what's slow)
- **FieldView is the hard cliff.** It renders *every filtered disc's* arc into **one un-virtualized
  SVG** with mold labels. At 200 that's 200 paths + 200 labels in a single SVG — slow to render and
  visually unreadable (overlapping arcs). Options, cheapest first: (a) cap FieldView to the
  **today's-bag subset** (naturally small — arguably its right scope anyway); (b) cap at N and show
  "+K more"; (c) cluster/heatmap instead of individual arcs. **Lean (a).**
- **`saveDiscs` does a full delete+reinsert of the entire table on every mutation** (edit, drag-end,
  in-bag toggle). At 200 rows that's 200 INSERTs per action inside one transaction. Measure the
  drag-end latency at 200; if it janks, move to incremental updates (update-one / reorder-only) —
  note this trades away the "shape sync will reuse" rationale, which is fine now that sync is parked.
- **Per-card arc thumbnails.** The bag list is virtualized (DraggableFlatList/FlatList), so only
  visible cards mount — but each card mounts a `FlightArcSvg`, heavier than a text row. If scroll
  janks at 200: memoize `DiscCard`, tune `windowSize`/`initialNumToRender`, or make thumbnails a
  toggle. Likely fine; verify before optimizing.

### Information architecture (the bigger question)
A flat 200-item sorted list is unusable regardless of perf. Directions to scope:
- **Bag vs. Collection split.** Promote "today's bag" (already modeled via `in_bag`) to the primary
  view; the full 200 becomes a searchable *archive/collection* behind it. Matches how players think.
- **Grouping/sections** — by type (Putter/Mid/Fairway/Distance) or stability, collapsible.
- **Filter chips already exist** (stability/type); search exists. Make them more central at scale.
- Tags/categories are possible but heavier; defer unless wanted.

**Recommendation:** treat this as its own workstream. First a **measurement spike** (generate a
200-disc fixture, profile FieldView + drag save + scroll), then do only the fixes that measure slow,
plus the **bag/collection IA split** as the one deliberate UX change.

### B2 — followable steps (measure before optimizing)
1. **200-disc fixture + on-device profile.** Load ~200 discs; time FieldView render, drag-end save,
   and scroll FPS on the emulator/device. Write down actual numbers — don't guess.
2. **Fix only what measured slow**, cheapest first: FieldView → today's-bag scope; `saveDiscs` →
   incremental update/reorder if drag-end janks; card thumbnails → memoize / tune FlatList windows.
3. **Bag/Collection IA split** (the one deliberate UX change): today's-bag as the primary view, the
   full set as a searchable collection/archive behind it. Ship only if the flat list feels unwieldy
   at the tested size.

---

## Decision 3 — Disc suggestions: rewrite (accuracy)

Logan: "not accurate enough to ship." Confirmed — and it's **structural**, not a tuning tweak
(`src/utils/scenarios.ts`). Current problems:

1. **Bag and library use different criteria.** `bagTest` matches on raw `turn`/`fade` thresholds;
   the library filter uses a precomputed `stability` scalar + speed + type. The same disc can pass
   one path and fail the other — incoherent.
2. **Binary pass/fail, barely ranked.** Bag matches aren't scored at all. Library is ranked only by
   |stability − midpoint|, ignoring speed/glide fit within the matched set.
3. **Brittle hard exclusions.** e.g. Max Distance requires `turn ≤ -0.5`, so a long *stable* driver
   is excluded outright rather than ranked lower.
4. **Ignores the thrower.** No arm-speed/skill input — recommends speed-14 to everyone.
5. **Pure heuristic on 4 numbers** — doesn't use the real measured flight data (DiscIt/Marshall
   Street) or the new on-device sim.

### Rewrite options
- **Option A — unified scoring model (chosen first cut).** Each scenario defines an *ideal flight
  profile* (target speed/glide/turn/fade or a weighted scoring function). **One** function scores
  every disc (bag + library alike) to 0–1, ranked, bucketed great / good / marginal. **Thrower model
  = skill presets (Logan's pick, 2026-07-29): Beginner / Intermediate / Advanced**, persisted in
  `user_meta` like arcView — each preset caps the recommended disc *speed* and shifts the ideal
  turn/fade targets (a beginner wants more understable/slower than an advanced player for the same
  scenario). Fast, offline, fully testable — fixes problems 1–4 directly.
- **Option B — sim-backed ranking (research spike, later).** Use the R4.5 shotshaper sim to *actually
  simulate* each candidate against the scenario (e.g. "into headwind" → simulate with headwind, rank
  by how well it holds the line and its distance) instead of heuristics. More principled, ties in the
  new engine — but heavier (≈candidates × sims), and still limited by driver-only archetypes (no
  putter/mid data), so it can't cover approach/mid scenarios well. **Not the first cut.**

### Research needed (the part Logan flagged)
- Define each scenario's *ideal profile* from a real source, not vibes: expert flight-number targets
  and/or the DiscIt/Marshall Street dataset. Validate the new scorer against a handful of
  known-correct picks per scenario before shipping.
- Decide the thrower model (single "power" slider? beginner/intermediate/advanced presets?).
- **Constraint check:** CLAUDE.md says *don't change suggestion behavior unless a bug is proven.*
  This is a deliberate, Logan-requested accuracy rewrite — so that guard is explicitly lifted **for
  this workstream**, but the rewrite must ship behind a parity/validation harness (fixtures of
  expected picks) so we can see exactly how behavior changes vs. the current website.

**Recommendation:** Option A + the research/validation harness now; Option B as a later spike only if
A still feels short and archetype coverage is judged good enough.

### B1 — followable steps (each its own small, verifiable commit)
1. **Capture today's behavior as fixtures.** For all 12 scenarios, record the *current* bag+library
   picks (from the live website / current `scenarios.ts`) into a fixture file. This is the baseline
   the rewrite is measured *against* — so we can see exactly what changed and defend it, per the
   "prove the change" rule.
2. **Define ideal profiles + skill presets** (the research step). For each scenario write its target
   flight-number profile; define how Beginner/Intermediate/Advanced shift speed cap + turn/fade
   targets. Source from expert flight-number consensus / the DiscIt dataset, not vibes. Pure data.
3. **Write the scorer** (`suggestScore.ts`, pure + unit-tested): `score(disc, scenario, skill) → 0–1`
   with great/good/marginal bands. One function, used for **both** bag and library (kills problem 1).
4. **Add the skill setting** to Settings (Beginner/Intermediate/Advanced pills, persisted in
   `user_meta`, default Intermediate) — small, mirrors the arcView pattern.
5. **Rewire the Disc Suggest screen** to rank by score (bag ranked too), show the band, and read the
   skill preset. Keep the 12-scenario grid UX.
6. **Validation pass:** diff new picks vs. the step-1 baseline per scenario; sanity-check a handful
   of known-correct picks; tune profiles. Ship when the diffs are defensible.

(B1 is self-contained and offline — no new deps, no network, no server. The `useMemo`-driven
Disc Suggest screen already recomputes cheaply.)

---

## Re-sequenced roadmap (replaces R5→R7 tail)

| Step | What | Status |
|------|------|--------|
| R5 | VPS sync (deferred, researched-and-ready — **not cut**) | On the shelf, not the path — CSV ships portability; revisit anytime (Decision 1) |
| **B1** | Disc-suggestion accuracy rewrite (Option A + validation harness) | Next — highest user-visible value |
| **B2** | Big-collection support (measurement spike → perf fixes + bag/collection IA) | After/with B1 |
| **R6** | Play signing + closed testing (D1) | Endgame — now unblocked (no sync paperwork) |
| **R7** | F-Droid (self-hosted → official index) | After Play; rubric = fdroiddata MR checklist (see `fdroid-reference.md`) |

Physics R&D (`physicsV2.ts`) is parked/obsolete (RESEARCH §7 note). `physics-sim-port.md` (R4.5)
is done. Pre-store manifest hygiene (SYSTEM_ALERT_WINDOW, expo-updates strip, permission re-audit)
still rides ahead of R6/R7.

## Decisions locked (2026-07-29)
- **Sync:** deferred, kept researched-and-ready — **not cut** (Logan values it personally). Revisit
  when desktop-convergence outweighs the cost, or a multi-device need appears.
- **Suggestions:** Option A (unified scoring) first; **thrower model = skill presets
  (Beginner/Intermediate/Advanced)**. Option B (sim-backed) is a later spike.

## Still-open (not blocking B1)
- **Big collections — is ~200 a real near-term target or forward-looking robustness?** Changes
  whether B2 is urgent or just a measurement spike. (Leaning: spike now, act on what measures slow.)
- **VPS domain** — what's actually in front of `51.81.80.126`? Only needed the day sync is revived.
