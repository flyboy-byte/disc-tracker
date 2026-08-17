# Direction — 2026-08-08 (post-B4 strategy re-plan: "personal disc intelligence")

> Written after Logan commissioned a **product-strategy review** (web-researched,
> competitor-grounded — the raw report is the source-of-record at
> [`../research/strategy-review-2026-08-08.md`](../research/strategy-review-2026-08-08.md)).
> This is a deliberate strategy input, valued precisely because it reasons from live competitor
> behavior (UDisc, DiscMate, TryDiscs, fieldwork apps) and from what a *real* app needs to earn
> recurring use — not just another feature list. It opens a new **C-series** of roadmap items.
> The Post-v1 Roadmap table in `../../PORT_PLAN.md` is updated to match. R1–R4.5 + B1–B4 are done
> and shipped (latest at time of writing: `mobile-preview-0.15`; current latest is `v0.19` —
> see `../../PORT_PLAN.md` CURRENT STATUS for what's shipped since).

## The thesis in one line

The app is **feature-rich but the features are utility islands** — nothing gets *more valuable
because you came back tomorrow*. The strategic move is to turn Disc Tracker from a **disc
database** into a **personal disc-intelligence system**:

> tell it what discs you own → measure how *you* actually throw them → let it learn their real
> behavior for you → ask what to throw → record what happened → the recommendation improves.

That loop is the differentiator. It's also the one thing the big players structurally *don't*
do: UDisc owns the course, TryDiscs owns the catalog, DiscMate visualizes a bag — none of them
know *your* beat-in 174 g Teebird. That's the open territory.

---

## Decision 0 — Sequencing: features + future-proofing + audience planning FIRST; stores stay parked

**Logan's call (2026-08-08), explicit:** *"don't ship now — I want to do features and other
stuff and get everything lined out with future-proofing and audience planning before even
attempting a release to public app stores."*

This is a **deliberate disagreement** with the review's single loudest recommendation ("ship to
Play/F-Droid now, before more features"). The review's logic — sideloading caps the audience, the
app is already good enough — is sound *if the goal is adoption speed*. Logan's goal is a **fully
lined-out product** first: get the data model, privacy posture, and audience story right so a
public release lands once, well, rather than early and repeatedly re-architected.

So the store track (**R6 Play → R7 F-Droid**) stays where it's been: **parked, not cut.** It moves
only when Logan says the product is lined out. Everything below is what "lined out" means.

> Note this cuts *with* the review, not against it, on substance: the review's own highest-leverage
> ideas (named loadouts as infrastructure, the 3-layer flight-data model, backup schema versioning,
> the shareable Bag Report for account-free acquisition) **are** future-proofing and audience
> planning. We're adopting the review's *architecture* while rejecting its *timing*.

---

## Decision 1 — The one architectural rule to honor everywhere: three flight layers, never conflated

The review's most important design principle, and the one that future-proofs everything else:

- **Factory / catalog flight** — immutable numbers from the master library.
- **User-declared flight** — optional manual override (a run the owner believes flies differently).
- **Observed flight** — statistically derived from real throws; **never** written back over the
  factory numbers as if it were a new 4-number stamp.

Inferring "your Teebird is actually 7/5/-1/2" from landing points is an inverse problem with no
unique answer — so the app shows **observed *tendencies*** (typical distance, bias, dispersion,
confidence), not fake precise flight numbers. Keep `turn` and `fade` as independent variables in any
future analysis; the current `net = turn + fade` scalar is fine for the OS/ST/US badge but must
**not** drive overlap/redundancy logic (a −3/3 and a 0/0 disc both net 0 yet fly nothing alike).

**Consequence for now:** we already store per-*physical*-disc rows (plastic, weight) — good. When
C-series work starts, additions are *additive schema*, plus disc **condition/wear** tracking so a
beat-in disc isn't averaged with its new self.

---

## Decision 2 — The C-series, in dependency order

New work items (detail scope docs written per-feature when each is picked up, per Logan — this pass
is direction + roadmap only):

| ID | Feature | Why it's here / dependency |
|----|---------|----------------------------|
| **C1** | **Named loadouts** (Woods / Windy / Glow / Travel / Tournament…) | Cheap relational change (`loadouts` + `loadout_discs`); Today's Bag becomes the active loadout. **Infrastructure for almost everything below** + genuinely useful to a solo user today. Table-stakes vs. DiscMate. |
| **C2** | **"What should I throw?"** free-form screen | Describe the *shot* (distance, throw, shape, wind) → best 3 discs from the active loadout, with reasons. Reuses Suggest + Flight Shaper + physics; no personal data required for v1. Turns several islands into one on-course tool. |
| **C3** | **Fieldwork sessions** (manual + rangefinder + GPS) | The recurring data engine: pick discs, throw a batch, walk once, log landings. Batch workflow, not one-disc-at-a-time. **Highest effort, highest payoff.** Raw observations are source of truth. |
| **C4** | **Learn My Bag** (per-disc observed profiles) | Shrinkage model over C3 data: factory/sim prior → personal as good recent throws accumulate. Robust estimators; distance + 2-D dispersion (bias vector + covariance), not a single average. |
| **C5** | **Throw Advisor v2** (personalized) | C2 re-ranked by C4's observed distributions: P(lands in target zone), hazard-side penalties, calibrated power ceiling per throw style. Deterministic, template-driven explanations — no LLM. |
| **C6** | **Overlap / Compare / Replace-this-disc** | Multi-dimensional role overlap (not net stability); Flight-Shaper path overlay under identical conditions; "closest in my bag / closest in catalog" for a lost disc. Far better once C4 exists. |
| **C7** | **Shareable Bag Report** (image → Android share sheet) | The audience-planning win: organic acquisition **without** accounts/feed/moderation/servers — keeps local-first intact. Renders locally, exports PNG. No location/notes in the export by default. |

Rough sequence: **C1 → C2 → C7** (all reuse existing machinery, no new data model) can come before
the heavier **C3 → C4 → C5**, with **C6** after observed data exists.

---

## Decision 3 — Future-proofing to bank *before* the heavy features (do these early/opportunistically)

These are small and prevent painful migrations later:

- **Backup format versioning.** Add an explicit `schemaVersion` to the B4 backup JSON *now*, before
  fieldwork/loadouts change the shape. Raw observations get backed up; derived summaries
  (`disc_model_summaries`) are rebuildable and needn't be canonical.
- **Loadouts as the canonical "which discs" concept** — migrate `in_bag=1` into a `Today's Bag`
  loadout rather than carrying two independent truths.
- **Location privacy designed before the schema ships (C3).** Default to **derived-only** storage:
  compute downrange/crossrange relative to the session origin, keep the relative vector + reported
  accuracy, **discard absolute lat/long.** "Keep map locations" is an explicit opt-in. This is a
  genuine advantage — *location-assisted features without building a location history* — and it's
  what keeps C3 clearable against the [F-Droid privacy bar](fdroid-reference.md) (see caution below).

---

## Cautions the review under-weights

1. **GPS fieldwork (C3) strains the F-Droid privacy story.** It needs `ACCESS_FINE_LOCATION` — a
   real addition to the "PCAPdroid-clean, minimal permissions" bar we hold our own MRs to. The
   derived-only storage (Decision 3) handles the *data* concern; the *permission* line item still
   needs to be worth it. Manual/rangefinder entry must be first-class so the feature is fully usable
   with **zero** location permission. Treat GPS as opt-in enhancement, not the spine.
2. **"No analytics" vs. wanting retention metrics.** The review wants a north-star (Personal
   Decision Sessions/week) that normally needs telemetry — which is a hard constraint we won't
   break. Resolution: **local-only counters** the user can *optionally* export, plus closed-test
   surveys. No Firebase, no silent events.
3. **GPS precision is not ground truth.** Show reported uncertainty, quality-grade each fix, and
   never render "312.7 ft" off a noisy fix. (Details in the raw report; carry into the C3 scope doc.)

---

## Already handled (the review's "immediate fixes")

Most of the review's correctness flags were resolved on/around 2026-08-08 before this doc:

- ✅ **README headwind/tailwind wording** was reversed → **fixed** (headwind = more understable).
  The code (`legacyPhysics.ts` / `physics.js`) was always correct; it was doc drift.
- ✅ **README release-status drift** (said `0.12`; Play/F-Droid "next") → the README was reworked
  (privacy + architecture focus, live screenshots) and no longer pins a stale version.
- ✅ **Over-absolute privacy blurb** ("Nothing is transmitted anywhere / no external services") →
  replaced with the precise, stronger claim: zero network by default + the single opt-in DiscIt
  reference-image exception.
- ✅ **`PORT_PLAN.md` status block** said `0.14` latest → updated to `0.15`.

Still open, but **R6 store-track work** (not now, per Decision 0), tracked in the
[F-Droid privacy bar](fdroid-reference.md) notes:

- ⏳ `SYSTEM_ALERT_WINDOW` permission + `expo.modules.updates.*` meta-data are present in the
  generated `android/app/src/main/AndroidManifest.xml`. Both are pre-store hygiene; the proper fix
  is via `app.json`/config-plugin (the manifest is regenerated by `expo prebuild`). Do it as part of
  R6, not before.

---

## One-line summary

Adopt the review's **architecture and positioning** ("personal disc intelligence," compete where
the big three don't); reject its **timing** — build the C-series, bank the future-proofing, plan the
audience (C7), and only *then* un-park the store track.
