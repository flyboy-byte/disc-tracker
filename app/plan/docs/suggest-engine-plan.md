# Disc-suggestion engine — iterative plan

> **Status: Phase 1 DONE 2026-08-15 (`f9925fb`); Phase 3 code-complete 2026-08-15, UNTESTED
> on-device.** Phase 1 verified on-device on Logan's real phone (Throw Style persistence,
> 13-card grid, stability-adjustment → ranking), `tsc`/Jest green (121/121). One real bug found
> + fixed along the way (inline-autofill search ranking). Phase 3 (personal role tags —
> `discs.role_tag`, free-text field on the disc form) landed code-complete, `tsc`/Jest green
> (121/121), but has **not** had the on-device round-trip pass Phase 1 got — phone/emulator
> both unavailable this session, logged not skipped-silently. Do that before treating Phase 3
> as fully closed. Next up is Phase 2 (needs its own scope pass first) or the website-parity
> track — see the sections below.
>
> **Read this first, don't re-derive:** `plan/docs/direction-2026-08-08.md` Decision 1 (the
> three-layer flight-data rule — factory / user-declared / observed) is the one architectural
> rule everything below has to honor. `plan/docs/suggest-model.md` is the scorer's own source of
> truth for exact numbers (kept in lockstep with `src/utils/suggestScore.ts`). This doc is the
> roadmap/status layer on top of both — don't duplicate their content here, link to it.

## Origin

2026-08-15: Logan forwarded a ChatGPT-drafted handoff arguing Disc Suggest scores *molds*, not
the *physical discs in the bag* (158g D3 AIR as a flex specialist, Halo Mamba, a beat Logic, etc.)
and that Forehand should be a modifier across shot shapes, not one generic scenario. Full handoff
text is in the conversation transcript, not repeated here. Audited against the actual codebase
(3 parallel Explore passes) before building anything — see "Phase 1" below for what the audit
found and how it reshaped scope.

## Decisions already made (do not re-ask)

- **The 3-layer split is not a new idea** — `direction-2026-08-08.md` Decision 1 already defines
  factory/user-declared/observed. Phase 1 fills in the empty user-declared slot; it doesn't invent
  new terminology.
- **Personal stability adjustment is a single -2..+2 slider**, not wear-state + adjustment as two
  fields. Wear-state (New/Seasoned/Beat) was explicitly cut from Phase 1 — free-text `notes`
  already covers it for now. Revisit only if the slider alone proves insufficient in practice.
- **The adjustment shifts `turn` AND `fade` together** (`adj/2` each), never just the derived
  `stability` badge — confirmed during implementation (see `bagToDisc()` in `disc.ts`) after
  catching that a net-only version would move the OS/ST/US badge but do nothing to actual Disc
  Suggest rankings, which would've been a real bug.
- **Throw style is a modifier on every scenario, not a scenario replacement.** The existing
  `forehand` scenario card is untouched and stays — no id changes, no removal. Whether to
  rename/fold it later is an open call, not decided.
- **CSV export/import stays byte-identical to the website's columns.** `stabilityAdj`/`throwStyle`
  are backup-JSON-only, mobile-only fields — same precedent as `color`/`inBag` already not
  round-tripping through CSV.
- **Data Audit is scoped small** (Logan, 2026-08-15, correcting my initial read of the handoff):
  it's specifically "give me an interactive way to fill in gaps in my own bag data — weight and an
  optional wear-level — that then feeds the suggestion engine." **Not** a fuzzy confidence-matching
  engine against the 1,660-disc library. See Phase 2.
- **Bag Analysis / overlap (C6) stays parked** behind C4 (observed data), per the existing
  `direction-2026-08-08.md` roadmap. Building it on canonical + user-declared data only risks
  exactly the "these look redundant by the numbers but aren't" false-positive Decision 1 already
  warns about.

## Phase 1 — Canonical vs. owned-specimen flight data — DONE 2026-08-15 (`f9925fb`)

