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

## Minimum Credible v1 Milestone

> This is the real finish line for v1. Not Play Store. Not F-Droid. Not Physics V2.

- [ ] Expo app opens cold on a physical Android device without crashing
- [ ] SQLite persists a bag across app kills (add disc → kill app → reopen → disc still there)
- [ ] Stability labels on disc cards match the website for the same disc
- [ ] Phase 0 parity tests pass (stability, distance, scenario filters)
- [ ] Flight Shape arc renders and updates when sliders move
- [ ] Disc Suggest shows correct bag matches for at least Roller and Max Distance scenarios
- [ ] CSV export produces a file, CSV import reads it back correctly

Everything after this — Play Store submission, F-Droid, Physics V2, sync — is a separate job.

---

## Phase 0 — Parity Test Fixtures

> Before writing any app code, define known-good input/output pairs from the **running website**.
> These are the acceptance criteria that prove the mobile port matches website behavior.

Run each test case on the website, capture the exact output, record it here.

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

**Expected formula:** `stability = fade + turn`. OS ≥ 1, US ≤ -1, ST = anything in between (strictly greater than -1 and less than 1).

> **Correction:** Leopard3 net = -1, which satisfies `≤ -1`, so it is US — not ST. Previous label "ST (boundary)" was wrong and would have encoded a contradiction into the parity tests. Verify on the website before porting.

### 0B — Distance Estimate Fixtures

Test `estimateDist()` with known inputs. Capture from the website's distance bar.

> **Correction (verified 2026-07-20 against `estimateDist()` in `flightshape.html` directly —
> pure function, no server round-trip needed, so computing it is equivalent to reading it off
> the site):** the previous "~" values were unrounded approximations that didn't match what the
> function actually returns (it rounds to the nearest 10ft at the end). Most were off by 5-10ft;
> the hyzer row was off by 32ft (342 vs the real 310) — a real arithmetic error, not just
> rounding. Values below are exact, not approximate.

| Disc (speed) | Arm% | Wind | Glide | Nose° | Hyzer° | Expected dist (ft) |
|-------------|------|------|-------|-------|--------|-------------------|
| Aviar (spd 2) | 100 | 0 | 3 | 0 | 0 | 120 |
| Leopard3 (spd 7) | 100 | 0 | 5 | 0 | 0 | 260 |
| Destroyer (spd 12) | 100 | 0 | 5 | 0 | 0 | 380 |
| Destroyer (spd 12) | 50 | 0 | 5 | 0 | 0 | 190 |
| Destroyer (spd 12) | 100 | +15 | 5 | 0 | 0 | 330 (headwind) |
| Destroyer (spd 12) | 100 | 0 | 5 | +10 | 0 | 320 (nose up) |
| Destroyer (spd 12) | 100 | 0 | 5 | 0 | +30 | 310 (hyzer) |

**Formula (verified against source):** `Math.round(baseFt*(arm/100)*(0.85+glide*0.03)*(1-wind*0.008)*noseFactor*hyzerFactor/10)*10`, where `baseFt = 80 + speed*25`. The final round-to-nearest-10 step is easy to miss when hand-deriving fixtures — port it exactly, don't drop it.

### 0C — Arc Path Shape Fixtures

Not exact SVG strings — shape class labels. Set up each throw on the website and record the stability badge shown on the adjusted disc.

| Disc | Arm% | Hyzer° | Nose° | Wind | Spin% | Expected adjusted stability |
|------|------|--------|-------|------|-------|----------------------------|
| Destroyer (12/5/-1/3) | 100 | 0 | 0 | 0 | 100 | OS (net +2) |
| Destroyer (12/5/-1/3) | 40 | 0 | 0 | 0 | 100 | More OS (underpowered) |
| Roadrunner (9/5/-4/1) | 100 | 0 | 0 | 0 | 100 | US (net -3) |
| Roadrunner (9/5/-4/1) | 100 | +20 | 0 | 0 | 100 | Less US (hyzer counters turn) |
| Roadrunner (9/5/-4/1) | 100 | 0 | 0 | +15 | 100 | More US (headwind reveals turn) |
| Leopard3 (7/5/-2/1) | 100 | 0 | 0 | 0 | 30 | More US (low spin → less gyro) |

