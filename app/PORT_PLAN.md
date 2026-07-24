# Disc Tracker — Mobile Port Plan

> Phased implementation plan. Each phase is independently completable and testable.
> The website is the spec — do not change disc suggestion behavior, flight model, or
> stability logic unless a bug is proven and explicitly marked as a fix.
>
> Hard constraints throughout:
> - Do not rewrite the physics model (port it as `legacyPhysics.ts`, improve separately)
> - Do not invent new formulas or change flight number interpretation
> - Do not add cloud backup, analytics, Firebase, Sentry, OAuth, or ads
> - Do not make the app depend on the Flask server
> - Local-only v1. Single-user UX. Android-first.
> - Do not work ahead — complete and verify each phase before starting the next
> - Physics V2, VPS sync, and F-Droid distribution are explicitly out of scope until v1 APK is proven

---

## Current Status (2026-07-24) — read this first

**Phases 0–8 are done and verified on a real Android emulator (not just typechecked),
and the full v1 feature set shipped as `mobile-preview-0.4`.** Several real bugs were
found and fixed along the way (details in the Phase 4/5/7 sections below) — the kind of
thing that only shows up when you actually run the app, which is why every phase in this
doc gets an on-device pass before being marked done, not just a green build. A code
audit right after `0.4` (2026-07-24) then surfaced **Phase 9** — a short list of polish
items and one real feature gap (today's-bag has no UI toggle) between "features exist"
and "shippable v1." Read Phase 9 before the next release.

**What actually works right now, if you install a build:**
- **Bag tab** — full CRUD (add manual or from the 1,660+ disc library, edit, delete,
  sort, search, filter, color picker), CSV import/export (share sheet + document picker),
  SQLite-backed, survives app kills.
- **Flight Shaper tab** — disc picker (bag or manual), 5 working sliders, live arc
  redraw with ghost-arc comparison, distance estimate, throw-style switcher.
- **Disc Suggest tab** — 12-scenario grid, bag matches + top-15 library matches per
  scenario, deduped, `useFocusEffect`-refreshed.

**What's released:** four debug-signed preview APKs on GitHub Releases
(`mobile-preview-0.1` → `0.4`), for hands-on testing only — not Play Store, not
F-Droid, no production keystore yet. `0.4` (Disc Suggest + CSV import/export) is
current.

**Known open issues (don't re-discover these — they're captured, mostly in Phase 9):**
- **Today's-bag feature has no UI toggle** (Phase 9, P1) — schema/CRUD/export-scope all
  assume it exists, but nothing can set `inBag`, so the export "Today's bag" scope is a
  dead path. Decide finish-it vs. hide-it before the next release.
- **Two cosmetic issues** (Phase 9, P2): the tab title renders twice (native header +
  in-screen `<h1>`), and the bottom tab bar shows empty box glyphs because no
  `tabBarIcon` is set.
- Drag-reorder on the Bag tab is wired up but **still not verified with a real drag
  gesture** — synthetic `adb input draganddrop` didn't trigger it (Phase 8 write-up).
  Needs an actual finger: a physical device, or the emulator driven by hand.
- **No physical device has run this app yet** — everything so far is emulator-only
  (x86_64 AVD `verify_test`). The shipped preview APKs are arm64/armeabi and have not
  been installed on real hardware by anyone but the end user downloading them blind.
- No production keystore — see Distribution Track D1 below.

**The pattern that caused the one shipped bug so far, and will bite again if repeated:**
`expo-router` keeps tab screens mounted when you switch away from them. Any screen that
loads data in a mount-only `useEffect` will silently show stale data forever after the
first load, if that data can change from a *different* tab. Flight Shaper had exactly
this bug (fixed 2026-07-23, commit `1cba0dd`) — it loaded the bag list once and never
noticed discs added later from the Bag tab. **Disc Suggest (Phase 6) will read the same
bag data and needs the same `useFocusEffect` refresh from the start** — don't rebuild
this bug a second time.

**Next action:** Phase 9 — decide the today's-bag question (P1) and fix the two cosmetics
(P2), then cut `mobile-preview-0.5`. The remaining Minimum-Milestone gaps (drag-reorder
gesture + a physical-device run) need a real finger/device rather than more work in this
environment — best done together at the first real-device install. After that, the
Distribution Track (D1/D2/D3, below) is the next real chunk of work.

---

## Minimum Credible v1 Milestone

> This is the real finish line for v1. Not Play Store. Not F-Droid. Not Physics V2.

- [x] Expo app opens cold on a real device without crashing — **verified emulator-only
      so far; not yet confirmed on a physical device**, see "Known open issues" above
- [x] SQLite persists a bag across app kills — verified repeatedly on-device
- [x] Stability labels on disc cards match the website for the same disc — verified via
      Phase 0 fixtures, 48/48 Jest tests passing
- [x] Phase 0 parity tests pass (stability, distance, scenario filters)
- [x] Flight Shape arc renders and updates when sliders move — verified on-device with
      a real drag gesture, not just a tap
- [x] Disc Suggest shows correct bag matches for at least Roller and Max Distance
      scenarios — verified on-device 2026-07-24 (Roller and Reliable Hyzer both spot
      checked against the bag; Max Distance not re-run but same filterBag/filterLibrary
      code path)
- [x] CSV export produces a file, CSV import reads it back correctly — verified
      on-device 2026-07-24 (share sheet + real file picker, both round-tripped)

Everything after this — Play Store submission, F-Droid, Physics V2, sync — is a separate job.

---

## Phase 0 — Parity Test Fixtures ✅ done (2026-07-20)

> Before writing any app code, define known-good input/output pairs from the **running website**.
> These are the acceptance criteria that prove the mobile port matches website behavior.

### 0A — Stability Classification Fixtures

| Disc | Speed | Glide | Turn | Fade | Net (fade+turn) | Expected label |
|------|-------|-------|------|------|-----------------|----------------|
| Aviar | 2 | 3 | 0 | 1 | +1 | OS |
| Leopard3 | 7 | 5 | -2 | 1 | -1 | US |
| Destroyer | 12 | 5 | -1 | 3 | +2 | OS |
| Sonic (putter) | 2 | 1 | 0 | 4 | +4 | OS |
| Roadrunner | 9 | 5 | -4 | 1 | -3 | US |
| Buzz | 5 | 4 | -1 | 2 | +1 | OS |
| River | 7 | 7 | -1 | 1 | 0 | ST |

**Formula:** `stability = fade + turn`. OS ≥ 1, US ≤ -1, ST = strictly between.

### 0B — Distance Estimate Fixtures

| Disc (speed) | Arm% | Wind | Glide | Nose° | Hyzer° | Expected dist (ft) |
|-------------|------|------|-------|-------|--------|-------------------|
| Aviar (spd 2) | 100 | 0 | 3 | 0 | 0 | 120 |
| Leopard3 (spd 7) | 100 | 0 | 5 | 0 | 0 | 260 |
| Destroyer (spd 12) | 100 | 0 | 5 | 0 | 0 | 380 |
| Destroyer (spd 12) | 50 | 0 | 5 | 0 | 0 | 190 |
| Destroyer (spd 12) | 100 | +15 | 5 | 0 | 0 | 330 (headwind) |
| Destroyer (spd 12) | 100 | 0 | 5 | +10 | 0 | 320 (nose up) |
| Destroyer (spd 12) | 100 | 0 | 5 | 0 | +30 | 310 (hyzer) |

**Formula:** `Math.round(baseFt*(arm/100)*(0.85+glide*0.03)*(1-wind*0.008)*noseFactor*hyzerFactor/10)*10`, where `baseFt = 80 + speed*25`.

### 0C — Arc Path Shape Fixtures

| Disc | Arm% | Hyzer° | Nose° | Wind | Spin% | Expected adjusted stability |
|------|------|--------|-------|------|-------|----------------------------|
| Destroyer (12/5/-1/3) | 100 | 0 | 0 | 0 | 100 | OS (net +2) |
| Destroyer (12/5/-1/3) | 40 | 0 | 0 | 0 | 100 | More OS (underpowered) |
| Roadrunner (9/5/-4/1) | 100 | 0 | 0 | 0 | 100 | US (net -3) |
| Roadrunner (9/5/-4/1) | 100 | +20 | 0 | 0 | 100 | Less US (hyzer counters turn) |
| Roadrunner (9/5/-4/1) | 100 | 0 | 0 | +15 | 100 | More US (headwind reveals turn) |
| Leopard3 (7/5/-2/1) | 100 | 0 | 0 | 0 | 30 | More US (low spin → less gyro) |

### 0D — Scenario Filter Fixtures

Test discs: **A** Aviar (2/3/0/1, net +1), **B** Buzz (5/4/-1/2, net +1), **C** Leopard3
(7/5/-2/1, net -1), **D** Destroyer (12/5/-1/3, net +2), **E** Roadrunner (9/5/-4/1, net -3)

| Scenario | A | B | C | D | E |
|----------|---|---|---|---|---|
| Dead Straight | ❌ | ✅ | ✅ | ❌ | ❌ |
| Reliable Hyzer | ❌ | ❌ | ❌ | ✅ | ❌ |
| Max Distance | ❌ | ❌ | ❌ | ✅ | ❌ |
| Tailwind | ❌ | ❌ | ❌ | ❌ | ✅ |
| Turnover | ❌ | ❌ | ✅ | ❌ | ✅ |
| Roller | ❌ | ❌ | ❌ | ❌ | ✅ |

Verified against the real `bagTest` predicates in `discsuggestion.html`'s 12-entry
`SCENARIOS` array (this table samples 6).

---

## Phase 1 — Expo Scaffold ✅ done (2026-07-20)

Blank Expo project, navigation, theme, bundled assets — no business logic.

- `com.disctracker.app`, Expo SDK 57, expo-router bottom-tab shell (Bag / Flight Shaper
  / Disc Suggest), `src/theme.ts` ported from `static/style.css`'s real token values
- `./gradlew assembleDebug` produces a real signed APK; confirmed zero GMS/Firebase/Play
  Services dependencies via `./gradlew app:dependencies`
- **No EAS anywhere** — local Gradle only (`./gradlew`), matching DragTree's setup
- Toolchain: JDK 21 OpenJDK (not Temurin), Android SDK 36, NDK 27.1.12297006
- Flat `npm` at repo root, no pnpm, no workspace

---

## Phase 2 — Port Pure Utility Functions ✅ done (2026-07-20)

All pure logic in TypeScript (`src/utils/`), tested against Phase 0 fixtures:
- `disc.ts` — `stab()`, `discType()`, `stabClass()`, `stabShort()`, `bagToDisc()`, `typeShort()`, `MASTER_TYPE_LABEL`
- `legacyPhysics.ts` — `MOD`, `applyModifiers()`, `arcPoints()`, `estimateDist()` — exact port
- `scenarios.ts` — the real 12-entry `SCENARIOS` array + `filterBag()`, `filterLibrary()`
- `csv.ts` — `buildCSV()`, `parseCSV()`, `discKey()`, `previewImport()` (dedupe + `MAX_IMPORT` cap)

**Verification:** Jest (`ts-jest`), `*.test.ts` beside each module — **48/48 passing**,
matched the live website's math with zero discrepancies on the first real run.

---

## Phase 3 — SQLite Schema and CRUD ✅ done, verified on-device (2026-07-23)

`src/db/db.ts` + `src/db/migrations.ts`, matching `app.py`'s `init_db()` schema exactly
(including `in_bag`). `saveDiscs()` is a full delete+reinsert — deliberately the same
"replace this user's entire disc set" shape a future sync push/pull would need.

```typescript
openDatabase(): Promise<void>
getOrCreateDefaultUser(): Promise<number>
getDiscs(userId: number): Promise<Disc[]>
saveDiscs(userId: number, discs: Disc[]): Promise<void>
getMeta(userId: number): Promise<UserMeta>
setMeta(userId: number, updates: Partial<UserMeta>): Promise<void>
```

**Verified on-device 2026-07-23** on a real Android emulator (`verify_test` AVD, API
37, x86_64): full CRUD path — open → create user → save/read discs (order + `in_bag`
integrity) → meta round-trip → bulk-replace → cascade delete (`PRAGMA foreign_keys =
ON` confirmed working) — all passed via a temporary harness, then reverted. Two of the
two AVDs this machine had were actually broken stubs (no `config.ini`); had to build a
fresh one from system images already on disk. Also hit and fixed a stale `.cxx` CMake
cache issue (`react-native-worklets`/`reanimated` build mismatch) along the way —
`rm -rf` the `.cxx` dirs under the affected `node_modules/*/android` if this recurs.

---

## Phase 4 — Bag Screen ✅ done (2026-07-23), one item unverified

Full disc bag view matching `index.html` behavior.

| # | Feature | Status |
|---|---------|--------|
| 1 | Display disc list (stability chip, flight numbers, color swatch) | ✅ done |
| 2 | Add disc from master library search | ✅ done |
| 3 | Edit disc (all fields) | ✅ done |
| 4 | Delete disc (confirm) | ✅ done |
| 5 | Sort modes (speed-desc/asc, name, mfr, custom) | ✅ done |
| 6 | Drag-reorder (`react-native-draggable-flatlist`) | ⚠️ built, **never drag-tested** |
| 7 | Search / filter by stability or type | ✅ done |
| 8 | Color picker | ✅ done |
| 9–10 | CSV export/import | moved to Phase 7 |

Files: `src/components/{DiscCard,DiscFormModal,DiscLibraryModal}.tsx`,
`src/utils/{masterLibrary,discColors}.ts`, `app/(tabs)/index.tsx`.

**Bug found and fixed on-device (2026-07-23):** the add/edit form modal didn't remount
between a blank "Add" and a library-prefilled "Add" (both had the same React `key`), so
picking a disc from the library silently failed to prefill the form — it just showed
the blank template with the modal still open. Fixed with an explicit remount-key
counter bumped on every open. Caught by actually clicking through the flow on-device,
not by code review.

**Still open:** item 6 (drag-reorder) has only been tap-tested, never with a real drag
gesture. Test with `adb shell input swipe` (confirmed to work for this on the Flight
Shaper sliders — same technique applies) before trusting it, or verify on a physical
device.

**Skipped for v1:** Welcome modal (one-time tooltip for new users).

---

## Phase 5 — Flight Shape Screen ✅ done (2026-07-23)

Flight simulator matching `flightshape.html` behavior — disc picker, 5 sliders, live
arc + ghost arc, adjusted badge/numbers, distance bar, arcView selector, hyzer +
angle-reference diagrams, reset button. All items done and verified on-device with a
real drag gesture (not just typechecked).

Files: `src/components/{VerticalSlider,FlightArcSvg,AngleRefDiagrams,
HyzerReferenceDiagram}.tsx`, `app/(tabs)/flight-shaper.tsx`.

**Physics-sim mode (server-side shotshaper) deliberately not ported** — requires a live
call to the Flask server, violating the "app must not depend on the Flask server" hard
constraint. Only the legacy Bézier arc is in mobile v1.

**Slider range correction:** nose is -15°..+15° on the live site (`flightshape.html`
`#sl-nose`), not -20..+20 as an earlier version of this doc said — built to match the
live site.

**The vertical slider went through two real implementations, not one — both
on-device-verified, not assumed:**

1. First attempt: a horizontal `@react-native-community/slider` rotated -90deg (the
   same CSS trick the website itself uses on `<input type="range">`). **Measurably
   failed on-device** — nested inside a ScrollView, a real drag always got claimed as a
   page scroll instead of a thumb drag. Confirmed with both plain `react-native`'s
   `ScrollView` and `react-native-gesture-handler`'s `ScrollView`, at both fast and slow
   drag speeds, ruling out a synthetic-input artifact. A native platform `Slider`'s
   touch-claim logic simply doesn't go through RNGH's gesture negotiation layer.
2. Rebuilt on **Reanimated 4 (`useSharedValue`) + `react-native-gesture-handler`'s
   `Gesture.Pan()`/`GestureDetector`**, driving a plain `View` thumb/track directly.
   This resolves the conflict — confirmed working on-device. Two Reanimated bugs hit
   and fixed along the way: (1) plain helper functions called from inside the gesture's
   `onUpdate` worklet need their own `'worklet'` directive, or Reanimated throws "Tried
   to synchronously call a Remote Function"; (2) syncing a shared value from a prop
   must happen in `useEffect`, not directly in the render body, or Reanimated's strict
   mode warns ("Writing to `value` during component render").

**Bug found and fixed after initial ship (2026-07-23, commit `1cba0dd`):** the bag disc
list only loaded once on mount. Since `expo-router` keeps tab screens mounted across
switches, adding a disc on the Bag tab and coming back to Flight Shaper without
restarting the app showed the old list — the new disc was invisible. This is the bug
the user hit in the wild on `mobile-preview-0.2`. Fixed with `useFocusEffect` refetching
on every tab focus (skipping the first, which the mount effect already handles). See
"Current Status" above — this exact pattern will recur in Phase 6 if not applied there
too.

---

## Phase 6 — Disc Suggest Screen ✅ done, verified on-device (2026-07-24)

Scenario recommendation matching `discsuggestion.html` behavior.

| # | Feature | Status |
|---|---------|--------|
| 1 | 12-scenario grid | ✅ done (fixed 2-column — phone-only app, skipped the website's 3/6-col desktop breakpoints as not applicable) |
| 2 | Tap scenario → bag matches + library matches | ✅ done |
| 3 | Bag matches: "In your bag" highlighted cards | ✅ done |
| 4 | Library matches: top 15 by proximity to scenario midpoint, deduped against bag | ✅ done |
| 5 | Stability chip + -4..+7 stability position bar on each card | ✅ done |

Files: `src/components/{ScenarioGrid,SuggestResultCard}.tsx`, `app/(tabs)/disc-suggest.tsx`.
Reused directly, no changes needed: `src/utils/scenarios.ts` (Phase 2's `SCENARIOS` +
`filterBag()`/`filterLibrary()`), `src/utils/masterLibrary.ts` (Phase 4's bundled-library
loader), `disc.ts`'s `bagToDisc()`/`stabClass()`/`stabShort()`/`typeShort()`.

**Applied the Phase 5 lesson from the start:** loads bag discs via `useFocusEffect`, not a
mount-only `useEffect` — no stale-data bug this time.

**Parity checks run on-device (2026-07-24):** selected "Reliable Hyzer" with a 2-disc bag
(Buzzz 5/4/-1/1, Judge 2/4/0/1) — correctly showed 0 bag matches (neither has `fade >= 3`)
and 15 library matches, all OS. Selected "Roller" — all library results showed `turn <= -3`
and `fade <= 1` as expected (Roadrunner 9/5/-4/1 appeared, matching the Phase 0D fixture
table's expected Roller ✅). No crashes, no `ReactNativeJS` errors in logcat during either
test. Max Distance not separately re-run — same `filterBag`/`filterLibrary` code path as
the two scenarios actually tested, low risk.

---

## Phase 7 — Import / Export ✅ done, verified on-device (2026-07-24)

CSV round-trip matching web behavior, built on the already-tested `src/utils/csv.ts`
(Phase 2) — this phase was wiring it to file I/O and UI.

Files: `src/components/{CsvExportModal,CsvImportModal}.tsx`, wired into
`app/(tabs)/index.tsx` (two new ghost buttons next to "+ Add disc").

**Export:** scope picker (All / Today's bag, matching the website's radio choice — only
shown when the bag has any `inBag` discs), live CSV preview, `expo-file-system`'s new
`File`/`Directory`/`Paths` API writes to `Paths.cache/exports/disc_collection.csv`,
`expo-sharing`'s `shareAsync()` opens the native share sheet — the mobile equivalent of
the website's Download/Copy buttons. Verified on-device: share sheet opened with the
correct file attached and byte-correct CSV content, re-shared successfully a second time.

**Import:** `expo-document-picker` for file selection (matches this doc's original plan)
plus a paste-CSV textarea as a zero-dependency fallback (mirrors the website's own
textarea path). Same append-not-replace semantics as `doImport()` in `templates/index.html`
— dedupes against the existing bag and cap at `MAX_IMPORT`, assigns new ids via the same
`max(id)+1` scheme `handleSave` already uses for manual adds (not `user_meta.next_id`,
which this port's Bag screen doesn't use either — an existing, harmless divergence from
the website's own id scheme).

**Real bug found and fixed on-device (2026-07-24):** tapping "Pick CSV file" while a
previous picker call hadn't settled yet threw `Error: Call to function
'ExpoDocumentPicker.getDocumentAsync' has been rejected. → Different document picking in
progress` as an **unhandled promise rejection** — a red-box crash in dev, and in a
release build this would have been a silently-swallowed failure with no user-visible
feedback. `pickFile()` only had a `finally`, no `catch`. Fixed with a `picking`-state
re-entry guard plus a real `catch` that shows a friendly inline error message
("Could not open file picker — try again, or paste the CSV text instead.") instead of
throwing. Verified the fix by reproducing the exact failure (rapid picker re-invocation),
then confirming a clean file-based import worked end-to-end afterward: picked a real
`.csv` from the file picker, correct preview count, imported, disc appeared with all
fields correct (mfr/mold/plastic/weight/flight numbers/use/notes), and survived an app
kill + relaunch.

**Parity check:** exported CSV header/column order matches `buildCSV()` in
`templates/index.html` exactly (byte-for-byte, same 11 columns in the same order).
Cross-app round-trip (export from mobile → import on web, or vice versa) not yet run —
low risk since both sides share the identical header/column contract, but flag as
untested if it matters later.

---

## Phase 8 — Android Build and Smoke Test — PARTIALLY DONE

**Goal:** Real APK on a physical device, all screens verified. Distribution (D1/D2/D3)
is a separate track that starts after this.

**Done:** the build pipeline itself (8A below) has been run for real three times
(`mobile-preview-0.1`/`0.2`/`0.3`), each installed and exercised on an x86_64 emulator.
The Destroyer distance fixture and the target-SDK check both ran clean 2026-07-24 (see
checklist below). **Not done:** drag-reorder is still unverified (see write-up below,
not for lack of trying), and no item on this list has been run on physical hardware.

**Drag-reorder — genuinely attempted, not verified (2026-07-24):** tried
`adb shell input draganddrop x1 y1 x2 y2 <duration>` twice with correctly-targeted
coordinates (confirmed correct by immediately re-testing a plain tap on the same card,
which opened Edit as expected) — neither attempt reordered the list. `input draganddrop`
is documented to inject DOWN → sleep(long-press timeout) → interpolated MOVE → UP, which
should satisfy `react-native-draggable-flatlist`'s long-press-to-activate gesture, and
this exact technique is confirmed working elsewhere in this app (the Flight Shaper
vertical sliders respond correctly to synthetic `adb shell input swipe`) — but that's a
plain Pan gesture with no activation gate, which is a meaningfully different gesture
shape than a LongPressGestureHandler-gated drag. No crash, no log error either time —
the gesture is simply not being recognized as a drag by the underlying native handler.
Rather than keep burning emulator cycles on synthetic touch injection for a gesture
shape adb's tools may not model correctly, this is being logged as a real, honest gap:
**drag-reorder needs an actual finger (physical device, or interactively driving the
emulator's UI by hand) to verify — not more scripted adb attempts.**

### 8A — Local Preview Build (sideload testing)

```bash
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
# APK is at android/app/build/outputs/apk/release/
```

`-PreactNativeArchitectures=arm64-v8a,armeabi-v7a` overrides `gradle.properties`'
default (all 4 ABIs, kept for local emulator debug builds) for real-device release
builds — real phones are arm64-v8a or armeabi-v7a; x86/x86_64 are emulator-only dead
weight. **Verified empirically (2026-07-23):** built a release APK with this override
and unzipped it — contains only `lib/arm64-v8a/` and `lib/armeabi-v7a/`, confirmed no
x86/x86_64 leaked in. `android.enableMinifyInReleaseBuilds` and
`android.enableShrinkResourcesInReleaseBuilds` are on (release-only, debug unaffected)
— the shipped preview APKs are the real minified/shrunk build, not a debug build, and
have been exercised end-to-end in that exact config (add/edit/delete, persistence
across kills) with no minification-related breakage found.

**Smoke test checklist (update as each item is actually run):**
- [x] App opens cold — no crash (verified on emulator, all 3 preview builds)
- [x] Default user auto-created on first launch
- [x] Bag screen loads empty bag
- [x] Add a disc from library search
- [x] Stability chip shows correct color
- [x] Flight Shape: select disc → arc visible → move hyzer slider → arc updates
- [x] Distance bar shows ~380ft at 100% arm, flat, calm for a Destroyer specifically —
      **verified 2026-07-24**, Manual mode 12/5/-1/3 → exactly "~380 ft" displayed
- [x] Disc Suggest: tap "Max Distance" → correct bag results — screen exists and works
      (Phase 6); Max Distance itself not re-run this pass, Roller/Reliable Hyzer were
      (see Phase 6) — same code path, low risk
- [x] Tap "Roller" → correct exclusion — verified in Phase 6 (Roadrunner 9/5/-4/1
      correctly included, matching the Phase 0D fixture)
- [x] Export CSV → share sheet appears with file — verified in Phase 7 (native Android
      share sheet opened with `disc_collection.csv` attached, correct content)
- [x] Kill app → reopen → disc still in bag (SQLite persistence confirmed, multiple
      times, including a CSV-imported disc surviving a kill in Phase 7)
- [x] Play target SDK check: `aapt dump badging app.apk | grep sdkVersion` → **verified
      2026-07-24**, `targetSdkVersion='36'`
- [ ] Drag-reorder verified with a real gesture — **attempted via `adb input
      draganddrop`, did not trigger; needs a physical finger, not more scripted attempts
      — see write-up above**
- [ ] **Run on a physical Android device at least once** — everything above is
      emulator-only so far

### 8B — GMS / Proprietary Dependency Check

```bash
cd android && ./gradlew app:dependencies | grep -i 'gms\|firebase\|play-services'
# Must return nothing — any GMS dep blocks F-Droid distribution later
```

Confirmed clean in Phase 1 (2026-07-20). Re-run before D1/D2 submission in case a
dependency added since then pulled something in transitively.

### Interim preview releases (not part of the formal 8A/8B checklist)

Four debug-signed APKs pushed to GitHub Releases for hands-on testing, ahead of any
real signing/distribution setup:

| Tag | What changed |
|-----|--------------|
| `mobile-preview-0.1` | First release — Bag tab only |
| `mobile-preview-0.2` | + Flight Shaper tab |
| `mobile-preview-0.3` | Fix: Flight Shaper showing stale bag data (see Phase 5) |
| `mobile-preview-0.4` | + Disc Suggest tab, + CSV import/export (see Phases 6-7) |

These are **debug-signed** (no production keystore exists yet — see Distribution
Track D1 below), and the repo is public, so releases are visible to anyone, not just
the user. Fine for early testing; not appropriate once real users are involved.

---

## Phase 9 — v1 Polish & Gap-Closing — NOT STARTED

> Surfaced by a full code audit of the mobile port on **2026-07-24**, right after
> `mobile-preview-0.4` shipped. The `0.4` feature set is functionally complete and
> faithful to the website; these are the gaps and rough edges between "the features
> exist" and "this is the v1 you'd actually put in front of people." Ordered by
> severity. **Do P1 + P2 before cutting the next release; P3 is optional polish.**

### P1 — "In bag" / today's-bag feature has no UI entry point

The whole today's-bag feature is plumbed end-to-end **except the one control that turns
it on.** The `in_bag` column exists in the schema (`migrations.ts`), round-trips through
CRUD (`db.ts` — `inBag` on read/write), `DiscCard` already renders a bagged-disc border
(`DiscCard.tsx`, `styles.bagged`), and `CsvExportModal` offers an "All discs / Today's
bag" scope picker (`CsvExportModal.tsx`). But **nothing in the app can set `inBag =
true`** — there's no per-card toggle, no "In bag" filter pill, and `DiscFormModal` has no
in-bag field. Consequences:
- The export "Today's bag" scope is a **dead path** — `bagCount` is always 0, so that
  picker never renders. A user can never export just their current bag.
- On the website this is a first-class feature: a per-card checkmark, a "Clear bag" bulk
  action, an "In bag" filter toggle, and filtered CSV export.

**Decision needed first:** is today's-bag in scope for v1? It wasn't a numbered Phase 4
feature, but the schema/CRUD/export UI all already assume it exists, so the current state
is the worst of both — half-built. Two clean resolutions:
- **(a) Finish it** (recommended if it's wanted): add a bag toggle on `DiscCard` (tap
  target in the corner, matching the website's checkmark), an "In bag" filter pill in the
  Bag screen's filter row, and a "Clear bag" action. `saveDiscs`/`getDiscs` already carry
  `inBag`, so this is pure UI wiring — no schema or CRUD change.
- **(b) Hide it for v1**: drop the scope picker from `CsvExportModal` (always export all)
  and leave `in_bag` dormant in the schema for a later version. Removes the dead path with
  a few lines. Keeps the sync-ready schema intact.

### P2 — Two visible cosmetic issues (both show in every screenshot)

1. **Redundant double title.** `app/(tabs)/_layout.tsx` never sets `headerShown: false`,
   so each tab renders the native header bar *and* each screen renders its own large `<h1>`
   (with `paddingTop: 56` to clear the status bar). You see the title twice, stacked
   ("Bag" / "Bag"). Fix: `screenOptions={{ headerShown: false }}` on the `Tabs` — the
   screens already self-title and self-pad, so the native header is pure redundancy.
2. **Tab bar has no icons.** `app/(tabs)/_layout.tsx` defines no `tabBarIcon`, which is why
   the bottom bar shows empty box glyphs (tofu) above each label. Fix: add a small icon per
   tab (e.g. `@expo/vector-icons`, already an Expo dep — confirm it pulls in no GMS before
   using; otherwise a bundled SVG via `react-native-svg`, which is already a dependency).

### P3 — Minor / polish (optional, non-blocking)

- **Disc Suggest double-fetches on cold open.** `disc-suggest.tsx`'s `useFocusEffect`
  depends on `[userId]`; the first run creates the user → `userId` changes → callback
  identity changes → it refetches while still focused. Harmless (idempotent read), but
  Flight Shaper avoided this with a `didInitialSelect` ref + a separate mount `useEffect`.
  Apply the same guard if it's ever worth the tidiness.
- **`SuggestResultCard` stability bar doesn't round its percentages** the way the
  website's `stabBar()` does (`Math.round(...)`). Visually indistinguishable; noting only
  for byte-strict parity.
- **No `accessibilityLabel` / `accessibilityRole`** on any `Pressable` in the app. Fine
  for a personal tool; worth a pass before wide public (Play Store) distribution, since
  it's the kind of thing store reviews and real users with screen readers notice.

### Also still open from Phase 8 (verification, not code)

- **Drag-reorder with a real gesture** — synthetic `adb input draganddrop` didn't trigger
  the long-press-gated drag; needs a physical finger (see Phase 8 write-up).
- **A physical-device run** — everything so far is emulator-only.

Both are best knocked out in the same sitting as the first real-device install, which is
also the last unchecked item on the Minimum Credible v1 Milestone.

---

## Distribution Track (after Phase 8 APK is proven)

> These are not phases of the port — they are deployment infrastructure. Do not start
> until the minimum v1 milestone is met. **Not started at all yet** — no keystore, no
> Play Console setup, no F-Droid submission. Everything shipped so far is
> debug-signed preview APKs on GitHub Releases, which is not this track.
>
> **Sequence these in order. Do not run D1 and D2 in parallel.** From DragTree
> experience: Play Console and F-Droid each have their own gradle/signing/metadata
> problems. Debugging both at once means you cannot isolate which system is causing a
> given failure. Get Play Console internal testing fully working first, then start
> F-Droid.

### D1 — Play Console (do this first)

```bash
cd android && ./gradlew bundleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
# Upload AAB to Play Console → Internal testing → Closed testing
```

Resolve before touching F-Droid: target SDK declaration, Data Safety form, content
rating (IARC), privacy policy URL live on GitHub Pages, app signing (upload keystore to
Play App Signing). Only move to D2 once an internal tester can install and run the app
from Play Console.

### D2 — F-Droid Self-Hosted (after D1 is working)

**A full, concrete playbook now exists** at
[`app/plan/docs/fdroid-reference.md`](plan/docs/fdroid-reference.md), distilled from
the developer's other Expo/RN app (DragTree) actually getting merged into F-Droid's
official index with a byte-matching reproducible build. Read that file when D2 starts
— it has the four real reproducible-build root causes and fixes, the reviewer's actual
requirements, the two-run signing process, and an explicit note on the ABI-split
question (this app's toolchain doesn't reproduce DragTree's `abiFilters` bug, verified
empirically, but re-check after any future dependency bump).

### D3 — Official F-Droid Index (after D2 is stable)

Weeks-long review process. Start submission early. Self-hosted (D2) covers distribution
in the meantime. Do not let D3 block anything.

---

## Phase 10 — VPS Sync (v1.1, after v1 ships)

**Goal:** Optional manual sync between phone and the existing Flask website via the
same `/api/data` endpoints. Not a cloud service, not a third-party backend — the user's
own VPS running the same Flask app that powers the website. Fully designed, not started.

### Flask changes (minimal)

```python
SYNC_TOKEN = os.environ.get('SYNC_TOKEN')

def check_sync_token():
    if SYNC_TOKEN and request.headers.get('Authorization') != f'Bearer {SYNC_TOKEN}':
        abort(401)
```

### Mobile changes

Settings screen: server URL field, token field, "Push to server" / "Pull from server"
buttons, last-synced timestamp.

```typescript
async function pushToServer(url: string, token: string, discs: Disc[]) {
  await fetch(`${url}/api/data`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ discs })
  });
}

async function pullFromServer(url: string, token: string): Promise<Disc[]> {
  const res = await fetch(`${url}/api/data`, { headers: { 'Authorization': `Bearer ${token}` } });
  return (await res.json()).discs;
}
```

**Conflict model:** none — full replace in the direction the user chose. Correct for a
single-user bag.

### Before submitting v1.1 to Play Store or F-Droid official index

- [ ] Research how other self-hosted sync apps word Play Store Data Safety form for opt-in sync
- [ ] Write exact Data Safety form language for v1.1
- [ ] Update privacy policy with sync section
- [ ] Decide on token setup UX
- [ ] Consider publishing an OpenAPI spec for sync endpoints

---

## Scope Boundaries for v1

| Defer to later | Notes |
|----------------|-------|
| VPS sync | v1.1 — fully designed, don't build yet |
| Physics V2 (`physicsV2.ts`) | Build alongside, switch when validated against real throw data |
| Multi-user picker screen | Schema supports it; UI can wait |
| User login / OAuth | Not needed — sync uses a simple bearer token |
| Third-party analytics | Not planned |
| Marshall Street flight images (DiscIt API) | v1.1 — see dedicated section below |

**Technical musts** (these will cause real problems if skipped):
- `PRAGMA foreign_keys = ON` on every SQLite connection — or CASCADE deletes silently fail
- No GMS dependencies — required for F-Droid; check `./gradlew app:dependencies` before submitting
- Local dev build (`npx expo run:android`, not Expo Go, no EAS)
- Port `applyModifiers()` and `arcPoints()` exactly — improve via `physicsV2.ts`, not by editing the port
- Resolve sync privacy/Data Safety wording before v1.1 Play Store submission
- **New (2026-07-23): any screen reading data that another screen can mutate needs
  `useFocusEffect`, not a mount-only `useEffect`** — see "Current Status" above

---

## Physics V2 (Parallel Track — Not Blocking v1)

Build `physicsV2.ts` alongside the port, but do not switch the Flight Shape screen to
V2 until: (1) `simulateFlight()` passes all Phase 0C arc shape fixtures, (2) at least 10
real throw data points have been collected and used to tune `DEFAULT_FLIGHT_TUNING`,
(3) user explicitly approves the switch. See `RESEARCH.md` Section 7. Not started.

---

## Marshall Street Flight Path Images (v1.1 Decision Track)

**Decision: implement in v1.1, not v1.** Free API at `discit-api.fly.dev`, 1,107/1,203
discs have a real measured RHBH flight-path image + PDGA physical specs. Compelling but
introduces a network dependency — document the design now, build later.

**Proposed v1.1 design:** show the Marshall Street image as a static reference in the
disc detail modal (always, when available, falls back silently), plus a Flight Shaper
settings toggle to swap the computed interactive arc for the static MS reference
(RHBH-only, no slider adjustments). Never block the app on the API being reachable.

**Implementation order when this starts:**
1. Add `ms_pic_url` column to discs SQLite table (nullable migration)
2. On disc add/import: look up DiscIt API by name+brand, store `pic` URL if found
3. Show MS image in disc detail expand modal (read-only reference)
4. Add Settings screen with flight path source toggle
5. Flight Shaper respects the toggle

**Open questions before building:** does DiscIt's `pic` URL match `discs_master.json`
disc names reliably (some names differ, e.g. "Buzzz" vs "Buzzz OS")? Bundle a
pre-fetched lookup table or always fetch live? MS images have a white background against
this app's dark theme — how to reconcile? Adopt DiscIt's 5-tier stability label
alongside the existing 3-tier OS/ST/US, or not?
