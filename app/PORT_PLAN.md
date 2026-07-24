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

## Current Status (2026-07-23) — read this first

**Phases 0–5 are built and verified on a real Android emulator (not just typechecked).**
Two real bugs were found and fixed along the way (details in Phase 4/5 sections below) —
both were the kind of thing that only shows up when you actually run the app, which is
why every phase in this doc gets an on-device pass before being marked done, not just a
green build.

**What actually works right now, if you install a build:**
- **Bag tab** — full CRUD (add manual or from the 1,660+ disc library, edit, delete,
  sort, search, filter, color picker), SQLite-backed, survives app kills.
- **Flight Shaper tab** — disc picker (bag or manual), 5 working sliders, live arc
  redraw with ghost-arc comparison, distance estimate, throw-style switcher.
- **Disc Suggest tab** — still a placeholder. Nothing built yet.

**What's released:** three debug-signed preview APKs on GitHub Releases
(`mobile-preview-0.1` → `0.3`), for hands-on testing only — not Play Store, not
F-Droid, no production keystore yet. `0.3` is current.

**Known open issues (don't re-discover these, just fix them):**
- Drag-reorder on the Bag tab (custom sort) is wired up but has **never been tested
  with a real drag gesture** — only tap-based interactions have been verified. Test
  with `adb shell input swipe` on an emulator (works fine, confirmed elsewhere this
  session) or a physical device before trusting it.
- **No physical device has run this app yet** — everything so far is emulator-only
  (x86_64 AVD `verify_test`). The shipped preview APKs are arm64/armeabi and have not
  been installed on real hardware by anyone but the end user downloading them blind.
- No production keystore — see "Signing" below.

**The pattern that caused the one shipped bug so far, and will bite again if repeated:**
`expo-router` keeps tab screens mounted when you switch away from them. Any screen that
loads data in a mount-only `useEffect` will silently show stale data forever after the
first load, if that data can change from a *different* tab. Flight Shaper had exactly
this bug (fixed 2026-07-23, commit `1cba0dd`) — it loaded the bag list once and never
noticed discs added later from the Bag tab. **Disc Suggest (Phase 6) will read the same
bag data and needs the same `useFocusEffect` refresh from the start** — don't rebuild
this bug a second time.

**Next action:** Phase 6 (Disc Suggest screen).

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
- [ ] Disc Suggest shows correct bag matches for at least Roller and Max Distance
      scenarios — **not built**
- [ ] CSV export produces a file, CSV import reads it back correctly — **not built**

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

## Phase 6 — Disc Suggest Screen — NOT STARTED

**Goal:** Scenario recommendation matching `discsuggestion.html` behavior. Still a
placeholder screen (`app/(tabs)/disc-suggest.tsx`) — nothing built.

**Features:**
1. 12-scenario grid (2 columns mobile → 3 → 6 at wider widths)
2. Tap scenario → show bag matches + library matches
3. Bag matches: "In your bag" highlighted cards
4. Library matches: top 15 sorted by proximity to scenario midpoint stability, deduplicated against bag
5. Stability chip + stability bar on each card

**Already built and ready to wire in:** `src/utils/scenarios.ts` (the real 12-entry
`SCENARIOS` array + `filterBag()`/`filterLibrary()`) from Phase 2 — this screen is pure
UI work on top of already-ported, already-tested logic.

**Master library:** `src/utils/masterLibrary.ts` (from Phase 4) — already loads
`assets/discs_master.json` via `require()`, reuse directly, no new loader needed.

**Apply the Phase 5 lesson:** this screen reads bag discs the same way Flight Shaper
does. Use `useFocusEffect` to refetch on every tab focus from the start — do not repeat
the mount-only-`useEffect` bug that shipped in `mobile-preview-0.2`.

**Parity check:** Select "Roller" scenario. Only discs with `turn <= -3` and `fade <= 1`
should appear in bag results.

---

## Phase 7 — Import / Export — NOT STARTED

**Goal:** CSV round-trip matches web behavior. `src/utils/csv.ts` (Phase 2) already has
the parsing/building/dedupe logic, tested — this phase is wiring it to file I/O and UI.

**Export fields (in order):** `mfr, mold, plastic, weight, speed, glide, turn, fade, use, thr, notes, color`

**Import behavior:**
- Parse header row to find column positions (order-agnostic)
- Strip leading `#` from color if present
- Assign new `disc_id` values (from `user_meta.next_id`)
- Append to current bag (do not clear existing discs)

**Mobile implementation:**
- Export: `expo-file-system` write temp file → `expo-sharing` share sheet
- Import: `expo-document-picker` pick `.csv` → read text → parse → insert into SQLite

**Parity check:** Export bag from web app, import CSV into mobile app. All discs appear
with correct fields.

---

## Phase 8 — Android Build and Smoke Test — PARTIALLY DONE

**Goal:** Real APK on a physical device, all screens verified. Distribution (D1/D2/D3)
is a separate track that starts after this.

**Done:** the build pipeline itself (8A below) has been run for real three times
(`mobile-preview-0.1`/`0.2`/`0.3`), each installed and exercised on an x86_64 emulator.
**Not done:** the full smoke-test checklist below has never been run end-to-end, and
none of it has been run on physical hardware — only Bag + Flight Shaper have been spot
checked, not the full checklist, and Disc Suggest/CSV don't exist yet to test.

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
- [ ] Distance bar shows ~380ft at 100% arm, flat, calm for a Destroyer specifically (a
      7/5/0/2 disc was used in testing, not Destroyer itself — same code path, but this
      exact fixture hasn't been run)
- [ ] Disc Suggest: tap "Max Distance" → correct bag results — **screen doesn't exist yet**
- [ ] Tap "Roller" → correct exclusion — **screen doesn't exist yet**
- [ ] Export CSV → share sheet appears with file — **not built yet**
- [x] Kill app → reopen → disc still in bag (SQLite persistence confirmed, multiple times)
- [ ] Play target SDK check: `aapt dump badging app.apk | grep sdkVersion` →
      `targetSdkVersion='36'` (SDK bumped since this doc was first written; confirm the
      real value when this check is actually run)
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

Three debug-signed APKs pushed to GitHub Releases for hands-on testing, ahead of any
real signing/distribution setup:

| Tag | What changed |
|-----|--------------|
| `mobile-preview-0.1` | First release — Bag tab only |
| `mobile-preview-0.2` | + Flight Shaper tab |
| `mobile-preview-0.3` | Fix: Flight Shaper showing stale bag data (see Phase 5) |

These are **debug-signed** (no production keystore exists yet — see Distribution
Track D1 below), and the repo is public, so releases are visible to anyone, not just
the user. Fine for early testing; not appropriate once real users are involved.

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

## Phase 9 — VPS Sync (v1.1, after v1 ships)

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
