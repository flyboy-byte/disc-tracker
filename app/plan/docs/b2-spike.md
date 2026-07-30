# B2 measurement spike — results (2026-07-30)

**Goal (B2 step 1):** load ~200 discs, profile the three suspected cliffs on-device, write down
real numbers *before* optimizing anything. Per `direction-2026-07-29.md` Decision 2.

## Method

- **Fixture:** 200 discs — the 3 seed discs + 197 sampled evenly across `assets/discs_master.json`.
  15 flagged `in_bag`. Spread: 64 driver / 36 fairway / 51 mid / 49 putt. Seeded directly into the
  app's SQLite (`exec-out run-as` pull → host `sqlite3` insert → stdin-pipe push back), so the app
  opened a real 200-row bag.
- **Device:** `verify_test` emulator (x86_64, API 37, **swiftshader software GPU**). Debug APK +
  Metro (live instrumented code).
- **Instrumentation (temporary, reverted after):** `__DEV__` timing logs in `FieldView` (arcPoints
  compute) and `saveDiscs` (transaction), plus `dumpsys gfxinfo … framestats` for native render/scroll.

## Results

| Suspected cliff | Measurement | Result | Verdict |
|---|---|---|---|
| **FieldView** — all arcs in ONE `<Svg>` | JS compute (arcPoints ×200) | **2 ms** | ✅ fine — physics is not the cost |
| | native render (~1200 svg nodes) | **90th 1650 ms, 99th 1700 ms**, 75% janky | ❌ **HARD CLIFF** |
| | readability | 200 overlapping arcs + garbled overlapping labels | ❌ **unusable** |
| **saveDiscs** — full delete+reinsert | per mutation (in-bag toggle) | **~400 ms steady** (1156 ms cold) | ❌ **CLIFF** (fires on every edit/toggle/drag-end) |
| **Bag list scroll** — 200 cards, each a `FlightArcSvg` | fling FPS | **79% janky, 50th 57 ms, 90th 129 ms**, all "Slow UI thread" | ❌ **JANK** (worse than plan's "likely fine") |

### Caveats on the numbers
The emulator's swiftshader software GPU inflates native-render/GPU figures (the 4950 ms GPU
percentile is a pure artifact); real arm64 hardware will be materially faster. The **transferable
signals** — hardware-independent or structural — are:
- FieldView renders **~1200 SVG nodes in one non-virtualized `<Svg>`** and is **visually unreadable**
  at 200 regardless of hardware.
- `saveDiscs` is **O(N) rewrite of the whole table on every mutation** (200 INSERTs per toggle).
- Bag-scroll jank is **"Slow UI thread"** = JS/layout/mount-bound (mounting a `FlightArcSvg` per
  visible card), largely hardware-independent. Was smooth at the old 3-disc fixture.

## Conclusions → step-2 fix order (cheapest first, each measured-justified)

1. **FieldView → scope to the today's-bag subset.** Biggest win for least code: kills *both* the
   render cliff and the unreadability in one move (15 in-bag → ~90 nodes, fast + legible). Arguably
   FieldView's correct scope anyway ("what am I throwing today", not "my whole collection").
2. **`saveDiscs` → incremental writes.** Add `setDiscInBag(id, bool)` (single UPDATE) and a
   reorder-only path for drag-end, instead of full delete+reinsert. Keep the full-replace path for
   import/delete-all. Note: this trades away the "sync will reuse full-replace" rationale in
   `db.ts`'s header comment — **fine now that R5 sync is deferred**; revisit the comment.
3. **Bag-scroll jank → memoize `DiscCard` + tune FlatList** (`windowSize`, `initialNumToRender`,
   `maxToRenderPerBatch`); optionally skip arc-thumbnail render mid-fling. Measure again after.
4. **IA split (step 3)** — the flat 200 list *reads* poorly too; the bag/collection split (today's
   bag primary, full set as searchable archive) stays the one deliberate UX change. This is the
   judgment call to confirm with Logan before building.

**Status:** step 1 (spike) DONE. Instrumentation reverted; tree clean. Fixture-seeding recipe above
is repeatable for re-measuring after each fix.
