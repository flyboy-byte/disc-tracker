# UI audit — tracked plan

**Status, 2026-09-01: Tier 1 code-complete 5 of 5 (A2, E1, D3, A5, F2). Tier 2: T2-1
code-complete (closes A1, A3, and C1-for-`index.tsx`); T2-2/T2-3/T2-4/T2-5 not started, and
T2-3/T2-4 both still carry open decisions.**

> **Verification debt: CLEARED 2026-09-01.** F2 and all of T2-1 were verified on a real
> **Pixel 9 (Android 17)** — release-signed build installed over the existing v0.25.0 in place,
> so this ran against real data (33 discs, 41 demotions), not a fresh install. Covered: Bag
> (scope segment, SORT at five segments, arc view, filter pills, In-bag ✓, reorder arrows),
> Settings (all three preference segments, F2's radio list, backup), Score setup (hole
> presets), Flight Shaper (2×2 arc grid, selector chevron). Two real defects found and fixed —
> see "Found on-device" below.

Source: the Claude Design UX pass in
`docs/app-ui-design.zip` (`UX_AUDIT.md`, 30 findings across all five tabs, severity-ranked
P0/P1/P2). This doc narrows that audit to what's actually getting built and in what order —
`UX_AUDIT.md` itself stays the full record, this is the execution plan.

Two tiers, agreed with Logan 2026-08-31:
- **Tier 1** — solid, low-risk, do in order, this pass.
- **Tier 2** — real findings, bigger scope each, done opportunistically as each screen gets
  touched — not batched into one big refactor.

Scenario icons (`UX_AUDIT.md` D1, "1.3" in the handoff's `README.md`) already shipped
2026-08-31 (`14def75`) as option 1a from `designs/Disc Suggest Options.html` — same 2-up card
grid, vector icons instead of emoji, no layout change. Not tracked below.

---

## Tier 1 — this pass, in order

### 1. A2 — Touch targets to 44–48dp

**Priority: P0 · Effort: S · Risk: none (invisible in a screenshot) · Done, 2026-08-31 (`9565ca3`)**

Seven controls measure under Android's 44dp floor: `arcViewPill` (~22dp, `index.tsx` /
`flight-shaper.tsx`), `pill` (~28dp, `index.tsx` / `settings.tsx`), `ghostBtn` (~33dp,
`index.tsx` / `score.tsx`), `reorderBtn` (30dp, `DiscCard.tsx`, three adjacent — the worst
case), `selBarBtn` (~26dp, `index.tsx`), `filterChevron`/`chevron` glyph rows, `bagCheck` pill
(~26dp, `DiscCard.tsx`).

**Fix.** Keep every visual size exactly as-is. Add `hitSlop` (to reach ~44dp) or
`minHeight: 44` + `justifyContent: 'center'` on the outer touchable, whichever fits the
existing style without changing layout. No new component.

**Definition of done.** Every control above hits ≥44dp touch target; verified visually
unchanged (screenshot diff or eyeball) and functionally by tapping near — not dead-center on —
each control on-device.

**What shipped.** All 7 named controls covered via `hitSlop` only (no style/layout change):
`arcViewPill` (`index.tsx` `hitSlop={11}`, `flight-shaper.tsx` `hitSlop={10}`), `pill`
(`index.tsx` `PillRow`, `hitSlop={8}`; `settings.tsx` ×3, `hitSlop={8}`), `ghostBtn`
(`index.tsx` ×8, `hitSlop={6}`; `score.tsx` ×3, `hitSlop={4}`), `reorderBtn` (`DiscCard.tsx`,
asymmetric `{top:8,bottom:8,left:3,right:3}` — capped horizontal so the three adjacent buttons'
hit areas don't overlap each other), `bagCheck` (`DiscCard.tsx`, bumped from the pre-existing
`hitSlop={8}` to `{top:11,bottom:11,left:8,right:8}`), and the chevron-carrying rows
(`filterToggle` `index.tsx` `hitSlop={5}`; `discSelect` `hitSlop={5}` and `collapseToggle`
`hitSlop={9}`, both `flight-shaper.tsx` — two call sites the audit's table didn't itemize by
name but fell under the same "chevron rows" category). `tsc --noEmit` clean, 422/422 Jest.
Not yet verified on a real device (tap-near-not-dead-center check) — do that pass before
relying on it in the field.

