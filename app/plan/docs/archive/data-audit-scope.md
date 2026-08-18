# Data audit — scope (Phase 2 of the suggest-engine plan)

**Status:** DONE 2026-08-16 — shipped as Phase 2 of the suggest-engine plan (`6bb2651`), verified
on-device. This scope doc's "SCOPING — not started" framing below is kept as the original design
record, not current status — see `suggest-engine-plan.md` for the live status and verification
notes. Written 2026-08-15, mirrors `scorekeeper-scope.md`'s structure per `suggest-engine-plan.md`'s
own instruction. Not the fuzzy confidence-matching engine the original ChatGPT handoff
described — that's explicitly rejected as over-engineered for this app (see "Non-goals").

## What this is

An interactive pass over **your own bag data** that surfaces discs missing `weight` and/or
`plastic` (existing `Disc` fields, often blank after a CSV import — `csv.ts` normalizes an
`Unknown` placeholder to `''`) and lets you fill them in, plus a new optional **wear-level** field
per disc (New / Seasoned / Beat) that becomes a second personal-data input alongside Phase 1's
`stabilityAdj` and Phase 3's `roleTag`.

## Non-goals (the guardrails)

- **No confidence-scored mold-matching, duplicate detection, or typo/alias correction** against
  the 1,660-disc library. This was the part of the original handoff flagged as highest
  false-positive risk. Rejected — not building it.
- **No automatic coupling of wear-level to `stabilityAdj`.** A future refinement could let a
  "Beat" disc nudge its own `stabilityAdj` toward understable automatically — flagged for later,
  **not designed and not built here**. Wear-level ships as a plain, inert field this phase, same
  as `stabilityAdj` and `roleTag` did in their first pass.
- **No wear-level history or decay tracking.** It's a snapshot you update yourself when it's
  stale, not a field the app tries to age automatically.
- **No changes to the CSV import flow itself.** `CsvImportModal.tsx` stays exactly as-is — this
  is a separate, revisitable pass over data already in your bag (including manually-added discs,
  which importing wouldn't cover anyway), not an import-time step.

## Decisions (proposed — confirm before building)

- **Wear-level scale:** New / Seasoned / Beat — 3 values, matches the original handoff's own
  suggestion, same "small enum, no ceremony" shape as Throw Style. Stored as `''` (unset) /
  `'new'` / `'seasoned'` / `'beat'`.
- **Entry point:** a new "Data Audit" row in Settings' existing **DATA** section (next to the
  disc count / CSV export-import / delete-all), showing a live count — "7 discs could use more
  detail." Not folded into `CsvImportModal` (see Non-goals) and not a 6th tab (this isn't
  frequent-use like Score; it's an occasional cleanup pass, a modal/screen from Settings fits
  the same weight as Backup & Restore).
- **Audit screen mechanics — revised 2026-08-15 per Logan (wanted more interaction than a plain
  list, without adding real weight):** rows are **directly editable in place**, not a tap-through
  to a second screen. Each row = mold/mfr + whichever of weight/plastic/wear-level is missing,
  rendered as live inline controls: small `TextInput`s for weight/plastic, a 3-way pill row
  (New/Seasoned/Beat) for wear-level — same field components `DiscFormModal` already has, just
  laid out compact and inline. A field saves as soon as it's filled (weight/plastic on blur, a
  wear-level pill on tap) — no separate save step, no modal round-trip. A completed row either
  disappears from the list or flips to a checked/done state (TBD at build time — either is cheap;
  "disappears" probably reads better as visible progress through the list). This is *simpler* to
  build than the tap-through-to-`DiscFormModal` version, not more: no navigation, no second
  screen, no need to reuse the full form (which has plenty of fields irrelevant to this pass —
  color, notes, throw style). `DiscFormModal` still separately gains the wear-level pill control
  too (always-visible field, same as `stabilityAdj`/`roleTag`), since wear-level should also be
  editable from the normal edit-a-disc flow, not just the audit pass.
- **Write path:** per-field single-row `UPDATE`s (not a full `saveDiscs()` rewrite) — same B2
  lesson as `setDiscInBag()`/`clearTodaysBag()` in `db.ts`. A new `updateDiscAuditFields(userId,
  discId, { weight?, plastic?, wearLevel? })` that updates only the columns actually passed,
  fired on each field's own save moment (blur / pill tap), not batched.
- **Data model:** own column, `discs.wear_level TEXT DEFAULT ''`, same additive-migration pattern
  as `role_tag`/`stability_adj`. Not folded into the free-text `notes` field — needs to be a
  structured 3-value enum so a future automatic-`stabilityAdj`-nudge (flagged, not built) has
  something machine-readable to read.

## Screens

1. **Settings → DATA section**: new "Data Audit" button/row under the existing disc-count line,
   showing `{N} discs could use more detail` (N = count missing weight, plastic, or wear-level).
   Hidden or reads "All discs complete" at N=0.
2. **Data Audit list** (new modal, matching `CsvImportModal`'s weight/pattern): rows = bag discs
   with at least one gap, sorted incomplete-first. Each row is **inline-editable** — compact
   weight/plastic `TextInput`s and a wear-level pill row, only for whichever fields are actually
   missing on that disc — saving per-field as you go (see "Write path" above), no tap-through to
   another screen.
3. **`DiscFormModal`**: gains a wear-level 3-way pill selector (New/Seasoned/Beat), placed near
   the existing stability-adjustment/role-tag fields — same "personal specimen data" section.

## Data model

```sql
ALTER TABLE discs ADD COLUMN wear_level TEXT DEFAULT ''
```

`Disc.wearLevel?: 'new' | 'seasoned' | 'beat'` (or `''`/undefined = unset). Same
additive-column + optional-field + `db.ts` CRUD wiring as `role_tag` (Phase 3) — no new pattern.

## Followable build steps (mirrors how Phase 1/3 ran)

1. **Data layer**: migration (`wear_level` column) + `Disc.wearLevel` field + `db.ts`
   SELECT/INSERT/UPDATE wiring (same shape as the Phase 3 commit) + the new targeted
   `updateDiscAuditFields()` single-row write.
2. **`DiscFormModal`**: wear-level pill selector (always-visible field, independent of the audit
   list).
3. **Audit list**: new component, filtered query (client-side filter over already-loaded
   `discs`, no new DB query needed — same pattern the Bag tab already uses for search/filters),
   with the inline-editable row controls described above, each field committing via
   `updateDiscAuditFields()` on its own save moment.
4. **Settings entry point**: DATA-section row + live count + wire-up to open the audit list.
5. **On-device verification**: import a CSV with blank weight/plastic (or use existing gaps in
   the real bag), confirm the audit list finds them, fill a field inline and confirm it commits
   without a modal, confirm a completed row updates/disappears correctly, confirm wear-level
   persists across an app restart.

## Constraints check

Local SQLite only, no new runtime deps, no network — passes every hard constraint and the
F-Droid privacy bar trivially (same as Phase 1/3).

## Open question for Logan

Confirm the three decisions above (wear-level scale, Settings entry point, reuse-`DiscFormModal`
mechanics) before Step 1 starts — everything else in this doc follows from those three.
