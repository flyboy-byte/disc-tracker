# Graveyard — Disc Tracker mobile

Every idea that got floated, scoped a little, and then parked or killed. Nothing is lost — the
original reasoning stays here instead of rotting inside a roadmap table that nobody re-reads.
Mirrors `moomoo/docs/strategy_graveyard.md`'s purpose: keep sessions context-efficient by
recording *why* a decision was made, so it doesn't get re-litigated from scratch next time it
comes up. See `DECISIONS.md` for decisions that stuck; this file is for the ones that didn't (yet,
or ever).

---

### R6 — Play Store closed testing — HARD PAUSED 2026-08-21

**What it was:** the next distribution step after production signing (`v0.15`, upload key =
Play app signing key). Needs the actual Play Console submission — Data Safety form, privacy
policy, content rating — all still undone.

**Why paused, not graveyarded outright:** unlike the C-series entries above, this isn't "no
driver" or "too speculative" — it's a values call. Logan, 2026-08-21: "not interested in play
store very much honestly. google just sucks. but keep it in docs. maybe also graveyard hard
pause for now." Distinct from the 2026-07-30 "not emotionally ready" framing (which read as
timing) — this is closer to "don't really want to deal with Google," which could hold
indefinitely. Kept as a hard pause rather than a full kill (like C3) since nothing about the
technical readiness changed — signing is done, this is purely "do I want to open a Play Console
account and go through their review," and that's worth leaving reversible.

**Knock-on effect worth noting:** R7 (official F-Droid index, D3) was previously *sequenced*
after R6, not because it depends on it, but because Play App Signing and F-Droid's own
reproducible-build requirements conflict if pursued in parallel. With R6 hard-paused rather than
active, R7 has no reason to keep waiting behind it — and D2 (the self-hosted F-Droid repo, live
since 2026-08-21 at `~/projects/fdroid-repo`) is already exactly the practice run R7 needs. If
Logan wants a next distribution step at all, R7 is the more aligned one now — FOSS-native, no
Google account, and prep work already exists. Not started unilaterally; flagged here as the
natural implication of this pause.

**Status:** paused, not dead. Revisit only if Logan raises it — don't push distribution as a
"you should really do this" item just because the app is trending toward primary deployment.

---

### C3 — Fieldwork sessions (manual + rangefinder + GPS) — GRAVEYARDED 2026-08-21 (killed outright, was PARKED 2026-08-15)

**What it was:** the recurring data-collection engine behind the whole C-series — pick discs,
throw a batch, walk the field once, log landings, feed that into C4's per-disc observed flight
profiles. Called "highest effort, highest payoff" in `direction-2026-08-08.md`.

**Why parked (2026-08-15), then killed (2026-08-21):** flagged by Logan 2026-08-15 during a
review of the C-series roadmap — the project is accumulating unscoped/half-scoped ideas faster
than they're getting built or killed ("lots of branches and accelerated development," his
words), and C3 is the heaviest of them:
- Needs `ACCESS_FINE_LOCATION` — real friction against the F-Droid privacy bar this project has
  otherwise kept clean (opt-in everything, zero network by default).
- The original review already flagged derived-only location storage as a prerequisite
  (`direction-2026-08-08.md` Decision 3) — meaning C3 can't even start cleanly without banking
  that future-proofing work first, which itself hasn't been scoped or built.
- It's a prerequisite for C4/C5/C6 (the "personalized, observed-data" half of the roadmap) but
  has no driver right now — nothing else is blocked waiting on it, since C4/C5/C6 are themselves
  unscoped.

Six days later, 2026-08-21, Logan closed it outright: "kill c3 fieldwork completely." No new
reasoning beyond the park — the underlying tradeoff (location permission + unscoped
prerequisite work for a feature with no active driver) didn't get more attractive with time, so
rather than let it keep sitting as "maybe later," it's fully dead. **C4/C5/C6 die with it** —
they were explicitly downstream of C3's data and have no independent scope of their own; nothing
in the C-series remains open as of this date.

