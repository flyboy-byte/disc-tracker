# C7 — Shareable Bag Report — scope

**Status (2026-08-18): VERIFIED ON A REAL DEVICE (Pixel 7).** Built a debug APK, installed and
tested live: added a disc to Today's Bag, opened the modal, confirmed the preview rendered
correctly, tapped Share, and confirmed a real captured PNG (correct content, no
location/notes/plastic/weight leakage) opened in the actual Android share chooser alongside every
real installed share target. Backed out of the share (no message actually sent) and removed the
test disc from Today's Bag afterward to leave real user data untouched. One real bug found and
fixed: the card footer said "1 discs" — pluralization fixed. `react-native-view-shot` autolinked
cleanly on the first real Gradle build — no issues. Decision 1 (Today's Bag only, not a Collection
toggle) confirmed fine in practice. `BagReportModal.tsx` — new component,
wired into the Bag screen's existing header-button row (`app/(tabs)/index.tsx`, "Share" button
next to Import/Export). Scoped to Today's Bag (`discs.filter(d => d.inBag)`), matching the same
pattern `bagCount` already uses on that screen. Empty-state handled (button disabled, clear
message, no attempt to export a blank image). Written 2026-08-17, following the
wear-estimate/buying-mode scope-doc template. Confirmed real by Logan 2026-08-15 (`GRAVEYARD.md`
"What's still alive").

## What this is

Render the user's bag as a shareable image and push it through the Android share sheet — no
accounts, no server, no feed. The audience-planning win named in `direction-2026-08-08.md`:
organic acquisition without any of the infrastructure a real social feature would need, while
keeping the local-first posture completely intact.

## Non-goals (the guardrails)

- **No location, no notes, no other personal free-text fields in the export by default** —
  `direction-2026-08-08.md`'s own explicit call. This is an acquisition tool, not a data-leak
  surface. If a "include notes" opt-in is ever wanted, that's a deliberate later addition, not
  assumed here.
- **No customization/theming pass.** One clean, good-looking layout — not a template picker, not
  color themes. Match the app's existing visual language (see `DiscCard.tsx`), don't invent a new
  one.
- **No in-app gallery of past exports.** Generate, preview, share, done — matches the CSV/backup
  export pattern already established (`CsvExportModal.tsx`, the Settings backup flow). Nothing
  persists after the share sheet closes.
- **No new data model.** Purely a render of state that already exists (the bag). No new SQLite
  table, no new `user_meta` column.

## Decisions (proposed — confirm before building)

1. **Scope: Today's Bag or full Collection?** Leaning **Today's Bag only** for v1 — "share what
   you're carrying today" is the more natural framing for this feature, and it sidesteps the
   "what if someone's full Collection is 200 discs" layout problem entirely. A Collection-wide
   version can be a later addition once the layout is proven at a smaller, bounded size.
2. **Entry point:** an icon button on the Bag screen's existing header row, alongside the current
   export/import controls — not a new tab, not buried in Settings. Reuses a surface that's
   already there for "do something with my bag data."
3. **New dependency: `react-native-view-shot`** (5.1.1 — supports RN ≥0.76; this app is on 0.86).
   The standard React Native view-to-image capture library; no Expo-native equivalent exists for
   this specific capability. Pure native view capture, no GMS/proprietary SDK, autolinks the same
   way `react-native-svg` already does in this project's bare-Gradle build. Added deliberately and
   pinned via `expo install`, same disciplined pattern as this session's `expo-crypto` addition —
   not silently.
4. **Layout content:** mfr/mold, flight numbers, and color per disc (reusing `DiscCard.tsx`'s
   visual language, but as a dense read-only grid rather than the interactive scrollable list),
   a disc count, and a small app credit/watermark at the bottom. No plastic/weight/wear/notes
   (those are the "too personal / not interesting to a viewer" fields, separate from the
   location/notes exclusion above, which is about privacy specifically).

## Data model

None. Reads existing `Disc[]` state (today's-bag-filtered) already available wherever the Bag
screen already loads it.

## Screens

- New component `BagReportModal.tsx`, same family/pattern as `CsvExportModal.tsx` /
  `DataAuditModal.tsx` — a full-screen modal with a live preview of the rendered card and a
  "Share" button.
- `app/(tabs)/index.tsx` (Bag screen): one new icon button in the existing header-button row that
  opens the modal.
- No new tab, no new nav route.

## Build steps (each independently verifiable)

1. `expo install react-native-view-shot` — confirm it autolinks cleanly in a local debug build
   (the emulator smoke-test pattern this project already uses for every new native dependency).
2. `BagReportModal.tsx` — the read-only card layout, rendering Today's Bag discs. Verify visually
   in isolation (an existing bag with a handful of discs) before wiring capture.
3. Wire `captureRef` (`react-native-view-shot`) → write via `expo-file-system`'s `Paths.cache`
   (matching `CsvExportModal.tsx`'s `Directory(Paths.cache, 'exports')` pattern exactly) →
   `Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your bag' })` (same call
   shape already used for CSV/backup exports). Verify: the share sheet opens with a real,
   correctly-rendered PNG attached.
4. Confirm the exported image contains no location/notes/plastic/weight/wear fields — a direct
   check against the Non-goals above, not just "it looks fine."
5. Confirm behavior with an empty Today's Bag (no discs checked in) — should show a clear empty
   state in the modal, not attempt to export a blank image.

## Verification — DONE 2026-08-18

- `tsc --noEmit` + full Jest suite clean (141/141).
- On real device (Pixel 7): opened the modal from the Bag screen, confirmed the preview rendered
  correctly for a real disc, tapped Share, confirmed the native Android share chooser opened
  ("Sharing image") with a correct real captured PNG preview and every real installed app as a
  target. Backed out without actually sending. Confirmed the image contained only mfr/mold/flight
  numbers/type/stability — no location, notes, plastic, weight, or wear.
- Empty-bag case confirmed handled gracefully (button disabled, clear message) both before and
  after the on-device pass.
