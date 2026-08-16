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

### C2 — "What should I throw?" free-form screen — UNDER REVIEW 2026-08-15

**What it was:** describe the shot (distance, throw, shape, wind) → best 3 discs from the active
loadout, with reasons. Reuses Disc Suggest + Flight Shaper's existing scoring/physics — no new
model. The pitch was collapsing "check Disc Suggest, then check Flight Shaper, then decide" into
one on-course lookup.

**Why it's here:** Logan flagged genuine confusion about what problem it solves, re-reading the
roadmap cold. Re-explained 2026-08-15 (see above) but it didn't land as obviously valuable either
time. Not killed — just doesn't have a clear enough "yes, I'd use that" behind it yet to scope.
Revisit if a concrete on-course moment makes the gap obvious (e.g. "I stood over a shot and
wanted one answer, not two screens").

---

### C7 — Shareable Bag Report (image export) — UNDER REVIEW 2026-08-15

**What it was:** render a shareable PNG of your bag locally, push it through the Android share
sheet — no accounts, no server, no feed. Pitched as an organic-acquisition play in
`direction-2026-08-08.md` ("audience win... without accounts/feed/moderation/servers").

**Why it's here:** it's a marketing/growth feature, not a personal-use one — that's likely why it
didn't stick. Logan: "i dont remember interesting, hmm just why." Not killed — cheap to build if
the audience angle ever actually matters (no new data model, reuses existing rendering), but
there's no personal-use case pulling it forward right now.

---

## What's still alive (not graveyarded, for contrast)

- **C1 — Named loadouts:** not parked, but explicitly gated behind a storage-robustness look
  first (Logan 2026-08-15: "it only makes sense if we look closer into how we store discs...
  organizing it all cohesively and maintaining it without a cloud-backup seems clunky"). See
  `suggest-engine-plan.md`'s Phase-2/Phase-4 notes for the adjacent Phase 3 role-tag work this
  would eventually build on.
- **C4/C5/C6:** downstream of C3, so effectively paused with it, not separately parked.
- **Suggest-engine Phase 2 (data audit):** scoped, not started — see `data-audit-scope.md`.
- **Website parity catch-up:** rescoped 2026-08-15 to a concrete subset (CSV + backup/restore +
  cross-platform sharing) rather than a full feature audit — see `suggest-engine-plan.md`'s
  "Separate track" section.
