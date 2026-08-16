# Website (Flask) parity — scope

**Status:** DONE 2026-08-15 (`91883c3`). All three decisions built: CSV "Both" scope ported to
the website byte-for-byte; `stability_adj`/`role_tag` columns added to the website DB and
`/api/data`, verified via a direct Flask test-client POST/GET round-trip; a new "Import backup"
button accepts either the website's own export shape or a full mobile `BackupData` file,
reusing the existing `persist()`/`render()` cycle (no new backend route needed), with
rounds/custom-discs explicitly reported as unsupported rather than silently dropped. Suggest-
engine personalization (skill/throw-style/the scoring model) stays out of scope per Decision 0.
Verified: `/` renders 200 with the new UI markers present, and `/api/data` round-trips
`stabilityAdj`/`roleTag` correctly (Flask test client). Not click-tested in a real browser —
logged as a gap, same honesty bar as the mobile phases.

## Why this track exists (and what it isn't)

The mobile app is quietly becoming the dominant platform. What's left of the website's value,
per Logan (2026-08-15): it's the **persistent, always-there, cross-OS** copy. Not "catch every
mobile feature up" — specifically two things: (1) moving disc data phone → website and back, and
(2) letting a desktop/iOS person see or use a bag without installing anything. Everything else is
explicitly lower priority than that, including porting the Disc Suggest personalization fields.

## Non-goals (for this pass)

- **Not** a full feature-parity sweep (custom-disc library, offline scorekeeper, skill/throw-style
  personalization on the website) — those stay mobile-only unless a real reason shows up.
- **Not** rebuilding website auth/accounts — the existing `/pick` username-switcher model is
  unchanged.
- **Not** two-way real-time sync. This is file-based (CSV / backup-JSON), not RESEARCH.md's old
  VPS-sync design (dropped, see `DECISIONS.md` D-1).

## What's actually true today (verified 2026-08-15, not assumed)

- **CSV format is already aligned.** Website's `buildCSV()` (`templates/index.html:970`) and the
  app's `buildCSV()` (`src/utils/csv.ts:14`) emit byte-identical headers and column order:
  `Manufacturer,Mold,Plastic,Weight,Speed,Glide,Turn,Fade,Primary Use,Throw Style,Notes`. This
  was **not** actually drifted, despite the earlier (2026-08-15, same day) note in
  `suggest-engine-plan.md` guessing it might be — that guess is corrected here.
- **One real CSV gap:** the app added a **"Both" export scope** this session (Today's Bag +
  full Collection as two labeled tables in one file) — the website only has All/Bag radio
  buttons, no Both. Small, additive fix.
- **The website already has a JSON export/import** — `GET/POST /api/data` (`app.py:216-292`).
  It's not shaped like the app's `BackupData` (`backup.ts`), but it's the same *idea*: full
  disc-list + a few settings, one user at a time via the session-scoped `/pick` login.
- **Website's `/api/data` payload today:** `discs` (id, mfr, mold, plastic, weight, speed, glide,
  turn, fade, use, thr, notes, color, inBag — **no `stabilityAdj`, no `roleTag`**), `nextId`,
  `sortMode`, `arcView`. No `skill`/`throwStyle`/`msRefEnabled`/`fieldShowAll` (those Disc Suggest
  personalization settings don't exist on the website at all — no Disc Suggest skill preset UI
  there). No `rounds` (no scorekeeper on the website). No `customDiscs` (no personal library
  table on the website).

## Decisions (proposed)

1. **CSV: add "Both" export scope to the website**, matching the app's. Cheap, self-contained,
   `templates/index.html` only — no schema change.
2. **stability_adj / role_tag: add to the website DB + `/api/data` payload**, same additive
   `ALTER TABLE` pattern `app.py:init_db()` already uses for `color`/`arc_view`/`in_bag`. This
   makes `/api/data` a **superset-compatible subset** of the app's `BackupData.discs[]` shape —
   the two disc arrays become structurally interchangeable, even though the website payload as a
   whole isn't full `BackupData`.