**Status:** dead, not parked. If GPS-based fieldwork data ever becomes worth building, this
entry (and `direction-2026-08-08.md`'s Decision 3 on derived-only storage, and the GPS-precision
caution note) is where the prior reasoning lives — but treat it as a fresh pitch requiring a new
driver, not a resume of this one.

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

### C1 — Named loadouts — GRAVEYARDED 2026-08-18

**What it was:** multiple named, saved disc sets (e.g. "wooded course," "open field," "tournament
bag") you could apply to swap Today's Bag in one action, instead of manually re-toggling each
disc's in-bag flag. Gated 2026-08-15 behind a storage-robustness look first (Logan: "it only
makes sense if we look closer into how we store discs... organizing it all cohesively and
maintaining it without a cloud-backup seems clunky").

**The storage-robustness look happened 2026-08-18 — verdict: no changes needed.** Read the
actual schema (`app/src/db/migrations.ts`) and backup round-trip (`app/src/utils/backup.ts`)
rather than assuming: `discs` is a flat per-user table with a single `in_bag` boolean — that's
the real gap for loadouts, not the storage engine. The fix would have been purely additive (a
`loadouts` table + a `loadout_discs` many-to-many join table, `ON DELETE CASCADE`, zero changes
to any existing table), the exact same shape every other feature here has shipped with
(`rounds`, `custom_discs`, wear tracking, catalog state) via the established tolerant
`ALTER TABLE`/`CREATE TABLE IF NOT EXISTS` migration pattern. Backup is already versioned
(`BackupData.version: 1`) and tolerant of missing optional sections, so a `loadouts` array would
have round-tripped the same way `customDiscs` did when it was added. **The "clunky" feeling was
a UI/data-model gap (only one grouping — Today's Bag — exists), not a storage-robustness
problem** — so this gate is resolved without needing to touch the schema at all.

**Why graveyarded anyway, right after clearing the gate:** asked directly whether the underlying
play pattern (swapping bags often enough that manual re-toggling is real friction) actually
applies, Logan's answer was "having second thoughts what's the point even of it" — i.e. the
feature was scoped from an abstract idea back on 2026-08-08, not from an actual recurring pain
point. With the storage question closed and the product need itself now in doubt, building it
would be complexity without a clear driver. **Status: not parked, actually graveyarded** — if a
real recurring need for saved bag presets shows up later, the storage-robustness finding above
means it can be built in an afternoon, no re-research required.

---

## What's still alive (not graveyarded, for contrast)

- **C7 — Shareable Bag Report (image export).** NOT parked — confirmed real by Logan 2026-08-15,
  unrelated to C2's graveyarding (C7 doesn't overlap with any shipped screen the way C2 did).
  Render a shareable PNG of your bag locally, push it through the Android share sheet — no
  accounts, no server, no feed. Cheap to build (no new data model, reuses existing rendering).
  **Scoped 2026-08-17, built and verified on a real device 2026-08-18** — see
  `docs/c7-shareable-report-scope.md`. Done.
- **C4/C5/C6:** downstream of C3, so effectively paused with it, not separately parked.
- **Suggest-engine Phase 2 (data audit)** and **website parity catch-up:** both shipped and
  verified on-device 2026-08-16/17 — see `docs/suggest-engine-plan.md` and
  `docs/archive/data-audit-scope.md` / `docs/archive/website-parity-scope.md` for the record.
- **Wear-level 1–5 "estimated broke-in" scale** and **Disc Suggest "buying mode"** — both
  floated 2026-08-15, scoped in detail and **shipped 2026-08-16** (`019f480`). No longer graveyard
  material; see `plan/docs/archive/wear-estimate-scope.md` / `plan/docs/archive/buying-mode-scope.md` for the
  confirmed decisions and `suggest-engine-plan.md` for verification notes.
