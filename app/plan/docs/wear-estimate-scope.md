# Wear estimate (1–5 scale) — scope

**Status:** SCOPING — not started. Written 2026-08-16, scoping the idea logged in
`GRAVEYARD.md` ("Wear-level 1–5 estimated broke-in scale"). Decisions below are proposed, not
confirmed — needs Logan's sign-off before any code.

## What this is

Logan's own complaint, floated while testing v0.17's Data Audit: the shipped 3-tier
New/Seasoned/Beat `wear_level` (`WEAR_LEVELS` in `src/utils/disc.ts`) "dont hardly feel enuf" for
a disc he's had 3 months and isn't sure how to bucket. This scopes a finer-grained **1–5**
estimated-wear scale as a companion to that field.

## Non-goals (the guardrails)

- **Not a rework of the shipped 3-tier field.** `discs.wear_level` stays exactly as-is — this is
  additive, not a migration of existing data. Explicit instruction from the original graveyard
  entry, carried forward here.
- **Not wired into `stabilityAdj` or `suggestScore.ts`.** Same inert-field precedent as
  `wear_level` itself (Phase 2) — a future refinement *could* let wear nudge stability
  automatically, but that coupling isn't designed and isn't built here.
- **Not auto-aged.** A snapshot you update yourself, not a field the app decays over time — same
  rule `wear_level` already follows.
- **Not required.** Fully optional; adding it must not make the Data Audit nag harder than it
  already does.

## Decisions (proposed — confirm before building)

1. **Coexist or supersede?** Two real options, genuinely open:
   - (a) **Coexist** — `wear_level` (3-tier) stays the primary/audited field; `wear_estimate`
     (1–5) is a separate, purely optional refinement sitting below it in the form. Simplest,
     least risk of confusing the two.
   - (b) **Supersede for display** — `wear_estimate` becomes the field you actually set; the
     3-tier pills become a *derived* view (1→New, 2–4→Seasoned, 5→Beat) computed from it, so
     there's only one thing to fill in, not two.
   Leaning toward **(a)** — cheaper, doesn't touch a field that just shipped and is already
   wired into the Data Audit's "missing" count, and matches this project's additive-field
   precedent (`stabilityAdj`, `roleTag`, `wearLevel` all landed as pure additions, never a
   migration of an existing field's meaning). But this is Logan's call.
2. **Data Audit visibility:** proposed **not flagged as "missing"** in the audit list — it's a
   nice-to-have refinement, not a data gap the way weight/plastic/wear-level are. Adding it to
   the audit's missing-count would make the nag *worse*, the opposite of what prompted this idea.
3. **UI shape:** a 5-segment pill row, same visual pattern as the existing `WEAR_LEVELS` pills
   and Throw Style — no new slider component, no new dependency. Endpoint labels only ("1 ·
   fresh" … "5 · trashed") rather than 5 distinct labels, to keep it a quick tap, not a decision.

## Data model

- `discs.wear_estimate INTEGER DEFAULT NULL` (1–5) — additive `COLUMN_MIGRATIONS` entry, same
  tolerant `ALTER TABLE` pattern as every other Phase-1/2/3 field.
- `Disc.wearEstimate?: number` — threaded through `getDiscs`/`insertDisc`/`updateDisc`/
  `saveDiscs` in `src/db/db.ts`, column-mapping only, same shape as `stabilityAdj`.
- Backup: no `BackupData`/`BackupMeta` change needed — rides along inside `Disc[]` automatically,
  same free ride `roleTag` got.
- CSV: **not added** — same precedent as `stabilityAdj`/`roleTag` (backup-only, mobile-only
  field, CSV stays byte-identical to the website).

## Screens

- `DiscFormModal.tsx`: a new "Wear estimate (optional)" 5-pill row, placed directly below the
  existing "Wear level (optional)" row (proposed decision 1a — both visible, both optional).
- `DataAuditModal.tsx`: **no change** if decision 2 holds — this field never appears in the
  audit's missing-field list or row UI.

## Open decisions for Logan (before build)

1. Coexist with the 3-tier field (1a) or have 1–5 supersede it for display (1b)?
2. Confirm: should stay out of the Data Audit's missing-count, or should it be included?
3. Endpoint-only labels ("1 · fresh" / "5 · trashed") or 5 distinct labels — and what should
   they say?