3. **Backup-file compatibility: import-only, discs+settings subset, not full round-trip.**
   Building `rounds`/`custom_discs` tables and a skill/throw-style settings UI on the website
   just to accept a full mobile `BackupData` file is exactly the "full feature parity" scope this
   track is explicitly avoiding. Instead: the website's existing `POST /api/data` (or a thin
   wrapper around it) accepts a mobile **backup JSON file directly** — reads `.discs[]` (already
   structurally compatible per Decision 2) and `.meta.sortMode`/`.meta.arcView`, silently ignores
   `.rounds`/`.customDiscs`/`.meta.skill` etc. (with a visible "N rounds and M custom discs in
   this file weren't imported — website doesn't support those yet" notice, not a silent drop).
   **Website → mobile restore is out of scope for this pass** — the app's own restore flow
   already only reads its own `BackupData` shape; making it also accept a bare website
   `/api/data` export is a separate, smaller follow-up if it's ever actually wanted.
4. **Cross-platform sharing = a natural consequence of 1-3, not a separate build.** Once CSV is
   aligned and a mobile backup file imports cleanly into a website account, "share your bag with
   a desktop/iOS person" is: export CSV or backup JSON on mobile → send the file any way you
   like (AirDrop, email, USB) → import on the website. No new mechanism needed.

## Screens / changes

1. **`templates/index.html`**: add the "Both" radio option to the export-scope picker
   (`exportCSV()`/`updateExportPreview()`), reusing the app's `buildBothCSV()` logic (port the
   JS, not just the idea — keep them byte-identical the same way the two `buildCSV()`s already are).
2. **`app.py`**: two `ALTER TABLE discs ADD COLUMN` migrations (`stability_adj REAL DEFAULT 0`,
   `role_tag TEXT DEFAULT ''`), added to the existing `init_db()` migration list
   (`app.py:87-89` pattern). `get_data()`/`set_data()` gain the two fields in the row
   dict/INSERT, mirroring `db.ts`'s Phase 1/3 wiring exactly (same column names even).
3. **`app.py` or a new route**: accept a mobile backup JSON file as an alternate import format
   for `/api/data` (or a new `/api/data/import_backup` if keeping the existing endpoint's
   contract clean is cleaner) — parse `.discs[]`/`.meta`, ignore+report the unsupported sections
   per Decision 3.
4. **`templates/index.html`**: an import affordance that accepts either the existing plain
   `/api/data` JSON shape or a mobile backup file (detect by the presence of `.version`/`.discs`
   nesting), with the "some sections weren't imported" notice when applicable.

## Followable build steps

1. **CSV "Both" scope on the website** — small, self-contained, verifiable against the app's
   existing `csv.test.ts` fixtures for byte-identical output.
2. **`stability_adj`/`role_tag` columns + `/api/data` wiring** — mirrors the Phase 3 mobile
   commit exactly, just in `app.py`/SQLite instead of `db.ts`/`migrations.ts`.
3. **Backup-file import acceptance** (Decision 3) — the meatiest piece; needs its own small
   design pass on exactly where the "unsupported sections" notice lives in the existing website
   UI before writing code.
4. **On-device + on-website verification**: export a mobile backup, import it on the website,
   confirm discs/settings land correctly and the notice appears for rounds/customDiscs; export
   CSV "Both" from the website, confirm it matches the app's format byte-for-byte.

## Deferred out of this scope entirely (per Decision 0 above)

Suggest-engine personalization (skill preset, throw style, the Disc Suggest scoring model
itself) on the website — genuinely a bigger lift (the website's `discsuggestion.html` uses the
older `bagTest`/`filterLibrary`-style logic, not `suggestScore.ts`) and explicitly the *last*
priority per Logan's ordering. Revisit only after 1-3 above are real and used.

## Constraints check

No new runtime deps on either side. Website stays no-account-beyond-username-picker, no cloud,
no analytics. Mobile side is unaffected (this track is entirely website-side + one shared CSV
format tweak).
