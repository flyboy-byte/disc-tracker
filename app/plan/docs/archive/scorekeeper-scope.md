# Offline scorekeeper — scope (B3 candidate)

**Status:** GREENLIT 2026-07-30, building now. Logan floated it right after B2 shipped ("a real basic
score keeper for when udisc dont load, or there's no Internet") and greenlit it the same day, choosing
to build B3 *before* stores ("not emotionally ready for store release"). Assessment lives in memory
`project-offline-scorekeeper-idea`.

### Decisions (locked 2026-07-30)
- **Sequencing:** B3 **before** stores. R6/R7 deferred until Logan's ready.
- **Players:** 1–4 supported from the start (Logan: "we can do players").
- The remaining calls Logan delegated ("done by u per what this app is about"):
  - **Scoring UX:** hole-by-hole stepper for entry (big +/- thumb targets; a grid is only for review).
  - **Par model:** per-hole editable, default 3 (respects par-4/5 holes without ceremony).
  - **Tab name:** "Score" (shortest for a 5-tab bar).

## Positioning (why this, and why it's not a UDisc clone)

The app is local-first, offline, no-account, no-cloud. UDisc's weak spot is that it leans on
connectivity (course maps, GPS, login, sync). This feature covers UDisc's blind spot: a
**paper-scorecard replacement that works with zero internet, zero setup, zero login.** It does NOT
compete with UDisc on courses/GPS/social — it's the thing you reach for when UDisc won't load, you're
in a dead zone, or you just want to keep score without ceremony.

## Non-goals (the guardrails — this is the whole game)

Scorekeepers balloon into UDisc clones. **Explicitly out of scope, and staying out:**
- No GPS, distances, or maps.
- No course database / course lookup / hole maps. "Course" is a free-text label, nothing more.
- No online anything — no accounts, sync, leaderboards, friends, sharing.
- No handicaps, ratings, or cross-round statistics/trends.
- No editing a *finished* round's structure (hole count / players). Fix scores, then it's history.
- No per-throw or per-disc shot logging. (The bag is a separate feature; see "Bag tie-in" below.)

If any of these start feeling necessary, that's the signal we've drifted — stop and reconsider,
don't add.

## What it IS (minimum credible scorekeeper)

- Start a round: optional label + optional course (free text), hole count (default 18), par per hole
  (default 3, editable), 1–4 players (names; default one player "Me").
- Score it hole-by-hole: per player, +/- strokes for the current hole; running total and vs-par shown
  live. Move between holes.
- Finish + save the round. Review a saved round's summary (final scores, per-hole grid, vs par).
- A list of saved rounds; resume an in-progress one; delete a round.

That's it. Everything renders from local SQLite; the feature works fully offline forever, no new
runtime deps (plain RN views + existing expo-sqlite).

## Data model (app-only tables — no website counterpart, like the physics sim)

Added to `BASE_SCHEMA` in `src/db/migrations.ts` (CREATE TABLE IF NOT EXISTS — same tolerant pattern
as the existing tables). All keyed to `user_id` for consistency with the single-user model.

```sql
rounds(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT DEFAULT '',            -- optional; UI falls back to course/date
  course TEXT DEFAULT '',           -- free text, NOT a course DB
  played_on TEXT,                   -- ISO date string
  hole_count INTEGER DEFAULT 18,
  finished INTEGER DEFAULT 0,       -- 0 = in progress, 1 = done
  created_at TEXT
)
round_holes(round_id INTEGER, hole INTEGER, par INTEGER DEFAULT 3, PRIMARY KEY(round_id,hole))
round_players(id INTEGER PRIMARY KEY AUTOINCREMENT, round_id INTEGER, name TEXT, sort_order INTEGER)
round_scores(round_id INTEGER, player_id INTEGER, hole INTEGER, strokes INTEGER,
             PRIMARY KEY(round_id,player_id,hole))
```

`ON DELETE CASCADE` from rounds → holes/players/scores (enforce with the existing `PRAGMA
foreign_keys = ON`). Totals and vs-par are computed in JS, never stored (single source of truth =
`round_scores`). DB access goes through the existing `serialize()` queue in `db.ts`; writes are
per-hole single-row UPSERTs (learned from B2 — never rewrite a whole table per keystroke).

**Open call:** per-hole par table vs. a single default par with a `pars` JSON on `rounds`. Recommend
the `round_holes` table above — cheap, and lets a par-4/5 hole be set without a schema shuffle later.

## Screens (a 5th tab)

A new bottom tab — 5 total (Bag · Flight Shaper · Disc Suggest · **Score** · Settings). Note: 5 is the
comfortable max for a phone tab bar; if it feels cramped we reconsider placement, but 5 is fine. Needs
one new `TabBarIcon` glyph (custom react-native-svg, same as the others — no icon-lib dep).

1. **Rounds list (tab home).** Saved rounds (label/course/date + final-score summary), an in-progress
   round pinned to resume, a "New round" button. Empty state ("No rounds yet — start one").
2. **New-round setup.** Label (optional), course (optional free text), hole count stepper (default
   18), par setup (default all 3, quick-edit per hole), players (1–4 names, default "Me").
3. **Active scorecard.** Hole-by-hole: current hole + par, each player's strokes with +/- (and a
   number tap), live running total and vs-par per player, prev/next hole, "Finish round." Recommend
   hole-by-hole entry over a full grid — matches how you score mid-round and is thumb-friendly.
4. **Round summary (finished).** Final standings, per-hole grid (players × holes), total vs par,
   delete. Read-only structure; scores still correctable.

## Bag tie-in (optional, deferred)

Nice thematic loop: optionally attach "today's bag" to a round (what you threw). **Deferred** — it's
not needed for the paper-replacement core, and it couples two features. Revisit only after the basic
scorekeeper is real and used.

## Followable build steps (each verifiable; mirrors how B1/B2 ran)

1. **Data layer.** ✅ DONE (`a31665e`) — migrations (4 tables) + `db.ts` CRUD + pure `roundMath.ts` + 10 tests.
2. **5th tab + Rounds list** + empty state + new `TabBarIcon`. ✅ DONE (`c4b57ba`).
3. **New-round setup flow.** ✅ DONE (`c4b57ba`).
4. **Active scorecard** (hole-by-hole, editable par, live totals, per-hole UPSERTs). ✅ DONE.
5. **Round summary** (ranked standings + grid) + finish + delete. ✅ DONE.
6. **Polish + release.** ⏳ REMAINING. Verified end-to-end on the emulator (2-hole 2-player round;
   math + persistence correct). Known small polish: an empty player row is silently dropped (could
   default to "Player N"); title falls back to "Round" when label+course both blank (fine). Then a
   preview release (`mobile-preview-0.12`).

## Decisions for Logan (before build)

- **Tab name:** "Score" / "Scorecard" / "Rounds"? (lean "Score" — shortest for the tab bar.)
- **Scoring UX:** hole-by-hole stepper (recommended) vs. full editable grid?
- **Par model:** per-hole editable (recommended) vs. single default only?
- **Players at launch:** support 1–4 now (recommended, cheap) vs. solo-only first?
- **Sequencing:** B3 **before stores** (a real launch differentiator; delays R6, though the app is
  store-ready now) vs. **v1.1 fast-follow** after Play/F-Droid? This is the big one.

## Constraints check

Local SQLite only, fully offline, no accounts/cloud/analytics, no new runtime deps → passes every
hard constraint and clears the F-Droid network-feature bar trivially (it makes zero connections).
