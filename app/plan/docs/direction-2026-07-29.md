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

## Decision 1 — VPS sync: PARKED (CSV is the portability story)

**Logan's own argument, which holds up:** CSV export/import already ships on both the app and the
website. That already covers backup, moving to a new phone, and interop with any spreadsheet/tool.
The *only* thing sync adds on top is live web↔app convergence for desktop use — and for a ~30-disc
bag that rarely changes, that convenience doesn't justify:
- an always-on server dependency (however opt-in),
- a Play **Data Safety** declaration + privacy-policy section for network data,
- an F-Droid network-feature review,
- and the ops surface (the "is there TLS?" question — see the correction below).

**Verdict: park R5.** Keep `sync-design.md` for provenance; it's a good design if the need ever
becomes real (e.g. genuine multi-device editing, or a shared/household bag). Not deleted, just off
the active path.

**Correction folded in:** the old claim that the VPS is "bare IP, no TLS" and that this was sync's
blocker was an unverified assumption. A 2026-07-29 probe suggests a reverse proxy + Host-based
routing (likely a domain + cert already). Fixed in `sync-design.md`. Moot now that sync is parked.

**Cheap CSV follow-ups (optional, if we want to strengthen the portability story instead of sync):**
- Round-trip fidelity check: confirm every field (incl. `in_bag`, color, notes) survives
  export→import on both app and web, and that the two CSV dialects are identical.
- A one-tap "share to yourself" is already there (OS share sheet). Good enough; no work needed
  unless a gap turns up.

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
- **Option A — unified scoring model (recommended first cut).** Each scenario defines an *ideal
  flight profile* (target speed/glide/turn/fade or a weighted scoring function). **One** function
  scores every disc (bag + library alike) to 0–1, ranked, bucketed great / good / marginal. Add a
  **thrower power/skill setting** (persisted, like arcView) so recommendations scale to the player.
  Fast, offline, fully testable — and fixes problems 1–4 directly.
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

---

## Re-sequenced roadmap (replaces R5→R7 tail)

| Step | What | Status |
|------|------|--------|
| ~~R5~~ | ~~VPS sync~~ | **Parked** — CSV is the portability story (Decision 1) |
| **B1** | Disc-suggestion accuracy rewrite (Option A + validation harness) | Next — highest user-visible value |
| **B2** | Big-collection support (measurement spike → perf fixes + bag/collection IA) | After/with B1 |
| **R6** | Play signing + closed testing (D1) | Endgame — now unblocked (no sync paperwork) |
| **R7** | F-Droid (self-hosted → official index) | After Play; rubric = fdroiddata MR checklist (see `fdroid-reference.md`) |

Physics R&D (`physicsV2.ts`) is parked/obsolete (RESEARCH §7 note). `physics-sim-port.md` (R4.5)
is done. Pre-store manifest hygiene (SYSTEM_ALERT_WINDOW, expo-updates strip, permission re-audit)
still rides ahead of R6/R7.

## Open questions for Logan
1. **Sync — park or fully cut?** (Recommend park: keep the design doc, drop from the active path.)
2. **Suggestions — Option A first (scoring + thrower setting), Option B sim-backed later?** And what
   thrower model do you want (one power slider vs. skill presets)?
3. **Big collections — is 200 a real near-term target or forward-looking robustness?** (Changes
   whether B2 is urgent or a spike.)
4. **VPS domain** — what's actually in front of `51.81.80.126`? (Only needed if sync ever revives.)