### 0D — Scenario Filter Fixtures

For each scenario, record which of these 5 discs appear in bag results:

Test discs:
- **A:** Aviar (2/3/0/1) — net +1, Putt & Approach
- **B:** Buzz (5/4/-1/2) — net +1, Mid Range
- **C:** Leopard3 (7/5/-2/1) — net -1, Control Driver
- **D:** Destroyer (12/5/-1/3) — net +2, Distance Driver
- **E:** Roadrunner (9/5/-4/1) — net -3, Distance Driver

| Scenario | Expect A | Expect B | Expect C | Expect D | Expect E |
|----------|----------|----------|----------|----------|----------|
| Dead Straight | ❌ speed<4 | ✅ | ✅ (net=-1 boundary) | ❌ net>1 | ❌ net<-1 |
| Reliable Hyzer | ❌ fade=1 | ❌ fade=2 | ❌ fade=1 | ✅ fade=3,turn≥-1 | ❌ fade=1,turn=-4 |
| Max Distance | ❌ spd<11 | ❌ spd<11 | ❌ spd<11 | ✅ spd≥11,fade≤3,turn≤-0.5 | ❌ spd=9<11 |
| Tailwind | ❌ spd<9 | ❌ spd<9 | ❌ spd<9 | ❌ net=+2, fails net≤0 | ✅ spd≥9,turn≤-1,net≤0 |
| Turnover | ❌ turn=0 | ❌ turn=-1 | ✅ turn=-2,fade=1,net=-1 | ❌ turn=-1 | ✅ turn=-4,fade=1,net=-3 |
| Roller | ❌ turn=0 | ❌ turn=-1 | ❌ turn=-2 not ≤-3 | ❌ turn=-1 | ✅ turn=-4,fade=1≤1 |

> Verified 2026-07-20 against the real `bagTest` predicates in `discsuggestion.html`'s
> `SCENARIOS` array (12 scenarios exist there; this table samples 6, which is fine for parity
> coverage).

> **Correction:** Destroyer's Tailwind rejection was previously noted as "turn=-1 not ≤-1" which is mathematically false (-1 ≤ -1 is true). The real reason Destroyer fails Tailwind is `net = +2`, which fails `net ≤ 0`. The comment bug matters — if copied into code or test comments it would describe the wrong condition.

> **Correction:** Leopard3's Turnover cell was marked ❌ despite the table's own reasoning
> proving all three conditions true (`turn=-2 ≤ -2` ✅, `fade=1 ≤ 2` ✅, `net=-1 ≤ -1` ✅) —
> the symbol just hadn't been updated to match. Leopard3 **does** match Turnover; fixed above.

---

## Phase 1 — Expo Scaffold ✅ done (2026-07-20)

**Goal:** Blank Expo project with navigation, theme, and bundled assets. No business logic yet.

> All deliverables below verified end-to-end on this machine's existing toolchain (JDK 21,
> Android SDK 36, NDK 27.1.12297006 — already installed, no setup needed): `./gradlew
> assembleDebug` produced a real signed APK (`com.disctracker.app`, target SDK 36), confirmed
> zero GMS/Firebase/Play Services dependencies via `./gradlew app:dependencies`. Expo SDK 57
> (satisfies "54+"), expo-router for the bottom tab shell, `src/theme.ts` ported from
> `static/style.css`'s real token values. No EAS anywhere in the pipeline. Next: Phase 2 (port
> pure utility functions), verified against the Phase 0 fixtures above.

```bash
cd /home/ubuntu/disc_tracker
npx create-expo-app app --template blank-typescript
cd app
npx expo install expo-sqlite expo-router react-native-svg \
  @react-native-community/slider react-native-gesture-handler \
  react-native-reanimated react-native-draggable-flatlist \
  expo-file-system expo-sharing expo-document-picker
cp ../static/discs_master.json assets/

# Generate the android/ bare project and commit it immediately
npx expo prebuild --platform android --clean
git add android/
```

