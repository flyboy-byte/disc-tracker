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

- [ ] **P0-1 · Negative numbers can't be typed into flight-number fields.** `DiscFormModal`'s
      `NumField` and Flight Shaper's `ManualField` both do `parseFloat(text) || 0` on a
      controlled input. Typing `-` yields `NaN → 0`, and the controlled value snaps back to
      `"0"`, so the minus is swallowed — you **cannot manually enter a negative turn** (e.g.
      `-2`), which is the common case for understable discs. Workaround today is autofill
      from the library. Fix: allow an in-progress string (`-`, `-.`, empty) in local state,
      coerce to number only on blur/save. (`DiscFormModal.tsx:28`, `flight-shaper.tsx:283`.)

## P1 — parity / "feel" gaps

- [ ] **P1-1 · No per-disc flight-arc thumbnail on bag cards.** Website `index.html:657`
      renders `arcSVG(d)` on every card. App `DiscCard` shows numbers only. Reuse
      `FlightArcSvg` at a small fixed size with neutral sliders. **Biggest single feel win.**
- [ ] **P1-2 · No arc-detail view from the Bag.** Website `showArcDetail` (`index.html:405`)
      opens a modal with the full arc + Edit button. App has no way to see a disc's flight
      path without leaving for Flight Shaper. (The Marshall Street reference image inside
      that modal is **→R4**, deferred — the computed-arc detail itself is portable now.)
- [ ] **P1-3 · No field view.** Website `fieldBtn` → `renderFieldView` (`index.html:478`)
      overlays every bag disc's arc on one top-down field, colored by disc color / stability.
      A whole view mode the app lacks entirely.
- [ ] **P1-4 · No success feedback anywhere.** Website `toast()`s on 12+ actions — disc
      added/updated/removed, order saved, today's-bag cleared, CSV imported/exported/copied,
      and error cases ("Mold name is required", "Could not save"). The app confirms
      *destructive* actions with `Alert` but is **silent on every success**. Add a lightweight
      toast/snackbar and wire the same set of events. Real "feel" gap — the website
      acknowledges every action.
- [ ] **P1-5 · No bag-level arc-view selector or stability legend.** Website Bag has an
      RHBH/RHFH/LHBH/LHFH selector + an OS/ST/US color legend in the toolbar (`index.html:270`).
      The app only exposes arc view in Flight Shaper/Settings. Naturally folds in with
      P1-1/1-2 (the selector only matters once the Bag shows arcs).

## P2 — polish

- [ ] **P2-1 · Color picker is presets-only.** `DiscFormModal` offers `DISC_COLORS` swatches
      but no arbitrary color — the website has swatches **plus** an `<input type="color">`
      custom picker (`index.html:900`). Add a custom-hex option.
- [ ] **P2-2 · Empty/edge states are terse.** App shows a bare "No discs match." Compare the
      website's empty/first-run treatment; make empty bag + no-search-results feel intentional.
- [ ] **P2-3 · No pull-to-refresh** on the bag/suggest lists (minor; data is local so it's
      cosmetic, but it's an expected gesture).
- [ ] **P2-4 · First-run orientation.** The website has a one-time welcome modal
      (`disc_welcome_v1`), deliberately skipped in the port. Optional: a lightweight first-run
      hint instead of nothing. Low priority.

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

## Still open: live on-device kink sweep

This punch-list is the **static/parity** half of R1. The **interactive kink sweep** —
install the current build on the `verify_test` emulator and methodically poke every screen
for scroll/focus/tap/gesture roughness that only shows at runtime — is **not yet done**.
Candidate kinks to confirm/deny there (in addition to verifying P0-1 live): keyboard
covering the notes/number fields in the form sheet, ScrollView vs. slider gesture feel,
list scroll performance with a large bag, tab-switch data freshness. Do this pass, fold any
findings in here, then R1 is complete and R2/R3 can proceed.