### 2. E1 — Hardware Back button mid-round

**Priority: P0 · Effort: S · Depends on: an on-device check first · Done, 2026-08-31 (`867d83c`)**

`ActiveView`/`SummaryView` in `score.tsx` render a custom `‹ Rounds` header while staying
inside the Score tab — a mode switch, not a router destination — so the system Back
button/gesture probably doesn't map to it and instead exits the app or switches tabs mid-round.

**Step 1 (verify, can't be settled from source alone):** start a round on-device, get into
`ActiveView`, press hardware/gesture Back, observe what actually happens.

**Step 2, if confirmed:** `BackHandler.addEventListener('hardwareBackPress', …)` while
`mode !== 'list'`, returning to the rounds list and returning `true` to consume the event.
Remove the listener on unmount / mode change back to `'list'`.

**Definition of done.** Back from `ActiveView`/`SummaryView` returns to the rounds list, never
exits the tab or the app, verified on-device (not emulator — this needs a real gesture-nav or
3-button-nav device to be meaningful).

**What happened.** Confirmed on a real Pixel 7 (release-config APK, Metro wasn't reliably
reachable over USB so a throwaway signed-with-debug-key release build was used instead — see
`CLAUDE.md`'s build pipeline notes): hardware Back from `ActiveView` at Hole 1 of 18 jumped
straight to the **Bag tab**, not the rounds list — round data itself was untouched, just the
navigation was wrong, exactly as predicted. Fixed with one `BackHandler` listener in
`ScoreScreen` (not per-view) added/removed via `useFocusEffect` so it never intercepts Back
for another tab; routes `setup`/`active`/`summary` to the same list-return action their
existing `onCancel`/`onExit`/`onBack` handlers already implement, `list` mode falls through to
default Back behavior unchanged. Verified on-device after the fix for both `active` and `setup`
modes — both correctly return to the rounds list, round data preserved. `tsc --noEmit` clean,
422/422 Jest. `summary` mode uses the identical listener path but wasn't separately verified
on-device (would need finishing a round first) — same code, low risk, but flagging the gap
rather than claiming full coverage.

### 3. D3 — Snackbar UNDO for swipe-to-demote

**Priority: P0 · Effort: M · Done, 2026-08-31 (`ce75942`)**

`onSwipeThrow`/`onSwipeBuy` in `disc-suggest.tsx` call `demoteDisc(...)` immediately; in Buy
mode with the learning engine on, `recordSwipeAway` also mutates the learned aversion state.
No undo — a mis-swipe is a silent, two-sided state change.

**Fix.** On swipe, show a Snackbar ("Moved to bottom · UNDO", ~5s). UNDO reverses:
- the demotion (remove the `suggest_demotions` row just written, or restore its prior
  position — check whether `demoteDisc` needs a companion `undemoteDisc`/position-restore
  function in `db.ts`, or whether deleting the row is sufficient since `applyManualOrder`
  falls back to ranked order for any disc with no demotion row)
- the learning write, Buy mode only, engine on only (needs `recordSwipeAway` to expose enough
  to reverse it — likely simplest as "snapshot state before the write, restore snapshot on
  undo" rather than computing an inverse update)

Bonus effect the audit calls out: this also makes the gesture discoverable the first time it
fires by accident.

**Definition of done.** Swipe a disc away in both Throw and Buy mode, tap UNDO within the
window, confirm the disc's position and (Buy mode) the learning state are back to exactly
where they were before the swipe. Verify the Snackbar auto-dismisses and the swipe becomes
permanent after ~5s with no UNDO tap.

**What shipped.** No new Snackbar component — the existing `Toast` gained an optional action
instead, since it already had the properties that keep this from being annoying (absolutely
positioned so showing one never reflows the list, only ever one on screen — a new swipe
replaces and re-times rather than stacking, auto-dismiss) and a second treatment for one job
is exactly the audit's own A1 complaint. Action toasts add only the delta: a tappable label,
4s instead of 1.9s, and `box-none` so the list stays scrollable underneath while one is up.

Both halves of a swipe are reversed. `demoteDisc` now returns the prior position and
`undemoteDisc` consumes it — a disc that was *already* demoted and swiped again has to go back
to where it was, not lose its row. For the learning engine, the EMA blend can't be inverted
(`avoid_strength` and each brand score clamp at 1, so a saturated value has lost what it was),
so the row is snapshotted before the write and restored through the existing
`replaceLearningState`. The snapshot is read through the serialized DB queue rather than React
state, so rapid swipes each capture their true pre-swipe value instead of a stale one;
`engine_enabled` is re-read at undo time so toggling the engine off mid-window isn't reversed.

**Real bug found on-device while verifying** (same class as `v0.23`'s gesture-vs-scroll find):
`SwipeableSuggestCard` never reset `translateX` after a completed swipe, leaving the instance
parked off-screen. Latent while demote-to-bottom was the only outcome — the list virtualizes,
so the row usually remounted fresh before scrolling back into view — but undo restores a
still-mounted card, which rendered as a red "SKIP" band where the card should be. Fixed in the
component: the transform is transient gesture state, so it resets once the card is gone.

**Verified on a real Pixel 7**, Throw and Buy: swipe → toast → UNDO restores the exact prior
list order with the card rendering correctly; auto-dismiss confirmed (a late UNDO tap does
nothing). `tsc --noEmit` clean, 422/422 Jest.

**Learning-state restore verified 2026-08-31, closing the gap above.** No `expo-sqlite` Jest
harness exists to assert this directly (`PLAN.md` Track B), so verified instead through the
shipped "Save to device" backup feature, which already dumps `suggestLearning`/
`suggestDemotions` to JSON — a real read-back, not inference. Three backups pulled via `adb`:
**A** (baseline, engine on, real accumulated state from prior sessions) → swiped a Buy-mode
disc with **no** undo → **B** (`avoidStrength` 0.21→0.51, a new `latitude 64` brand-aversion
entry appeared, demotions 5→6 — confirms the write is real, not a no-op) → swiped another disc
and tapped **UNDO** → **C**. `C`'s `suggestLearning` and `suggestDemotions` are byte-for-byte
identical to `B`, confirming undo reverts exactly rather than merely not erroring.

### 4. F2 — Catalog picker as a radio list

**Priority: P1 · Effort: S–M · Code done 2026-09-01 (`tsc`/Jest clean, 422/422) — not yet
verified on-device, no Pixel 7 connected this session.**

`settings.tsx`'s catalog section rendered Built-in / Try Discs / Custom as three action rows;
the active source showed `✓ Active` in the value slot while inactive rows said `Switch` /
`Download` / `Import` — text reading as a button on rows that weren't purely buttons (the whole
row selected the source; `Download`/`Import` was a secondary action nested inside, and for
Try Discs a bare row-tap on an undownloaded source silently triggered a network fetch).

**What shipped.** Each source row is now a real single-choice radio (20px circle, 2px
`colors.accent` border, 10px filled dot when selected — new `radio`/`radioSelected`/`radioDot`
styles) wrapped in its own `Pressable` (`catalogSelectArea`) that only switches sources and is
disabled (dimmed border, `radioUnavailable`) when that source has never been downloaded/
imported — a source with nothing cached isn't a real choice yet, so it isn't selectable.
`Download` (Try Discs, first run) and `Import` (Custom, first run) are now separate trailing
`Pressable`s (`catalogActionBtn`, `hitSlop={8}` per the A2 44dp standard) that sit next to the
disabled radio and are the only things that trigger a fetch/import — tapping the label/radio
area of an undownloaded source does nothing. `Check for updates` (Try Discs, once active) and
`Import a different file/URL` (Custom, once active) stay as their own sub-rows underneath,
unchanged from before. No `testID`s referenced by any existing test (none existed for this
section), so free to restructure without touching test coverage.

**Definition of done.** Tapping an available source row selects it; `Download`/`Import` are
reachable as their own tap targets and never fire as a side effect of tapping the row. Verified
via `tsc --noEmit` + full Jest suite (422/422), and **on-device on a Pixel 9, 2026-09-01** —
the radio list renders correctly with Try Discs active (filled dot) and Custom unavailable
(dimmed `radioUnavailable` border) with its `Import` button as a separate trailing tap target,
which is exactly the state the fix was written for.

### 5. A5 — Score tier: second signal beyond color

**Priority: P0 · Effort: S · Done, 2026-09-01**

`TIER_COLOR[scoreTier(...)]` in `score.tsx` colored stroke numbers by birdie/par/bogey with
color as the only channel — a real gap for the ~8% of men with red-green color deficiency in a
sport that skews heavily male. Discussed with Logan whether a shape/weight second channel
(the original scoped fix, below) was worth the layout risk on the summary grid's dense 34px
cells — he raised a second, independent problem: the tier palette (`os` purple / `st` green /
`us` amber / `danger` red) was the only place in the app using colors outside its one-purple
(+ `sim` blue for wind) visual language, so it read as a bolted-on convention rather than
something native to this app.

**What shipped.** Dropped tier coloring entirely instead of adding a second channel — closes
the accessibility gap by elimination rather than mitigation, and fixes the palette-consistency
complaint as a side effect. `TIER_COLOR` constant, and the now-unused `scoreTier`/`ScoreTier`
import, removed from `score.tsx`; both call sites (live hole card `~610`, summary grid `~743`)
now render scored strokes in plain `colors.text` (unscored/preview stays `colors.muted`,
unchanged). Verified: `tsc --noEmit` clean, full Jest suite 422/422 passing. Per Logan, this
also leaves disc color-picker in the Bag tab as the only remaining "arbitrary" (non-purple-
family) color use in the app — a deliberate, known exception (user-chosen disc plastic colors),
not a target for this audit.

~~**Fix.** Add a shape or weight channel alongside the existing color, matching real scorecard
convention: circle outline for under par, plain for par, filled/boxed for over par. Exact
visual TBD when building — check `designs/Before After.html` row 2 (Score) for whether the
handoff mockup already shows a specific treatment before inventing one.

**Definition of done.** A user with the color channel removed (test by desaturating a
screenshot, or Android's grayscale accessibility toggle) can still distinguish birdie/par/bogey
at a glance.~~ — superseded by the plain-number approach above; kept for the reasoning trail.

---

## Tier 2 — real findings, scoped 2026-08-31, opportunistic (not batched, not this pass)

Pick these up individually, whenever the relevant screen is next being touched for another
reason — not scheduled as a block of work. Each below is scoped to the same depth as Tier 1
(exact files, exact styles/values, a real definition of done) so picking one up later doesn't
require re-deriving the design from `UX_AUDIT.md` again. Two of them (F1, E3) hit a real
open question along the way — flagged inline rather than silently decided, same as this
project's usual practice (see `PLAN.md` Track D sub-track 3 for precedent).

### T2-1. A1 + A3 — `<SegmentedControl>` / `<FilterPill>` + drawn `Icon` vocabulary

**Priority: P1 · Effort: L (component extraction + N call-site migrations, do incrementally)**

Confirmed five different "pick one of N" treatments, each with its own radius/tint:
`segment`/`segmentBtn` (`index.tsx`, Today's Bag/Collection, 10/8 radius, `rgba(…,0.16)`),
`pill` (`index.tsx` `PillRow` for STABILITY/TYPE/SORT, `settings.tsx` for Default Throw
View/Skill Level/Throw Style, radius 12, `rgba(…,0.28)`), `arcViewPill` (`index.tsx` +
`flight-shaper.tsx`, radius 6, `rgba(…,0.12)` — this is also `UX_AUDIT.md` finding **C1**,
"arc-view selector as a 2×2 grid," so fixing it here closes that finding too), `modeHalf`
(`disc-suggest.tsx` Throw/Buy, thick filled bar), `holePresetPill` (`score.tsx` 9/18/Custom,
own values).

**Two roles, not one — this matters for the migration list below:**
- **`<SegmentedControl>`** — mutually exclusive, always shows every option (arc view,
  Today's/Collection, hole preset, Default Throw View, Skill Level, Throw Style, and the
  currently-a-`pill`-but-actually-single-select **SORT** row inside `PillRow`).
- **`<FilterPill>`** — additive/optional narrowing (STABILITY, TYPE — the two `PillRow`s that
  actually are multi-state filters, not single-select).

**New theme tokens** (`src/theme.ts`): `accentTint: 'rgba(145,94,255,0.16)'` (SegmentedControl
selected state), `accentTintStrong: 'rgba(145,94,255,0.28)'` (FilterPill selected state).

**`<SegmentedControl>` spec** (from the design handoff's 1.2, already vetted): container
`flexDirection: 'row'`, `backgroundColor: colors.card`, `borderWidth: 1`,
`borderColor: colors.border`, `borderRadius: 999`, `padding: 3`, `minHeight: 44` (satisfies A2
for free on every call site it replaces); segment `flex: 1`, `paddingVertical: 6`,
`borderRadius: 999`, centered, `12/'600'/colors.muted`; selected `accentTint` background,
`colors.accent` text, `fontWeight: '700'`.

**`<FilterPill>` spec**: keep the existing `pill`/`pillActive`/`pillText`/`pillTextActive`
values from `index.tsx` (radius 12, `accentTintStrong` selected) — they're already right, just
promote to a shared component instead of duplicated `StyleSheet` blocks.

**Explicitly not migrated:** `modeHalf` (Throw/Buy) — `UX_AUDIT.md` finding **D2** calls this
out separately as a *navigation* control wearing segment-control clothing, not a "pick one of
N" state control; don't fold it into this migration, it needs its own fix (Material secondary
tabs) or none, Logan's call, out of scope here.

**`Icon` component** — new `src/components/Icon.tsx`, extending `TabBarIcon.tsx`'s exact
pattern (`react-native-svg`, `viewBox="0 0 24 24"`, tinted `color` prop) rather than modifying
that file (it's tab-bar-specific). Glyphs to replace, by call site: `▾`/`▴` (`filterChevron` in
`index.tsx` + `flight-shaper.tsx`) → `chevron-down`/`chevron-up`; `⤒`/`↑`/`↓` (`reorderBtn` in
`DiscCard.tsx`) → `arrow-to-top`/`arrow-up`/`arrow-down`; `✕` (modal close buttons, multiple
files) → `close`; `✓` (`bagCheck` pill, `DiscCard.tsx`) → `check`; `›`/`‹` (`rowChevron` in
`settings.tsx`, `holeNavText` in `score.tsx`) → `chevron-right`/`chevron-left`. **`Σ` is not an
icon fix** — per `UX_AUDIT.md` A3/E6, just replace the text with `Tot`, no glyph needed.
Re-grep for exact call sites before starting — some may have moved since this was scoped.

**Definition of done, per call site migrated:** visual size/position unchanged from before
(or only changed where A2 already fixed it), `tsc --noEmit` clean, Jest passing, one on-device
check that the control still responds correctly.

**Progress, 2026-09-01 — foundation built, one call site migrated.** Deliberately split into a
provably-safe half and a needs-eyes half, since no device was available:

*Landed (nothing renders differently):*
- `src/theme.ts` — new `tints` export (`accentTint` 0.16, `accentTintStrong` 0.28). Kept as its
  own export rather than folded into `colors` because they're alpha fills for control states,
  not palette entries.
- `src/components/SegmentedControl.tsx` — the "pick one of N" component per the spec above,
  `minHeight: 44` included. Generic over the option key type; takes `testIDPrefix` so existing
  testIDs (`bag-scope-today` etc.) survive migration unchanged.
- `src/components/FilterPill.tsx` (exports `FilterPillRow`) — the additive-narrowing
  counterpart, values lifted verbatim from `index.tsx`'s `pill*` styles.
- `src/components/Icon.tsx` — all nine glyphs (`chevron-{up,down,left,right}`, `close`, `check`,
  `arrow-{up,down}`, `arrow-to-top`) as a `PATHS` record + one `<Svg>`, same `viewBox`/
  `strokeWidth` as `TabBarIcon.tsx` so a 24px Icon matches a 24px TabBarIcon in weight.
  Nothing imports it yet.
- **First call site: `index.tsx`'s local `PillRow` → shared `FilterPillRow`** (all three uses:
  STABILITY, TYPE, SORT). Local function and its five `pill*` styles deleted. Zero visual
  change by construction — same values, same `hitSlop={8}`, same `counts` skip-`all` rule.
  `tsc` clean, Jest 422/422.

**Completed, 2026-09-01 (same session) — all remaining migrations done. `tsc` clean, Jest
422/422, net −51 lines. NONE of it has been seen on a device; every item below is a real
visual change and the whole batch owes one hardware pass.**

*`SegmentedControl` call sites migrated:* `segment` (Today's Bag/Collection, `index.tsx`);
SORT (reclassified from the pill row it was parked in); `arcViewPill` in `index.tsx`;
`holePresetPill` (`score.tsx`); `settings.tsx`'s three preference rows (Default Throw View,
Skill Level, Throw Style). Six style blocks deleted across three files, replaced by
margin-only wrappers (`scopeSegment`, `sortSegment`, `arcViewSegment`, `prefSegment`).

*`Icon` call sites migrated:* `filterChevron` (`index.tsx`), disc-select + collapse chevrons
(`flight-shaper.tsx`), `rowChevron` ×2 (`settings.tsx`), `holeNavText` ‹/› + row chevron +
`removePlayerText` ✕ (`score.tsx`), `ReorderBtn`'s ⤒/↑/↓ and the "In bag" ✓ (`DiscCard.tsx`),
and the ✓ in all three checkbox call sites (`DiscCard`, `CsvImportModal`, `DiscFormModal`).
`Σ` → `Tot` per A3/E6. Six now-dead glyph styles removed.

**Three judgment calls made during the migration, each a deviation worth knowing about:**
1. **`flight-shaper.tsx`'s `arcViewPill` was NOT migrated.** Its `arcViewRow` is
   `width: 128` + `flexWrap` with 62px pills — i.e. it is *already* the 2×2 grid `UX_AUDIT.md`
   C1 asks for. Forcing a 1×4 segmented control into a 128px slot would put four 32px segments
   under "RHBH" labels and regress it. Left the geometry alone; only retinted `arcViewPillActive`
   to the shared `tints.accentTint` so the color vocabulary still unifies. **C1 is therefore
   closed for `index.tsx` (which really was four cramped 10sp pills) and was never actually
   open for `flight-shaper.tsx`.**
2. **`holePresetPill` lost a solid fill.** Its selected state was `backgroundColor:
   colors.accent` with white text — the only solid-accent selected state among the five
   treatments. It's now the standard tint + accent text. Intended (that inconsistency is the
   A1 finding) but it's the single most visible change in this batch.
3. **Inline-in-sentence glyphs left as text on purpose:** `‹ Rounds`, `‹ Settings`,
   `‹ Prev`/`Next ›`, and the `↗` external-link markers in `settings.tsx`. Swapping those for
   SVG means restructuring a `<Text>` into a row for no legibility gain. The one exception:
   `index.tsx`'s reorder help string named the old glyphs literally ("use ⤒ / ↑ / ↓ on a
   card"), which would now describe icons that no longer look like that — reworded to "use the
   arrow buttons on a card to reorder".

**Found on-device (Pixel 9, 2026-09-01) — one prediction wrong, one real defect:**
- **SORT at five segments does NOT clip.** This was flagged as the likeliest failure and it
  renders cleanly ("Speed ↓ / Speed ↑ / Name / Mfr / Custom") at full width. No change needed.
- **The `arcBar` legend wrapped 2-then-1** once the arc-view control went full-width — the
  legend and the control were still flex siblings in a wrapping row, so the legend never got
  the full line it needed. Fixed in `ca28cdf`: `arcBar` is now an explicit column
  (`{ gap: 8, marginBottom: 8 }`), the `arcViewSegment` `flexGrow`/`minWidth: 210` wrapper is
  gone, and the legend fits on one line again.
- Everything else verified as intended: hole presets read correctly in the shared tint; every
  swapped icon is centered in its old touch target; disabled reorder arrows still dim
  correctly on the first card; `flight-shaper`'s 2×2 arc grid looks right with the shared tint,
  confirming the decision not to migrate it.

### T2-2. B1 — Bag actions: primary + overflow (⋮)

**Priority: P1 · Effort: M**

`index.tsx`'s `actionsRow` (~line 610) renders `+ Add disc` (`GradientButton`) plus up to five
more `ghostBtn`s — Import, Export, Share, My library (n, conditional), Clear bag (conditional),
Field view (conditional) — wrapping across rows.

**Fix.**
- **Stays as-is:** `+ Add disc`, sole primary action in `actionsRow`.
- **Moves to the filter row:** `Field view` toggle — relocate next to the existing
  `Filters & sort` `Pressable` (~line 556) as an outlined pill (`borderColor: colors.border`,
  `borderRadius: 8`), since it's a view-mode switch, not a screen action.
- **New overflow ⋮ button:** in `styles.header` (~line 492, next to the `Bag` title/substat),
  a 44×44 icon button (`borderRadius: 22`, `backgroundColor: 'rgba(145,94,255,0.12)'`) opening
  a bottom-sheet `<Modal transparent animationType="slide">` — **reuse the exact pattern already
  used everywhere else in this app** (`DiscLibraryModal.tsx`, `CsvImportModal.tsx`, etc.), not a
  new anchored-popover component; this codebase has zero precedent for popovers and a bottom
  sheet is the established vocabulary. List: Import CSV → Export CSV → Share bag report → My
  library (n) [conditional] → divider → **Clear today's bag** in `colors.danger`, last,
  conditional on `bagScope === 'today' && bagCount > 0` (matches the existing condition at
  line 629).
- Every action keeps its current handler (`setImportOpen`, `setExportOpen`, `setReportOpen`,
  `setLibraryOpen`, `clearBag`) — this only moves *which control* triggers them. `clearBag`'s
  existing confirm `Alert` (line 447) is untouched.

**Definition of done.** Same five actions reachable, `+ Add disc` and Field view work exactly
as before, overflow sheet opens/closes cleanly, Clear bag visually separated and red inside it.
Verify on-device — this is a real layout change, not a style-only patch.

### T2-3. F1 — Settings: flat preference list, not nine cards

**Priority: P1 · Effort: M–L · Has an open decision, see below**

Confirmed 10 separate `<View style={styles.card}>` sections in `settings.tsx` (Default Throw
View, Skill Level, Throw Style, Field View, Reference Images, Backup & Restore, Data, Disc
Catalog, About, Credits), each with equal visual weight regardless of actual importance. The
`divider`/`row`/`rowText`/`rowValue`/`rowChevron` vocabulary already exists and is already used
inside the Data and Disc Catalog cards (e.g. `Export discs (CSV)` at line 550) — just not
applied to the whole screen.

**Mechanical part (no open question):** drop the `card` background/border/radius wrapper
between sections; replace `sectionLabel`'s all-caps 10-11px treatment with 14sp sentence-case
in `colors.accent` (also closes `UX_AUDIT.md` **F6**); use `divider` between sections instead
of card edges.

**Open question — what happens to the three pill-choice sections (Default Throw View, Skill
Level, Throw Style):**
- **(a) Keep them as inline pill rows** under a plain (no-card) section header — smallest
  change, fixes the "equal visual weight" complaint (the actual F1 finding) without adding new
  screens. *(Recommended — the visual-weight problem is the real bug; converting to
  tap-to-open dialogs is a bigger interaction change than the finding asked for.)*
- **(b) Convert to single-line rows that open a picker dialog** (full Android
  `androidx.Preference` convention, matching `F1`'s literal wording) — needs three new small
  modals, more faithful to the audit's suggested end state, meaningfully more work.

Decide when this is picked up, not now — doesn't block anything else in this doc.

**Definition of done.** Screen reads as one flat list with section headers, not nine cards of
equal weight; Backup & Restore and Data no longer read as equally important as Default Throw
View; whichever (a)/(b) was chosen works end-to-end.

### T2-4. E3 — Hole strip navigation

**Priority: P1 · Effort: M · Has an open decision, see below**

`score.tsx`'s `ActiveView` (~line 509) uses `‹`/`›` only (`holeNavBtn`, 52×52, ~line 548) —
hole 17 of 18 is sixteen taps from hole 1. ~~`TIER_COLOR`/`scoreTier`/`parForHole` (already
imported/defined in `score.tsx`) give per-hole scoring tier for free.~~ **Stale as of
2026-09-01:** A5 deleted `TIER_COLOR` and the `scoreTier`/`ScoreTier` imports from `score.tsx`.
`scoreTier` still exists in `roundMath.ts` and `parForHole` is still imported, so a tier tint is
still *available* — but it's no longer free, and option (b) below (no tier tint at all) is now
also the option that stays consistent with A5's decision to drop tier color from this screen.
That materially strengthens (b); treat (a)/(c) as needing a positive reason now, not just a
preference.

**Fix.** Replace the `‹`/`›` pair with a horizontally-scrollable row of hole chips (34×34,
`borderRadius: 8`, per the design handoff): current hole filled `accentTint` with an accent
border; unscored holes outline-only; auto-scroll (via a `ScrollView` ref) to keep the current
hole in view on mount/hole-change.

**Open question — how a scored hole's tint is decided with multiple players (1-8 supported):**
the design handoff's spec ("scored holes tinted by tier") reads naturally for a single score
per hole, but Score supports up to 8 players per round — whose tier wins the chip's color?
- **(a) Tint by the active/first player's tier only** — simplest, but implies a "primary
  player" concept that doesn't otherwise exist in this feature.
- **(b) Drop the tier tint for multi-player rounds; scored holes just get a dot/fill,
  unscored stay outline** — matches `UX_AUDIT.md`'s own (simpler) original E3 wording ("scored
  ones with a dot"), sidesteps the ambiguity entirely. *(Recommended — the tier-tint idea reads
  best for the common 1-2 player case scoped in the mockup, but silently picking "whoever's
  first" for an 8-player round is the kind of thing that reads as a bug in the field.)*
- **(c) Tier tint only appears for 1-player rounds; dot-only for 2+** — a middle ground, more
  branching logic for a small visual payoff.

Decide when this is picked up.

**Definition of done.** Any hole reachable in one tap; the strip stays usable (readable,
scrollable, current hole visible) at both 9 and 18 holes; whichever (a)/(b)/(c) was chosen is
unambiguous in the code, not implicit.

### T2-5. C2 — Flight Shaper slider labeling

**Priority: P2 · Effort: M (touches `VerticalSlider.tsx`, a shared component with a known
gesture-conflict history — see `flight-shaper.tsx`'s own comments before editing it)**

`SliderCol` (`flight-shaper.tsx` ~line 437) renders label → value (`sliderValue`) → the
`VerticalSlider` itself → unit (`sliderUnit`) as three separate `Text` elements, unit ~80dp
from the value it qualifies, no visible min/max, no way back to neutral except the global
Reset button.

**Fix, three independent pieces (can land separately):**
1. **Value + unit on one line** — combine `sliderValue`/`sliderUnit` into a single Text, unit
   as a suffix at reduced opacity (e.g. `"+12°"` main weight, `"deg"` trailing at ~60%
   opacity) instead of a separate line below the control.
2. **Min/max at track ends** — `VerticalSlider.tsx` (131 lines, no existing tick/label
   rendering) needs new optional label rendering at each end, ~11sp. `SliderCol` already has
   `min`/`max` props (see the six call sites at ~line 325-332) to feed this.
3. **Double-tap-to-reset** — `VerticalSlider.tsx` has no double-tap handling today (only
   `onSlidingStart`/pan gesture per its existing props). Add a second `Gesture.Tap()` with
   `numberOfTaps(2)`, composed with the existing pan gesture via `Gesture.Race` or
   `Gesture.Exclusive` (check `VerticalSlider.tsx`'s current gesture composition before
   picking — this file has a documented gesture-vs-ScrollView conflict history, see its own
   comments and `UX_AUDIT.md` **C5**; a naive add risks reopening that). Resets that one
   slider to its default (0 for Hyzer/Nose/Wind, 100 for Arm/Spin — matches `isDefault` logic
   already in `SliderCol`).

**Definition of done.** Each of the 6 sliders (Hyzer/Nose/Wind/Cross/Arm/Spin) shows value+unit
on one line, visible min/max, and double-tap resets it without breaking the existing
`onSlidingStart` → `setScrollEnabled(false)` scroll-lock behavior (verify on-device, per C5's
own note that a cancelled gesture must never leave scroll permanently locked).

---

## Not in scope here

Everything in `UX_AUDIT.md` Part 3 not listed above (B2–B6, C1/C3–C5, D1/D2/D4–D6 beyond what's
already done, E2/E4–E7, F3/F4/F6, and the cross-cutting A4/A6) — real findings, just not picked
for this pass. Re-check `UX_AUDIT.md` before starting anything not in Tier 1/2 above rather than
assuming it's already been triaged.

Also explicitly out: **2.1 Score redesign, 2.2 Settings-as-list, 2.3 Disc Suggest picker
directions 1b/1c** from the handoff `README.md` — 2.1/2.2 overlap with Tier 2's E3/F1 above at a
narrower scope (touch-target-safe fixes first, full redesign later if ever); 2.3's 1b/1c were
explicitly declined in favor of 1a, which already shipped.