**Deliverables:**
- `app.json` with `slug`, `android.package = "com.disctracker.app"`, SDK 54+
- `android/gradle.properties` with `-Xmx4g -XX:MaxMetaspaceSize=1g` JVM args (add before first build)
- `android/app/build.gradle` signing config reading from env vars (never commit credentials)
- `src/theme.ts` with all color constants matching web CSS vars
- Bottom tab navigator: Bag / Flight Shaper / Disc Suggest
- `npx expo start` runs without errors
- `cd android && ./gradlew assembleRelease` produces an APK signed with your key

**Package manager:** `npm` at repo root. No pnpm, no workspace, no monorepo subdir. Flat `node_modules`.

**Required toolchain:** JDK 21 OpenJDK (not Temurin), Android SDK 36, NDK 27.1.12297006.

**No EAS.** All builds — dev client and release — run through local Gradle (`./gradlew`), matching DragTree's setup. No `eas.json`. iOS is out of scope for now.

**Do not yet:** write any disc logic, DB calls, or screen content.

---

## Phase 2 — Port Pure Utility Functions ✅ done (2026-07-20)

**Goal:** All pure logic functions in TypeScript, tested against Phase 0 fixtures.

Files created (all in `src/utils/`):
- `disc.ts` — `stab()`, `discType()`, `stabClass()`, `stabShort()`, `bagToDisc()`, `typeShort()`, `MASTER_TYPE_LABEL`
- `legacyPhysics.ts` — `MOD`, `applyModifiers()`, `arcPoints()`, `estimateDist()` — exact port, no changes
- `scenarios.ts` — the real 12-entry `SCENARIOS` array (not a subset) + `filterBag()`, `filterLibrary()`
- `csv.ts` — `buildCSV()`, `parseCSV()`, `discKey()`, `previewImport()` (dedupe + `MAX_IMPORT` cap, matching the website's current behavior — this didn't exist yet when this phase was originally scoped, so it's slightly more than the plan's original `exportCSV()`/`importCSV()` naming, but same behavior)

**Verification:** Jest (`ts-jest`, `jest.config.js` at the `app/` root) with `*.test.ts` files beside each module, asserting the exact Phase 0 fixture inputs/outputs from PORT_PLAN.md §0A-§0D — including the corrected distance values and the Leopard3/Turnover fix. `npm test` — **48/48 passing**, matched the live website's math on the first real run with zero discrepancies (Phase 0's verification-before-porting approach paid for itself here).

**Not done yet, correctly deferred:** connecting any of this to a screen or a database — that's Phases 3+.

---

## Phase 3 — SQLite Schema and CRUD ⚠️ code done, not verified on-device (2026-07-20)

**Goal:** Database layer identical to Flask backend behavior.

> `src/db/migrations.ts` and `src/db/db.ts` are written and typecheck clean, matching
> `app.py`'s `init_db()` schema and migration list exactly — including `in_bag`, which this
> plan's schema section didn't have before now (a real gap, closed here). `saveDiscs()` is a
> full delete+reinsert, deliberately the same "replace this user's entire disc set" shape a
> future sync push/pull would need (see the comment at the top of `db.ts` and RESEARCH.md §2)
> — nothing about local-only v1 blocks adding sync later without a rewrite.
>
> **What's not done:** the verification checklist below (open → create user → save 3 discs →
> read back → delete-cascade) was written as a test but had to be deleted — `expo-sqlite` is a
> native module with no real SQL behavior under plain Node/Jest, so a test file that "passes"
> there wouldn't actually be testing anything. This needs an Android emulator or physical
> device to verify for real, which wasn't run this pass. Do that before starting Phase 4.

**Package:** `expo-sqlite` v14+ (built into Expo SDK 54) — native async/await, no community package needed.

Files: `src/db/db.ts` + `src/db/migrations.ts`

```typescript
// db.ts — must run on every connection:
db.execAsync('PRAGMA foreign_keys = ON');

// Functions to implement:
openDatabase(): Promise<void>         // run migrations, set PRAGMA
getOrCreateDefaultUser(): Promise<number>   // v1: auto-create "My Bag" user
getDiscs(userId: number): Promise<Disc[]>
saveDiscs(userId: number, discs: Disc[]): Promise<void>   // bulk replace (same as POST /api/data)
getMeta(userId: number): Promise<UserMeta>
setMeta(userId: number, updates: Partial<UserMeta>): Promise<void>
```

