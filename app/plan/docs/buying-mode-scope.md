# Disc Suggest "buying mode" — scope

**Status:** DONE 2026-08-16 (`019f480`). Logan confirmed all three open decisions: build now
despite the library-coverage risk (not resolved, still worth watching), and the mode toggle is a
big 50/50 header split (not a small inline pill) — "click buy and it basically loads the screen
for buy... will use the same engine." Verified on-device: Throw/Buy persists across restart,
results scale correctly (288-708 discs depending on scenario), category+stability+brand filters
combine as AND, and the bag-gap summary. **One real wording bug caught live testing:** the gap
summary's stability label came from net turn+fade, which can mask a real cancellation (Flex
Shot's turn -2/fade 2 nets to "stable" but doesn't fly like a normal -1/+1 stable disc) — exactly
the kind of net-derived characterization `direction-2026-08-08.md` Decision 1 warns against.
Fixed by omitting the stability word when both components are individually large (≥1.5) even
though they cancel.

This doc exists because Logan asked to scope this idea further 2026-08-16, which superseded his
earlier "leave it unscored intentionally" note (2026-08-15) for the purpose of *scoping* — and,
once the open decisions below were confirmed, building it the same session.

## What this is

Disc Suggest today ranks discs **you own** against a scenario. This adds a second mode that
flips the question: given a scenario, what discs **not in your bag** would fill it well — i.e.
"what should I buy?" instead of "what should I throw?"

## Why this is gated on the library, not just scope

Logan's own caveat, worth keeping load-bearing: *"if we do much more of this we really need to
find a way to expand our library."* The bundled 1,660-disc `discs_master.json` is the entire
candidate pool for this feature — its coverage/accuracy directly is the feature's quality
ceiling, more than any scoring logic. Not a hard blocker (existing Disc Suggest already ranks
against this same library today), but a real risk: a buying-mode feature makes library gaps more
visible than "what should I throw with what I own" does, since there's no accuracy floor. Flagged
here as a risk to weigh, not resolved.

## Non-goals (v1, the guardrails)

- **No purchase links, affiliate integration, or e-commerce of any kind.** Stays a pure local
  discovery/filter tool — surfacing "this disc fits" is the whole feature, not "buy it here."
  Keeps the local-first, no-network-by-default posture intact (same bar the F-Droid privacy
  review already holds this project to).
- **No swipe-away-to-refine interaction.** Real UX idea from Logan's original sketch, but it's a
  second interaction model on top of a screen that doesn't exist yet — defer past v1.
- **No weight-based filtering.** Logan flagged this himself as "probably not workable" — the
  library's per-disc weight data isn't reliable/complete enough to filter on. Skip entirely.
- **No new scoring model.** Reuses the existing 13 scenarios + `suggestScore.ts` verbatim — this
  is a different *query* against the same scorer (library-only, excluding owned discs), not a
  new ranking algorithm.
- **No bundling of a library-expansion pass into this feature's build.** The library-coverage
  caveat above is a noted risk, not a prerequisite task list — don't scope-creep this into "also
  go expand the master library first."

## Decisions (proposed — confirm before building)

1. **Entry point:** a mode toggle on the Disc Suggest screen itself ("For throwing" / "For
   buying"), next to the existing skill/throw-style controls — not a 6th tab, not buried in
   Settings. It's a variant of a screen you're already on, not a separate destination.
2. **Persistence:** `user_meta.suggest_mode TEXT DEFAULT 'throwing'`, same tolerant-migration
   pattern as `throw_style`. Default `'throwing'` is a no-op — existing behavior unchanged unless
   a user opts in.
3. **Result set in Buying mode:** the full library, minus discs already owned (same
   name+mfr dedupe logic `disc-suggest.tsx` already uses for `libOnly`), ranked by the active
   scenario's score — one flat "Discs to consider" list, replacing the current "From your bag" +
   "All options" two-section layout (Throwing mode keeps that layout unchanged).
4. **Filters, v1 scope:** category (driver/fairway/mid/putter, via the existing `discType()`
   classification) and stability (understable/overstable/either, via the existing `stab()`
   classification) as pill filters above the results. Brand/manufacturer as a simple text filter
   or dropdown. All three reuse existing classification helpers in `disc.ts` — no new taxonomy.
5. **Bag-gap summary (the actual differentiator vs. just re-filtering the library):** a short
   strip above the results, computed client-side from the current bag — bucket owned discs by
   [speed tier] × [stability class] against the active scenario's ideal zone, and surface the
   gap in one line (e.g. "Your bag has no fast overstable driver" for a Headwind scenario with no
   qualifying disc owned). This is what makes "buying mode" more than a relabeled library
   browser — needs its own small algorithm, scoped as its own build step below.

## Data model

- `user_meta.suggest_mode TEXT DEFAULT 'throwing'` — additive `COLUMN_MIGRATIONS` entry, read/
  written alongside `skill`/`throwStyle` in `getMeta`/`setMeta` (`src/db/db.ts`).
- No new disc-level fields — this reads existing `Disc`/library data, doesn't add any.
- No backup/CSV changes beyond the existing tolerant-default pattern for the new meta field
  (mirrors `throwStyle`'s addition in Phase 1).

## Screens

- `app/(tabs)/disc-suggest.tsx`: mode toggle near the top; results section branches — Throwing
  mode renders exactly as today (zero risk of regressing it), Buying mode renders the flat
  "Discs to consider" list + filter pill row + bag-gap summary strip.
- No new modal, no new tab.

## Followable build steps (each independently verifiable)

1. `user_meta.suggest_mode` column + Settings/Disc-Suggest toggle UI, defaulting to `'throwing'`
   with zero behavior change until toggled — verify Throwing mode is byte-identical to today.
2. Buying-mode result list: library-minus-owned, ranked, flat list — verify against a known
   scenario (e.g. Flex Shot should surface library discs matching that profile, minus any
   already-owned flex-shaped disc).
3. Category/stability/brand filter pills on the Buying-mode list — verify each filter narrows
   correctly and combines with the others (AND, not OR).
4. Bag-gap summary strip — verify the gap statement is accurate against a bag with a known,
   deliberate hole (e.g. a bag with no putters should say so for an Approach scenario).

## Decisions, confirmed 2026-08-16

1. **Build now**, despite the library-coverage caveat — not a blocker, a risk to keep watching.
2. **v1 filter set confirmed as scoped**: category, stability, brand. Exclusions held: no weight
   filter, no swipe gesture, no purchase links.
3. **Bag-gap summary**: one line above the results, as scoped.
4. **Toggle placement: a big 50/50 header split** (not the originally-proposed small inline
   pill, not a Settings default) — "click buy and it basically loads the screen for buy... will
   use the same engine." Implemented as `modeBar`/`modeHalf` in `disc-suggest.tsx`.
