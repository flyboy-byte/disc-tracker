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
> - v1 APK is now proven (`0.5` on a real phone), so the post-v1 work is sequenced by the
>   Post-v1 Roadmap (R1–R7): VPS sync (R5) and F-Droid (R7) are scheduled, not out of scope.
>   Physics V2 stays parked (a parallel R&D track, not on the roadmap).

---

## Current Status (2026-07-24) — read this first

**Phases 0–9 are done and verified on a real Android emulator (not just typechecked).**
The full v1 feature set shipped as `mobile-preview-0.4`; Phase 9 (the post-`0.4` polish +
gap-closing pass, plus a new Settings tab) shipped as **`mobile-preview-0.5`**. Several
real bugs were found and fixed by actually running the app (Phase 4/5/7/9 sections below) —
which is why every phase gets an on-device pass, not just a green build. **`0.5` was
sideloaded and confirmed working on a real physical Android device (2026-07-24) — so every
Minimum Credible v1 Milestone item is now met. v1 is functionally complete.** The next real
work is the Distribution Track (below). One UX issue surfaced from real-device use: the
**Flight Shaper workflow needs a rework** (see the note after Phase 9) — a v1.x polish item,
not a blocker.

**What actually works right now, if you install a build:**
- **Bag tab** — full CRUD (add manual or from the 1,660+ disc library, edit, delete,
  sort, search, filter, color picker), **today's-bag** (per-card toggle, filter, count,
  clear), **drag-reorder** (custom sort), CSV import/export (share sheet + document
  picker, with a today's-bag export scope), SQLite-backed, survives app kills.
- **Flight Shaper tab** — disc picker (bag or manual), 5 working sliders, live arc
  redraw with ghost-arc comparison, distance estimate, throw-style switcher.
- **Disc Suggest tab** — 12-scenario grid, bag matches + top-15 library matches per
  scenario, deduped, `useFocusEffect`-refreshed.
- **Settings tab** — default throw view (persisted, inherited by Flight Shaper), data
  backup/import/delete-all, a v1.1 sync placeholder, and About (version, GPLv3, source
  link, local-only statement).
- Tab bar has real icons; no duplicate screen titles; DB access is serialized (no
  "database is locked" under concurrent read/write).

**What's released:** five debug-signed preview APKs on GitHub Releases
(`mobile-preview-0.1` → `0.5`), for hands-on testing only — not Play Store, not F-Droid,
no production keystore yet. **`0.5` is current** — bundles all of Phase 9 (today's-bag,
Settings tab, drag-reorder, tab icons, DB lock fix, a11y) and was smoke-tested in its
true R8-minified release config.

**Known open issues (most Phase 9 items are now RESOLVED — see Phase 9 for details):**
- ~~Today's-bag has no UI toggle~~ — **fixed** (Phase 9 P1): toggle + filter + count +
  clear, and the export scope is live.
- ~~Double title / missing tab icons~~ — **fixed** (Phase 9 P2).
- ~~Drag-reorder unverified~~ — **verified on the emulator** (Phase 8/9) via
  `adb input motionevent` hold-then-move; persists across restart.
- ~~"database is locked" under concurrent read/write~~ — **fixed** (Phase 9): DB ops
  serialized in `db.ts`.
- ~~No physical device has run this app~~ — **resolved 2026-07-24**: `0.5` sideloaded and
  confirmed working on a real Android phone. Minimum Milestone fully met.
- **Flight Shaper UX workflow** — flagged from real-device use as needing a rework
  (v1.x polish, not a blocker). See the note after Phase 9.
- No production keystore — see Distribution Track D1 below (needed for the store track,
  not for v1 itself).

**The pattern that caused the one shipped bug so far, and will bite again if repeated:**
`expo-router` keeps tab screens mounted when you switch away from them. Any screen that
loads data in a mount-only `useEffect` will silently show stale data forever after the
first load, if that data can change from a *different* tab. Flight Shaper had exactly
this bug (fixed 2026-07-23, commit `1cba0dd`) — it loaded the bag list once and never
noticed discs added later from the Bag tab. **Disc Suggest (Phase 6) will read the same
bag data and needs the same `useFocusEffect` refresh from the start** — don't rebuild
this bug a second time.

**Next action:** follow the **Post-v1 Roadmap** immediately below — the priority is now
*perfect the app, then build the two deferred features, then ship to stores* (see the
roadmap for the reasoning and sequencing). The old "pick distribution or the FS rework"
framing is superseded by that ordered roadmap.

---

## Post-v1 Roadmap (2026-07-25 replan) — read this second

v1 is done and on a real phone. This roadmap is the agreed forward plan, in priority
order. It's built for **multi-session knockout**: each step below is independently
completable and shippable as its own preview release, so progress survives across
sessions without half-finished work in the tree.

**The order, and the reasoning (developer's call, 2026-07-25):**

1. **Perfect the app first.** Close the gap between the mobile app and the *feel and
   intent* the website has had time-consumingly built into it — kinks, bugs, UI/settings
   polish, the Flight Shaper workflow. This is the bulk of the near-term work.
2. **Then build the two features that were deferred to "second release"** — Marshall
   Street reference images and VPS sync. These were cut from v1 *scope* to ship, not
   rejected; pull them in **before** any store submission.
3. **Then distribution, Play Store first, F-Droid firmly still coming.** GitHub Releases
   stays the primary channel through steps 1–2. Play Store **closed testing** is the
   first store target. **F-Droid is not dropped — it's the FOSS destination that matters
   most — it's just sequenced after Play**, because Play App Signing and F-Droid's
   reproducible-build model conflict, and doing them at once means you can't isolate
   which system broke a given build (same lesson as the D1-before-D2 rule).

| Step | What | Depends on | Detailed section |
|------|------|-----------|------------------|
| **R1** | Parity & Kink Audit → punch-list | — | ✅ done — `plan/docs/punch-list.md` |
| **R2** | Flight Shaper UX rework (layout-only) | R1 | ✅ done + emulator-verified (`acd1a4c`) |
| **R3** | App-wide polish & parity fixes | R1 | 🚧 in progress — see below |

> **R3 progress (2026-07-26):** all P1 parity items + most of P2 done, verified live and shipped
> across two GitHub releases (debug-signed, arm64/armeabi): **`mobile-preview-0.6`** ("bag flight
> arcs + Flight Shaper rework") and **`mobile-preview-0.7`** ("field view + custom colors +
> polish"). Done: **P0-1** negative entry, **P1-1** card arcs, **P1-2** arc-detail sheet, **P1-3**
> field view, **P1-4** success toasts, **P1-5** arc-view selector + legend, **P2-1** custom hex
> color, **P2-2/P2-4** empty/first-run states, inline form validation. **P2-3 pull-to-refresh
> deliberately skipped** (meaningless on local-only data). **Remaining (minor):** a known
> keyboard-coverage kink on lower form fields (KeyboardAvoidingView fix deferred), large-bag
> scroll perf (untestable with the 3-disc fixture), and two cosmetic nits. Item-level status in
> `plan/docs/punch-list.md`.
| **R4** | Marshall Street reference images | R3 mostly | ✅ DONE 2026-07-29 — "Marshall Street Flight Path Images" below |
| **R4.5** | Physics-sim port (shotshaper) — **re-sequenced before R5 by Logan 2026-07-29** | R4 | Scoping doc `plan/docs/physics-sim-port.md` (awaiting decision) |
| **R5** | VPS sync (opt-in, own server) | R4.5 | "Phase 10 — VPS Sync" below |
| **R6** | Release signing + Play closed testing | R2–R5 done | "Distribution Track → D1" below |
| **R7** | F-Droid (self-hosted → official index) | R6 proven | "Distribution Track → D2/D3" below |

### R1 — Parity & Kink Audit (short; produces the punch-list R2/R3 work from)

**Goal:** a written, prioritized punch-list of everything where the app falls short of
the website's feel/intent, plus every real-device rough edge — *before* fixing anything,
so the polish work is driven by a list instead of ad hoc.

- [ ] Go feature-by-feature through `templates/index.html`, `templates/flightshape.html`,
      `templates/discsuggestion.html` and record each interaction/affordance the app is
      missing or does more crudely (e.g. website's per-disc arc-detail modal — does the
      Bag tab offer an equivalent? color-swatch treatment, empty states, toast feedback,
      keyboard/scroll behavior on the manual-entry fields, etc.).
- [ ] Real-device bug sweep — install the current build and hunt kinks (form focus/scroll,
      slow lists, awkward taps, anything that "feels off"), logging each honestly.
- [ ] Triage into **P0 bug** / **P1 parity gap** / **P2 polish**, and record it here (or a
      sibling `app/plan/docs/punch-list.md`). This list is the input to R2 and R3.

**Exit:** a written, triaged punch-list exists. No app code changed yet.

### R3 — App-wide Polish & Parity Fixes (multi-session; works the R1 punch-list)

**Goal:** grind the P0/P1/P2 list until the app *feels* like the website. Includes the
"UI settings" polish the developer called out. Not one big commit — one preview release
per meaningful batch, so it's always shippable.

- [ ] Fix all P0 bugs first.
- [ ] Close P1 parity gaps (the "feel and intent" items) in priority order.
- [ ] P2 polish as capacity allows.
- [ ] Cut a preview release (`mobile-preview-0.6+`) per batch; keep 48/48 Jest green and
      smoke-test each build in its true R8-minified release config.

**Exit:** the punch-list is down to nothing the developer considers blocking; the app
reads as a faithful, polished port of the website.

> R2 (Flight Shaper), R4 (Marshall Street), R5 (VPS sync), R6/R7 (distribution) each have
> their own detailed section further down — this roadmap only sets their **order and
> gating**. When you start one, jump to its section. Two cross-cutting notes the detailed
> sections assume:
> - **R6 folds in the production keystore** (the "think about signing more" thread):
>   generate an upload keystore, wire it via the `android/local.properties` null-guard
>   pattern (never committed, same as DragTree), enroll in **Play App Signing** on first
>   AAB upload. Nothing ships to Play without this. Deferring F-Droid to R7 is what lets
>   R6 commit fully to Play App Signing without worrying about byte-reproducibility yet.
> - **R5 (VPS sync) must land before R6's store paperwork**, because the Play Data Safety
>   form + privacy policy have to describe sync accurately (see "Before submitting v1.1"
>   under Phase 10). Building sync after the forms means redoing them.

### Network-feature privacy bar (applies to R4, R5, and any future accounts/backup)

**The developer does F-Droid inclusion reviews himself** (merged the LibreStatus MR
2026-07-25) — so this app is held to the exact reviewer rubric, and any feature that opens
a socket must be built to pass it *from the start*, not retrofitted. This is a hard
acceptance bar on R4/R5, not a nice-to-have:

- **PCAPdroid-clean.** A reviewer captures live traffic. The app must make **zero network
  connections on launch or in the background** — every request is strictly user-initiated
  (tap "sync" / open a disc detail with MS-reference explicitly enabled). No auto update
  checks, no tracking/analytics endpoints, no unexplained connections, no surprise WebView.
- **Only the one intended host.** R5 contacts only the URL the user typed (their own VPS);
  R4 contacts only `discit-api.fly.dev`. No third-party telemetry — ever (already a
  CLAUDE.md hard rule; this reinforces why it matters for distribution).
- **Off by default, degrade silently.** Both features default off / opt-in and fall back to
  offline/computed behavior on any failure — the app stays fully functional airplane-mode.
- **Minimal permissions.** No `MANAGE_EXTERNAL_STORAGE`; file access scoped; don't add a
  permission a feature doesn't use.
- **Data Safety + privacy wording** must be honest about opt-in, user-owned server, and
  user-deletable data — see RESEARCH.md "Sync Privacy Principles" and Phase 10's checklist.

**Pre-existing manifest hygiene to resolve before R6/R7** (found 2026-07-25 in
`android/app/src/main/AndroidManifest.xml` — these would draw reviewer questions):
- [ ] `SYSTEM_ALERT_WINDOW` is in the **main** manifest, so it ships in release — it belongs
      only in the **debug** manifest (RN dev-menu overlay). Remove it from main; verify the
      release APK no longer requests it.
- [x] `INTERNET` is now **exercised** by R4 (Marshall Street images, opt-in) as of 2026-07-29 —
      no longer a declared-but-unused permission. (R5 sync will also use it.)
- [ ] `expo.modules.updates.*` meta-data is present (`ENABLED=false` so inert, but
      `CHECK_ON_LAUNCH=ALWAYS`) — strip expo-updates for the F-Droid build so there's no
      "automatic update check" surface to explain.
- [ ] Re-audit the full permission list against the actual feature set right before R6
      (`VIBRATE`, legacy `READ/WRITE_EXTERNAL_STORAGE maxSdkVersion=32`) — drop anything unused.

---

## Minimum Credible v1 Milestone

> This is the real finish line for v1. Not Play Store. Not F-Droid. Not Physics V2.

- [x] Expo app opens cold on a real device without crashing — **confirmed on a real
      physical Android phone (`0.5`, 2026-07-24)**, not just the emulator
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

## Phase 8 — Android Build and Smoke Test — ✅ done (2026-07-24)

**Goal:** Real APK on a physical device, all screens verified. Distribution (D1/D2/D3)
is a separate track that starts after this.

**Done:** the build pipeline (8A below) has been run for real five times
(`mobile-preview-0.1`–`0.5`), each installed and exercised on an x86_64 emulator; `0.4` and
`0.5` were smoke-tested in their true R8-minified release config. The Destroyer distance
fixture, target-SDK check, GMS-free check, and **drag-reorder** all pass on the emulator.
**The physical-device cold start is also done** — `0.5` was sideloaded and confirmed
running on a real Android phone (2026-07-24). This phase is complete; the whole
Minimum Credible v1 Milestone is met.

**Drag-reorder — VERIFIED on the emulator (2026-07-24).** Earlier attempts with
`adb input draganddrop` and slow `input swipe` failed because neither can produce the
long-press-then-move that `react-native-draggable-flatlist` gates its drag on — a
continuous swipe is claimed as a list scroll before the ~500ms long-press arms. The
working technique is a raw hold-then-move touch stream, held stationary long enough to
fire `onLongPress` (which calls `drag()`), then moved:
```bash
adb shell "input motionevent DOWN 540 1000; sleep 0.9; \
  input motionevent MOVE 540 1150; input motionevent MOVE 540 1350; \
  input motionevent MOVE 540 1520; input motionevent UP 540 1560"
```
This reordered a card past its neighbour and the new order **persisted across a full
kill + relaunch** (so `handleDragEnd` → `saveDiscs` writes correctly). Lesson for future
sessions: drag/long-press-gated gestures ARE emulator-testable — use `input motionevent`
with a hold, not `input draganddrop`/`swipe`.

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
- [x] Drag-reorder verified with a real gesture — **verified 2026-07-24** via
      `adb input motionevent` hold-then-move; reorder persisted across kill+relaunch (see
      write-up above)
- [ ] **Run on a physical Android device at least once** — everything above is
      emulator-only so far (the one genuinely hardware-blocked item)

### 8B — GMS / Proprietary Dependency Check

```bash
cd android && ./gradlew app:dependencies | grep -i 'gms\|firebase\|play-services'
# Must return nothing — any GMS dep blocks F-Droid distribution later
```

Confirmed clean in Phase 1 (2026-07-20). Re-run before D1/D2 submission in case a
dependency added since then pulled something in transitively.

### Interim preview releases (not part of the formal 8A/8B checklist)

Five debug-signed APKs pushed to GitHub Releases for hands-on testing, ahead of any
real signing/distribution setup:

| Tag | What changed |
|-----|--------------|
| `mobile-preview-0.1` | First release — Bag tab only |
| `mobile-preview-0.2` | + Flight Shaper tab |
| `mobile-preview-0.3` | Fix: Flight Shaper showing stale bag data (see Phase 5) |
| `mobile-preview-0.4` | + Disc Suggest tab, + CSV import/export (see Phases 6-7) |
| `mobile-preview-0.5` | + today's-bag, + Settings tab, drag-reorder verified, tab icons, DB lock fix (Phase 9) |

These are **debug-signed** (no production keystore exists yet — see Distribution
Track D1 below), and the repo is public, so releases are visible to anyone, not just
the user. Fine for early testing; not appropriate once real users are involved.

---

## Phase 9 — v1 Polish & Gap-Closing — ✅ done, verified on-device (2026-07-24)

> Surfaced by a full code audit of the mobile port on **2026-07-24**, right after
> `mobile-preview-0.4` shipped, then built and verified the same day. The subsections
> below (P1/P2/P3) are kept as the record of what was decided and done; ordered by the
> severity they were triaged at.

**Outcome — all built and emulator-verified:**
- **P1 (today's-bag):** finished, not hidden — per-card "In bag" toggle, an "In bag (N)"
  filter, a bag count in the header substat, and a "Clear bag" action (with a confirm
  dialog). Verified end-to-end: toggle → card shows "✓ In bag" + accent border + substat
  count; filter narrows the list; the CSV Export "Today's bag (N)" scope (previously a
  dead path) now appears and narrows the export; Clear bag confirms, unmarks all, and
  auto-drops the now-empty filter. Files: `DiscCard.tsx` (toggle), `app/(tabs)/index.tsx`
  (state/filter/clear/count).
- **P2 (cosmetics):** fixed both. `headerShown: false` on the Tabs removed the duplicate
  title; added custom `react-native-svg` tab icons (`TabBarIcon.tsx` — bag / flight-arc /
  target) instead of pulling in `@expo/vector-icons` (avoids an npm install + keeps deps
  F-Droid-minimal). Both confirmed on every tab.
- **P3 (polish):** disc-suggest double-fetch fixed (userId held in a ref so `useFocusEffect`
  has stable `[]` deps); `SuggestResultCard` bar percentages now `Math.round`ed to match
  the website; `accessibilityRole`/`accessibilityState`/`accessibilityLabel` added to the
  bag action buttons, filter pills, scenario cards, and the in-bag toggle.

**Bonus fix found by this testing pass — DB write/read serialization.** Verifying
drag-reorder surfaced a real, pre-existing concurrency bug: `saveDiscs`'s
`withExclusiveTransactionAsync` could collide with a concurrent focus-effect `getDiscs`,
throwing an unhandled `database is locked` rejection (a silent failed read/save in a
release build). Fixed by serializing every public DB op in `db.ts` onto a single promise
chain (`serialize()`), with a raw `readMeta` helper so `setMeta`→`getMeta` doesn't
re-enter the queue and deadlock. Verified: heavy concurrent stress (rapid tab-switching +
drag write + back-to-back in-bag toggles) produced zero lock errors and no deadlock.

**Settings tab (added 2026-07-24, same pass).** A 4th bottom tab (gear icon,
`TabBarIcon.tsx` `settings`) → `app/(tabs)/settings.tsx`: (1) **Default throw view**
(RHBH/RHFH/LHBH/LHFH) persisted to `user_meta.arc_view` — Flight Shaper re-reads it on
focus, so a change here propagates (verified on-device); (2) **Data** — back up (CSV
share), import (reuses the CSV modals), and "Delete all discs" with a confirm; (3) a
disabled **Sync** placeholder marking where the v1.1 VPS-sync UI lands (per Phase 10);
(4) **About** — version, a local-only/no-tracking statement, GPLv3, and a source-code
link. Because Settings can now mutate the bag (import/delete-all), the **Bag** screen
also gained a `useFocusEffect` refetch (it previously loaded mount-only) so those changes
reflect when you return to it — the same pattern the plan keeps flagging. Deliberately
v1-scoped: no sync, no Marshall Street images yet.

**Drag-reorder — now verified on the emulator (closes the long-standing Phase 8 gap).**
The trick the earlier attempts missed: `adb input draganddrop`/`swipe` can't produce the
long-press-then-move that `react-native-draggable-flatlist` requires, but a raw hold-then-
move touch stream can:
`adb shell "input motionevent DOWN x y; sleep 0.9; input motionevent MOVE …; input motionevent UP …"`.
That reordered a card and the new order **persisted across a full kill+relaunch**. So a
physical device is *not* required to test drag-reorder — this technique is.

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

**Update 2026-07-24: both done.** Drag-reorder verified via `adb input motionevent`
(above); `0.5` sideloaded and confirmed working on a real physical Android phone. The
Minimum Milestone is fully met.

---

## Flight Shaper UX Rework (R2) — DONE, verified on emulator 2026-07-26

> **Status:** Direction chosen by the developer = **pinned arc on top**. Built in
> `app/(tabs)/flight-shaper.tsx` (commit `acd1a4c`): disc selector + arc + adjusted stats are
> now a fixed top panel; sliders scroll underneath (cause/effect co-visible); disc picker →
> compact selector + bottom-sheet modal; reference diagrams collapsed behind a toggle.
> **Layout-only** — physics/arc/slider semantics unchanged (typecheck clean, 48/48 Jest pass).
> **Visually verified on the `verify_test` emulator 2026-07-26** (debug APK + Metro): pinned
> arc stays fixed while the conditions panel scrolls (top zone pixel-identical across scroll);
> `VerticalSlider` scroll-lock holds in the nested ScrollView (dragging ARM 100%→57% moved the
> value without scrolling the page, arc + ghost-arc + ADJUSTED stats + distance updated live);
> disc-picker bottom-sheet opens, selecting a disc applies live and auto-closes, slider
> modifiers persist across the disc swap. No bugs found → no code change → `acd1a4c` stays a
> single clean commit. **R2 complete; R3 (app-wide polish) opens.**
>
> Original diagnosis + candidate directions kept below for context.

**Likely core problem (candidate diagnosis, confirm before reworking):** the screen is one
long vertical scroll in the order **disc picker → 5 sliders → two reference diagrams →
arc + distance**. The arc is the *output* you're trying to shape, but it sits at the very
bottom, below the sliders and both reference diagrams — so **while you drag a slider you
can't see the arc change** without scrolling. Cause and effect aren't co-visible, which
undercuts the whole point of an interactive shaper. Contributing factors: the inline "My
Bag" list eats vertical space at the top; the angle-reference + hyzer-reference diagrams
push the arc further down; the custom vertical sliders are small.

**Candidate directions (not decided):**
- Make the **arc always visible while adjusting** — e.g. a sticky/pinned arc panel at the
  top or bottom, or a two-pane split (sliders on one side, arc on the other in landscape),
  or collapse the disc picker + reference diagrams into expandable sections so sliders and
  arc share one screen.
- Reconsider the reference diagrams: useful, but maybe collapsible / behind a toggle so
  they don't separate the sliders from the arc.
- Revisit the disc picker (a compact dropdown/sheet instead of an inline list).

**Constraint:** this is a *layout* rework only — do **not** change the physics
(`legacyPhysics.ts`), the arc geometry, or the slider semantics. Same hard rule as the
original port: the model is correct, only the presentation changes. Get the developer's
read on what specifically feels worst before committing to a direction.

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

## Phase 10 — VPS Sync (roadmap step **R5** — pulled forward, before store submission)

> **Re-sequenced 2026-07-25:** this was "v1.1, after v1 ships." Per the Post-v1 Roadmap it's
> now **R5** — built *before* the Play/F-Droid store track (R6/R7), after the app-polish
> steps (R1–R3) and Marshall Street (R4). Still opt-in, still the developer's own VPS, still
> local-first.
>
> **⚠️ The authoritative design is now [`plan/docs/sync-design.md`](plan/docs/sync-design.md)**
> (locked 2026-07-25) — it supersedes the minimal sketch below where they differ. Key
> decisions made there: manual backup/restore (full-replace, one direction, with a pre-flight
> "overwrite?" check), TLS mandatory + plaintext at rest, a single `SYNC_TOKEN` gating the
> endpoints with the user selected behind it (the website is already passwordless via `/pick`,
> so one secret just stops unauthenticated internet *writes*), token in `expo-secure-store`,
> and a `/api/data/meta` probe for the pre-flight + connection test. The sketch below is kept
> as the original seed; read the design doc first.

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
| VPS sync | ~~v1.1~~ → **roadmap step R5** (2026-07-25 replan) — build before the store track, after app polish. Fully designed. |
| Physics V2 (`physicsV2.ts`) | Build alongside, switch when validated against real throw data |
| Multi-user picker screen | Schema supports it; UI can wait |
| User login / OAuth | Not needed — sync uses a simple bearer token |
| Third-party analytics | Not planned |
| Marshall Street flight images (DiscIt API) | ~~v1.1~~ → **roadmap step R4** (2026-07-25 replan) — build before the store track, after app polish. See section below. |

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

## Marshall Street Flight Path Images (roadmap step **R4** — ✅ DONE 2026-07-29)

> **BUILT 2026-07-29.** Opt-in, off by default, single host, silent offline fallback — the
> "cleanest FOSS way" per the Network-feature privacy bar. Zero new dependencies (RN core
> `fetch` + `<Image>`, existing `expo-sqlite`). Files:
> - `src/net/msMatch.ts` — pure match logic (ported from `app.py` `fetch_ms_pic`: exact
>   name + brand-substring match, first result with an **https** `pic`) + `src/net/msMatch.test.ts`
>   (8 unit tests, incl. the exact-name-not-prefix case and the non-https rejection).
> - `src/net/msPic.ts` — `fetchMsPicUrl(mfr, mold)`: cache-first, one network request only on a
>   miss, caches the outcome (URL or `''` = confirmed no-match) **only on a definitive response**
>   so an offline miss never freezes in as permanent "not found". Never throws.
> - `src/db/migrations.ts` — `ms_pic_cache(lookup_key, pic)` table (mirrors the website) +
>   `user_meta.ms_ref` column (app-only; defaults **0/OFF**, unlike the website's localStorage
>   default-ON — the F-Droid privacy bar wants zero network until opted in).
> - `src/db/db.ts` — `UserMeta.msRefEnabled`; `getCachedMsPic`/`putCachedMsPic`.
> - `ArcDetailModal.tsx` — when opt-in **and** arcView is RHBH, shows the MS image on a white
>   card (its graphic is drawn for a light ground) with a "Marshall Street flight path · RHBH"
>   caption; **any** failure (offline, no match, broken image via `onError`) silently swaps back
>   to the computed arc. Bag screen re-reads the opt-in on focus and passes it through.
> - `settings.tsx` — REFERENCE IMAGES card: a `Switch` (off by default) with honest copy naming
>   the single host `discit-api.fly.dev` and stating "off = fully offline".
>
> **Privacy-bar posture:** no request on launch/background/cache-hit; only host ever contacted is
> `discit-api.fly.dev`; RHBH-only; https-only URLs. This is also what finally *justifies* the
> `INTERNET` permission that was previously declared-but-unused (manifest-hygiene note above).
>
> **Open questions from the original design — resolved:** white-background reconciliation → put
> the image on a white card (don't fight it). Live-fetch vs. bundled table → **live, cached
> locally per disc** (mirrors the website; no big bundled lookup). DiscIt's 5-tier stability →
> **not adopted**; the app keeps its own 3-tier OS/ST/US (unchanged). Name mismatches (Buzzz vs
> Buzzz OS) → handled by the exact-name match, verified in `msMatch.test.ts`.
>
> Original design notes (kept for provenance):

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