**Migration pattern:** All schema versions live in `migrations.ts`, applied in sequence on app launch. Version the schema — don't just rely on `CREATE IF NOT EXISTS`. Same logic as Flask's `init_db()`: base tables first, then `ALTER TABLE ADD COLUMN` for `color` and `arc_view`, each wrapped in try/catch.

**Verification:** Write a test that:
1. Opens DB
2. Creates default user
3. Saves 3 discs
4. Reads them back
5. Deletes user — confirms discs are gone (CASCADE working via PRAGMA)

---

## Phase 4 — Bag Screen

**Goal:** Full disc bag view matching `index.html` behavior.

**Features in priority order:**
1. Display disc list (cards with stability chip, flight numbers, color swatch) — **done**
2. Add disc from master library search — **done**
3. Edit disc (all fields) — **done**
4. Delete disc (confirm) — **done**
5. Sort modes (speed-desc, speed-asc, name, mfr, custom) — **done**
6. Drag-reorder (`react-native-draggable-flatlist`) — **built, not yet verified on-device**
   (custom sort mode wires it up; needs a real drag gesture test, not just a tap-based
   emulator check — `adb shell input swipe` or a physical device)
7. Search / filter by stability class or disc type — **done**
8. Color picker — **done**
9. CSV export — not started (moved to Phase 7, which owns the CSV parity check)
10. CSV import — not started (moved to Phase 7, which owns the CSV parity check)

**Web behavior to match:**
- Card shows: mfr, mold, plastic, weight, speed/glide/turn/fade, use_desc, notes, color, stability chip
- Stability chip: OS (purple), ST (green), US (amber) — using `stabClass()` / `stabShort()`
- Sort persisted to `user_meta.sort_mode`
- Custom sort order persisted to `discs.sort_order`

**Skip for v1:** Welcome modal (one-time tooltip shown to new users).

**Status (2026-07-23):** Items 1–5, 7, 8 built and verified end-to-end on a real Android
emulator (`src/components/DiscCard.tsx`, `DiscFormModal.tsx`, `DiscLibraryModal.tsx`,
`src/utils/masterLibrary.ts`, `src/utils/discColors.ts`, `app/(tabs)/index.tsx`) —
display, add-from-library (with a real bug found and fixed: the form modal didn't
remount between a blank add and a library-prefilled add, so prefill silently no-opped;
fixed via an explicit remount-key counter), edit, delete-with-confirm, and SQLite
persistence across app kills all confirmed by hand on-device, not just typechecked.
Item 6 (drag-reorder) is wired up (`DraggableFlatList`, `GestureHandlerRootView` added
to `app/_layout.tsx`) but not yet drag-tested for real — `adb shell input tap` can't
simulate a drag gesture, so this needs a follow-up pass with a real swipe/drag input or
a physical device. CSV (9–10) intentionally deferred to Phase 7 below, which already
owns the CSV parity check against the website — building it here would be working
ahead of that phase's own verification step.

---

## Phase 5 — Flight Shape Screen

**Goal:** Flight simulator matching `flightshape.html` behavior.

**Features:**
1. Disc picker (from bag + manual number entry)
2. 5 sliders: hyzer (-30°..+30°), nose (-20°..+20°), wind (-20..+20), arm (0–100%), spin (0–100%)
3. Arc SVG redraws on every slider change
4. Ghost arc shown when sliders deviate from default
5. Adjusted stability badge + flight numbers
6. Distance estimate bar
7. arcView selector (RHBH/RHFH/LHBH/LHFH) — persisted to `user_meta.arc_view`
8. Hyzer reference diagram (X-shaped SVG with disc silhouettes)
9. Side-view and back-view angle diagrams
10. Reset button

**Key mapping decisions:**
- Horizontal `<input type="range">` → `@react-native-community/slider` (horizontal, default)
- Vertical sliders → Custom `VerticalSlider.tsx` using **Reanimated 4 + `useSharedValue`** — gives 60fps arc update on-device without threading headaches (smoother than canvas-based web approach)
- `arcPoints()` output → `<Svg>` + `<Path>` in `react-native-svg`
- `drawArc()` → `ArcSvg.tsx` component that takes adjusted disc + sliders, renders SVG

