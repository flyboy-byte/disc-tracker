# UI audit — tracked plan

**Status: not started. Tier 1 and Tier 2 both fully scoped 2026-08-31 — Tier 2 to the same
depth as Tier 1 (exact files/styles/values, open decisions flagged inline rather than
pre-decided), so picking any item up later doesn't require re-deriving it from `UX_AUDIT.md`.**
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

**Priority: P0 · Effort: S · Risk: none (invisible in a screenshot)**

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

### 2. E1 — Hardware Back button mid-round

**Priority: P0 · Effort: S · Depends on: an on-device check first**

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

### 3. D3 — Snackbar UNDO for swipe-to-demote

**Priority: P0 · Effort: M**

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

### 4. F2 — Catalog picker as a radio list

**Priority: P1 · Effort: S–M**

`settings.tsx`'s catalog section renders Built-in / Try Discs / Custom as three action rows;
the active source shows `✓ Active` in the value slot while inactive rows say `Switch` /
`Download` / `Import` — text reading as a button on rows that aren't purely buttons (the whole
row selects the source; `Download`/`Import` is a secondary action nested inside).

**Fix.** Render as a single-choice list: 20px radio (2px `colors.accent` border, 10px filled
dot when selected) per source row. The secondary action (`Download` for Try Discs first-run,
`Import` for Custom) becomes an explicit trailing button or sub-row, separate from the
selection tap target.

**Definition of done.** Tapping a source row selects it (radio state updates, catalog switches
— reuse whatever `switchCatalogSource`-equivalent already exists); `Download`/`Import` remain
reachable as their own tap targets and don't also change selection as a side effect.

### 5. A5 — Score tier: second signal beyond color

**Priority: P0 · Effort: S**

`TIER_COLOR[scoreTier(...)]` in `score.tsx` colors stroke numbers by birdie/par/bogey with
color as the only channel — a real gap for the ~8% of men with red-green color deficiency in a
sport that skews heavily male.

**Fix.** Add a shape or weight channel alongside the existing color, matching real scorecard
convention: circle outline for under par, plain for par, filled/boxed for over par. Exact
visual TBD when building — check `designs/Before After.html` row 2 (Score) for whether the
handoff mockup already shows a specific treatment before inventing one.

**Definition of done.** A user with the color channel removed (test by desaturating a
screenshot, or Android's grayscale accessibility toggle) can still distinguish birdie/par/bogey
at a glance.

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
hole 17 of 18 is sixteen taps from hole 1. `TIER_COLOR`/`scoreTier`/`parForHole` (already
imported/defined in `score.tsx`) give per-hole scoring tier for free.

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
