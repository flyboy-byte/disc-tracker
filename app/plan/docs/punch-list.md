# R1 — Parity & Kink Punch-List

> **Roadmap step R1** (Post-v1 Roadmap, `../../PORT_PLAN.md`). Produced 2026-07-25 by a
> feature-by-feature audit of the app screens/components against the website templates (the
> spec). This is the input to **R2** (Flight Shaper) and **R3** (app-wide polish). No app
> code was changed producing it.
>
> **Method:** static/code comparison of `app/app/(tabs)/*` + `app/src/components/*` against
> `templates/index.html`, `flightshape.html`, `discsuggestion.html`, using
> `MOBILE_PORT_AUDIT.md` as the spec map. **The live on-device kink sweep is the one R1
> sub-item still open** — see the bottom of this doc.
>
> Triage: **P0** = wrong/broken behavior · **P1** = real parity/"feel" gap vs. the website ·
> **P2** = polish. Items tagged **→R2** / **→R4** belong to an already-scheduled step.

## The headline gap

The website's **signature feel is that every disc visibly shows its flight path** — a mini
arc thumbnail on each bag card, a tap-to-expand arc detail, and a whole-bag "field view"
that overlays all arcs on one top-down field. **The app's Bag renders no arcs at all** — it
shows only the four flight numbers. Closing this is the single biggest "feel and intent"
win, and it's tractable because the app already has a working `FlightArcSvg` component (used
in Flight Shaper) that takes a disc + arcView and draws the exact same `arcPoints()` curve.

---

## P0 — bugs

- [x] **P0-1 · Negative numbers can't be typed into flight-number fields.** ✅ DONE (R3,
      commit `fd5a55d`). Extracted a shared `NumberInput` that holds the raw string locally,
      tolerates in-progress text (`-`, `-.`, empty), and coerces on blur; both call sites use
      it. Pure logic in `utils/numberField.ts` with unit coverage (+5 tests). Verified live:
      `-2` sticks in Turn, and the Android numeric keyboard exposes a minus key.

## P1 — parity / "feel" gaps

- [x] **P1-1 · No per-disc flight-arc thumbnail on bag cards.** ✅ DONE (R3, commit
      `131f458`). `DiscCard` now renders a compact right-rail `FlightArcSvg` (neutral, no
      ghost), stability-colored, reading the persisted arc-view (loaded on the Bag screen on
      mount + focus). Verified live across a putter/mid/driver. **Biggest single feel win.**
- [x] **P1-2 · No arc-detail view from the Bag.** ✅ DONE (R3, commit `7d38207`). New
      `ArcDetailModal` opens from a card's arc thumbnail: large computed arc + stats + Edit
      hand-off to the form. (The Marshall Street reference image inside that modal is **→R4**,
      deferred — the computed-arc detail itself is live.)
- [x] **P1-3 · No field view.** ✅ DONE (R3, commit `528b310`). New `FieldView` + a
      "Field view" toolbar toggle overlays every filtered disc's arc on one top-down field
      (disc/stability colored, mold-labeled at landing); tapping an arc opens the P1-2 detail
      sheet. Drag gated off in field mode. Verified live.
- [x] **P1-4 · No success feedback anywhere.** ✅ DONE (R3, commit `cc57799`). Added a
      root `ToastProvider` + `useToast()`; wired disc added/updated/removed, order saved,
      today's-bag cleared, CSV imported (Bag + Settings), and delete-all. Verified live.
      (CSV export uses the OS share sheet as its own feedback; form-validation error toasts
      like "Mold name is required" remain a small follow-on.)
- [x] **P1-5 · No bag-level arc-view selector or stability legend.** ✅ DONE (R3, commit
      `84eb93b`). Added a RHBH/RHFH/LHBH/LHFH pill row (flips all card arcs in-place, persists
      to the shared `meta.arcView`) + an OS/ST/US legend to the Bag toolbar. Verified live.

## P2 — polish

- [x] **P2-1 · Color picker is presets-only.** ✅ DONE (R3, commit `1a34417`). Added a custom
      hex field with a live preview swatch next to the presets (no color-picker dependency, to
      stay F-Droid-minimal). Verified live.
- [x] **P2-2 · Empty/edge states are terse.** ✅ DONE (R3, commit `814ae1f`). Truly-empty bag →
      first-run welcome + Add/Import; filtered-empty → "No discs match" + Clear filters. Verified.
- [~] **P2-3 · No pull-to-refresh.** **Deliberately skipped.** The bag/suggest lists are backed
      by local SQLite that never changes from an external source, so a pull-to-refresh gesture
      would do nothing meaningful and imply the data is remote — worse than omitting it. (Revisit
      only if R5 VPS sync makes "refresh" mean "pull from server".)
- [x] **P2-4 · First-run orientation.** ✅ DONE (R3, commit `814ae1f`). The empty-bag state
      doubles as a first-run welcome (no separate modal), covering this without extra surface.

### Also fixed in R3 (found during P2 live testing)
- [x] **Form validation was silent.** Saving with an empty mold now flags the Mold field inline
      (red border + message) instead of no-opping. Done **inline, not via toast**, because the
      form is a native `Modal` and a root-level toast renders *behind* it (confirmed live). Toasts
      from Bag/Settings still work since the modal has closed by the time they fire. (`814ae1f`.)

## Flight Shaper (→R2 — its own task, listed here for completeness)

- [ ] The long-scroll layout (disc picker → sliders → diagrams → arc-at-the-bottom) means the
      arc isn't visible while adjusting sliders. Full write-up in `../../PORT_PLAN.md`
      "Flight Shaper UX Rework". P0-1 (negative entry) also affects its Manual fields.

## Deliberate non-gaps (documented so they're not re-flagged as misses)

- **Multi-user / `pick.html`** — the app is single-user by design (CLAUDE.md hard constraint).
- **Physics-sim mode** — intentionally not ported (server dependency).
- **Marshall Street images** — scheduled as **R4**, not a miss.
- **Welcome modal** — intentionally dropped for the port (see P2-4 if we reconsider).

---

## Live on-device kink sweep — largely done through R3

Most of the interactive sweep happened organically while building/verifying R3 on the
`verify_test` emulator. Confirmed working live: negative entry, per-card arcs, arc-detail
sheet + edit handoff, toasts (update/order-saved), drag-reorder (after the card was
restructured for the arc rail) + persistence, arc-view propagation Settings→Bag, field view
+ arc tap, custom hex, empty/no-match states + Clear filters, inline mold validation. No JS
warnings from app code (only a pre-existing `InteractionManager` deprecation from
`react-native-draggable-flatlist`).

Candidate kinks — status:
- **Tab-switch data freshness** — ✅ verified (useFocusEffect refetch; arc-view propagation).
- **Keyboard covering lower form fields (Notes / custom-hex)** — ⚠️ **known minor kink.** The
  form sheet (a native `Modal` + `ScrollView`) doesn't auto-scroll/resize to the focused input
  on Android, so the soft keyboard can cover the bottom fields. Recoverable (scroll the form up
  by hand), so low-severity. Proper fix = wrap the sheet in `KeyboardAvoidingView`; deferred
  until it can be verified without risking a regression. **Not yet fixed.**
- **List scroll perf with a large bag** — untestable with the 3-disc fixture; revisit with a
  realistic bag.
- **ScrollView vs. slider gesture feel (Flight Shaper)** — ✅ verified in R2 (scroll-lock holds).