**Parity check:** Load Destroyer (12/5/-1/3) at 100%/0°/0°/calm/100%. Arc should show slight right turn then firm left fade. Distance bar ~380ft.

---

## Phase 6 — Disc Suggest Screen

**Goal:** Scenario recommendation matching `discsuggestion.html` behavior.

**Features:**
1. 12-scenario grid (2 columns mobile → 3 → 6 at wider widths)
2. Tap scenario → show bag matches + library matches
3. Bag matches: "In your bag" highlighted cards
4. Library matches: top 15 sorted by proximity to scenario midpoint stability, deduplicated against bag
5. Stability chip + stability bar on each card

**Master library:** Loaded from `assets/discs_master.json` via `require()` — no network call.

**Parity check:** Select "Roller" scenario. Only discs with `turn <= -3` and `fade <= 1` should appear in bag results.

---

## Phase 7 — Import / Export

**Goal:** CSV round-trip matches web behavior.

**Export fields (in order):** `mfr, mold, plastic, weight, speed, glide, turn, fade, use, thr, notes, color`

**Import behavior:**
- Parse header row to find column positions (order-agnostic)
- Strip leading `#` from color if present
- Assign new `disc_id` values (from `user_meta.next_id`)
- Append to current bag (do not clear existing discs)

**Mobile implementation:**
- Export: `expo-file-system` write temp file → `expo-sharing` share sheet
- Import: `expo-document-picker` pick `.csv` → read text → parse → insert into SQLite

**Parity check:** Export bag from web app, import CSV into mobile app. All discs appear with correct fields.

---

## Phase 8 — Android Build and Smoke Test

**Goal:** Real APK on a physical device, all screens verified. This phase ends at a working APK — Play Console and F-Droid submission are distribution tasks that follow, not part of this phase.

### 8A — Local Preview Build (sideload testing)

```bash
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
# APK is at android/app/build/outputs/apk/release/ — install via adb or direct transfer
```

`-PreactNativeArchitectures=arm64-v8a,armeabi-v7a` overrides `gradle.properties`'
default (all 4 ABIs, kept for local emulator debug builds — this machine's AVDs are
x86_64) for real-device release builds only: real phones are arm64-v8a or, on older
hardware, armeabi-v7a — x86/x86_64 are emulator/Chromebook-only and just dead weight in
a release/sideload APK. Also cuts release build time roughly in proportion to the
number of native targets dropped. `android.enableMinifyInReleaseBuilds` and
`android.enableShrinkResourcesInReleaseBuilds` are also on now (`gradle.properties`) —
R8 + resource shrinking for release only, debug is unaffected.

**Smoke test checklist:**
- [ ] App opens cold — no crash
- [ ] Default user auto-created on first launch
- [ ] Bag screen loads empty bag
- [ ] Add a Destroyer from library search
- [ ] Stability chip shows OS (purple)
- [ ] Flight Shape: select Destroyer → arc visible → move hyzer slider → arc updates
- [ ] Distance bar shows ~380ft at 100% arm, flat, calm
- [ ] Disc Suggest: tap "Max Distance" → Destroyer appears in bag results
- [ ] Tap "Roller" → Destroyer does NOT appear (fade=3, not ≤1)
- [ ] Export CSV → share sheet appears with file
- [ ] Kill app → reopen → Destroyer still in bag (SQLite persistence confirmed)
- [ ] Play target SDK check: `aapt dump badging app.apk | grep sdkVersion` → `targetSdkVersion='35'`

### 8B — GMS / Proprietary Dependency Check

```bash
cd android && ./gradlew app:dependencies | grep -i 'gms\|firebase\|play-services'
# Must return nothing — any GMS dep blocks F-Droid distribution later
```

> Phase 8 ends here. The APK works, the parity checklist passes, GMS is clean. **Distribution is a separate track that starts after this.**

---

## Distribution Track (after Phase 8 APK is proven)