What shipped (all additive, no breaking changes):
1. **Flex Shot scenario** — 13th entry in `src/utils/scenarios.ts` (`id: 'flex'`) +
   `PROFILES.flex` in `src/utils/suggestScore.ts`. Turns on release, fades back straight;
   distinct from Turnover (holds anhyzer) and Hyzer Flip (starts hyzer, flips at fairway speed).
2. **Throw-style modifier** — `ThrowStyle = 'backhand' | 'forehand'` in `suggestScore.ts`
   (`THROW_STYLE_BIAS`), applied in `score()`/`rankDiscs()` on top of whichever scenario is
   active. New Settings section (mirrors the existing Skill Level pills). Persisted in
   `user_meta.throw_style` (migration appended, tolerant `ALTER TABLE`, default `'backhand'` —
   a no-op, so existing behavior is unchanged unless a user opts in).
3. **Personal stability adjustment** (the user-declared layer) — `discs.stability_adj` REAL
   DEFAULT 0 (migration appended). `Disc.stabilityAdj` threaded through `getDiscs`/`insertDisc`/
   `updateDisc`/`saveDiscs`. New optional -2..+2 stepper in `DiscFormModal.tsx` ("Personal
   stability adjustment (optional)"). Only affects **bag** scoring (`bagToDisc()` in `disc.ts`)
   — library discs are never adjusted, since there's no owned specimen to adjust.
4. Rides through Backup & Restore automatically (`Disc[]` carries `stabilityAdj`; `BackupMeta`
   gained `throwStyle` with the same tolerant-default pattern already used for `customDiscs`).
5. `plan/docs/suggest-model.md` updated in lockstep (Flex row in the profile table, new Throw
   Style section). Baseline fixture regenerated (`node plan/tools/gen_suggest_baseline.mjs`) —
   now 13 scenarios.

Files touched: `src/utils/scenarios.ts`, `src/utils/suggestScore.ts`, `src/utils/disc.ts`,
`src/db/migrations.ts`, `src/db/db.ts`, `app/(tabs)/disc-suggest.tsx`, `app/(tabs)/settings.tsx`,
`src/components/DiscFormModal.tsx`, `src/utils/backup.ts`, plus test files (`scenarios.test.ts`,
`suggestScore.test.ts`, `backup.test.ts`) and `plan/tools/gen_suggest_baseline.mjs`.

**Verification done:** `tsc --noEmit` clean. Jest 121/121 (was 115; +6 new cases: flex scoring,
throw-style no-op/divergence/default-arg, backup tolerant-default for the new field). **On-device
pass done 2026-08-15 on Logan's real phone** (emulator was unusably slow this session — machine
under load, see below): Throw Style pills render and persist across a full app kill/restart;
13-card `ScenarioGrid` renders Flex Shot correctly as a full-width 13th row, no wrap/clip issue;
stability-adjustment stepper renders in `DiscFormModal` and visibly changes Disc Suggest ranking
end-to-end (+2 on the only bag disc raised it to "great" for Dead Straight; -2 dropped it out of
the results entirely — confirmed as correct scorer behavior, see note below, not a bug).

**Bug found + fixed during this pass:** `searchLibrary()` (`src/utils/masterLibrary.ts`) did a
plain substring match on mold name only, unranked, capped at 6 results — a short query like "pa"
(typed after "Prodigy" in the mfr field, looking for PA-5) got crowded out by unrelated discs
that happened to sort earlier in the 1,660-disc master list. Fixed: prefix matches now rank ahead
of mid-string matches, and when a manufacturer is already typed, same-manufacturer hits rank
ahead of others. `searchLibrary()` gained a 4th optional `mfr` param; `DiscFormModal` passes
`form.mfr` through. No test coverage added for this (no existing test file for
`masterLibrary.ts`) — verified live on-device only.

