# UI audit — tracked plan

**Status: not started. Scoped 2026-08-31.** Source: the Claude Design UX pass in
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

## Tier 2 — real findings, opportunistic (not batched, not this pass)

Pick these up individually, whenever the relevant screen is next being touched for another
reason — not scheduled as a block of work.

- **A1 + A3 — unify "pick one of N" + drawn icon vocabulary.** Five components / three tint
  alphas (0.12/0.16/0.28) doing the same job (`segment`, `pill`, `arcViewPill`, `modeHalf`,
  `holePresetPill`); text glyphs (`▾ ▴ ▸ › ‹ ✕ ⤒ ↑ ↓ ✓ Σ`) as icons throughout. Correct
  diagnosis, but a component-extraction project touching every screen
  (`<SegmentedControl>`/`<FilterPill>` + small `Icon` component extending `TabBarIcon.tsx`).
  Do this the next time any one of the affected screens is being edited anyway — extract the
  shared component then, don't do a standalone refactor pass first.
- **B1 — Bag actions row → primary + overflow (⋮).** Up to seven `ghostBtn`s wrapping across
  two rows in `index.tsx`'s `actionsRow`. Real layout change (`+ Add disc` stays primary,
  `Field view` moves to the filter row as a toggle, everything else — Import/Export/Share/My
  library/Clear bag — moves to an overflow menu with Clear bag styled `colors.danger` and
  separated last). Needs on-device verification, not a quick patch.
- **F1 — Settings cards → flat preference list.** Nine+ elevated cards flattened to grouped
  rows (14sp sentence-case headers in `colors.accent`, `divider`/`row`/`rowText`/`rowValue`
  already exist as the vocabulary). Touches the whole screen at once.
- **E3 — Hole strip navigation.** Replace `‹ ›`-only nav in `score.tsx` with a horizontally
  scrollable hole-chip row (current filled, scored tinted by tier, unscored outline-only).
  Turns O(n) taps into one tap; also fills dead space on 2-player rounds.
- **C2 — Slider labeling in Flight Shaper.** Value+unit on one line instead of split across
  the control; min/max at track ends; tick at the neutral value; double-tap-to-reset per
  slider.

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