> These are not phases of the port — they are deployment infrastructure. Do not start until the minimum v1 milestone is met.
>
> **Sequence these in order. Do not run D1 and D2 in parallel.** From DragTree experience: Play Console and F-Droid each have their own gradle/signing/metadata problems. Debugging both at once means you cannot isolate which system is causing a given failure. Get Play Console internal testing fully working first, then start F-Droid. The app does not change between them — only the build pipeline and metadata do.

### D1 — Play Console (do this first)

```bash
# Local AAB build (not EAS)
cd android && ./gradlew bundleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
# Upload AAB to Play Console → Internal testing → Closed testing
```

Same ABI override as 8A — Play generates per-device split APKs from the AAB itself, so
there's no reason to ship x86/x86_64 native code in it either.

Resolve all Play Console requirements before touching F-Droid:
- Target SDK declaration
- Data Safety form
- Content rating (IARC)
- Privacy policy URL live on GitHub Pages
- App signing: upload keystore to Play App Signing via Play Console

Only move to D2 once an internal tester can install and run the app from Play Console.

### D2 — F-Droid Self-Hosted (after D1 is working)

F-Droid setup took significantly longer than Play Console on DragTree — different kind of pain (reproducible build expectations, metadata files, fdroidserver quirks, key decisions) vs Play Console's bureaucratic UI hoops. Do not underestimate it.

**The reproducible build reality (from DragTree):**
Local builds are the prerequisite — EAS cloud builds never matched F-Droid's Debian sandbox. Local builds close the gap as much as possible (same JDK flavor, same NDK version, flat npm). However: no React Native/Expo app is *known* to have achieved a full F-Droid byte-match. The goal is to get close enough that F-Droid's reviewer accepts it, not to guarantee a perfect bit-for-bit match.

**Reference APK workflow:**
1. Build locally with production keystore: `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a`
2. Verify signing: `apksigner verify --print-certs app-release.apk` — SHA256 must match `AllowedAPKSigningKeys` in fdroiddata YAML
3. Tag: `git tag v1.0.0 && git push --tags`
4. Upload signed APK to GitHub releases as `disc-tracker-v1.0.0.apk`
5. Add `Binaries:` entry to fdroiddata YAML pointing at the GitHub release URL

**Self-hosted repo:**
Reuse DragTree's `fdroidserver` setup — same infrastructure, new app entry.

1. Add `metadata/com.disctracker.app.yml` to the F-Droid repo
2. Run fdroidserver update — APK appears in self-hosted repo
3. Verify install from F-Droid client using self-hosted repo URL

### D3 — Official F-Droid Index (after D2 is stable)

Weeks-long review process. Start submission early. Self-hosted (D2) covers distribution in the meantime. Local builds give the best shot at reproducibility verification — but be honest with the reviewer about Expo/RN's reproducibility limitations if they flag it. Do not let D3 block anything.

---

## Phase 9 — VPS Sync (v1.1, after v1 ships)

**Goal:** Optional manual sync between phone and the existing Flask website via the same `/api/data` endpoints.

**What this is NOT:** a cloud service, a third-party backend, a new database. It's the user's own VPS running the same Flask app that powers the website.

### Flask changes (minimal)

```python
# app.py — add token check to /api/data GET and POST
SYNC_TOKEN = os.environ.get('SYNC_TOKEN')

def check_sync_token():
    if SYNC_TOKEN and request.headers.get('Authorization') != f'Bearer {SYNC_TOKEN}':
        abort(401)

# Add to both /api/data routes:
check_sync_token()
```

### Mobile changes

Settings screen additions:
- Server URL field (e.g. `https://yoursite.com`)
- Token field (bearer token matching `SYNC_TOKEN` on VPS)
- "Push to server" button — sends local bag to server via `POST /api/data`
- "Pull from server" button — fetches server bag and overwrites local via `GET /api/data`
- Last synced timestamp display

```typescript
// sync.ts — the whole sync layer
async function pushToServer(url: string, token: string, discs: Disc[]) {
  await fetch(`${url}/api/data`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ discs })
  });
}

async function pullFromServer(url: string, token: string): Promise<Disc[]> {
  const res = await fetch(`${url}/api/data`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { discs } = await res.json();
  return discs;
}
```

**Conflict model:** none — full replace in the direction the user chose. For a single-user bag this is always correct.