**Design question raised, not a bug (noted for later, not blocking commit):** when a scenario's
scored discs all fall below the `marginal` band (0.35), `rankDiscs()` drops them — pre-existing
B1 behavior (blessed 2026-07-29), unchanged by Phase 1. With a very small bag (e.g. exactly one
disc) this means "From your bag" can go completely empty for a scenario, even though that one
disc is definitionally the closest thing you own. Logan's reaction: a below-marginal disc could
still show with a "bad fit" label instead of disappearing, when it's the only bag candidate.
**Not implemented** — flagged here as a future UX refinement to `rankDiscs`/the results screen,
scoped separately from Phase 1's actual deliverables.

### Next action (pick this back up here)
Phase 1 is verified. Remaining: `git add`/commit as one coherent commit (or a small stack —
schema+scorer, then UI, per this repo's usual "one commit per feature/step" convention), then mark
this phase's status line DONE with the commit hash, same convention as PORT_PLAN.md rows.

## Phase 2 — Data Audit (scoped small, per Logan's 2026-08-15 correction) — SCOPED 2026-08-15, NOT STARTED

Full scope doc: [`data-audit-scope.md`](./data-audit-scope.md) (Decisions/Non-goals/Data
model/Screens, mirrors `scorekeeper-scope.md`). Three decisions proposed there need Logan's
confirmation before Step 1 starts: wear-level scale (New/Seasoned/Beat), entry point (Settings
DATA section, not a new tab, not folded into CSV import), and mechanics (reuse `DiscFormModal`
for editing rather than new inline-edit UI).

**Scope, as corrected mid-session** (this is *not* the fuzzy confidence-matching engine the
original ChatGPT handoff described — that idea is explicitly rejected as over-engineered for this
app): an interactive pass over **your own bag data** — via CSV import and/or a dedicated screen —
that:
- Flags discs missing `weight` and/or `plastic` (already-existing `Disc` fields, often blank on
  CSV import) and lets you fill them in inline, one by one or in a batch.
- Adds an **optional wear-level** field per disc (scale TBD — simplest candidate: New/Seasoned/
  Beat, 3 values, matching the handoff's own suggestion) that becomes a second input the
  suggestion engine can eventually use alongside `stabilityAdj` — e.g. a future refinement could
  let wear-level nudge `stabilityAdj` automatically (a beat disc trending understable) rather than
  requiring the number to be hand-tuned, but that coupling is **not designed yet** — flag it, don't
  build it, until Phase 1's plain adjustment field has been used for a while.
- Explicitly **does not** do confidence-scored mold-matching, duplicate detection, or typo/alias
  correction against the 1,660-disc library — that was the part of the original handoff correctly
  flagged as highest false-positive risk, and Logan doesn't want it.

**Before starting:** needs its own short scope pass (mirror `scorekeeper-scope.md`'s structure —
Decisions/Non-goals/Data model/Screens) once picked up. Open questions to resolve then: does this
live as a step inside the existing CSV import flow (`CsvImportModal.tsx`) or as a new standalone
screen reachable from Settings or the Bag tab; exact wear-level scale/labels; whether wear-level
is its own DB column (`discs.wear_level`) or folds into the existing free-text `notes` convention
some other way.

## Phase 3 — Personal role tags — CODE-COMPLETE 2026-08-15, UNTESTED on-device

"Flare → hyzer bomb," "D3 AIR → flex," "Beast → water disc" — an optional free-text tag per owned
disc, so a future Bag Analysis pass (Phase 4) can say "these look numerically redundant, but
you've tagged them for different roles" instead of just flagging false-positive overlap. Shipped
as `discs.role_tag` (same additive-migration pattern as Phase 1's `stability_adj`), a plain
`Disc.roleTag` field, and a free-text input on `DiscFormModal` right below the stability-adjustment
control. Purely descriptive — doesn't feed `suggestScore.ts` at all, doesn't need CSV round-trip
(app-only field, same reasoning as `stabilityAdj`), and round-trips through backup/restore for
free since that path serializes the whole `Disc` object. Not surfaced anywhere else in the UI yet
(no bag-card badge) — deliberately deferred until Phase 4 actually reads it, matching how
`stabilityAdj` itself has no dedicated display outside the form.

**Verification gap, honestly noted — UNTESTED on-device (2026-08-15):** `tsc --noEmit` and the
full Jest suite (121/121) are clean, but this hasn't been round-tripped on a real device/emulator
(add → save → reopen → edit → confirm it persists across an app restart). Skipped this session —
phone was in use for other things, emulator was unreliable (see prior session's diagnosis: host
resource contention, not a real tooling bug). Do the on-device pass before calling this fully
done, same bar Phase 1 was held to.

## Phase 4 — Bag Analysis / overlap (C6) — NOT STARTED, intentionally parked

Already sequenced in `direction-2026-08-08.md` behind C4 (observed flight data from fieldwork
sessions). Do not start until C4 exists or there's a specific reason to revisit the sequencing —
building overlap/redundancy detection on canonical + user-declared data only is exactly the
"these look redundant by the numbers but aren't" trap Decision 1 warns about, and Phase 3's role
tags (above) are the cheap mitigation for that trap, not a full fix.

## Separate track — Website (Flask app) parity catch-up — SCOPED 2026-08-15, not yet started

Full scope doc: [`website-parity-scope.md`](./website-parity-scope.md). Verified while scoping:
the CSV format is already byte-identical between the app and website (one real gap — the app's
newer "Both" export scope isn't on the website yet); the meatier piece is deciding how much of a
mobile backup file the website should accept (landed on: discs + settings import cleanly, rounds/
customDiscs are visibly reported as unsupported rather than silently dropped).

Originally flagged 2026-08-15 as a full feature-parity audit (mobile has shipped
backup/restore, the custom-disc library, stability-adjustment, and role tags; the website has
none of it). **Rescoped the same day, narrower, per Logan's actual priority**, then **fully
scoped** in `website-parity-scope.md` — see the pointer above.

The app is quietly becoming the dominant platform going forward; the website's remaining value
is being the **persistent, always-there, cross-OS** copy — the two things it's actually good for
right now are (1) moving your disc data phone → website (and back), and (2) letting a desktop or
iOS person see/use a bag without installing anything. Everything else about "catching the website
up" is lower priority than that.

**Concrete scope, in order:**
1. **CSV format/sharing parity** — confirm the website's CSV export/import columns still match
   the app's `csv.ts` 1:1 (they diverged at least once already — see `PORT_PLAN.md`'s CSV
   history); fix whichever side drifted.
2. **Backup/restore compatibility** — the app's `backup.ts` JSON format (`BackupData`: discs,
   meta, rounds, customDiscs) has no website equivalent at all. Doesn't need to be a full mirror
   of the Settings screen — just enough that a mobile backup file can populate/restore a website
   account, and vice versa isn't necessarily required (confirm which direction Logan actually
   wants before building both).
3. **Cross-platform sharing** — whatever's needed so a desktop/iOS person can actually receive
   and view a shared bag (this may fall out of #1/#2 for free, or may need its own small piece —
   TBD once 1/2 exist).
4. **Suggest-engine parity (Phase 1/3 fields — stability-adjustment, role tags) on the website**
   — explicitly **after** 1–3, not blocking them.

Not yet scoped in detail (no data model / screens doc like `data-audit-scope.md` yet) — this
section is the priority ordering, not a build-ready spec. Do that scoping pass when this track is
actually picked up.

## Compaction checkpoints (resume without re-deriving)

Each phase above is written to stand alone: read its own section, its status line, its "before
starting" open questions, and go — you shouldn't need to re-read this whole doc's history to pick
up any one phase. When resuming this initiative after a context reset or new session:
1. Read this doc's top status line first — it names the exact next action.
2. Do **not** re-derive the "decisions already made" list above — treat it as settled.
3. Check `git log` / `git status` in `app/` before assuming Phase 1's code state — this doc will
   be updated with the commit hash once Phase 1 lands, but until then "code done, not committed"
   is the ground truth, not this doc's staleness.
4. If a phase's own section says "NOT STARTED," its "before starting" sub-bullets (where present)
   are the literal first step — don't re-plan from scratch.
