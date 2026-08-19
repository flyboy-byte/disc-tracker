# Disc Suggest: swipe-to-reorder (Throw) + learning engine (Buy) — scope

**Status:** BUILT 2026-08-19, not yet verified on-device. `tsc --noEmit` clean, full Jest suite
passing (added `learningPenalty` unit tests in `suggestScore.test.ts`).

## What this is

A Gmail-style side-to-side swipe on Disc Suggest result cards. Two different behaviors on the
same gesture, confirmed with Logan before building:

- **Throw mode**: simple. Swipe a disc away → it drops to the bottom of *that scenario's* list
  only (confirmed: not global — swiping a disc off "Headwind" doesn't touch "Max Distance").
  Persists across restarts (SQLite, not local state). No engine, just a manual per-scenario
  reorder.
- **Buy mode**: an actual learning engine on top of the same reorder mechanic. Swiping teaches it
  what flight numbers and brands the user is rejecting. Aggressive within a session (fast decay);
  carries over more softly next session (slow decay on brand, faster on flight profile). Discs
  aren't removed, just pushed down — "reappear," never deleted, since the underlying result set
  is untouched and paging still reaches everything. Has an on/off toggle; off, Buy mode behaves
  exactly like Throw mode's plain reorder (Logan's own explicit fallback spec, in case the engine
  costs too much on-device perf). Toggle placement: Logan said "not sure yet" when asked — went
  with an inline pill on the Buy screen next to the filters (cheap to relocate to Settings later
  if that turns out wrong; nothing about the persisted state cares where the toggle UI lives).

## Non-goals (v1)

- No cross-scenario or cross-mode demotion (confirmed with Logan).
- No hard filtering/removal in Buy mode — everything stays reachable via paging.
- No new dependency — reuses `react-native-gesture-handler` + `react-native-reanimated`, already
  present and already used for `VerticalSlider.tsx`'s `Gesture.Pan()`/`GestureDetector` pattern.
- No change to `suggestScore.ts`'s core `score()`/`rankDiscs()`/band classification — the
  learning penalty is a separate, additive sort-order adjustment applied only in the Buy-mode
  screen code. A disc's `great`/`good`/`marginal` label always reflects its true, unpenalized
  fit — the engine changes *order*, never claims a disc fits worse than it actually does.

## Data model

Two new tables, purely additive (`CREATE TABLE IF NOT EXISTS` in `BASE_SCHEMA`, same as
`ms_pic_cache`'s standalone-cache pattern — no existing table touched, no destructive migration):

```sql
CREATE TABLE IF NOT EXISTS suggest_demotions (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  list_key TEXT NOT NULL,   -- `${mode}:${scenarioId}`, e.g. "throw:headwind" / "buy:headwind"
  disc_key TEXT NOT NULL,   -- `${mfr}|${name}`.toLowerCase()
  position INTEGER NOT NULL,
  PRIMARY KEY (user_id, list_key, disc_key)
);

CREATE TABLE IF NOT EXISTS suggest_learning (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avoid_speed    REAL DEFAULT 0,
  avoid_glide    REAL DEFAULT 0,
  avoid_turn     REAL DEFAULT 0,
  avoid_fade     REAL DEFAULT 0,
  avoid_strength REAL DEFAULT 0,
  brand_aversion TEXT DEFAULT '{}',
  engine_enabled INTEGER DEFAULT 1,
  decayed_at     TEXT
);
```

`suggest_demotions` is scenario-scoped (one row per swiped disc per list); `suggest_learning` is
one row per user, global across scenarios — the whole point is a session-wide sense of taste, not
a per-scenario one.

## The decay model ("aggressive this session, less next time")

On the first `getLearningState()` read per app process (guarded by a module-level
`Set<userId>`, not a timestamp comparison — the point is "once per launch," and the process
naturally restarts between real sessions):

- `avoid_strength *= 0.35` — the flight-number aversion centroid fades hard between launches.
  This is what makes it feel session-local: swipe a bunch of fast overstable drivers away today,
  come back tomorrow and it's a faint nudge, not a hard filter.
- each `brand_aversion[brand] *= 0.7` — brand aversion fades slowly. This is Logan's "long term
  memory on brand name" — a brand you keep rejecting stays disfavored across many sessions.

Within a session, every swipe (`recordSwipeAway`) does two things: blends the swiped disc's
speed/glide/turn/fade into the `avoid_*` centroid via an EMA (α=0.35, so the centroid tracks
*recent* swipes more than old ones within the session), and ramps `avoid_strength` back up toward
1 (+0.3 per swipe, capped). So a session of swiping away several similar discs quickly makes the
engine avoid that whole flight profile, not just repeats of the exact disc.

## Scoring integration

`suggestScore.ts` gained `learningPenalty(disc, state): number` (0..1) — a pure function, no DB
import, reusing the same `fieldScore`-style closeness math the scorer already uses but against
the *avoided* centroid with fixed tolerances (speed 3, glide 1.5, turn 1.5, fade 1.5 — matching
typical `PROFILES` tolerance magnitudes) instead of a scenario target. Combined as
`0.7 * flightSimilarity + 0.3 * brandAversion`, scaled by `avoid_strength`.

`disc-suggest.tsx`'s Buy-mode results memo: after `rankDiscs()`, if the engine is on, re-sort by
`score - learningPenalty(disc, state)` instead of raw `score`. Manual per-disc demotions (actual
swipes, via `suggest_demotions`) are applied *after* that re-sort and always win — an explicit
swipe on one disc is a stronger signal than the engine's generalized aversion to similar discs.

## Screens

- New `src/components/SwipeableSuggestCard.tsx` — wraps `SuggestResultCard`. A colored panel
  (`colors.danger`, "Skip" label) sits behind the card at all times, fading in via
  `interpolate(|translateX|, [0, threshold], [0, 1])` as the card is dragged with
  `Gesture.Pan()` + `GestureDetector` (same primitive `VerticalSlider.tsx` already uses, chosen
  there specifically because it survives being nested in a ScrollView — same reason here, since
  cards render inside a ScrollView/FlatList). Past 35% of card width in either direction, the
  card finishes leaving via `withTiming` and calls `onSwipe()`; otherwise `withSpring`s back to
  center. One component, shared by both modes — only the `onSwipe` callback differs.
- `app/(tabs)/disc-suggest.tsx`: both list-render sites (Throw's "From your bag" + "All options",
  Buy's `FlatList`) wrap cards in `SwipeableSuggestCard`. Buy mode gained a "Learning: On/Off"
  pill in the filter row. Both modes gained a "Reset order" link, shown only when the active
  scenario has ≥1 demotion — without it there'd be no way back after an accidental swipe.

## Not yet done

- **On-device verification** — this was built and unit-tested this session but not yet run on
  the Pixel 7. Needs: swipe left/right both dismiss and persist across restart; per-scenario
  isolation (swipe on Headwind doesn't affect Max Distance); Buy-mode engine actually reorders
  similar discs after a few swipes within a session, and degrades to plain-reorder with the
  toggle off; "Reset order" and "Learning: On/Off" both wire to the right persisted state.
- No dedicated `db.ts` unit tests for `demoteDisc`/`getDemotions`/`recordSwipeAway`/the decay
  pass — this project doesn't unit-test `db.ts` functions directly anywhere (they're SQLite-
  backed and verified on-device instead, same as every other `db.ts` addition to date); the pure
  scoring math (`learningPenalty`) is unit-tested in `suggestScore.test.ts`.