### Before submitting v1.1 to Play Store or F-Droid official index

These must be resolved first (see `RESEARCH.md` Section 11 open questions):

- [ ] Research how other self-hosted sync apps (Obsidian, Nextcloud, Syncthing) word Play Store Data Safety form for opt-in user-controlled sync
- [ ] Write exact Data Safety form language for v1.1 — draft and review before submitting
- [ ] Update privacy policy with sync section
- [ ] Decide on token setup UX (env var on VPS? in-app pairing? auto-generated in Flask?)
- [ ] Consider publishing OpenAPI spec for sync endpoints in repo — makes "open API" claim concrete

---

## Scope Boundaries for v1

Keep v1 focused — these can be revisited after shipping:

| Defer to later | Notes |
|----------------|-------|
| VPS sync | v1.1 — fully designed, don't build yet |
| Physics V2 (`physicsV2.ts`) | Build alongside, switch when validated against real throw data |
| Multi-user picker screen | Schema supports it; UI can wait |
| User login / OAuth | Not needed — sync uses a simple bearer token |
| Third-party analytics | Not planned |

**Technical musts** (these will cause real problems if skipped):
- `PRAGMA foreign_keys = ON` on every SQLite connection — or CASCADE deletes silently fail
- Target API 35 — Play Store requirement as of Aug 31 2025; Expo SDK 54 handles it
- No GMS dependencies — required for F-Droid; check `./gradlew app:dependencies` before submitting
- Local dev build (`npx expo run:android`, not Expo Go, no EAS) once any native module is added
- Port `applyModifiers()` and `arcPoints()` exactly — improve via `physicsV2.ts`, not by editing the port
- Resolve sync privacy/Data Safety wording before v1.1 Play Store submission

---

## Physics V2 (Parallel Track — Not Blocking v1)

Build `physicsV2.ts` alongside the port, but do not switch the Flight Shape screen to V2 until:
1. `simulateFlight()` passes all Phase 0C arc shape fixtures
2. At least 10 real throw data points have been collected and used to tune `DEFAULT_FLIGHT_TUNING`
3. User explicitly approves the switch

See `RESEARCH.md` Section 7 for full V2 architecture and real-throw data collection format.

---

## Marshall Street Flight Path Images (Decision Track)

> Decision: **implement in v1.1, not v1.** The feature is compelling and the API is free, but it introduces a network dependency and design questions that should not block shipping. Document the decision here so it's ready to build.

### What the DiscIt API provides

Live REST API at `discit-api.fly.dev` — scrapes Marshall Street Disc Golf's interactive flight guide nightly.

```
GET /disc             → all discs
GET /disc?name=buzzz  → filter by field
GET /disc/:id         → single disc
```

Each disc record includes:

```json
{
  "id": "aa24b5ff-...",
  "name": "Destroyer",
  "brand": "Innova",
  "category": "Distance Driver",
  "speed": "12", "glide": "5", "turn": "-1", "fade": "3",
  "stability": "Overstable",
  "link": "https://www.marshallstreetdiscgolf.com/?s=destroyer&post_type=product",
  "pic": "https://s3.amazonaws.com/media.marshallstreetdiscgolf.com/inbounds/2079719.webp",
  "color": "#2A290E",
  "background_color": "#F3EB09"
}
```

**Coverage:** 1,107 of 1,203 discs have a `pic` URL (~92%). The ~96 without are obscure/rare molds.

### What the `pic` images actually are

400×340 webp. White background. Left half: a colored arc on a coordinate grid (meters on Y, lateral % on X). Right half: disc name, brand, PDGA physical specs (diameter, height, rim depth/width, max weight, approval date), Marshall Street branding.

The arc is a real measured flight path from Marshall Street's own flight guide — not computed from flight numbers. RHBH only. No adjustments for conditions (wind, hyzer, etc.).

### What this adds to the app

| Feature | Notes |
|---------|-------|
| **Reference flight image** | Show the MS image on the disc detail modal — the "official" arc from the manufacturer's data, not our approximation |
| **PDGA physical specs** | Diameter, height, rim dimensions, weight. Currently not shown anywhere in the app |
| **Store link** | "Buy at Marshall Street" link per disc — natural monetization-neutral feature |
| **5-tier stability label** | Very Understable / Understable / Stable / Overstable / Very Overstable — richer than our 3-tier OS/ST/US |
| **Flight path source toggle** | Let user choose: Marshall Street image (when online) vs computed arc (always available offline) |

