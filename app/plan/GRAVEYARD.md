# Graveyard — Disc Tracker mobile

Every idea that got floated, scoped a little, and then parked or killed. Nothing is lost — the
original reasoning stays here instead of rotting inside a roadmap table that nobody re-reads.
Mirrors `moomoo/docs/strategy_graveyard.md`'s purpose: keep sessions context-efficient by
recording *why* a decision was made, so it doesn't get re-litigated from scratch next time it
comes up. See `DECISIONS.md` for decisions that stuck; this file is for the ones that didn't (yet,
or ever).

---

### C3 — Fieldwork sessions (manual + rangefinder + GPS) — PARKED 2026-08-15

**What it was:** the recurring data-collection engine behind the whole C-series — pick discs,
throw a batch, walk the field once, log landings, feed that into C4's per-disc observed flight
profiles. Called "highest effort, highest payoff" in `direction-2026-08-08.md`.

**Why parked, not just "later":** flagged by Logan 2026-08-15 during a review of the C-series
roadmap — the project is accumulating unscoped/half-scoped ideas faster than they're getting
built or killed ("lots of branches and accelerated development," his words), and C3 is the
heaviest of them:
- Needs `ACCESS_FINE_LOCATION` — real friction against the F-Droid privacy bar this project has
  otherwise kept clean (opt-in everything, zero network by default).
- The original review already flagged derived-only location storage as a prerequisite
  (`direction-2026-08-08.md` Decision 3) — meaning C3 can't even start cleanly without banking
  that future-proofing work first, which itself hasn't been scoped or built.
- It's a prerequisite for C4/C5/C6 (the "personalized, observed-data" half of the roadmap) but
  has no driver right now — nothing else is blocked waiting on it, since C4/C5/C6 are themselves
  unscoped.

**Status:** not rejected, genuinely parked. If it comes back, start from
`direction-2026-08-08.md`'s Decision 3 (derived-only storage) and the caution note about GPS
precision (§"Cautions the review under-weights") — both already have real reasoning banked, no
need to re-derive.

---

## What's still alive (not graveyarded, for contrast)

- **C2 — "What should I throw?" free-form screen.** NOT parked — confirmed by Logan 2026-08-15
  as a real feature to build, just not this pass ("c2 and 7 are def not parked... doc them as
  features to build if that makes sense, not this pass maybe. but sometime"). Re-explained
  2026-08-15: describe the shot (distance, throw, shape, wind) → best 3 discs from the active
  loadout, with reasons — reuses Disc Suggest + Flight Shaper's existing scoring/physics, no new
  model. Depends on C1 (loadouts) existing first. Not yet scoped in detail.
- **C7 — Shareable Bag Report (image export).** NOT parked, same 2026-08-15 confirmation as C2.
  Render a shareable PNG of your bag locally, push it through the Android share sheet — no
  accounts, no server, no feed. Cheap to build (no new data model, reuses existing rendering)
  whenever it's picked up. Not yet scoped in detail.
- **C1 — Named loadouts:** not parked, but explicitly gated behind a storage-robustness look
  first (Logan 2026-08-15: "it only makes sense if we look closer into how we store discs...
  organizing it all cohesively and maintaining it without a cloud-backup seems clunky"). **The
  storage-robustness look itself is sequenced for the end of this plan, after the website-refactor
  track below is done** (Logan's call, 2026-08-15) — not urgent, deliberately last. See
  `suggest-engine-plan.md`'s Phase-2/Phase-4 notes for the adjacent Phase 3 role-tag work this
  would eventually build on.
- **C4/C5/C6:** downstream of C3, so effectively paused with it, not separately parked.
- **Suggest-engine Phase 2 (data audit):** code-complete 2026-08-15, untested on-device — see
  `data-audit-scope.md` and `suggest-engine-plan.md`.
- **Website parity catch-up:** being scoped in detail 2026-08-15 — see
  `plan/docs/website-parity-scope.md`.
- **Wear-level 1–5 "estimated broke-in" scale (optional).** Floated by Logan 2026-08-15 while
  testing v0.17's data audit: the current 3-tier New/Seasoned/Beat wear level (`WEAR_LEVELS` in
  `src/utils/disc.ts`) "dont hardly feel enuf" for a disc he's had 3 months and isn't sure how to
  bucket. Idea: an *optional* 1-5 numeric scale for estimated wear/break-in, living in the same
  UI slot as the current wear-level pills (Data audit row + presumably disc detail/edit). Explicit
  instruction: **do not rework the existing 3-tier field to build this** — this is a separate,
  additive idea, not yet scoped, not requested to build now.
- **"Suggestions for buying" mode on Disc Suggest (unscored idea, not yet a feature request).**
  Floated by Logan 2026-08-15, explicitly **"leave it unscored intentionally"** — not ready to
  scope as a real feature, just a thought to not lose. Sketch: a toggle on the Disc Suggest screen
  between "suggestions for throwing" (today's behavior) and "suggestions for buying" — reusing the
  same scoring framework, but instead of ranking discs you own for a scenario, it'd help pick what
  to *add* to the bag. Rough shape as described:
  - Filter by category (driver/fairway/mid/putter) and stability (understable/overstable/either).
  - Basic bag-gap scripting — surface what's missing from the current bag's speed/stability
    coverage rather than just re-ranking owned discs.
  - Filter by brand; weight filtering flagged by Logan himself as probably not workable given the
    library's data (not every disc has reliable per-weight data).
  - A swipe-away-to-refine interaction (dismiss a suggested disc → engine adjusts).
  **Logan's own caveat, worth keeping attached to this idea:** "if we do much more of this we
  really need to find a way to expand our library" — i.e. this mode (and honestly the existing
  suggest engine generally) is increasingly gated on the 1,660-disc master library's coverage/
  accuracy, not just on scoring logic. Any real push on a buying-mode feature should probably pair
  with a library-expansion pass, not precede it blind.
