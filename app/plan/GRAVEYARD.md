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

### C2 — "What should I throw?" free-form screen — GRAVEYARDED 2026-08-16

**What it was:** describe the shot (distance, throw, shape, wind) → best 3 discs from the active
loadout, with reasons. Pitched in `direction-2026-08-08.md` as reusing Disc Suggest + Flight
Shaper's existing scoring/physics, "turns several islands into one on-course tool." Logan
confirmed it as a real feature on 2026-08-15 (not parked, just not that pass).

**Why graveyarded one day later:** Logan's own read, 2026-08-16 — "c2 feels like the existing
disc suggestion page." Re-examined against what Disc Suggest actually does today (13 scenario
cards, `suggestScore.ts`, one unified scorer for bag + library): the honest differentiator is
narrow — *free-form continuous input* (typing an exact distance/wind number) instead of picking
the nearest of 13 named presets. Wind in particular isn't a slider anywhere today, only baked
into discrete cards (Tailwind / Into Headwind). That's a real gap, but it's a UI variant on the
same model, not new capability — the 13 presets already cover the shot space reasonably well as
named shortcuts. Worse, C2 was already blocked on C1 (loadouts), itself parked — so this was an
unbuilt idea riding on another unbuilt idea, mostly re-skinning something that already works.

**Status:** not "never" — if a real driver shows up later (e.g. the wind-as-continuous-input gap
becomes an actual pain point), the cheapest version isn't a new screen: add a wind slider to the
existing Disc Suggest scenario detail and let it nudge whichever scenario is active, the same
mechanism Throw Style already uses. That reuses the shipped UI instead of building a parallel one.

---

## What's still alive (not graveyarded, for contrast)

- **C7 — Shareable Bag Report (image export).** NOT parked — confirmed real by Logan 2026-08-15,
  unrelated to C2's graveyarding (C7 doesn't overlap with any shipped screen the way C2 did).
  Render a shareable PNG of your bag locally, push it through the Android share sheet — no
  accounts, no server, no feed. Cheap to build (no new data model, reuses existing rendering).
  **Scoped in detail 2026-08-17**, not yet built — see `docs/c7-shareable-report-scope.md`.
- **C1 — Named loadouts:** not parked, but explicitly gated behind a storage-robustness look
  first (Logan 2026-08-15: "it only makes sense if we look closer into how we store discs...
  organizing it all cohesively and maintaining it without a cloud-backup seems clunky"). **The
  storage-robustness look itself is sequenced for the end of this plan, after the website-refactor
  track below is done** (Logan's call, 2026-08-15) — not urgent, deliberately last. See
  `suggest-engine-plan.md`'s Phase-2/Phase-4 notes for the adjacent Phase 3 role-tag work this
  would eventually build on.
- **C4/C5/C6:** downstream of C3, so effectively paused with it, not separately parked.
- **Suggest-engine Phase 2 (data audit)** and **website parity catch-up:** both shipped and
  verified on-device 2026-08-16/17 — see `docs/suggest-engine-plan.md` and
  `docs/archive/data-audit-scope.md` / `docs/archive/website-parity-scope.md` for the record.
- **Wear-level 1–5 "estimated broke-in" scale** and **Disc Suggest "buying mode"** — both
  floated 2026-08-15, scoped in detail and **shipped 2026-08-16** (`019f480`). No longer graveyard
  material; see `plan/docs/archive/wear-estimate-scope.md` / `plan/docs/archive/buying-mode-scope.md` for the
  confirmed decisions and `suggest-engine-plan.md` for verification notes.