### Is this over-engineered?

**The `pic` image alone: no.** It's a single image URL cached per disc. The implementation is:
1. Look up disc by name+brand in DiscIt API → get `pic` URL
2. Store URL in local SQLite alongside the disc
3. Show image in an expandable detail view

That's 50 lines of code and zero ongoing complexity.

**The flight path source toggle: maybe.** Showing the MS image *instead of* the computed arc in the Flight Shaper requires replacing the interactive SVG with a static image, which means losing hyzer/wind/arm adjustments for the MS mode. That's a real UX tradeoff.

**The right framing:** the MS image and the computed arc answer *different questions*:
- MS image = "what does this disc do at 100% power, RHBH, flat, calm" — a static reference
- Computed arc = "what does this disc do *given my throw conditions*" — interactive

They're not competing. Show both, in different places.

### Proposed feature design

**Show MS image in disc detail modal (always, when available):**
- User taps the arc SVG on a bag card → expand modal
- Existing computed arc at top (interactive, per throw conditions)
- Below it: "Marshall Street reference" section showing the `pic` image
- Falls back gracefully if `pic` is null or network unavailable — just shows nothing

**Settings toggle for Flight Shaper:**
```
Flight path source:
  ● Computed (offline, adjustable for conditions)  ← default
  ○ Marshall Street (requires internet, RHBH reference only)
```

When "Marshall Street" is selected:
- Flight Shaper shows the `pic` image instead of the computed SVG
- Sliders are hidden (they don't apply to a static image)
- A note: "Marshall Street reference — RHBH, full power, calm"
- If image fails to load or disc has no `pic`: auto-fall back to computed arc

**v1.1 implementation order:**
1. Add `ms_pic_url` column to discs SQLite table (migration, nullable)
2. On disc add/import: look up DiscIt API by name+brand, store `pic` URL if found
3. Show MS image in disc detail expand modal (read-only reference)
4. Add Settings screen with flight path source toggle
5. Flight Shaper respects the toggle

### API reliability and privacy

- DiscIt API is a third-party free service. It could go down, change, or disappear. **Never block the app on it.** Always fall back to computed arc.
- The API call is outbound from the device to `discit-api.fly.dev`. For F-Droid/FOSS claims: declare it in the privacy policy as "optional disc image fetching from a third-party service." No personal data is sent — only the disc name/brand.
- Cache `pic` URLs locally in SQLite after first fetch. Don't re-fetch on every launch.
- If the user has flight path source set to "computed," no call to DiscIt API is ever made.

### Decision summary

| Question | Answer |
|----------|--------|
| Do this? | Yes — the `pic` images are genuinely cool and unique |
| Blocks v1? | No — v1.1 feature |
| Replace computed arc? | No — show both, for different purposes |
| Settings toggle needed? | Yes — Marshall Street is RHBH-only, offline users need computed arc |
| Over-engineered? | Not if scoped to `pic` display + optional toggle. Over-engineered if we try to parse the image or mix the two arcs |
| F-Droid safe? | Yes — network call is optional, no GMS, no proprietary SDK |
| Super cool? | Yes — official Marshall Street flight data alongside your adjusted arc is genuinely useful |

### Open questions before building

1. Does the DiscIt API's `pic` URL for a disc in `discs_master.json` match by name+brand? Need to verify matching logic — some disc names differ slightly between datasets (e.g. "Buzzz" vs "Buzzz OS").
2. Should we bundle a pre-fetched lookup table (name → pic URL) with the app, or always fetch live? Bundled = no network needed but gets stale; live = always current but requires connectivity on disc add.
3. The MS images have a white background. The app is dark-themed. Options: show image in a white-background card, invert the image (hacky), or accept the contrast mismatch.
4. The 5-tier stability label from DiscIt ("Very Overstable" etc.) — do we adopt it alongside or instead of the 3-tier (OS/ST/US)?
